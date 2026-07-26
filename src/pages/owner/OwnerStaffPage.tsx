import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Clock,
  ShieldCheck,
  Trash2,
  UserPlus,
  Pencil,
  X,
  Search,
  UserX,
  UserCheck,
  History,
  Mail,
  ShieldAlert,
  RotateCw,
  Send,
  CheckCircle2,
  XCircle,
  RotateCcw,
  UserMinus,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { supabase } from "@/lib/db";
import type { Database } from "@/integrations/supabase/types";
import { usePermissions, maskEmail, maskUserId } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { useCafe } from "@/lib/cafe";
import { useAuth } from "@/lib/auth";
import { logAuditEvent } from "@/lib/auditLogger";
import { GlobalNotificationControls } from "@/components/owner/GlobalNotificationControls";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type AppRole = Database["public"]["Enums"]["app_role"];
type RoleRow = { id: string; user_id: string; role: AppRole; cafe_id: string | null; is_suspended?: boolean };
type Profile = { id: string; email: string | null; display_name: string | null; created_at?: string };
type InviteRow = { id: string; email: string; role: AppRole; created_at: string };
type RejectedRow = {
  id: string;
  cafe_id: string | null;
  user_id: string;
  email: string | null;
  rejected_by: string | null;
  created_at: string;
};
type FormerStaffRow = {
  id: string;
  cafe_id: string | null;
  user_id: string;
  email: string;
  role: AppRole;
  removed_by: string | null;
  created_at: string;
};
type AuditRow = {
  id: string;
  event_type: string;
  target_email: string | null;
  actor_id: string | null;
  created_at: string;
  metadata: any;
};

