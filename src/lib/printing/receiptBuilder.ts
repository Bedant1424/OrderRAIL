/**
 * Production Customer Receipt ESC/POS Builder
 * Formats compact ESC/POS binary commands & clean text previews for 58mm & 80mm thermal receipt printers.
 */

import { ESC_POS } from "./constants";

export interface ReceiptItemInput {
  id?: string;
  name: string;
  price: number;
  qty: number;
  notes?: string;
}

export interface ReceiptBuilderPayload {
  billId?: string;
  billNumber: string | number;
  orderId?: string;
  orderNumber?: number | string;
  tableLabel: string;
  cashierName?: string;
  timestamp?: string;
  cafeName?: string;
  gstin?: string;
  address?: string;
  phone?: string;
  cafePhone?: string;
  items: ReceiptItemInput[];
  subtotal: number;
  tax: number;
  cgst?: number;
  sgst?: number;
  serviceCharge?: number;
  gstPercentage?: number;
  discountPct?: number;
  discountAmt?: number;
  netTotal: number;
  tenders?: { method: string; amount: number }[];
  paymentStatus?: "unpaid" | "paid" | "voided" | string;
  paymentMode?: string;
  isReprint?: boolean;
  orderSource?: "DINE_IN" | "TAKEAWAY" | "SWIGGY" | "ZOMATO" | string;
  externalOrderRef?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  cafeId?: string;

  // Receipt Display Settings
  showAddress?: boolean;
  showPhone?: boolean;
  showGst?: boolean;
  showInvoiceNum?: boolean;
  receiptHeader?: string;
  thankYouMessage?: string;
  footerInfo?: string;
}

export interface ReceiptBuildResult {
  text: string;
  escpos: string;
}

export class ReceiptBuilder {
  private static readonly COLUMN_WIDTH_58MM = 32;

  /**
   * Builds both clean 32-column text preview and raw 58mm/80mm ESC/POS command buffer.
   */
  public static build(payload: ReceiptBuilderPayload, widthmm: 58 | 80 = 58): ReceiptBuildResult {
    return {
      text: this.buildText(payload, widthmm),
      escpos: this.buildEscPos(payload, widthmm),
    };
  }

