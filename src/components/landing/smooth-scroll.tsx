"use client";

import { useEffect } from "react";
import Lenis from "lenis";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

export function SmoothScroll({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (typeof window === "undefined") return;

    // 1. Respect prefers-reduced-motion: if set, show everything instantly with no animations
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (prefersReducedMotion) {
      return;
    }

    // 2. Touch detection: let phones use native hardware touch scrolling
    const isTouch =
      window.matchMedia("(pointer: coarse)").matches ||
      "ontouchstart" in window ||
      navigator.maxTouchPoints > 0;

    // Register GSAP ScrollTrigger plugin
    gsap.registerPlugin(ScrollTrigger);

    let lenis: Lenis | null = null;
    let tickerCallback: ((time: number) => void) | null = null;

    // 3. Initialize Lenis only on desktop (non-touch) with lerp ~0.1
    if (!isTouch) {
      lenis = new Lenis({
        lerp: 0.1,
        duration: 1.2,
        smoothWheel: true,
      });

      // Hook ScrollTrigger to Lenis so they don't fight each other
      lenis.on("scroll", ScrollTrigger.update);

      // Hook Lenis raf to GSAP's ticker
      tickerCallback = (time: number) => {
        lenis?.raf(time * 1000);
      };
      gsap.ticker.add(tickerCallback);
      gsap.ticker.lagSmoothing(0);
    }

    // 4. Section reveals: fade and rise 24px on enter, staggered children, once only
    const sections = document.querySelectorAll("section");
    sections.forEach((sec) => {
      // Reveal section header (title, subtitle, badge)
      const header = sec.querySelector("[data-reveal-header]");
      if (header) {
        gsap.fromTo(
          header,
          { opacity: 0, y: 24 },
          {
            opacity: 1,
            y: 0,
            duration: 0.8,
            ease: "power2.out",
            scrollTrigger: {
              trigger: sec,
              start: "top 85%",
              once: true,
            },
          }
        );
      }

      // Reveal grid items (cards, metrics) with stagger
      const items = sec.querySelectorAll("[data-reveal-item]");
      if (items.length > 0) {
        gsap.fromTo(
          items,
          { opacity: 0, y: 24 },
          {
            opacity: 1,
            y: 0,
            duration: 0.8,
            stagger: 0.12,
            ease: "power2.out",
            scrollTrigger: {
              trigger: sec,
              start: "top 80%",
              once: true,
            },
          }
        );
      }
    });

    // 5. 3-Step Section scrubbed highlighting (Talk -> Confirm -> Ledger) on desktop
    const workflowSec = document.querySelector("#workflow");
    const stepCards = document.querySelectorAll<HTMLElement>(".workflow-step-card");

    if (workflowSec && stepCards.length === 3 && window.innerWidth >= 768 && !isTouch) {
      const stepTl = gsap.timeline({
        scrollTrigger: {
          trigger: workflowSec,
          start: "top 65%",
          end: "bottom 75%",
          scrub: 0.6,
        },
      });

      // Initial state: Step 0 is active (1.0), steps 1 & 2 start dimmed (0.45)
      stepTl
        .set(stepCards[0], { opacity: 1, scale: 1.02 })
        .set(stepCards[1], { opacity: 0.45, scale: 0.98 })
        .set(stepCards[2], { opacity: 0.45, scale: 0.98 })
        // Transition: Step 0 dims -> Step 1 (Confirm) highlights
        .to(stepCards[0], { opacity: 0.45, scale: 0.98, ease: "power1.inOut" }, 0.3)
        .to(stepCards[1], { opacity: 1, scale: 1.02, ease: "power1.inOut" }, 0.3)
        // Transition: Step 1 dims -> Step 2 (Ledger) highlights
        .to(stepCards[1], { opacity: 0.45, scale: 0.98, ease: "power1.inOut" }, 0.7)
        .to(stepCards[2], { opacity: 1, scale: 1.02, ease: "power1.inOut" }, 0.7);
    }

    // 6. Anchor links in header scroll smoothly with offset and remain accessible
    const handleAnchorClick = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest('a[href^="#"]');
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href || href === "#") return;

      const targetEl = document.querySelector(href);
      if (targetEl) {
        e.preventDefault();
        if (lenis) {
          lenis.scrollTo(targetEl as HTMLElement, { offset: -80, duration: 1.2 });
        } else {
          targetEl.scrollIntoView({ behavior: "smooth" });
        }
        try {
          history.pushState(null, "", href);
        } catch {
          // ignore
        }
      }
    };

    document.addEventListener("click", handleAnchorClick);

    // 7. Cleanup on unmount
    return () => {
      document.removeEventListener("click", handleAnchorClick);
      if (tickerCallback) {
        gsap.ticker.remove(tickerCallback);
      }
      if (lenis) {
        lenis.destroy();
      }
      ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
    };
  }, []);

  return <>{children}</>;
}
