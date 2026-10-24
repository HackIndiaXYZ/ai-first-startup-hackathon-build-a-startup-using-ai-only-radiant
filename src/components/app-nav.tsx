"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function HomeIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" />
      <path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </svg>
  );
}

function BookOpenIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 7v14" />
      <path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" />
    </svg>
  );
}

function PackageIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="m7.5 4.27 9 5.15" />
      <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
      <path d="m3.3 7 8.7 5 8.7-5" />
      <path d="M12 22V12" />
    </svg>
  );
}

function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function AppNav() {
  const pathname = usePathname();

  const isHome = pathname === "/app";
  const isLedger = pathname.startsWith("/app/ledger");
  const isStock = pathname.startsWith("/app/stock");
  const isSettings = pathname.startsWith("/app/settings");

  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 z-30 flex items-center justify-around border-t border-border bg-card/95 backdrop-blur-md px-3 py-1.5 safe-bottom max-w-md mx-auto"
      aria-label="Mobile bottom navigation"
    >
      <Link
        href="/app"
        id="nav-home"
        aria-current={isHome ? "page" : undefined}
        className={`flex flex-col items-center justify-center min-w-[52px] min-h-[48px] px-2 py-1 rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
          isHome
            ? "text-primary font-semibold"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <HomeIcon className="w-5 h-5 mb-0.5" />
        <span className="text-[11px] leading-tight font-medium">Home</span>
      </Link>

      <Link
        href="/app/ledger"
        id="nav-ledger"
        aria-current={isLedger ? "page" : undefined}
        className={`flex flex-col items-center justify-center min-w-[52px] min-h-[48px] px-2 py-1 rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
          isLedger
            ? "text-primary font-semibold"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <BookOpenIcon className="w-5 h-5 mb-0.5" />
        <span className="text-[11px] leading-tight font-medium">Ledger</span>
      </Link>

      <Link
        href="/app/stock"
        id="nav-stock"
        aria-current={isStock ? "page" : undefined}
        className={`flex flex-col items-center justify-center min-w-[52px] min-h-[48px] px-2 py-1 rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
          isStock
            ? "text-primary font-semibold"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <PackageIcon className="w-5 h-5 mb-0.5" />
        <span className="text-[11px] leading-tight font-medium">Stock</span>
      </Link>

      <Link
        href="/app/settings"
        id="nav-settings"
        aria-current={isSettings ? "page" : undefined}
        className={`flex flex-col items-center justify-center min-w-[52px] min-h-[48px] px-2 py-1 rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
          isSettings
            ? "text-primary font-semibold"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <SettingsIcon className="w-5 h-5 mb-0.5" />
        <span className="text-[11px] leading-tight font-medium">Settings</span>
      </Link>
    </nav>
  );
}

export function AppSidebar() {
  const pathname = usePathname();

  const isHome = pathname === "/app";
  const isLedger = pathname.startsWith("/app/ledger");
  const isStock = pathname.startsWith("/app/stock");
  const isSettings = pathname.startsWith("/app/settings");

  return (
    <nav
      className="hidden lg:flex flex-col gap-2 w-56 shrink-0 py-6 sticky top-20"
      aria-label="Desktop sidebar navigation"
    >
      <div className="px-3 pb-2 flex flex-col">
        <span className="text-xs font-bold text-foreground uppercase tracking-wider">Shop Menu</span>
        <span className="text-[10px] font-medium text-muted-foreground">Store Navigation</span>
      </div>

      <Link
        href="/app"
        id="sidebar-home"
        aria-current={isHome ? "page" : undefined}
        className={`flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-semibold transition-all min-h-[48px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
          isHome
            ? "bg-primary/15 text-primary shadow-xs font-bold"
            : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
        }`}
      >
        <HomeIcon className="w-5 h-5 shrink-0" />
        <span className="leading-tight text-sm font-bold">Home</span>
      </Link>

      <Link
        href="/app/ledger"
        id="sidebar-ledger"
        aria-current={isLedger ? "page" : undefined}
        className={`flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-semibold transition-all min-h-[48px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
          isLedger
            ? "bg-primary/15 text-primary shadow-xs font-bold"
            : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
        }`}
      >
        <BookOpenIcon className="w-5 h-5 shrink-0" />
        <span className="leading-tight text-sm font-bold">Ledger</span>
      </Link>

      <Link
        href="/app/stock"
        id="sidebar-stock"
        aria-current={isStock ? "page" : undefined}
        className={`flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-semibold transition-all min-h-[48px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
          isStock
            ? "bg-primary/15 text-primary shadow-xs font-bold"
            : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
        }`}
      >
        <PackageIcon className="w-5 h-5 shrink-0" />
        <span className="leading-tight text-sm font-bold">Stock</span>
      </Link>

      <Link
        href="/app/settings"
        id="sidebar-settings"
        aria-current={isSettings ? "page" : undefined}
        className={`flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-semibold transition-all min-h-[48px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
          isSettings
            ? "bg-primary/15 text-primary shadow-xs font-bold"
            : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
        }`}
      >
        <SettingsIcon className="w-5 h-5 shrink-0" />
        <span className="leading-tight text-sm font-bold">Settings</span>
      </Link>
    </nav>
  );
}
