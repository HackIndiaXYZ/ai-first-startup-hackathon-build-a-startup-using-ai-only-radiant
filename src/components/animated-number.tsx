"use client";

import { useEffect, useRef } from "react";
import { animate, useReducedMotion } from "motion/react";

interface AnimatedNumberProps {
  value: number;
  formatCurrency?: boolean;
  className?: string;
  durationMs?: number;
}

export function AnimatedNumber({
  value,
  formatCurrency = true,
  className = "",
  durationMs = 250,
}: AnimatedNumberProps) {
  const shouldReduceMotion = useReducedMotion();
  const spanRef = useRef<HTMLSpanElement>(null);
  const prevValueRef = useRef<number>(value);

  useEffect(() => {
    const node = spanRef.current;
    if (!node) return;

    if (shouldReduceMotion) {
      node.textContent = formatCurrency
        ? `₹${value.toLocaleString("en-IN")}`
        : value.toLocaleString("en-IN");
      prevValueRef.current = value;
      return;
    }

    const start = prevValueRef.current;
    const controls = animate(start, value, {
      duration: durationMs / 1000,
      ease: "easeOut",
      onUpdate(latest) {
        node.textContent = formatCurrency
          ? `₹${Math.round(latest).toLocaleString("en-IN")}`
          : Math.round(latest).toLocaleString("en-IN");
      },
      onComplete() {
        prevValueRef.current = value;
      },
    });

    return () => controls.stop();
  }, [value, shouldReduceMotion, formatCurrency, durationMs]);

  const initialText = formatCurrency
    ? `₹${value.toLocaleString("en-IN")}`
    : value.toLocaleString("en-IN");

  return (
    <span ref={spanRef} className={className}>
      {initialText}
    </span>
  );
}
