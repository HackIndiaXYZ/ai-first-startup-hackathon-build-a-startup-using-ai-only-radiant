"use client";

export function StatStrip() {
  const stats = [
    {
      value: "₹18,500+*",
      unit: "प्रति माह",
      label: "औसत फंसा उधार वसूली",
      englishLabel: "Avg. faster credit recovery/mo",
    },
    {
      value: "3x तेज़*",
      unit: "समय की बचत",
      label: "कागज़ी डायरी से हिसाब लिखना",
      englishLabel: "Faster than pen & paper notebook",
    },
    {
      value: "100%*",
      unit: "देसी भाषा",
      label: "हिंग्लिश व हिंदी बोलचाल अनुकूल",
      englishLabel: "Tailored for Indian Kirana slang",
    },
    {
      value: "<2 सेकंड*",
      unit: "बिजली सा तेज़",
      label: "बोलने से पुष्टि कार्ड तैयार",
      englishLabel: "Instant speech-to-confirm",
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
                  {s.englishLabel}
                </span>
              </div>
            ))}
          </div>

          {/* Clear Illustrative Notice per Hackathon Rules */}
          <div className="pt-4 border-t border-white/10 text-center">
            <p className="text-[11px] text-white/50">
              *अनुमानित एवं प्रतीकात्मक आंकड़े (Illustrative projections based on average operational metrics for independent Indian retail kirana stores).
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
