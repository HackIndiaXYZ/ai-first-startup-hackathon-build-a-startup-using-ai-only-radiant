"use client";

export function WorkflowSteps() {
  const steps = [
    {
      number: "01",
      badge: "कदम 1: सिर्फ बोलिए (Talk)",
      title: "अपनी देसी भाषा में बोलें",
      englishTitle: "Speak Naturally in Hinglish",
      description:
        "काउंटर पर खड़े होकर बस माइक दबाएं और सामान्य बोलचाल में बोलें। कोई टाइपिंग या फॉर्म भरने की जरूरत नहीं।",
      exampleBox: {
        speaker: "दुकानदार बोला:",
        quote: "“रमेश ने 500 का सामान लिया, 200 नकद दिए बाकी उधार।”",
        tag: "🎙️ Web Speech API (hi-IN)",
      },
      gradient: "from-violet-500/10 to-indigo-500/10 border-violet-500/20",
      accent: "text-violet-400 bg-violet-500/10 border-violet-500/30",
    },
    {
      number: "02",
      badge: "कदम 2: जांचें और पुष्टि करें (Confirm)",
      title: "AI समझदारी से हिसाब बनाएगा",
      englishTitle: "Review AI-Parsed Breakdown",
      description:
        "AI ग्राहक का नाम, सामान और उधारी अलग करेगा। 98% विश्वास स्कोर के साथ स्क्रीन पर साफ़ कार्ड दिखेगा।",
      exampleBox: {
        speaker: "DukaanAI पुष्टि कार्ड:",
        quote: "रमेश कुमार · कुल ₹500 · नकद ₹200 · उधार ₹300",
        tag: "✓ सही ग्राहक पहचान (Fuzzy Match)",
      },
      gradient: "from-amber-500/10 to-orange-500/10 border-amber-500/20",
      accent: "text-amber-400 bg-amber-500/10 border-amber-500/30",
    },
    {
      number: "03",
      badge: "कदम 3: खाता और व्हाट्सएप (Ledger & WhatsApp)",
      title: "खाते में दर्ज और 1-क्लिक तगादा",
      englishTitle: "Atomic Ledger & WhatsApp Link",
      description:
        "पुष्टि करते ही बहीखाते में दर्ज, स्टॉक अपडेट, और ग्राहक को व्हाट्सएप पर सभ्य हिंदी संदेश भेजने का सीधा लिंक।",
      exampleBox: {
        speaker: "व्हाट्सएप संदेश तैयार:",
        quote: "“नमस्ते रमेश जी! आपकी शर्मा किराना पर ₹300 की उधारी है...”",
        tag: "💬 1-Tap wa.me लिंक",
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
            सरल 3 चरण (How It Works)
          </span>
          <h2 className="text-[clamp(1.65rem,3.2vw+0.6rem,2.75rem)] font-black text-white tracking-tight">
            बोलने से बहीखाते तक —{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 via-indigo-300 to-amber-300">
              सिर्फ 3 कदम
            </span>
          </h2>
          <p className="text-[clamp(0.95rem,1vw+0.65rem,1.125rem)] text-white/70">
            DukaanAI आपके कहे शब्दों को तुरंत हिसाब, स्टॉक और भुगतान रिमाइंडर में बदल देता है:
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
                  <span className="text-xs text-white/50 font-medium">
                    {step.englishTitle}
                  </span>
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
