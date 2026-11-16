"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { backTarget } from "@/lib/back-target";

const EDGE = 28;
const BACK = ["nav-back"];

/**
 * Phones: a swipe from the left edge goes back. The screen follows the finger.
 * A short swipe returns the screen to its place. Safari in the browser has its own
 * edge swipe, so there the app does not add one; the home-screen app has none.
 */
export function SwipeBack({ href, children }: { href: string; children: React.ReactNode }) {
  const router = useRouter();
  const box = useRef<HTMLDivElement>(null);
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

  // The finger moves the screen directly. A short swipe returns it with a short ease, or at once under reduced motion.
  const move = (dx: number) => {
    if (box.current) box.current.style.transform = dx ? `translateX(${dx}px)` : "";
  };
  const settle = (from: number) => {
    const element = box.current;
    move(0);
    if (!element || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    element.animate([{ transform: `translateX(${from}px)` }, { transform: "translateX(0)" }], { duration: 260, easing: "cubic-bezier(0.16, 1, 0.3, 1)" });
  };

  return (
    <div
      ref={box}
      style={{ touchAction: enabled ? "pan-y pinch-zoom" : undefined }}
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
        move(Math.max(0, dx));
      }}
      onPointerUp={(event) => {
        const g = gesture.current;
        gesture.current = null;
        if (!g?.locked) return;
        const dx = event.clientX - g.x;
        const speed = dx / Math.max(1, event.timeStamp - g.t);
        // A fast flick also goes back, but only after a real move, not a graze of the edge.
        if (dx > window.innerWidth * 0.35 || (dx > 48 && speed > 0.6)) router.push(href, { transitionTypes: BACK });
        else settle(Math.max(0, dx));
      }}
      onPointerCancel={(event) => {
        const g = gesture.current;
        gesture.current = null;
        if (g?.locked) settle(Math.max(0, event.clientX - g.x));
      }}
    >
      {children}
    </div>
  );
}
