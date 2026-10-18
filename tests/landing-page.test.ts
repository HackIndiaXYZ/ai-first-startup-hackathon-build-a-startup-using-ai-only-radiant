import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Landing Page — Architecture, Design, Sections & Isolation", () => {
  const rootDir = path.resolve(__dirname, "..");
  const landingDir = path.join(rootDir, "src/components/landing");
  const pagePath = path.join(rootDir, "src/app/page.tsx");
  const layoutPath = path.join(rootDir, "src/app/layout.tsx");

  it("should have src/app/page.tsx importing and rendering all 7 required landing sections", () => {
    assert.ok(fs.existsSync(pagePath), "src/app/page.tsx must exist");
    const content = fs.readFileSync(pagePath, "utf-8");

    // Check all required landing component imports & usages
    const requiredComponents = [
      "LandingNavbar",
      "HeroSection",
      "ProblemSection",
      "WorkflowSteps",
      "PhonePreviewCard",
      "FeaturesGrid",
      "StatStrip",
      "CtaSection",
      "LandingFooter",
    ];

    for (const comp of requiredComponents) {
      assert.ok(
        content.includes(comp),
        `src/app/page.tsx must import and render <${comp} />`
      );
    }
  });

  it("should contain the required tagline and bilingual copy in Hero section", () => {
    const heroPath = path.join(landingDir, "hero-section.tsx");
    assert.ok(fs.existsSync(heroPath), "hero-section.tsx must exist");
    const content = fs.readFileSync(heroPath, "utf-8");

    // Required exact English tagline
    assert.ok(
      content.includes("Talk to your shop. DukaanAI keeps the books."),
      "Hero must contain tagline: 'Talk to your shop. DukaanAI keeps the books.'"
    );

    // Hindi translation
    assert.ok(
      content.includes("अपनी दुकान से बात करो। DukaanAI हिसाब रखेगा।") ||
        content.includes("दुकान"),
      "Hero must contain Hindi copy"
    );
  });

  it("should contain the 3 Kirana pain points in Problem section", () => {
    const problemPath = path.join(landingDir, "problem-section.tsx");
    assert.ok(fs.existsSync(problemPath), "problem-section.tsx must exist");
    const content = fs.readFileSync(problemPath, "utf-8");

    // 1. Paper udhar notebooks
    assert.ok(
      content.toLowerCase().includes("khata") ||
        content.toLowerCase().includes("bahi-khata") ||
        content.toLowerCase().includes("notebook"),
      "Problem section must address paper udhar notebooks"
    );

    // 2. Forgotten udhar / money
    assert.ok(
      content.toLowerCase().includes("forgotten") ||
        content.toLowerCase().includes("bhool") ||
        content.toLowerCase().includes("lost"),
      "Problem section must address forgotten udhar money"
    );

    // 3. English-only apps
    assert.ok(
      content.toLowerCase().includes("english") ||
        content.toLowerCase().includes("complex") ||
        content.toLowerCase().includes("confusing"),
      "Problem section must address English-only / complicated software"
    );
  });

  it("should present the 3 animated steps: Talk -> Confirm -> Ledger + WhatsApp reminder", () => {
    const workflowPath = path.join(landingDir, "workflow-steps.tsx");
    assert.ok(fs.existsSync(workflowPath), "workflow-steps.tsx must exist");
    const content = fs.readFileSync(workflowPath, "utf-8");

    assert.ok(
      content.includes("Talk") || content.includes("बोलो"),
      "Workflow must include Talk step"
    );
    assert.ok(
      content.includes("Confirm") || content.includes("जांचें"),
      "Workflow must include Confirm step"
    );
    assert.ok(
      content.includes("Ledger") || content.includes("WhatsApp") || content.includes("खाता"),
      "Workflow must include Ledger & WhatsApp reminder step"
    );
  });

  it("should build phone preview from real components with NO iframe", () => {
    const previewPath = path.join(landingDir, "phone-preview-card.tsx");
    assert.ok(fs.existsSync(previewPath), "phone-preview-card.tsx must exist");
    const content = fs.readFileSync(previewPath, "utf-8");

    // Must NOT contain iframe
    assert.ok(
      !content.includes("<iframe"),
      "Phone preview must be built from pure components, NOT an iframe"
    );

    // Must contain confirmation elements: total, paid, udhar, Confirm/Edit/Cancel
    assert.ok(content.includes("Confirm") || content.includes("स्वीकार करें"), "Preview must show Confirm button");
    assert.ok(content.includes("Edit") || content.includes("बदलें"), "Preview must show Edit button");
    assert.ok(content.includes("Cancel") || content.includes("रद्द करें"), "Preview must show Cancel button");
  });

  it("should clearly label stat numbers as illustrative with footnote", () => {
    const statPath = path.join(landingDir, "stat-strip.tsx");
    assert.ok(fs.existsSync(statPath), "stat-strip.tsx must exist");
    const content = fs.readFileSync(statPath, "utf-8");

    assert.ok(
      content.toLowerCase().includes("illustrative") ||
        content.includes("*") ||
        content.includes("काल्पनिक"),
      "Stat strip must clearly label metrics as illustrative"
    );
  });

  it("should include HackIndia 2026 AI-First Startup Hackathon and GitHub link in Footer", () => {
    const footerPath = path.join(landingDir, "landing-footer.tsx");
    assert.ok(fs.existsSync(footerPath), "landing-footer.tsx must exist");
    const content = fs.readFileSync(footerPath, "utf-8");

    assert.ok(
      content.includes("HackIndia 2026 AI-First Startup Hackathon"),
      "Footer must mention 'Built for HackIndia 2026 AI-First Startup Hackathon'"
    );
    assert.ok(
      content.includes("github.com"),
      "Footer must include public GitHub link"
    );
  });

  it("should handle demo auth flow with 'डेमो आज़माएँ / Try demo' and 'दुकान में जाएं / Go to Shop'", () => {
    const authBtnPath = path.join(landingDir, "demo-auth-button.tsx");
    assert.ok(fs.existsSync(authBtnPath), "demo-auth-button.tsx must exist");
    const content = fs.readFileSync(authBtnPath, "utf-8");

    // Unauthenticated copy
    assert.ok(
      content.includes("डेमो आज़माएँ") || content.includes("Try demo"),
      "Auth button must include 'डेमो आज़माएँ / Try demo'"
    );

    // Authenticated copy
    assert.ok(
      content.includes("दुकान में जाएं") || content.includes("Go to Shop"),
      "Auth button must include 'दुकान में जाएं / Go to Shop'"
    );

    // Triggers /api/auth/demo
    assert.ok(
      content.includes("/api/auth/demo"),
      "Auth button must sign in via /api/auth/demo"
    );
  });

  it("should lazy-load @splinetool/react-spline with ssr:false and check low-power hardware limits", () => {
    const heroVisualPath = path.join(landingDir, "hero-visual.tsx");
    assert.ok(fs.existsSync(heroVisualPath), "hero-visual.tsx must exist");
    const content = fs.readFileSync(heroVisualPath, "utf-8");

    // Dynamic import with ssr: false
    assert.ok(
      content.includes("ssr: false") || content.includes("ssr:false"),
      "Spline must be loaded with ssr: false"
    );

    // Low-power hardware concurrency and device memory checks
    assert.ok(
      content.includes("hardwareConcurrency"),
      "Hero visual must check navigator.hardwareConcurrency"
    );
    assert.ok(
      content.includes("deviceMemory"),
      "Hero visual must check navigator.deviceMemory"
    );
    assert.ok(
      content.includes("prefers-reduced-motion"),
      "Hero visual must check prefers-reduced-motion"
    );
  });

  it("should ensure GSAP, Lenis, and @splinetool/react-spline are NEVER imported in /app or src/lib", () => {
    const appDir = path.join(rootDir, "src/app/app");
    const libDir = path.join(rootDir, "src/lib");
    const apiDir = path.join(rootDir, "src/app/api");

    function scanFiles(dir: string): string[] {
      let results: string[] = [];
      if (!fs.existsSync(dir)) return results;
      const list = fs.readdirSync(dir);
      for (const file of list) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          results = results.concat(scanFiles(fullPath));
        } else if (file.endsWith(".ts") || file.endsWith(".tsx")) {
          results.push(fullPath);
        }
      }
      return results;
    }

    const filesToAudit = [
      ...scanFiles(appDir),
      ...scanFiles(libDir),
      ...scanFiles(apiDir),
    ];

    assert.ok(filesToAudit.length > 0, "Must have files in /app, /lib, and /api to audit");

    for (const filePath of filesToAudit) {
      const content = fs.readFileSync(filePath, "utf-8");
      assert.ok(
        !content.includes("from \"gsap\"") &&
          !content.includes("from 'gsap'") &&
          !content.includes("from \"lenis\"") &&
          !content.includes("from 'lenis'") &&
          !content.includes("@splinetool/react-spline"),
        `Forbidden landing library imported in ${path.relative(rootDir, filePath)}`
      );
    }
  });

  it("should have correct metadata, OG tags, and theme-color in src/app/layout.tsx", () => {
    const content = fs.readFileSync(layoutPath, "utf-8");

    // Check title and description
    assert.ok(content.includes("DukaanAI"), "Metadata title must include DukaanAI");
    assert.ok(
      content.includes("Talk to your shop") || content.includes("kirana"),
      "Metadata description must describe the voice-first kirana co-pilot"
    );

    // Check OpenGraph
    assert.ok(content.includes("openGraph:"), "Layout must configure openGraph metadata");
    assert.ok(content.includes("twitter:"), "Layout must configure twitter metadata");

    // Check theme-color viewport
    assert.ok(
      content.includes("#070611"),
      "Viewport themeColor must match dark midnight background #070611"
    );
  });
});
