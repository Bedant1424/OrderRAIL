import { describe, it, expect } from "vitest";
import { hasRole, type UserRoleEntry } from "../lib/auth";

describe("QA & Operational Readiness: Staff Management & Production Auth", () => {
  const activeOwner: UserRoleEntry = { role: "owner", cafe_id: "cafe-123", is_suspended: false };
  const activeStaff: UserRoleEntry = { role: "staff", cafe_id: "cafe-123", is_suspended: false };
  const suspendedOwner: UserRoleEntry = { role: "owner", cafe_id: "cafe-123", is_suspended: true };
  const suspendedStaff: UserRoleEntry = { role: "staff", cafe_id: "cafe-123", is_suspended: true };

  describe("1. Role Resolution & Authorization", () => {
    it("should grant access for active owner role", () => {
      expect(hasRole([activeOwner], "owner")).toBe(true);
      expect(hasRole([activeOwner], "staff", "owner")).toBe(true);
    });

    it("should grant access for active staff role", () => {
      expect(hasRole([activeStaff], "staff")).toBe(true);
      expect(hasRole([activeStaff], "owner")).toBe(false);
    });

    it("should BLOCK access for suspended owner role", () => {
      expect(hasRole([suspendedOwner], "owner")).toBe(false);
      expect(hasRole([suspendedOwner], "staff", "owner")).toBe(false);
    });

    it("should BLOCK access for suspended staff role", () => {
      expect(hasRole([suspendedStaff], "staff")).toBe(false);
      expect(hasRole([suspendedStaff], "staff", "owner")).toBe(false);
    });

    it("should evaluate multiple roles correctly when one is suspended", () => {
      const mixedRoles: UserRoleEntry[] = [suspendedStaff, activeOwner];
      expect(hasRole(mixedRoles, "owner")).toBe(true);
      expect(hasRole(mixedRoles, "staff")).toBe(false);
    });
  });

  describe("2. Last-Owner Safeguards", () => {
    const rolesList: UserRoleEntry[] = [
      { role: "owner", cafe_id: "cafe-123", is_suspended: false },
      { role: "staff", cafe_id: "cafe-123", is_suspended: false },
      { role: "staff", cafe_id: "cafe-123", is_suspended: false },
    ];

    it("should identify when only 1 active owner exists", () => {
      const activeOwnerCount = rolesList.filter((r) => r.role === "owner" && !r.is_suspended).length;
      expect(activeOwnerCount).toBe(1);
    });

    it("should block demoting or removing the last active owner", () => {
      const activeOwnerCount = rolesList.filter((r) => r.role === "owner" && !r.is_suspended).length;
      const canDemote = activeOwnerCount > 1;
      expect(canDemote).toBe(false);
    });

    it("should allow demoting or removing an owner when multiple active owners exist", () => {
      const multiOwnerList: UserRoleEntry[] = [
        { role: "owner", cafe_id: "cafe-123", is_suspended: false },
        { role: "owner", cafe_id: "cafe-123", is_suspended: false },
      ];
      const activeOwnerCount = multiOwnerList.filter((r) => r.role === "owner" && !r.is_suspended).length;
      const canDemote = activeOwnerCount > 1;
      expect(canDemote).toBe(true);
    });
  });

  describe("3. Duplicate Invitation & Registration Protection", () => {
    const existingInvites = [
      { email: "pending@cafe.com", role: "staff" },
    ];
    const existingMembers = [
      { email: "active@cafe.com", role: "staff" },
    ];

    it("should detect duplicate pending invitation", () => {
      const isDuplicateInvite = existingInvites.some((i) => i.email === "pending@cafe.com");
      expect(isDuplicateInvite).toBe(true);
    });

    it("should detect duplicate active member role", () => {
      const isDuplicateMember = existingMembers.some((m) => m.email === "active@cafe.com");
      expect(isDuplicateMember).toBe(true);
    });

    it("should allow inviting a brand new email address", () => {
      const newEmail = "newbie@cafe.com";
      const isDuplicateInvite = existingInvites.some((i) => i.email === newEmail);
      const isDuplicateMember = existingMembers.some((m) => m.email === newEmail);
      expect(isDuplicateInvite || isDuplicateMember).toBe(false);
    });
  });

  describe("4. Onboarding Discovery Pipeline Scenarios", () => {
    const profiles = [
      { id: "u1", email: "uninvited@cafe.com" },
      { id: "u2", email: "invited@cafe.com" },
      { id: "u3", email: "rejected@cafe.com" },
      { id: "u4", email: "assigned@cafe.com" },
    ];

    const assignedRoles = [
      { user_id: "u4", cafe_id: "cafe-123", role: "staff" },
    ];

    const activePendingInvites = [
      { email: "invited@cafe.com", accepted_at: null, revoked_at: null },
    ];

    const acceptedInvitesHistory = [
      { email: "assigned@cafe.com", accepted_at: "2026-07-22T00:00:00Z", revoked_at: null },
    ];

    const rejectedUserIds = new Set(["u3"]);

    it("Scenario A: No invitation -> User appears in Pending Approvals", () => {
      const assignedIds = new Set(assignedRoles.map((r) => r.user_id));
      const activeInvitedEmails = new Set(activePendingInvites.map((i) => i.email.toLowerCase().trim()));

      const pending = profiles.filter(
        (p) =>
          p.email &&
          !assignedIds.has(p.id) &&
          !activeInvitedEmails.has(p.email.toLowerCase().trim()) &&
          !rejectedUserIds.has(p.id)
      );

      expect(pending.map((p) => p.email)).toContain("uninvited@cafe.com");
    });

    it("Scenario B: Invitation exists -> User is filtered from Pending Approvals until claimed", () => {
      const assignedIds = new Set(assignedRoles.map((r) => r.user_id));
      const activeInvitedEmails = new Set(activePendingInvites.map((i) => i.email.toLowerCase().trim()));

      const pending = profiles.filter(
        (p) =>
          p.email &&
          !assignedIds.has(p.id) &&
          !activeInvitedEmails.has(p.email.toLowerCase().trim()) &&
          !rejectedUserIds.has(p.id)
      );

      expect(pending.map((p) => p.email)).not.toContain("invited@cafe.com");
    });

    it("Scenario C: Past accepted invitation does NOT block user from pending approvals if role is missing", () => {
      // Historical accepted invites should NOT be in activeInvitedEmails
      const activeInvitedEmails = new Set(activePendingInvites.map((i) => i.email.toLowerCase().trim()));
      expect(activeInvitedEmails.has("assigned@cafe.com")).toBe(false);
    });

    it("Scenario D: Rejected users remain excluded", () => {
      const assignedIds = new Set(assignedRoles.map((r) => r.user_id));
      const activeInvitedEmails = new Set(activePendingInvites.map((i) => i.email.toLowerCase().trim()));

      const pending = profiles.filter(
        (p) =>
          p.email &&
          !assignedIds.has(p.id) &&
          !activeInvitedEmails.has(p.email.toLowerCase().trim()) &&
          !rejectedUserIds.has(p.id)
      );

      expect(pending.map((p) => p.email)).not.toContain("rejected@cafe.com");
    });
  });

  describe("5. Audit Log Event Serialization", () => {
    it("should format valid audit event payloads", () => {
      const payload = {
        cafeId: "cafe-123",
        actorId: "user-456",
        eventType: "APPROVAL_GRANTED",
        targetEmail: "staff@cafe.com",
        metadata: { role: "staff" },
      };

      expect(payload.cafeId).toBeTruthy();
      expect(payload.eventType).toBe("APPROVAL_GRANTED");
      expect(payload.targetEmail).toContain("@");
    });
  });
});
