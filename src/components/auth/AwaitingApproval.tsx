import { useState } from "react";
import { Coffee, ShieldAlert, RefreshCw, LogOut, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useCafe } from "@/lib/cafe";
import { useImageUrl } from "@/lib/useImageUrl";
import { toast } from "@/components/ui/sonner";

export default function AwaitingApproval() {
  const { user, refreshRoles, signOut } = useAuth();
  const { cafe } = useCafe();
  const logoSrc = useImageUrl(cafe?.logo_url);
  const [checking, setChecking] = useState(false);

  const handleRefresh = async () => {
    setChecking(true);
    try {
      await refreshRoles();
      toast.info("Checked approval status");
    } catch {
      toast.error("Failed to check approval status");
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="rounded-3xl bg-card p-6 shadow-soft ring-1 ring-border/60">
      <div className="flex items-center gap-2 rounded-2xl bg-success/10 p-3 text-xs font-semibold text-success">
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        <span className="truncate">Authenticated as {user?.email}</span>
      </div>

      <div className="mt-6 text-center">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-warning/15 text-warning">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <h1 className="mt-4 font-display text-2xl font-semibold tracking-tight">Account Awaiting Approval</h1>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
          Your account has been authenticated successfully, but it has not yet been assigned an approved role by a cafe manager or owner.
        </p>
      </div>

      <div className="mt-6 rounded-2xl bg-muted/40 p-4 text-xs text-muted-foreground space-y-2">
        <div className="font-semibold text-foreground flex items-center gap-1.5">
          <Coffee className="h-3.5 w-3.5" /> Next Steps:
        </div>
        <p>
          1. Contact your restaurant owner or administrator.
        </p>
        <p>
          2. Ask them to add your email ({user?.email}) under Staff Settings in the Owner Portal.
        </p>
        <p>
          3. Once approved, tap <strong>Refresh Status</strong> below to access your dashboard.
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
          {checking ? "Checking approval..." : "Refresh Approval Status"}
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
