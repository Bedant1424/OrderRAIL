import { describe, it, expect } from "vitest";
import { getOrderLastActivity } from "../pages/staff/StaffDashboardPage";

describe("Staff Dashboard Activity-Based Sorting", () => {
  it("should calculate correct lastActivity timestamp based on order created_at for new orders", () => {
    const order = {
      created_at: "2026-07-10T10:00:00.000Z",
      updated_at: null,
      dining_session_id: "session-1",
      session_id: "session-1"
    };
    
    const serviceRequests: any[] = [];
    
    const activity = getOrderLastActivity(order, serviceRequests);
    expect(activity).toBe(new Date("2026-07-10T10:00:00.000Z").getTime());
  });

  it("should calculate correct lastActivity based on order updated_at when order is modified by customer or staff", () => {
    const order = {
      created_at: "2026-07-10T10:00:00.000Z",
      updated_at: "2026-07-10T10:05:00.000Z",
      dining_session_id: "session-1",
      session_id: "session-1"
    };
    
    const serviceRequests: any[] = [];
    
    const activity = getOrderLastActivity(order, serviceRequests);
    expect(activity).toBe(new Date("2026-07-10T10:05:00.000Z").getTime());
  });

  it("should calculate correct lastActivity based on service request created_at for the same dining session", () => {
    const order = {
      created_at: "2026-07-10T10:00:00.000Z",
      updated_at: "2026-07-10T10:05:00.000Z",
      dining_session_id: "session-1",
      session_id: "session-1"
    };
    
    const serviceRequests = [
      {
        created_at: "2026-07-10T10:10:00.000Z",
        updated_at: null,
        session_id: "session-1"
      }
    ];
    
    const activity = getOrderLastActivity(order, serviceRequests);
    expect(activity).toBe(new Date("2026-07-10T10:10:00.000Z").getTime());
  });

  it("should calculate correct lastActivity based on service request updated_at when a request is resolved", () => {
    const order = {
      created_at: "2026-07-10T10:00:00.000Z",
      updated_at: "2026-07-10T10:05:00.000Z",
      dining_session_id: "session-1",
      session_id: "session-1"
    };
    
    const serviceRequests = [
      {
        created_at: "2026-07-10T10:10:00.000Z",
        updated_at: "2026-07-10T10:12:00.000Z",
        session_id: "session-1"
      }
    ];
    
    const activity = getOrderLastActivity(order, serviceRequests);
    expect(activity).toBe(new Date("2026-07-10T10:12:00.000Z").getTime());
  });

  it("should ignore service requests belonging to other dining sessions", () => {
    const order = {
      created_at: "2026-07-10T10:00:00.000Z",
      updated_at: "2026-07-10T10:05:00.000Z",
      dining_session_id: "session-1",
      session_id: "session-1"
    };
    
    const serviceRequests = [
      {
        created_at: "2026-07-10T10:10:00.000Z",
        updated_at: "2026-07-10T10:12:00.000Z",
        session_id: "session-2" // different session
      }
    ];
    
    const activity = getOrderLastActivity(order, serviceRequests);
    expect(activity).toBe(new Date("2026-07-10T10:05:00.000Z").getTime()); // should remain order updated_at
  });
});
