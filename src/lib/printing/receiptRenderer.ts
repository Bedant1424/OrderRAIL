/**
 * Sprint 9.2.3.3 — Receipt Renderer
 * Formats Customer Bill Receipts for 58mm and 80mm thermal receipt printers.
 */

export interface ReceiptItem {
  id?: string;
  name: string;
  price: number;
  qty: number;
}

export interface ReceiptRenderPayload {
  billId: string;
  billNumber: string | number;
  orderId?: string;
  orderNumber?: number | string;
  tableLabel: string;
  cashierName?: string;
  timestamp: string;
  cafeName?: string;
  gstin?: string;
  address?: string;
  items: ReceiptItem[];
  subtotal: number;
  tax: number;
  discountPct?: number;
  discountAmt?: number;
  netTotal: number;
  tenders?: { method: string; amount: number }[];
  paymentStatus?: 'unpaid' | 'paid' | 'voided';
  isReprint?: boolean;
  orderSource?: "DINE_IN" | "TAKEAWAY" | "SWIGGY" | "ZOMATO";
  externalOrderRef?: string | null;
}

export function renderReceiptText(payload: ReceiptRenderPayload, widthmm: 58 | 80 = 80): string {
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

  // Header & Cafe Info
  lines.push(doubleDivider);
  lines.push(center(payload.cafeName || "ORDERRAIL PRO CAFE"));
  if (payload.address) {
    lines.push(center(payload.address));
  }
  lines.push(center(`GSTIN: ${payload.gstin || "27AAAAA0000A1Z5"}`));
  lines.push(doubleDivider);

  if (payload.isReprint) {
    lines.push(center("** REPRINT RECEIPT **"));
    lines.push(divider);
  }

  // Bill & Order Metadata
  const source = payload.orderSource || "DINE_IN";
  const refStr = payload.externalOrderRef ? `#${payload.externalOrderRef}` : "";
  const rawLabel = payload.tableLabel || "Express";
  let cleanLabel = rawLabel;

  if (source === "TAKEAWAY") {
    cleanLabel = "Takeaway";
  } else if (source === "SWIGGY") {
    cleanLabel = `Swiggy ${refStr}`.trim();
  } else if (source === "ZOMATO") {
    cleanLabel = `Zomato ${refStr}`.trim();
  } else if (!rawLabel.toLowerCase().startsWith("table")) {
    cleanLabel = `Table ${rawLabel}`;
  }

  lines.push(justify(`INVOICE #: ${payload.billNumber}`, `Ref: ${cleanLabel}`));
  if (payload.orderNumber) {
    lines.push(justify(`Order #: ${payload.orderNumber}`, `Staff: ${payload.cashierName || "Counter"}`));
  }
  lines.push(justify(`Date: ${payload.timestamp}`, `Status: ${(payload.paymentStatus || "UNPAID").toUpperCase()}`));
  lines.push(divider);

  // Items Header
  lines.push(justify("QTY  ITEM DESCRIPTION", "AMOUNT"));
  lines.push(divider);

  // Items List
  for (const item of payload.items) {
    const itemTotal = (item.price || 0) * (item.qty || 1);
    const qtyStr = `${item.qty}x`.padEnd(5);
    const priceStr = `₹${itemTotal.toFixed(2)}`;
    lines.push(justify(`${qtyStr}${item.name}`, priceStr));
  }

  lines.push(divider);

  // Totals Section
  lines.push(justify("Subtotal:", `₹${payload.subtotal.toFixed(2)}`));

  if (payload.tax > 0) {
    const cgst = payload.tax / 2;
    const sgst = payload.tax / 2;
    lines.push(justify("CGST (2.5%):", `₹${cgst.toFixed(2)}`));
    lines.push(justify("SGST (2.5%):", `₹${sgst.toFixed(2)}`));
  }

  if (payload.discountAmt && payload.discountAmt > 0) {
    lines.push(justify("Discount:", `-₹${payload.discountAmt.toFixed(2)}`));
  }

  lines.push(doubleDivider);
  lines.push(justify("NET PAYABLE TOTAL:", `₹${payload.netTotal.toFixed(2)}`));
  lines.push(doubleDivider);

  // Tender / Payment Status
  if (payload.tenders && payload.tenders.length > 0) {
    lines.push("PAYMENT DETAILS:");
    for (const t of payload.tenders) {
      lines.push(justify(`  ${t.method.toUpperCase()}`, `₹${t.amount.toFixed(2)}`));
    }
    lines.push(divider);
  } else {
    lines.push(center(`[ PAYMENT STATUS: ${(payload.paymentStatus || "UNPAID").toUpperCase()} ]`));
    lines.push(divider);
  }

  // Footer
  lines.push(center("Thank you for dining with us!"));
  lines.push(center("Please visit again"));
  lines.push(doubleDivider);
  lines.push("");

  return lines.join("\n");
}
