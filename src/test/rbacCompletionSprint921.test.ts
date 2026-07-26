import { describe, it, expect } from "vitest";
import {
  hasCapability,
  canViewAnalytics,
  canManageSettings,
  canManageRestaurantConfig,
  canManageStaff,
  canManageCounter,
  canManageMenu,
  canOpenDiningSession,
  canCloseDiningSession,
  canResetTable,
  canManageBills,
  canApplyDiscount,
  canAcceptPayment,
  canUpdateOrderStatus,
  canViewKitchenQueue,
  canResolveServiceRequests,
  assertCapability,
} from "@/lib/permissions";
import { hasRole, type UserRoleEntry } from "@/lib/auth";

describe("Sprint 9.2.1 — RBAC Completion & Owner Dashboard Restoration", () => {
  describe("Part 1 & 2: Analytics Restoration & Capability Scoping", () => {
    it("Owner retains full access to business insights and analytics", () => {
      const ownerRoles: UserRoleEntry[] = [{ role: "owner", cafe_id: "cafe-1" }];
      expect(canViewAnalytics(ownerRoles)).toBe(true);
      expect(canManageSettings(ownerRoles)).toBe(true);
      expect(canManageStaff(ownerRoles)).toBe(true);
      expect(canManageMenu(ownerRoles)).toBe(true);
    });

    it("Counter is strictly DENIED access to Owner analytics & settings", () => {
      const counterRoles: UserRoleEntry[] = [{ role: "counter", cafe_id: "cafe-1" }];
      expect(canViewAnalytics(counterRoles)).toBe(false);
      expect(canManageSettings(counterRoles)).toBe(false);
      expect(canManageRestaurantConfig(counterRoles)).toBe(false);
      expect(canManageStaff(counterRoles)).toBe(false);
      expect(canManageMenu(counterRoles)).toBe(false);
    });

    it("Staff is strictly DENIED access to Owner analytics & settings", () => {
      const staffRoles: UserRoleEntry[] = [{ role: "staff", cafe_id: "cafe-1" }];
      expect(canViewAnalytics(staffRoles)).toBe(false);
      expect(canManageSettings(staffRoles)).toBe(false);
      expect(canManageStaff(staffRoles)).toBe(false);
    });
  });

  describe("Part 3 & 4: Counter Role Lifecycle & Management", () => {
    it("validates Counter role lifecycle transitions (Staff -> Counter -> Owner -> Counter)", () => {
      let roleEntry: UserRoleEntry = { role: "staff", cafe_id: "cafe-1" };
      expect(hasRole([roleEntry], "staff")).toBe(true);

      // Promote Staff to Counter
      roleEntry = { role: "counter", cafe_id: "cafe-1" };
      expect(hasRole([roleEntry], "counter")).toBe(true);
      expect(canOpenDiningSession([roleEntry])).toBe(true);
      expect(canManageBills([roleEntry])).toBe(true);
      expect(canResetTable([roleEntry])).toBe(true);
      expect(canViewAnalytics([roleEntry])).toBe(false);

      // Promote Counter to Owner
      roleEntry = { role: "owner", cafe_id: "cafe-1" };
      expect(hasRole([roleEntry], "owner")).toBe(true);
      expect(canViewAnalytics([roleEntry])).toBe(true);

      // Demote Owner to Counter
      roleEntry = { role: "counter", cafe_id: "cafe-1" };
      expect(hasRole([roleEntry], "counter")).toBe(true);
      expect(canViewAnalytics([roleEntry])).toBe(false);
    });
  });

  describe("Part 5 & 6: Authentication & Navigation Verification", () => {
    it("routes Counter user to /counter and blocks access to /owner", () => {
      const counterRoles: UserRoleEntry[] = [{ role: "counter", cafe_id: "cafe-1" }];
      
      const isCounterAllowed = hasRole(counterRoles, "counter", "owner") || canOpenDiningSession(counterRoles);
      expect(isCounterAllowed).toBe(true);

      const isOwnerAllowed = hasRole(counterRoles, "owner") && canViewAnalytics(counterRoles);
      expect(isOwnerAllowed).toBe(false);
    });

    it("prevents Staff user from accessing /counter or /owner pages", () => {
      const staffRoles: UserRoleEntry[] = [{ role: "staff", cafe_id: "cafe-1" }];

      const isCounterAllowed = hasRole(staffRoles, "counter") || canOpenDiningSession(staffRoles);
      expect(isCounterAllowed).toBe(false);

      const isOwnerAllowed = hasRole(staffRoles, "owner") && canViewAnalytics(staffRoles);
      expect(isOwnerAllowed).toBe(false);
    });

    it("allows Staff access to order status and kitchen queue", () => {
      const staffRoles: UserRoleEntry[] = [{ role: "staff", cafe_id: "cafe-1" }];
      expect(canUpdateOrderStatus(staffRoles)).toBe(true);
      expect(canViewKitchenQueue(staffRoles)).toBe(true);
      expect(canResolveServiceRequests(staffRoles)).toBe(true);
    });
  });

  describe("Part 7: Security & Backend Rejection Verification", () => {
    it("assertCapability throws 403 when Staff attempts to reset table", () => {
      const staffRoles: UserRoleEntry[] = [{ role: "staff", cafe_id: "cafe-1" }];
      expect(() => assertCapability(staffRoles, "RESET_TABLE", "Reset Table")).toThrowError(
        /403 Forbidden: Account lacks capability 'RESET_TABLE'/
      );
    });

    it("assertCapability throws 403 when Counter attempts to access analytics", () => {
      const counterRoles: UserRoleEntry[] = [{ role: "counter", cafe_id: "cafe-1" }];
      expect(() => assertCapability(counterRoles, "VIEW_ANALYTICS", "View Analytics")).toThrowError(
        /403 Forbidden: Account lacks capability 'VIEW_ANALYTICS'/
      );
    });
  });
});
