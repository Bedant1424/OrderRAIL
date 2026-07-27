/**
 * Sprint 9.2.3.2 — KOT Renderer
 * Formats Kitchen Order Tickets for 58mm and 80mm thermal receipt printers.
 */

export interface KotRenderItem {
  id?: string;
  name: string;
  price: number;
  qty: number;
  notes?: string;
}

export interface KotRenderPayload {
  orderId: string;
  orderNumber: number | string;
  kotNumber: number | string;
  tableLabel: string;
  timestamp: string;
  items: KotRenderItem[];
  notes?: string;
  isReprint?: boolean;
}

export function renderKotText(payload: KotRenderPayload, widthmm: 58 | 80 = 80): string {
  const lineCharWidth = widthmm === 58 ? 32 : 48;
  const divider = "-".repeat(lineCharWidth);
  const doubleDivider = "=".repeat(lineCharWidth);

  const center = (text: string): string => {
    if (text.length >= lineCharWidth) return text.substring(0, lineCharWidth);
    const pad = Math.floor((lineCharWidth - text.length) / 2);
    return " ".repeat(pad) + text;
  };

  const justify = (left: string, right: string): string => {
    const spaceLength = lineCharWidth - left.length - right.length;
    if (spaceLength <= 0) {
      return `${left.substring(0, lineCharWidth - right.length - 1)} ${right}`;
    }
    return left + " ".repeat(spaceLength) + right;
  };

  const lines: string[] = [];

  // Header
  lines.push(doubleDivider);
  lines.push(center("*** KITCHEN ORDER TICKET ***"));
  if (payload.isReprint) {
    lines.push(center("** REPRINT **"));
  }
  lines.push(doubleDivider);

  // Metadata
  const rawLabel = payload.tableLabel || "Express";
  const cleanLabel = rawLabel.toLowerCase().startsWith("table") ? rawLabel : `Table ${rawLabel}`;

  lines.push(justify(`KOT #: ${payload.kotNumber}`, `Order #: ${payload.orderNumber}`));
  lines.push(justify(`${cleanLabel}`, payload.timestamp));
  lines.push(divider);

  // Items Header
  lines.push(justify("QTY  ITEM DESCRIPTION", "TOTAL"));
  lines.push(divider);

  // Items List
  let subtotal = 0;
  for (const item of payload.items) {
    const itemTotal = (item.price || 0) * (item.qty || 1);
    subtotal += itemTotal;

    const qtyStr = `${item.qty}x`.padEnd(5);
    const priceStr = itemTotal > 0 ? `₹${itemTotal.toFixed(0)}` : "";
    const nameLine = justify(`${qtyStr}${item.name}`, priceStr);
    lines.push(nameLine);

    if (item.notes) {
      lines.push(`     * Note: ${item.notes}`);
    }
  }

  lines.push(divider);
  if (payload.notes) {
    lines.push(`SPECIAL INSTRUCTIONS: ${payload.notes}`);
    lines.push(divider);
  }

  lines.push(center(`TOTAL ITEMS: ${payload.items.reduce((a, b) => a + (b.qty || 1), 0)}`));
  lines.push(doubleDivider);
  lines.push("");

  return lines.join("\n");
}
