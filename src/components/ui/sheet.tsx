"use client";

import { AnimatePresence, m, useDragControls, type PanInfo } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { spring } from "@/lib/motion";

/**
 * A modal sheet that comes up from the bottom with a spring.
 * A drag down on its handle closes it. Escape and a tap on the backdrop close it too.
 * The native dialog keeps the focus inside, and gives it back to the control that opened it.
 */
export function Sheet({
  open,
  onClose,
  label,
  locked = false,
  children,
}: {
  open: boolean;
  onClose: () => void;
  label: string;
  /** True while an action runs. The sheet then does not close. */
  locked?: boolean;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const drag = useDragControls();
  const [present, setPresent] = useState(open);
  if (open && !present) setPresent(true);

  useEffect(() => {
    const dialog = ref.current;
    if (present && dialog && !dialog.open) dialog.showModal();
  }, [present]);

  const close = () => {
    if (!locked) onClose();
  };
  const onDragEnd = (_: unknown, info: PanInfo) => {
    const height = panel.current?.offsetHeight ?? 400;
    if (info.offset.y > height * 0.3 || info.velocity.y > 600) close();
  };

  if (!present) return null;
  return (
    <dialog
      ref={ref}
      aria-label={label}
      aria-busy={locked}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      className="m-0 h-full max-h-none w-full max-w-none overflow-hidden bg-transparent p-0 text-foreground outline-none backdrop:bg-transparent"
    >
      <AnimatePresence
        onExitComplete={() => {
          ref.current?.close();
          setPresent(false);
        }}
      >
        {open && (
          <m.div
            key="backdrop"
            className="fixed inset-0 bg-primary/45"
            onClick={close}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.16 } }}
          />
        )}
        {open && (
          <m.div
            key="panel"
            ref={panel}
            drag="y"
            dragControls={drag}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.04, bottom: 1 }}
            onDragEnd={onDragEnd}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%", transition: { duration: 0.2, ease: [0.4, 0, 1, 1] } }}
            transition={spring.sheet}
            className="fixed inset-x-0 bottom-0 mx-auto flex max-h-[85dvh] w-full max-w-lg flex-col rounded-t-[1.5rem] bg-background shadow-(--shadow-float)"
          >
            {/* The handle. The drag starts here, so the content can still scroll. */}
            <div onPointerDown={(event) => drag.start(event)} className="flex h-7 shrink-0 cursor-grab touch-none items-center justify-center active:cursor-grabbing">
              <span className="h-1.5 w-10 rounded-full bg-input" aria-hidden="true" />
            </div>
            <div className="overflow-y-auto overscroll-contain px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">{children}</div>
          </m.div>
        )}
      </AnimatePresence>
    </dialog>
  );
}
