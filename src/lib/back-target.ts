// The place that Back opens from the detail screen on view. The swipe and the tab bar read it.
let target: string | null = null;
const listeners = new Set<() => void>();

export const backTarget = {
  set(href: string | null) {
    if (target === href) return;
    target = href;
    for (const listener of listeners) listener();
  },
  get: () => target,
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};
