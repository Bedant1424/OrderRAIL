import { APP_CONFIG } from "@/config/app";
import { useAuth, hasRole } from "./auth";

/**
 * Single source of truth: is this the public demo deployment?
 *
 * Driven by the build-time environment variable VITE_DEMO_MODE.
 * Set VITE_DEMO_MODE=true in the Demo Vercel project.
 * Leave it unset or set to "false" in the Production Vercel project.
 *
 * This function is the ONLY place in the codebase that reads the env var.
 */
export function isDemoDeployment(): boolean {
  return import.meta.env.VITE_DEMO_MODE === "true";
}

/**
 * Returns true if the given user ID matches the demo administrator UUID.
 * Only meaningful on the demo deployment.
 */
export function isDemoAdmin(userId?: string | null): boolean {
  if (!isDemoDeployment()) return false;
  if (!userId) return false;
  return userId.toLowerCase() === APP_CONFIG.demoAdminUuid.toLowerCase();
}

/**
 * React hook: is the currently authenticated user the Demo Administrator?
 */
export function useDemoAdmin(): boolean {
  const { user } = useAuth();
  return isDemoAdmin(user?.id);
}

/**
 * React hook: should the current session be subject to demo UI restrictions?
 *
 * Returns true ONLY when:
 *   1. This is the demo deployment (VITE_DEMO_MODE=true), AND
 *   2. The current user is NOT the Demo Administrator.
 *
 * On the production deployment this always returns false.
 */
export function useDemoMode(): boolean {
  const { user } = useAuth();
  if (!isDemoDeployment()) return false;
  if (isDemoAdmin(user?.id)) return false;
  return true;
}

/**
 * Centralized permissions hook managing capability authorization checks.
 *
 * Production deployment: standard role-based access.
 * Demo deployment (non-admin): read-only restrictions.
 * Demo deployment (admin): full bypass.
 */
export function usePermissions() {
  const { roles, user } = useAuth();
  const isDemo = useDemoMode();
  const isDemoAdm = isDemoAdmin(user?.id);
  const isOwner = hasRole(roles, "owner") || isDemoAdm;
  const isStaff = hasRole(roles, "staff") || isDemoAdm;

  return {
    isDemo,
    isOwner,
    isStaff,

    // Core capabilities
    canManageMenu: () => isOwner,
    canManageCategories: () => isOwner,
    canManageTables: () => isOwner,
    canManageQrCodes: () => isOwner,
    canUploadImages: () => isOwner,
    
    // Cafe Branding & settings: restricted in public demo mode to prevent vandalism
    canManageCafeSettings: () => isOwner && (!isDemo || isDemoAdm),
    canEditBranding: () => isOwner && (!isDemo || isDemoAdm),
    
    // Team / Invite controls: claim role directly in demo, invitations are production-only
    canManageUsers: () => isOwner && (!isDemo || isDemoAdm),
    canManageRoles: () => isOwner && (!isDemo || isDemoAdm),
    
    // Destruction controls: blocked in demo to prevent erasing the demo catalog
    canDeleteData: () => isOwner && (!isDemo || isDemoAdm),
    
    // Data exports: restricted to production owners
    canExportData: () => isOwner && (!isDemo || isDemoAdm),
  };
}

/**
 * Mask an email address to protect user privacy in public settings.
 */
export function maskEmail(email: string | null | undefined): string {
  if (!email) return "—";
  const parts = email.split("@");
  if (parts.length !== 2) return email;
  const [local, domain] = parts;
  if (local.length <= 2) {
    return `${local[0]}*@${domain}`;
  }
  return `${local[0]}${"*".repeat(local.length - 2)}${local[local.length - 1]}@${domain}`;
}

/**
 * Mask a UUID / User ID string.
 */
export function maskUserId(id: string): string {
  return `usr_${id.slice(0, 4)}***${id.slice(-4)}`;
}
