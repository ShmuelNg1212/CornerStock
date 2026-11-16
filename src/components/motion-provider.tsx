"use client";

import { LazyMotion, MotionConfig } from "motion/react";

const features = () => import("@/lib/motion-features").then((module) => module.default);

/** Gives motion to the app. With the reduced-motion setting, transforms do not move. */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return (
    <LazyMotion features={features} strict>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
}
