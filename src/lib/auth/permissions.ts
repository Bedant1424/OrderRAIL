import type { UserRoleEntry, AppRole } from "@/lib/auth";

export type Capability =
  | "VIEW_ANALYTICS"
  | "MANAGE_SETTINGS"
  | "MANAGE_RESTAURANT_CONFIG"
  | "MANAGE_STAFF"
  | "MANAGE_COUNTER"
  | "MANAGE_MENU"
  | "MANAGE_QR_TABLES"
  | "EXPORT_DATA"
  | "OPEN_DINING_SESSION"
  | "CLOSE_DINING_SESSION"
  | "RESET_TABLE"
  | "MANAGE_BILLS"
  | "APPLY_DISCOUNT"
  | "ACCEPT_PAYMENT"
  | "UPDATE_ORDER_STATUS"
  | "VIEW_KITCHEN_QUEUE"
  | "RESOLVE_SERVICE_REQUESTS";

/**
 * Capability matrix mapping roles to their allowed capability set.
 */
const ROLE_CAPABILITIES: Record<AppRole, Capability[]> = {
  owner: [
    "VIEW_ANALYTICS",
    "MANAGE_SETTINGS",
    "MANAGE_RESTAURANT_CONFIG",
    "MANAGE_STAFF",
    "MANAGE_COUNTER",
    "MANAGE_MENU",
    "MANAGE_QR_TABLES",
    "EXPORT_DATA",
    "OPEN_DINING_SESSION",
    "CLOSE_DINING_SESSION",
    "RESET_TABLE",
    "MANAGE_BILLS",
    "APPLY_DISCOUNT",
    "ACCEPT_PAYMENT",
    "UPDATE_ORDER_STATUS",
    "VIEW_KITCHEN_QUEUE",
    "RESOLVE_SERVICE_REQUESTS",
  ],
  counter: [
    "OPEN_DINING_SESSION",
    "CLOSE_DINING_SESSION",
    "RESET_TABLE",
    "MANAGE_BILLS",
    "APPLY_DISCOUNT",
    "ACCEPT_PAYMENT",
    "UPDATE_ORDER_STATUS",
    "VIEW_KITCHEN_QUEUE",
    "RESOLVE_SERVICE_REQUESTS",
  ],
  staff: [
    "UPDATE_ORDER_STATUS",
    "VIEW_KITCHEN_QUEUE",
    "RESOLVE_SERVICE_REQUESTS",
  ],
};

/**
 * Extract active string roles from UserRoleEntry[] array or raw role string(s).
 */
export function normalizeRoles(
  rolesInput?: UserRoleEntry[] | AppRole | AppRole[] | string | string[] | null
): AppRole[] {
  if (!rolesInput) return [];

  if (typeof rolesInput === "string") {
    const lower = rolesInput.toLowerCase() as AppRole;
    return ["owner", "counter", "staff"].includes(lower) ? [lower] : [];
  }

  if (Array.isArray(rolesInput)) {
    const result: AppRole[] = [];
    for (const item of rolesInput) {
      if (typeof item === "string") {
        const lower = item.toLowerCase() as AppRole;
        if (["owner", "counter", "staff"].includes(lower)) {
          result.push(lower);
        }
      } else if (item && typeof item === "object" && "role" in item && !item.is_suspended) {
        const r = item.role?.toLowerCase() as AppRole;
        if (["owner", "counter", "staff"].includes(r)) {
          result.push(r);
        }
      }
    }
    return Array.from(new Set(result));
  }

  return [];
}

/**
 * Checks if the given roles grant the requested capability.
 */
export function hasCapability(
  rolesInput: UserRoleEntry[] | AppRole | AppRole[] | string | string[] | null | undefined,
  capability: Capability
): boolean {
  const activeRoles = normalizeRoles(rolesInput);
  return activeRoles.some((role) => ROLE_CAPABILITIES[role]?.includes(capability));
}

// Capability Helpers
export const canViewAnalytics = (roles?: any) => hasCapability(roles, "VIEW_ANALYTICS");
export const canManageSettings = (roles?: any) => hasCapability(roles, "MANAGE_SETTINGS");
export const canManageRestaurantConfig = (roles?: any) => hasCapability(roles, "MANAGE_RESTAURANT_CONFIG");
export const canManageStaff = (roles?: any) => hasCapability(roles, "MANAGE_STAFF");
export const canManageCounter = (roles?: any) => hasCapability(roles, "MANAGE_COUNTER");
export const canManageMenu = (roles?: any) => hasCapability(roles, "MANAGE_MENU");
export const canManageQrTables = (roles?: any) => hasCapability(roles, "MANAGE_QR_TABLES");
export const canExportData = (roles?: any) => hasCapability(roles, "EXPORT_DATA");

export const canOpenDiningSession = (roles?: any) => hasCapability(roles, "OPEN_DINING_SESSION");
export const canCloseDiningSession = (roles?: any) => hasCapability(roles, "CLOSE_DINING_SESSION");
export const canResetTable = (roles?: any) => hasCapability(roles, "RESET_TABLE");
export const canManageBills = (roles?: any) => hasCapability(roles, "MANAGE_BILLS");
export const canApplyDiscount = (roles?: any) => hasCapability(roles, "APPLY_DISCOUNT");
export const canAcceptPayment = (roles?: any) => hasCapability(roles, "ACCEPT_PAYMENT");

export const canUpdateOrderStatus = (roles?: any) => hasCapability(roles, "UPDATE_ORDER_STATUS");
export const canViewKitchenQueue = (roles?: any) => hasCapability(roles, "VIEW_KITCHEN_QUEUE");
export const canResolveServiceRequests = (roles?: any) => hasCapability(roles, "RESOLVE_SERVICE_REQUESTS");

/**
 * Validates backend capability authorization and throws 403 Forbidden error if missing.
 */
export function assertCapability(
  rolesInput: UserRoleEntry[] | AppRole | AppRole[] | string | string[] | null | undefined,
  capability: Capability,
  actionName = "action"
): void {
  if (!hasCapability(rolesInput, capability)) {
    const err = new Error(`403 Forbidden: Account lacks capability '${capability}' required for ${actionName}`);
    (err as any).status = 403;
    throw err;
  }
}
