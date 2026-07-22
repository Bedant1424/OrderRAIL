import { useState } from "react";
import { ShieldAlert, RefreshCw, LogOut, Coffee } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { toast } from "@/components/ui/sonner";

export default function AccountSuspended() {
  const { user, refreshRoles, signOut } = useAuth();
  const [checking, setChecking] = useState(false);

  const handleRefresh = async () => {
    setChecking(true);
    try {
      await refreshRoles();
      toast.info("Checked account status");
    } catch {
      toast.error("Failed to check status");
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="rounded-3xl bg-card p-6 shadow-soft ring-1 ring-border/60">
      <div className="flex items-center gap-2 rounded-2xl bg-destructive/10 p-3 text-xs font-semibold text-destructive">
        <ShieldAlert className="h-4 w-4 shrink-0" />
        <span className="truncate">Signed in as {user?.email}</span>
      </div>

      <div className="mt-6 text-center">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-destructive/15 text-destructive">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <h1 className="mt-4 font-display text-2xl font-semibold tracking-tight text-destructive">Account Suspended</h1>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
          Your staff access to this restaurant has been temporarily suspended by a cafe owner.
        </p>
      </div>

      <div className="mt-6 rounded-2xl bg-muted/40 p-4 text-xs text-muted-foreground space-y-2">
        <div className="font-semibold text-foreground flex items-center gap-1.5">
          <Coffee className="h-3.5 w-3.5" /> What to do next:
        </div>
        <p>
          1. Contact your cafe owner or manager to discuss access restoration.
        </p>
        <p>
          2. Once your access is reactivated, tap <strong>Refresh Status</strong> below.
        </p>
      </div>

      <div className="mt-6 space-y-3">
        <button
          type="button"
          onClick={handleRefresh}
          disabled={checking}
          className="flex w-full items-center justify-center gap-2 rounded-full btn-primary-action px-6 py-3 text-sm font-semibold shadow-soft"
        >
          <RefreshCw className={`h-4 w-4 ${checking ? "animate-spin" : ""}`} />
          {checking ? "Checking status..." : "Refresh Status"}
        </button>

        <button
          type="button"
          onClick={() => void signOut()}
          className="flex w-full items-center justify-center gap-2 rounded-full border border-border bg-background px-6 py-3 text-sm font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground transition"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    </div>
  );
}
