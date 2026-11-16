"use client";

import { m } from "motion/react";
import { spring } from "@/lib/motion";

/**
 * The sign-in mark: the corner bracket closes around the ball, one time, when the screen opens.
 * The cause is the arrival at the app. It ends in 500 ms and does not block the form.
 */
export function IntroMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <m.path
        d="M6 6h32v9H15v27H6z"
        fill="#f6f3ec"
        initial={{ x: -7, y: -7, opacity: 0 }}
        animate={{ x: 0, y: 0, opacity: 1 }}
        transition={{ ...spring.snappy, delay: 0.12 }}
      />
      <m.g
        style={{ originX: "31px", originY: "31px" }}
        initial={{ scale: 0.3, rotate: -120, x: 8, y: 8, opacity: 0 }}
        animate={{ scale: 1, rotate: 0, x: 0, y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 18 }}
      >
        <circle cx="31" cy="31" r="12" fill="#d45a32" />
        <circle cx="30" cy="25.5" r="1.9" fill="#f6f3ec" />
        <circle cx="35.5" cy="27.5" r="1.9" fill="#f6f3ec" />
        <circle cx="30.5" cy="31.5" r="1.9" fill="#f6f3ec" />
      </m.g>
    </svg>
  );
}

/** Content that rises into place after the mark. `order` sets the delay step. */
export function Rise({ order = 0, className, children }: { order?: number; className?: string; children: React.ReactNode }) {
  return (
    <m.div className={className} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring.layout, delay: 0.18 + order * 0.06 }}>
      {children}
    </m.div>
  );
}
