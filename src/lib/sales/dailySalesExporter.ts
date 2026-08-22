/**
 * Daily Sales Exporter Module
 * 
 * Authoritative CSV and PDF (Printable A4) exporter for OrderRail Daily Sales reports.
 * Implements RFC 4180 CSV compliance, multi-section financial dossiers, split-payment breakdowns,
 * and 24-hour authoritative hourly distribution without client-side total manipulation.
 */

import type {
  DailySalesReport,
  DailySalesTransactionsResponse,
  DailySalesTransaction,
  DailySalesHourlyBucket,
} from "./types";
import { escapeCSVCell } from "@/lib/orders/csvExporter";
import { formatCurrency } from "@/components/counter/DailySalesPill";

export interface CafeExportInfo {
  id?: string;
  name?: string;
  address?: string | null;
  phone?: string | null;
  gstin?: string | null;
  currency?: string;
  logo_url?: string | null;
}

/**
 * Format timestamp into human-readable 12-hour IST time (e.g., "11:21:42 AM")
 */
export function formatPaidTimeIST(isoString?: string | null): string {
  if (!isoString) return "—";
  try {
    const d = new Date(isoString);
    return d.toLocaleTimeString("en-IN", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  } catch {
    return String(isoString);
  }
}

/**
 * Format hourly range label (e.g. 0 -> "12:00 AM - 01:00 AM")
 */
export function formatHourlyWindowLabel(hour: number): string {
  const startHour = hour % 12 === 0 ? 12 : hour % 12;
  const startAmPm = hour < 12 ? "AM" : "PM";
  const nextHourNum = (hour + 1) % 24;
  const endHour = nextHourNum % 12 === 0 ? 12 : nextHourNum % 12;
  const endAmPm = nextHourNum < 12 ? "AM" : "PM";

  const startStr = `${String(startHour).padStart(2, "0")}:00 ${startAmPm}`;
  const endStr = `${String(endHour).padStart(2, "0")}:00 ${endAmPm}`;
  return `${startStr} - ${endStr}`;
}

/**
 * Format tender breakdown string for a transaction (e.g. "CASH: ₹200.00 | UPI: ₹112.00")
 */
export function formatTransactionTenderBreakdown(tx: DailySalesTransaction, currency: string = "INR"): string {
  if (tx.tenders && tx.tenders.length > 0) {
    return tx.tenders
      .map((t) => `${t.method.toUpperCase()}: ${formatCurrency(t.amount, currency)}`)
      .join(" | ");
  }
  return `${(tx.payment_method || "CASH").toUpperCase()}: ${formatCurrency(tx.grand_total, currency)}`;
}

/**
 * Format items sold summary string for a transaction (e.g. "2x Clay Pot Pizza; 1x Wrap")
 */
export function formatTransactionItemsSummary(tx: DailySalesTransaction): string {
  if (tx.items && tx.items.length > 0) {
    return tx.items.map((i) => `${i.quantity}x ${i.item_name}`).join("; ");
  }
  return `${tx.total_items || 0} item(s)`;
}

/**
 * Generates an authoritative, RFC 4180-compliant multi-section CSV string for Daily Sales.
 */
export function generateDailySalesCsv(
  report: DailySalesReport,
  transactionsResponse?: DailySalesTransactionsResponse | null,
  cafe?: CafeExportInfo | null
): string {
  const currency = cafe?.currency || "INR";
  const cafeName = cafe?.name || "OrderRail Cafe";
  const businessDate = report.business_date || "N/A";
  const nowIST = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });

  const totalCollected = report.net_collected || 0;
  const cashTotal = report.tenders?.cash || 0;
  const upiTotal = report.tenders?.upi || 0;
  const cardTotal = report.tenders?.card || 0;
  const otherTotal = report.tenders?.other || 0;

  const cashShare = totalCollected > 0 ? ((cashTotal / totalCollected) * 100).toFixed(2) : "0.00";
  const upiShare = totalCollected > 0 ? ((upiTotal / totalCollected) * 100).toFixed(2) : "0.00";
  const cardShare = totalCollected > 0 ? ((cardTotal / totalCollected) * 100).toFixed(2) : "0.00";
  const otherShare = totalCollected > 0 ? ((otherTotal / totalCollected) * 100).toFixed(2) : "0.00";

  const lines: string[] = [];

  // =========================================================================
  // SECTION 1: REPORT HEADER
  // =========================================================================
  lines.push(escapeCSVCell(`DAILY SALES RECONCILIATION REPORT - ${cafeName.toUpperCase()}`));
  lines.push(`Business Date,${escapeCSVCell(businessDate)}`);
  lines.push(`Generated At,${escapeCSVCell(`${nowIST} (Asia/Kolkata)`)}`);
  lines.push(`Currency,${escapeCSVCell(currency)}`);
  lines.push("");

  // =========================================================================
  // SECTION 2: EXECUTIVE FINANCIAL SUMMARY
  // =========================================================================
  lines.push(escapeCSVCell("SECTION 1: EXECUTIVE FINANCIAL SUMMARY"));
  lines.push(`Metric,Value (${currency} / Count)`);
  lines.push(`Gross Subtotal,${report.gross_subtotal.toFixed(2)}`);
  lines.push(`Total Discounts,${report.total_discounts.toFixed(2)}`);
  lines.push(`CGST,${report.cgst.toFixed(2)}`);
  lines.push(`SGST,${report.sgst.toFixed(2)}`);
  lines.push(`Total Tax Collected,${report.total_tax.toFixed(2)}`);
  lines.push(`Service Charge,${report.total_service_charge.toFixed(2)}`);
  lines.push(`Round Off,${report.total_round_off.toFixed(2)}`);
  lines.push(`Net Collected Sales,${report.net_collected.toFixed(2)}`);
  lines.push(`Paid Bills Count,${report.paid_bills_count}`);
  lines.push(`Total Items Sold,${report.total_items_sold}`);
  lines.push(`Average Bill Value,${report.average_bill_value.toFixed(2)}`);
  lines.push("");

  // =========================================================================
  // SECTION 3: TENDER COLLECTION BREAKDOWN
  // =========================================================================
  lines.push(escapeCSVCell("SECTION 2: TENDER COLLECTION BREAKDOWN"));
  lines.push(`Tender Method,Amount Collected (${currency}),Share (%)`);
  lines.push(`Cash,${cashTotal.toFixed(2)},${cashShare}%`);
  lines.push(`UPI,${upiTotal.toFixed(2)},${upiShare}%`);
  lines.push(`Card,${cardTotal.toFixed(2)},${cardShare}%`);
  lines.push(`Other / Split,${otherTotal.toFixed(2)},${otherShare}%`);
  lines.push(`Total Realized Tenders,${totalCollected.toFixed(2)},100.00%`);
  lines.push("");

  // =========================================================================
  // SECTION 4: HOURLY SALES DISTRIBUTION (ALL 24 AUTHORITATIVE BUCKETS)
  // =========================================================================
  lines.push(escapeCSVCell("SECTION 3: HOURLY SALES DISTRIBUTION (ASIA/KOLKATA)"));
  lines.push(`Hour,Time Window,Revenue (${currency}),Paid Bills,Items Sold,Cash (${currency}),UPI (${currency}),Card (${currency}),Other (${currency})`);

  const hourlyBuckets = report.hourly || [];
  for (let h = 0; h < 24; h++) {
    const bucket = hourlyBuckets.find((b) => Number(b.hour) === h) || {
      hour: h,
      label: h === 0 ? "12 AM" : h < 12 ? `${h} AM` : h === 12 ? "12 PM" : `${h - 12} PM`,
      revenue: 0,
      paid_bills: 0,
      items_sold: 0,
      cash: 0,
      upi: 0,
      card: 0,
      other: 0,
    };

    lines.push(
      [
        bucket.hour,
        escapeCSVCell(formatHourlyWindowLabel(bucket.hour)),
        bucket.revenue.toFixed(2),
        bucket.paid_bills,
        bucket.items_sold,
        bucket.cash.toFixed(2),
        bucket.upi.toFixed(2),
        bucket.card.toFixed(2),
        bucket.other.toFixed(2),
      ].join(",")
    );
  }
  lines.push("");

  // =========================================================================
  // SECTION 5: SETTLED BILLS & SPLIT TENDER LEDGER
  // =========================================================================
  lines.push(escapeCSVCell("SECTION 4: SETTLED BILLS & SPLIT TENDER LEDGER"));
  const txHeaders = [
    "Bill #",
    "Paid Time (IST)",
    "Table",
    "Order Type",
    "Customer Name",
    "Phone",
    `Gross (${currency})`,
    `Discount (${currency})`,
    `CGST (${currency})`,
    `SGST (${currency})`,
    `Service Charge (${currency})`,
    `Round Off (${currency})`,
    `Grand Total (${currency})`,
    "Payment Method",
    "Tender Breakdown Detail",
    "Items Sold Summary",
  ];
  lines.push(txHeaders.map((h) => escapeCSVCell(h)).join(","));

  const transactions = transactionsResponse?.transactions || [];
  for (const tx of transactions) {
    const paymentMethod = tx.tenders && tx.tenders.length > 1 ? "MIXED" : tx.payment_method || "CASH";
    const tenderDetail = formatTransactionTenderBreakdown(tx, currency);
    const itemsSummary = formatTransactionItemsSummary(tx);

    lines.push(
      [
        tx.bill_number,
        escapeCSVCell(formatPaidTimeIST(tx.paid_at)),
        escapeCSVCell(tx.table_label || "Takeaway"),
        escapeCSVCell(tx.order_source || "DINE_IN"),
        escapeCSVCell(tx.customer_name || "Walk-in Customer"),
        escapeCSVCell(tx.customer_phone || "N/A"),
        tx.subtotal.toFixed(2),
        tx.discount.toFixed(2),
        tx.cgst.toFixed(2),
        tx.sgst.toFixed(2),
        tx.service_charge.toFixed(2),
        tx.round_off.toFixed(2),
        tx.grand_total.toFixed(2),
        escapeCSVCell(paymentMethod),
        escapeCSVCell(tenderDetail),
        escapeCSVCell(itemsSummary),
      ].join(",")
    );
  }

  return lines.join("\n");
}

