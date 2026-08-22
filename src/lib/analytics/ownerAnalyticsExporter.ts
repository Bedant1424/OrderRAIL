/**
 * Owner Analytics Exporter Module
 * Milestone 3A.3 - Authoritative CSV & PDF (Printable A4) Export for Owner Analytics.
 * 
 * Provides RFC 4180-compliant multi-section summary CSV exports and high-fidelity
 * A4 printable HTML reports for the active business-date range without leaking
 * transaction-level order rows or customer PII.
 */

import type {
  OwnerAnalyticsRangeResponse,
  OwnerAnalyticsTopItem,
  OwnerAnalyticsTenders,
  OwnerAnalyticsOperationalSummary,
} from "./analyticsTypes";
import type { OwnerAnalyticsSummaryData } from "./AnalyticsService";
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
 * Generates an authoritative, RFC 4180-compliant 6-section summary CSV string for Owner Analytics.
 */
export function generateOwnerAnalyticsCsv(
  data: OwnerAnalyticsSummaryData,
  rawRpc: OwnerAnalyticsRangeResponse | null,
  cafe: CafeExportInfo,
  rangeLabel: string
): string {
  const currency = cafe?.currency || "INR";
  const cafeName = cafe?.name || "OrderRail Cafe";
  const cafeAddress = cafe?.address || "";
  const cafeGstin = cafe?.gstin || "";
  const nowIST = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });

  // 1. Resolve Financial Metrics
  const fin = rawRpc?.range_financials;
  const grossSubtotal = fin ? fin.gross_subtotal : (data.rangeRevenueMetrics?.grossSalesCents || 0) / 100;
  const totalDiscounts = fin ? fin.total_discounts : (data.rangeRevenueMetrics?.discountsCents || 0) / 100;
  const cgst = fin ? fin.cgst : (data.rangeRevenueMetrics?.cgstCents || 0) / 100;
  const sgst = fin ? fin.sgst : (data.rangeRevenueMetrics?.sgstCents || 0) / 100;
  const totalTax = fin ? fin.total_tax : (data.rangeRevenueMetrics?.taxCents || 0) / 100;
  const serviceCharge = fin ? fin.total_service_charge : (data.rangeRevenueMetrics?.serviceChargeCents || 0) / 100;
  const roundOff = fin ? fin.total_round_off : (data.rangeRevenueMetrics?.roundOffCents || 0) / 100;
  const netCollected = fin ? fin.net_collected : (data.rangeRevenueMetrics?.netSalesCents || 0) / 100;
  const paidBillsCount = fin ? fin.paid_bills_count : (data.rangeRevenueMetrics?.paidBillsCount || 0);
  const totalItemsSold = fin ? fin.total_items_sold : (data.rangeRevenueMetrics?.totalItemsSold || 0);
  const averageBillValue = fin ? fin.average_bill_value : (data.rangeRevenueMetrics?.averageBillValueCents || 0) / 100;

  // 2. Resolve Tender Collections & Shares
  const tenders: OwnerAnalyticsTenders = rawRpc?.tenders || data.tenders || { cash: 0, upi: 0, card: 0, other: 0 };
  const cash = tenders.cash || 0;
  const upi = tenders.upi || 0;
  const card = tenders.card || 0;
  const other = tenders.other || 0;
  const totalRealizedTenders = netCollected;

  const cashShare = totalRealizedTenders > 0 ? ((cash / totalRealizedTenders) * 100).toFixed(2) : "0.00";
  const upiShare = totalRealizedTenders > 0 ? ((upi / totalRealizedTenders) * 100).toFixed(2) : "0.00";
  const cardShare = totalRealizedTenders > 0 ? ((card / totalRealizedTenders) * 100).toFixed(2) : "0.00";
  const otherShare = totalRealizedTenders > 0 ? ((other / totalRealizedTenders) * 100).toFixed(2) : "0.00";
  const totalShare = totalRealizedTenders > 0 ? "100.00" : "0.00";

  // 3. Resolve Daily Sales Trend
  const byDay = rawRpc?.by_day || (data.byDay as any[]) || [];

  // 4. Resolve Top Selling Items
  const topItems: OwnerAnalyticsTopItem[] = rawRpc?.top_items || (data.topItems as any[]) || [];

  // 5. Resolve Operational Summary
  const op: Partial<OwnerAnalyticsOperationalSummary> = rawRpc?.operational_summary || (data as any).operationalSummary || {};
  const totalOrdersPlaced = op.total_orders_placed ?? data.rangeRevenueMetrics?.orderCount ?? 0;
  const cancelledOrders = op.cancelled_orders_count ?? 0;
  const unsettledOrders = op.unsettled_orders_count ?? data.pendingOrdersCount ?? 0;
  const unsettledPipelineValue = ((op.unsettled_pipeline_cents || 0) / 100).toFixed(2);

  const lines: string[] = [];

  // =========================================================================
  // SECTION 1: REPORT METADATA
  // =========================================================================
  lines.push(escapeCSVCell(`OWNER ANALYTICS MANAGEMENT REPORT - ${cafeName.toUpperCase()}`));
  lines.push(`Cafe Name,${escapeCSVCell(cafeName)}`);
  if (cafeAddress) {
    lines.push(`Address,${escapeCSVCell(cafeAddress)}`);
  }
  if (cafeGstin) {
    lines.push(`GSTIN,${escapeCSVCell(cafeGstin)}`);
  }
  lines.push(`Selected Business Date Range,${escapeCSVCell(rangeLabel)}`);
  lines.push(`Generated At,${escapeCSVCell(`${nowIST} (Asia/Kolkata)`)}`);
  lines.push(`Timezone,${escapeCSVCell("Asia/Kolkata")}`);
  lines.push(`Currency,${escapeCSVCell(currency)}`);
  lines.push("");

  // =========================================================================
  // SECTION 2: FINANCIAL & TAX SUMMARY
  // =========================================================================
  lines.push(escapeCSVCell("SECTION 1: FINANCIAL & TAX SUMMARY"));
  lines.push(`Metric,${escapeCSVCell(`Value (${currency} / Count)`)}`);
  lines.push(`Gross Subtotal,${grossSubtotal.toFixed(2)}`);
  lines.push(`Total Discounts,${totalDiscounts.toFixed(2)}`);
  lines.push(`CGST,${cgst.toFixed(2)}`);
  lines.push(`SGST,${sgst.toFixed(2)}`);
  lines.push(`Total Tax Collected,${totalTax.toFixed(2)}`);
  lines.push(`Service Charge,${serviceCharge.toFixed(2)}`);
  lines.push(`Round Off,${roundOff.toFixed(2)}`);
  lines.push(`Net Collected Sales,${netCollected.toFixed(2)}`);
  lines.push(`Paid Bills Count,${paidBillsCount}`);
  lines.push(`Total Items Sold,${totalItemsSold}`);
  lines.push(`Average Bill Value,${averageBillValue.toFixed(2)}`);
  lines.push("");

  // =========================================================================
  // SECTION 3: TENDER COLLECTION BREAKDOWN
  // =========================================================================
  lines.push(escapeCSVCell("SECTION 2: TENDER COLLECTION BREAKDOWN"));
  lines.push(`Tender Method,${escapeCSVCell(`Amount Collected (${currency})`)},Share (%)`);
  lines.push(`Cash,${cash.toFixed(2)},${cashShare}%`);
  lines.push(`UPI,${upi.toFixed(2)},${upiShare}%`);
  lines.push(`Card,${card.toFixed(2)},${cardShare}%`);
  lines.push(`Other / Split,${other.toFixed(2)},${otherShare}%`);
  lines.push(`Total Realized Tenders,${totalRealizedTenders.toFixed(2)},${totalShare}%`);
  lines.push("");

  // =========================================================================
  // SECTION 4: DAILY SALES TREND
  // =========================================================================
  lines.push(escapeCSVCell("SECTION 3: DAILY SALES TREND"));
  lines.push(`Business Date,Day,${escapeCSVCell(`Net Revenue (${currency})`)},${escapeCSVCell(`Gross Subtotal (${currency})`)},Paid Bills,Items Sold`);
  for (const d of byDay) {
    const dGross = d.gross_subtotal !== undefined ? Number(d.gross_subtotal) : Number(d.revenue || 0);
    const dNet = Number(d.revenue || 0);
    const dPaid = d.paid_bills !== undefined ? Number(d.paid_bills) : Number(d.orders || 0);
    const dItems = Number(d.items_sold || 0);

    lines.push([
      escapeCSVCell(d.business_date || "—"),
      escapeCSVCell(d.day || "—"),
      dNet.toFixed(2),
      dGross.toFixed(2),
      dPaid,
      dItems
    ].join(","));
  }
  lines.push("");

  // =========================================================================
  // SECTION 5: TOP SELLING MENU ITEMS
  // =========================================================================
  lines.push(escapeCSVCell("SECTION 4: TOP SELLING MENU ITEMS"));
  lines.push(`Rank,Item Name,Quantity Sold,${escapeCSVCell(`Revenue (${currency})`)},Percentage Share`);
  if (topItems.length === 0) {
    lines.push(escapeCSVCell("No finalized bill item data recorded for this range"));
  } else {
    topItems.forEach((item, idx) => {
      lines.push([
        idx + 1,
        escapeCSVCell(item.name),
        item.qty,
        Number(item.revenue || 0).toFixed(2),
        escapeCSVCell(`${item.percentage}%`)
      ].join(","));
    });
  }
  lines.push("");

  // =========================================================================
  // SECTION 6: OPERATIONAL SUMMARY & PIPELINE
  // =========================================================================
  lines.push(escapeCSVCell("SECTION 5: OPERATIONAL SUMMARY & PIPELINE"));
  lines.push(`Metric,${escapeCSVCell(`Value (Count / ${currency})`)}`);
  lines.push(`Total Orders Placed,${totalOrdersPlaced}`);
  lines.push(`Cancelled Orders,${cancelledOrders}`);
  lines.push(`Unsettled Orders in Pipeline,${unsettledOrders}`);
  lines.push(`Unsettled Pipeline Value,${unsettledPipelineValue}`);

  return lines.join("\n");
}

