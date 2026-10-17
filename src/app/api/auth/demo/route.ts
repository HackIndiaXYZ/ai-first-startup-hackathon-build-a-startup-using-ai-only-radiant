import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();

    const email = process.env.DEMO_USER_EMAIL || "demo@dukaanai.in";
    const password = process.env.DEMO_USER_PASSWORD as string;

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return NextResponse.json(
        {
          error: error.message,
          hint: "Make sure you ran 'npm run seed' to provision the demo account.",
        },
        { status: 401 }
      );
    }

    const isHtml = req.headers.get("accept")?.includes("text/html");
    if (isHtml) {
      return NextResponse.redirect(new URL("/", req.url));
    }

    return NextResponse.json({
      success: true,
      user: data.user,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  // Support GET redirect for direct link clicking
  try {
    const supabase = await createClient();
    const email = process.env.DEMO_USER_EMAIL || "demo@dukaanai.in";
    const password = process.env.DEMO_USER_PASSWORD as string;

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return NextResponse.redirect(new URL("/?demo_error=" + encodeURIComponent(error.message), req.url));
    }

    return NextResponse.redirect(new URL("/", req.url));
  } catch {
    return NextResponse.redirect(new URL("/?demo_error=server_error", req.url));
  }
}
