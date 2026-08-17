import { supabase, type Order } from "@/lib/db";
import { normalizePhoneNumber } from "./phoneNormalization";

export interface CustomerDBRow {
  id: string;
  cafe_id: string;
  phone: string;
  normalized_phone: string;
  name: string | null;
  visit_count: number;
  total_spend_cents: number;
  first_visit_at: string | null;
  last_visit_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CustomerProfile {
  id: string;
  name: string;
  phone: string | null;
  normalizedPhone?: string;
  visitCount: number;
  lifetimeSpendCents: number;
  averageBillCents: number;
  firstVisit: string;
  lastVisit: string;
  preferredChannel: string;
  channelCounts: Record<string, number>;
  orders: Order[];
  bills?: any[];
}

/**
 * Resolves an existing customer profile by (cafeId, normalized_phone) or creates a new one.
 * Uses atomic RPC resolve_or_create_customer if available, with robust client-side fallback.
 * Returns customer UUID or null if phone is absent.
 */
export async function resolveOrCreateCustomerProfile(params: {
  cafeId: string;
  phone?: string | null;
  name?: string | null;
}): Promise<string | null> {
  const { cafeId, phone, name } = params;
  const normPhone = normalizePhoneNumber(phone);

  if (!cafeId || !normPhone) {
    return null;
  }

  const cleanName = name?.trim() || null;
  const cleanPhone = phone?.trim() || normPhone;
  const effectiveName = cleanName || normPhone;

  // 1. Try atomic RPC first
  try {
    const { data: rpcId, error: rpcErr } = await supabase.rpc("resolve_or_create_customer", {
      p_cafe_id: cafeId,
      p_phone: cleanPhone,
      p_normalized_phone: normPhone,
      p_name: cleanName,
    });

    if (!rpcErr && rpcId) {
      return rpcId as string;
    }
  } catch (e) {
    console.warn("[resolveOrCreateCustomerProfile] RPC notice, using client fallback:", e);
  }

  // 2. Fallback: Direct DB query & insert/update
  try {
    const { data: existing, error: fetchErr } = await supabase
      .from("customers")
      .select("id, name")
      .eq("cafe_id", cafeId)
      .eq("normalized_phone", normPhone)
      .maybeSingle();

    if (!fetchErr && existing) {
      const existingNameTrimmed = existing.name?.trim();
      const isExistingPhoneFallback =
        !existingNameTrimmed ||
        existingNameTrimmed === normPhone ||
        existingNameTrimmed === cleanPhone;

      if (cleanName && isExistingPhoneFallback) {
        await supabase
          .from("customers")
          .update({ name: cleanName, updated_at: new Date().toISOString() })
          .eq("id", existing.id);
      }
      return existing.id;
    }

    const { data: inserted, error: insErr } = await supabase
      .from("customers")
      .insert({
        cafe_id: cafeId,
        phone: cleanPhone,
        normalized_phone: normPhone,
        name: effectiveName,
        visit_count: 0,
        total_spend_cents: 0,
      })
      .select("id")
      .maybeSingle();

    if (!insErr && inserted?.id) {
      return inserted.id;
    }
  } catch (e) {
    console.warn("[resolveOrCreateCustomerProfile] Fallback error:", e);
  }

  return null;
}

/**
 * Records customer payment settlement. Increments visit count and settled spend.
 */
export async function recordCustomerSettlement(params: {
  customerId: string;
  amountCents: number;
  visitAt?: string;
}): Promise<void> {
  const { customerId, amountCents, visitAt } = params;
  if (!customerId) return;

  const validAmount = Math.max(0, Math.round(amountCents || 0));
  const effectiveDate = visitAt || new Date().toISOString();

  // Try RPC
  try {
    const { error: rpcErr } = await supabase.rpc("record_customer_settlement", {
      p_customer_id: customerId,
      p_amount_cents: validAmount,
      p_visit_at: effectiveDate,
    });

    if (!rpcErr) return;
  } catch (e) {
    console.warn("[recordCustomerSettlement] RPC notice, using fallback:", e);
  }

  // Fallback direct update
  try {
    const { data: cust } = await supabase
      .from("customers")
      .select("visit_count, total_spend_cents, first_visit_at")
      .eq("id", customerId)
      .maybeSingle();

    if (cust) {
      const currentVisits = cust.visit_count || 0;
      const currentSpend = Number(cust.total_spend_cents) || 0;
      const firstVisit = cust.first_visit_at || effectiveDate;

      await supabase
        .from("customers")
        .update({
          visit_count: currentVisits + 1,
          total_spend_cents: currentSpend + validAmount,
          first_visit_at: firstVisit,
          last_visit_at: effectiveDate,
          updated_at: new Date().toISOString(),
        })
        .eq("id", customerId);
    }
  } catch (e) {
    console.warn("[recordCustomerSettlement] Fallback notice:", e);
  }
}

/**
 * Fetches canonical customer profiles for a specific cafe from public.customers table.
 * Merges settled bills and orders associated with customer_id.
 */
export async function fetchCafeCustomerProfiles(cafeId: string): Promise<CustomerProfile[]> {
  if (!cafeId) return [];

  try {
    // 1. Fetch all customer rows for cafe
    const { data: customerRows, error: custErr } = await supabase
      .from("customers")
      .select("*")
      .eq("cafe_id", cafeId)
      .order("total_spend_cents", { ascending: false });

    if (custErr || !customerRows || customerRows.length === 0) {
      return [];
    }

    // 2. Fetch all paid/settled bills for these customers
    const customerIds = customerRows.map((c) => c.id);
    const { data: billRows } = await supabase
      .from("bills")
      .select("*")
      .eq("cafe_id", cafeId)
      .in("customer_id", customerIds)
      .eq("payment_status", "PAID");

    // 3. Fetch all orders associated with customer_id or linked to customer bills
    const { data: orderRows } = await supabase
      .from("orders")
      .select("*, order_items(*)")
      .eq("cafe_id", cafeId)
      .in("customer_id", customerIds);

    const billsByCust = new Map<string, any[]>();
    (billRows || []).forEach((b) => {
      if (b.customer_id) {
        const list = billsByCust.get(b.customer_id) || [];
        list.push(b);
        billsByCust.set(b.customer_id, list);
      }
    });

    const ordersByCust = new Map<string, Order[]>();
    (orderRows || []).forEach((o) => {
      if (o.customer_id) {
        const list = ordersByCust.get(o.customer_id) || [];
        list.push(o as unknown as Order);
        ordersByCust.set(o.customer_id, list);
      }
    });

    return customerRows.map((c: CustomerDBRow) => {
      const custBills = billsByCust.get(c.id) || [];
      const custOrders = ordersByCust.get(c.id) || [];

      // Calculate lifetime spend from settled bills if available, fallback to total_spend_cents
      const settledBillSpendCents = custBills.reduce(
        (sum, b) => sum + Math.round(Number(b.grand_total || 0) * 100),
        0
      );
      const lifetimeSpendCents = Math.max(Number(c.total_spend_cents || 0), settledBillSpendCents);

      const visitCount = Math.max(c.visit_count || 0, custBills.length, custOrders.length);
      const averageBillCents = visitCount > 0 ? Math.round(lifetimeSpendCents / visitCount) : 0;

      // Determine preferred channel from orders/bills
      const channelCounts: Record<string, number> = {};
      custOrders.forEach((o) => {
        const ch = o.order_source || (o as any).order_type || "dine_in";
        channelCounts[ch] = (channelCounts[ch] || 0) + 1;
      });
      custBills.forEach((b) => {
        const ch = (b.order_type || "dine_in").toLowerCase();
        channelCounts[ch] = (channelCounts[ch] || 0) + 1;
      });

      let preferredChannel = "dine_in";
      let maxCount = 0;
      for (const [ch, count] of Object.entries(channelCounts)) {
        if (count > maxCount) {
          maxCount = count;
          preferredChannel = ch;
        }
      }

      return {
        id: c.id,
        name: c.name || (c.phone ? `Customer (${c.phone})` : "Walk-in Customer"),
        phone: c.phone || null,
        normalizedPhone: c.normalized_phone,
        visitCount,
        lifetimeSpendCents,
        averageBillCents,
        firstVisit: c.first_visit_at || c.created_at,
        lastVisit: c.last_visit_at || c.created_at,
        preferredChannel,
        channelCounts,
        orders: custOrders,
        bills: custBills,
      };
    });
  } catch (e) {
    console.warn("[fetchCafeCustomerProfiles] Error:", e);
    return [];
  }
}

/**
 * Legacy fallback: Aggregates historical orders into unique customer profiles.
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
    const isCompleted = o.status === "served" || o.status === "completed";
    
    const phone = o.customer_phone?.trim() || null;
    const rawName = o.customer_name?.trim() || "";
    const name = rawName || (phone ? `Customer (${phone})` : "Walk-in Customer");
    
    const normPhone = normalizePhoneNumber(phone);
    const key = normPhone
      ? `phone:${normPhone}`
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
    if (options?.excludeWalkins) {
      const isAnonymousWalkin = !entry.phone && (!entry.name || entry.name === "Walk-in Customer");
      if (isAnonymousWalkin) continue;
    }

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

  return profiles.sort((a, b) => b.lifetimeSpendCents - a.lifetimeSpendCents);
}
