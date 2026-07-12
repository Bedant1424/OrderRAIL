import { useTheme } from "next-themes";
import { Toaster as Sonner, toast as rawToast } from "sonner";
import { motion, useMotionValue, useTransform, useAnimation } from "framer-motion";
import React from "react";
import { CheckCircle2, AlertCircle, Info as InfoIcon, X, AlertTriangle } from "lucide-react";

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
  const controls = useAnimation();

  const handleDragEnd = async (event: any, info: any) => {
    const offset = info.offset.x;
    const velocity = info.velocity.x;

    if (Math.abs(offset) > 100 || Math.abs(velocity) > 500) {
      const targetX = offset > 0 ? 400 : -400;
      await controls.start({ x: targetX, opacity: 0, transition: { duration: 0.2 } });
      rawToast.dismiss(id);
    } else {
      controls.start({ x: 0, opacity: 1, transition: { type: "spring", stiffness: 300, damping: 25 } });
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
      drag="x"
      dragDirectionLock
      onDragEnd={handleDragEnd}
      animate={controls}
      style={{ x, opacity }}
      className="flex w-full select-none items-center justify-between cursor-grab active:cursor-grabbing touch-none"
    >
      <div className="flex items-start gap-3">
        <Icon className={`h-5 w-5 shrink-0 mt-0.5 ${iconColor}`} />
        <div className="grid gap-1">
          <div className="text-sm font-semibold leading-snug text-foreground">{message}</div>
          {description && (
            <div className="text-xs text-muted-foreground leading-normal">{description}</div>
          )}
          {action && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                action.onClick();
                rawToast.dismiss(id);
              }}
              className="mt-1.5 self-start rounded-full bg-primary px-3 py-1 text-[10px] font-semibold text-primary-foreground shadow-sm hover:bg-primary/95 transition active:scale-95"
            >
              {action.label}
            </button>
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
    const id = options?.id || Math.random().toString();
    return rawToast.custom(
      (tId) => (
        <CustomToastWrapper
          id={tId}
          message={message}
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
