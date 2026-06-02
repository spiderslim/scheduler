import { useEffect, RefObject } from 'react';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Shared modal accessibility: closes on Escape, traps Tab focus within the
 * container, and restores focus to the previously focused element on close.
 * Respects existing autoFocus (won't steal focus if something inside is
 * already focused).
 */
export function useModalA11y(
  isOpen: boolean,
  containerRef: RefObject<HTMLElement | null>,
  onClose: () => void
) {
  useEffect(() => {
    if (!isOpen) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const container = containerRef.current;

    const getFocusable = (): HTMLElement[] => {
      if (!container) return [];
      const nodes = Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR)) as HTMLElement[];
      return nodes.filter((el) => el.offsetParent !== null);
    };

    const alreadyInside = container && container.contains(document.activeElement);
    if (!alreadyInside) {
      const focusables = getFocusable();
      if (focusables.length) focusables[0].focus();
      else container?.focus();
    }

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === 'Tab') {
        const items = getFocusable();
        if (items.length === 0) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('keydown', handleKey);
      previouslyFocused?.focus?.();
    };
  }, [isOpen, onClose, containerRef]);
}
