import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();

    const isHtml = req.headers.get("accept")?.includes("text/html");
    if (isHtml) {
      return NextResponse.redirect(new URL("/", req.url));
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch {
    // Ignore error and redirect
  }
  return NextResponse.redirect(new URL("/", req.url));
}
