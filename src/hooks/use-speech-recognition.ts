"use client";

import { useEffect, useRef, useState, useCallback, useSyncExternalStore } from "react";

// Web Speech API interface declarations for TypeScript
interface IWindowSpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message?: string;
}

interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

type SpeechRecognitionConstructor = new () => IWindowSpeechRecognition;

const emptySubscribe = () => () => {};

function getSpeechSupportClient(): boolean {
  if (typeof window === "undefined") return true;
  return Boolean(
    (window as unknown as { SpeechRecognition?: SpeechRecognitionConstructor }).SpeechRecognition ||
    (window as unknown as { webkitSpeechRecognition?: SpeechRecognitionConstructor }).webkitSpeechRecognition
  );
}

export function useSpeechRecognition(options?: { onEnd?: (transcript: string) => void }) {
  const isSupported = useSyncExternalStore(
    emptySubscribe,
    getSpeechSupportClient,
    () => true
  );

  const [isListening, setIsListening] = useState<boolean>(false);
  const [transcript, setTranscript] = useState<string>("");
  const [interimTranscript, setInterimTranscript] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<IWindowSpeechRecognition | null>(null);
  const langRef = useRef<string>("hi-IN");
  const transcriptRef = useRef<string>("");
  const onEndRef = useRef<((transcript: string) => void) | undefined>(options?.onEnd);

  useEffect(() => {
    onEndRef.current = options?.onEnd;
  }, [options?.onEnd]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const SpeechRecognition =
      (window as unknown as { SpeechRecognition?: SpeechRecognitionConstructor }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: SpeechRecognitionConstructor }).webkitSpeechRecognition;

    if (!SpeechRecognition) return;

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = langRef.current;

      recognition.onstart = () => {
        setIsListening(true);
        setError(null);
      };

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let currentInterim = "";
        let finalPiece = "";

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          const text = result[0]?.transcript || "";
          if (result.isFinal) {
            finalPiece += text + " ";
          } else {
            currentInterim += text;
          }
        }

        if (finalPiece) {
          setTranscript((prev) => {
            const next = prev ? `${prev.trim()} ${finalPiece.trim()}` : finalPiece.trim();
            transcriptRef.current = next;
            return next;
          });
        }
        setInterimTranscript(currentInterim);
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.warn("Speech recognition error:", event.error);
        if (event.error === "not-allowed" || event.error === "service-not-allowed") {
          setError("माइक्रोफ़ोन अनुमति अस्वीकृत (Microphone permission denied)");
        } else if (event.error === "language-not-supported" && langRef.current === "hi-IN") {
          // Fallback to en-IN if hi-IN is not supported on this device
          langRef.current = "en-IN";
          if (recognitionRef.current) {
            recognitionRef.current.lang = "en-IN";
          }
        } else if (event.error !== "aborted" && event.error !== "no-speech") {
          setError(`आवाज़ इनपुट त्रुटि: ${event.error} (Speech error: ${event.error})`);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
        setInterimTranscript("");
        const fullTranscript = transcriptRef.current.trim();
        if (fullTranscript && onEndRef.current) {
          onEndRef.current(fullTranscript);
        }
      };

      recognitionRef.current = recognition;
    } catch (err) {
      console.error("Failed to initialize SpeechRecognition:", err);
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore cleanup abort
        }
      }
    };
  }, []);

  const startListening = useCallback(() => {
    if (!recognitionRef.current) return;
    setError(null);
    setInterimTranscript("");
    try {
      recognitionRef.current.lang = langRef.current;
      recognitionRef.current.start();
    } catch {
      // If already started, stop and restart
      try {
        recognitionRef.current.stop();
        setTimeout(() => {
          try {
            recognitionRef.current?.start();
          } catch {
            // ignore
          }
        }, 150);
      } catch {
        // ignore
      }
    }
  }, []);

  const stopListening = useCallback(() => {
    if (!recognitionRef.current) return;
    try {
      recognitionRef.current.stop();
    } catch {
      // ignore
    }
  }, []);

  const resetTranscript = useCallback(() => {
    setTranscript("");
    setInterimTranscript("");
    setError(null);
  }, []);

  return {
    isSupported,
    isListening,
    transcript,
    interimTranscript,
    error,
    startListening,
    stopListening,
    resetTranscript,
  };
}
