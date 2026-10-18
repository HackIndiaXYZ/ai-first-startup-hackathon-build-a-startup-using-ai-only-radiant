"use client";

export function FeaturesGrid() {
  const features = [
    {
      icon: "🎙️",
      title: "वॉयस और टाइपिंग दोनों",
      englishTitle: "Hinglish Voice & Typed Entry",
      description:
        "काउंटर पर बोलें या टाइप करें। हिंदी, हिंग्लिश और देसी बोलचाल को आसानी से समझता है।",
      badge: "Web Speech API",
    },
    {
      icon: "👥",
      title: "स्मार्ट ग्राहक पहचान",
      englishTitle: "Cultural Name Matching",
      description:
        "रमेश, रमेश जी, रमेश भाई — उपनाम और आदरसूचक समझकर सही खाते से जोड़ता है। कभी डुप्लिकेट नहीं बनाता।",
      badge: "Fuzzy Logic",
    },
    {
      icon: "📊",
      title: "लाइव उधारी डैशबोर्ड",
      englishTitle: "Real-Time Udhar Tracking",
      description:
        "आज की बिक्री, कुल बकाया और शीर्ष बकायेदारों की तुरंत सूची। एक नज़र में दुकान की वित्तीय स्थिति समझें।",
      badge: "Live Balance View",
    },
    {
      icon: "💬",
      title: "1-क्लिक व्हाट्सएप तगादा",
      englishTitle: "Instant WhatsApp Reminders",
      description:
        "बिना किसी संकोच के शिष्ट हिंदी में भुगतान याद दिलाएं। wa.me लिंक से तुरंत तैयार मैसेज खुलता है।",
      badge: "1-Tap wa.me",
    },
    {
      icon: "📦",
      title: "कम स्टॉक चेतावनी",
      englishTitle: "Low-Stock Reorder Triggers",
      description:
        "दुकान में कौन सा सामान खत्म होने वाला है, इसकी पहले ही सतर्कता। कभी ग्राहक खाली हाथ नहीं लौटेगा।",
      badge: "Stock Protection",
    },
    {
      icon: "🛡️",
      title: "ज़ीरो-सरप्राइज डेटा सुरक्षा",
      englishTitle: "Atomic Single-Tx Safety",
      description:
        "आपके पुष्टि बटन दबाने के बाद ही बहीखाते और स्टॉक में एक साथ सुरक्षित एंट्री होती है।",
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
            खास सुविधाएं (Key Features)
          </span>
          <h2 className="text-[clamp(1.65rem,3.2vw+0.6rem,2.75rem)] font-black text-white tracking-tight">
            किराना स्टोर के लिए{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 via-indigo-300 to-amber-300">
              सबसे ताकतवर टूल्स
            </span>
          </h2>
          <p className="text-[clamp(0.95rem,1vw+0.65rem,1.125rem)] text-white/70">
            DukaanAI को विशेष रूप से भारतीय खुदरा दुकानदारों की रोज़मर्रा की चुनौतियों को हल करने के लिए बनाया गया है:
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
                  <span className="text-xs text-white/50 font-medium">
                    {feature.englishTitle}
                  </span>
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
