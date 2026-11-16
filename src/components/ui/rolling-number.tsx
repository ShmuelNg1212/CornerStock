"use client";

import { m } from "motion/react";
import { spring } from "@/lib/motion";
import { cn } from "@/lib/utils";

const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

/**
 * A number whose digits roll to a new value, like a counter on a lane.
 * The cause is a change of the value. The first view does not move.
 * Screen readers get the whole number once.
 */
export function RollingNumber({ value, className }: { value: number; className?: string }) {
  const text = String(Math.max(0, Math.round(value)));
  return (
    <span className={cn("tabular relative inline-flex overflow-hidden leading-none", className)} aria-label={text} role="img">
      {text.split("").map((char, index) => (
        // The key counts from the right, so the ones digit stays the ones digit when the number grows.
        <Digit key={text.length - index} digit={Number(char)} />
      ))}
    </span>
  );
}

function Digit({ digit }: { digit: number }) {
  return (
    <span className="relative inline-block h-[1em] w-[1ch] overflow-hidden" aria-hidden="true">
      <m.span className="absolute inset-x-0 top-0 flex flex-col" initial={false} animate={{ y: `${-digit}em` }} transition={spring.snappy}>
        {DIGITS.map((d) => (
          <span key={d} className="block h-[1em] text-center leading-none">
            {d}
          </span>
        ))}
      </m.span>
    </span>
  );
}
