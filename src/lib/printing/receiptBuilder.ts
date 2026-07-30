/**
 * Production Customer Receipt ESC/POS Builder
 * Formats ESC/POS binary commands & clean text previews for 58mm thermal receipt printers (32 columns).
 */

import { ESC_POS } from "./constants";

export interface ReceiptItemInput {
  id?: string;
  name: string;
  price: number;
  qty: number;
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
  items: ReceiptItemInput[];
  subtotal: number;
  tax: number;
  discountPct?: number;
  discountAmt?: number;
  netTotal: number;
  tenders?: { method: string; amount: number }[];
  paymentStatus?: "unpaid" | "paid" | "voided" | string;
  isReprint?: boolean;
  orderSource?: "DINE_IN" | "TAKEAWAY" | "SWIGGY" | "ZOMATO" | string;
  externalOrderRef?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
}

export interface ReceiptBuildResult {
  text: string;
  escpos: string;
}

export class ReceiptBuilder {
  private static readonly COLUMN_WIDTH_58MM = 32;

  /**
   * Builds both clean 32-column text preview and raw 58mm ESC/POS command buffer.
   */
  public static build(payload: ReceiptBuilderPayload, widthmm: 58 | 80 = 58): ReceiptBuildResult {
    return {
      text: this.buildText(payload, widthmm),
      escpos: this.buildEscPos(payload, widthmm),
    };
  }

  /**
   * Generates clean formatted text representation (32 columns)
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
    lines.push(center((payload.cafeName || "ORDERRAIL PRO CAFE").toUpperCase()));
    if (payload.address) {
      const addrLines = this.wrapText(payload.address, cols);
      for (const al of addrLines) {
        lines.push(center(al));
      }
    }
    if (payload.gstin) {
      lines.push(center(`GSTIN: ${payload.gstin}`));
    } else {
      lines.push(center("GSTIN: 27AAAAA0000A1Z5"));
    }
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

    const timeStr = payload.timestamp || new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
    const statusStr = (payload.paymentStatus || "UNPAID").toUpperCase();

    lines.push(justify(`INVOICE #: ${payload.billNumber}`, `Ref: ${cleanLabel}`));
    if (payload.orderNumber) {
      lines.push(justify(`Order #: ${payload.orderNumber}`, `Staff: ${payload.cashierName || "Counter"}`));
    }
    lines.push(justify(`Date: ${timeStr}`, `Status: ${statusStr}`));
    if (payload.customerName) {
      lines.push(`Customer: ${payload.customerName}`);
    }
    if (payload.customerPhone) {
      lines.push(`Phone   : ${payload.customerPhone}`);
    }
    lines.push(divider);

    // Items Header
    lines.push(justify("QTY  ITEM DESCRIPTION", "AMOUNT"));
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
    }

    lines.push(divider);

    // Totals Section
    lines.push(justify("Subtotal:", `Rs.${payload.subtotal.toFixed(2)}`));

    if (payload.tax > 0) {
      const cgst = payload.tax / 2;
      const sgst = payload.tax / 2;
      lines.push(justify("CGST (2.5%):", `Rs.${cgst.toFixed(2)}`));
      lines.push(justify("SGST (2.5%):", `Rs.${sgst.toFixed(2)}`));
    }

    if (payload.discountAmt && payload.discountAmt > 0) {
      lines.push(justify("Discount:", `-Rs.${payload.discountAmt.toFixed(2)}`));
    }

    lines.push(doubleDivider);
    lines.push(justify("NET PAYABLE TOTAL:", `Rs.${payload.netTotal.toFixed(2)}`));
    lines.push(doubleDivider);

    // Tender / Payment Details
    if (payload.tenders && payload.tenders.length > 0) {
      lines.push("PAYMENT DETAILS:");
      for (const t of payload.tenders) {
        lines.push(justify(`  ${t.method.toUpperCase()}`, `₹${t.amount.toFixed(2)}`));
      }
      lines.push(divider);
    } else {
      lines.push(center(`[ PAYMENT STATUS: ${statusStr} ]`));
      lines.push(divider);
    }

    // Footer
    lines.push(center("Thank you for dining with us!"));
    lines.push(center("Please visit again"));
    lines.push(doubleDivider);

    return lines.join("\n");
  }

  /**
   * Generates ESC/POS thermal command stream formatted for 58mm thermal printers (32 columns)
   */
  public static buildEscPos(payload: ReceiptBuilderPayload, widthmm: 58 | 80 = 58): string {
    const cols = widthmm === 58 ? 32 : 48;
    const divider = "-".repeat(cols) + "\n";
    const doubleDivider = "=".repeat(cols) + "\n";

    const parts: string[] = [];

    // Reset printer
    parts.push(ESC_POS.INIT);
    parts.push(ESC_POS.ALIGN_CENTER);

    parts.push(doubleDivider);

    // Cafe Name Header
    parts.push(ESC_POS.BOLD_ON);
    parts.push(`${(payload.cafeName || "ORDERRAIL PRO CAFE").toUpperCase()}\n`);
    parts.push(ESC_POS.BOLD_OFF);

    if (payload.address) {
      const addrLines = this.wrapText(payload.address, cols);
      for (const al of addrLines) {
        parts.push(`${al}\n`);
      }
    }

    parts.push(`GSTIN: ${payload.gstin || "27AAAAA0000A1Z5"}\n`);
    parts.push(doubleDivider);

    if (payload.isReprint) {
      parts.push(ESC_POS.BOLD_ON);
      parts.push("** REPRINT RECEIPT **\n");
      parts.push(ESC_POS.BOLD_OFF);
      parts.push(divider);
    }

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

    const timeStr = payload.timestamp || new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
    const statusStr = (payload.paymentStatus || "UNPAID").toUpperCase();

    parts.push(this.justify(`INVOICE #: ${payload.billNumber}`, `Ref: ${cleanLabel}`, cols) + "\n");
    if (payload.orderNumber) {
      parts.push(this.justify(`Order #: ${payload.orderNumber}`, `Staff: ${payload.cashierName || "Counter"}`, cols) + "\n");
    }
    parts.push(this.justify(`Date: ${timeStr}`, `Status: ${statusStr}`, cols) + "\n");
    if (payload.customerName) {
      parts.push(`Customer: ${payload.customerName}\n`);
    }
    if (payload.customerPhone) {
      parts.push(`Phone   : ${payload.customerPhone}\n`);
    }
    parts.push(divider);

    // Items Header
    parts.push(ESC_POS.BOLD_ON);
    parts.push(this.justify("QTY  ITEM DESCRIPTION", "AMOUNT", cols) + "\n");
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
    }

