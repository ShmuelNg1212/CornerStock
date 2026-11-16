"use client";

import { animate, m, useMotionValue, useReducedMotion } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { backTarget } from "@/lib/back-target";
import { spring } from "@/lib/motion";

const EDGE = 28;
const BACK = ["nav-back"];

/**
 * Phones: a swipe from the left edge goes back. The screen follows the finger.
 * A short swipe returns the screen to its place. Safari in the browser has its own
 * edge swipe, so there the app does not add one; the home-screen app has none.
 */
export function SwipeBack({ href, children }: { href: string; children: React.ReactNode }) {
  const router = useRouter();
  const reduced = useReducedMotion();
  const x = useMotionValue(0);
  const [enabled, setEnabled] = useState(false);
  const gesture = useRef<{ id: number; x: number; y: number; t: number; locked: boolean } | null>(null);

  useEffect(() => {
    backTarget.set(href);
    return () => {
      if (backTarget.get() === href) backTarget.set(null);
    };
  }, [href]);

  useEffect(() => {
    const phone = window.matchMedia("(max-width: 1023px)");
    const standalone = window.matchMedia("(display-mode: standalone)").matches || ("standalone" in navigator && Boolean(navigator.standalone));
    const ios = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const update = () => setEnabled(phone.matches && (!ios || standalone));
    update();
    phone.addEventListener("change", update);
    return () => phone.removeEventListener("change", update);
  }, []);

  const settle = () => {
    if (reduced) x.set(0);
    else animate(x, 0, spring.sheet);
  };

  return (
    <m.div
      style={{ x, touchAction: enabled ? "pan-y" : undefined }}
      onPointerDown={(event) => {
        if (!enabled || event.pointerType !== "touch" || event.clientX > EDGE) return;
        gesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY, t: event.timeStamp, locked: false };
      }}
      onPointerMove={(event) => {
        const g = gesture.current;
        if (!g || g.id !== event.pointerId) return;
        const dx = event.clientX - g.x;
        const dy = event.clientY - g.y;
        if (!g.locked) {
          if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) {
            gesture.current = null;
            return;
          }
          if (dx < 10) return;
          g.locked = true;
          event.currentTarget.setPointerCapture(event.pointerId);
        }
        x.set(Math.max(0, dx));
      }}
      onPointerUp={(event) => {
        const g = gesture.current;
        gesture.current = null;
        if (!g?.locked) return;
        const dx = event.clientX - g.x;
        const speed = dx / Math.max(1, event.timeStamp - g.t);
        if (dx > window.innerWidth * 0.35 || speed > 0.6) router.push(href, { transitionTypes: BACK });
        else settle();
      }}
      onPointerCancel={() => {
        if (gesture.current?.locked) settle();
        gesture.current = null;
      }}
    >
      {children}
    </m.div>
  );
}
