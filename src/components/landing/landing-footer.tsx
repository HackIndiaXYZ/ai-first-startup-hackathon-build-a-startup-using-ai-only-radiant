"use client";

import Link from "next/link";

export function LandingFooter() {
  const GITHUB_REPO_URL =
    "https://github.com/HackIndiaXYZ/ai-first-startup-hackathon-build-a-startup-using-ai-only-radiant";

  return (
    <footer className="border-t border-white/10 bg-[#05040d] text-white/70 py-12 sm:py-16 relative overflow-hidden w-full">
      <div className="max-w-[1200px] w-full mx-auto px-4 sm:px-6 lg:px-8 flex flex-col gap-10">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
          {/* Brand Info */}
          <div className="flex flex-col gap-3">
            <Link
              href="/"
              className="flex items-center gap-2.5 min-h-[48px] rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#070611]"
            >
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-violet-600 via-indigo-600 to-amber-500 p-0.5">
                <div className="w-full h-full bg-[#0b091a] rounded-[6px] flex items-center justify-center text-sm font-black text-white">
                  द
                </div>
              </div>
              <span className="text-xl font-black tracking-tight text-white">
                Dukaan<span className="text-violet-400">AI</span>
              </span>
            </Link>
            <p className="text-xs text-white/60 max-w-sm">
              &ldquo;Talk to your shop. DukaanAI keeps the books.&rdquo;
              <br />
              भारतीय किराना स्टोर मालिकों के लिए वॉयस-फर्स्ट AI बहीखाता को-पायलट।
            </p>
          </div>

          {/* Hackathon Honor Badge */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full md:w-auto">
            <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 backdrop-blur-md flex flex-col gap-1 w-full sm:w-auto">
              <span className="text-[10px] font-bold text-amber-400 tracking-wider uppercase">
                Hackathon Submission
              </span>
              <span className="text-xs font-bold text-white">
                Built for HackIndia 2026 AI-First Startup Hackathon
              </span>
              <span className="text-[10px] text-white/50">
                AI-First Execution · Kirana Co-pilot
              </span>
            </div>

            {/* GitHub Repo Button (min-height >= 48px, focus ring) */}
            <a
              href={GITHUB_REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              id="github-repo-link"
              className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-white text-xs font-semibold border border-white/15 hover:border-white/30 transition-all min-h-[48px] min-w-[48px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#070611] w-full sm:w-auto"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                />
              </svg>
              <span>GitHub Repository</span>
              <span className="text-white/40">↗</span>
            </a>
          </div>
        </div>

        {/* Navigation Anchors & Legal */}
        <div className="pt-8 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-white/50">
          <nav className="flex flex-wrap items-center gap-2 sm:gap-4" aria-label="Footer navigation">
            <a
              href="#problem"
              className="hover:text-white transition-colors py-3 px-2.5 inline-flex items-center min-h-[48px] rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#070611]"
            >
              समस्या
            </a>
            <a
              href="#workflow"
              className="hover:text-white transition-colors py-3 px-2.5 inline-flex items-center min-h-[48px] rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#070611]"
            >
              कार्यप्रणाली
            </a>
            <a
              href="#preview"
              className="hover:text-white transition-colors py-3 px-2.5 inline-flex items-center min-h-[48px] rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#070611]"
            >
              प्रिव्यू
            </a>
            <a
              href="#features"
              className="hover:text-white transition-colors py-3 px-2.5 inline-flex items-center min-h-[48px] rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#070611]"
            >
              सुविधाएं
            </a>
            <a
              href="#stats"
              className="hover:text-white transition-colors py-3 px-2.5 inline-flex items-center min-h-[48px] rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#070611]"
            >
              आंकड़े
            </a>
          </nav>

          <p>
            © 2026 DukaanAI. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
