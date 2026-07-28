import type { Order, OrderItem } from "@/lib/db";
import { formatOrderLabel } from "@/lib/db";

/**
 * Standardized CSV Exporter Module
 * RFC 4180 compliant with human-readable date/time formats and validated payment/customer fields.
 */

export const STANDARDIZED_CSV_HEADERS = [
  "Order ID",
  "Date",
  "Time",
  "Customer Name",
  "Customer Phone",
  "Channel",
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
 * Double quotes are escaped as `""`, and cells with commas/quotes/newlines are wrapped in double quotes.
 */
export function escapeCSVCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '""';
  const str = String(value);
  const escaped = str.replace(/"/g, '""');
  return `"${escaped}"`;
}

export function generateOrdersCSV(
  orders: (Order & { order_items?: OrderItem[] })[],
  tableLabelMap: Map<string, string>,
  dailyOrderNumMap?: Map<string, number>
): string {
  const headerLine = STANDARDIZED_CSV_HEADERS.map((h) => escapeCSVCell(h)).join(",");

  const rows = orders.map((o) => {
    const createdDate = new Date(o.created_at);
    
    // Human-readable Date (YYYY-MM-DD) and Time (10:35 PM)
    const dateStr = createdDate.toISOString().slice(0, 10);
    const timeStr = createdDate.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true
    });
    
    const customerName = o.customer_name?.trim() || "Walk-in Customer";
    const customerPhone = o.customer_phone?.trim() || "—";
    const channel = (o.order_source || o.order_type || "dine_in").toUpperCase();
    const paymentStatus = o.status === "served" || o.status === "completed" ? "Paid" : o.status === "cancelled" ? "Cancelled" : "Pending";
    
    const itemCount = (o.order_items ?? []).reduce((s, it) => s + it.qty, 0);
    const itemsFormatted = (o.order_items ?? []).map((it) => `${it.qty}x ${it.name}`).join("; ");
    const specialNotes = o.notes ?? "";
    const grossAmount = (o.total_cents / 100).toFixed(2);
    const discount = "0.00";
    const tax = "0.00";
    const netTotal = grossAmount;
    const createdAt = createdDate.toISOString();
    const updatedAt = o.updated_at ? new Date(o.updated_at).toISOString() : "";
    const paymentMethod = "Digital / Counter";
    const servedAt = (o.status === "served" || o.status === "completed") && o.updated_at ? new Date(o.updated_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }) : "";
    const completedAt = (o.status === "served" || o.status === "completed") && o.updated_at ? new Date(o.updated_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }) : "";

    const displayNum = (o as any).daily_order_number ?? dailyOrderNumMap?.get(o.id) ?? o.order_number;

    return [
      escapeCSVCell(formatOrderLabel(displayNum)),
      escapeCSVCell(dateStr),
      escapeCSVCell(timeStr),
      escapeCSVCell(customerName),
      escapeCSVCell(customerPhone),
      escapeCSVCell(channel),
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
