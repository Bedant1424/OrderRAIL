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

  const loadRoles = async (uid: string | undefined, force = false) => {
    console.log("AuthProvider: loadRoles invoked for uid:", uid, "force:", force);
    if (!uid) {
      console.log("AuthProvider: loadRoles early exit - no uid");
      setRoles([]);
      setLastUid(null);
      setLoading(false);
      return;
    }
    if (uid === lastUid && !loading && !force) {
      console.log("AuthProvider: loadRoles early exit - cached");
      return;
    }
    console.log("AuthProvider: setting loading to true, fetching roles");
    setLoading(true);
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
      console.log("AuthProvider: setting loading to false");
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;

    // Initial session load
    console.log("AuthProvider: triggering supabase.auth.getSession()");
    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) {
        console.error("AuthProvider: getSession returned error:", error);
      }
      console.log("AuthProvider: getSession result session exists:", !!data.session, {
        email: data.session?.user?.email,
        id: data.session?.user?.id
      });
      setSession(data.session);
      void loadRoles(data.session?.user.id, true).finally(() => {
        if (active) setLoading(false);
      });
    });

    const { data: sub } = supabase.auth.onAuthStateChange((evt, s) => {
      if (!active) return;
      console.log("AuthProvider: onAuthStateChange fired event:", evt, "session exists:", !!s, {
        email: s?.user?.email,
        id: s?.user?.id
      });
      setSession(s);
      if (evt === "SIGNED_IN" || evt === "TOKEN_REFRESHED") {
        void loadRoles(s?.user.id, true);
      } else if (evt === "SIGNED_OUT") {
        setRoles([]);
        setLastUid(null);
        setLoading(false);
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
