import { useTheme } from "next-themes";
import { Toaster as Sonner, toast as rawToast } from "sonner";
import { motion, useMotionValue, useTransform, useAnimation, animate } from "framer-motion";
import React from "react";
import { CheckCircle2, AlertCircle, Info as InfoIcon, X, AlertTriangle } from "lucide-react";
import { isDemoDeployment } from "@/lib/permissions";

type ToasterProps = React.ComponentProps<typeof Sonner>;

function CustomToastWrapper({
  id,
  message,
  description,
  type,
  action,
}: {
  id: string | number;
  message: React.ReactNode;
  description?: React.ReactNode;
  type: "success" | "error" | "info" | "warning";
  action?: {
    label: string;
    onClick: () => void;
  };
}) {
  const x = useMotionValue(0);
  const opacity = useTransform(x, [-150, 0, 150], [0, 1, 0]);
  const elementRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const unsubscribeX = x.on("change", (latestX) => {
      const toastEl = elementRef.current?.closest("[data-sonner-toast]") as HTMLElement;
      if (toastEl) {
        if (latestX !== 0) {
          toastEl.style.setProperty("transform", `translate3d(${latestX}px, 0, 0) var(--y)`, "important");
          toastEl.style.setProperty("transition", "none", "important");
        } else {
          toastEl.style.removeProperty("transform");
          toastEl.style.removeProperty("transition");
        }
      }
      if (elementRef.current) {
        if (latestX !== 0) {
          elementRef.current.style.setProperty("transform", "none", "important");
        } else {
          elementRef.current.style.removeProperty("transform");
        }
      }
    });

    const unsubscribeOpacity = opacity.on("change", (latestOpacity) => {
      const toastEl = elementRef.current?.closest("[data-sonner-toast]") as HTMLElement;
      if (toastEl) {
        if (latestOpacity !== 1) {
          toastEl.style.setProperty("opacity", String(latestOpacity), "important");
          toastEl.style.setProperty("transition", "none", "important");
        } else {
          toastEl.style.removeProperty("opacity");
          if (x.get() === 0) {
            toastEl.style.removeProperty("transition");
          }
        }
      }
      if (elementRef.current) {
        if (latestOpacity !== 1) {
          elementRef.current.style.setProperty("opacity", "1", "important");
        } else {
          elementRef.current.style.removeProperty("opacity");
        }
      }
    });

    return () => {
      unsubscribeX();
      unsubscribeOpacity();
    };
  }, [x, opacity]);

  React.useEffect(() => {
    const toastEl = elementRef.current?.closest("[data-sonner-toast]") as HTMLElement;
    if (toastEl && action) {
      toastEl.style.setProperty("padding", "0", "important");
      toastEl.style.setProperty("background", "transparent", "important");
      toastEl.style.setProperty("border", "none", "important");
      toastEl.style.setProperty("box-shadow", "none", "important");
    }
  }, [action]);

  const handleDragEnd = async (event: any, info: any) => {
    const offset = info.offset.x;
    const velocity = info.velocity.x;

    if (Math.abs(offset) > 100 || Math.abs(velocity) > 500) {
      const targetX = offset > 0 ? 400 : -400;
      await Promise.all([
        animate(x, targetX, { duration: 0.3 }),
        animate(opacity, 0, { duration: 0.3 })
      ]);
      rawToast.dismiss(id);
    } else {
      await Promise.all([
        animate(x, 0, { type: "spring", stiffness: 300, damping: 25 }),
        animate(opacity, 1, { duration: 0.2 })
      ]);
    }
  };

  const Icon =
    type === "success"
      ? CheckCircle2
      : type === "error"
      ? AlertCircle
      : type === "warning"
      ? AlertTriangle
      : InfoIcon;

  const iconColor =
    type === "success"
      ? "text-emerald-500"
      : type === "error"
      ? "text-destructive"
      : type === "warning"
      ? "text-amber-500"
      : "text-blue-500";

  return (
    <motion.div
      ref={elementRef}
      drag="x"
      dragDirectionLock
      onDragEnd={handleDragEnd}
      style={{ x, opacity }}
      whileHover={action ? { y: -2 } : undefined}
      whileTap={action ? { scale: 0.98 } : undefined}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      role={action ? "button" : undefined}
      tabIndex={action ? 0 : undefined}
      onClick={action ? (e) => {
        action.onClick();
        rawToast.dismiss(id);
      } : undefined}
      onKeyDown={action ? (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          action.onClick();
          rawToast.dismiss(id);
        }
      } : undefined}
      className={
        action
          ? `clickable-toast-card ${type} flex w-full select-none items-center justify-between touch-none outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`
          : "flex w-full select-none items-center justify-between cursor-grab active:cursor-grabbing touch-none"
      }
    >
      <div className="flex items-start gap-3">
        <Icon className={`h-5 w-5 shrink-0 mt-0.5 ${iconColor}`} />
        <div className="grid gap-1">
          <div className="text-sm font-semibold leading-snug text-foreground">{message}</div>
          {description && (
            <div className="text-xs text-muted-foreground leading-normal">{description}</div>
          )}
        </div>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          rawToast.dismiss(id);
        }}
        className="ml-4 rounded-full p-1 text-muted-foreground/60 hover:bg-secondary hover:text-foreground transition shrink-0"
        aria-label="Close notification"
      >
        <X className="h-4 w-4" />
      </button>
    </motion.div>
  );
}

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      expand={false}
      visibleToasts={3}
      closeButton={true}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

const customToast = {
  success: (message: React.ReactNode, options?: any) => {
    const id = options?.id || Math.random().toString();
    return rawToast.custom(
      (tId) => (
        <CustomToastWrapper
          id={tId}
          message={message}
          description={options?.description}
          type="success"
          action={options?.action}
        />
      ),
      { ...options, id, type: "success" }
    );
  },
  error: (message: React.ReactNode, options?: any) => {
    let cleanMessage = message;
    if (typeof message === "string" && isDemoDeployment()) {
      const lower = message.toLowerCase();
      if (
        lower.includes("row-level security") ||
        lower.includes("violates row-level security policy") ||
        lower.includes("permission denied") ||
        lower.includes("insufficient privilege") ||
        lower.includes("new row violates")
      ) {
        cleanMessage = "This action is disabled in the public demo.";
      }
    }
    const id = options?.id || Math.random().toString();
    return rawToast.custom(
      (tId) => (
        <CustomToastWrapper
          id={tId}
          message={cleanMessage}
          description={options?.description}
          type="error"
          action={options?.action}
        />
      ),
      { ...options, id, type: "error" }
    );
  },
  warning: (message: React.ReactNode, options?: any) => {
    const id = options?.id || Math.random().toString();
    return rawToast.custom(
      (tId) => (
        <CustomToastWrapper
          id={tId}
          message={message}
          description={options?.description}
          type="warning"
          action={options?.action}
        />
      ),
      { ...options, id, type: "warning" }
    );
  },
  info: (message: React.ReactNode, options?: any) => {
    const id = options?.id || Math.random().toString();
    return rawToast.custom(
      (tId) => (
        <CustomToastWrapper
          id={tId}
          message={message}
          description={options?.description}
          type="info"
          action={options?.action}
        />
      ),
      { ...options, id, type: "info" }
    );
  },
  dismiss: (id?: string | number) => {
    rawToast.dismiss(id);
  }
};

if (typeof window !== "undefined") {
  (window as any).__toast = customToast;
}

export { Toaster, customToast as toast };
