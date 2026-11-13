"use client";

import { useEffect } from "react";
import { motion, useSpring, useTransform } from "motion/react";

/** Spring-animated numeric readout. */
export default function AnimatedNumber({
  value,
  format,
}: {
  value: number;
  format?: (n: number) => string;
}) {
  const spring = useSpring(value, { stiffness: 120, damping: 22 });
  useEffect(() => {
    spring.set(value);
  }, [value, spring]);
  const text = useTransform(spring, (v) =>
    format ? format(v) : String(Math.round(v)),
  );
  return <motion.span>{text}</motion.span>;
}