    parts.push(divider);

    // Totals Section
    parts.push(this.justify("Subtotal:", `Rs.${payload.subtotal.toFixed(2)}`, cols) + "\n");

    if (payload.tax > 0) {
      const cgst = payload.tax / 2;
      const sgst = payload.tax / 2;
      parts.push(this.justify("CGST (2.5%):", `Rs.${cgst.toFixed(2)}`, cols) + "\n");
      parts.push(this.justify("SGST (2.5%):", `Rs.${sgst.toFixed(2)}`, cols) + "\n");
    }

    if (payload.discountAmt && payload.discountAmt > 0) {
      parts.push(this.justify("Discount:", `-Rs.${payload.discountAmt.toFixed(2)}`, cols) + "\n");
    }

    parts.push(doubleDivider);

    // Bold Net Total
    parts.push(ESC_POS.BOLD_ON);
    parts.push(this.justify("NET PAYABLE TOTAL:", `Rs.${payload.netTotal.toFixed(2)}`, cols) + "\n");
    parts.push(ESC_POS.BOLD_OFF);

    parts.push(doubleDivider);

    // Payment Details
    if (payload.tenders && payload.tenders.length > 0) {
      parts.push(ESC_POS.BOLD_ON);
      parts.push("PAYMENT DETAILS:\n");
      parts.push(ESC_POS.BOLD_OFF);
      for (const t of payload.tenders) {
        parts.push(this.justify(`  ${t.method.toUpperCase()}`, `Rs.${t.amount.toFixed(2)}`, cols) + "\n");
      }
      parts.push(divider);
    } else {
      parts.push(ESC_POS.ALIGN_CENTER);
      parts.push(`[ PAYMENT STATUS: ${statusStr} ]\n`);
      parts.push(divider);
    }

    // Footer
    parts.push(ESC_POS.ALIGN_CENTER);
    parts.push("Thank you for dining with us!\n");
    parts.push("Please visit again\n");
    parts.push(doubleDivider);

    // Feed and cut paper
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
