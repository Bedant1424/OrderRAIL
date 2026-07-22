import { createContext, useContext, useEffect, useState, useRef, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { logAuditEvent } from "@/lib/auditLogger";

export type AppRole = Database["public"]["Enums"]["app_role"];

export type UserRoleEntry = {
  role: AppRole;
  cafe_id: string | null;
  is_suspended?: boolean;
};

type AuthCtx = {
  session: Session | null;
  user: User | null;
  roles: UserRoleEntry[];
  isSuspended: boolean;
  loading: boolean;
  refreshRoles: () => Promise<void>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<UserRoleEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUid, setLastUid] = useState<string | null>(null);
  const activePromiseRef = useRef<{ uid: string; promise: Promise<void> } | null>(null);

  const loadRoles = async (uid: string | undefined, force = false, silent = false) => {
    if (!uid) {
      setRoles([]);
      setLastUid(null);
      setLoading(false);
      activePromiseRef.current = null;
      return;
    }
    
    if (uid === lastUid && !loading && !force && !silent) {
      return;
    }

    if (activePromiseRef.current && activePromiseRef.current.uid === uid) {
      return activePromiseRef.current.promise;
    }

    const isNewUser = uid !== lastUid;
    
    if ((isNewUser || loading) && !silent) {
      setLoading(true);
    }
    setLastUid(uid);

    const promise = (async () => {
      try {
        const { data, error } = await supabase
          .from("user_roles")
          .select("role, cafe_id, is_suspended")
          .eq("user_id", uid);

        let fetchedRoles = (data ?? []) as UserRoleEntry[];

        // If user currently has 0 assigned roles, check for pending invitation by normalized email
        if (fetchedRoles.length === 0) {
          const { data: userData } = await supabase.auth.getUser();
          const rawEmail = userData?.user?.email;
          const userEmail = rawEmail ? rawEmail.trim().toLowerCase() : null;

          console.log("[Onboarding Debug] Authenticated email for auto-claim check:", userEmail);
          
          if (userEmail) {
            const { data: invites, error: invErr } = await supabase
              .from("staff_invites")
              .select("id, cafe_id, role, email, accepted_at, revoked_at")
              .eq("email", userEmail)
              .is("accepted_at", null)
              .is("revoked_at", null);

            console.log("[Onboarding Debug] Invitation lookup result:", { invites, error: invErr });

            if (invites && invites.length > 0) {
              const pendingInvite = invites[0];
              
              // 1. Grant the user role in database (idempotent — trigger may have already claimed)
              const { error: insertErr } = await supabase.from("user_roles").insert({
                user_id: uid,
                cafe_id: pendingInvite.cafe_id,
                role: pendingInvite.role,
                is_suspended: false,
              });

              // If duplicate key (trigger already claimed), treat as success
              const isDuplicate = insertErr?.message?.includes("duplicate") || insertErr?.code === "23505";
              console.log("[Onboarding Debug] Role creation result:", { insertErr, isDuplicate, role: pendingInvite.role });

              if (!insertErr || isDuplicate) {
                // 2. Mark invitation as accepted (immutable — no physical deletion)
                await supabase
                  .from("staff_invites")
                  .update({ accepted_at: new Date().toISOString() })
                  .eq("id", pendingInvite.id)
                  .is("accepted_at", null); // Only update if not already accepted by trigger

                // 3. Record audit event (only if we were the ones who inserted the role)
                if (!insertErr) {
                  void logAuditEvent({
                    cafeId: pendingInvite.cafe_id,
                    actorId: uid,
                    eventType: "INVITATION_ACCEPTED",
                    targetEmail: userEmail,
                    metadata: { role: pendingInvite.role, inviteId: pendingInvite.id },
                  });
                }

                // 4. Re-fetch user roles
                const { data: reRefetched } = await supabase
                  .from("user_roles")
                  .select("role, cafe_id, is_suspended")
                  .eq("user_id", uid);
                fetchedRoles = (reRefetched ?? []) as UserRoleEntry[];
                console.log("[Onboarding Debug] Re-fetched roles after auto-claim:", fetchedRoles);
              }
            }
          }
        }

        if (!error) {
          setRoles(fetchedRoles);
        }
      } catch (e) {
        console.error("AuthProvider: loadRoles error:", e);
      } finally {
        if (!silent) {
          setLoading(false);
        }
        if (activePromiseRef.current?.uid === uid) {
          activePromiseRef.current = null;
        }
      }
    })();

    activePromiseRef.current = { uid, promise };
    return promise;
  };

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      void loadRoles(data.session?.user.id, true).finally(() => {
        if (active) setLoading(false);
      });
    });

    const { data: sub } = supabase.auth.onAuthStateChange((evt, s) => {
      if (!active) return;
      setSession(s);
      
      if (evt === "SIGNED_IN") {
        void loadRoles(s?.user.id, true);
      } else if (evt === "SIGNED_OUT") {
        setRoles([]);
        setLastUid(null);
        setLoading(false);
      } else if (evt === "TOKEN_REFRESHED") {
        // Bypassed: Token refresh events do not reload roles to prevent layout unmounting.
      } else {
        void loadRoles(s?.user.id, false, true);
      }
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const isSuspended = roles.length > 0 && roles.every((r) => r.is_suspended === true);

  const value: AuthCtx = {
    session,
    user: session?.user ?? null,
    roles,
    isSuspended,
    loading,
    refreshRoles: () => loadRoles(session?.user.id, true, true),
    signOut: async () => {
      await supabase.auth.signOut();
    },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function hasRole(roles: UserRoleEntry[], ...allowed: AppRole[]) {
  return roles.some((r) => allowed.includes(r.role) && !r.is_suspended);
}
