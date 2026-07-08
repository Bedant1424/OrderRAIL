import { useEffect, useRef, useCallback } from "react";

/**
 * useOverlay — Reusable hook for overlay/backdrop behavior.
 *
 * Provides:
 *  • Background scroll locking (desktop + mobile touch)
 *  • Keyboard focus trapping within a container
 *  • Escape key to close (desktop)
 *  • Automatic cleanup and scroll-position restoration
 *
 * Usage:
 *   const { containerRef } = useOverlay({ open, onClose });
 *   <div ref={containerRef} …>…</div>
 */

export interface UseOverlayOptions {
  /** Whether the overlay is currently open. */
  open: boolean;
  /** Callback invoked when the overlay should close (Escape key, etc.). */
  onClose: () => void;
  /** If true, pressing Escape will NOT close the overlay. @default false */
  disableEscapeClose?: boolean;
  /** If true, focus trapping is disabled. @default false */
  disableFocusTrap?: boolean;
  /** If true, scroll locking is disabled. @default false */
  disableScrollLock?: boolean;
}

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

export function useOverlay({
  open,
  onClose,
  disableEscapeClose = false,
  disableFocusTrap = false,
  disableScrollLock = false,
}: UseOverlayOptions) {
  const containerRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const scrollYRef = useRef(0);

  // ── Scroll locking ──────────────────────────────────────────────
  useEffect(() => {
    if (!open || disableScrollLock) return;

    // Save current scroll position
    scrollYRef.current = window.scrollY;

    const scrollbarWidth =
      window.innerWidth - document.documentElement.clientWidth;

    // Lock body
    const originalOverflow = document.body.style.overflow;
    const originalPaddingRight = document.body.style.paddingRight;
    const originalPosition = document.body.style.position;
    const originalTop = document.body.style.top;
    const originalWidth = document.body.style.width;

    document.body.style.overflow = "hidden";
    document.body.style.paddingRight = `${scrollbarWidth}px`;
    // Fix iOS Safari — position:fixed prevents background scroll
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollYRef.current}px`;
    document.body.style.width = "100%";

    // Touch scroll prevention on mobile
    const preventTouchMove = (e: TouchEvent) => {
      // Allow scrolling inside the overlay container
      if (containerRef.current?.contains(e.target as Node)) return;
      e.preventDefault();
    };
    document.addEventListener("touchmove", preventTouchMove, {
      passive: false,
    });

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.paddingRight = originalPaddingRight;
      document.body.style.position = originalPosition;
      document.body.style.top = originalTop;
      document.body.style.width = originalWidth;

      // Restore scroll position
      window.scrollTo(0, scrollYRef.current);

      document.removeEventListener("touchmove", preventTouchMove);
    };
  }, [open, disableScrollLock]);

  // ── Escape key ──────────────────────────────────────────────────
  useEffect(() => {
    if (!open || disableEscapeClose) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose, disableEscapeClose]);

  // ── Focus trapping ──────────────────────────────────────────────
  useEffect(() => {
    if (!open || disableFocusTrap) return;

    // Save the element that had focus before the overlay opened
    previousFocusRef.current = document.activeElement as HTMLElement | null;

    // Move focus into the overlay container
    const timer = requestAnimationFrame(() => {
      if (!containerRef.current) return;
      const firstFocusable = containerRef.current.querySelector<HTMLElement>(
        FOCUSABLE_SELECTOR
      );
      if (firstFocusable) {
        firstFocusable.focus();
      } else {
        // If no focusable children, focus the container itself
        containerRef.current.focus();
      }
    });

    const handleTabTrap = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || !containerRef.current) return;

      const focusableEls =
        containerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      if (focusableEls.length === 0) {
        e.preventDefault();
        return;
      }

      const first = focusableEls[0];
      const last = focusableEls[focusableEls.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", handleTabTrap);

    return () => {
      cancelAnimationFrame(timer);
      document.removeEventListener("keydown", handleTabTrap);
      // Restore focus to previously focused element
      previousFocusRef.current?.focus();
    };
  }, [open, disableFocusTrap]);

  // ── Backdrop click handler ──────────────────────────────────────
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      // Only close if the click target is the backdrop itself (not content inside)
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose]
  );

  return {
    /** Attach this ref to your overlay content container. */
    containerRef,
    /** Attach this to the backdrop's onClick to close on outside click. */
    handleBackdropClick,
  };
}