/**
 * Triggers browser download of Owner Analytics CSV summary.
 */
export function downloadOwnerAnalyticsCsv(
  data: OwnerAnalyticsSummaryData,
  rawRpc: OwnerAnalyticsRangeResponse | null,
  cafe: CafeExportInfo,
  rangeLabel: string,
  startDate?: string | null,
  endDate?: string | null,
  customFilename?: string
): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const csvContent = generateOwnerAnalyticsCsv(data, rawRpc, cafe, rangeLabel);
  const slug = (cafe?.name || "cafe").toLowerCase().replace(/[^a-z0-9]/g, "-");

  let datePart: string;
  if (startDate && endDate) {
    datePart = startDate === endDate ? startDate : `${startDate}_to_${endDate}`;
  } else if (rawRpc?.start_business_date && rawRpc?.end_business_date) {
    datePart = rawRpc.start_business_date === rawRpc.end_business_date
      ? rawRpc.start_business_date
      : `${rawRpc.start_business_date}_to_${rawRpc.end_business_date}`;
  } else if (data.byDay && data.byDay.length > 0) {
    const firstDate = data.byDay[0]?.business_date;
    const lastDate = data.byDay[data.byDay.length - 1]?.business_date;
    if (firstDate && lastDate) {
      datePart = firstDate === lastDate ? firstDate : `${firstDate}_to_${lastDate}`;
    } else {
      datePart = new Date().toISOString().slice(0, 10);
    }
  } else {
    datePart = new Date().toISOString().slice(0, 10);
  }

  const filename = customFilename || `OwnerAnalytics_${slug}_${datePart}.csv`;

  if (typeof URL !== "undefined" && typeof URL.createObjectURL === "function") {
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    if (typeof URL.revokeObjectURL === "function") {
      URL.revokeObjectURL(url);
    }
  }
}

