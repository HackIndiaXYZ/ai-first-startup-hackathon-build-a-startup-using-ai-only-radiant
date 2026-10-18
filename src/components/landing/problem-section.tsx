"use client";

export function ProblemSection() {
  const problems = [
    {
      badge: "समस्या 01",
      icon: "📓",
      title: "कागज़ की डायरी और खोया हिसाब",
      subtitle: "Lost & Damaged Notebooks",
      description:
        "चाय के दाग, फटे हुए पन्ने या डायरी का खो जाना — सालों की मेहनत और ग्राहकों का उधारी हिसाब एक झटके में गायब हो जाता है।",
      impact: "कागज़ खोने से औसतन 10% उधारी कभी वापस नहीं मिलती",
      color: "from-rose-500/10 to-orange-500/10 border-rose-500/20",
    },
    {
      badge: "समस्या 02",
      icon: "💸",
      title: "भूला हुआ फंसा उधार",
      subtitle: "Forgotten Money & Delayed Dues",
      description:
        "व्यस्त काउंटर पर लिखना भूल गए, या ग्राहक को समय पर याद दिलाना संकोच का काम लगा। बिना तगादे के उधारी हफ्तों महीनों अटकी रहती है।",
      impact: "किराना दुकान का ₹20,000–₹50,000 हर महीने अटका रहता है",
      color: "from-amber-500/10 to-yellow-500/10 border-amber-500/20",
    },
    {
      badge: "समस्या 03",
      icon: "📱",
      title: "कठिन अंग्रेज़ी अकाउंटिंग ऐप्स",
      subtitle: "Complex English Software",
      description:
        "मुनीमों के लिए बने भारी-भरकम ऐप्स जिनमें 10 मेनू और अंग्रेज़ी फॉर्म्स होते हैं। काउंटर पर खड़े ग्राहक को छोड़कर कोई फॉर्म नहीं भर सकता।",
      impact: "90% दुकानदार जटिल ऐप्स डाउनलोड करके छोड़ देते हैं",
      color: "from-violet-500/10 to-indigo-500/10 border-violet-500/20",
    },
  ];

  return (
    <section id="problem" className="py-20 sm:py-28 relative overflow-hidden w-full">
      {/* Ambient background glow */}
      <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-full max-w-[500px] h-[300px] bg-indigo-600/10 blur-[130px] pointer-events-none -z-10" />

      <div className="max-w-[1200px] w-full mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header with clamp() fluid scaling */}
        <div data-reveal-header className="flex flex-col items-center text-center gap-3 max-w-2xl mx-auto mb-14 sm:mb-16">
          <span className="text-xs font-bold tracking-wider uppercase text-amber-400 bg-amber-500/10 border border-amber-500/30 px-3.5 py-1 rounded-full">
            दुकानदारों की असली सच्चाई (The Problem)
          </span>
          <h2 className="text-[clamp(1.65rem,3.2vw+0.6rem,2.75rem)] font-black text-white tracking-tight">
            कागज़ी बहीखाते की{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-rose-400 via-amber-300 to-rose-400">
              3 बड़ी मुश्किलें
            </span>
          </h2>
          <p className="text-[clamp(0.95rem,1vw+0.65rem,1.125rem)] text-white/70">
            लाखों किराना स्टोर आज भी पुरानी डायरियों पर निर्भर हैं। जानिए क्यों यह आपकी दुकान के मुनाफे को धीमा कर रहा है:
          </p>
        </div>

        {/* 3 Problem Cards (Single col mobile, 3 cols md+) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
          {problems.map((p, i) => (
            <div
              key={i}
              data-reveal-item
              className={`rounded-3xl bg-gradient-to-b ${p.color} border p-5 sm:p-7 lg:p-8 backdrop-blur-xl flex flex-col justify-between gap-6 hover:translate-y-[-4px] transition-transform duration-300 shadow-xl shadow-black/40`}
            >
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <span className="text-3xl sm:text-4xl p-2.5 rounded-2xl bg-white/[0.06] border border-white/10">
                    {p.icon}
                  </span>
                  <span className="text-[11px] font-bold text-white/50 tracking-wider uppercase px-2.5 py-1 rounded-full bg-white/[0.04]">
                    {p.badge}
                  </span>
                </div>

                <div className="flex flex-col gap-1">
                  <h3 className="text-xl sm:text-2xl font-bold text-white">
                    {p.title}
                  </h3>
                  <span className="text-xs font-medium text-amber-300/80">
                    {p.subtitle}
                  </span>
                </div>

                <p className="text-sm text-white/70 leading-relaxed">
                  {p.description}
                </p>
              </div>

              <div className="pt-4 border-t border-white/10 flex items-start gap-2 text-xs font-semibold text-rose-300/90">
                <span className="text-rose-400 font-bold">⚠️</span>
                <span>{p.impact}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom Banner */}
        <div className="mt-12 rounded-2xl bg-white/[0.03] border border-white/10 p-5 sm:p-6 backdrop-blur-md text-center flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-left">
            <span className="text-2xl">💡</span>
            <div>
              <p className="text-sm sm:text-base font-bold text-white">
                समाधान: ना टाइपिंग, ना कोई जटिल फॉर्म।
              </p>
              <p className="text-xs text-white/60">
                DukaanAI आपकी देसी बोलचाल समझता है और 2 सेकंड में बहीखाता अपडेट करता है।
              </p>
            </div>
          </div>
          <a
            href="#workflow"
            className="text-xs font-bold text-violet-300 hover:text-white bg-violet-600/20 hover:bg-violet-600/30 px-4 py-2.5 rounded-xl border border-violet-500/30 transition-colors whitespace-nowrap min-h-[40px] flex items-center"
          >
            काम करने का तरीका देखें →
          </a>
        </div>
      </div>
    </section>
  );
}
