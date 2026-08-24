import { describe, it, expect } from "vitest";
import {
  canManageBills,
  canApplyDiscount,
  canAcceptPayment,
  canUpdateOrderStatus,
  canViewAnalytics,
  canManageStaff,
  canManageSettings,
} from "@/lib/permissions";
import fs from "fs";
import path from "path";

describe("P0 Security Containment Verification", () => {
  describe("Role-Based Access Control (RBAC) Hardening", () => {
    it("strictly blocks unauthenticated/anonymous users from billing and financial operations", () => {
      // @ts-expect-error test unauthenticated null/undefined role
      expect(canManageBills(undefined)).toBe(false);
      // @ts-expect-error test unauthenticated null role
      expect(canManageBills(null)).toBe(false);
      // @ts-expect-error test invalid role
      expect(canManageBills("customer")).toBe(false);
      // @ts-expect-error test invalid role
      expect(canApplyDiscount("customer")).toBe(false);
      // @ts-expect-error test invalid role
      expect(canAcceptPayment("customer")).toBe(false);
    });

    it("strictly blocks unauthenticated/anonymous users from administrative controls", () => {
      // @ts-expect-error test invalid role
      expect(canViewAnalytics("customer")).toBe(false);
      // @ts-expect-error test invalid role
      expect(canManageStaff("customer")).toBe(false);
      // @ts-expect-error test invalid role
      expect(canManageSettings("customer")).toBe(false);
      // @ts-expect-error test invalid role
      expect(canUpdateOrderStatus("customer")).toBe(false);
    });

    it("allows authorized counter and owner access to billing operations", () => {
      expect(canManageBills("owner")).toBe(true);
      expect(canManageBills("counter")).toBe(true);
      expect(canManageBills("staff")).toBe(false);

      expect(canAcceptPayment("owner")).toBe(true);
      expect(canAcceptPayment("counter")).toBe(true);
      expect(canAcceptPayment("staff")).toBe(false);

      expect(canApplyDiscount("owner")).toBe(true);
      expect(canApplyDiscount("counter")).toBe(true);
      expect(canApplyDiscount("staff")).toBe(false);
    });

    it("allows authorized staff, counter, and owner access to kitchen & order status operations", () => {
      expect(canUpdateOrderStatus("owner")).toBe(true);
      expect(canUpdateOrderStatus("counter")).toBe(true);
      expect(canUpdateOrderStatus("staff")).toBe(true);
    });
  });

  describe("SQL Migration 20260824190000_p0_security_containment_hardening.sql Audit", () => {
    const migrationPath = path.join(
      process.cwd(),
      "supabase/migrations/20260824190000_p0_security_containment_hardening.sql"
    );

    it("migration file exists and is populated", () => {
      expect(fs.existsSync(migrationPath)).toBe(true);
      const content = fs.readFileSync(migrationPath, "utf8");
      expect(content.length).toBeGreaterThan(500);
    });

    it("drops permissive public/anonymous policies on bills and bill_items", () => {
      const content = fs.readFileSync(migrationPath, "utf8");
      expect(content).toContain('DROP POLICY IF EXISTS "Allow public/staff full access to bills"');
      expect(content).toContain('DROP POLICY IF EXISTS "Allow public/staff full access to bill_items"');
    });

    it("revokes anonymous mutating permissions on bills, bill_items, and order_events", () => {
      const content = fs.readFileSync(migrationPath, "utf8");
      expect(content).toContain("REVOKE INSERT, UPDATE, DELETE ON public.bills FROM anon");
      expect(content).toContain("REVOKE INSERT, UPDATE, DELETE ON public.bill_items FROM anon");
      expect(content).toContain("REVOKE UPDATE, DELETE ON public.order_events FROM anon");
    });

    it("drops permissive public update and delete policies on order_events", () => {
      const content = fs.readFileSync(migrationPath, "utf8");
      expect(content).toContain('DROP POLICY IF EXISTS "order_events public update"');
      expect(content).toContain('DROP POLICY IF EXISTS "order_events public delete"');
    });

    it("creates authenticated RBAC policies for bills, bill_items, and order_events", () => {
      const content = fs.readFileSync(migrationPath, "utf8");
      expect(content).toContain('CREATE POLICY "bills_staff_counter_owner_select"');
      expect(content).toContain('CREATE POLICY "bills_staff_counter_owner_insert"');
      expect(content).toContain('CREATE POLICY "bills_staff_counter_owner_update"');
      expect(content).toContain('CREATE POLICY "bill_items_staff_counter_owner_select"');
      expect(content).toContain('CREATE POLICY "bill_items_staff_counter_owner_insert"');
      expect(content).toContain('CREATE POLICY "order_events_staff_counter_owner_update"');
    });
  });

  describe("Credential Sanitization Audit", () => {
    it("ensures scripts/verify_real_logo_and_email.js does not exist in workspace", () => {
      const scriptPath = path.join(
        process.cwd(),
        "scripts/verify_real_logo_and_email.js"
      );
      expect(fs.existsSync(scriptPath)).toBe(false);
    });
  });
});
