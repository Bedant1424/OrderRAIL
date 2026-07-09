import * as React from "react";
import { Overlay } from "@/components/ui/overlay";
import { cn } from "@/lib/utils";

interface AnchoredPopoverProps {
  open: boolean;
  onClose: () => void;
  triggerRef: React.RefObject<HTMLElement>;
  children: React.ReactNode;
  className?: string;
  zClass?: string;
}

export function AnchoredPopover({
  open,
  onClose,
  triggerRef,
  children,
  className,
  zClass = "z-50",
}: AnchoredPopoverProps) {
  const [coords, setCoords] = React.useState<{ top: number; right: number } | null>(null);
  const [animate, setAnimate] = React.useState(false);
  const popoverRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (open && triggerRef.current) {
      const updateCoords = () => {
        if (!triggerRef.current) return;
        const rect = triggerRef.current.getBoundingClientRect();
        let rightVal = window.innerWidth - rect.right;

        // Prevent overflowing off the left edge of the screen on narrow/mobile viewports
        if (popoverRef.current) {
          const popoverWidth = popoverRef.current.getBoundingClientRect().width;
          const minLeft = 12; // 12px minimum margin from the left edge of the viewport
          const maxRight = window.innerWidth - popoverWidth - minLeft;
          if (rightVal > maxRight) {
            rightVal = Math.max(minLeft, maxRight);
          }
        }

        // Position directly under the trigger, aligned to the right edge of the trigger
        setCoords({
          top: rect.bottom + 8, // 8px gap
          right: rightVal,
        });
      };
      updateCoords();

      // If the popover element wasn't mounted yet, schedule a check in the next frame(s)
      let frameId: number;
      if (!popoverRef.current) {
        const checkMount = () => {
          if (popoverRef.current) {
            updateCoords();
          } else {
            frameId = requestAnimationFrame(checkMount);
          }
        };
        frameId = requestAnimationFrame(checkMount);
      }

      window.addEventListener("resize", updateCoords);
      window.addEventListener("scroll", updateCoords, true);
      
      // Trigger CSS transition animation after render
      const animTimer = setTimeout(() => setAnimate(true), 10);

      return () => {
        window.removeEventListener("resize", updateCoords);
        window.removeEventListener("scroll", updateCoords, true);
        clearTimeout(animTimer);
        if (frameId) {
          cancelAnimationFrame(frameId);
        }
      };
    } else {
      setAnimate(false);
    }
  }, [open, triggerRef]);

  return (
    <Overlay open={open} onClose={onClose} zClass={zClass}>
      <div
        ref={popoverRef}
        className={cn(
          "fixed w-72 rounded-2xl border border-border bg-card p-0 overflow-hidden shadow-float transition-all duration-200 ease-out",
          animate ? "opacity-100 scale-100" : "opacity-0 scale-95",
          className
        )}
        style={{
          top: coords ? `${coords.top}px` : "0px",
          right: coords ? `${coords.right}px` : "0px",
          transformOrigin: "top right",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </Overlay>
  );
}

export default AnchoredPopover;