export default function OwnerStaffPage() {
  const { cafe } = useCafe();
  const { user } = useAuth();
  const { isDemo } = usePermissions();
  const cafeId = cafe?.id;
  const qc = useQueryClient();

  // Form states
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AppRole>("staff");
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleRow | null>(null);
  const [newRole, setNewRole] = useState<AppRole>("staff");

  // Section-specific Search & Filter states
  const [searchQuery, setSearchQuery] = useState(""); // Active Staff
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [rejectedSearch, setRejectedSearch] = useState(""); // Rejected Applicants
  const [formerSearch, setFormerSearch] = useState(""); // Former Employees
  const [auditSearch, setAuditSearch] = useState(""); // Audit Log
  const [approvalRoles, setApprovalRoles] = useState<Record<string, AppRole>>({});

  // Audit Log Collapsible & Pagination states
  const [isAuditExpanded, setIsAuditExpanded] = useState(false);
  const [auditLimit, setAuditLimit] = useState(50);

  // 1. Fetch active user roles (including is_suspended column)
  const rolesQ = useQuery({
    queryKey: ["owner-roles", cafeId],
    enabled: !!cafeId,
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("*").eq("cafe_id", cafeId!);
      if (error) throw error;
      return (data ?? []) as RoleRow[];
    },
  });

  const userIds = useMemo(() => [...new Set((rolesQ.data ?? []).map((r) => r.user_id))], [rolesQ.data]);

  // 2. Fetch profiles for existing team members
  const profilesQ = useQuery({
    queryKey: ["owner-role-profiles", userIds.join(",")],
    enabled: userIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, email, display_name, created_at").in("id", userIds);
      if (error) throw error;
      return (data ?? []) as Profile[];
    },
  });

  // 3. Fetch pending invitations (only active: not accepted, not revoked)
  const invitesQ = useQuery({
    queryKey: ["owner-invites", cafeId],
    enabled: !!cafeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staff_invites")
        .select("id, email, role, created_at")
        .eq("cafe_id", cafeId!)
        .is("accepted_at", null)
        .is("revoked_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as InviteRow[];
    },
  });

  // 4. Fetch pending unapproved signups (atomic query excluding assigned, invited, rejected, and former staff)
  const pendingApprovalsQ = useQuery({
    queryKey: ["owner-pending-approvals", cafeId],
    enabled: !!cafeId,
    queryFn: async () => {
      const [
        { data: profiles, error: pErr },
        { data: assignedData },
        { data: invitesData },
        { data: rejectedData },
        { data: formerData },
      ] = await Promise.all([
        supabase.from("profiles").select("id, email, display_name, created_at").order("created_at", { ascending: false }),
        supabase.from("user_roles").select("user_id").eq("cafe_id", cafeId!),
        supabase.from("staff_invites").select("email").eq("cafe_id", cafeId!).is("accepted_at", null).is("revoked_at", null),
        supabase.from("rejected_approvals").select("user_id").eq("cafe_id", cafeId!),
        supabase.from("former_staff").select("user_id").eq("cafe_id", cafeId!),
      ]);

      if (pErr) throw pErr;

      const assignedIds = new Set((assignedData ?? []).map((r) => r.user_id));
      const activeInvitedEmails = new Set((invitesData ?? []).map((i) => i.email.trim().toLowerCase()));
      const rejectedUserIds = new Set((rejectedData ?? []).map((r) => r.user_id));
      const formerUserIds = new Set((formerData ?? []).map((f) => f.user_id));

      const pending = (profiles ?? []).filter(
        (p) =>
          p.email &&
          !assignedIds.has(p.id) &&
          !activeInvitedEmails.has(p.email.trim().toLowerCase()) &&
          !rejectedUserIds.has(p.id) &&
          !formerUserIds.has(p.id)
      ) as Profile[];

      return pending;
    },
  });

  // 5. Fetch rejected applicants
  const rejectedQ = useQuery({
    queryKey: ["owner-rejected", cafeId],
    enabled: !!cafeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rejected_approvals")
        .select("*")
        .eq("cafe_id", cafeId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as RejectedRow[];
    },
  });

  // 6. Fetch former employees
  const formerStaffQ = useQuery({
    queryKey: ["owner-former-staff", cafeId],
    enabled: !!cafeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("former_staff")
        .select("*")
        .eq("cafe_id", cafeId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as FormerStaffRow[];
    },
  });

  // 7. Fetch audit logs (with dynamic auditLimit)
  const auditQ = useQuery({
    queryKey: ["owner-staff-audit", cafeId, auditLimit],
    enabled: !!cafeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*")
        .eq("cafe_id", cafeId!)
        .order("created_at", { ascending: false })
        .limit(auditLimit);
      if (error) throw error;
      return (data ?? []) as AuditRow[];
    },
  });

  const byUser = useMemo(() => {
    const map = new Map<string, Profile>();
    for (const p of profilesQ.data ?? []) map.set(p.id, p);
    return map;
  }, [profilesQ.data]);

  // Active vs Suspended Team Member splitting
  const { activeTeam, suspendedTeam } = useMemo(() => {
    const all = rolesQ.data ?? [];
    const active: RoleRow[] = [];
    const suspended: RoleRow[] = [];

    for (const r of all) {
      if (r.is_suspended) {
        suspended.push(r);
      } else {
        active.push(r);
      }
    }
    return { activeTeam: active, suspendedTeam: suspended };
  }, [rolesQ.data]);

  // Section 3: Filtered Active Team
  const filteredActiveTeam = useMemo(() => {
    return activeTeam.filter((r) => {
      const p = byUser.get(r.user_id);
      const emailMatch = p?.email?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false;
      const nameMatch = p?.display_name?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false;
      const matchesSearch = searchQuery.trim() === "" || emailMatch || nameMatch || r.user_id.includes(searchQuery);
      const matchesRole = roleFilter === "all" || r.role === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [activeTeam, byUser, searchQuery, roleFilter]);

  // Section 5: Filtered Rejected Applicants
  const filteredRejected = useMemo(() => {
    const query = rejectedSearch.trim().toLowerCase();
    if (!query) return rejectedQ.data ?? [];
    return (rejectedQ.data ?? []).filter(
      (r) =>
        (r.email && r.email.toLowerCase().includes(query)) ||
        r.user_id.toLowerCase().includes(query)
    );
  }, [rejectedQ.data, rejectedSearch]);

  // Section 6: Filtered Former Employees
  const filteredFormer = useMemo(() => {
    const query = formerSearch.trim().toLowerCase();
    if (!query) return formerStaffQ.data ?? [];
    return (formerStaffQ.data ?? []).filter(
      (fs) =>
        fs.email.toLowerCase().includes(query) ||
        fs.user_id.toLowerCase().includes(query) ||
        fs.role.toLowerCase().includes(query)
    );
  }, [formerStaffQ.data, formerSearch]);

  // Section 7: Filtered Audit Log
  const filteredAudit = useMemo(() => {
    const query = auditSearch.trim().toLowerCase();
    if (!query) return auditQ.data ?? [];
    return (auditQ.data ?? []).filter(
      (log) =>
        log.event_type.toLowerCase().includes(query) ||
        (log.target_email && log.target_email.toLowerCase().includes(query)) ||
        JSON.stringify(log.metadata).toLowerCase().includes(query)
    );
  }, [auditQ.data, auditSearch]);

  // Refresh entire registry with explicit refetch completion
  const refreshRegistry = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        qc.refetchQueries({ queryKey: ["owner-roles", cafeId] }),
        qc.refetchQueries({ queryKey: ["owner-role-profiles"] }),
        qc.refetchQueries({ queryKey: ["owner-invites", cafeId] }),
        qc.refetchQueries({ queryKey: ["owner-pending-approvals", cafeId] }),
        qc.refetchQueries({ queryKey: ["owner-rejected", cafeId] }),
        qc.refetchQueries({ queryKey: ["owner-former-staff", cafeId] }),
        qc.refetchQueries({ queryKey: ["owner-staff-audit", cafeId] }),
      ]);
    } catch (e) {
      console.error("refreshRegistry refetch error:", e);
    } finally {
      setRefreshing(false);
    }
  };

  // Send invitation with duplicate checks & Invitation Override
  const invite = async () => {
    if (!cafeId || !email.trim()) return;
    const targetEmail = email.trim().toLowerCase();

    const isAlreadyInvited = (invitesQ.data ?? []).some((i) => i.email.toLowerCase() === targetEmail);
    if (isAlreadyInvited) {
      return toast.error(`An invitation is already pending for ${targetEmail}. Use Resend instead.`);
    }

    const isAlreadyMember = Array.from(byUser.values()).some((p) => p.email?.toLowerCase() === targetEmail);
    if (isAlreadyMember) {
      return toast.error(`${targetEmail} is already an active team member.`);
    }

    setBusy(true);
    const { data, error } = await supabase.rpc("assign_role_by_email", {
      _cafe_id: cafeId,
      _email: targetEmail,
      _role: role,
    });
    setBusy(false);

    if (error) return toast.error(`Invitation failed: ${error.message}`);

    void logAuditEvent({
      cafeId,
      actorId: user?.id,
      eventType: "INVITATION_CREATED",
      targetEmail,
      metadata: { role },
    });

    if (data === "invited") {
      toast.success(`Invitation sent to ${targetEmail} — assigned '${role}' access upon sign in.`);
    } else {
      toast.success(`Assigned ${role} role to ${targetEmail}`);
    }

    setEmail("");
    await refreshRegistry();
  };

  // Resend pending invitation
  const resendInvite = async (inv: InviteRow) => {
    setBusy(true);
    const { error } = await supabase
      .from("staff_invites")
      .update({ created_at: new Date().toISOString() })
      .eq("id", inv.id);
    setBusy(false);

    if (error) return toast.error(`Resend failed: ${error.message}`);

    void logAuditEvent({
      cafeId,
      actorId: user?.id,
      eventType: "INVITATION_RESENT",
      targetEmail: inv.email,
      metadata: { role: inv.role },
    });

    toast.success(`Invitation resent to ${inv.email}.`);
    await refreshRegistry();
  };

  // Revoke pending invitation
  const revokeInvite = async (inv: InviteRow) => {
    if (!confirm(`Cancel pending invite for ${inv.email}?`)) return;
    setBusy(true);
    const { error } = await supabase
      .from("staff_invites")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", inv.id);
    setBusy(false);

    if (error) return toast.error(`Revoke failed: ${error.message}`);

    void logAuditEvent({
      cafeId,
      actorId: user?.id,
      eventType: "INVITATION_REVOKED",
      targetEmail: inv.email,
      metadata: { role: inv.role },
    });

    toast.success("Invitation cancelled.");
    await refreshRegistry();
  };

  // Approve Pending User Registration
  const approveUser = async (profile: Profile) => {
    if (!cafeId || !profile.email) return;
    const selectedRole = approvalRoles[profile.id] ?? "staff";

    setBusy(true);
    const { error } = await supabase.from("user_roles").insert({
      user_id: profile.id,
      cafe_id: cafeId,
      role: selectedRole,
      is_suspended: false,
    });

    if (error) {
      setBusy(false);
      return toast.error(`Approval failed: ${error.message}`);
    }

    await supabase.from("rejected_approvals").delete().eq("cafe_id", cafeId).eq("user_id", profile.id);
    await supabase.from("former_staff").delete().eq("cafe_id", cafeId).eq("user_id", profile.id);

    void logAuditEvent({
      cafeId,
      actorId: user?.id,
      eventType: "APPROVAL_GRANTED",
      targetEmail: profile.email,
      metadata: { role: selectedRole, userId: profile.id },
    });

    await refreshRegistry();
    setBusy(false);
    toast.success(`Approval granted for ${profile.email} as '${selectedRole}'.`);
  };

  // Reject Pending User Registration
  const rejectUser = async (profile: Profile) => {
    if (!cafeId || !profile.email) return;
    if (!confirm(`Reject registration request for ${profile.email}?`)) return;

    setBusy(true);
    const { error } = await supabase.from("rejected_approvals").insert({
      cafe_id: cafeId,
      user_id: profile.id,
      email: profile.email,
      rejected_by: user?.id,
    });

    if (error && !error.message.includes("duplicate")) {
      setBusy(false);
      return toast.error(`Rejection failed: ${error.message}`);
    }

    await supabase.from("former_staff").delete().eq("cafe_id", cafeId).eq("user_id", profile.id);

    void logAuditEvent({
      cafeId,
      actorId: user?.id,
      eventType: "APPROVAL_REJECTED",
      targetEmail: profile.email,
      metadata: { userId: profile.id },
    });

    await refreshRegistry();
    setBusy(false);
    toast.info(`Registration request for ${profile.email} rejected.`);
  };

  // Reconsider Rejected Applicant
  const reconsiderApplicant = async (rej: RejectedRow) => {
    if (!cafeId) return;
    const targetEmail = rej.email ?? rej.user_id;
    if (!confirm(`Reconsider registration request for ${targetEmail}? This moves the applicant back to Pending Approvals.`)) return;

    setBusy(true);
    const { error } = await supabase.from("rejected_approvals").delete().eq("id", rej.id);
    setBusy(false);

    if (error) return toast.error(`Reconsideration failed: ${error.message}`);

    void logAuditEvent({
      cafeId,
      actorId: user?.id,
      eventType: "APPLICANT_RECONSIDERED",
      targetEmail,
      metadata: { userId: rej.user_id },
    });

    toast.success(`Reconsidered ${targetEmail} — moved back to Pending Approvals.`);
    await refreshRegistry();
  };

  // Remove staff role completely
  const removeStaffRole = async (r: RoleRow) => {
    const p = byUser.get(r.user_id);
    const memberEmail = p?.email ?? r.user_id;

    if (r.role === "owner") {
      const ownerCount = (rolesQ.data ?? []).filter((x) => x.role === "owner" && !x.is_suspended).length;
      if (ownerCount <= 1) {
        return toast.error("Cannot remove the last owner. There must be at least one active owner.");
      }
    }
    if (!confirm(`Remove staff role for ${memberEmail}? This transitions the user to Former Employees.`)) return;

    setBusy(true);

    const { error: delErr } = await supabase.from("user_roles").delete().eq("id", r.id);

    if (delErr) {
      setBusy(false);
      return toast.error(`Removal failed: ${delErr.message}`);
    }

    if (memberEmail) {
      await supabase.from("former_staff").upsert({
        cafe_id: cafeId!,
        user_id: r.user_id,
        email: memberEmail,
        role: r.role,
        removed_by: user?.id ?? null,
      });
    }

    void logAuditEvent({
      cafeId,
      actorId: user?.id,
      eventType: "STAFF_REMOVED",
      targetEmail: memberEmail,
      metadata: { role: r.role, userId: r.user_id },
    });

    await refreshRegistry();
    setBusy(false);
    toast.success(`Staff member access removed. ${memberEmail} moved to Former Employees.`);
  };

  // Invite Former Employee Again
  const inviteAgainFormerStaff = async (fs: FormerStaffRow) => {
    if (!cafeId || !fs.email) return;

    setBusy(true);
    const { data, error } = await supabase.rpc("assign_role_by_email", {
      _cafe_id: cafeId,
      _email: fs.email,
      _role: fs.role,
    });
    setBusy(false);

    if (error) return toast.error(`Invitation failed: ${error.message}`);

    void logAuditEvent({
      cafeId,
      actorId: user?.id,
      eventType: "INVITATION_CREATED",
      targetEmail: fs.email,
      metadata: { role: fs.role, source: "invite_again_former_staff" },
    });

    toast.success(`Invitation sent to former employee ${fs.email} — assigned '${fs.role}' access upon sign in.`);
    await refreshRegistry();
  };

  // Toggle staff suspension
  const toggleSuspend = async (r: RoleRow) => {
    const p = byUser.get(r.user_id);
    const memberEmail = p?.email ?? r.user_id;
    const isCurrentlySuspended = !!r.is_suspended;

    if (r.role === "owner" && !isCurrentlySuspended) {
      const ownerCount = (rolesQ.data ?? []).filter((x) => x.role === "owner" && !x.is_suspended).length;
      if (ownerCount <= 1) {
        return toast.error("Cannot suspend the last active owner.");
      }
    }

    const nextState = !isCurrentlySuspended;
    setBusy(true);
    const { error } = await supabase
      .from("user_roles")
      .update({ is_suspended: nextState })
      .eq("id", r.id);

    if (error) {
      setBusy(false);
      return toast.error(`Suspension update failed: ${error.message}`);
    }

    void logAuditEvent({
      cafeId,
      actorId: user?.id,
      eventType: nextState ? "STAFF_SUSPENDED" : "STAFF_REACTIVATED",
      targetEmail: memberEmail,
      metadata: { role: r.role, userId: r.user_id },
    });

    await refreshRegistry();
    setBusy(false);
    toast.success(nextState ? `Suspended access for ${memberEmail}` : `Reactivated access for ${memberEmail}`);
  };

  // Edit staff role
  const saveRole = async (r: RoleRow, targetRole: AppRole) => {
    if (targetRole !== "staff" && targetRole !== "counter" && targetRole !== "owner") {
      return toast.error("Invalid role value.");
    }

    if (r.role === "owner" && targetRole !== "owner") {
      const ownerCount = (rolesQ.data ?? []).filter((x) => x.role === "owner" && !x.is_suspended).length;
      if (ownerCount <= 1) {
        return toast.error("Cannot demote the last owner. There must be at least one active owner.");
      }
    }

    setBusy(true);
    const { error } = await supabase.from("user_roles").update({ role: targetRole }).eq("id", r.id);

    if (error) {
      setBusy(false);
      toast.error(`Role update failed: ${error.message}`);
    } else {
      const p = byUser.get(r.user_id);
      void logAuditEvent({
        cafeId,
        actorId: user?.id,
        eventType: "ROLE_CHANGED",
        targetEmail: p?.email ?? r.user_id,
        metadata: { oldRole: r.role, newRole: targetRole },
      });

      await refreshRegistry();
      setBusy(false);
      toast.success("Role updated successfully.");
      setEditingRole(null);
    }
  };

  const initialLoading =
    rolesQ.isLoading ||
    profilesQ.isLoading ||
    invitesQ.isLoading ||
    pendingApprovalsQ.isLoading ||
    rejectedQ.isLoading ||
    formerStaffQ.isLoading;

  if (initialLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-24 gap-3 text-muted-foreground">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
        <span className="text-sm font-medium">Loading staff registry…</span>
      </div>
    );
  }

  const pendingApprovals = pendingApprovalsQ.data ?? [];
  const pendingInvitesList = invitesQ.data ?? [];
  const rejectedApplicants = filteredRejected;
  const formerEmployees = filteredFormer;

  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-display text-3xl font-semibold tracking-tight">Staff Management</h1>
            <button
              onClick={() => void refreshRegistry()}
              disabled={refreshing}
              className="grid h-9 w-9 place-items-center rounded-full border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-secondary transition active:scale-95 shrink-0"
              title="Refresh Registry"
            >
              <RotateCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
            </button>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage applicant onboarding, active staff, suspensions, former employees, and staff audit trail.
          </p>
        </div>
        <GlobalNotificationControls />
      </header>

      {/* SECTION 1: Pending Account Approvals (Max height: 350px) */}
      <section className="rounded-3xl bg-amber-500/5 border border-amber-500/20 p-6 shadow-soft">
        <div className="sticky top-0 z-10 bg-amber-500/5 pb-3 mb-1 flex items-center justify-between border-b border-amber-500/15">
          <div>
            <h2 className="flex items-center gap-2 font-display text-base font-semibold text-amber-900 dark:text-amber-300">
              <Clock className="h-5 w-5 text-amber-500" /> 1. Pending Account Approvals ({pendingApprovals.length})
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              These authenticated applicants signed up but have not yet been approved or assigned a role.
            </p>
          </div>
          {pendingApprovalsQ.isFetching && (
            <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 font-medium shrink-0">
              <RotateCw className="h-3.5 w-3.5 animate-spin" /> Updating…
            </div>
          )}
        </div>

        {pendingApprovals.length === 0 ? (
          <div className="mt-4 rounded-2xl bg-background/50 border border-amber-500/10 p-6 text-center text-xs text-muted-foreground font-medium flex items-center justify-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
            <span>No pending approvals. All signed-up applicants have assigned roles or status.</span>
          </div>
        ) : (
          <div className="max-h-[350px] section-scroll pr-1 mt-2">
            <ul className="divide-y divide-amber-500/20">
              {pendingApprovals.map((p) => (
                <li key={p.id} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between py-3.5">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="grid h-10 w-10 place-items-center rounded-2xl bg-amber-500/15 text-amber-600 shrink-0">
                      <Clock className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{isDemo ? maskEmail(p.email ?? "") : p.email}</div>
                      <div className="text-xs text-muted-foreground">
                        Signed up {p.created_at ? new Date(p.created_at).toLocaleDateString() : "Recently"} • Provider: OAuth / Email
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <select
                      value={approvalRoles[p.id] ?? "staff"}
                      onChange={(e) => setApprovalRoles((prev) => ({ ...prev, [p.id]: e.target.value as AppRole }))}
                      className="rounded-2xl border border-border bg-background p-2 text-xs outline-none focus:ring-2 focus:ring-ring/60"
                    >
                      <option value="staff">Staff</option>
                      <option value="counter">Counter</option>
                      <option value="owner">Owner</option>
                    </select>

                    <button
                      onClick={isDemo ? undefined : () => void approveUser(p)}
                      disabled={busy || isDemo}
                      className={cn(
                        "flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold shadow-soft transition",
                        isDemo
                          ? "bg-muted text-muted-foreground cursor-not-allowed opacity-50"
                          : "bg-emerald-600 text-white hover:bg-emerald-700 active:scale-95"
                      )}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                    </button>

                    <button
                      onClick={isDemo ? undefined : () => void rejectUser(p)}
                      disabled={busy || isDemo}
                      className={cn(
                        "flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold transition",
                        isDemo
                          ? "bg-muted text-muted-foreground cursor-not-allowed opacity-50"
                          : "bg-secondary text-muted-foreground hover:text-destructive active:scale-95"
                      )}
                    >
                      <XCircle className="h-3.5 w-3.5" /> Reject
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* SECTION 2: Invite Form & Pending Invitations (Max height: 250px) */}
      <section className="rounded-3xl bg-card p-6 shadow-soft ring-1 ring-border/60 space-y-6">
        <div>
          <h2 className="mb-3 flex items-center gap-2 font-display text-base font-semibold">
            <UserPlus className="h-4 w-4 text-brand" /> 2. Send Team Invitation
          </h2>
          <div className="grid gap-3 sm:grid-cols-[1fr_140px_auto]">
            <input
              type="email"
              value={email}
              disabled={isDemo}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={isDemo ? "Invitations disabled in demo" : "teammate@cafe.com"}
              className="rounded-2xl border border-border bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-ring/60 disabled:opacity-60 disabled:bg-muted/35 disabled:cursor-not-allowed"
            />
            <select
              value={role}
              disabled={isDemo}
              onChange={(e) => setRole(e.target.value as AppRole)}
              className="rounded-2xl border border-border bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-ring/60 disabled:opacity-60 disabled:bg-muted/35 disabled:cursor-not-allowed"
            >
              <option value="staff">Staff</option>
              <option value="counter">Counter</option>
              <option value="owner">Owner</option>
            </select>
            <button
              onClick={isDemo ? undefined : () => void invite()}
              disabled={busy || !email.trim() || isDemo}
              className={cn(
                "rounded-full px-6 py-3 text-sm font-semibold transition flex items-center justify-center gap-2",
                isDemo
                  ? "bg-muted text-muted-foreground border border-border cursor-not-allowed opacity-75"
                  : "btn-primary-action"
              )}
              title={isDemo ? "Disabled in public demo." : "Send invitation"}
            >
              {isDemo ? "🔒 Disabled" : busy ? "Sending..." : <> <Send className="h-4 w-4" /> Send Invite </>}
            </button>
          </div>
          {!isDemo && (
            <p className="mt-3 text-xs text-muted-foreground">
              Invited staff members receive access automatically upon signing in. Invitations override prior rejected or former staff states.
            </p>
          )}
        </div>

        {pendingInvitesList.length > 0 && (
          <div className="border-t border-border/60 pt-5">
            <div className="sticky top-0 z-10 bg-card pb-2 mb-1 flex items-center justify-between">
              <h3 className="flex items-center gap-2 font-display text-sm font-semibold text-muted-foreground">
                <Mail className="h-4 w-4" /> Pending Invitations ({pendingInvitesList.length})
              </h3>
            </div>

            <div className="max-h-[250px] section-scroll pr-1">
              <ul className="divide-y divide-border/60">
                {pendingInvitesList.map((inv) => (
                  <li key={inv.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="grid h-9 w-9 place-items-center rounded-xl bg-amber-500/10 text-amber-600 shrink-0">
                        <Mail className="h-4.5 w-4.5" />
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{isDemo ? maskEmail(inv.email) : inv.email}</div>
                        <div className="text-xs text-muted-foreground">
                          Invited {new Date(inv.created_at).toLocaleDateString()} • Role: <span className="capitalize font-semibold text-foreground">{inv.role}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 px-3 py-1 text-xs font-semibold">
                        Pending
                      </span>

                      <button
                        onClick={isDemo ? undefined : () => void resendInvite(inv)}
                        disabled={isDemo || busy}
                        className={cn(
                          "rounded-full p-2 transition",
                          isDemo
                            ? "bg-muted text-muted-foreground cursor-not-allowed opacity-50"
                            : "bg-secondary text-muted-foreground hover:text-foreground active:scale-95"
                        )}
                        title={isDemo ? "Disabled in demo." : "Resend Invitation"}
                      >
                        <Send className="h-4 w-4" />
                      </button>

                      <button
                        onClick={isDemo ? undefined : () => void revokeInvite(inv)}
                        disabled={isDemo || busy}
                        className={cn(
                          "rounded-full p-2 transition",
                          isDemo
                            ? "bg-muted text-muted-foreground cursor-not-allowed opacity-50"
                            : "bg-secondary text-muted-foreground hover:text-destructive active:scale-95"
                        )}
                        title={isDemo ? "Disabled in demo." : "Revoke Invitation"}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </section>

      {/* SECTION 3: Active Staff Members (Max height: 450px) */}
      <section className="rounded-3xl bg-card p-6 shadow-soft ring-1 ring-border/60">
        <div className="sticky top-0 z-10 bg-card pb-3 mb-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border/40">
          <h2 className="flex items-center gap-2 font-display text-base font-semibold">
            <ShieldCheck className="h-5 w-5 text-emerald-500" /> 3. Active Staff ({filteredActiveTeam.length} / {activeTeam.length})
          </h2>
          
          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search active staff..."
                className="w-full rounded-2xl border border-border bg-background py-2 pl-8 pr-3 text-xs outline-none focus:ring-2 focus:ring-ring/60"
              />
            </div>

            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="rounded-2xl border border-border bg-background p-2 text-xs outline-none focus:ring-2 focus:ring-ring/60"
            >
              <option value="all">All Roles</option>
              <option value="staff">Staff</option>
              <option value="counter">Counter</option>
              <option value="owner">Owner</option>
            </select>
          </div>
        </div>

        {filteredActiveTeam.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">No active team members match your criteria.</p>
        ) : (
          <div className="max-h-[450px] section-scroll pr-1">
            <ul className="divide-y divide-border/60">
              {filteredActiveTeam.map((r) => {
                const p = byUser.get(r.user_id);
                return (
                  <li key={r.id} className="flex items-center justify-between gap-3 py-3.5">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="grid h-10 w-10 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-600 shrink-0">
                        <ShieldCheck className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-semibold">
                            {p?.display_name ?? (p?.email ? (isDemo ? maskEmail(p.email) : p.email) : (isDemo ? maskUserId(r.user_id) : r.user_id))}
                          </span>
                        </div>
                        <div className="truncate text-xs text-muted-foreground">
                          {p?.email ? (isDemo ? maskEmail(p.email) : p.email) : "No email linked"}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold capitalize">
                        {r.role}
                      </span>

                      <button
                        onClick={isDemo ? undefined : () => { setEditingRole(r); setNewRole(r.role); }}
                        disabled={isDemo}
                        className={cn(
                          "rounded-full p-2 transition",
                          isDemo
                            ? "bg-muted text-muted-foreground cursor-not-allowed opacity-50"
                            : "bg-secondary text-muted-foreground hover:text-foreground active:scale-95"
                        )}
                        title={isDemo ? "Disabled in demo." : "Edit Role"}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>

                      <button
                        onClick={isDemo ? undefined : () => void toggleSuspend(r)}
                        disabled={isDemo || busy}
                        className={cn(
                          "rounded-full p-2 transition bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 active:scale-95",
                          isDemo && "bg-muted text-muted-foreground cursor-not-allowed opacity-50"
                        )}
                        title={isDemo ? "Disabled in demo." : "Suspend Access"}
                      >
                        <UserX className="h-4 w-4" />
                      </button>

                      <button
                        onClick={isDemo ? undefined : () => void removeStaffRole(r)}
                        disabled={isDemo || busy}
                        className={cn(
                          "rounded-full p-2 transition bg-secondary text-muted-foreground hover:text-destructive active:scale-95",
                          isDemo && "bg-muted text-muted-foreground cursor-not-allowed opacity-50"
                        )}
                        title={isDemo ? "Disabled in demo." : "Remove Access (Move to Former Staff)"}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>

      {/* SECTION 4: Suspended Staff Members (Max height: 300px) */}
      {suspendedTeam.length > 0 && (
        <section className="rounded-3xl bg-destructive/5 border border-destructive/20 p-6 shadow-soft">
          <div className="sticky top-0 z-10 bg-destructive/5 pb-3 mb-2 border-b border-destructive/15">
            <h2 className="flex items-center gap-2 font-display text-base font-semibold text-destructive">
              <ShieldAlert className="h-5 w-5" /> 4. Suspended Staff ({suspendedTeam.length})
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Suspended employees retain their role assignment but are blocked from accessing cafe operations until reactivated.
            </p>
          </div>

          <div className="max-h-[300px] section-scroll pr-1 mt-2">
            <ul className="divide-y divide-destructive/15">
              {suspendedTeam.map((r) => {
                const p = byUser.get(r.user_id);
                return (
                  <li key={r.id} className="flex items-center justify-between gap-3 py-3.5">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="grid h-10 w-10 place-items-center rounded-2xl bg-destructive/15 text-destructive shrink-0">
                        <ShieldAlert className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-semibold">
                            {p?.display_name ?? (p?.email ? (isDemo ? maskEmail(p.email) : p.email) : (isDemo ? maskUserId(r.user_id) : r.user_id))}
                          </span>
                          <span className="rounded-full bg-destructive/10 text-destructive border border-destructive/20 px-2 py-0.5 text-[10px] font-bold">
                            SUSPENDED
                          </span>
                        </div>
                        <div className="truncate text-xs text-muted-foreground">
                          {p?.email ? (isDemo ? maskEmail(p.email) : p.email) : "No email linked"}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={isDemo ? undefined : () => void toggleSuspend(r)}
                        disabled={isDemo || busy}
                        className={cn(
                          "flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold shadow-soft transition",
                          isDemo
                            ? "bg-muted text-muted-foreground cursor-not-allowed opacity-50"
                            : "bg-emerald-600 text-white hover:bg-emerald-700 active:scale-95"
                        )}
                      >
                        <UserCheck className="h-3.5 w-3.5" /> Reactivate
                      </button>

                      <button
                        onClick={isDemo ? undefined : () => void removeStaffRole(r)}
                        disabled={isDemo || busy}
                        className={cn(
                          "rounded-full p-2 transition bg-secondary text-muted-foreground hover:text-destructive active:scale-95",
                          isDemo && "bg-muted text-muted-foreground cursor-not-allowed opacity-50"
                        )}
                        title={isDemo ? "Disabled in demo." : "Remove Access (Move to Former Staff)"}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      )}

      {/* SECTION 5: Rejected Applicants (Max height: 350px with Search) */}
      <section className="rounded-3xl bg-card p-6 shadow-soft ring-1 ring-border/60">
        <div className="sticky top-0 z-10 bg-card pb-3 mb-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border/40">
          <div>
            <h2 className="flex items-center gap-2 font-display text-base font-semibold">
              <XCircle className="h-5 w-5 text-destructive" /> 5. Rejected Applicants ({rejectedApplicants.length} / {(rejectedQ.data ?? []).length})
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Applicants whose registration requests were rejected. Reconsidering an applicant returns them to Pending Approvals.
            </p>
          </div>

          <div className="relative sm:w-64 shrink-0">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={rejectedSearch}
              onChange={(e) => setRejectedSearch(e.target.value)}
              placeholder="Search rejected..."
              className="w-full rounded-2xl border border-border bg-background py-2 pl-8 pr-3 text-xs outline-none focus:ring-2 focus:ring-ring/60"
            />
          </div>
        </div>

        {rejectedApplicants.length === 0 ? (
          <div className="rounded-2xl bg-muted/20 border border-border/40 p-6 text-center text-xs text-muted-foreground font-medium">
            {rejectedSearch.trim() ? "No rejected applicants match your search." : "No rejected applicants recorded."}
          </div>
        ) : (
          <div className="max-h-[350px] section-scroll pr-1">
            <ul className="divide-y divide-border/60">
              {rejectedApplicants.map((rej) => {
                const displayEmail = rej.email ?? rej.user_id;
                return (
                  <li key={rej.id} className="flex items-center justify-between gap-3 py-3.5">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="grid h-10 w-10 place-items-center rounded-2xl bg-destructive/10 text-destructive shrink-0">
                        <XCircle className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold">{isDemo ? maskEmail(displayEmail) : displayEmail}</div>
                        <div className="text-xs text-muted-foreground">
                          Rejected {new Date(rej.created_at).toLocaleDateString()} • Status: <span className="font-semibold text-destructive">Rejected</span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={isDemo ? undefined : () => void reconsiderApplicant(rej)}
                      disabled={isDemo || busy}
                      className={cn(
                        "flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold border border-border bg-background hover:bg-secondary transition active:scale-95 shrink-0",
                        isDemo && "bg-muted text-muted-foreground cursor-not-allowed opacity-50"
                      )}
                    >
                      <RotateCcw className="h-3.5 w-3.5 text-brand" /> Reconsider
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>

      {/* SECTION 6: Former Employees (Max height: 300px with Search) */}
      <section className="rounded-3xl bg-card p-6 shadow-soft ring-1 ring-border/60">
        <div className="sticky top-0 z-10 bg-card pb-3 mb-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border/40">
          <div>
            <h2 className="flex items-center gap-2 font-display text-base font-semibold">
              <UserMinus className="h-5 w-5 text-muted-foreground" /> 6. Former Employees ({formerEmployees.length} / {(formerStaffQ.data ?? []).length})
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Past team members whose access was removed. Inviting a former employee again sends a new invitation overriding prior status.
            </p>
          </div>

          <div className="relative sm:w-64 shrink-0">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={formerSearch}
              onChange={(e) => setFormerSearch(e.target.value)}
              placeholder="Search former staff..."
              className="w-full rounded-2xl border border-border bg-background py-2 pl-8 pr-3 text-xs outline-none focus:ring-2 focus:ring-ring/60"
            />
          </div>
        </div>

        {formerEmployees.length === 0 ? (
          <div className="rounded-2xl bg-muted/20 border border-border/40 p-6 text-center text-xs text-muted-foreground font-medium">
            {formerSearch.trim() ? "No former employees match your search." : "No former employees recorded."}
          </div>
        ) : (
          <div className="max-h-[300px] section-scroll pr-1">
            <ul className="divide-y divide-border/60">
              {formerEmployees.map((fs) => (
                <li key={fs.id} className="flex items-center justify-between gap-3 py-3.5">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="grid h-10 w-10 place-items-center rounded-2xl bg-muted text-muted-foreground shrink-0">
                      <UserMinus className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{isDemo ? maskEmail(fs.email) : fs.email}</div>
                      <div className="text-xs text-muted-foreground">
                        Previous Role: <span className="capitalize font-semibold text-foreground">{fs.role}</span> • Removed {new Date(fs.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={isDemo ? undefined : () => void inviteAgainFormerStaff(fs)}
                    disabled={isDemo || busy}
                    className={cn(
                      "flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold shadow-soft transition btn-primary-action shrink-0",
                      isDemo && "bg-muted text-muted-foreground cursor-not-allowed opacity-50"
                    )}
                  >
                    <Send className="h-3.5 w-3.5" /> Invite Again
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* SECTION 7: Staff Management Audit Log (Collapsible, Max height: 400px with Search & Load More) */}
      <section className="rounded-3xl bg-card p-6 shadow-soft ring-1 ring-border/60">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <h2 className="flex items-center gap-2 font-display text-base font-semibold">
              <History className="h-4 w-4" /> 7. Staff Management Audit Log ({(auditQ.data ?? []).length})
            </h2>
            <button
              onClick={() => setIsAuditExpanded((prev) => !prev)}
              className="flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold hover:bg-secondary/80 transition active:scale-95"
            >
              {isAuditExpanded ? (
                <>
                  <ChevronUp className="h-3.5 w-3.5" /> Collapse Log
                </>
              ) : (
                <>
                  <ChevronDown className="h-3.5 w-3.5" /> Expand Log
                </>
              )}
            </button>
          </div>

          {isAuditExpanded && (
            <div className="relative sm:w-64 shrink-0">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={auditSearch}
                onChange={(e) => setAuditSearch(e.target.value)}
                placeholder="Search audit trail..."
                className="w-full rounded-2xl border border-border bg-background py-2 pl-8 pr-3 text-xs outline-none focus:ring-2 focus:ring-ring/60"
              />
            </div>
          )}
        </div>

        {isAuditExpanded && (
          <div className="mt-4 border-t border-border/40 pt-4">
            {filteredAudit.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">
                {auditSearch.trim() ? "No audit entries match your search." : "No audit entries recorded yet."}
              </p>
            ) : (
              <div className="max-h-[400px] section-scroll pr-1 space-y-2">
                {filteredAudit.map((log) => (
                  <div key={log.id} className="flex items-center justify-between rounded-2xl bg-muted/30 p-3 text-xs">
                    <div className="min-w-0 space-y-0.5">
                      <div className="font-semibold text-foreground">
                        {log.event_type.replace(/_/g, " ")} — <span className="font-normal text-muted-foreground">{log.target_email ?? "System"}</span>
                      </div>
                      {log.metadata && (
                        <div className="text-[11px] text-muted-foreground truncate">
                          {JSON.stringify(log.metadata)}
                        </div>
                      )}
                    </div>
                    <div className="text-[11px] text-muted-foreground shrink-0 pl-3">
                      {new Date(log.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                ))}

                {(auditQ.data ?? []).length >= auditLimit && (
                  <div className="pt-2 text-center">
                    <button
                      onClick={() => setAuditLimit((prev) => prev + 50)}
                      disabled={auditQ.isFetching}
                      className="rounded-full bg-secondary px-4 py-2 text-xs font-semibold hover:bg-secondary/80 transition active:scale-95"
                    >
                      {auditQ.isFetching ? "Loading..." : "Load 50 More Entries"}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Edit Role Modal */}
      {editingRole && (
        <div className="fixed inset-0 z-50 bg-background/70 backdrop-blur-sm flex justify-center items-center p-4">
          <div className="flex flex-col w-full max-w-sm bg-card rounded-3xl p-6 shadow-float ring-1 ring-border">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-display text-lg font-semibold">Edit Staff Role</h3>
              <button
                onClick={() => setEditingRole(null)}
                className="rounded-full bg-secondary p-2 active:scale-95 transition"
                aria-label="Close dialog"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              Select new role for {byUser.get(editingRole.user_id)?.email ?? editingRole.user_id}:
            </p>
            <Select disabled={isDemo} value={newRole} onValueChange={(val) => setNewRole(val as AppRole)}>
              <SelectTrigger className="w-full rounded-2xl border border-border bg-background p-3 h-auto text-sm outline-none focus:ring-2 focus:ring-ring/60 mb-6">
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="staff" className="cursor-pointer">Staff</SelectItem>
                <SelectItem value="counter" className="cursor-pointer">Counter</SelectItem>
                <SelectItem value="owner" className="cursor-pointer">Owner</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex gap-3">
              <button
                onClick={() => setEditingRole(null)}
                className="flex-1 rounded-full bg-secondary py-3 text-xs font-semibold hover:bg-secondary/80 transition"
              >
                Cancel
              </button>
              <button
                onClick={isDemo ? undefined : () => void saveRole(editingRole, newRole)}
                disabled={busy || isDemo}
                className={cn(
                  "flex-1 rounded-full py-3 text-xs font-semibold shadow-soft transition",
                  isDemo
                    ? "bg-muted text-muted-foreground border border-border cursor-not-allowed opacity-75"
                    : "btn-primary-action"
                )}
              >
                {isDemo ? "🔒 Save" : busy ? "Saving..." : "Save Role"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
