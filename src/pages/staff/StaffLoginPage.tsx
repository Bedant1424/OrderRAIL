import { useEffect, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Coffee, ShieldCheck } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, hasRole } from "@/lib/auth";
import { useCafe } from "@/lib/cafe";
import { useImageUrl } from "@/lib/useImageUrl";

function formatAuthError(err: unknown): string {
  if (!(err instanceof Error)) return "An unexpected error occurred. Please try again.";
  const msg = err.message.toLowerCase();
  if (msg.includes("invalid login credentials")) return "Invalid email or password. Please try again.";
  if (msg.includes("email not confirmed")) return "Please confirm your email address before signing in.";
  if (msg.includes("rate limit")) return "Too many attempts. Please wait a moment before trying again.";
  if (msg.includes("network")) return "Network error. Please check your internet connection.";
  return err.message;
}

export default function StaffLoginPage() {
  const nav = useNavigate();
  const location = useLocation();
  const { session, roles, loading, refreshRoles, signOut } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const { cafe } = useCafe();
  const logoSrc = useImageUrl(cafe?.logo_url);

  useEffect(() => {
    console.log("StaffLoginPage: Redirect check evaluation:", {
      loading,
      sessionExists: !!session,
      roles,
      isOwner: hasRole(roles, "owner"),
      isStaff: hasRole(roles, "staff")
    });
    if (!loading && session && hasRole(roles, "staff", "owner")) {
      const fromPath = (location.state as { from?: string })?.from;
      const defaultTarget = hasRole(roles, "owner") ? "/owner" : "/staff";
      const target = fromPath && (fromPath.startsWith("/owner") || fromPath.startsWith("/staff")) 
        ? fromPath 
        : defaultTarget;
      console.log("StaffLoginPage: Redirecting to:", target);
      nav(target, { replace: true });
    }
  }, [loading, session, roles, nav, location.state]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const redirectUrl = `${window.location.origin}/staff/login`;
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: redirectUrl },
        });
        if (error) throw error;
        toast.success("Account created — you're signed in.");
      } else {
        console.log("StaffLoginPage: Attempting signInWithPassword for email:", email);
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        console.log("StaffLoginPage: signInWithPassword result:", {
          success: !error,
          error,
          userId: data.user?.id,
          userEmail: data.user?.email
        });
        if (error) throw error;
      }
    } catch (err: unknown) {
      toast.error(formatAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  const signInGoogle = async () => {
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/staff/login`,
        },
      });
      if (error) throw error;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Google sign-in failed";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const claim = async (role: "staff" | "owner") => {
    setBusy(true);
    try {
      const { error } = await supabase.rpc("claim_demo_role", { _role: role });
      if (error) throw error;
      await refreshRoles();
      toast.success(`You're set as ${role}.`);
      nav(role === "owner" ? "/owner" : "/staff");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Could not claim role";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-warm">
      <header className="mx-auto flex max-w-md items-center justify-between px-6 py-6">
        <Link to="/" className="flex items-center gap-2">
          {logoSrc ? (
            <div className="relative w-9 h-9 rounded-xl overflow-hidden border border-border shadow-soft bg-card shrink-0">
              <img src={logoSrc} alt={cafe?.name} className="h-full w-full object-cover" />
            </div>
          ) : (
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand text-brand-foreground shadow-soft shrink-0">
              <span className="font-display text-sm font-bold">OR</span>
            </span>
          )}
          <span className="font-display text-lg font-semibold">{cafe?.name ?? "OrderRail"}</span>
        </Link>
        <span className="text-xs text-muted-foreground">Staff & owner</span>
      </header>

      <main className="mx-auto max-w-md px-6 pb-16">
        <div className="rounded-3xl bg-card p-6 shadow-soft ring-1 ring-border/60">
          {!session ? (
            <>
              <h1 className="font-display text-3xl font-semibold tracking-tight">
                {mode === "signin" ? "Welcome back" : "Create staff account"}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {mode === "signin"
                  ? "Sign in to open the staff dashboard."
                  : "Sign up, then claim staff or owner access to the demo cafe."}
              </p>
              <form onSubmit={submit} className="mt-6 space-y-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Email</label>
                  <input
                    required
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-1 w-full rounded-2xl border border-border bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-ring/60"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Password</label>
                  <input
                    required
                    type="password"
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="mt-1 w-full rounded-2xl border border-border bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-ring/60"
                  />
                </div>
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full rounded-full btn-primary-action px-6 py-3 text-sm font-semibold"
                >
                  {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
                </button>
              </form>

              <div className="my-4 flex items-center gap-3 text-[10px] uppercase tracking-widest text-muted-foreground">
                <span className="h-px flex-1 bg-border" />
                or
                <span className="h-px flex-1 bg-border" />
              </div>
              <button
                type="button"
                onClick={signInGoogle}
                disabled={busy}
                className="flex w-full items-center justify-center gap-3 rounded-full border border-border bg-background px-6 py-3 text-sm font-semibold shadow-soft transition hover:bg-secondary disabled:opacity-60"
              >
                <svg className="h-4 w-4" viewBox="0 0 48 48" aria-hidden="true">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                </svg>
                Continue with Google
              </button>

              <button
                onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
                className="mt-4 w-full text-center text-xs text-muted-foreground hover:text-foreground"
              >
                {mode === "signin" ? "No account? Sign up" : "Already have an account? Sign in"}
              </button>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Coffee className="h-4 w-4" /> Signed in as {session.user.email}
              </div>
              <h1 className="mt-3 font-display text-2xl font-semibold">Claim demo access</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Grant yourself a role to explore the dashboards. You can hold both.
              </p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <button
                  onClick={() => claim("staff")}
                  disabled={busy}
                  className="rounded-2xl bg-secondary p-4 text-left shadow-soft transition hover:bg-secondary/80"
                >
                  <ShieldCheck className="h-5 w-5 text-accent" />
                  <div className="mt-2 font-display text-base font-semibold">Staff</div>
                  <div className="text-xs text-muted-foreground">Live orders & service requests</div>
                </button>
                <button
                  onClick={() => claim("owner")}
                  disabled={busy}
                  className="rounded-2xl bg-secondary p-4 text-left shadow-soft transition hover:bg-secondary/80"
                >
                  <ShieldCheck className="h-5 w-5 text-accent" />
                  <div className="mt-2 font-display text-base font-semibold">Owner</div>
                  <div className="text-xs text-muted-foreground">Everything staff can do</div>
                </button>
              </div>
              {hasRole(roles, "staff", "owner") && (
                <div className="mt-4 flex gap-2">
                  <Link
                    to="/staff"
                    className="flex-1 rounded-full btn-primary-action px-4 py-2.5 text-center text-sm font-semibold"
                  >
                    Open staff dashboard
                  </Link>
                </div>
              )}
              <button
                onClick={() => void signOut()}
                className="mt-4 w-full text-center text-xs text-muted-foreground hover:text-foreground"
              >
                Sign out
              </button>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
