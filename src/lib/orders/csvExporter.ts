import type { Order, OrderItem } from "@/lib/db";
import { formatOrderLabel } from "@/lib/db";

/**
 * Standardized CSV Exporter Module
 * Ensures robust escaping for commas, quotation marks, and multiline notes.
 * Enforces the standardized column order specified in Sprint 3B.3.2R2.
 */

export const STANDARDIZED_CSV_HEADERS = [
  "Order ID",
  "Date",
  "Time",
  "Table",
  "Order Source",
  "Customer",
  "Status",
  "Item Count",
  "Items",
  "Special Notes",
  "Gross Amount",
  "Discount",
  "Tax",
  "Net Total",
  "Payment Status",
  "Created At",
  "Updated At",
  "Payment Method",
  "Served At",
  "Completed At"
] as const;

/**
 * Escapes a cell value for RFC 4180 CSV compliance:
 *   - Double quotes within a string are escaped as `""`
 *   - Any cell containing commas, double quotes, or newlines is wrapped in double quotes
 */
export function escapeCSVCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '""';
  const str = String(value);
  const escaped = str.replace(/"/g, '""');
  return `"${escaped}"`;
}

export function generateOrdersCSV(
  orders: (Order & { order_items?: OrderItem[] })[],
  tableLabelMap: Map<string, string>
): string {
  const headerLine = STANDARDIZED_CSV_HEADERS.map((h) => escapeCSVCell(h)).join(",");

  const rows = orders.map((o) => {
    const createdDate = new Date(o.created_at);
    const dateStr = createdDate.toISOString().slice(0, 10);
    const timeStr = createdDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    const tableLabel = `Table ${tableLabelMap.get(o.table_id) ?? "?"}`;
    const orderSource = "QR Table Order"; // Future POS placeholder
    const customer = "Diner";
    const itemCount = (o.order_items ?? []).reduce((s, it) => s + it.qty, 0);
    const itemsFormatted = (o.order_items ?? []).map((it) => `${it.qty}x ${it.name}`).join("; ");
    const specialNotes = o.notes ?? "";
    const grossAmount = (o.total_cents / 100).toFixed(2);
    const discount = "0.00";
    const tax = "0.00";
    const netTotal = grossAmount;
    const paymentStatus = "Paid"; // Future POS placeholder
    const createdAt = createdDate.toISOString();
    const updatedAt = o.updated_at ? new Date(o.updated_at).toISOString() : "";
    const paymentMethod = "Digital / QR"; // Future POS placeholder
    const servedAt = o.status === "served" ? updatedAt : "";
    const completedAt = o.status === "served" ? updatedAt : "";

    return [
      escapeCSVCell(formatOrderLabel(o.order_number)),
      escapeCSVCell(dateStr),
      escapeCSVCell(timeStr),
      escapeCSVCell(tableLabel),
      escapeCSVCell(orderSource),
      escapeCSVCell(customer),
      escapeCSVCell(o.status),
      escapeCSVCell(itemCount),
      escapeCSVCell(itemsFormatted),
      escapeCSVCell(specialNotes),
      escapeCSVCell(grossAmount),
      escapeCSVCell(discount),
      escapeCSVCell(tax),
      escapeCSVCell(netTotal),
      escapeCSVCell(paymentStatus),
      escapeCSVCell(createdAt),
      escapeCSVCell(updatedAt),
      escapeCSVCell(paymentMethod),
      escapeCSVCell(servedAt),
      escapeCSVCell(completedAt)
    ].join(",");
  });

  return [headerLine, ...rows].join("\n");
}
