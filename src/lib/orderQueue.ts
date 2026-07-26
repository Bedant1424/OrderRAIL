// Offline queue for order placement. Attempts to submit; on failure or offline,
// stores payload and flushes on `online` event.
import { supabase } from "@/integrations/supabase/client";
import { createOrderInDb } from "@/lib/orders/repository";

export interface QueuedOrder {
  id: string;
  cafe_id: string;
  table_id: string;
  session_id: string;
  dining_session_id?: string | null;
  guest_session_id?: string | null;
  note?: string | null;
  total_cents: number;
  items: {
    menu_item_id: string;
    name: string;
    price_cents: number;
    qty: number;
  }[];
  queuedAt: number;
}

const KEY = "orderrail.order_queue";

function read(): QueuedOrder[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}
function write(q: QueuedOrder[]) {
  localStorage.setItem(KEY, JSON.stringify(q));
}

export async function submitOrder(payload: Omit<QueuedOrder, "queuedAt">): Promise<{ orderId: string; queued: boolean }> {
  const full: QueuedOrder = { ...payload, queuedAt: Date.now() };
  if (!navigator.onLine) {
    write([...read(), full]);
    return { orderId: full.id, queued: true };
  }
  try {
    await pushOne(full);
    return { orderId: full.id, queued: false };
  } catch (e) {
    console.warn("Order submit failed, queueing", e);
    write([...read(), full]);
    return { orderId: full.id, queued: true };
  }
}

async function pushOne(o: QueuedOrder) {
  await createOrderInDb(o);
}

export async function flushQueue() {
  const queue = read();
  if (!queue.length) return;
  const remaining: QueuedOrder[] = [];
  for (const o of queue) {
    try {
      await pushOne(o);
    } catch {
      remaining.push(o);
    }
  }
  write(remaining);
}

export function initOfflineSync() {
  if (typeof window === "undefined") return;
  window.addEventListener("online", () => {
    void flushQueue();
  });
  // Try on load too
  if (navigator.onLine) void flushQueue();
}
