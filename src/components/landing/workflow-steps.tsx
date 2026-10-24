"use client";

export function WorkflowSteps() {
  const steps = [
    {
      number: "01",
      badge: "Step 1: Talk",
      title: "Speak Naturally in Hinglish",
      description:
        "Simply press the mic button at the counter and speak naturally. No typing or complex form filling required.",
      exampleBox: {
        speaker: "Shopkeeper says:",
        quote: "“Ramesh ne 500 ka saaman liya, 200 abhi diye baaki udhar.”",
        tag: "🎙️ Web Speech API (en-IN)",
      },
      gradient: "from-violet-500/10 to-indigo-500/10 border-violet-500/20",
      accent: "text-violet-400 bg-violet-500/10 border-violet-500/30",
    },
    {
      number: "02",
      badge: "Step 2: Confirm",
      title: "Review AI-Parsed Breakdown",
      description:
        "AI extracts customer name, items, cash paid, and pending credit. Shows a clear confirmation card for your one-tap review.",
      exampleBox: {
        speaker: "DukaanAI Confirmation Card:",
        quote: "Ramesh Kumar · Total ₹500 · Cash ₹200 · Udhar ₹300",
        tag: "✓ Cultural Name Matching",
      },
      gradient: "from-amber-500/10 to-orange-500/10 border-amber-500/20",
      accent: "text-amber-400 bg-amber-500/10 border-amber-500/30",
    },
    {
      number: "03",
      badge: "Step 3: Ledger & WhatsApp",
      title: "Atomic Ledger & WhatsApp Reminder",
      description:
        "One tap saves the sale, adjusts stock, updates customer credit, and prepares a polite WhatsApp reminder ready to send.",
      exampleBox: {
        speaker: "WhatsApp Reminder Ready:",
        quote: "“Namaste Ramesh ji, aapka Rs 300 udhar baaki hai. Please jaldi bhej dijiye. - Sharma Kirana Store”",
        tag: "💬 1-Tap wa.me Link",
      },
      gradient: "from-emerald-500/10 to-teal-500/10 border-emerald-500/20",
      accent: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
    },
  ];

  return (
    <section id="workflow" className="py-20 sm:py-28 relative overflow-hidden w-full">
      {/* Background ambient lighting */}
      <div className="absolute top-1/2 right-1/4 -translate-y-1/2 w-full max-w-[600px] h-[350px] bg-violet-600/15 blur-[150px] pointer-events-none -z-10" />

      <div className="max-w-[1200px] w-full mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header with clamp() fluid scaling */}
        <div data-reveal-header className="flex flex-col items-center text-center gap-3 max-w-2xl mx-auto mb-14 sm:mb-16">
          <span className="text-xs font-bold tracking-wider uppercase text-violet-400 bg-violet-500/10 border border-violet-500/30 px-3.5 py-1 rounded-full">
            How It Works
          </span>
          <h2 className="text-[clamp(1.65rem,3.2vw+0.6rem,2.75rem)] font-black text-white tracking-tight">
            From Spoken Words to Ledger —{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 via-indigo-300 to-amber-300">
              Just 3 Simple Steps
            </span>
          </h2>
          <p className="text-[clamp(0.95rem,1vw+0.65rem,1.125rem)] text-white/70">
            DukaanAI turns everyday speech into ledger entries, stock updates, and polite payment reminders:
          </p>
        </div>

        {/* 3 Step Flow Grid (Single col mobile, 3 cols md+) */}
        <div className="workflow-steps-container grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 relative">
          {steps.map((step, idx) => (
            <div
              key={idx}
              data-step-index={idx}
              className={`workflow-step-card rounded-3xl bg-gradient-to-b ${step.gradient} border p-5 sm:p-7 lg:p-8 backdrop-blur-xl flex flex-col justify-between gap-6 hover:border-white/30 transition-all duration-300 shadow-xl shadow-black/50 group`}
            >
              <div className="flex flex-col gap-4">
                {/* Step Number & Badge */}
                <div className="flex items-center justify-between">
                  <span className="text-4xl sm:text-5xl font-black text-white/20 group-hover:text-white/40 transition-colors">
                    {step.number}
                  </span>
                  <span className={`text-[11px] font-bold px-3 py-1 rounded-full border ${step.accent}`}>
                    {step.badge}
                  </span>
                </div>

                {/* Step Title */}
                <div className="flex flex-col gap-0.5">
                  <h3 className="text-xl sm:text-2xl font-bold text-white">
                    {step.title}
                  </h3>
                </div>

                <p className="text-sm text-white/70 leading-relaxed">
                  {step.description}
                </p>
              </div>

              {/* Realistic Example Box */}
              <div className="rounded-2xl bg-black/40 border border-white/10 p-4 flex flex-col gap-2">
                <div className="flex items-center justify-between text-[11px] text-white/50">
                  <span>{step.exampleBox.speaker}</span>
                  <span className="text-amber-400 font-semibold">{step.exampleBox.tag}</span>
                </div>
                <p className="text-xs sm:text-sm font-semibold text-white/90 italic break-words">
                  {step.exampleBox.quote}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
