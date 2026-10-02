import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    ok: true,
    app: "DukaanAI",
    time: new Date().toISOString(),
    env: {
      supabaseUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
      supabaseAnonKey: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
      supabaseServiceKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      ollamaKey: Boolean(process.env.OLLAMA_API_KEY),
    },
  });
}