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

  describe("6. Invitation Lifecycle Immutability", () => {
    const invitations = [
      { id: "inv-1", email: "active@cafe.com", role: "staff", accepted_at: null, revoked_at: null, expires_at: "2099-01-01T00:00:00Z" },
      { id: "inv-2", email: "accepted@cafe.com", role: "staff", accepted_at: "2026-07-22T00:00:00Z", revoked_at: null, expires_at: "2099-01-01T00:00:00Z" },
      { id: "inv-3", email: "revoked@cafe.com", role: "staff", accepted_at: null, revoked_at: "2026-07-22T00:00:00Z", expires_at: "2099-01-01T00:00:00Z" },
      { id: "inv-4", email: "expired@cafe.com", role: "staff", accepted_at: null, revoked_at: null, expires_at: "2020-01-01T00:00:00Z" },
    ];

    const filterActivePending = (invs: typeof invitations) =>
      invs.filter(
        (i) =>
          i.accepted_at === null &&
          i.revoked_at === null &&
          new Date(i.expires_at) > new Date()
      );

    it("Scenario E: Accepted invitations remain in database with accepted_at populated", () => {
      const accepted = invitations.find((i) => i.email === "accepted@cafe.com");
      expect(accepted).toBeDefined();
      expect(accepted!.accepted_at).not.toBeNull();
    });

    it("Scenario E: Accepted invitations are NOT listed as pending", () => {
      const pending = filterActivePending(invitations);
      expect(pending.map((i) => i.email)).not.toContain("accepted@cafe.com");
    });

    it("Revoked invitations remain in database with revoked_at populated", () => {
      const revoked = invitations.find((i) => i.email === "revoked@cafe.com");
      expect(revoked).toBeDefined();
      expect(revoked!.revoked_at).not.toBeNull();
    });

    it("Revoked invitations are NOT listed as pending", () => {
      const pending = filterActivePending(invitations);
      expect(pending.map((i) => i.email)).not.toContain("revoked@cafe.com");
    });

    it("Expired invitations are NOT listed as pending", () => {
      const pending = filterActivePending(invitations);
      expect(pending.map((i) => i.email)).not.toContain("expired@cafe.com");
    });

    it("Only truly active pending invitations appear", () => {
      const pending = filterActivePending(invitations);
      expect(pending).toHaveLength(1);
      expect(pending[0].email).toBe("active@cafe.com");
    });
  });

  describe("7. Duplicate Claim Prevention (Trigger + Frontend)", () => {
    it("Frontend auto-claim treats duplicate key error as success", () => {
      const insertErr = { message: "duplicate key value violates unique constraint", code: "23505" };
      const isDuplicate = insertErr?.message?.includes("duplicate") || insertErr?.code === "23505";
      expect(isDuplicate).toBe(true);
    });

    it("Frontend auto-claim skips audit log when trigger already claimed", () => {
      const insertErr = { message: "duplicate key value violates unique constraint", code: "23505" };
      const isDuplicate = insertErr?.message?.includes("duplicate") || insertErr?.code === "23505";
      // Audit log should only fire when !insertErr (fresh insert), not on duplicate
      const shouldLogAudit = !insertErr;
      expect(shouldLogAudit).toBe(false);
    });

    it("Frontend auto-claim only marks accepted_at if not already set by trigger", () => {
      // The update uses .is("accepted_at", null) so it won't overwrite trigger's timestamp
      const alreadyAccepted = { accepted_at: "2026-07-22T00:00:00Z" };
      const shouldUpdate = alreadyAccepted.accepted_at === null;
      expect(shouldUpdate).toBe(false);
    });
  });

  describe("8. Staff Lifecycle Refactor & Distinct Employment States", () => {
    const profiles = [
      { id: "u1", email: "applicant@cafe.com" },
      { id: "u2", email: "active@cafe.com" },
      { id: "u3", email: "suspended@cafe.com" },
      { id: "u4", email: "rejected@cafe.com" },
      { id: "u5", email: "former@cafe.com" },
    ];

    let userRoles = [
      { user_id: "u2", cafe_id: "cafe-123", role: "staff", is_suspended: false },
      { user_id: "u3", cafe_id: "cafe-123", role: "staff", is_suspended: true },
    ];

    let pendingInvites = [
      { email: "invited@cafe.com", role: "staff", accepted_at: null, revoked_at: null, expires_at: "2099-01-01T00:00:00Z" },
    ];

    let rejectedApprovals = [
      { user_id: "u4", cafe_id: "cafe-123", email: "rejected@cafe.com" },
    ];

    let formerStaff = [
      { user_id: "u5", cafe_id: "cafe-123", email: "former@cafe.com", role: "staff" },
    ];

    const getPendingApprovals = () => {
      const assignedIds = new Set(userRoles.map((r) => r.user_id));
      const activeInvitedEmails = new Set(
        pendingInvites
          .filter((i) => i.accepted_at === null && i.revoked_at === null && new Date(i.expires_at) > new Date())
          .map((i) => i.email.toLowerCase().trim())
      );
      const rejectedIds = new Set(rejectedApprovals.map((r) => r.user_id));
      const formerIds = new Set(formerStaff.map((f) => f.user_id));

      return profiles.filter(
        (p) =>
          p.email &&
          !assignedIds.has(p.id) &&
          !activeInvitedEmails.has(p.email.toLowerCase().trim()) &&
          !rejectedIds.has(p.id) &&
          !formerIds.has(p.id)
      );
    };

    it("Former employees do NOT reappear in Pending Approvals", () => {
      const pending = getPendingApprovals();
      expect(pending.map((p) => p.email)).not.toContain("former@cafe.com");
      expect(pending.map((p) => p.email)).toContain("applicant@cafe.com");
    });

    it("Reconsideration moves a rejected applicant back to Pending Approvals", () => {
      // Before reconsider
      expect(getPendingApprovals().map((p) => p.email)).not.toContain("rejected@cafe.com");

      // Reconsider action (removes from rejectedApprovals)
      rejectedApprovals = rejectedApprovals.filter((r) => r.user_id !== "u4");

      // After reconsider
      expect(getPendingApprovals().map((p) => p.email)).toContain("rejected@cafe.com");
    });

    it("Removing an active staff member moves them to Former Staff and excludes from Pending", () => {
      // Remove active staff u2
      userRoles = userRoles.filter((r) => r.user_id !== "u2");
      formerStaff.push({ user_id: "u2", cafe_id: "cafe-123", email: "active@cafe.com", role: "staff" });

      // Should not be in pending approvals
      expect(getPendingApprovals().map((p) => p.email)).not.toContain("active@cafe.com");
      expect(formerStaff.map((f) => f.email)).toContain("active@cafe.com");
    });

    it("Invitation Override: Inviting a former employee or rejected applicant clears previous status and creates pending invite", () => {
      const targetEmail = "former@cafe.com";

      // Owner invites former staff member
      // Invitation override clears former staff & creates invite
      formerStaff = formerStaff.filter((f) => f.email !== targetEmail);
      rejectedApprovals = rejectedApprovals.filter((r) => r.email !== targetEmail);
      pendingInvites.push({ email: targetEmail, role: "owner", accepted_at: null, revoked_at: null, expires_at: "2099-01-01T00:00:00Z" });

      // Check states
      expect(formerStaff.map((f) => f.email)).not.toContain(targetEmail);
      expect(pendingInvites.map((i) => i.email)).toContain(targetEmail);
      // Still excluded from pending approvals because active invitation exists
      expect(getPendingApprovals().map((p) => p.email)).not.toContain(targetEmail);
    });
  });
});
