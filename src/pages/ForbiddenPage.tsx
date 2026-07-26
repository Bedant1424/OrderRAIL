import { Link } from "react-router-dom";
import { ShieldAlert, ArrowLeft } from "lucide-react";
import { useAuth, hasRole } from "@/lib/auth";

export default function ForbiddenPage() {
  const { roles } = useAuth();
  const isOwner = hasRole(roles, "owner");
  const isCounter = hasRole(roles, "counter");

  const homeLink = isOwner ? "/owner" : isCounter ? "/counter" : "/staff";

  return (
    <div className="grid min-h-screen place-items-center bg-background px-6 text-center">
      <div className="max-w-md space-y-6">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-destructive/10 text-destructive shadow-soft">
          <ShieldAlert className="h-10 w-10" />
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">403 Access Denied</h1>
          <p className="text-sm text-muted-foreground">
            You do not have permission to access this area. Your account role does not possess the required capabilities for this workstation.
          </p>
        </div>
        <Link
          to={homeLink}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-soft transition hover:bg-primary/90"
        >
          <ArrowLeft className="h-4 w-4" />
          Return to Dashboard
        </Link>
      </div>
    </div>
  );
}
