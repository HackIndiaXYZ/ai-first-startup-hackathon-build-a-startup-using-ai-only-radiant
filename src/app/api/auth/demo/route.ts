import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const VISITOR_GENERIC_ERROR =
  "Demo account is temporarily unavailable. Please try again shortly.";
const VISITOR_CONNECTION_ERROR =
  "Unable to connect to service. Please check your connection.";

function handleDemoError(error: unknown, context: string): { visitorMessage: string; code: string } {
  const errMsg = error instanceof Error ? error.message : String(error);
  // Log full specific technical details on server ONLY
  console.error(`[DemoAuth Server Error in ${context}]:`, errMsg);

  const lower = errMsg.toLowerCase();
  if (
    lower.includes("fetch") ||
    lower.includes("connect") ||
    lower.includes("network") ||
    lower.includes("enotfound") ||
    lower.includes("timeout")
  ) {
    return {
      visitorMessage: VISITOR_CONNECTION_ERROR,
      code: "CONNECTION_ERROR",
    };
  }

  return {
    visitorMessage: VISITOR_GENERIC_ERROR,
    code: "DEMO_UNAVAILABLE",
  };
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();

    const email = process.env.DEMO_USER_EMAIL || "demo@dukaanai.in";
    const password = process.env.DEMO_USER_PASSWORD;

    if (!password) {
      const err = handleDemoError(new Error("DEMO_USER_PASSWORD is not set in server environment"), "POST password check");
      return NextResponse.json({ error: err.visitorMessage, code: err.code }, { status: 500 });
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      const err = handleDemoError(error, "POST signInWithPassword");
      return NextResponse.json({ error: err.visitorMessage, code: err.code }, { status: 401 });
    }

    const isHtml = req.headers.get("accept")?.includes("text/html");
    if (isHtml) {
      return NextResponse.redirect(new URL("/app", req.url));
    }

    return NextResponse.json({
      success: true,
      user: data.user,
      redirectTo: "/app",
    });
  } catch (err: unknown) {
    const formatted = handleDemoError(err, "POST unhandled");
    return NextResponse.json({ error: formatted.visitorMessage, code: formatted.code }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  // Support GET redirect for direct link clicking
  try {
    const supabase = await createClient();
    const email = process.env.DEMO_USER_EMAIL || "demo@dukaanai.in";
    const password = process.env.DEMO_USER_PASSWORD;

    if (!password) {
      const err = handleDemoError(new Error("DEMO_USER_PASSWORD is not set in server environment"), "GET password check");
      return NextResponse.redirect(
        new URL(`/?demo_error=${encodeURIComponent(err.visitorMessage)}`, req.url)
      );
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      const err = handleDemoError(error, "GET signInWithPassword");
      return NextResponse.redirect(
        new URL(`/?demo_error=${encodeURIComponent(err.visitorMessage)}`, req.url)
      );
    }

    return NextResponse.redirect(new URL("/app", req.url));
  } catch (err: unknown) {
    const formatted = handleDemoError(err, "GET unhandled");
    return NextResponse.redirect(
      new URL(`/?demo_error=${encodeURIComponent(formatted.visitorMessage)}`, req.url)
    );
  }
}
