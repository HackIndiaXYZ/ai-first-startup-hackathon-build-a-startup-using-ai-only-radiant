import { SmoothScroll } from "@/components/landing/smooth-scroll";
import { LandingNavbar } from "@/components/landing/landing-navbar";
import { HeroSection } from "@/components/landing/hero-section";
import { ProblemSection } from "@/components/landing/problem-section";
import { WorkflowSteps } from "@/components/landing/workflow-steps";
import { PhonePreviewCard } from "@/components/landing/phone-preview-card";
import { FeaturesGrid } from "@/components/landing/features-grid";
import { StatStrip } from "@/components/landing/stat-strip";
import { CtaSection } from "@/components/landing/cta-section";
import { LandingFooter } from "@/components/landing/landing-footer";

export default function LandingPage() {
  return (
    <SmoothScroll>
      <div className="min-h-screen w-full min-w-0 bg-[#070611] text-white selection:bg-violet-500/30 selection:text-white font-sans overflow-x-clip overflow-x-hidden relative flex flex-col">
        {/* Top Sticky Glass Navigation */}
        <LandingNavbar />

        {/* Main Content Sections */}
        <main className="flex-1 flex flex-col">
          {/* Section 1: Hero */}
          <HeroSection />

          {/* Section 2: The Problem */}
          <ProblemSection />

          {/* Section 3: How It Works in 3 Animated Steps */}
          <WorkflowSteps />

          {/* Section 4: Static Phone Frame Preview */}
          <PhonePreviewCard />

          {/* Section 5: Features Grid */}
          <FeaturesGrid />

          {/* Section 6: Stat Strip with Illustrative Footnote */}
          <StatStrip />

          {/* Section 7: Final CTA */}
          <CtaSection />
        </main>

        {/* Footer with GitHub Link & Hackathon Badge */}
        <LandingFooter />
      </div>
    </SmoothScroll>
  );
}
