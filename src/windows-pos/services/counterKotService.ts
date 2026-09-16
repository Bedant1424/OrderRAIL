import { KotBuilder, type KotBuilderPayload, type KotBuildResult } from "@/lib/printing/kotBuilder";
import type { CounterOrder } from "../types/counterTypes";

export interface GeneratedCounterKot {
  text: string;
  escpos: string;
  rawBytes: Uint8Array;
}

/**
 * Converts binary ESC/POS string characters to raw byte array
 */
export function escposStringToBytes(escpos: string): Uint8Array {
  const bytes = new Uint8Array(escpos.length);
  for (let i = 0; i < escpos.length; i++) {
    bytes[i] = escpos.charCodeAt(i) & 0xff;
  }
  return bytes;
}

/**
 * Formats ISO timestamp to standard 12-hour receipt string
 */
function formatTimestamp(isoString?: string): string {
  try {
    if (!isoString) return new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
    return new Date(isoString).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
  } catch {
    return new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
  }
}

/**
 * Generates standard 58mm KOT text and raw ESC/POS byte payload from a CounterOrder
 */
export function generateCounterKot(
  order: CounterOrder,
  tableLabel: string,
  restaurantName: string = "Cheese Corner",
  paperWidth: 58 | 80 = 58
): GeneratedCounterKot {
  const payload: KotBuilderPayload = {
    restaurantName,
    kotNumber: order.orderNumber,
    orderNumber: order.orderNumber,
    tableLabel: tableLabel || "Dine-In",
    timestamp: formatTimestamp(order.createdAt),
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    orderSource: order.orderSource || "DINE_IN",
    externalOrderRef: order.externalOrderRef || null,
    specialInstructions: order.isOfflineCreated ? "[OFFLINE ORDER - PENDING SYNC]" : undefined,
    notes: order.note || undefined,
    items: order.items.map((it) => ({
      name: it.name,
      qty: it.qty,
      notes: it.note || undefined,
    })),
  };

  const buildResult: KotBuildResult = KotBuilder.build(payload, paperWidth);
  const rawBytes = escposStringToBytes(buildResult.escpos);

  return {
    text: buildResult.text,
    escpos: buildResult.escpos,
    rawBytes,
  };
}