  /**
   * Generates clean formatted text representation (32 columns for 58mm, 48 columns for 80mm)
   */
  public static buildText(payload: ReceiptBuilderPayload, widthmm: 58 | 80 = 58): string {
    const cols = widthmm === 58 ? 32 : 48;
    const divider = "-".repeat(cols);
    const doubleDivider = "=".repeat(cols);

    const center = (text: string): string => {
      if (text.length >= cols) return text.substring(0, cols);
      const pad = Math.floor((cols - text.length) / 2);
      return " ".repeat(pad) + text;
    };

    const justify = (left: string, right: string): string => {
      const spaceLength = cols - left.length - right.length;
      if (spaceLength <= 0) {
        return `${left.substring(0, cols - right.length - 1)} ${right}`;
      }
      return left + " ".repeat(spaceLength) + right;
    };

    const lines: string[] = [];

    // Header & Cafe Info
    lines.push(doubleDivider);
    lines.push(center((payload.cafeName || "CHEESE CORNER").toUpperCase()));

    if (payload.receiptHeader && payload.receiptHeader.trim()) {
      const headerLines = payload.receiptHeader.trim().split("\n");
      for (const hl of headerLines) {
        const wrapped = this.wrapText(hl.trim(), cols);
        for (const wl of wrapped) {
          lines.push(center(wl));
        }
      }
    }

    if (payload.showAddress !== false && payload.address && payload.address.trim()) {
      const addrLines = this.wrapText(payload.address.trim(), cols);
      for (const al of addrLines) {
        lines.push(center(al));
      }
    }

    const phoneNum = payload.phone || payload.cafePhone;
    if (payload.showPhone !== false && phoneNum && phoneNum.trim()) {
      const pStr = phoneNum.trim();
      const formattedPhone = pStr.startsWith("+") || pStr.toLowerCase().startsWith("ph") ? pStr : `Ph: ${pStr}`;
      lines.push(center(formattedPhone));
    }

    if (payload.showGst !== false && payload.gstin && payload.gstin.trim()) {
      const gStr = payload.gstin.trim();
      const formattedGst = gStr.toUpperCase().startsWith("GSTIN") ? gStr : `GSTIN: ${gStr}`;
      lines.push(center(formattedGst));
    }

    lines.push(divider);

    const isPaid = (payload.paymentStatus || "").toLowerCase() === "paid";
    const docTitle = isPaid ? "PAID RECEIPT" : "PRE-PAYMENT BILL";
    lines.push(center(payload.isReprint ? `${docTitle} (REPRINT)` : docTitle));
    lines.push(divider);

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

    const rawDate = payload.timestamp;
    let dateOnlyStr = "";
    if (rawDate && /^\d{2}\/\d{2}\/\d{4}/.test(rawDate)) {
      dateOnlyStr = rawDate.split(",")[0].trim();
    } else if (rawDate && /^\d{4}-\d{2}-\d{2}/.test(rawDate)) {
      const [y, m, d] = rawDate.substring(0, 10).split("-");
      dateOnlyStr = `${d}/${m}/${y}`;
    } else {
      dateOnlyStr = new Date().toLocaleDateString("en-GB");
    }

    let modeStr = payload.paymentMode;
    if (!modeStr && payload.tenders && payload.tenders.length > 0) {
      modeStr = payload.tenders[0].method.toUpperCase();
    }
    if (!modeStr) {
      modeStr = isPaid ? "Paid" : "UNPAID";
    }

    let invLineLeft = "";
    if (payload.showInvoiceNum !== false) {
      const invPrefix = (`INVOICE #: ${payload.billNumber}`.length + `Ref: ${cleanLabel}`.length <= cols) ? "INVOICE #:" : "Inv #:";
      invLineLeft = `${invPrefix} ${payload.billNumber}`;
    }

    if (invLineLeft) {
      lines.push(justify(invLineLeft, `Ref: ${cleanLabel}`));
    } else {
      lines.push(center(`Ref: ${cleanLabel}`));
    }
    lines.push(justify(`Date: ${dateOnlyStr}`, `Mode: ${modeStr}`));

    if (payload.customerName && payload.customerName.trim()) {
      lines.push(`Customer: ${payload.customerName.trim()}`);
    }
    if (payload.customerPhone && payload.customerPhone.trim()) {
      lines.push(`Phone: ${payload.customerPhone.trim()}`);
    }
    lines.push(divider);

    // Items Header
    lines.push(justify("QTY  ITEM", "AMOUNT"));
    lines.push(divider);

    // Items List
    for (const item of payload.items) {
      const itemTotal = (item.price || 0) * (item.qty || 1);
      const priceStr = `Rs.${itemTotal.toFixed(2)}`;
      const qtyStr = `${item.qty}x`.padEnd(4);

      const maxNameLen = cols - qtyStr.length - priceStr.length - 1;
      const nameLines = this.wrapText(item.name, Math.max(10, maxNameLen));

      const firstLine = `${qtyStr}${nameLines[0]}`;
      lines.push(justify(firstLine, priceStr));

      for (let i = 1; i < nameLines.length; i++) {
        lines.push(`    ${nameLines[i]}`);
      }

      const itemNote = item.notes || (item as any).note;
      if (itemNote && itemNote.trim()) {
        lines.push(`     + ${itemNote.trim()}`);
      }
    }

    lines.push(divider);

    // Totals Section
    lines.push(justify("Subtotal:", `Rs.${payload.subtotal.toFixed(2)}`));

    const totalTax = (typeof payload.cgst === 'number' && typeof payload.sgst === 'number')
      ? payload.cgst + payload.sgst
      : payload.tax;

    if (totalTax > 0) {
      const cgstVal = typeof payload.cgst === 'number' ? payload.cgst : totalTax / 2;
      const sgstVal = typeof payload.sgst === 'number' ? payload.sgst : totalTax / 2;
      const calcRatePct = payload.gstPercentage ?? Math.round((totalTax / Math.max(1, payload.subtotal)) * 100);
      const halfRateStr = (calcRatePct / 2).toFixed(1).replace(/\.0$/, "");

      lines.push(justify(`CGST (${halfRateStr}%):`, `Rs.${cgstVal.toFixed(2)}`));
      lines.push(justify(`SGST (${halfRateStr}%):`, `Rs.${sgstVal.toFixed(2)}`));
    }

    if (payload.serviceCharge && payload.serviceCharge > 0) {
      lines.push(justify("Service Charge:", `Rs.${payload.serviceCharge.toFixed(2)}`));
    }

    if (payload.discountAmt && payload.discountAmt > 0) {
      lines.push(justify("Discount:", `-Rs.${payload.discountAmt.toFixed(2)}`));
    }

    lines.push(divider);
    lines.push(justify("NET PAYABLE TOTAL:", `Rs.${payload.netTotal.toFixed(2)}`));
    lines.push(divider);

    // Footer
    const thankMsg = payload.thankYouMessage && payload.thankYouMessage.trim()
      ? payload.thankYouMessage.trim()
      : "Thank you for dining with us!\nPlease visit again";

    const thankLines = thankMsg.split("\n");
    for (const tl of thankLines) {
      const wrapped = this.wrapText(tl.trim(), cols);
      for (const wl of wrapped) {
        lines.push(center(wl));
      }
    }

    if (payload.footerInfo && payload.footerInfo.trim()) {
      const footerLines = payload.footerInfo.trim().split("\n");
      for (const fl of footerLines) {
        const wrapped = this.wrapText(fl.trim(), cols);
        for (const wl of wrapped) {
          lines.push(center(wl));
        }
      }
    }

    lines.push(doubleDivider);

    return lines.join("\n");
  }

