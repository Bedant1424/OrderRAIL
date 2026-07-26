import { useOwnerLayout } from "@/layouts/OwnerLayout";
import { useStaffLayout } from "@/layouts/StaffLayout";
import { Bell, Settings } from "lucide-react";

export function GlobalNotificationControls() {
  const ownerCtx = useOwnerLayout();
  const staffCtx = useStaffLayout();
  const ctx = ownerCtx || staffCtx;
  if (!ctx) return null;

  const {
    unreadCount,
    isNotificationsOpen,
    setIsNotificationsOpen,
    notificationsTriggerRefDesktop,
    isSettingsOpen,
    setIsSettingsOpen,
    settingsTriggerRefDesktop,
  } = ctx;

  return (
    <div className="hidden lg:flex items-center gap-2">
      <button
        ref={notificationsTriggerRefDesktop}
        onClick={() => {
          setIsNotificationsOpen(!isNotificationsOpen);
        }}
        className="relative grid h-10 w-10 place-items-center rounded-full border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-secondary transition shadow-soft active:scale-95 shrink-0"
        aria-label="Notification center"
      >
        <Bell className="h-5 w-5" />
        {(unreadCount ?? 0) > 0 && (
          <span
            className="absolute -top-1 -right-1 flex items-center justify-center bg-destructive text-destructive-foreground"
            style={{
              minWidth: "18px",
              height: "18px",
              borderRadius: "9999px",
              fontSize: "10px",
              fontWeight: 700,
              lineHeight: 1,
              paddingLeft: (unreadCount ?? 0) >= 10 ? "5px" : "0px",
              paddingRight: (unreadCount ?? 0) >= 10 ? "5px" : "0px",
            }}
          >
            {(unreadCount ?? 0) > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      <button
        ref={settingsTriggerRefDesktop}
        onClick={() => setIsSettingsOpen(!isSettingsOpen)}
        className="grid h-10 w-10 place-items-center rounded-full border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-secondary transition shadow-soft active:scale-95 shrink-0"
        aria-label="Notification settings"
      >
        <Settings className="h-5 w-5" />
      </button>
    </div>
  );
}
