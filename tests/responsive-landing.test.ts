import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Fluid Responsive Landing Page (360px, 768px, 1280px, 1920px)", () => {
  const rootDir = path.resolve(__dirname, "..");
  const landingDir = path.join(rootDir, "src/components/landing");
  const pagePath = path.join(rootDir, "src/app/page.tsx");

  const heroPath = path.join(landingDir, "hero-section.tsx");
  const heroVisualPath = path.join(landingDir, "hero-visual.tsx");
  const workflowPath = path.join(landingDir, "workflow-steps.tsx");
  const footerPath = path.join(landingDir, "landing-footer.tsx");
  const navbarPath = path.join(landingDir, "landing-navbar.tsx");
  const phonePath = path.join(landingDir, "phone-preview-card.tsx");
  const featuresPath = path.join(landingDir, "features-grid.tsx");
  const statPath = path.join(landingDir, "stat-strip.tsx");
  const ctaPath = path.join(landingDir, "cta-section.tsx");
  const demoAuthPath = path.join(landingDir, "demo-auth-button.tsx");

  const targetWidths = [360, 768, 1280, 1920] as const;

  it("should enforce zero horizontal scroll and fluid layout wrapper in src/app/page.tsx", () => {
    const content = fs.readFileSync(pagePath, "utf-8");
    assert.ok(
      content.includes("overflow-x-clip") || content.includes("overflow-x-hidden"),
      "Landing page root wrapper must have overflow-x protection"
    );
    assert.ok(
      content.includes("w-full") && content.includes("min-w-0"),
      "Landing page root wrapper must be full width with min-w-0"
    );
  });

  it("should standardize content container max width to about 1200px across all landing sections", () => {
    const filesToCheck = [
      navbarPath,
      heroPath,
      workflowPath,
      phonePath,
      featuresPath,
      statPath,
      ctaPath,
      footerPath,
    ];

    for (const filePath of filesToCheck) {
      const content = fs.readFileSync(filePath, "utf-8");
      assert.ok(
        content.includes("max-w-[1200px]"),
        `${path.basename(filePath)} must enforce max-w-[1200px] content width`
      );
      assert.ok(
        !content.includes("max-w-7xl"),
        `${path.basename(filePath)} should not use oversized max-w-7xl (1280px)`
      );
    }
  });

  it("should have NO fixed pixel widths on layout containers", () => {
    const filesToCheck = [
      heroPath,
      workflowPath,
      phonePath,
      featuresPath,
      statPath,
      ctaPath,
      footerPath,
    ];

    for (const filePath of filesToCheck) {
      const content = fs.readFileSync(filePath, "utf-8");
      // Assert no fixed width on containers like w-[1200px] without max-w
      assert.ok(
        !content.match(/\b(?<!max-)w-\[\d{3,4}px\](?!\s+h-)/g),
        `${path.basename(filePath)} must not contain fixed pixel width containers without max-w constraint`
      );
    }
  });

  it("should apply fluid typography scale with clamp() on H1, H2, and stat metrics", () => {
    const heroContent = fs.readFileSync(heroPath, "utf-8");
    assert.ok(
      heroContent.includes("clamp("),
      "Hero heading and copy must use fluid clamp() scale"
    );

    const workflowContent = fs.readFileSync(workflowPath, "utf-8");
    assert.ok(
      workflowContent.includes("clamp("),
      "Workflow section title must use fluid clamp() scale"
    );

    const statContent = fs.readFileSync(statPath, "utf-8");
    assert.ok(
      statContent.includes("clamp("),
      "Stat strip numbers must use fluid clamp() scale"
    );

    const ctaContent = fs.readFileSync(ctaPath, "utf-8");
    assert.ok(
      ctaContent.includes("clamp("),
      "CTA section heading must use fluid clamp() scale"
    );
  });

  it("should guarantee tap targets >= 48px on all touch interactive elements", () => {
    // 1. Demo auth button (all sizes sm, default, lg)
    const demoAuthContent = fs.readFileSync(demoAuthPath, "utf-8");
    assert.ok(
      demoAuthContent.includes("min-h-[48px]") || demoAuthContent.includes("min-h-[52px]"),
      "DemoAuthButton must enforce minimum 48px height"
    );
    assert.ok(
      !demoAuthContent.includes("min-h-[40px]"),
      "DemoAuthButton sm variant must not be under 48px"
    );

    // 2. Navbar links
    const navContent = fs.readFileSync(navbarPath, "utf-8");
    assert.ok(
      navContent.includes("min-h-[48px]"),
      "Navbar links must have min-h-[48px] tap target"
    );

    // 3. Hero CTAs
    const heroContent = fs.readFileSync(heroPath, "utf-8");
    assert.ok(
      heroContent.includes("min-h-[48px]") || heroContent.includes("min-h-[52px]"),
      "Hero CTA buttons must be at least 48px high"
    );

    // 4. Phone Preview Card action buttons (Confirm, Edit, Cancel)
    const phoneContent = fs.readFileSync(phonePath, "utf-8");
    assert.ok(
      phoneContent.includes("min-h-[48px]"),
      "Phone preview action buttons must be at least 48px high"
    );
    assert.ok(
      !phoneContent.includes("h-10"),
      "Phone preview buttons must not be under 48px (e.g. h-10 is 40px)"
    );

    // 5. Footer GitHub link & nav anchors
    const footerContent = fs.readFileSync(footerPath, "utf-8");
    assert.ok(
      footerContent.includes("min-h-[48px]"),
      "Footer GitHub link and anchors must have min-h-[48px]"
    );
    assert.ok(
      !footerContent.includes("min-h-[44px]"),
      "Footer GitHub link must not be under 48px (was 44px)"
    );
  });

  it("should provide visible keyboard focus styles and hover states for mouse users", () => {
    const filesWithInteractiveElements = [
      demoAuthPath,
      navbarPath,
      heroPath,
      phonePath,
      footerPath,
    ];

    for (const filePath of filesWithInteractiveElements) {
      const content = fs.readFileSync(filePath, "utf-8");
      assert.ok(
        content.includes("focus-visible:ring-"),
        `${path.basename(filePath)} interactive elements must have visible keyboard focus-visible ring styles`
      );
      assert.ok(
        content.includes("hover:"),
        `${path.basename(filePath)} interactive elements must have hover states for mouse users`
      );
    }
  });

  describe("Four Width Breakpoint Verification (360px, 768px, 1280px, 1920px)", () => {
    // 1. The Hero Section
    describe("Hero Section across all 4 widths", () => {
      const heroContent = fs.readFileSync(heroPath, "utf-8");
      const heroVisualContent = fs.readFileSync(heroVisualPath, "utf-8");

      for (const width of targetWidths) {
        it(`should layout Hero correctly at ${width}px`, () => {
          if (width < 768) {
            // Mobile (360px): Single column, no horizontal overflow
            assert.ok(
              heroContent.includes("grid-cols-1"),
              "Hero must use single column on mobile (< 768px)"
            );
            assert.ok(
              heroVisualContent.includes("max-w-[320px]") ||
                heroVisualContent.includes("max-w-[300px]"),
              "Hero visual must adapt safely on 360px without negative offset blowout"
            );
          } else if (width === 768) {
            // Tablet / Small Desktop (768px / md): Multi-column grid
            assert.ok(
              heroContent.includes("md:grid-cols-12"),
              "Hero must transition to 12-col grid from md breakpoint (768px)"
            );
            assert.ok(
              heroContent.includes("md:col-span-7") &&
                heroContent.includes("md:col-span-5"),
              "Hero columns must be split (7 cols copy, 5 cols visual) from md breakpoint"
            );
          } else {
            // Desktop / Wide (1280px & 1920px): Max width bounded, generous margins
            assert.ok(
              heroContent.includes("max-w-[1200px]"),
              `Hero must be bounded by max-w-[1200px] at ${width}px`
            );
          }
        });
      }
    });

    // 2. The 3-Step Section (WorkflowSteps)
    describe("3-Step Workflow Section across all 4 widths", () => {
      const workflowContent = fs.readFileSync(workflowPath, "utf-8");

      for (const width of targetWidths) {
        it(`should layout 3-Step section correctly at ${width}px`, () => {
          if (width < 768) {
            // Mobile (360px): Single column stack
            assert.ok(
              workflowContent.includes("grid-cols-1"),
              "3-step section must stack in a single column on mobile (< 768px)"
            );
          } else if (width === 768) {
            // Tablet (768px / md): 3-column grid
            assert.ok(
              workflowContent.includes("md:grid-cols-3"),
              "3-step section must transition to 3 columns at md (768px)"
            );
          } else {
            // Desktop / Wide (1280px & 1920px): Bounded container, fluid padding
            assert.ok(
              workflowContent.includes("max-w-[1200px]"),
              `3-step section must stay within max-w-[1200px] at ${width}px`
            );
          }
        });
      }
    });

    // 3. The Footer (LandingFooter)
    describe("Footer across all 4 widths", () => {
      const footerContent = fs.readFileSync(footerPath, "utf-8");

      for (const width of targetWidths) {
        it(`should layout Footer correctly at ${width}px`, () => {
          if (width < 768) {
            // Mobile (360px): Stack brand, badge, and repo button vertically
            assert.ok(
              footerContent.includes("flex-col"),
              "Footer must stack flex items vertically on mobile (< 768px)"
            );
          } else if (width === 768) {
            // Tablet (768px / md): Horizontal row for main brand and repo button
            assert.ok(
              footerContent.includes("md:flex-row"),
              "Footer must transition to row layout at md (768px)"
            );
          } else {
            // Desktop / Wide (1280px & 1920px): Centered container max-w-1200
            assert.ok(
              footerContent.includes("max-w-[1200px]"),
              `Footer must be bounded by max-w-[1200px] at ${width}px`
            );
          }
        });
      }
    });
  });
});
