import type { OrderWithItems } from "@/lib/orders/repository";
import { getReceiptSettings } from "@/lib/billing/receiptSettings";
import { getTaxSettings, calculateTaxAndTotals } from "@/lib/billing/taxSettings";
import { getPaymentSettings } from "@/lib/billing/paymentSettings";

export interface InvoiceRecordItem {
  id: string;
  name: string;
  qty: number;
  priceCents: number;
}

export interface InvoiceRecord {
  id: string;
  invoiceNumber: string;
  orderId: string;
  orderNumber: number | string;
  createdAt: string;
  customerName: string;
  customerPhone: string;
  tableLabel: string;
  orderSource: "DINE_IN" | "TAKEAWAY" | "SWIGGY" | "ZOMATO";
  paymentMethod: "Cash" | "UPI" | "Card" | "Wallet" | "Bank Transfer";
  subtotalCents: number;
  cgstCents: number;
  sgstCents: number;
  totalTaxCents: number;
  serviceChargeCents: number;
  roundingCents: number;
  grandTotalCents: number;
  status: "Paid" | "Cancelled" | "Refunded";
  items: InvoiceRecordItem[];
}

/**
 * Transforms raw OrderWithItems array into standardized InvoiceRecords using active cafe Settings.
 */
export function buildInvoiceRecords(
  orders: OrderWithItems[],
  cafeId?: string
): InvoiceRecord[] {
  const receiptSettings = getReceiptSettings(cafeId);
  const taxSettings = getTaxSettings(cafeId);
  const paymentSettings = getPaymentSettings(cafeId);

  const prefix = receiptSettings.invoicePrefix || "INV-";

  return orders.map((order, idx) => {
    const rawSubtotalCents =
      order.order_items?.reduce(
        (sum, item) => sum + item.price_cents * item.qty,
        0
      ) || order.total_cents || 0;

    const calc = calculateTaxAndTotals(rawSubtotalCents, taxSettings);

    const isCancelled = order.status === "cancelled";
    const status: InvoiceRecord["status"] = isCancelled ? "Cancelled" : "Paid";

    // Map order.payment_method or fallback
    let paymentMethod: InvoiceRecord["paymentMethod"] = "Cash";
    if ((order as any).payment_method) {
      const pm = String((order as any).payment_method).toUpperCase();
      if (pm.includes("UPI")) paymentMethod = "UPI";
      else if (pm.includes("CARD")) paymentMethod = "Card";
      else if (pm.includes("WALLET")) paymentMethod = "Wallet";
      else if (pm.includes("BANK")) paymentMethod = "Bank Transfer";
    } else {
      const def = paymentSettings.defaultMethod;
      if (def === "upi") paymentMethod = "UPI";
      else if (def === "card") paymentMethod = "Card";
      else if (def === "wallet") paymentMethod = "Wallet";
      else if (def === "bank_transfer") paymentMethod = "Bank Transfer";
    }

    const items: InvoiceRecordItem[] = (order.order_items || []).map((item, i) => ({
      id: item.id || `item-${i}`,
      name: item.name,
      qty: item.qty,
      priceCents: item.price_cents,
    }));

    // Generate readable invoice serial number
    const seq = String(orders.length - idx).padStart(6, "0");
    const invoiceNumber = `${prefix}${seq}`;

    return {
      id: order.id,
      invoiceNumber,
      orderId: order.id,
      orderNumber: order.order_number || (order as any).order_token || `#${idx + 101}`,
      createdAt: order.created_at || new Date().toISOString(),
      customerName: (order as any).customer_name || "Walk-in Customer",
      customerPhone: (order as any).customer_phone || "+91 98765 43210",
      tableLabel: order.tables?.label || order.order_mode || "Table 01",
      orderSource: order.order_mode as any || "DINE_IN",
      paymentMethod,
      subtotalCents: calc.subtotalCents,
      cgstCents: calc.cgstCents,
      sgstCents: calc.sgstCents,
      totalTaxCents: calc.totalGstCents,
      serviceChargeCents: calc.serviceChargeCents,
      roundingCents: calc.roundingAdjustmentCents,
      grandTotalCents: calc.grandTotalCents,
      status,
      items,
    };
  });
}
