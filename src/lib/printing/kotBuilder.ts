/**
 * Production Kitchen Order Ticket (KOT) ESC/POS Builder
 * Formats ESC/POS binary commands & clean text for 80mm thermal receipt printers (48 columns).
 */

import { ESC_POS } from "./constants";

export interface KotItemInput {
  id?: string;
  name: string;
  qty: number;
  price?: number;
  modifiers?: string[] | string;
  notes?: string;
}

export interface KotBuilderPayload {
  restaurantName?: string;
  kotNumber: number | string;
  orderNumber: number | string;
  tableLabel: string;
  timestamp?: string;
  items: KotItemInput[];
  specialInstructions?: string;
  notes?: string;
  isReprint?: boolean;
  orderSource?: "DINE_IN" | "TAKEAWAY" | "SWIGGY" | "ZOMATO" | string;
  externalOrderRef?: string | null;
}

export interface KotBuildResult {
  text: string;
  escpos: string;
}

export class KotBuilder {
  /**
   * Builds both clean plain text (for previews/logs) and raw ESC/POS commands (for 58mm thermal printers).
   */
  public static build(payload: KotBuilderPayload, widthmm: 58 | 80 = 58): KotBuildResult {
    return {
      text: this.buildText(payload, widthmm),
      escpos: this.buildEscPos(payload, widthmm),
    };
  }

  /**
   * Generates clean formatted text representation of KOT (default 58mm / 32 columns)
   */
  public static buildText(payload: KotBuilderPayload, widthmm: 58 | 80 = 58): string {
    const cols = widthmm === 58 ? 32 : 48;
    const divider = "-".repeat(cols);
    const doubleDivider = "=".repeat(cols);

    const center = (text: string): string => {
      if (text.length >= cols) return text.substring(0, cols);
      const pad = Math.floor((cols - text.length) / 2);
      return " ".repeat(pad) + text;
    };

    const lines: string[] = [];

    // Header & Title
    lines.push(doubleDivider);
    if (payload.restaurantName) {
      lines.push(center(payload.restaurantName.toUpperCase()));
    }

    const source = payload.orderSource || "DINE_IN";
    const refStr = payload.externalOrderRef ? `#${payload.externalOrderRef}` : "";

    if (source === "TAKEAWAY") {
      lines.push(center("*** TAKEAWAY KOT ***"));
    } else if (source === "SWIGGY") {
      lines.push(center(`*** SWIGGY KOT ${refStr} ***`.trim()));
    } else if (source === "ZOMATO") {
      lines.push(center(`*** ZOMATO KOT ${refStr} ***`.trim()));
    } else {
      lines.push(center("*** KITCHEN KOT ***"));
    }

    if (payload.isReprint) {
      lines.push(center("** REPRINT **"));
    }
    lines.push(doubleDivider);

    // Table Visibility (Prominent Header Section)
    const rawLabel = payload.tableLabel || "Express";
    let cleanLabel = rawLabel;
    if (source === "TAKEAWAY") {
      cleanLabel = "TAKEAWAY";
    } else if (source === "SWIGGY") {
      cleanLabel = `SWIGGY ${refStr}`.trim();
    } else if (source === "ZOMATO") {
      cleanLabel = `ZOMATO ${refStr}`.trim();
    } else if (!rawLabel.toLowerCase().startsWith("table")) {
      cleanLabel = `TABLE ${rawLabel.toUpperCase()}`;
    } else {
      cleanLabel = rawLabel.toUpperCase();
    }

    lines.push(center(cleanLabel));
    lines.push(center(source.replace(/_/g, " ")));
    lines.push(doubleDivider);

    const timeStr = payload.timestamp || new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
    const safeKotNum = payload.kotNumber && String(payload.kotNumber) !== "undefined" ? payload.kotNumber : 1;
    const safeOrderNum = payload.orderNumber && String(payload.orderNumber) !== "undefined" ? payload.orderNumber : 1;

    lines.push(this.justify(`KOT #: ${safeKotNum}`, `Order #: ${safeOrderNum}`, cols));
    lines.push(this.justify(`Time: ${timeStr}`, `Source: ${source}`, cols));

    if (payload.customerName && payload.customerName.trim()) {
      lines.push(`Customer: ${payload.customerName.trim()}`);
    }
    if (payload.customerPhone && payload.customerPhone.trim()) {
      lines.push(`Phone   : ${payload.customerPhone.trim()}`);
    }
    lines.push(divider);

    // Items Header
    lines.push(this.justify("QTY  ITEM DESCRIPTION", "MODIFIERS", cols));
    lines.push(divider);

    // Items List
    for (const item of payload.items) {
      const qtyStr = `${item.qty}x`.padEnd(5);
      const itemMaxLen = cols - 5;

      const nameLines = this.wrapText(item.name, itemMaxLen);
      lines.push(`${qtyStr}${nameLines[0]}`);
      for (let i = 1; i < nameLines.length; i++) {
        lines.push(`     ${nameLines[i]}`);
      }

      const mods: string[] = [];
      if (item.modifiers) {
        if (Array.isArray(item.modifiers)) {
          mods.push(...item.modifiers.filter(Boolean));
        } else if (typeof item.modifiers === "string" && item.modifiers.trim()) {
          mods.push(item.modifiers.trim());
        }
      }
      if (item.notes && item.notes.trim()) {
        mods.push(item.notes.trim());
      }

      if (mods.length > 0) {
        for (const m of mods) {
          lines.push(`     > ${m}`);
        }
      }
    }

    lines.push(divider);

    // Special Instructions
    const instructions = payload.specialInstructions || payload.notes;
    if (instructions && instructions.trim()) {
      lines.push("SPECIAL INSTRUCTIONS:");
      const instLines = this.wrapText(instructions.trim(), cols);
      for (const il of instLines) {
        lines.push(il);
      }
      lines.push(divider);
    }

    const totalQty = payload.items.reduce((acc, item) => acc + (item.qty || 1), 0);
    lines.push(center(`TOTAL ITEMS: ${totalQty}`));
    lines.push(doubleDivider);

    return lines.join("\n");
  }

