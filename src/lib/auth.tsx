import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type AppRole = Database["public"]["Enums"]["app_role"];

type AuthCtx = {
  session: Session | null;
  user: User | null;
  roles: { role: AppRole; cafe_id: string | null }[];
  loading: boolean;
  refreshRoles: () => Promise<void>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<AuthCtx["roles"]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUid, setLastUid] = useState<string | null>(null);

  const logSetLoading = (val: boolean) => {
    console.log(`[${new Date().toISOString()}] AuthProvider: setLoading(${val})`);
    setLoading(val);
  };

  const loadRoles = async (uid: string | undefined, force = false) => {
    console.log(`[${new Date().toISOString()}] AuthProvider: loadRoles called. uid=${uid}, force=${force}, lastUid=${lastUid}, isNewUser=${uid !== lastUid}`);
    if (!uid) {
      console.log(`[${new Date().toISOString()}] AuthProvider: loadRoles early exit - no uid`);
      setRoles([]);
      setLastUid(null);
      logSetLoading(false);
      return;
    }
    if (uid === lastUid && !loading && !force) {
      console.log(`[${new Date().toISOString()}] AuthProvider: loadRoles early exit - cached`);
      return;
    }
    console.log(`[${new Date().toISOString()}] AuthProvider: triggering loadRoles fetch`);
    logSetLoading(true);
    setLastUid(uid);
    try {
      const { data, error } = await supabase.from("user_roles").select("role, cafe_id").eq("user_id", uid);
      if (error) {
        console.error("AuthProvider: supabase query error in user_roles:", error);
      } else {
        console.log("AuthProvider: loaded roles from Supabase database:", data);
      }
      setRoles((data ?? []) as AuthCtx["roles"]);
    } catch (e) {
      console.error("AuthProvider: loadRoles try-catch exception:", e);
    } finally {
      const nowTime = performance.now();
      if ((window as any).__tokenRefreshedTime) {
        const diff = nowTime - (window as any).__tokenRefreshedTime;
        console.log(`[${new Date().toISOString()}] AuthProvider: Measurement - Time from TOKEN_REFRESHED to setLoading(false): ${diff.toFixed(2)}ms`);
        (window as any).__tokenRefreshedTime = null;
      }
      logSetLoading(false);
    }
  };

  useEffect(() => {
    let active = true;

    // Initial session load
    console.log(`[${new Date().toISOString()}] AuthProvider: Auth event INITIAL_SESSION`);
    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) {
        console.error("AuthProvider: getSession returned error:", error);
      }
      setSession(data.session);
      void loadRoles(data.session?.user.id, true).finally(() => {
        if (active) logSetLoading(false);
      });
    });

    const { data: sub } = supabase.auth.onAuthStateChange((evt, s) => {
      if (!active) return;
      console.log(`[${new Date().toISOString()}] AuthProvider: Auth event ${evt}`);
      setSession(s);
      if (evt === "TOKEN_REFRESHED") {
        (window as any).__tokenRefreshedTime = performance.now();
      }
      if (evt === "SIGNED_IN" || evt === "TOKEN_REFRESHED") {
        void loadRoles(s?.user.id, true);
      } else if (evt === "SIGNED_OUT") {
        setRoles([]);
        setLastUid(null);
        logSetLoading(false);
      } else {
        void loadRoles(s?.user.id);
      }
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const value: AuthCtx = {
    session,
    user: session?.user ?? null,
    roles,
    loading,
    refreshRoles: () => loadRoles(session?.user.id, true),
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

export function hasRole(roles: { role: AppRole }[], ...allowed: AppRole[]) {
  return roles.some((r) => allowed.includes(r.role));
}
