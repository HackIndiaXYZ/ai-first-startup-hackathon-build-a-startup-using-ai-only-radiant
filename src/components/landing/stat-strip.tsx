"use client";

export function StatStrip() {
  const stats = [
    {
      value: "0",
      unit: "Unconfirmed entries",
      label: "0 entries saved without confirmation",
      subLabel: "You review and confirm every parsed entry",
    },
    {
      value: "48px+",
      unit: "Tap targets",
      label: "Designed for busy shop counters",
      subLabel: "Large buttons, high-contrast mobile UI",
    },
    {
      value: "4",
      unit: "Core actions",
      label: "Sales, Udhar, Stock & Customers",
      subLabel: "Handled through voice and text in Hinglish",
    },
    {
      value: "A few sec",
      unit: "Speech-to-confirm",
      label: "Usually a few seconds to parse",
      subLabel: "Fast AI parsing powered by Gemini",
    },
  ];

  return (
    <section id="stats" className="py-12 sm:py-16 relative overflow-hidden w-full">
      <div className="max-w-[1200px] w-full mx-auto px-4 sm:px-6 lg:px-8">
        <div className="rounded-3xl bg-gradient-to-r from-violet-900/30 via-indigo-900/30 to-purple-900/30 border border-white/10 p-5 sm:p-8 lg:p-10 backdrop-blur-2xl shadow-2xl shadow-black/60 flex flex-col gap-6">
          {/* Stats Grid (Single col mobile, 2 cols sm, 4 cols lg+) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6 lg:gap-8">
            {stats.map((s, i) => (
              <div
                key={i}
                data-reveal-item
                className="flex flex-col items-center text-center gap-1.5 p-4 sm:p-5 rounded-2xl bg-white/[0.02]"
              >
                <div className="flex items-baseline gap-1">
                  <span className="text-[clamp(2.25rem,4vw+0.5rem,3.75rem)] font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-white to-violet-300 tracking-tight">
                    {s.value}
                  </span>
                </div>
                <span className="text-xs font-bold text-violet-300">
                  {s.unit}
                </span>
                <span className="text-xs sm:text-sm font-semibold text-white/90">
                  {s.label}
                </span>
                <span className="text-[11px] text-white/50">
                  {s.subLabel}
                </span>
              </div>
            ))}
          </div>

          {/* Clear Illustrative Notice per Hackathon Rules */}
          <div className="pt-4 border-t border-white/10 text-center">
            <p className="text-[11px] text-white/50">
              *Illustrative estimate based on average operational kirana metrics. Product features and security guarantees are factual.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
