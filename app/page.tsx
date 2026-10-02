import { S } from "@/lib/strings";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md text-center space-y-6">
        <span className="text-6xl" role="img" aria-label="shop">🏪</span>
        <h1 className="text-3xl font-bold text-[var(--fg)]">{S.appName}</h1>
        <p className="text-lg text-[var(--fg)]/80">{S.tagline}</p>
        <p className="text-base text-[var(--fg)]/60">{S.sub}</p>

        <div className="space-y-4 mt-4">
          <button
            className="btn-big bg-[var(--brand)] text-white"
            disabled
            aria-disabled="true"
          >
            {S.speak}
          </button>
          <button
            className="btn-big border-2 border-[var(--brand)] text-[var(--brand)] bg-transparent"
            disabled
            aria-disabled="true"
          >
            {S.ledger}
          </button>
          <button
            className="btn-big border-2 border-[var(--brand)] text-[var(--brand)] bg-transparent"
            disabled
            aria-disabled="true"
          >
            {S.dashboard}
          </button>
        </div>

        <p className="text-sm text-green-600 dark:text-green-400 mt-6" role="status">
          ✅ {S.statusOk}
        </p>
      </div>
    </main>
  );
}
