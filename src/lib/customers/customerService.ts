import type { Order } from "@/lib/db";

export interface CustomerProfile {
  id: string; // Phone number or lowercased customer name key
  name: string;
  phone: string | null;
  visitCount: number;
  lifetimeSpendCents: number;
  averageBillCents: number;
  firstVisit: string;
  lastVisit: string;
  preferredChannel: string;
  channelCounts: Record<string, number>;
  orders: Order[];
}

/**
 * Aggregates historical orders into unique customer profiles.
 * Groups primarily by customer phone number, falling back to customer name.
 * Computes: Visit Count, Lifetime Spend, Average Bill, First & Last Visit dates, Preferred Channel.
 */
export function aggregateCustomerProfiles(
  orders: Order[],
  options?: { excludeWalkins?: boolean }
): CustomerProfile[] {
  const customerMap = new Map<string, {
    id: string;
    name: string;
    phone: string | null;
    visitCount: number;
    lifetimeSpendCents: number;
    firstVisitMs: number;
    lastVisitMs: number;
    channelCounts: Record<string, number>;
    orders: Order[];
  }>();

  for (const o of orders) {
    // Only aggregate completed / served orders for visit count & lifetime spend metrics
    const isCompleted = o.status === "served" || o.status === "completed";
    
    // Grouping key: Phone number if present, else customer name if present, else fallback per order
    const phone = o.customer_phone?.trim() || null;
    const rawName = o.customer_name?.trim() || "";
    const name = rawName || (phone ? `Customer (${phone})` : "Walk-in Customer");
    
    const key = phone
      ? `phone:${phone}`
      : rawName
      ? `name:${rawName.toLowerCase()}`
      : `walkin:${o.id}`;

    const createdMs = o.created_at ? new Date(o.created_at).getTime() : Date.now();
    const orderChannel = o.order_source || o.order_type || "dine_in";

    let existing = customerMap.get(key);
    if (!existing) {
      existing = {
        id: key,
        name: name,
        phone: phone,
        visitCount: 0,
        lifetimeSpendCents: 0,
        firstVisitMs: createdMs,
        lastVisitMs: createdMs,
        channelCounts: {},
        orders: [],
      };
      customerMap.set(key, existing);
    }

    if (isCompleted) {
      existing.visitCount += 1;
      existing.lifetimeSpendCents += (o.total_cents || 0);
    }

    existing.orders.push(o);
    if (createdMs < existing.firstVisitMs) existing.firstVisitMs = createdMs;
    if (createdMs > existing.lastVisitMs) existing.lastVisitMs = createdMs;

    existing.channelCounts[orderChannel] = (existing.channelCounts[orderChannel] || 0) + 1;
  }

  const profiles: CustomerProfile[] = [];

  for (const entry of customerMap.values()) {
    // Walk-in customers without phone or custom name are excluded when excludeWalkins is true
    if (options?.excludeWalkins) {
      const isAnonymousWalkin = !entry.phone && (!entry.name || entry.name === "Walk-in Customer");
      if (isAnonymousWalkin) continue;
    }

    // Determine preferred channel
    let preferredChannel = "dine_in";
    let maxChannelCount = 0;
    for (const [ch, count] of Object.entries(entry.channelCounts)) {
      if (count > maxChannelCount) {
        maxChannelCount = count;
        preferredChannel = ch;
      }
    }

    const averageBillCents = entry.visitCount > 0 ? Math.round(entry.lifetimeSpendCents / entry.visitCount) : 0;

    profiles.push({
      id: entry.id,
      name: entry.name,
      phone: entry.phone,
      visitCount: entry.visitCount,
      lifetimeSpendCents: entry.lifetimeSpendCents,
      averageBillCents,
      firstVisit: new Date(entry.firstVisitMs).toISOString(),
      lastVisit: new Date(entry.lastVisitMs).toISOString(),
      preferredChannel,
      channelCounts: entry.channelCounts,
      orders: entry.orders,
    });
  }

  // Sort by lifetime spend descending
  return profiles.sort((a, b) => b.lifetimeSpendCents - a.lifetimeSpendCents);
}
