import * as React from "react";
import { createPortal } from "react-dom";
import { useOverlay, type UseOverlayOptions } from "@/hooks/useOverlay";
import { cn } from "@/lib/utils";

/**
 * Overlay — Reusable backdrop + portal for drawers, modals, dialogs, panels.
 *
 * Features:
 *  • Full-screen premium backdrop (subtle dark tint + blur)
 *  • Click outside to close
 *  • Background scroll locking (desktop + mobile)
 *  • Focus trapping & Escape key
 *  • Smooth CSS fade animations
 *  • Portal rendering (z-index managed via CSS)
 *  • aria-modal, role="dialog" by default
 *  • Automatic cleanup on close
 *
 * Usage:
 *   <Overlay open={isOpen} onClose={() => setIsOpen(false)}>
 *     <div className="your-panel-styles">…</div>
 *   </Overlay>
 */

export interface OverlayProps
  extends Pick<
    UseOverlayOptions,
    "open" | "onClose" | "disableEscapeClose" | "disableFocusTrap" | "disableScrollLock"
  > {
  children: React.ReactNode;
  /** Additional className for the backdrop element. */
  backdropClassName?: string;
  /** Role for the overlay container. @default "dialog" */
  role?: React.AriaRole;
  /** aria-label for the overlay. */
  "aria-label"?: string;
  /** aria-labelledby for the overlay. */
  "aria-labelledby"?: string;
  /** Custom z-index class. @default "z-50" */
  zClass?: string;
  /** Portal container. @default document.body */
  portalContainer?: HTMLElement;
}

export function Overlay({
  open,
  onClose,
  children,
  backdropClassName,
  role = "dialog",
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  zClass = "z-50",
  portalContainer,
  disableEscapeClose,
  disableFocusTrap,
  disableScrollLock,
}: OverlayProps) {
  const { containerRef, handleBackdropClick } = useOverlay({
    open,
    onClose,
    disableEscapeClose,
    disableFocusTrap,
    disableScrollLock,
  });

  // Track mount/unmount for exit animation
  const [mounted, setMounted] = React.useState(false);
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setMounted(true);
      // Trigger entrance animation on next frame
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setVisible(true));
      });
    } else {
      setVisible(false);
      // Wait for exit animation to finish before unmounting
      const timer = setTimeout(() => setMounted(false), 200);
      return () => clearTimeout(timer);
    }
  }, [open]);

  if (!mounted) return null;

  const overlay = (
    <div
      className={cn(
        // Full-screen fixed backdrop
        "fixed inset-0",
        zClass,
        // Premium backdrop: subtle tint + blur
        "transition-all duration-200 ease-out",
        visible
          ? "bg-black/15 backdrop-blur-[2px]"
          : "bg-transparent backdrop-blur-0",
        // Prevent pointer events on background content
        "pointer-events-auto",
        backdropClassName
      )}
      onClick={handleBackdropClick}
      aria-hidden="true"
    >
      {/* Overlay content container — focus-trappable, accessible */}
      <div
        ref={containerRef}
        role={role}
        aria-modal="true"
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        tabIndex={-1}
        className="contents"
        style={{ outline: "none" }}
      >
        {children}
      </div>
    </div>
  );

  return createPortal(overlay, portalContainer ?? document.body);
}

export default Overlay;
