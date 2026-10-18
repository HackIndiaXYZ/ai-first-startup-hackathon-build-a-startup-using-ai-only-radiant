import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Landing Page Scroll Polish (Lenis + GSAP ScrollTrigger)", () => {
  const rootDir = process.cwd();

  const smoothScrollPath = path.join(rootDir, "src/components/landing/smooth-scroll.tsx");
  const landingPagePath = path.join(rootDir, "src/app/page.tsx");
  const workflowPath = path.join(rootDir, "src/components/landing/workflow-steps.tsx");
  const problemPath = path.join(rootDir, "src/components/landing/problem-section.tsx");
  const featuresPath = path.join(rootDir, "src/components/landing/features-grid.tsx");
  const statPath = path.join(rootDir, "src/components/landing/stat-strip.tsx");
  const ctaPath = path.join(rootDir, "src/components/landing/cta-section.tsx");
  const navbarPath = path.join(rootDir, "src/components/landing/landing-navbar.tsx");

  const smoothScrollSrc = fs.readFileSync(smoothScrollPath, "utf-8");
  const landingPageSrc = fs.readFileSync(landingPagePath, "utf-8");
  const workflowSrc = fs.readFileSync(workflowPath, "utf-8");
  const problemSrc = fs.readFileSync(problemPath, "utf-8");
  const featuresSrc = fs.readFileSync(featuresPath, "utf-8");
  const statSrc = fs.readFileSync(statPath, "utf-8");
  const ctaSrc = fs.readFileSync(ctaPath, "utf-8");
  const navbarSrc = fs.readFileSync(navbarPath, "utf-8");

  describe("Requirement 1: Lenis Smooth Scrolling Configuration & Device Guards", () => {
    it("mounts SmoothScroll only on '/' (src/app/page.tsx)", () => {
      assert.ok(landingPageSrc.includes("<SmoothScroll>"));
      assert.ok(landingPageSrc.includes("</SmoothScroll>"));
    });

    it("initializes Lenis with lerp ~0.1", () => {
      assert.ok(smoothScrollSrc.includes("lerp: 0.1"));
      assert.ok(smoothScrollSrc.includes("new Lenis"));
    });

    it("destroys Lenis on unmount", () => {
      assert.ok(smoothScrollSrc.includes("lenis.destroy()"));
    });

    it("disables Lenis on touch devices to let phones use native touch scroll", () => {
      assert.ok(smoothScrollSrc.includes('pointer: coarse'));
      assert.ok(smoothScrollSrc.includes("if (!isTouch)"));
    });

    it("disables Lenis and GSAP when prefers-reduced-motion is set", () => {
      assert.ok(smoothScrollSrc.includes('prefers-reduced-motion: reduce'));
      assert.ok(smoothScrollSrc.includes("if (prefersReducedMotion)"));
    });
  });

  describe("Requirement 2: GSAP ScrollTrigger Integration & Section Reveals", () => {
    it("hooks ScrollTrigger to Lenis scroll events to prevent fighting", () => {
      assert.ok(smoothScrollSrc.includes('lenis.on("scroll", ScrollTrigger.update)'));
      assert.ok(smoothScrollSrc.includes("gsap.ticker.add"));
      assert.ok(smoothScrollSrc.includes("gsap.ticker.lagSmoothing(0)"));
    });

    it("reveals section headers by fading and rising 24px once on enter", () => {
      assert.ok(smoothScrollSrc.includes("opacity: 0, y: 24"));
      assert.ok(smoothScrollSrc.includes("opacity: 1"));
      assert.ok(smoothScrollSrc.includes("y: 0"));
      assert.ok(smoothScrollSrc.includes("once: true"));
    });

    it("staggers child reveal items", () => {
      assert.ok(smoothScrollSrc.includes("stagger: 0.12"));
    });

    it("adds reveal hooks across landing sections", () => {
      assert.ok(problemSrc.includes("data-reveal-header"));
      assert.ok(problemSrc.includes("data-reveal-item"));
      assert.ok(featuresSrc.includes("data-reveal-header"));
      assert.ok(featuresSrc.includes("data-reveal-item"));
      assert.ok(statSrc.includes("data-reveal-item"));
      assert.ok(ctaSrc.includes("data-reveal-header"));
    });
  });

  describe("Requirement 3: 3-Step Section Scrubbed Highlighting & Progressive Enhancement", () => {
    it("scrubs Talk -> Confirm -> Ledger steps on scroll", () => {
      assert.ok(smoothScrollSrc.includes(".workflow-step-card"));
      assert.ok(smoothScrollSrc.includes("scrub: 0.6"));
      assert.ok(smoothScrollSrc.includes("scale: 1.02"));
      assert.ok(smoothScrollSrc.includes("scale: 0.98"));
    });

    it("keeps 3-step section completely readable without JavaScript (progressive enhancement)", () => {
      // Default classes have full readability and standard layout
      assert.ok(workflowSrc.includes("workflow-step-card"));
      assert.ok(workflowSrc.includes("grid-cols-1 md:grid-cols-3"));
      assert.ok(!workflowSrc.includes("opacity-0")); // not hidden by default in markup
    });
  });

  describe("Requirement 4: Animation Safety (Transform and Opacity Only)", () => {
    it("animates only transform (y, scale) and opacity without layout shifts", () => {
      // Check that GSAP animations only target opacity, y, and scale
      assert.ok(!smoothScrollSrc.includes("height:"));
      assert.ok(!smoothScrollSrc.includes("width:"));
      assert.ok(!smoothScrollSrc.includes("margin:"));
      assert.ok(!smoothScrollSrc.includes("padding:"));
    });
  });

  describe("Requirement 5: Anchor Links Smooth Scroll & Keyboard Accessibility", () => {
    it("intercepts anchor clicks and smoothly scrolls with navbar offset", () => {
      assert.ok(smoothScrollSrc.includes('closest(\'a[href^="#"]\')'));
      assert.ok(smoothScrollSrc.includes("lenis.scrollTo"));
      assert.ok(smoothScrollSrc.includes("offset: -80"));
    });

    it("navbar anchors maintain semantic href and visible focus styles", () => {
      assert.ok(navbarSrc.includes('href="#problem"'));
      assert.ok(navbarSrc.includes('href="#workflow"'));
      assert.ok(navbarSrc.includes('href="#preview"'));
      assert.ok(navbarSrc.includes('href="#features"'));
      assert.ok(navbarSrc.includes("focus-visible:ring-2"));
      assert.ok(navbarSrc.includes("min-h-[48px]"));
    });
  });

  describe("Requirement 6: Strict Isolation (/app and src/lib Integrity)", () => {
    it("ensures Lenis, GSAP, and ScrollTrigger are NEVER imported into /app routes or src/lib", () => {
      const appDir = path.join(rootDir, "src/app/app");
      const libDir = path.join(rootDir, "src/lib");

      const checkDir = (dir: string) => {
        const files = fs.readdirSync(dir, { recursive: true });
        for (const f of files) {
          const fullPath = path.join(dir, f.toString());
          if (fs.statSync(fullPath).isFile() && (fullPath.endsWith(".ts") || fullPath.endsWith(".tsx"))) {
            const code = fs.readFileSync(fullPath, "utf-8");
            assert.ok(!code.includes('from "gsap"'), `GSAP must not be imported in ${fullPath}`);
            assert.ok(!code.includes('from "lenis"'), `Lenis must not be imported in ${fullPath}`);
            assert.ok(!code.includes("ScrollTrigger"), `ScrollTrigger must not be used in ${fullPath}`);
          }
        }
      };

      checkDir(appDir);
      checkDir(libDir);
    });
  });
});
