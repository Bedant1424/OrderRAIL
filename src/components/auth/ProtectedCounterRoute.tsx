import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth, hasRole } from "@/lib/auth";
import { canOpenDiningSession } from "@/lib/permissions";
import ForbiddenPage from "@/pages/ForbiddenPage";

export function ProtectedCounterRoute({ children }: { children: React.ReactNode }) {
  const { session, roles, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center text-muted-foreground font-semibold bg-background">
        Authenticating Counter Workstation…
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/staff/login" replace state={{ from: location.pathname }} />;
  }

  const isAllowed = hasRole(roles, "counter", "owner") || canOpenDiningSession(roles);
  if (!isAllowed) {
    return <ForbiddenPage />;
  }

  return <>{children}</>;
}
