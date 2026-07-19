import { APP_CONFIG } from "@/config/app";
import { useAuth, hasRole } from "./auth";
import { useCafe } from "./cafe";

/**
 * Returns true if the given cafe slug matches the public demo cafe slug.
 */
export function isDemoMode(slug?: string | null): boolean {
  return (slug || "").toLowerCase() === APP_CONFIG.cafeSlug.toLowerCase();
}

/**
 * Returns true if the given user ID matches the demo administrator UUID.
 */
export function isDemoAdmin(userId?: string | null): boolean {
  if (!userId) return false;
  return userId.toLowerCase() === APP_CONFIG.demoAdminUuid.toLowerCase();
}

/**
 * React hook to check if the currently authenticated user is the Demo Administrator.
 */
export function useDemoAdmin(): boolean {
  const { user } = useAuth();
  return isDemoAdmin(user?.id);
}

/**
 * React hook to check if the current active session is running against the public demo cafe.
 * Excludes the Demo Administrator from demo constraints.
 */
export function useDemoMode(): boolean {
  const { cafe } = useCafe();
  const { user } = useAuth();
  if (isDemoAdmin(user?.id)) return false;
  return cafe ? isDemoMode(cafe.slug) : false;
}

/**
 * Centralized permissions hook managing capability authorization checks.
 * Under production: verifies owner role permissions.
 * Under demo mode: returns values prepared for future restrictions.
 * Under demo admin: bypasses all restrictions.
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