  /**
   * Generates ESC/POS thermal command stream for 58mm thermal printers
   */
  public static buildEscPos(payload: KotBuilderPayload, widthmm: 58 | 80 = 58): string {
    const cols = widthmm === 58 ? 32 : 48;
    const divider = "-".repeat(cols) + "\n";
    const doubleDivider = "=".repeat(cols) + "\n";

    const parts: string[] = [];

    // Reset printer
    parts.push(ESC_POS.INIT);
    parts.push(ESC_POS.ALIGN_CENTER);

    parts.push(doubleDivider);

    // Restaurant Name
    if (payload.restaurantName) {
      parts.push(ESC_POS.BOLD_ON);
      parts.push(`${payload.restaurantName.toUpperCase()}\n`);
      parts.push(ESC_POS.BOLD_OFF);
    }

    // Double-size Title Header
    parts.push(ESC_POS.BOLD_ON);
    parts.push("\x1D\x21\x11"); // GS ! 0x11 (Double Width & Double Height)

    const source = payload.orderSource || "DINE_IN";
    const refStr = payload.externalOrderRef ? `#${payload.externalOrderRef}` : "";

    if (source === "TAKEAWAY") {
      parts.push("TAKEAWAY KOT\n");
    } else if (source === "SWIGGY") {
      parts.push(`SWIGGY KOT ${refStr}\n`.trim() + "\n");
    } else if (source === "ZOMATO") {
      parts.push(`ZOMATO KOT ${refStr}\n`.trim() + "\n");
    } else {
      parts.push("KITCHEN KOT\n");
    }

    parts.push("\x1D\x21\x00"); // Reset font size
    parts.push(ESC_POS.BOLD_OFF);

    // Reprint Tag
    if (payload.isReprint) {
      parts.push(ESC_POS.BOLD_ON);
      parts.push("** REPRINT **\n");
      parts.push(ESC_POS.BOLD_OFF);
    }

    parts.push(doubleDivider);

    // Prominent Table Banner (Double Height & Width)
    const rawLabel = payload.tableLabel || "Express";
    let cleanLabel = rawLabel;
    if (source === "TAKEAWAY") {
      cleanLabel = "TAKEAWAY";
    } else if (source === "SWIGGY") {
      cleanLabel = `SWIGGY ${refStr}`.trim();
    } else if (source === "ZOMATO") {
      cleanLabel = `ZOMATO ${refStr}`.trim();
    } else if (!rawLabel.toLowerCase().startsWith("table")) {
      cleanLabel = `TABLE ${rawLabel.toUpperCase()}`;
    } else {
      cleanLabel = rawLabel.toUpperCase();
    }

    parts.push(ESC_POS.BOLD_ON);
    parts.push("\x1D\x21\x11"); // Double Width & Height
    parts.push(`${cleanLabel}\n`);
    parts.push("\x1D\x21\x00");
    parts.push(`${source.replace(/_/g, " ")}\n`);
    parts.push(ESC_POS.BOLD_OFF);

    parts.push(doubleDivider);

    // Metadata Section
    parts.push(ESC_POS.ALIGN_LEFT);
    const timeStr = payload.timestamp || new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
    const safeKotNum = payload.kotNumber && String(payload.kotNumber) !== "undefined" ? payload.kotNumber : 1;
    const safeOrderNum = payload.orderNumber && String(payload.orderNumber) !== "undefined" ? payload.orderNumber : 1;

    parts.push(this.justify(`KOT #: ${safeKotNum}`, `Order #: ${safeOrderNum}`, cols) + "\n");
    parts.push(this.justify(`Time: ${timeStr}`, `Source: ${source}`, cols) + "\n");

    if (payload.customerName && payload.customerName.trim()) {
      parts.push(`Customer: ${payload.customerName.trim()}\n`);
    }
    if (payload.customerPhone && payload.customerPhone.trim()) {
      parts.push(`Phone   : ${payload.customerPhone.trim()}\n`);
    }
    parts.push(divider);

    // Items Header
    parts.push(ESC_POS.BOLD_ON);
    parts.push(this.justify("QTY  ITEM DESCRIPTION", "MODIFIERS", cols) + "\n");
    parts.push(ESC_POS.BOLD_OFF);
    parts.push(divider);

    // Items List
    for (const item of payload.items) {
      const qtyStr = `${item.qty}x`.padEnd(5);
      const itemMaxLen = cols - 5;

      const nameLines = this.wrapText(item.name, itemMaxLen);

      // Bold Quantity
      parts.push(ESC_POS.BOLD_ON);
      parts.push(qtyStr);
      parts.push(ESC_POS.BOLD_OFF);
      parts.push(nameLines[0] + "\n");

      for (let i = 1; i < nameLines.length; i++) {
        parts.push(`     ${nameLines[i]}\n`);
      }

      const mods: string[] = [];
      if (item.modifiers) {
        if (Array.isArray(item.modifiers)) {
          mods.push(...item.modifiers.filter(Boolean));
        } else if (typeof item.modifiers === "string" && item.modifiers.trim()) {
          mods.push(item.modifiers.trim());
        }
      }
      if (item.notes && item.notes.trim()) {
        mods.push(item.notes.trim());
      }

      if (mods.length > 0) {
        parts.push(ESC_POS.BOLD_ON);
        for (const m of mods) {
          parts.push(`     > ${m}\n`);
        }
        parts.push(ESC_POS.BOLD_OFF);
      }
    }

    parts.push(divider);

    // Special Instructions
    const instructions = payload.specialInstructions || payload.notes;
    if (instructions && instructions.trim()) {
      parts.push(ESC_POS.BOLD_ON);
      parts.push("SPECIAL INSTRUCTIONS:\n");
      parts.push(ESC_POS.BOLD_OFF);
      const instLines = this.wrapText(instructions.trim(), cols);
      for (const il of instLines) {
        parts.push(il + "\n");
      }
      parts.push(divider);
    }

    // Total Items & Footer
    const totalQty = payload.items.reduce((acc, item) => acc + (item.qty || 1), 0);
    parts.push(ESC_POS.ALIGN_CENTER);
    parts.push(ESC_POS.BOLD_ON);
    parts.push(`TOTAL ITEMS: ${totalQty}\n`);
    parts.push(ESC_POS.BOLD_OFF);
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
