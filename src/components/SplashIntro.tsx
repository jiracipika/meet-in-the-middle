"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";

const EASE = [0.16, 1, 0.3, 1] as const;

const line = {
  hidden: { opacity: 0, y: 46, skewY: 5 },
  shown: { opacity: 1, y: 0, skewY: 0 },
};

/**
 * First-visit splash. Exits artsy — multi-axis (scale + skew + rise) with a
 * progressive hue-rotate + blur dissolve. Shown once per session; skipped for
 * shared links (URL hash) and reduced-motion users.
 */
export default function SplashIntro() {
  const [phase, setPhase] = useState<"pending" | "shown" | "hidden">("pending");

  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const reduced = window.matchMedia(
          "(prefers-reduced-motion: reduce)",
        ).matches;
        const seen = sessionStorage.getItem("mitm-intro-v1");
        const shared = window.location.hash.length > 0;
        setPhase(!reduced && !seen && !shared ? "shown" : "hidden");
      } catch {
        setPhase("hidden");
      }
    }, 0);
    return () => clearTimeout(t);
  }, []);

  function dismiss() {
    try {
      sessionStorage.setItem("mitm-intro-v1", "1");
    } catch {
      // storage blocked: intro just shows again next visit
    }
    setPhase("hidden");
  }

  return (
    <AnimatePresence>
      {phase === "shown" && (
        <motion.div
          key="splash"
          onClick={dismiss}
          aria-label="Intro — tap to continue"
          role="button"
          tabIndex={-1}
          exit={{
            opacity: 0,
            scale: 1.14,
            filter: "hue-rotate(80deg) blur(16px)",
          }}
          transition={{ duration: 0.9, ease: EASE }}
          className="fixed inset-0 z-[3000] grid cursor-pointer place-items-center overflow-hidden bg-[#05060D]"
        >
          <div aria-hidden className="mitm-splash-blob mitm-splash-blob-a" />
          <div aria-hidden className="mitm-splash-blob mitm-splash-blob-b" />
          <div
            aria-hidden
            className="mitm-grid absolute inset-0 opacity-70"
          />

          <motion.div
            exit={{ y: -70, skewY: 5, opacity: 0 }}
            transition={{ duration: 0.7, ease: EASE }}
            className="relative flex flex-col items-center px-6 text-center"
          >
            <motion.p
              variants={line}
              initial="hidden"
              animate="shown"
              transition={{ duration: 0.7, ease: EASE, delay: 0.1 }}
              className="mitm-kicker text-[11px] text-[#9AA3C7]"
            >
              six friends · one fair spot
            </motion.p>

            <motion.h1
              variants={line}
              initial="hidden"
              animate="shown"
              transition={{ duration: 0.8, ease: EASE, delay: 0.25 }}
              className="mitm-gradient-text mt-3 text-5xl font-black leading-[1.02] tracking-tight sm:text-7xl"
            >
              MEET IN THE
            </motion.h1>
            <motion.h1
              variants={line}
              initial="hidden"
              animate="shown"
              transition={{ duration: 0.8, ease: EASE, delay: 0.4 }}
              className="mitm-gradient-text text-5xl font-black leading-[1.02] tracking-tight sm:text-7xl"
            >
              MIDDLE
            </motion.h1>

            <motion.p
              variants={line}
              initial="hidden"
              animate="shown"
              transition={{ duration: 0.7, ease: EASE, delay: 0.6 }}
              className="mt-5 max-w-sm text-sm leading-relaxed text-[#9AA3C7]"
            >
              Drop up to six addresses anywhere on Earth and get the meeting
              point that&apos;s genuinely fair — weighted math, live map, zero
              arguments.
            </motion.p>

            <motion.button
              variants={line}
              initial="hidden"
              animate="shown"
              transition={{ duration: 0.7, ease: EASE, delay: 0.8 }}
              onClick={dismiss}
              className="mt-8 min-h-[44px] rounded-full bg-[#FFD166] px-7 text-sm font-extrabold text-[#0B0D17] shadow-[0_0_36px_rgba(255,209,102,0.4)] transition-transform hover:scale-[1.04] active:scale-95"
            >
              Let&apos;s find our spot
            </motion.button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
