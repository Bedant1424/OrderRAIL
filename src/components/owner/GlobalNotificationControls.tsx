import { useOwnerLayout } from "@/layouts/OwnerLayout";
import { Bell, Settings } from "lucide-react";

export function GlobalNotificationControls() {
  const ctx = useOwnerLayout();
  if (!ctx) return null;

  const {
    unreadCount,
    isNotificationsOpen,
    setIsNotificationsOpen,
    notificationsTriggerRef,
    isSettingsOpen,
    setIsSettingsOpen,
    settingsTriggerRef,
  } = ctx;

  return (
    <div className="hidden lg:flex items-center gap-2">
      <button
        ref={notificationsTriggerRef}
        onClick={() => {
          setIsNotificationsOpen(!isNotificationsOpen);
        }}
        className="relative grid h-10 w-10 place-items-center rounded-full border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-secondary transition shadow-soft active:scale-95 shrink-0"
        aria-label="Notification center"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-destructive text-[9.5px] font-bold text-destructive-foreground">
            {unreadCount}
          </span>
        )}
      </button>

      <button
        ref={settingsTriggerRef}
        onClick={() => setIsSettingsOpen(!isSettingsOpen)}
        className="grid h-10 w-10 place-items-center rounded-full border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-secondary transition shadow-soft active:scale-95 shrink-0"
        aria-label="Notification settings"
      >
        <Settings className="h-5 w-5" />
      </button>
    </div>
  );
}