  /**
   * Generates compact ESC/POS thermal command stream formatted for 58mm/80mm thermal printers.
   */
  public static buildEscPos(payload: ReceiptBuilderPayload, widthmm: 58 | 80 = 58): string {
    const cols = widthmm === 58 ? 32 : 48;
    const divider = "-".repeat(cols) + "\n";
    const doubleDivider = "=".repeat(cols) + "\n";

    const parts: string[] = [];

    // Reset printer & set compact 24-dot line spacing
    parts.push(ESC_POS.INIT);
    parts.push(ESC_POS.SET_LINE_SPACING_24);
    parts.push(ESC_POS.ALIGN_CENTER);

    parts.push(doubleDivider);

    // Cafe Name Header
    parts.push(ESC_POS.BOLD_ON);
    parts.push(`${(payload.cafeName || "CHEESE CORNER").toUpperCase()}\n`);
    parts.push(ESC_POS.BOLD_OFF);

    if (payload.receiptHeader && payload.receiptHeader.trim()) {
      const headerLines = payload.receiptHeader.trim().split("\n");
      for (const hl of headerLines) {
        const wrapped = this.wrapText(hl.trim(), cols);
        for (const wl of wrapped) {
          parts.push(`${wl}\n`);
        }
      }
    }

    if (payload.showAddress !== false && payload.address && payload.address.trim()) {
      const addrLines = this.wrapText(payload.address.trim(), cols);
      for (const al of addrLines) {
        parts.push(`${al}\n`);
      }
    }

    const phoneNum = payload.phone || payload.cafePhone;
    if (payload.showPhone !== false && phoneNum && phoneNum.trim()) {
      const pStr = phoneNum.trim();
      const formattedPhone = pStr.startsWith("+") || pStr.toLowerCase().startsWith("ph") ? pStr : `Ph: ${pStr}`;
      parts.push(`${formattedPhone}\n`);
    }

    if (payload.showGst !== false && payload.gstin && payload.gstin.trim()) {
      const gStr = payload.gstin.trim();
      const formattedGst = gStr.toUpperCase().startsWith("GSTIN") ? gStr : `GSTIN: ${gStr}`;
      parts.push(`${formattedGst}\n`);
    }

    parts.push(divider);

    const isPaid = (payload.paymentStatus || "").toLowerCase() === "paid";
    const docTitle = isPaid ? "PAID RECEIPT" : "PRE-PAYMENT BILL";

    parts.push(ESC_POS.BOLD_ON);
    parts.push(`${payload.isReprint ? `${docTitle} (REPRINT)` : docTitle}\n`);
    parts.push(ESC_POS.BOLD_OFF);

    parts.push(divider);

    // Bill & Order Metadata
    parts.push(ESC_POS.ALIGN_LEFT);

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

    const rawDate = payload.timestamp;
    let dateOnlyStr = "";
    if (rawDate && /^\d{2}\/\d{2}\/\d{4}/.test(rawDate)) {
      dateOnlyStr = rawDate.split(",")[0].trim();
    } else if (rawDate && /^\d{4}-\d{2}-\d{2}/.test(rawDate)) {
      const [y, m, d] = rawDate.substring(0, 10).split("-");
      dateOnlyStr = `${d}/${m}/${y}`;
    } else {
      dateOnlyStr = new Date().toLocaleDateString("en-GB");
    }

    let modeStr = payload.paymentMode;
    if (!modeStr && payload.tenders && payload.tenders.length > 0) {
      modeStr = payload.tenders[0].method.toUpperCase();
    }
    if (!modeStr) {
      modeStr = isPaid ? "Paid" : "UNPAID";
    }

    let invLineLeftEsc = "";
    if (payload.showInvoiceNum !== false) {
      const invPrefixEsc = (`INVOICE #: ${payload.billNumber}`.length + `Ref: ${cleanLabel}`.length <= cols) ? "INVOICE #:" : "Inv #:";
      invLineLeftEsc = `${invPrefixEsc} ${payload.billNumber}`;
    }

    if (invLineLeftEsc) {
      parts.push(this.justify(invLineLeftEsc, `Ref: ${cleanLabel}`, cols) + "\n");
    } else {
      parts.push(this.justify("", `Ref: ${cleanLabel}`, cols) + "\n");
    }

    parts.push(this.justify(`Date: ${dateOnlyStr}`, `Mode: ${modeStr}`, cols) + "\n");

    if (payload.customerName && payload.customerName.trim()) {
      parts.push(`Customer: ${payload.customerName.trim()}\n`);
    }
    if (payload.customerPhone && payload.customerPhone.trim()) {
      parts.push(`Phone: ${payload.customerPhone.trim()}\n`);
    }
    parts.push(divider);

    // Items Header
    parts.push(ESC_POS.BOLD_ON);
    parts.push(this.justify("QTY  ITEM", "AMOUNT", cols) + "\n");
    parts.push(ESC_POS.BOLD_OFF);
    parts.push(divider);

    // Items List
    for (const item of payload.items) {
      const itemTotal = (item.price || 0) * (item.qty || 1);
      const priceStr = `Rs.${itemTotal.toFixed(2)}`;
      const qtyStr = `${item.qty}x`.padEnd(4);

      const maxNameLen = cols - qtyStr.length - priceStr.length - 1;
      const nameLines = this.wrapText(item.name, Math.max(10, maxNameLen));

      const firstLine = `${qtyStr}${nameLines[0]}`;
      parts.push(this.justify(firstLine, priceStr, cols) + "\n");

      for (let i = 1; i < nameLines.length; i++) {
        parts.push(`    ${nameLines[i]}\n`);
      }

      const itemNote = item.notes || (item as any).note;
      if (itemNote && itemNote.trim()) {
        parts.push(`     + ${itemNote.trim()}\n`);
      }
    }

    parts.push(divider);

    // Totals Section
    parts.push(this.justify("Subtotal:", `Rs.${payload.subtotal.toFixed(2)}`, cols) + "\n");

    const totalTaxEsc = (typeof payload.cgst === 'number' && typeof payload.sgst === 'number')
      ? payload.cgst + payload.sgst
      : payload.tax;

    if (totalTaxEsc > 0) {
      const cgstVal = typeof payload.cgst === 'number' ? payload.cgst : totalTaxEsc / 2;
      const sgstVal = typeof payload.sgst === 'number' ? payload.sgst : totalTaxEsc / 2;
      const calcRatePct = payload.gstPercentage ?? Math.round((totalTaxEsc / Math.max(1, payload.subtotal)) * 100);
      const halfRateStr = (calcRatePct / 2).toFixed(1).replace(/\.0$/, "");

      parts.push(this.justify(`CGST (${halfRateStr}%):`, `Rs.${cgstVal.toFixed(2)}`, cols) + "\n");
      parts.push(this.justify(`SGST (${halfRateStr}%):`, `Rs.${sgstVal.toFixed(2)}`, cols) + "\n");
    }

    if (payload.serviceCharge && payload.serviceCharge > 0) {
      parts.push(this.justify("Service Charge:", `Rs.${payload.serviceCharge.toFixed(2)}`, cols) + "\n");
    }

    if (payload.discountAmt && payload.discountAmt > 0) {
      parts.push(this.justify("Discount:", `-Rs.${payload.discountAmt.toFixed(2)}`, cols) + "\n");
    }

    parts.push(divider);

    // Bold Net Total
    parts.push(ESC_POS.BOLD_ON);
    parts.push(this.justify("NET PAYABLE TOTAL:", `Rs.${payload.netTotal.toFixed(2)}`, cols) + "\n");
    parts.push(ESC_POS.BOLD_OFF);

    parts.push(divider);

    // Footer
    parts.push(ESC_POS.ALIGN_CENTER);

    const thankMsg = payload.thankYouMessage && payload.thankYouMessage.trim()
      ? payload.thankYouMessage.trim()
      : "Thank you for dining with us!\nPlease visit again";

    const thankLines = thankMsg.split("\n");
    for (const tl of thankLines) {
      const wrapped = this.wrapText(tl.trim(), cols);
      for (const wl of wrapped) {
        parts.push(`${wl}\n`);
      }
    }

    if (payload.footerInfo && payload.footerInfo.trim()) {
      const footerLines = payload.footerInfo.trim().split("\n");
      for (const fl of footerLines) {
        const wrapped = this.wrapText(fl.trim(), cols);
        for (const wl of wrapped) {
          parts.push(`${wl}\n`);
        }
      }
    }

    parts.push(doubleDivider);

    // Feed paper past print head to cutter blade before cutting (5 explicit line feeds + 3 in FEED_AND_CUT = 8 lines total)
    parts.push(ESC_POS.LINE_FEED);
    parts.push(ESC_POS.LINE_FEED);
    parts.push(ESC_POS.LINE_FEED);
    parts.push(ESC_POS.LINE_FEED);
    parts.push(ESC_POS.LINE_FEED);
    parts.push(ESC_POS.FEED_AND_CUT);

    return parts.join("");
  }

  private static justify(left: string, right: string, cols: number): string {
    const spaceLength = cols - left.length - right.length;
    if (spaceLength <= 0) {
      return `${left.substring(0, cols - right.length - 1)} ${right}`;
    }
    return left + " ".repeat(spaceLength) + right;
  }

  private static wrapText(text: string, maxLen: number): string[] {
    if (!text) return [""];
    if (text.length <= maxLen) return [text];

    const words = text.split(" ");
    const lines: string[] = [];
    let currentLine = "";

    for (const word of words) {
      if ((currentLine + (currentLine ? " " : "") + word).length <= maxLen) {
        currentLine += (currentLine ? " " : "") + word;
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word.length > maxLen ? word.substring(0, maxLen) : word;
      }
    }
    if (currentLine) lines.push(currentLine);

    return lines.length > 0 ? lines : [text.substring(0, maxLen)];
  }
}
