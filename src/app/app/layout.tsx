import { ReactNode, Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { AppNav, AppSidebar } from "@/components/app-nav";
import { AppHeader, AppHeaderSkeleton } from "@/components/app-header";
import { getIstDayRange } from "@/lib/date-utils";

export const metadata = {
  title: "DukaanAI — Store Ledger",
  description: "AI-powered voice and udhar ledger for Indian kirana stores",
};

// Small async server component for fresh request-time header data & auth
async function AppHeaderServer() {
  // Await connection() to opt this Suspense boundary into request-time rendering
  await connection();

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/");
  }

  const { data: shop } = await supabase
    .from("shops")
    .select("name")
    .eq("owner_id", user.id)
    .maybeSingle();

  // Fresh request time for IST date / today label passed into lib helper
  const now = new Date();
  const { istDateString } = getIstDayRange(now);

  return (
    <AppHeader
      shopName={shop?.name}
      userEmail={user.email}
      istDateString={istDateString}
    />
  );
}

// Small async server component for fresh request-time auth guard on child routes
async function AppAuthGuard({ children }: { children: ReactNode }) {
  // Await connection() before auth check so layout shell prerenders statically
  await connection();

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/");
  }

  return <>{children}</>;
}

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col min-h-[100dvh] bg-background text-foreground antialiased selection:bg-primary/20 overflow-x-clip scroll-smooth">
      {/* Header rendered at request-time inside Suspense */}
      <Suspense fallback={<AppHeaderSkeleton />}>
        <AppHeaderServer />
      </Suspense>

      {/* Main container: centered max-w-md on mobile, max-w-[1200px] on desktop */}
      <div className="flex-1 max-w-md lg:max-w-[1200px] mx-auto w-full px-0 sm:px-4 lg:px-8 pb-20 lg:pb-10 flex flex-col lg:flex-row lg:gap-8 items-start">
        {/* Desktop Left Sidebar (>= 1024px) - Suspense wraps usePathname() client hook */}
        <Suspense fallback={<div className="hidden lg:flex w-56 shrink-0 h-64" />}>
          <AppSidebar />
        </Suspense>

        {/* Dynamic Content Area */}
        <div className="flex-1 min-w-0 w-full">
          <Suspense
            fallback={
              <div className="flex flex-col gap-4 p-4">
                <div className="h-24 rounded-2xl bg-muted/40 animate-pulse border border-border/40" />
                <div className="h-44 rounded-2xl bg-muted/40 animate-pulse border border-border/40" />
              </div>
            }
          >
            <AppAuthGuard>
              {children}
            </AppAuthGuard>
          </Suspense>
        </div>
      </div>

      {/* Mobile Bottom Navigation (< 1024px) - Suspense wraps usePathname() client hook */}
      <Suspense fallback={<div className="h-16" />}>
        <AppNav />
      </Suspense>
    </div>
  );
}
