"use client";

import {
  useEffect,
  useLayoutEffect as useReactLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  animate,
  motion,
  useDragControls,
  useMotionValue,
  type PanInfo,
} from "motion/react";

/** useLayoutEffect on the client, useEffect during SSR (silences the warning). */
const useIsoLayoutEffect =
  typeof window !== "undefined" ? useReactLayoutEffect : useEffect;

/** Height of the visible collapsed strip (handle row). */
const PEEK = 60;

/**
 * Mobile bottom sheet (map-first layout). The whole panel toggles between a
 * peek strip and an expanded panel; the handle row is both the tap-to-toggle
 * target and the drag start point (body content stays free for scrolling).
 */
export default function BottomSheet({
  expanded,
  onToggle,
  summary,
  children,
}: {
  expanded: boolean;
  onToggle: (v: boolean) => void;
  summary: ReactNode;
  children: ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const containerHRef = useRef(0);
  const [containerH, setContainerH] = useState(0);
  const y = useMotionValue(0);
  const dragControls = useDragControls();
  const expandedRef = useRef(expanded);
  const movedRef = useRef(false);

  // Keep the snap position glued to the real container height (viewport,
  // keyboard, orientation changes) without animating on resize.
  useIsoLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const h = el.offsetHeight;
      containerHRef.current = h;
      setContainerH(h);
      y.jump(expandedRef.current ? 0 : Math.max(0, h - PEEK));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [y]);

  // Snap to the target whenever the expanded state changes.
  useEffect(() => {
    expandedRef.current = expanded;
    const h = containerHRef.current;
    if (h === 0) return;
    const target = expanded ? 0 : Math.max(0, h - PEEK);
    if (Math.abs(y.get() - target) < 0.5) return;
    const controls = animate(y, target, {
      type: "spring",
      stiffness: 380,
      damping: 36,
    });
    return () => controls.stop();
  }, [expanded, y]);

  function handleDragEnd(_e: unknown, info: PanInfo) {
    const h = containerHRef.current;
    const collapsedY = Math.max(0, h - PEEK);
    const current = y.get();
    let collapse: boolean;
    if (info.velocity.y > 500) collapse = true;
    else if (info.velocity.y < -500) collapse = false;
    else collapse = current > collapsedY / 2;
    onToggle(!collapse);
  }

  const collapsedY = Math.max(0, containerH - PEEK);

  return (
    <div
      ref={containerRef}
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[1200] h-[85dvh] lg:hidden"
    >
      <motion.div
        drag="y"
        dragListener={false}
        dragControls={dragControls}
        dragConstraints={{ top: 0, bottom: collapsedY }}
        dragElastic={{ top: 0, bottom: 0.06 }}
        dragMomentum={false}
        onDragStart={() => {
          movedRef.current = true;
        }}
        onDragEnd={handleDragEnd}
        style={{ y }}
        className="pointer-events-auto flex h-full flex-col overflow-hidden rounded-t-2xl border border-[#2A3150] bg-[#0E1120] shadow-[0_-16px_44px_#000000aa]"
      >
        <button
          type="button"
          aria-expanded={expanded}
          aria-label={expanded ? "Collapse people panel" : "Expand people panel"}
          onPointerDown={(e) => {
            movedRef.current = false;
            dragControls.start(e);
          }}
          onClick={() => {
            if (movedRef.current) {
              movedRef.current = false;
              return;
            }
            onToggle(!expanded);
          }}
          className="relative h-[60px] w-full shrink-0 touch-none select-none px-4 text-left"
        >
          <span
            aria-hidden
            className="absolute left-1/2 top-2 h-1 w-10 -translate-x-1/2 rounded-full bg-[#3A4266]"
          />
          {summary}
        </button>
        <div className="mitm-scroll flex-1 overflow-y-auto overscroll-contain px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-1">
          {children}
        </div>
      </motion.div>
    </div>
  );
}
