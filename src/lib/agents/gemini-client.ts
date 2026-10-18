import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

// Ensure this module is never bundled or executed on the client
if (typeof window !== "undefined") {
  throw new Error("Gemini client must only be used on the server.");
}

const AI_TIMEOUT_MS = 15000;

function getApiKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key || !key.trim()) {
    throw new Error(
      "Missing GEMINI_API_KEY environment variable. Please set it in .env.local"
    );
  }
  return key.trim();
}

function getModelConfig(): { primaryModel: string; fallbackModel?: string } {
  const primaryModel = process.env.LLM_MODEL;
  if (!primaryModel || !primaryModel.trim()) {
    throw new Error(
      "Missing LLM_MODEL environment variable. Please configure it in .env.local"
    );
  }
  const fallbackModel = process.env.LLM_FALLBACK_MODEL?.trim();
  return { primaryModel: primaryModel.trim(), fallbackModel: fallbackModel || undefined };
}

/**
 * Checks if an error corresponds to HTTP 429, 404, or 503 temporary unavailable.
 */
export function isFallbackEligibleError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const err = error as { status?: number; code?: number; message?: string };

  if (err.status === 429 || err.status === 404 || err.status === 503) return true;
  if (err.code === 429 || err.code === 404 || err.code === 503) return true;

  if (typeof err.message === "string") {
    const msg = err.message;
    if (msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED")) return true;
    if (msg.includes("404") || msg.includes("NOT_FOUND")) return true;
    if (msg.includes("503") || msg.includes("UNAVAILABLE") || msg.includes("high demand")) return true;
  }

  return false;
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  modelName: string
): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(
        new Error(
          `AI request timed out after ${timeoutMs / 1000} seconds on model "${modelName}". Please check your network and try again.`
        )
      );
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export interface GenerateOptions {
  contents: string;
  config?: Record<string, unknown>;
}

export interface GenerateResult {
  response: GenerateContentResponse;
  modelUsed: string;
  retriedOnFallback: boolean;
}

/**
 * Executes a Gemini request with automatic fallback:
 * If the primary model (LLM_MODEL) returns 429 or 404, retries once on LLM_FALLBACK_MODEL.
 * Model names are derived strictly from environment variables.
 */
export async function generateWithFallback(
  options: GenerateOptions
): Promise<GenerateResult> {
  const apiKey = getApiKey();
  const { primaryModel, fallbackModel } = getModelConfig();

  const ai = new GoogleGenAI({ apiKey });

  try {
    const response = await withTimeout(
      ai.models.generateContent({
        model: primaryModel,
        contents: options.contents,
        config: options.config,
      }),
      AI_TIMEOUT_MS,
      primaryModel
    );

    return {
      response,
      modelUsed: primaryModel,
      retriedOnFallback: false,
    };
  } catch (error: unknown) {
    if (
      isFallbackEligibleError(error) &&
      fallbackModel &&
      fallbackModel !== primaryModel
    ) {
      console.warn(
        `Primary model "${primaryModel}" encountered retryable error. Retrying once on fallback model "${fallbackModel}"...`
      );

      try {
        const fallbackResponse = await withTimeout(
          ai.models.generateContent({
            model: fallbackModel,
            contents: options.contents,
            config: options.config,
          }),
          AI_TIMEOUT_MS,
          fallbackModel
        );

        return {
          response: fallbackResponse,
          modelUsed: fallbackModel,
          retriedOnFallback: true,
        };
      } catch (fallbackError: unknown) {
        const errorMsg =
          fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
        throw new Error(
          `AI request failed on fallback model "${fallbackModel}": ${errorMsg}`
        );
      }
    }

    const errorMsg = error instanceof Error ? error.message : String(error);
    throw new Error(`AI request failed on primary model "${primaryModel}": ${errorMsg}`);
  }
}
