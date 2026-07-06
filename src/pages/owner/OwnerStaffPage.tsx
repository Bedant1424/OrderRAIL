import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock, ShieldCheck, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { supabase, type Cafe } from "@/lib/db";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];
type RoleRow = { id: string; user_id: string; role: AppRole; cafe_id: string | null };
import { useCafe } from "@/lib/cafe";

type Profile = { id: string; email: string | null; display_name: string | null };
type InviteRow = { id: string; email: string; role: AppRole; created_at: string };

export default function OwnerStaffPage() {
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AppRole>("staff");
  const [busy, setBusy] = useState(false);

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
    if (!confirm("Revoke this role?")) return;
    const { error } = await supabase.from("user_roles").delete().eq("id", r.id);
    if (error) return toast.error(error.message);
    void qc.invalidateQueries({ queryKey: ["owner-roles", cafeId] });
  };

  const byUser = new Map<string, Profile>();
  for (const p of profilesQ.data ?? []) byUser.set(p.id, p);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-3xl font-semibold tracking-tight">Staff</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Grant staff or owner access to your cafe. Team members must already have an account.
        </p>
      </header>

      <section className="rounded-3xl bg-card p-4 shadow-soft ring-1 ring-border/60">
        <h2 className="mb-3 flex items-center gap-2 font-display text-base font-semibold">
          <UserPlus className="h-4 w-4" /> Assign role
        </h2>
        <div className="grid gap-3 sm:grid-cols-[1fr_140px_auto]">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="teammate@cafe.com"
            className="rounded-2xl border border-border bg-background p-2.5 text-sm outline-none focus:ring-2 focus:ring-ring/60"
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as AppRole)}
            className="rounded-2xl border border-border bg-background p-2.5 text-sm outline-none focus:ring-2 focus:ring-ring/60"
          >
            <option value="staff">Staff</option>
            <option value="owner">Owner</option>
          </select>
          <button
            onClick={() => void invite()}
            disabled={busy || !email.trim()}
            className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {busy ? "Assigning…" : "Assign"}
          </button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          If they don't have an account yet, we'll save an invite and grant the role automatically the first time they sign in (email/password or Google).
        </p>
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
                  <div className="truncate text-sm font-medium">{i.email}</div>
                  <div className="text-xs text-muted-foreground">
                    Invited {new Date(i.created_at).toLocaleDateString()}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium capitalize">{i.role}</span>
                  <button
                    onClick={() => void revokeInvite(i.id)}
                    className="rounded-full bg-secondary p-1.5 text-muted-foreground hover:text-destructive"
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
                        {p?.display_name ?? p?.email ?? r.user_id.slice(0, 8)}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">{p?.email ?? "—"}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium capitalize">{r.role}</span>
                    <button
                      onClick={() => void revoke(r)}
                      className="rounded-full bg-secondary p-1.5 text-muted-foreground hover:text-destructive"
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
    </div>
  );
}
