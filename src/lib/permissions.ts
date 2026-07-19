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
 * React hook to check if the current active session is running against the public demo cafe.
 */
export function useDemoMode(): boolean {
  const { cafe } = useCafe();
  return cafe ? isDemoMode(cafe.slug) : false;
}

/**
 * Centralized permissions hook managing capability authorization checks.
 * Under production: verifies owner role permissions.
 * Under demo mode: returns values prepared for future restrictions.
 */
export function usePermissions() {
  const { roles } = useAuth();
  const isDemo = useDemoMode();
  const isOwner = hasRole(roles, "owner");
  const isStaff = hasRole(roles, "staff");

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
    canManageCafeSettings: () => isOwner && !isDemo,
    canEditBranding: () => isOwner && !isDemo,
    
    // Team / Invite controls: claim role directly in demo, invitations are production-only
    canManageUsers: () => isOwner && !isDemo,
    canManageRoles: () => isOwner && !isDemo,
    
    // Destruction controls: blocked in demo to prevent erasing the demo catalog
    canDeleteData: () => isOwner && !isDemo,
    
    // Data exports: restricted to production owners
    canExportData: () => isOwner && !isDemo,
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

