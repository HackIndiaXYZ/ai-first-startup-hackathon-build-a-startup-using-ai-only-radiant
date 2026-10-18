"use client";

export function PhonePreviewCard() {
  return (
    <section id="preview" className="py-20 sm:py-28 relative overflow-hidden w-full">
      {/* Background ambient radial glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[700px] h-[450px] bg-gradient-to-tr from-violet-600/15 via-indigo-600/15 to-transparent blur-[160px] pointer-events-none -z-10" />

      <div className="max-w-[1200px] w-full mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header with clamp() fluid scaling */}
        <div data-reveal-header className="flex flex-col items-center text-center gap-3 max-w-2xl mx-auto mb-14 sm:mb-16">
          <span className="text-xs font-bold tracking-wider uppercase text-amber-400 bg-amber-500/10 border border-amber-500/30 px-3.5 py-1 rounded-full">
            लाइव इंटरफ़ेस (Live Preview)
          </span>
          <h2 className="text-[clamp(1.65rem,3.2vw+0.6rem,2.75rem)] font-black text-white tracking-tight">
            स्क्रीन पर दिखता है{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 via-indigo-300 to-amber-300">
              पुष्टि कार्ड
            </span>
          </h2>
          <p className="text-[clamp(0.95rem,1vw+0.65rem,1.125rem)] text-white/70">
            DukaanAI का असली कन्फर्मेशन कार्ड — कोई छिपा हुआ नियम नहीं, आपके द्वारा पुष्टि करने के बाद ही हिसाब दर्ज होता है:
          </p>
        </div>

        {/* Phone Mockup Frame and Feature Callouts */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center max-w-5xl mx-auto">
          {/* Left Callouts (Desktop) */}
          <div className="hidden lg:flex lg:col-span-3 flex-col gap-6 text-right">
            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 backdrop-blur-md flex flex-col gap-1">
              <span className="text-xs font-bold text-amber-300">✓ ग्राहक की सही पहचान</span>
              <p className="text-xs text-white/70">
                रमेश, रमेश जी, रमेश भाई — उपनाम और इतिहास के आधार पर सही खाता खोजता है।
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 backdrop-blur-md flex flex-col gap-1">
              <span className="text-xs font-bold text-violet-300">⚡ 98% AI कॉन्फिडेंस</span>
              <p className="text-xs text-white/70">
                यदि AI को कम विश्वास हो (&lt;70%), तो वह तुरंत पीले रंग की चेतावनी दिखाता है।
              </p>
            </div>
          </div>

          {/* Central Realistic Phone Frame (Pure CSS Components, No iframe) */}
          <div data-reveal-item className="lg:col-span-6 flex justify-center">
            <div className="relative w-full max-w-[310px] sm:max-w-[360px] rounded-[44px] bg-[#0b0a17] border-[6px] border-white/20 shadow-[0_0_60px_rgba(124,58,237,0.35)] p-3 overflow-hidden select-none">
              {/* Phone Speaker / Dynamic Island */}
              <div className="flex justify-center mb-2">
                <div className="w-24 h-4 rounded-full bg-black/80 flex items-center justify-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
                  <div className="w-8 h-1.5 rounded-full bg-white/10" />
                </div>
              </div>

              {/* Status Bar */}
              <div className="flex items-center justify-between px-3 text-[10px] text-white/50 mb-2 font-mono">
                <span>9:41</span>
                <span>5G · 100%</span>
              </div>

              {/* Kirana Store Header inside phone */}
              <div className="rounded-xl bg-white/[0.04] border border-white/10 p-2.5 mb-3 flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-white">शर्मा किराना स्टोर</span>
                  <span className="text-[10px] text-white/50">GSTIN: 07AAAAA0000A1Z5</span>
                </div>
                <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  सक्रिय (Online)
                </span>
              </div>

              {/* ── Real Confirmation Card Design (Components Replica) ── */}
              <div className="rounded-2xl bg-[#141226] border border-violet-500/30 p-4 shadow-xl flex flex-col gap-3">
                {/* Header & Confidence */}
                <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-full bg-violet-600/30 flex items-center justify-center text-xs">
                      🛒
                    </span>
                    <div>
                      <h4 className="text-xs font-bold text-white">सामान बिक्री (Sale)</h4>
                      <p className="text-[10px] text-white/50">कृपया विवरण जांचें</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-violet-300 bg-violet-500/15 border border-violet-500/30 px-2 py-0.5 rounded-full">
                    98% विश्वास
                  </span>
                </div>

                {/* Customer Matching Status */}
                <div className="rounded-xl bg-white/[0.03] border border-white/10 p-2.5 flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-white">रमेश कुमार</span>
                    <span className="text-[10px] text-white/50">📞 +91 98765 43210</span>
                  </div>
                  <span className="text-[10px] font-semibold text-emerald-400">
                    ✓ सही पहचान (Matched)
                  </span>
                </div>

                {/* Financial 3-column breakdown */}
                <div className="grid grid-cols-3 gap-1.5 text-center">
                  <div className="rounded-xl bg-white/[0.04] p-2 flex flex-col">
                    <span className="text-[10px] text-white/50">कुल (Total)</span>
                    <span className="text-sm font-extrabold text-white">₹500</span>
                  </div>
                  <div className="rounded-xl bg-white/[0.04] p-2 flex flex-col">
                    <span className="text-[10px] text-emerald-400">नकद (Paid)</span>
                    <span className="text-sm font-extrabold text-emerald-400">₹200</span>
                  </div>
                  <div className="rounded-xl bg-amber-500/15 border border-amber-500/30 p-2 flex flex-col">
                    <span className="text-[10px] text-amber-300 font-semibold">उधार (Udhar)</span>
                    <span className="text-sm font-black text-amber-300">₹300</span>
                  </div>
                </div>

                {/* Hinglish Plain-Language Summary */}
                <div className="rounded-xl bg-white/[0.03] p-2 text-[11px] text-white/80 leading-snug border border-white/5">
                  <span className="font-semibold text-white">सारांश: </span>
                  रमेश: ₹500 का सामान, ₹200 नकद दिए, ₹300 उधार।
                </div>

                {/* Real Action Buttons (min-height >= 48px) */}
                <div className="flex flex-col gap-2 pt-1">
                  <button
                    type="button"
                    className="w-full min-h-[48px] rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs shadow-lg shadow-violet-900/40 flex items-center justify-center gap-1.5 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#070611]"
                  >
                    <span>✓ पुष्टि करें (Confirm)</span>
                  </button>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      className="min-h-[48px] rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-white/80 font-semibold text-[11px] border border-white/10 flex items-center justify-center cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#070611]"
                    >
                      बदलें (Edit)
                    </button>
                    <button
                      type="button"
                      className="min-h-[48px] rounded-xl bg-white/[0.02] hover:bg-rose-500/10 text-white/50 hover:text-rose-400 font-semibold text-[11px] flex items-center justify-center cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#070611]"
                    >
                      रद्द करें (Cancel)
                    </button>
                  </div>
                </div>
              </div>

              {/* Bottom Home Indicator */}
              <div className="flex justify-center mt-3">
                <div className="w-28 h-1 rounded-full bg-white/30" />
              </div>
            </div>
          </div>

          {/* Right Callouts (Desktop) */}
          <div className="hidden lg:flex lg:col-span-3 flex-col gap-6 text-left">
            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 backdrop-blur-md flex flex-col gap-1">
              <span className="text-xs font-bold text-emerald-300">🔒 ज़ीरो-सरप्राइज सेफ्टी</span>
              <p className="text-xs text-white/70">
                जब तक दुकानदार &apos;पुष्टि करें&apos; नहीं दबाता, डेटाबेस में एक भी रुपया दर्ज नहीं होता।
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 backdrop-blur-md flex flex-col gap-1">
              <span className="text-xs font-bold text-amber-300">📱 48px+ बड़े बटन</span>
              <p className="text-xs text-white/70">
                आटे या तेल लगे हाथों से भी काउंटर पर आसानी से टैप करने के लिए विशेष डिज़ाइन।
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
