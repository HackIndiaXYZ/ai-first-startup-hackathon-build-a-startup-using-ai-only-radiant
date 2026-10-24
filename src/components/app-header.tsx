"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface AppHeaderProps {
  shopName?: string | null;
  userEmail?: string | null;
  istDateString?: string | null;
}

export function AppHeader({ shopName, userEmail, istDateString }: AppHeaderProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleSignOut = () => {
    startTransition(async () => {
      try {
        await fetch("/api/auth/signout", { method: "POST" });
        router.push("/");
        router.refresh();
      } catch {
        router.push("/");
      }
    });
  };

  return (
    <header className="sticky top-0 z-20 w-full bg-card/90 backdrop-blur-md border-b border-border/50">
      <div className="flex items-center justify-between px-4 sm:px-6 lg:px-8 py-3 max-w-md lg:max-w-[1200px] mx-auto w-full">
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <Link href="/app" className="text-lg font-extrabold tracking-tight text-primary">
              DukaanAI
            </Link>
            <span className="text-[10px] font-semibold text-primary/80 rounded-full bg-primary/10 px-2 py-0.5">
              Kirana
            </span>
            {istDateString && (
              <span className="text-[10px] text-muted-foreground hidden sm:inline ml-1 font-medium">
                • {istDateString}
              </span>
            )}
          </div>
          {shopName ? (
            <span className="text-xs font-medium text-foreground/85 truncate max-w-[200px] sm:max-w-xs">
              {shopName}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">Store Ledger</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {userEmail && (
            <span className="text-[11px] text-muted-foreground hidden xs:inline truncate max-w-[140px]">
              {userEmail.split("@")[0]}
            </span>
          )}
          <button
            type="button"
            id="btn-signout"
            onClick={handleSignOut}
            disabled={isPending}
            className="text-xs font-semibold text-muted-foreground hover:text-destructive px-2.5 py-1.5 rounded-lg border border-border/80 hover:bg-destructive/5 transition-colors min-h-[36px] flex items-center justify-center cursor-pointer disabled:opacity-50"
          >
            {isPending ? "..." : "Sign Out"}
          </button>
        </div>
      </div>
    </header>
  );
}

export function AppHeaderSkeleton() {
  return (
    <header className="sticky top-0 z-20 w-full bg-card/90 backdrop-blur-md border-b border-border/50">
      <div className="flex items-center justify-between px-4 sm:px-6 lg:px-8 py-3 max-w-md lg:max-w-[1200px] mx-auto w-full">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5">
            <span className="text-lg font-extrabold tracking-tight text-primary">
              DukaanAI
            </span>
            <span className="text-[10px] font-semibold text-primary/80 rounded-full bg-primary/10 px-2 py-0.5">
              Kirana
            </span>
          </div>
          <div className="h-3 w-28 bg-muted/40 animate-pulse rounded" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-8 w-20 bg-muted/40 animate-pulse rounded-lg" />
        </div>
      </div>
    </header>
  );
}
