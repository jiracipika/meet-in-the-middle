"use client";

import { useEffect, useRef } from "react";

/**
 * Decorative animated backdrop: two parallax layers of drifting hue-shifting
 * aurora blobs + a starfield, over a grid with a vignette. Layers shift
 * opposite ways as the pointer moves (multi-axis depth).
 */
export default function Background() {
  const layerA = useRef<HTMLDivElement>(null);
  const layerB = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const nx = e.clientX / window.innerWidth - 0.5;
        const ny = e.clientY / window.innerHeight - 0.5;
        if (layerA.current) {
          layerA.current.style.transform = `translate3d(${nx * 26}px, ${ny * 18}px, 0)`;
        }
        if (layerB.current) {
          layerB.current.style.transform = `translate3d(${nx * -34}px, ${ny * -22}px, 0)`;
        }
      });
    };
    window.addEventListener("pointermove", onMove);
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div aria-hidden className="mitm-bg">
      <div ref={layerA} className="absolute inset-0 will-change-transform">
        <div className="mitm-blob mitm-blob-1" />
        <div className="mitm-blob mitm-blob-3" />
        <div className="mitm-stars" />
      </div>
      <div ref={layerB} className="absolute inset-0 will-change-transform">
        <div className="mitm-blob mitm-blob-2" />
        <div className="mitm-blob mitm-blob-4" />
      </div>
      <div className="mitm-grid" />
      <div className="mitm-vignette" />
    </div>
  );
}
