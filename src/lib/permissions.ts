import { APP_CONFIG } from "@/config/app";
import { useAuth, hasRole } from "./auth";
import {
  hasCapability,
  type Capability,
  canViewAnalytics,
  canManageSettings,
  canManageRestaurantConfig,
  canManageStaff,
  canManageCounter,
  canManageMenu,
  canManageQrTables,
  canExportData,
  canOpenDiningSession,
  canCloseDiningSession,
  canResetTable,
  canManageBills,
  canApplyDiscount,
  canAcceptPayment,
  canUpdateOrderStatus,
  canViewKitchenQueue,
  canResolveServiceRequests,
} from "./auth/permissions";

export * from "./auth/permissions";

/**
 * Single source of truth: is this the public demo deployment?
 */
export function isDemoDeployment(): boolean {
  return import.meta.env.VITE_DEMO_MODE === "true";
}

/**
 * Returns true if the given user ID matches the demo administrator UUID.
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
 */
export function useDemoMode(): boolean {
  const { user } = useAuth();
  if (!isDemoDeployment()) return false;
  if (isDemoAdmin(user?.id)) return false;
  return true;
}

/**
 * Centralized capability authorization hook.
 */
export function usePermissions() {
  const { roles, user } = useAuth();
  const isDemo = useDemoMode();
  const isDemoAdm = isDemoAdmin(user?.id);

  const isOwner = hasRole(roles, "owner") || isDemoAdm;
  const isCounter = hasRole(roles, "counter") || isOwner || isDemoAdm;
  const isStaff = hasRole(roles, "staff") || isCounter || isOwner || isDemoAdm;

  return {
    isDemo,
    isOwner,
    isCounter,
    isStaff,

    // Capability helpers
    canViewAnalytics: () => isOwner && canViewAnalytics(roles),
    canManageSettings: () => isOwner && canManageSettings(roles),
    canManageRestaurantConfig: () => isOwner && canManageRestaurantConfig(roles),
    canManageStaff: () => isOwner && canManageStaff(roles),
    canManageCounter: () => isOwner && canManageCounter(roles),
    canManageMenu: () => isOwner && canManageMenu(roles),
    canManageCategories: () => isOwner,
    canManageTables: () => isOwner,
    canManageQrCodes: () => isOwner && canManageQrTables(roles),
    canUploadImages: () => isOwner,

    canOpenDiningSession: () => (isOwner || isCounter) && canOpenDiningSession(roles),
    canCloseDiningSession: () => (isOwner || isCounter) && canCloseDiningSession(roles),
    canResetTable: () => (isOwner || isCounter) && canResetTable(roles),
    canManageBills: () => (isOwner || isCounter) && canManageBills(roles),
    canApplyDiscount: () => (isOwner || isCounter) && canApplyDiscount(roles),
    canAcceptPayment: () => (isOwner || isCounter) && canAcceptPayment(roles),

    canUpdateOrderStatus: () => (isOwner || isCounter || isStaff) && canUpdateOrderStatus(roles),
    canViewKitchenQueue: () => (isOwner || isCounter || isStaff) && canViewKitchenQueue(roles),
    canResolveServiceRequests: () => (isOwner || isCounter || isStaff) && canResolveServiceRequests(roles),

    canManageCafeSettings: () => isOwner && (!isDemo || isDemoAdm),
    canEditBranding: () => isOwner && (!isDemo || isDemoAdm),
    canManageUsers: () => isOwner && (!isDemo || isDemoAdm),
    canManageRoles: () => isOwner && (!isDemo || isDemoAdm),
    canDeleteData: () => isOwner && (!isDemo || isDemoAdm),
    canExportData: () => isOwner && (!isDemo || isDemoAdm),

    hasCapability: (capability: Capability) => isDemoAdm || hasCapability(roles, capability),
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
