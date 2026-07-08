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

  React.useEffect(() => {
    if (open && triggerRef.current) {
      const updateCoords = () => {
        const rect = triggerRef.current!.getBoundingClientRect();
        // Position directly under the trigger, aligned to the right edge of the trigger
        setCoords({
          top: rect.bottom + 8, // 8px gap
          right: window.innerWidth - rect.right,
        });
      };
      updateCoords();
      window.addEventListener("resize", updateCoords);
      window.addEventListener("scroll", updateCoords, true);
      
      // Trigger CSS transition animation after render
      const animTimer = setTimeout(() => setAnimate(true), 10);

      return () => {
        window.removeEventListener("resize", updateCoords);
        window.removeEventListener("scroll", updateCoords, true);
        clearTimeout(animTimer);
      };
    } else {
      setAnimate(false);
    }
  }, [open, triggerRef]);

  return (
    <Overlay open={open} onClose={onClose} zClass={zClass}>
      <div
        className={cn(
          "fixed w-72 rounded-2xl border border-border bg-card p-4 shadow-float transition-all duration-200 ease-out",
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
