import { describe, it, expect } from "vitest";
import {
  hasCapability,
  canViewAnalytics,
  canManageSettings,
  canManageRestaurantConfig,
  canManageStaff,
  canManageCounter,
  canManageMenu,
  canManageQrTables,
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
import { RestaurantOperationsService } from "@/lib/operations/RestaurantOperationsService";
import { BillService } from "@/lib/billing/BillService";
import { updateOrderStatusInDb } from "@/lib/orders/repository";

describe("Sprint 9.2 — Counter Authentication & Role-Based Access Control (RBAC)", () => {
  describe("Owner Role Capabilities", () => {
    it("allows Owner access to all administrative & operational capabilities", () => {
      const role = "owner";
      expect(canViewAnalytics(role)).toBe(true);
      expect(canManageSettings(role)).toBe(true);
      expect(canManageRestaurantConfig(role)).toBe(true);
      expect(canManageStaff(role)).toBe(true);
      expect(canManageCounter(role)).toBe(true);
      expect(canManageMenu(role)).toBe(true);
      expect(canManageQrTables(role)).toBe(true);
      expect(canOpenDiningSession(role)).toBe(true);
      expect(canCloseDiningSession(role)).toBe(true);
      expect(canResetTable(role)).toBe(true);
      expect(canManageBills(role)).toBe(true);
      expect(canApplyDiscount(role)).toBe(true);
      expect(canAcceptPayment(role)).toBe(true);
      expect(canUpdateOrderStatus(role)).toBe(true);
      expect(canViewKitchenQueue(role)).toBe(true);
      expect(canResolveServiceRequests(role)).toBe(true);
    });
  });

  describe("Counter Role Capabilities", () => {
    it("allows Counter access to front-of-house table, billing & payment operations", () => {
      const role = "counter";
      expect(canOpenDiningSession(role)).toBe(true);
      expect(canCloseDiningSession(role)).toBe(true);
      expect(canResetTable(role)).toBe(true);
      expect(canManageBills(role)).toBe(true);
      expect(canApplyDiscount(role)).toBe(true);
      expect(canAcceptPayment(role)).toBe(true);
      expect(canUpdateOrderStatus(role)).toBe(true);
      expect(canViewKitchenQueue(role)).toBe(true);
      expect(canResolveServiceRequests(role)).toBe(true);
    });

    it("DENIES Counter access to Owner administrative features", () => {
      const role = "counter";
      expect(canViewAnalytics(role)).toBe(false);
      expect(canManageSettings(role)).toBe(false);
      expect(canManageRestaurantConfig(role)).toBe(false);
      expect(canManageStaff(role)).toBe(false);
      expect(canManageCounter(role)).toBe(false);
      expect(canManageMenu(role)).toBe(false);
      expect(canManageQrTables(role)).toBe(false);
    });
  });

  describe("Staff Role Capabilities", () => {
    it("allows Staff access to order status updates, kitchen queue & service requests", () => {
      const role = "staff";
      expect(canUpdateOrderStatus(role)).toBe(true);
      expect(canViewKitchenQueue(role)).toBe(true);
      expect(canResolveServiceRequests(role)).toBe(true);
    });

    it("DENIES Staff access to billing, table reset, and administrative controls", () => {
      const role = "staff";
      expect(canManageBills(role)).toBe(false);
      expect(canResetTable(role)).toBe(false);
      expect(canOpenDiningSession(role)).toBe(false);
      expect(canCloseDiningSession(role)).toBe(false);
      expect(canApplyDiscount(role)).toBe(false);
      expect(canAcceptPayment(role)).toBe(false);
      expect(canViewAnalytics(role)).toBe(false);
      expect(canManageSettings(role)).toBe(false);
      expect(canManageStaff(role)).toBe(false);
      expect(canManageMenu(role)).toBe(false);
    });
  });

  describe("Guest / Anonymous Role Capabilities", () => {
    it("DENIES unauthenticated guests access to all authenticated capabilities", () => {
      const role = null;
      expect(canViewAnalytics(role)).toBe(false);
      expect(canManageSettings(role)).toBe(false);
      expect(canOpenDiningSession(role)).toBe(false);
      expect(canManageBills(role)).toBe(false);
      expect(canResetTable(role)).toBe(false);
      expect(canUpdateOrderStatus(role)).toBe(false);
      expect(hasCapability(role, "VIEW_ANALYTICS")).toBe(false);
    });
  });

  describe("Security Tests & Backend Enforcement (403 Forbidden Throws)", () => {
    it("assertCapability throws 403 Forbidden when capability is missing", () => {
      expect(() => assertCapability("counter", "VIEW_ANALYTICS", "View Analytics")).toThrowError(
        /403 Forbidden: Account lacks capability 'VIEW_ANALYTICS'/
      );

      expect(() => assertCapability("staff", "MANAGE_SETTINGS", "Manage Settings")).toThrowError(
        /403 Forbidden: Account lacks capability 'MANAGE_SETTINGS'/
      );

      expect(() => assertCapability("staff", "RESET_TABLE", "Reset Table")).toThrowError(
        /403 Forbidden: Account lacks capability 'RESET_TABLE'/
      );
    });

    it("RestaurantOperationsService.resetTable rejects unauthorized Staff role with 403", async () => {
      await expect(
        RestaurantOperationsService.resetTable("tbl-101", "cafe-101", "sess-101", "staff")
      ).rejects.toThrowError(/403 Forbidden/);
    });

    it("BillService.generateBill rejects unauthorized Staff role with 403", async () => {
      await expect(
        BillService.generateBill({
          cafeId: "cafe-101",
          sessionId: "sess-101",
          orders: [{ items: [{ id: "item-1", name: "Tea", price: 20, qty: 1 }] }],
          actorRole: "staff",
        })
      ).rejects.toThrowError(/403 Forbidden/);
    });

    it("updateOrderStatusInDb rejects unauthorized role if assertion fails", async () => {
      await expect(
        updateOrderStatusInDb("order-1", "served", "staff", "guest" as any)
      ).rejects.toThrowError(/403 Forbidden/);
    });
  });
});
