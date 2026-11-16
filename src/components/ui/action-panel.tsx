"use client";

import { useEffect, useRef } from "react";

/** A modal sheet below the rail breakpoint, and an inline dialog above it. */
export function ActionPanel({ label, pending, onDismiss, children }: {
  label: string;
  pending: boolean;
  onDismiss: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const desktop = window.matchMedia("(min-width: 1024px)");
    const overflow = document.body.style.overflow;
    const show = () => {
      if (dialog.open) dialog.close();
      document.body.style.overflow = desktop.matches ? overflow : "hidden";
      if (desktop.matches) dialog.show();
      else dialog.showModal();
      // Keep the keyboard closed until the staff member selects a field.
      dialog.focus();
    };
    show();
    desktop.addEventListener("change", show);
    return () => {
      desktop.removeEventListener("change", show);
      dialog.close();
      document.body.style.overflow = overflow;
    };
  }, []);

  return (
    <dialog
      ref={ref}
      tabIndex={-1}
      aria-label={label}
      aria-busy={pending}
      onCancel={(event) => {
        event.preventDefault();
        if (!pending) onDismiss();
      }}
      className="fixed inset-x-0 top-auto bottom-0 m-0 max-h-[85dvh] w-full max-w-none overflow-y-auto overscroll-contain rounded-t-xl border border-input bg-background p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] text-foreground outline-none backdrop:bg-primary/40 lg:static lg:mt-5 lg:max-h-none lg:rounded-xl lg:pb-4"
    >
      {children}
    </dialog>
  );
}
