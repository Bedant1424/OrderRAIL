import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock, ShieldCheck, Trash2, UserPlus, Pencil, X } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { supabase, type Cafe } from "@/lib/db";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];
type RoleRow = { id: string; user_id: string; role: AppRole; cafe_id: string | null };
import { usePermissions, maskEmail, maskUserId } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { useCafe } from "@/lib/cafe";
import { GlobalNotificationControls } from "@/components/owner/GlobalNotificationControls";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Profile = { id: string; email: string | null; display_name: string | null };
type InviteRow = { id: string; email: string; role: AppRole; created_at: string };

export default function OwnerStaffPage() {
  const qc = useQueryClient();
  const permissions = usePermissions();
  const isDemo = permissions.isDemo;
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AppRole>("staff");
  const [busy, setBusy] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleRow | null>(null);
  const [newRole, setNewRole] = useState<AppRole>("staff");

  const { cafe, cafeId } = useCafe();

  const rolesQ = useQuery({
    queryKey: ["owner-roles", cafeId],
    enabled: !!cafeId,
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("*").eq("cafe_id", cafeId!);
      return (data ?? []) as RoleRow[];
    },
  });

  const userIds = useMemo(() => [...new Set((rolesQ.data ?? []).map((r) => r.user_id))], [rolesQ.data]);

  const profilesQ = useQuery({
    queryKey: ["owner-role-profiles", userIds.join(",")],
    enabled: userIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, email, display_name").in("id", userIds);
      return (data ?? []) as Profile[];
    },
  });

  const invitesQ = useQuery({
    queryKey: ["owner-invites", cafeId],
    enabled: !!cafeId,
    queryFn: async () => {
      const { data } = await supabase
        .from("staff_invites")
        .select("id, email, role, created_at")
        .eq("cafe_id", cafeId!)
        .order("created_at", { ascending: false });
      return (data ?? []) as InviteRow[];
    },
  });

  const invite = async () => {
    if (!cafeId || !email.trim()) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("assign_role_by_email", {
      _cafe_id: cafeId,
      _email: email.trim(),
      _role: role,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    if (data === "invited") {
      toast.success(`Invite saved for ${email} — they'll get ${role} access when they sign in.`);
    } else {
      toast.success(`Assigned ${role} to ${email}`);
    }
    setEmail("");
    void qc.invalidateQueries({ queryKey: ["owner-roles", cafeId] });
    void qc.invalidateQueries({ queryKey: ["owner-invites", cafeId] });
  };

  const revokeInvite = async (id: string) => {
    if (!confirm("Cancel this invite?")) return;
    const { error } = await supabase.from("staff_invites").delete().eq("id", id);
    if (error) return toast.error(error.message);
    void qc.invalidateQueries({ queryKey: ["owner-invites", cafeId] });
  };

  const revoke = async (r: RoleRow) => {
    if (r.role === "owner") {
      const ownerCount = (rolesQ.data ?? []).filter((x) => x.role === "owner").length;
      if (ownerCount <= 1) {
        return toast.error("Cannot revoke this role. There must be at least one owner for this cafe.");
      }
    }
    if (!confirm("Revoke this role?")) return;
    const { error } = await supabase.from("user_roles").delete().eq("id", r.id);
    if (error) return toast.error(error.message);
    void qc.invalidateQueries({ queryKey: ["owner-roles", cafeId] });
  };

  const startEdit = (r: RoleRow) => {
    setEditingRole(r);
    setNewRole(r.role);
  };

  const saveRole = async (r: RoleRow, targetRole: AppRole) => {
    if (targetRole !== "staff" && targetRole !== "owner") {
      return toast.error("Invalid role value.");
    }
    if (r.role === "owner" && targetRole === "staff") {
      const ownerCount = (rolesQ.data ?? []).filter((x) => x.role === "owner").length;
      if (ownerCount <= 1) {
        return toast.error("Cannot demote the last owner. There must be at least one owner for this cafe.");
      }
    }

    setBusy(true);
    const { error } = await supabase
      .from("user_roles")
      .update({ role: targetRole })
      .eq("id", r.id);
    setBusy(false);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Role updated successfully");
      setEditingRole(null);
      void qc.invalidateQueries({ queryKey: ["owner-roles", cafeId] });
    }
  };

  const byUser = new Map<string, Profile>();
  for (const p of profilesQ.data ?? []) byUser.set(p.id, p);

  if (rolesQ.isLoading || profilesQ.isLoading || invitesQ.isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-24 gap-3 text-muted-foreground">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
        <span className="text-sm font-medium">Loading staff…</span>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Staff</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Grant staff or owner access to your cafe. Team members must already have an account.
          </p>
        </div>
        <GlobalNotificationControls />
      </header>

      <section className="rounded-3xl bg-card p-4 shadow-soft ring-1 ring-border/60">
        <h2 className="mb-3 flex items-center gap-2 font-display text-base font-semibold">
          <UserPlus className="h-4 w-4" /> Assign role
        </h2>
        <div className="grid gap-3 sm:grid-cols-[1fr_140px_auto]">
          <input
            type="email"
            value={email}
            disabled={isDemo}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={isDemo ? "Invitations disabled in demo" : "teammate@cafe.com"}
            className="rounded-2xl border border-border bg-background p-2.5 text-sm outline-none focus:ring-2 focus:ring-ring/60 disabled:opacity-60 disabled:bg-muted/35 disabled:cursor-not-allowed"
          />
          <select
            value={role}
            disabled={isDemo}
            onChange={(e) => setRole(e.target.value as AppRole)}
            className="rounded-2xl border border-border bg-background p-2.5 text-sm outline-none focus:ring-2 focus:ring-ring/60 disabled:opacity-60 disabled:bg-muted/35 disabled:cursor-not-allowed"
          >
            <option value="staff">Staff</option>
            <option value="owner">Owner</option>
          </select>
          <button
            onClick={isDemo ? undefined : () => void invite()}
            disabled={busy || !email.trim() || isDemo}
            className={cn(
              "rounded-full px-5 py-2 text-sm font-semibold transition",
              isDemo
                ? "bg-muted text-muted-foreground border border-border cursor-not-allowed opacity-75"
                : "btn-primary-action"
            )}
            title={isDemo ? "This action is disabled in the public demo." : "Assign role"}
          >
            {isDemo ? "🔒 Disabled" : busy ? "Assigning…" : "Assign"}
          </button>
        </div>
        {isDemo && (
          <p className="mt-3 text-[11px] text-amber-600 bg-amber-500/8 border border-amber-500/20 p-2.5 rounded-xl text-center font-medium">
            This action is disabled in the public demo.
          </p>
        )}
        {!isDemo && (
          <p className="mt-2 text-xs text-muted-foreground">
            If they don't have an account yet, we'll save an invite and grant the role automatically the first time they sign in (email/password or Google).
          </p>
        )}
      </section>

      {(invitesQ.data ?? []).length > 0 && (
        <section className="rounded-3xl bg-card p-4 shadow-soft ring-1 ring-border/60">
          <h2 className="mb-3 flex items-center gap-2 font-display text-base font-semibold">
            <Clock className="h-4 w-4" /> Pending invites
          </h2>
          <ul className="divide-y divide-border/60">
            {invitesQ.data!.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{isDemo ? maskEmail(i.email) : i.email}</div>
                  <div className="text-xs text-muted-foreground">
                    Invited {new Date(i.created_at).toLocaleDateString()}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium capitalize">{i.role}</span>
                  <button
                    onClick={isDemo ? undefined : () => void revokeInvite(i.id)}
                    disabled={isDemo}
                    className={cn(
                      "rounded-full p-1.5 transition",
                      isDemo 
                        ? "bg-muted text-muted-foreground border border-border cursor-not-allowed opacity-50" 
                        : "bg-secondary text-muted-foreground hover:text-destructive active:scale-95"
                    )}
                    title={isDemo ? "This action is disabled in the public demo." : "Cancel invite"}
                    aria-label="Cancel invite"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-3xl bg-card p-4 shadow-soft ring-1 ring-border/60">
        <h2 className="mb-3 font-display text-base font-semibold">Team</h2>
        {(rolesQ.data ?? []).length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No team members yet.</p>
        ) : (
          <ul className="divide-y divide-border/60">
            {rolesQ.data!.map((r) => {
              const p = byUser.get(r.user_id);
              return (
                <li key={r.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="grid h-9 w-9 place-items-center rounded-full bg-secondary text-secondary-foreground">
                      <ShieldCheck className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">
                        {p?.display_name ?? (p?.email ? (isDemo ? maskEmail(p.email) : p.email) : (isDemo ? maskUserId(r.user_id) : r.user_id))}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {p?.email ? (isDemo ? maskEmail(p.email) : p.email) : "—"}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium capitalize">{r.role}</span>
                    <button
                      onClick={isDemo ? undefined : () => startEdit(r)}
                      disabled={isDemo}
                      className={cn(
                        "rounded-full p-1.5 transition",
                        isDemo 
                          ? "bg-muted text-muted-foreground border border-border cursor-not-allowed opacity-50" 
                          : "bg-secondary text-muted-foreground hover:text-foreground active:scale-95"
                      )}
                      title={isDemo ? "This action is disabled in the public demo." : "Edit role"}
                      aria-label="Edit role"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={isDemo ? undefined : () => void revoke(r)}
                      disabled={isDemo}
                      className={cn(
                        "rounded-full p-1.5 transition",
                        isDemo 
                          ? "bg-muted text-muted-foreground border border-border cursor-not-allowed opacity-50" 
                          : "bg-secondary text-muted-foreground hover:text-destructive active:scale-95"
                      )}
                      title={isDemo ? "This action is disabled in the public demo." : "Revoke"}
                      aria-label="Revoke"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {editingRole && (
        <div className="fixed inset-0 z-50 bg-background/70 backdrop-blur-sm flex justify-center items-center p-4">
          <div className="flex flex-col w-full max-w-sm bg-card rounded-3xl p-5 shadow-float ring-1 ring-border">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-display text-lg font-semibold">Edit Role</h3>
              <button
                onClick={() => setEditingRole(null)}
                className="rounded-full bg-secondary p-1.5 active:scale-95 transition"
                aria-label="Close dialog"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Change role for {editingRole && byUser.get(editingRole.user_id)?.email ? (isDemo ? maskEmail(byUser.get(editingRole.user_id)!.email) : byUser.get(editingRole.user_id)!.email) : "this user"}
            </p>
            <Select disabled={isDemo} value={newRole} onValueChange={(value) => setNewRole(value as AppRole)}>
              <SelectTrigger className="w-full rounded-2xl border border-border bg-background p-2.5 h-auto text-sm outline-none focus:ring-2 focus:ring-ring/60 mb-4">
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="staff" className="cursor-pointer">Staff</SelectItem>
                <SelectItem value="owner" className="cursor-pointer">Owner</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <button
                onClick={() => setEditingRole(null)}
                className="flex-1 rounded-full bg-secondary py-2 text-xs font-semibold hover:bg-secondary/80 transition"
              >
                Cancel
              </button>
              <button
                onClick={isDemo ? undefined : () => void saveRole(editingRole, newRole)}
                disabled={busy || isDemo}
                className={cn(
                  "flex-1 rounded-full py-2 text-xs font-semibold shadow-soft transition",
                  isDemo
                    ? "bg-muted text-muted-foreground border border-border cursor-not-allowed opacity-75"
                    : "bg-brand text-brand-foreground hover:bg-brand/90"
                )}
              >
                {isDemo ? "🔒 Save" : busy ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
