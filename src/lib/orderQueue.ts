// Offline queue for order placement integrated with Operations Engine & OrderService
import { OrderService } from "@/lib/orders/orderService";
import { createOrderInDb } from "@/lib/orders/repository";
import { SyncManager } from "@/lib/offline";

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

  try {
    const res = await OrderService.createOrder(payload);
    if (res.queued) {
      write([...read(), full]);
    } else {
      write(read().filter((item) => item.id !== payload.id));
    }
    return { orderId: res.orderId, queued: res.queued };
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
  if (queue.length > 0) {
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
  await SyncManager.startSync();
}

export function initOfflineSync() {
  if (typeof window === "undefined") return;
  window.addEventListener("online", () => {
    void flushQueue();
  });
  if (navigator.onLine) void flushQueue();
}
