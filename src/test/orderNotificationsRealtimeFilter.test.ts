import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useOrderNotifications } from "@/hooks/useOrderNotifications";
import { supabase } from "@/lib/db";
import { toast } from "@/components/ui/sonner";

// Mock customer navigation hook
const mockNavigate = vi.fn();
vi.mock("@/hooks/useCustomerBack", () => ({
  useCustomerNavigate: () => mockNavigate,
}));

// Mock Sonner toast
vi.mock("@/components/ui/sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

describe("Milestone 5A.3 - Order Notifications Realtime Filter Regression Tests", () => {
  let channelsCreated: Array<{
    name: string;
    bindings: Array<{
      type: string;
      filterConfig: { event: string; schema: string; table: string; filter?: string };
      callback: (payload: any) => void;
    }>;
    channelObj: any;
  }>;
  let channelsRemoved: any[];

  beforeEach(() => {
    vi.restoreAllMocks();
    mockNavigate.mockReset();
    vi.mocked(toast.success).mockReset();

    channelsCreated = [];
    channelsRemoved = [];

    // Spy on supabase.channel and capture subscription configuration
    vi.spyOn(supabase, "channel").mockImplementation((channelName: string) => {
      const channelRecord: {
        name: string;
        bindings: Array<{
          type: string;
          filterConfig: { event: string; schema: string; table: string; filter?: string };
          callback: (payload: any) => void;
        }>;
        channelObj: any;
      } = {
        name: channelName,
        bindings: [],
        channelObj: null,
      };

      const mockChannelObj = {
        name: channelName,
        on: vi.fn((type: string, filterConfig: any, callback: any) => {
          channelRecord.bindings.push({ type, filterConfig, callback });
          return mockChannelObj;
        }),
        subscribe: vi.fn((statusCallback?: (status: string) => void) => {
          if (statusCallback) statusCallback("SUBSCRIBED");
          return mockChannelObj;
        }),
      };

      channelRecord.channelObj = mockChannelObj;
      channelsCreated.push(channelRecord);
      return mockChannelObj as any;
    });

    // Spy on supabase.removeChannel
    vi.spyOn(supabase, "removeChannel").mockImplementation((ch: any) => {
      channelsRemoved.push(ch);
      return Promise.resolve("ok" as any);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // 1. Session ID null -> No subscription created
  it("A. When sessionId is null, no Realtime channel is subscribed", () => {
    const { unmount } = renderHook(() =>
      useOrderNotifications({ tableId: "4", sessionId: null })
    );

    expect(channelsCreated.length).toBe(0);
    expect(supabase.channel).not.toHaveBeenCalled();

    unmount();
    expect(channelsRemoved.length).toBe(0);
  });

  // 2. Active Session -> Strict dining_session_id filter configured
  it("B. When sessionId is provided, subscription strictly scopes to dining_session_id", () => {
    const testSessionId = "aaaaaaaa-1111-2222-3333-444444444444";
    const testTableId = "4";

    const { unmount } = renderHook(() =>
      useOrderNotifications({ tableId: testTableId, sessionId: testSessionId })
    );

    expect(channelsCreated.length).toBe(1);
    const created = channelsCreated[0];

    // Verify channel name
    expect(created.name).toBe(`order-notifications-${testSessionId}`);

    // Verify postgres_changes configuration
    expect(created.bindings.length).toBe(1);
    const binding = created.bindings[0];
    expect(binding.type).toBe("postgres_changes");
    expect(binding.filterConfig.event).toBe("UPDATE");
    expect(binding.filterConfig.schema).toBe("public");
    expect(binding.filterConfig.table).toBe("orders");

    // Exact filter assertion
    expect(binding.filterConfig.filter).toBe(`dining_session_id=eq.${testSessionId}`);

    // Negative assertions: MUST NOT configure other/improper filters or be unfiltered
    expect(binding.filterConfig.filter).not.toBeUndefined();
    expect(binding.filterConfig.filter).not.toContain("table_id");
    expect(binding.filterConfig.filter).not.toContain("guest_session_id");
    expect(binding.filterConfig.filter).not.toContain("cafe_id");

    unmount();
    expect(channelsRemoved.length).toBe(1);
    expect(channelsRemoved[0]).toBe(created.channelObj);
  });

  // 3. Session Lifecycle: Transition from Session A to Session B
  it("C. When session transitions from Session A to Session B, Session A is removed and Session B is subscribed", () => {
    const sessionA = "11111111-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
    const sessionB = "22222222-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

    const { rerender, unmount } = renderHook(
      ({ sessionId }) => useOrderNotifications({ tableId: "4", sessionId }),
      { initialProps: { sessionId: sessionA } }
    );

    expect(channelsCreated.length).toBe(1);
    expect(channelsCreated[0].bindings[0].filterConfig.filter).toBe(`dining_session_id=eq.${sessionA}`);
    const channelAObj = channelsCreated[0].channelObj;

    // Transition to Session B
    rerender({ sessionId: sessionB });

    // Verify channel A was removed
    expect(channelsRemoved.length).toBe(1);
    expect(channelsRemoved[0]).toBe(channelAObj);

    // Verify channel B was created with exact filter for Session B
    expect(channelsCreated.length).toBe(2);
    const channelB = channelsCreated[1];
    expect(channelB.name).toBe(`order-notifications-${sessionB}`);
    expect(channelB.bindings[0].filterConfig.filter).toBe(`dining_session_id=eq.${sessionB}`);

    // Unmount cleans up channel B
    unmount();
    expect(channelsRemoved.length).toBe(2);
    expect(channelsRemoved[1]).toBe(channelB.channelObj);
  });

  // 4. Multi-Guest Same Session Semantics & Order Ready Toast Trigger
  it("D. Multi-guest party sharing same dining session receive order-ready toast for any order in session", () => {
    const sharedDiningSession = "33333333-cccc-cccc-cccc-cccccccccccc";
    const tableId = "table-12";

    // Guest 1 mounts hook
    const { unmount: unmountGuest1 } = renderHook(() =>
      useOrderNotifications({ tableId, sessionId: sharedDiningSession })
    );

    // Guest 2 mounts hook
    const { unmount: unmountGuest2 } = renderHook(() =>
      useOrderNotifications({ tableId, sessionId: sharedDiningSession })
    );

    expect(channelsCreated.length).toBe(2);
    const guest1Binding = channelsCreated[0].bindings[0];
    const guest2Binding = channelsCreated[1].bindings[0];

    expect(guest1Binding.filterConfig.filter).toBe(`dining_session_id=eq.${sharedDiningSession}`);
    expect(guest2Binding.filterConfig.filter).toBe(`dining_session_id=eq.${sharedDiningSession}`);

    // Order placed by Guest 1 is marked 'ready' by kitchen
    const guest1OrderUpdatePayload = {
      new: {
        id: "order-101",
        dining_session_id: sharedDiningSession,
        guest_session_id: "guest-device-1",
        status: "ready",
        order_number: 5,
        daily_order_number: 5,
      },
    };

    // Both Guest 1 and Guest 2 callbacks receive the event
    guest1Binding.callback(guest1OrderUpdatePayload);
    guest2Binding.callback(guest1OrderUpdatePayload);

    // Both guests see toast notification
    expect(toast.success).toHaveBeenCalledTimes(2);
    expect(toast.success).toHaveBeenCalledWith(
      "Your order is ready! 🎉",
      expect.objectContaining({
        description: expect.stringContaining("5"),
        action: expect.objectContaining({
          label: "View order",
        }),
      })
    );

    // Simulate clicking "View order" on toast action
    const toastCall = vi.mocked(toast.success).mock.calls[0];
    const toastOptions = toastCall[1] as any;
    toastOptions.action.onClick();
    expect(mockNavigate).toHaveBeenCalledWith(`/t/${tableId}/order/order-101`);

    unmountGuest1();
    unmountGuest2();
  });

  // 5. Cross-Session / Cross-Tenant Payload Rejection (Defense-in-Depth)
  it("E. Callback ignores payload if dining_session_id does not match active session", () => {
    const sessionActive = "44444444-dddd-dddd-dddd-dddddddddddd";
    const foreignSession = "99999999-zzzz-zzzz-zzzz-zzzzzzzzzzzz";

    const { unmount } = renderHook(() =>
      useOrderNotifications({ tableId: "4", sessionId: sessionActive })
    );

    const binding = channelsCreated[0].bindings[0];

    // Simulate foreign order arriving (e.g. from an old seating or other table)
    const foreignOrderPayload = {
      new: {
        id: "foreign-order-999",
        dining_session_id: foreignSession,
        status: "ready",
        order_number: 99,
      },
    };

    binding.callback(foreignOrderPayload);

    // Toast MUST NOT be called for foreign session
    expect(toast.success).not.toHaveBeenCalled();

    unmount();
  });
});