/**
 * Generates high-fidelity HTML for an A4 printable Owner Analytics Management Statement.
 */
export function generateOwnerAnalyticsPrintHtml(
  data: OwnerAnalyticsSummaryData,
  rawRpc: OwnerAnalyticsRangeResponse | null,
  cafe: CafeExportInfo,
  rangeLabel: string
): string {
  const currency = cafe?.currency || "INR";
  const cafeName = cafe?.name || "OrderRail Cafe";
  const cafeAddress = cafe?.address || "";
  const cafePhone = cafe?.phone || "";
  const cafeGstin = cafe?.gstin || "";
  const nowIST = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });

  // 1. Financial Metrics
  const fin = rawRpc?.range_financials;
  const grossSubtotal = fin ? fin.gross_subtotal : (data.rangeRevenueMetrics?.grossSalesCents || 0) / 100;
  const totalDiscounts = fin ? fin.total_discounts : (data.rangeRevenueMetrics?.discountsCents || 0) / 100;
  const cgst = fin ? fin.cgst : (data.rangeRevenueMetrics?.cgstCents || 0) / 100;
  const sgst = fin ? fin.sgst : (data.rangeRevenueMetrics?.sgstCents || 0) / 100;
  const totalTax = fin ? fin.total_tax : (data.rangeRevenueMetrics?.taxCents || 0) / 100;
  const serviceCharge = fin ? fin.total_service_charge : (data.rangeRevenueMetrics?.serviceChargeCents || 0) / 100;
  const roundOff = fin ? fin.total_round_off : (data.rangeRevenueMetrics?.roundOffCents || 0) / 100;
  const netCollected = fin ? fin.net_collected : (data.rangeRevenueMetrics?.netSalesCents || 0) / 100;
  const paidBillsCount = fin ? fin.paid_bills_count : (data.rangeRevenueMetrics?.paidBillsCount || 0);
  const totalItemsSold = fin ? fin.total_items_sold : (data.rangeRevenueMetrics?.totalItemsSold || 0);
  const averageBillValue = fin ? fin.average_bill_value : (data.rangeRevenueMetrics?.averageBillValueCents || 0) / 100;

  // 2. Tender Metrics
  const tenders: OwnerAnalyticsTenders = rawRpc?.tenders || data.tenders || { cash: 0, upi: 0, card: 0, other: 0 };
  const cash = tenders.cash || 0;
  const upi = tenders.upi || 0;
  const card = tenders.card || 0;
  const other = tenders.other || 0;
  const totalRealizedTenders = netCollected;

  const cashShare = totalRealizedTenders > 0 ? ((cash / totalRealizedTenders) * 100).toFixed(1) : "0.0";
  const upiShare = totalRealizedTenders > 0 ? ((upi / totalRealizedTenders) * 100).toFixed(1) : "0.0";
  const cardShare = totalRealizedTenders > 0 ? ((card / totalRealizedTenders) * 100).toFixed(1) : "0.0";
  const otherShare = totalRealizedTenders > 0 ? ((other / totalRealizedTenders) * 100).toFixed(1) : "0.0";
  const totalShare = totalRealizedTenders > 0 ? "100.0" : "0.0";

  // 3. Daily Sales & Top Items
  const byDay = rawRpc?.by_day || (data.byDay as any[]) || [];
  const topItems: OwnerAnalyticsTopItem[] = rawRpc?.top_items || (data.topItems as any[]) || [];

  // 4. Operational Summary
  const op: Partial<OwnerAnalyticsOperationalSummary> = rawRpc?.operational_summary || (data as any).operationalSummary || {};
  const totalOrdersPlaced = op.total_orders_placed ?? data.rangeRevenueMetrics?.orderCount ?? 0;
  const cancelledOrders = op.cancelled_orders_count ?? 0;
  const unsettledOrders = op.unsettled_orders_count ?? data.pendingOrdersCount ?? 0;
  const unsettledPipelineValue = ((op.unsettled_pipeline_cents || 0) / 100);

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Owner Analytics Report - ${rangeLabel}</title>
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
      color: #0284c7;
      margin-bottom: 3px;
    }
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(6, 1fr);
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
      font-size: 9px;
      font-weight: 600;
      text-transform: uppercase;
      color: #64748b;
      margin-bottom: 2px;
    }
    .kpi-value {
      font-size: 15px;
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
    .daily-table th, .daily-table td {
      padding: 3px 5px;
      font-size: 9.5px;
    }
    .items-table th, .items-table td {
      padding: 4px 5px;
      font-size: 9.5px;
    }
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
      <div class="doc-title">Owner Analytics Performance Statement</div>
      <p style="margin:0; font-weight:700; font-size:11px; color:#0f172a;">Period: ${rangeLabel}</p>
      <p style="margin:0; font-size:9.5px; color:#64748b;">Generated: ${nowIST} IST</p>
    </div>
  </div>

  <!-- 1. Primary Executive KPIs -->
  <div class="kpi-grid">
    <div class="kpi-card">
      <div class="kpi-title">Net Realized Sales</div>
      <div class="kpi-value">${formatCurrency(netCollected, currency)}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-title">Paid Bills</div>
      <div class="kpi-value">${paidBillsCount}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-title">Average Bill</div>
      <div class="kpi-value">${formatCurrency(averageBillValue, currency)}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-title">Items Sold</div>
      <div class="kpi-value">${totalItemsSold}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-title">Orders Placed</div>
      <div class="kpi-value">${totalOrdersPlaced}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-title">Cancelled Orders</div>
      <div class="kpi-value">${cancelledOrders}</div>
    </div>
  </div>

  <!-- 2. Financial Summary & Tender Breakdown Side-by-Side -->
  <div class="section-grid">
    <div class="panel">
      <div class="panel-title">Financial & Tax Summary</div>
      <table>
        <tr><td>Gross Subtotal</td><td class="num">${formatCurrency(grossSubtotal, currency)}</td></tr>
        <tr><td>Total Discounts</td><td class="num">-${formatCurrency(totalDiscounts, currency)}</td></tr>
        <tr><td>CGST Collected</td><td class="num">${formatCurrency(cgst, currency)}</td></tr>
        <tr><td>SGST Collected</td><td class="num">${formatCurrency(sgst, currency)}</td></tr>
        <tr><td>Total Tax</td><td class="num">${formatCurrency(totalTax, currency)}</td></tr>
        <tr><td>Service Charge</td><td class="num">${formatCurrency(serviceCharge, currency)}</td></tr>
        <tr><td>Round Off</td><td class="num">${formatCurrency(roundOff, currency)}</td></tr>
        <tr class="total-row"><td>Net Realized Sales</td><td class="num">${formatCurrency(netCollected, currency)}</td></tr>
      </table>
    </div>

    <div class="panel">
      <div class="panel-title">Tender Collection Breakdown</div>
      <table>
        <tr><th>Method</th><th class="num">Amount</th><th class="num">Share</th></tr>
        <tr><td>Cash</td><td class="num">${formatCurrency(cash, currency)}</td><td class="num">${cashShare}%</td></tr>
        <tr><td>UPI</td><td class="num">${formatCurrency(upi, currency)}</td><td class="num">${upiShare}%</td></tr>
        <tr><td>Card</td><td class="num">${formatCurrency(card, currency)}</td><td class="num">${cardShare}%</td></tr>
        <tr><td>Other / Split</td><td class="num">${formatCurrency(other, currency)}</td><td class="num">${otherShare}%</td></tr>
        <tr class="total-row"><td>Total Realized Tenders</td><td class="num">${formatCurrency(totalRealizedTenders, currency)}</td><td class="num">${totalShare}%</td></tr>
      </table>
    </div>
  </div>

  <!-- 3. Daily Sales Trend -->
  <div class="panel" style="margin-bottom: 14px;">
    <div class="panel-title">Daily Sales Trend (${byDay.length} Days)</div>
    <table class="daily-table">
      <tr>
        <th>Business Date</th>
        <th>Day</th>
        <th class="num">Gross Subtotal</th>
        <th class="num">Net Revenue</th>
        <th class="num">Paid Bills</th>
        <th class="num">Items Sold</th>
      </tr>
      ${byDay.map((d) => {
        const dGross = d.gross_subtotal !== undefined ? Number(d.gross_subtotal) : Number(d.revenue || 0);
        const dNet = Number(d.revenue || 0);
        const dPaid = d.paid_bills !== undefined ? Number(d.paid_bills) : Number(d.orders || 0);
        const dItems = Number(d.items_sold || 0);
        return `
        <tr ${dNet > 0 ? 'style="background:#f8fafc; font-weight:600;"' : 'style="color:#94a3b8;"'}>
          <td>${d.business_date || "—"}</td>
          <td>${d.day || "—"}</td>
          <td class="num">${formatCurrency(dGross, currency)}</td>
          <td class="num">${formatCurrency(dNet, currency)}</td>
          <td class="num">${dPaid}</td>
          <td class="num">${dItems}</td>
        </tr>
        `;
      }).join("")}
    </table>
  </div>

  <!-- 4. Top Selling Menu Items & Operational Summary Side-by-Side -->
  <div class="section-grid">
    <div class="panel">
      <div class="panel-title">Top Selling Menu Items</div>
      ${topItems.length === 0 ? '<p style="color:#64748b; font-style:italic;">No finalized items recorded.</p>' : `
      <table class="items-table">
        <tr>
          <th>#</th>
          <th>Item</th>
          <th class="num">Qty</th>
          <th class="num">Revenue</th>
          <th class="num">Share</th>
        </tr>
        ${topItems.map((it, idx) => `
        <tr>
          <td>${idx + 1}</td>
          <td><strong>${it.name}</strong></td>
          <td class="num">${it.qty}</td>
          <td class="num">${formatCurrency(Number(it.revenue || 0), currency)}</td>
          <td class="num">${it.percentage}%</td>
        </tr>
        `).join("")}
      </table>
      `}
    </div>

    <div class="panel">
      <div class="panel-title">Operational Summary & Pipeline</div>
      <table>
        <tr><td>Total Orders Placed</td><td class="num">${totalOrdersPlaced}</td></tr>
        <tr><td>Cancelled Orders</td><td class="num">${cancelledOrders}</td></tr>
        <tr><td>Unsettled Orders in Queue</td><td class="num">${unsettledOrders}</td></tr>
        <tr><td>Unsettled Pipeline Value</td><td class="num">${formatCurrency(unsettledPipelineValue, currency)}</td></tr>
      </table>
      <p style="font-size:9px; color:#64748b; margin-top:8px; font-style:italic;">
        Unsettled pipeline represents orders currently in preparation or active dining sessions and is not counted as realized revenue.
      </p>
    </div>
  </div>

  <!-- 5. Footer & Sign-offs -->
  <div class="footer">
    <div>
      <p style="margin:0;">* Authoritative multi-day financial report generated by OrderRail POS. All realized revenue is ledger-verified.</p>
    </div>
    <div style="display:flex; gap:24px;">
      <div class="signature-box">Manager / Owner Signature</div>
    </div>
  </div>

</body>
</html>
  `.trim();
}

/**
 * Triggers client browser printing of the A4 Owner Analytics PDF Statement via an isolated hidden iframe.
 */
export function printOwnerAnalyticsPdf(
  data: OwnerAnalyticsSummaryData,
  rawRpc: OwnerAnalyticsRangeResponse | null,
  cafe: CafeExportInfo,
  rangeLabel: string
): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const html = generateOwnerAnalyticsPrintHtml(data, rawRpc, cafe, rangeLabel);

  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.title = "Owner Analytics PDF Print Frame";

  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document || iframe.contentDocument;
  if (!doc) {
    if (document.body.contains(iframe)) {
      document.body.removeChild(iframe);
    }
    return;
  }

  doc.open();
  doc.write(html);
  doc.close();

  // Allow layout/styles to render before invoking print
  setTimeout(() => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch (e) {
      console.error("[OwnerAnalyticsExporter] Print error:", e);
    } finally {
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 1000);
    }
  }, 250);
}
