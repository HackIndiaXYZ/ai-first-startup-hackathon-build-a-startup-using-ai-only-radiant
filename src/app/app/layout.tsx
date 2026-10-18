import { ReactNode, Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppNav } from "@/components/app-nav";
import { AppHeader } from "@/components/app-header";

// Opt this authenticated segment into blocking request-time validation under Cache Components
export const instant = false;

export const metadata = {
  title: "DukaanAI — दुकान खाता",
  description: "AI-powered voice and udhar ledger for Indian kirana stores",
};

export default async function AppLayout({ children }: { children: ReactNode }) {
  // Server-side verification using getUser() (not getSession or cookie presence)
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/");
  }

  // Derive shop details for header
  const { data: shop } = await supabase
    .from("shops")
    .select("name")
    .eq("owner_id", user.id)
    .maybeSingle();

  return (
    <div className="flex flex-col min-h-[100dvh] bg-background text-foreground antialiased selection:bg-primary/20">
      <AppHeader shopName={shop?.name} userEmail={user.email} />
      <div className="flex-1 max-w-md mx-auto w-full pb-20">
        <Suspense
          fallback={
            <div className="flex flex-col gap-4 p-4">
              <div className="h-24 rounded-2xl bg-muted/40 animate-pulse border border-border/40" />
              <div className="h-44 rounded-2xl bg-muted/40 animate-pulse border border-border/40" />
            </div>
          }
        >
          {children}
        </Suspense>
      </div>
      <Suspense fallback={<div className="h-16" />}>
        <AppNav />
      </Suspense>
    </div>
  );
}