/**
 * Trigger client browser download of the Daily Sales CSV file.
 */
export function downloadDailySalesCsv(
  report: DailySalesReport,
  transactionsResponse?: DailySalesTransactionsResponse | null,
  cafe?: CafeExportInfo | null,
  customFilename?: string
): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const csvContent = generateDailySalesCsv(report, transactionsResponse, cafe);
  const dateStr = report.business_date || "today";
  const slug = (cafe?.name || "cafe").toLowerCase().replace(/[^a-z0-9]/g, "-");
  const filename = customFilename || `DailySales_${slug}_${dateStr}.csv`;

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Generate high-fidelity HTML for A4 printable Daily Sales Statement.
 */
export function generateDailySalesPrintHtml(
  report: DailySalesReport,
  transactionsResponse?: DailySalesTransactionsResponse | null,
  cafe?: CafeExportInfo | null
): string {
  const currency = cafe?.currency || "INR";
  const cafeName = cafe?.name || "Cheese Corner";
  const cafeAddress = cafe?.address || "";
  const cafePhone = cafe?.phone || "";
  const cafeGstin = cafe?.gstin || "";
  const businessDate = report.business_date || "N/A";
  const nowIST = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });

  const totalCollected = report.net_collected || 0;
  const cashTotal = report.tenders?.cash || 0;
  const upiTotal = report.tenders?.upi || 0;
  const cardTotal = report.tenders?.card || 0;
  const otherTotal = report.tenders?.other || 0;

  const cashShare = totalCollected > 0 ? ((cashTotal / totalCollected) * 100).toFixed(1) : "0.0";
  const upiShare = totalCollected > 0 ? ((upiTotal / totalCollected) * 100).toFixed(1) : "0.0";
  const cardShare = totalCollected > 0 ? ((cardTotal / totalCollected) * 100).toFixed(1) : "0.0";
  const otherShare = totalCollected > 0 ? ((otherTotal / totalCollected) * 100).toFixed(1) : "0.0";

  const hourlyBuckets = report.hourly || [];
  const transactions = transactionsResponse?.transactions || [];

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Daily Sales Report - ${businessDate}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 12mm;
    }
    *, *:before, *:after {
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
      margin: 0;
      padding: 0;
      font-size: 11px;
      line-height: 1.4;
    }
    .header {
      border-bottom: 2px solid #0f172a;
      padding-bottom: 10px;
      margin-bottom: 14px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }
    .header-left h1 {
      margin: 0 0 4px 0;
      font-size: 20px;
      font-weight: 800;
      letter-spacing: -0.5px;
      color: #0f172a;
    }
    .header-left p {
      margin: 0;
      color: #475569;
      font-size: 10.5px;
    }
    .header-right {
      text-align: right;
    }
    .doc-title {
      font-size: 13px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #059669;
      margin-bottom: 3px;
    }
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      margin-bottom: 14px;
    }
    .kpi-card {
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 8px 10px;
      background: #f8fafc;
    }
    .kpi-title {
      font-size: 9.5px;
      font-weight: 600;
      text-transform: uppercase;
      color: #64748b;
      margin-bottom: 2px;
    }
    .kpi-value {
      font-size: 16px;
      font-weight: 800;
      font-family: ui-monospace, monospace;
      color: #0f172a;
    }
    .section-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-bottom: 14px;
    }
    .panel {
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 10px;
    }
    .panel-title {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      margin: 0 0 8px 0;
      padding-bottom: 4px;
      border-bottom: 1px solid #e2e8f0;
      color: #1e293b;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10px;
    }
    th, td {
      padding: 4px 6px;
      text-align: left;
    }
    th {
      font-weight: 700;
      color: #475569;
      border-bottom: 1px solid #cbd5e1;
      background: #f8fafc;
    }
    td.num, th.num {
      text-align: right;
      font-family: ui-monospace, monospace;
    }
    tr.total-row {
      font-weight: 700;
      border-top: 1.5px solid #0f172a;
      background: #f1f5f9;
    }
    .hourly-table th, .hourly-table td {
      padding: 3px 5px;
      font-size: 9.5px;
    }
    .tx-table {
      margin-top: 6px;
    }
    .tx-table th, .tx-table td {
      padding: 4px 5px;
      font-size: 9px;
      border-bottom: 1px solid #f1f5f9;
    }
    .badge {
      display: inline-block;
      padding: 1px 4px;
      border-radius: 4px;
      font-size: 8.5px;
      font-weight: 600;
      background: #e2e8f0;
    }
    .badge-upi { background: #dbeafe; color: #1e40af; }
    .badge-cash { background: #d1fae5; color: #065f46; }
    .badge-card { background: #f3e8ff; color: #6b21a8; }
    .badge-mixed { background: #fef3c7; color: #92400e; }
    .footer {
      margin-top: 20px;
      padding-top: 12px;
      border-top: 1px solid #cbd5e1;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      font-size: 9.5px;
      color: #64748b;
      page-break-inside: avoid;
    }
    .signature-box {
      width: 180px;
      border-top: 1px solid #0f172a;
      text-align: center;
      padding-top: 4px;
      font-weight: 600;
      color: #0f172a;
    }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>

  <div class="header">
    <div class="header-left">
      <h1>${cafeName}</h1>
      ${cafeAddress ? `<p>${cafeAddress}</p>` : ""}
      <p>${cafePhone ? `Phone: ${cafePhone} | ` : ""}${cafeGstin ? `GSTIN: ${cafeGstin} | ` : ""}Currency: ${currency}</p>
    </div>
    <div class="header-right">
      <div class="doc-title">Daily Sales Reconciliation Statement</div>
      <p style="margin:0; font-weight:700; font-size:11.5px; color:#0f172a;">Business Date: ${businessDate}</p>
      <p style="margin:0; font-size:9.5px; color:#64748b;">Generated: ${nowIST} IST</p>
    </div>
  </div>

  <!-- 1. Primary KPIs -->
  <div class="kpi-grid">
    <div class="kpi-card">
      <div class="kpi-title">Net Collected</div>
      <div class="kpi-value">${formatCurrency(report.net_collected, currency)}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-title">Paid Bills</div>
      <div class="kpi-value">${report.paid_bills_count}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-title">Items Sold</div>
      <div class="kpi-value">${report.total_items_sold}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-title">Average Bill</div>
      <div class="kpi-value">${formatCurrency(report.average_bill_value, currency)}</div>
    </div>
  </div>

  <!-- 2. Financial Summary & Tender Breakdown Side-by-Side -->
  <div class="section-grid">
    <div class="panel">
      <div class="panel-title">Financial & Tax Breakdown</div>
      <table>
        <tr><td>Gross Subtotal</td><td class="num">${formatCurrency(report.gross_subtotal, currency)}</td></tr>
        <tr><td>Total Discounts</td><td class="num">-${formatCurrency(report.total_discounts, currency)}</td></tr>
        <tr><td>CGST Collected</td><td class="num">${formatCurrency(report.cgst, currency)}</td></tr>
        <tr><td>SGST Collected</td><td class="num">${formatCurrency(report.sgst, currency)}</td></tr>
        <tr><td>Total Tax</td><td class="num">${formatCurrency(report.total_tax, currency)}</td></tr>
        <tr><td>Service Charge</td><td class="num">${formatCurrency(report.total_service_charge, currency)}</td></tr>
        <tr><td>Round Off</td><td class="num">${formatCurrency(report.total_round_off, currency)}</td></tr>
        <tr class="total-row"><td>Net Realized Sales</td><td class="num">${formatCurrency(report.net_collected, currency)}</td></tr>
      </table>
    </div>

    <div class="panel">
      <div class="panel-title">Tender Collection Breakdown</div>
      <table>
        <tr><th>Method</th><th class="num">Amount</th><th class="num">Share</th></tr>
        <tr><td>Cash</td><td class="num">${formatCurrency(cashTotal, currency)}</td><td class="num">${cashShare}%</td></tr>
        <tr><td>UPI</td><td class="num">${formatCurrency(upiTotal, currency)}</td><td class="num">${upiShare}%</td></tr>
        <tr><td>Card</td><td class="num">${formatCurrency(cardTotal, currency)}</td><td class="num">${cardShare}%</td></tr>
        <tr><td>Other / Split</td><td class="num">${formatCurrency(otherTotal, currency)}</td><td class="num">${otherShare}%</td></tr>
        <tr class="total-row"><td>Total Tenders</td><td class="num">${formatCurrency(totalCollected, currency)}</td><td class="num">100.0%</td></tr>
      </table>
    </div>
  </div>

  <!-- 3. Hourly Sales Distribution -->
  <div class="panel" style="margin-bottom: 14px;">
    <div class="panel-title">Hourly Sales Breakdown (24 Authoritative Hours)</div>
    <table class="hourly-table">
      <tr>
        <th>Hour</th>
        <th>Time Window</th>
        <th class="num">Revenue</th>
        <th class="num">Bills</th>
        <th class="num">Items</th>
        <th class="num">Cash</th>
        <th class="num">UPI</th>
        <th class="num">Card</th>
      </tr>
      ${hourlyBuckets
        .map(
          (h) => `
        <tr ${h.revenue > 0 ? 'style="background:#f8fafc; font-weight:600;"' : 'style="color:#94a3b8;"'}>
          <td>${h.label}</td>
          <td>${formatHourlyWindowLabel(h.hour)}</td>
          <td class="num">${formatCurrency(h.revenue, currency)}</td>
          <td class="num">${h.paid_bills}</td>
          <td class="num">${h.items_sold}</td>
          <td class="num">${formatCurrency(h.cash, currency)}</td>
          <td class="num">${formatCurrency(h.upi, currency)}</td>
          <td class="num">${formatCurrency(h.card, currency)}</td>
        </tr>
      `
        )
        .join("")}
    </table>
  </div>

  <!-- 4. Finalized Bills & Split Ledger -->
  <div class="panel" style="margin-bottom: 14px;">
    <div class="panel-title">Finalized Bills & Split Tender Ledger (${transactions.length} Transactions)</div>
    ${
      transactions.length === 0
        ? '<p style="color:#64748b; font-style:italic; margin:8px 0;">No paid transactions recorded for this business date.</p>'
        : `
    <table class="tx-table">
      <tr>
        <th>Bill #</th>
        <th>Time (IST)</th>
        <th>Table</th>
        <th>Type</th>
        <th>Items Sold</th>
        <th class="num">Total</th>
        <th>Method</th>
        <th>Tender Allocation Detail</th>
      </tr>
      ${transactions
        .map((tx) => {
          const pm = tx.tenders && tx.tenders.length > 1 ? "MIXED" : tx.payment_method || "CASH";
          const badgeClass =
            pm === "UPI"
              ? "badge-upi"
              : pm === "CASH"
              ? "badge-cash"
              : pm === "CARD"
              ? "badge-card"
              : "badge-mixed";
          const tenderDetail = formatTransactionTenderBreakdown(tx, currency);
          const itemsSummary = formatTransactionItemsSummary(tx);

          return `
        <tr>
          <td><strong>#${tx.bill_number}</strong></td>
          <td>${formatPaidTimeIST(tx.paid_at)}</td>
          <td>${tx.table_label || "Takeaway"}</td>
          <td>${tx.order_source || "DINE_IN"}</td>
          <td>${itemsSummary}</td>
          <td class="num"><strong>${formatCurrency(tx.grand_total, currency)}</strong></td>
          <td><span class="badge ${badgeClass}">${pm}</span></td>
          <td style="font-size:8.5px; font-family:ui-monospace, monospace;">${tenderDetail}</td>
        </tr>
        `;
        })
        .join("")}
    </table>
    `
    }
  </div>

  <!-- 5. Footer & Sign-offs -->
  <div class="footer">
    <div>
      <p style="margin:0;">* Authoritative financial statement produced by OrderRail POS. All realized revenue is ledger-verified.</p>
    </div>
    <div style="display:flex; gap:24px;">
      <div class="signature-box">Cashier / Staff Signature</div>
      <div class="signature-box">Manager / Owner Signature</div>
    </div>
  </div>

</body>
</html>
  `.trim();
}

/**
 * Trigger client browser printing of the A4 Daily Sales PDF Statement via an isolated hidden iframe.
 */
export function printDailySalesPdf(
  report: DailySalesReport,
  transactionsResponse?: DailySalesTransactionsResponse | null,
  cafe?: CafeExportInfo | null
): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const html = generateDailySalesPrintHtml(report, transactionsResponse, cafe);

  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.title = "Daily Sales PDF Print Frame";

  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document || iframe.contentDocument;
  if (!doc) {
    document.body.removeChild(iframe);
    return;
  }

  doc.open();
  doc.write(html);
  doc.close();

  // Allow styles to render before triggering print
  setTimeout(() => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch (e) {
      console.error("[DailySalesExporter] Print error:", e);
    } finally {
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 1000);
    }
  }, 250);
}
