/**
 * Production Kitchen Order Ticket (KOT) ESC/POS & Text Builder
 * Formats ESC/POS binary commands & clean text for 58mm (32 cols) and 80mm (48 cols) thermal printers.
 * Supports:
 * 1. Standard Kitchen Order Tickets (KOT) & Reprints
 * 2. Amendment / Modified KOTs (highlighting added, removed, quantity & note deltas)
 * 3. Cancelled KOTs (highlighting reason, cancelled items, and kitchen stop warnings)
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

export interface KotDeltaItem {
  menu_item_id?: string;
  name: string;
  qty?: number;
  old_qty?: number;
  new_qty?: number;
  note?: string | null;
  old_note?: string | null;
  new_note?: string | null;
  modifiers?: string[] | string;
  price_cents?: number;
}

export interface KotDeltaPayload {
  added?: KotDeltaItem[];
  removed?: KotDeltaItem[];
  modified?: KotDeltaItem[];
}

export interface KotBuilderPayload {
  restaurantName?: string;
  kotNumber: number | string;
  orderNumber: number | string;
  tableLabel: string;
  timestamp?: string;
  customerName?: string | null;
  customerPhone?: string | null;
  operatorName?: string;
  items: KotItemInput[];
  specialInstructions?: string;
  notes?: string;
  isReprint?: boolean;
  orderSource?: "DINE_IN" | "TAKEAWAY" | "SWIGGY" | "ZOMATO" | string;
  externalOrderRef?: string | null;
}

export interface KotAmendmentBuilderPayload {
  restaurantName?: string;
  kotNumber: number | string;
  orderNumber: number | string;
  tableLabel: string;
  timestamp?: string;
  customerName?: string | null;
  customerPhone?: string | null;
  operatorName?: string;
  delta: KotDeltaPayload;
  specialInstructions?: string;
  notes?: string;
  orderSource?: "DINE_IN" | "TAKEAWAY" | "SWIGGY" | "ZOMATO" | string;
  externalOrderRef?: string | null;
}

export interface KotCancelBuilderPayload {
  restaurantName?: string;
  kotNumber: number | string;
  orderNumber: number | string;
  tableLabel: string;
  timestamp?: string;
  customerName?: string | null;
  customerPhone?: string | null;
  operatorName?: string;
  reason?: string;
  cancelledItems?: KotItemInput[];
  notes?: string;
  orderSource?: "DINE_IN" | "TAKEAWAY" | "SWIGGY" | "ZOMATO" | string;
  externalOrderRef?: string | null;
}

export interface KotBuildResult {
  text: string;
  escpos: string;
}

export class KotBuilder {
  /**
   * Builds both clean plain text and raw ESC/POS commands for standard KOTs.
   */
  public static build(payload: KotBuilderPayload, widthmm: 58 | 80 = 58): KotBuildResult {
    return {
      text: this.buildText(payload, widthmm),
      escpos: this.buildEscPos(payload, widthmm),
    };
  }

  /**
   * Generates clean formatted text representation of a standard KOT.
   */
  public static buildText(payload: KotBuilderPayload, widthmm: 58 | 80 = 58): string {
    const cols = widthmm === 58 ? 32 : 48;
    const divider = "-".repeat(cols);
    const doubleDivider = "=".repeat(cols);

    const lines: string[] = [];

    // Header & Table Visibility
    lines.push(doubleDivider);
    if (payload.restaurantName) {
      lines.push(this.center(payload.restaurantName.toUpperCase(), cols));
    }

    if (payload.isReprint) {
      lines.push(this.center("** REPRINT **", cols));
    }

    const source = payload.orderSource || "DINE_IN";
    const cleanLabel = this.formatTableLabel(payload.tableLabel, source, payload.externalOrderRef);

    lines.push(this.center(cleanLabel, cols));
    lines.push(this.center(source.replace(/_/g, " "), cols));
    lines.push(doubleDivider);

    const timeStr = payload.timestamp || new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
    const safeKotNum = payload.kotNumber && String(payload.kotNumber) !== "undefined" ? payload.kotNumber : 1;
    const safeOrderNum = payload.orderNumber && String(payload.orderNumber) !== "undefined" ? payload.orderNumber : 1;

    lines.push(this.justify(`KOT #: ${safeKotNum}`, `Order #: ${safeOrderNum}`, cols));
    lines.push(this.justify(`Time: ${timeStr}`, `Source: ${source}`, cols));

    if (payload.operatorName && payload.operatorName.trim()) {
      lines.push(`Operator: ${payload.operatorName.trim()}`);
    }
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

      const mods = this.extractModifiers(item);
      for (const m of mods) {
        lines.push(`     > ${m}`);
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
    lines.push(this.center(`TOTAL ITEMS: ${totalQty}`, cols));
    lines.push(doubleDivider);

    return lines.join("\n");
  }

  /**
   * Generates ESC/POS thermal command stream for a standard KOT.
   */
  public static buildEscPos(payload: KotBuilderPayload, widthmm: 58 | 80 = 58): string {
    const cols = widthmm === 58 ? 32 : 48;
    const divider = "-".repeat(cols) + "\n";
    const doubleDivider = "=".repeat(cols) + "\n";

    const parts: string[] = [];

    parts.push(ESC_POS.INIT);
    parts.push(ESC_POS.ALIGN_CENTER);
    parts.push(doubleDivider);

    if (payload.restaurantName) {
      parts.push(ESC_POS.BOLD_ON);
      parts.push(`${payload.restaurantName.toUpperCase()}\n`);
      parts.push(ESC_POS.BOLD_OFF);
    }

    if (payload.isReprint) {
      parts.push(ESC_POS.BOLD_ON);
      parts.push("** REPRINT **\n");
      parts.push(ESC_POS.BOLD_OFF);
    }

    const source = payload.orderSource || "DINE_IN";
    const cleanLabel = this.formatTableLabel(payload.tableLabel, source, payload.externalOrderRef);

    parts.push(ESC_POS.BOLD_ON);
    parts.push("\x1D\x21\x11"); // Double Width & Height
    parts.push(`${cleanLabel}\n`);
    parts.push("\x1D\x21\x00");
    parts.push(`${source.replace(/_/g, " ")}\n`);
    parts.push(ESC_POS.BOLD_OFF);

    parts.push(doubleDivider);

    parts.push(ESC_POS.ALIGN_LEFT);
    const timeStr = payload.timestamp || new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
    const safeKotNum = payload.kotNumber && String(payload.kotNumber) !== "undefined" ? payload.kotNumber : 1;
    const safeOrderNum = payload.orderNumber && String(payload.orderNumber) !== "undefined" ? payload.orderNumber : 1;

    parts.push(this.justify(`KOT #: ${safeKotNum}`, `Order #: ${safeOrderNum}`, cols) + "\n");
    parts.push(this.justify(`Time: ${timeStr}`, `Source: ${source}`, cols) + "\n");

    if (payload.operatorName && payload.operatorName.trim()) {
      parts.push(`Operator: ${payload.operatorName.trim()}\n`);
    }
    if (payload.customerName && payload.customerName.trim()) {
      parts.push(`Customer: ${payload.customerName.trim()}\n`);
    }
    if (payload.customerPhone && payload.customerPhone.trim()) {
      parts.push(`Phone   : ${payload.customerPhone.trim()}\n`);
    }
    parts.push(divider);

    parts.push(ESC_POS.BOLD_ON);
    parts.push(this.justify("QTY  ITEM DESCRIPTION", "MODIFIERS", cols) + "\n");
    parts.push(ESC_POS.BOLD_OFF);
    parts.push(divider);

    for (const item of payload.items) {
      const qtyStr = `${item.qty}x`.padEnd(5);
      const itemMaxLen = cols - 5;

      const nameLines = this.wrapText(item.name, itemMaxLen);

      parts.push(ESC_POS.BOLD_ON);
      parts.push(qtyStr);
      parts.push(ESC_POS.BOLD_OFF);
      parts.push(nameLines[0] + "\n");

      for (let i = 1; i < nameLines.length; i++) {
        parts.push(`     ${nameLines[i]}\n`);
      }

      const mods = this.extractModifiers(item);
      if (mods.length > 0) {
        parts.push(ESC_POS.BOLD_ON);
        for (const m of mods) {
          parts.push(`     > ${m}\n`);
        }
        parts.push(ESC_POS.BOLD_OFF);
      }
    }

    parts.push(divider);

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

    const totalQty = payload.items.reduce((acc, item) => acc + (item.qty || 1), 0);
    parts.push(ESC_POS.ALIGN_CENTER);
    parts.push(ESC_POS.BOLD_ON);
    parts.push(`TOTAL ITEMS: ${totalQty}\n`);
    parts.push(ESC_POS.BOLD_OFF);
    parts.push(doubleDivider);

    parts.push(ESC_POS.LINE_FEED);
    parts.push(ESC_POS.LINE_FEED);
    parts.push(ESC_POS.FEED_AND_CUT);

    return parts.join("");
  }

  // =========================================================================
  // AMENDMENT / MODIFIED KOT BUILDERS
  // =========================================================================

  /**
   * Builds both clean plain text and raw ESC/POS commands for an Amendment / Modified KOT.
   */
  public static buildAmendmentKot(payload: KotAmendmentBuilderPayload, widthmm: 58 | 80 = 58): KotBuildResult {
    return {
      text: this.buildAmendmentText(payload, widthmm),
      escpos: this.buildAmendmentEscPos(payload, widthmm),
    };
  }

  /**
   * Generates clean formatted text representation of an Amendment / Modified KOT.
   */
  public static buildAmendmentText(payload: KotAmendmentBuilderPayload, widthmm: 58 | 80 = 58): string {
    const cols = widthmm === 58 ? 32 : 48;
    const divider = "-".repeat(cols);
    const doubleDivider = "=".repeat(cols);

    const lines: string[] = [];

    // Header Section
    lines.push(doubleDivider);
    if (payload.restaurantName) {
      lines.push(this.center(payload.restaurantName.toUpperCase(), cols));
    }

    // Prominent Amendment Banner
    lines.push(this.center("** MODIFIED KOT **", cols));

    const source = payload.orderSource || "DINE_IN";
    const cleanLabel = this.formatTableLabel(payload.tableLabel, source, payload.externalOrderRef);

    lines.push(this.center(cleanLabel, cols));
    lines.push(this.center(source.replace(/_/g, " "), cols));
    lines.push(doubleDivider);

    const timeStr = payload.timestamp || new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
    const safeKotNum = payload.kotNumber && String(payload.kotNumber) !== "undefined" ? payload.kotNumber : 1;
    const safeOrderNum = payload.orderNumber && String(payload.orderNumber) !== "undefined" ? payload.orderNumber : 1;

    lines.push(this.justify(`KOT #: ${safeKotNum}`, `Order #: ${safeOrderNum}`, cols));
    lines.push(this.justify(`Time: ${timeStr}`, `Source: ${source}`, cols));

    if (payload.operatorName && payload.operatorName.trim()) {
      lines.push(`Operator: ${payload.operatorName.trim()}`);
    }
    if (payload.customerName && payload.customerName.trim()) {
      lines.push(`Customer: ${payload.customerName.trim()}`);
    }
    if (payload.customerPhone && payload.customerPhone.trim()) {
      lines.push(`Phone   : ${payload.customerPhone.trim()}`);
    }
    lines.push(divider);

    lines.push(this.justify("QTY  AMENDMENT / CHANGES", "", cols));
    lines.push(divider);

    const delta = payload.delta || {};
    const added = delta.added || [];
    const removed = delta.removed || [];
    const modified = delta.modified || [];

    let hasAnyChanges = false;

    // 1. Added items
    if (added.length > 0) {
      hasAnyChanges = true;
      lines.push("[+] ADDED ITEMS:");
      for (const item of added) {
        const qtyStr = `+${item.qty ?? 1}x`.padEnd(5);
        const nameLines = this.wrapText(item.name, cols - 7);
        lines.push(`  ${qtyStr}${nameLines[0]}`);
        for (let i = 1; i < nameLines.length; i++) {
          lines.push(`       ${nameLines[i]}`);
        }
        if (item.note && item.note.trim()) {
          lines.push(`       > Note: ${item.note.trim()}`);
        }
      }
      lines.push("");
    }

    // 2. Removed items
    if (removed.length > 0) {
      hasAnyChanges = true;
      lines.push("[-] REMOVED ITEMS:");
      for (const item of removed) {
        const qtyStr = `-${item.qty ?? 1}x`.padEnd(5);
        const nameLines = this.wrapText(item.name, cols - 7);
        lines.push(`  ${qtyStr}${nameLines[0]}`);
        for (let i = 1; i < nameLines.length; i++) {
          lines.push(`       ${nameLines[i]}`);
        }
        if (item.note && item.note.trim()) {
          lines.push(`       > Note: ${item.note.trim()}`);
        }
      }
      lines.push("");
    }

    // 3. Modified items (Quantity / Note changes)
    if (modified.length > 0) {
      hasAnyChanges = true;
      lines.push("[Δ] QUANTITY / NOTE CHANGES:");
      for (const item of modified) {
        lines.push(`  * ${item.name}`);
        if (item.old_qty !== undefined && item.new_qty !== undefined && item.old_qty !== item.new_qty) {
          const diff = item.new_qty - item.old_qty;
          const diffStr = diff > 0 ? `+${diff}` : `${diff}`;
          lines.push(`    Qty : ${item.old_qty} -> ${item.new_qty} (${diffStr})`);
        }
        if (item.new_note !== undefined && item.new_note !== item.old_note) {
          lines.push(`    Note: "${item.new_note || "(none)"}"`);
        }
      }
      lines.push("");
    }

    if (!hasAnyChanges) {
      lines.push(this.center("*** NO ITEM CHANGES RECORDED ***", cols));
    }

    // Remove trailing empty line if present
    if (lines[lines.length - 1] === "") {
      lines.pop();
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

    const totalModifiedCount = added.length + removed.length + modified.length;
    lines.push(this.center(`TOTAL CHANGES: ${totalModifiedCount} item(s)`, cols));
    lines.push(doubleDivider);

    return lines.join("\n");
  }

  /**
   * Generates ESC/POS thermal commands for an Amendment / Modified KOT.
   */
  public static buildAmendmentEscPos(payload: KotAmendmentBuilderPayload, widthmm: 58 | 80 = 58): string {
    const cols = widthmm === 58 ? 32 : 48;
    const divider = "-".repeat(cols) + "\n";
    const doubleDivider = "=".repeat(cols) + "\n";

    const parts: string[] = [];

    parts.push(ESC_POS.INIT);
    parts.push(ESC_POS.ALIGN_CENTER);
    parts.push(doubleDivider);

    if (payload.restaurantName) {
      parts.push(ESC_POS.BOLD_ON);
      parts.push(`${payload.restaurantName.toUpperCase()}\n`);
      parts.push(ESC_POS.BOLD_OFF);
    }

    // Double Height & Width Modified KOT Banner
    parts.push(ESC_POS.BOLD_ON);
    parts.push("\x1D\x21\x11"); // Double Width & Height
    parts.push("** MODIFIED KOT **\n");
    parts.push("\x1D\x21\x00");
    parts.push(ESC_POS.BOLD_OFF);

    const source = payload.orderSource || "DINE_IN";
    const cleanLabel = this.formatTableLabel(payload.tableLabel, source, payload.externalOrderRef);

    parts.push(ESC_POS.BOLD_ON);
    parts.push(`${cleanLabel}\n`);
    parts.push(`${source.replace(/_/g, " ")}\n`);
    parts.push(ESC_POS.BOLD_OFF);

    parts.push(doubleDivider);

    parts.push(ESC_POS.ALIGN_LEFT);
    const timeStr = payload.timestamp || new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
    const safeKotNum = payload.kotNumber && String(payload.kotNumber) !== "undefined" ? payload.kotNumber : 1;
    const safeOrderNum = payload.orderNumber && String(payload.orderNumber) !== "undefined" ? payload.orderNumber : 1;

    parts.push(this.justify(`KOT #: ${safeKotNum}`, `Order #: ${safeOrderNum}`, cols) + "\n");
    parts.push(this.justify(`Time: ${timeStr}`, `Source: ${source}`, cols) + "\n");

    if (payload.operatorName && payload.operatorName.trim()) {
      parts.push(`Operator: ${payload.operatorName.trim()}\n`);
    }
    if (payload.customerName && payload.customerName.trim()) {
      parts.push(`Customer: ${payload.customerName.trim()}\n`);
    }
    if (payload.customerPhone && payload.customerPhone.trim()) {
      parts.push(`Phone   : ${payload.customerPhone.trim()}\n`);
    }
    parts.push(divider);

    parts.push(ESC_POS.BOLD_ON);
    parts.push(this.justify("QTY  AMENDMENT / CHANGES", "", cols) + "\n");
    parts.push(ESC_POS.BOLD_OFF);
    parts.push(divider);

    const delta = payload.delta || {};
    const added = delta.added || [];
    const removed = delta.removed || [];
    const modified = delta.modified || [];

    let hasAnyChanges = false;

    // 1. Added
    if (added.length > 0) {
      hasAnyChanges = true;
      parts.push(ESC_POS.BOLD_ON);
      parts.push("[+] ADDED ITEMS:\n");
      parts.push(ESC_POS.BOLD_OFF);

      for (const item of added) {
        const qtyStr = `+${item.qty ?? 1}x`.padEnd(5);
        const nameLines = this.wrapText(item.name, cols - 7);

        parts.push(ESC_POS.BOLD_ON);
        parts.push(`  ${qtyStr}`);
        parts.push(ESC_POS.BOLD_OFF);
        parts.push(`${nameLines[0]}\n`);

        for (let i = 1; i < nameLines.length; i++) {
          parts.push(`       ${nameLines[i]}\n`);
        }
        if (item.note && item.note.trim()) {
          parts.push(`       > Note: ${item.note.trim()}\n`);
        }
      }
      parts.push("\n");
    }

    // 2. Removed
    if (removed.length > 0) {
      hasAnyChanges = true;
      parts.push(ESC_POS.BOLD_ON);
      parts.push("[-] REMOVED ITEMS:\n");
      parts.push(ESC_POS.BOLD_OFF);

      for (const item of removed) {
        const qtyStr = `-${item.qty ?? 1}x`.padEnd(5);
        const nameLines = this.wrapText(item.name, cols - 7);

        parts.push(ESC_POS.BOLD_ON);
        parts.push(`  ${qtyStr}`);
        parts.push(ESC_POS.BOLD_OFF);
        parts.push(`${nameLines[0]}\n`);

        for (let i = 1; i < nameLines.length; i++) {
          parts.push(`       ${nameLines[i]}\n`);
        }
        if (item.note && item.note.trim()) {
          parts.push(`       > Note: ${item.note.trim()}\n`);
        }
      }
      parts.push("\n");
    }

    // 3. Modified
    if (modified.length > 0) {
      hasAnyChanges = true;
      parts.push(ESC_POS.BOLD_ON);
      parts.push("[Δ] QUANTITY / NOTE CHANGES:\n");
      parts.push(ESC_POS.BOLD_OFF);

      for (const item of modified) {
        parts.push(ESC_POS.BOLD_ON);
        parts.push(`  * ${item.name}\n`);
        parts.push(ESC_POS.BOLD_OFF);

        if (item.old_qty !== undefined && item.new_qty !== undefined && item.old_qty !== item.new_qty) {
          const diff = item.new_qty - item.old_qty;
          const diffStr = diff > 0 ? `+${diff}` : `${diff}`;
          parts.push(`    Qty : ${item.old_qty} -> ${item.new_qty} (${diffStr})\n`);
        }
        if (item.new_note !== undefined && item.new_note !== item.old_note) {
          parts.push(`    Note: "${item.new_note || "(none)"}"\n`);
        }
      }
      parts.push("\n");
    }

    if (!hasAnyChanges) {
      parts.push(ESC_POS.ALIGN_CENTER);
      parts.push("*** NO ITEM CHANGES RECORDED ***\n");
      parts.push(ESC_POS.ALIGN_LEFT);
    }

    parts.push(divider);

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

    const totalModifiedCount = added.length + removed.length + modified.length;
    parts.push(ESC_POS.ALIGN_CENTER);
    parts.push(ESC_POS.BOLD_ON);
    parts.push(`TOTAL CHANGES: ${totalModifiedCount} item(s)\n`);
    parts.push(ESC_POS.BOLD_OFF);
    parts.push(doubleDivider);

    parts.push(ESC_POS.LINE_FEED);
    parts.push(ESC_POS.LINE_FEED);
    parts.push(ESC_POS.FEED_AND_CUT);

    return parts.join("");
  }

  // =========================================================================
  // CANCELLATION KOT BUILDERS
  // =========================================================================

  /**
   * Builds both clean plain text and raw ESC/POS commands for a Cancelled KOT.
   */
  public static buildCancelKot(payload: KotCancelBuilderPayload, widthmm: 58 | 80 = 58): KotBuildResult {
    return {
      text: this.buildCancelText(payload, widthmm),
      escpos: this.buildCancelEscPos(payload, widthmm),
    };
  }

  /**
   * Generates clean formatted text representation of a Cancelled KOT.
   */
  public static buildCancelText(payload: KotCancelBuilderPayload, widthmm: 58 | 80 = 58): string {
    const cols = widthmm === 58 ? 32 : 48;
    const divider = "-".repeat(cols);
    const doubleDivider = "=".repeat(cols);

    const lines: string[] = [];

    // Header Section
    lines.push(doubleDivider);
    if (payload.restaurantName) {
      lines.push(this.center(payload.restaurantName.toUpperCase(), cols));
    }

    // Prominent Cancel Banner
    lines.push(this.center("*** CANCELLED KOT ***", cols));

    const source = payload.orderSource || "DINE_IN";
    const cleanLabel = this.formatTableLabel(payload.tableLabel, source, payload.externalOrderRef);

    lines.push(this.center(cleanLabel, cols));
    lines.push(this.center(source.replace(/_/g, " "), cols));
    lines.push(doubleDivider);

    const timeStr = payload.timestamp || new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
    const safeKotNum = payload.kotNumber && String(payload.kotNumber) !== "undefined" ? payload.kotNumber : 1;
    const safeOrderNum = payload.orderNumber && String(payload.orderNumber) !== "undefined" ? payload.orderNumber : 1;

    lines.push(this.justify(`KOT #: ${safeKotNum}`, `Order #: ${safeOrderNum}`, cols));
    lines.push(this.justify(`Time: ${timeStr}`, `Source: ${source}`, cols));

    if (payload.operatorName && payload.operatorName.trim()) {
      lines.push(`Operator: ${payload.operatorName.trim()}`);
    }
    if (payload.customerName && payload.customerName.trim()) {
      lines.push(`Customer: ${payload.customerName.trim()}`);
    }
    if (payload.customerPhone && payload.customerPhone.trim()) {
      lines.push(`Phone   : ${payload.customerPhone.trim()}`);
    }
    lines.push(divider);

    // Cancellation Reason
    lines.push(`REASON: ${payload.reason || "Cancelled by operator"}`);
    lines.push(divider);

    // Cancelled Items Section
    lines.push("CANCELLED ITEMS:");
    if (payload.cancelledItems && payload.cancelledItems.length > 0) {
      for (const item of payload.cancelledItems) {
        const qtyStr = `${item.qty}x`.padEnd(5);
        const nameLines = this.wrapText(item.name, cols - 5);
        lines.push(`  ${qtyStr}${nameLines[0]}`);
        for (let i = 1; i < nameLines.length; i++) {
          lines.push(`       ${nameLines[i]}`);
        }
        if (item.notes && item.notes.trim()) {
          lines.push(`       > ${item.notes.trim()}`);
        }
      }
    } else {
      lines.push("  *** ALL ITEMS FOR THIS ORDER ***");
    }

    lines.push(divider);
    lines.push(this.center("*** DO NOT PREPARE / STOP ***", cols));
    lines.push(doubleDivider);

    return lines.join("\n");
  }

  /**
   * Generates ESC/POS thermal commands for a Cancelled KOT.
   */
  public static buildCancelEscPos(payload: KotCancelBuilderPayload, widthmm: 58 | 80 = 58): string {
    const cols = widthmm === 58 ? 32 : 48;
    const divider = "-".repeat(cols) + "\n";
    const doubleDivider = "=".repeat(cols) + "\n";

    const parts: string[] = [];

    parts.push(ESC_POS.INIT);
    parts.push(ESC_POS.ALIGN_CENTER);
    parts.push(doubleDivider);

    if (payload.restaurantName) {
      parts.push(ESC_POS.BOLD_ON);
      parts.push(`${payload.restaurantName.toUpperCase()}\n`);
      parts.push(ESC_POS.BOLD_OFF);
    }

    // Double Height & Width Cancel Banner
    parts.push(ESC_POS.BOLD_ON);
    parts.push("\x1D\x21\x11"); // Double Width & Height
    parts.push("*** CANCELLED KOT ***\n");
    parts.push("\x1D\x21\x00");
    parts.push(ESC_POS.BOLD_OFF);

    const source = payload.orderSource || "DINE_IN";
    const cleanLabel = this.formatTableLabel(payload.tableLabel, source, payload.externalOrderRef);

    parts.push(ESC_POS.BOLD_ON);
    parts.push(`${cleanLabel}\n`);
    parts.push(`${source.replace(/_/g, " ")}\n`);
    parts.push(ESC_POS.BOLD_OFF);

    parts.push(doubleDivider);

    parts.push(ESC_POS.ALIGN_LEFT);
    const timeStr = payload.timestamp || new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
    const safeKotNum = payload.kotNumber && String(payload.kotNumber) !== "undefined" ? payload.kotNumber : 1;
    const safeOrderNum = payload.orderNumber && String(payload.orderNumber) !== "undefined" ? payload.orderNumber : 1;

    parts.push(this.justify(`KOT #: ${safeKotNum}`, `Order #: ${safeOrderNum}`, cols) + "\n");
    parts.push(this.justify(`Time: ${timeStr}`, `Source: ${source}`, cols) + "\n");

    if (payload.operatorName && payload.operatorName.trim()) {
      parts.push(`Operator: ${payload.operatorName.trim()}\n`);
    }
    if (payload.customerName && payload.customerName.trim()) {
      parts.push(`Customer: ${payload.customerName.trim()}\n`);
    }
    if (payload.customerPhone && payload.customerPhone.trim()) {
      parts.push(`Phone   : ${payload.customerPhone.trim()}\n`);
    }
    parts.push(divider);

    // Reason
    parts.push(ESC_POS.BOLD_ON);
    parts.push(`REASON: ${payload.reason || "Cancelled by operator"}\n`);
    parts.push(ESC_POS.BOLD_OFF);
    parts.push(divider);

    // Items
    parts.push(ESC_POS.BOLD_ON);
    parts.push("CANCELLED ITEMS:\n");
    parts.push(ESC_POS.BOLD_OFF);

    if (payload.cancelledItems && payload.cancelledItems.length > 0) {
      for (const item of payload.cancelledItems) {
        const qtyStr = `${item.qty}x`.padEnd(5);
        const nameLines = this.wrapText(item.name, cols - 5);

        parts.push(ESC_POS.BOLD_ON);
        parts.push(`  ${qtyStr}`);
        parts.push(ESC_POS.BOLD_OFF);
        parts.push(`${nameLines[0]}\n`);

        for (let i = 1; i < nameLines.length; i++) {
          parts.push(`       ${nameLines[i]}\n`);
        }
        if (item.notes && item.notes.trim()) {
          parts.push(`       > ${item.notes.trim()}\n`);
        }
      }
    } else {
      parts.push("  *** ALL ITEMS FOR THIS ORDER ***\n");
    }

    parts.push(divider);

    // Critical Stop Banner
    parts.push(ESC_POS.ALIGN_CENTER);
    parts.push(ESC_POS.BOLD_ON);
    parts.push("\x1D\x21\x11");
    parts.push("*** DO NOT PREPARE / STOP ***\n");
    parts.push("\x1D\x21\x00");
    parts.push(ESC_POS.BOLD_OFF);
    parts.push(doubleDivider);

    parts.push(ESC_POS.LINE_FEED);
    parts.push(ESC_POS.LINE_FEED);
    parts.push(ESC_POS.FEED_AND_CUT);

    return parts.join("");
  }

  // =========================================================================
  // HELPER UTILITIES
  // =========================================================================

  private static formatTableLabel(rawLabel?: string, source?: string, refStr?: string | null): string {
    const label = rawLabel || "Express";
    if (source === "TAKEAWAY") return "TAKEAWAY";
    if (source === "SWIGGY") return `SWIGGY ${refStr ? `#${refStr}` : ""}`.trim();
    if (source === "ZOMATO") return `ZOMATO ${refStr ? `#${refStr}` : ""}`.trim();
    if (!label.toLowerCase().startsWith("table")) return `TABLE ${label.toUpperCase()}`;
    return label.toUpperCase();
  }

  private static extractModifiers(item: KotItemInput): string[] {
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
    return mods;
  }

  private static center(text: string, cols: number): string {
    if (text.length >= cols) return text.substring(0, cols);
    const pad = Math.floor((cols - text.length) / 2);
    return " ".repeat(pad) + text;
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
