"use client";

import { m, useDragControls, type PanInfo } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { spring } from "@/lib/motion";

const DESKTOP = "(min-width: 1024px)";

/**
 * A modal sheet below the rail breakpoint, and an inline dialog above it.
 * The sheet comes up with a spring. A drag down on its handle closes it, except while an action runs.
 */
export function ActionPanel({ label, pending, onDismiss, children }: {
  label: string;
  pending: boolean;
  onDismiss: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const drag = useDragControls();
  // The panel opens after a tap, so the width is known on the first render.
  const [desktop, setDesktop] = useState(() => window.matchMedia(DESKTOP).matches);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const query = window.matchMedia(DESKTOP);
    const overflow = document.body.style.overflow;
    const show = () => {
      if (dialog.open) dialog.close();
      setDesktop(query.matches);
      document.body.style.overflow = query.matches ? overflow : "hidden";
      if (query.matches) dialog.show();
      else dialog.showModal();
      // Keep the keyboard closed until the staff member selects a field.
      dialog.focus();
    };
    show();
    query.addEventListener("change", show);
    return () => {
      query.removeEventListener("change", show);
      dialog.close();
      document.body.style.overflow = overflow;
    };
  }, []);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    const height = ref.current?.offsetHeight ?? 400;
    if (!pending && (info.offset.y > height * 0.3 || info.velocity.y > 600)) onDismiss();
  };

  return (
    <m.dialog
      ref={ref}
      tabIndex={-1}
      aria-label={label}
      aria-busy={pending}
      onCancel={(event) => {
        event.preventDefault();
        if (!pending) onDismiss();
      }}
      // An inline dialog gets no cancel event from the browser, so Escape is handled here.
      onKeyDown={(event) => {
        if (event.key === "Escape" && desktop && !pending) {
          event.preventDefault();
          onDismiss();
        }
      }}
      initial={desktop ? { opacity: 0, y: 8 } : { y: "100%" }}
      animate={desktop ? { opacity: 1, y: 0 } : { y: 0 }}
      transition={spring.sheet}
      drag={desktop ? false : "y"}
      dragControls={drag}
      dragListener={false}
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={{ top: 0.04, bottom: pending ? 0.1 : 1 }}
      onDragEnd={onDragEnd}
      className="fixed inset-x-0 top-auto bottom-0 m-0 max-h-[85dvh] w-full max-w-none overflow-y-auto overscroll-contain rounded-t-[1.5rem] border-0 bg-background px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] text-foreground shadow-(--shadow-float) outline-none backdrop:bg-primary/40 lg:static lg:mt-5 lg:max-h-none lg:rounded-(--radius-card) lg:bg-card lg:pt-4 lg:pb-4"
    >
      {/* The handle. The drag starts here, so the form can still scroll. */}
      <div onPointerDown={(event) => drag.start(event)} className="-mx-4 flex h-7 cursor-grab touch-none items-center justify-center lg:hidden" aria-hidden="true">
        <span className="h-1.5 w-10 rounded-full bg-input" />
      </div>
      {children}
    </m.dialog>
  );
}
