"use client";

export function FeaturesGrid() {
  const features = [
    {
      icon: "🎙️",
      title: "Hinglish Voice & Typed Entry",
      description:
        "Speak at the counter or type quickly. Understands Hindi, Hinglish, and everyday colloquial kirana speech.",
      badge: "Web Speech API",
    },
    {
      icon: "👥",
      title: "Cultural Name Matching",
      description:
        "Ramesh, Ramesh ji, Ramesh bhai — understands surnames and honorifics to link to the right ledger account without duplicates.",
      badge: "Fuzzy Logic",
    },
    {
      icon: "📊",
      title: "Real-Time Udhar Tracking",
      description:
        "Today's sales, total pending credit, and top debtors list at a glance. Always know who owes what.",
      badge: "Live Balance View",
    },
    {
      icon: "💬",
      title: "Instant WhatsApp Reminders",
      description:
        "Send polite Hinglish payment reminders without awkwardness. Opens pre-composed WhatsApp wa.me links in one tap.",
      badge: "1-Tap wa.me",
    },
    {
      icon: "📦",
      title: "Low-Stock Reorder Triggers",
      description:
        "Proactive alerts whenever inventory drops below reorder thresholds so your shop never runs out of essentials.",
      badge: "Stock Protection",
    },
    {
      icon: "🛡️",
      title: "Private Store Data (RLS)",
      description:
        "Each shop's data is private to its owner through Postgres Row-Level Security. Entries save only after your confirmation.",
      badge: "Atomic RPC",
    },
  ];

  return (
    <section id="features" className="py-20 sm:py-28 relative overflow-hidden w-full">
      {/* Background ambient radial glow */}
      <div className="absolute top-1/2 left-1/3 -translate-y-1/2 w-full max-w-[600px] h-[350px] bg-indigo-600/10 blur-[150px] pointer-events-none -z-10" />

      <div className="max-w-[1200px] w-full mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header with clamp() fluid scaling */}
        <div data-reveal-header className="flex flex-col items-center text-center gap-3 max-w-2xl mx-auto mb-14 sm:mb-16">
          <span className="text-xs font-bold tracking-wider uppercase text-amber-400 bg-amber-500/10 border border-amber-500/30 px-3.5 py-1 rounded-full">
            Key Features
          </span>
          <h2 className="text-[clamp(1.65rem,3.2vw+0.6rem,2.75rem)] font-black text-white tracking-tight">
            Built specifically for{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 via-indigo-300 to-amber-300">
              Indian Kirana Stores
            </span>
          </h2>
          <p className="text-[clamp(0.95rem,1vw+0.65rem,1.125rem)] text-white/70">
            DukaanAI eliminates pen-and-paper friction while keeping you in complete control of every transaction:
          </p>
        </div>

        {/* 6 Features Grid (Single col mobile, 2 cols md, 3 cols lg+) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {features.map((feature, i) => (
            <div
              key={i}
              data-reveal-item
              className="rounded-3xl bg-white/[0.03] border border-white/10 p-5 sm:p-7 backdrop-blur-xl hover:border-violet-500/40 hover:bg-white/[0.05] transition-all duration-300 flex flex-col justify-between gap-5 group"
            >
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-3xl p-2.5 rounded-2xl bg-white/[0.05] border border-white/10 group-hover:scale-110 transition-transform">
                    {feature.icon}
                  </span>
                  <span className="text-[10px] font-bold text-violet-300 bg-violet-500/10 border border-violet-500/30 px-2.5 py-0.5 rounded-full">
                    {feature.badge}
                  </span>
                </div>

                <div className="flex flex-col gap-0.5">
                  <h3 className="text-lg sm:text-xl font-bold text-white group-hover:text-violet-200 transition-colors">
                    {feature.title}
                  </h3>
                </div>

                <p className="text-xs sm:text-sm text-white/70 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
