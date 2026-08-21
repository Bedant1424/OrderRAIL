/**
 * Production Kitchen Order Ticket (KOT) ESC/POS & Text Builder
 * Formats ESC/POS binary commands & clean text for 58mm (32 cols) and 80mm (48 cols) thermal printers.
 * Supports:
 * 1. Standard Kitchen Order Tickets (KOT) & Reprints (with canonical -R1, -R2 or OFFLINE REPRINT)
 * 2. Ultra-Compact Modified KOTs (ADD <qty>x, REMOVE <qty>x, MOD <item> lines only)
 * 3. Cancelled KOTs (Original KOT #, *** CANCELLED ***, STOP PREPARATION)
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
  reprintNumber?: number | string;
  isOfflineReprint?: boolean;
  orderSource?: "DINE_IN" | "TAKEAWAY" | "SWIGGY" | "ZOMATO" | string;
  externalOrderRef?: string | null;
}

export interface KotAmendmentBuilderPayload {
  restaurantName?: string;
  kotNumber: number | string;       // e.g. "101-M1" or 101
  orderNumber: number | string;     // e.g. 101
  revision?: number;               // e.g. 1 for M1, 2 for M2
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
  kotNumber: number | string;       // Retains original KOT number e.g. 105
  orderNumber: number | string;     // e.g. 105
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

    lines.push(doubleDivider);
    if (payload.restaurantName) {
      lines.push(this.center(payload.restaurantName.toUpperCase(), cols));
    }

    if (payload.isOfflineReprint || payload.reprintNumber === "OFFLINE") {
      lines.push(this.center("OFFLINE REPRINT", cols));
    } else if (payload.isReprint) {
      lines.push(this.center("** REPRINT **", cols));
    }

    const source = payload.orderSource || "DINE_IN";
    const cleanLabel = this.formatTableLabel(payload.tableLabel, source, payload.externalOrderRef);

    lines.push(this.center(cleanLabel, cols));
    lines.push(this.center(source.replace(/_/g, " "), cols));
    lines.push(doubleDivider);

    const timeStr = payload.timestamp || new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
    const safeOrderNum = payload.orderNumber && String(payload.orderNumber) !== "undefined" ? payload.orderNumber : 1;

    let kotDisplayNum: string | number = payload.kotNumber && String(payload.kotNumber) !== "undefined" ? payload.kotNumber : safeOrderNum;
    if (payload.reprintNumber && payload.reprintNumber !== "OFFLINE") {
      kotDisplayNum = `${safeOrderNum}-R${payload.reprintNumber}`;
    } else if (payload.isOfflineReprint || payload.reprintNumber === "OFFLINE") {
      kotDisplayNum = `${safeOrderNum}-R`;
    }

    lines.push(this.justify(`KOT #: ${kotDisplayNum}`, `Order #: ${safeOrderNum}`, cols));
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

    lines.push(this.justify("QTY  ITEM DESCRIPTION", "MODIFIERS", cols));
    lines.push(divider);

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

    if (payload.isOfflineReprint || payload.reprintNumber === "OFFLINE") {
      parts.push(ESC_POS.BOLD_ON);
      parts.push("OFFLINE REPRINT\n");
      parts.push(ESC_POS.BOLD_OFF);
    } else if (payload.isReprint) {
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
    const safeOrderNum = payload.orderNumber && String(payload.orderNumber) !== "undefined" ? payload.orderNumber : 1;

    let kotDisplayNum: string | number = payload.kotNumber && String(payload.kotNumber) !== "undefined" ? payload.kotNumber : safeOrderNum;
    if (payload.reprintNumber && payload.reprintNumber !== "OFFLINE") {
      kotDisplayNum = `${safeOrderNum}-R${payload.reprintNumber}`;
    } else if (payload.isOfflineReprint || payload.reprintNumber === "OFFLINE") {
      kotDisplayNum = `${safeOrderNum}-R`;
    }

    parts.push(this.justify(`KOT #: ${kotDisplayNum}`, `Order #: ${safeOrderNum}`, cols) + "\n");
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
  // REVISED COMPACT MODIFIED KOT BUILDERS
  // =========================================================================

  /**
   * Builds both clean plain text and raw ESC/POS commands for a Compact Amendment / Modified KOT.
   */
  public static buildAmendmentKot(payload: KotAmendmentBuilderPayload, widthmm: 58 | 80 = 58): KotBuildResult {
    return {
      text: this.buildAmendmentText(payload, widthmm),
      escpos: this.buildAmendmentEscPos(payload, widthmm),
    };
  }

  /**
   * Generates clean formatted text for a Compact Modified KOT.
   * Format:
   * KOT #101-M1
   * MODIFIED
   * Table 4
   * --------------------------------
   * REMOVE 1x Fries
   * ADD 1x Mojito
   * ADD 1x Ice Cream
   */
  public static buildAmendmentText(payload: KotAmendmentBuilderPayload, widthmm: 58 | 80 = 58): string {
    const cols = widthmm === 58 ? 32 : 48;
    const divider = "-".repeat(cols);
    const doubleDivider = "=".repeat(cols);

    const lines: string[] = [];

    lines.push(doubleDivider);
    if (payload.restaurantName) {
      lines.push(this.center(payload.restaurantName.toUpperCase(), cols));
    }

    const safeOrderNum = payload.orderNumber && String(payload.orderNumber) !== "undefined" ? payload.orderNumber : 1;
    let kotHeaderNum = payload.kotNumber;
    if (!kotHeaderNum || String(kotHeaderNum) === "undefined") {
      const rev = payload.revision !== undefined ? payload.revision : 1;
      kotHeaderNum = `${safeOrderNum}-M${rev}`;
    } else if (typeof kotHeaderNum === "number" || (!String(kotHeaderNum).includes("-M") && payload.revision)) {
      kotHeaderNum = `${kotHeaderNum}-M${payload.revision}`;
    }

    lines.push(this.center(`KOT #${kotHeaderNum}`, cols));
    lines.push(this.center("MODIFIED", cols));

    const source = payload.orderSource || "DINE_IN";
    const cleanLabel = this.formatTableLabel(payload.tableLabel, source, payload.externalOrderRef);
    lines.push(this.center(cleanLabel, cols));
    lines.push(doubleDivider);

    const timeStr = payload.timestamp || new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
    lines.push(this.justify(`Time: ${timeStr}`, `Source: ${source}`, cols));

    if (payload.operatorName && payload.operatorName.trim()) {
      lines.push(`Operator: ${payload.operatorName.trim()}`);
    }
    lines.push(divider);

    const delta = payload.delta || {};
    const added = delta.added || [];
    const removed = delta.removed || [];
    const modified = delta.modified || [];

    let hasActionableChanges = false;

    // 1. Removals
    for (const item of removed) {
      hasActionableChanges = true;
      const qty = item.qty ?? 1;
      lines.push(`REMOVE ${qty}x ${item.name}`);
      if (item.note && item.note.trim()) {
        lines.push(`       > Note: ${item.note.trim()}`);
      }
    }

    // 2. Quantity Decreases from Modified
    for (const item of modified) {
      if (item.old_qty !== undefined && item.new_qty !== undefined && item.new_qty < item.old_qty) {
        hasActionableChanges = true;
        const diff = item.old_qty - item.new_qty;
        lines.push(`REMOVE ${diff}x ${item.name}`);
      }
    }

    // 3. Additions
    for (const item of added) {
      hasActionableChanges = true;
      const qty = item.qty ?? 1;
      lines.push(`ADD ${qty}x ${item.name}`);
      if (item.note && item.note.trim()) {
        lines.push(`    > Note: ${item.note.trim()}`);
      }
    }

    // 4. Quantity Increases from Modified
    for (const item of modified) {
      if (item.old_qty !== undefined && item.new_qty !== undefined && item.new_qty > item.old_qty) {
        hasActionableChanges = true;
        const diff = item.new_qty - item.old_qty;
        lines.push(`ADD ${diff}x ${item.name}`);
      }
    }

    // 5. Note / Customization modifications
    for (const item of modified) {
      if (item.new_note !== undefined && item.new_note !== item.old_note) {
        hasActionableChanges = true;
        lines.push(`MOD ${item.name} (Note: "${item.new_note || "(none)"}")`);
      }
    }

    if (!hasActionableChanges) {
      lines.push(this.center("*** NO ACTIONABLE CHANGES ***", cols));
    }

    lines.push(divider);

    const instructions = payload.specialInstructions || payload.notes;
    if (instructions && instructions.trim()) {
      lines.push("SPECIAL INSTRUCTIONS:");
      const instLines = this.wrapText(instructions.trim(), cols);
      for (const il of instLines) {
        lines.push(il);
      }
      lines.push(divider);
    }

    lines.push(doubleDivider);

    return lines.join("\n");
  }

  /**
   * Generates ESC/POS thermal commands for a Compact Modified KOT.
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

    const safeOrderNum = payload.orderNumber && String(payload.orderNumber) !== "undefined" ? payload.orderNumber : 1;
    let kotHeaderNum = payload.kotNumber;
    if (!kotHeaderNum || String(kotHeaderNum) === "undefined") {
      const rev = payload.revision !== undefined ? payload.revision : 1;
      kotHeaderNum = `${safeOrderNum}-M${rev}`;
    } else if (typeof kotHeaderNum === "number" || (!String(kotHeaderNum).includes("-M") && payload.revision)) {
      kotHeaderNum = `${kotHeaderNum}-M${payload.revision}`;
    }

    // Double Height & Width Modified Header
    parts.push(ESC_POS.BOLD_ON);
    parts.push("\x1D\x21\x11");
    parts.push(`KOT #${kotHeaderNum}\n`);
    parts.push("MODIFIED\n");
    parts.push("\x1D\x21\x00");

    const source = payload.orderSource || "DINE_IN";
    const cleanLabel = this.formatTableLabel(payload.tableLabel, source, payload.externalOrderRef);
    parts.push(`${cleanLabel}\n`);
    parts.push(ESC_POS.BOLD_OFF);

    parts.push(doubleDivider);

    parts.push(ESC_POS.ALIGN_LEFT);
    const timeStr = payload.timestamp || new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
    parts.push(this.justify(`Time: ${timeStr}`, `Source: ${source}`, cols) + "\n");

    if (payload.operatorName && payload.operatorName.trim()) {
      parts.push(`Operator: ${payload.operatorName.trim()}\n`);
    }
    parts.push(divider);

    const delta = payload.delta || {};
    const added = delta.added || [];
    const removed = delta.removed || [];
    const modified = delta.modified || [];

    let hasActionableChanges = false;

    // 1. Removals
    for (const item of removed) {
      hasActionableChanges = true;
      const qty = item.qty ?? 1;
      parts.push(ESC_POS.BOLD_ON);
      parts.push(`REMOVE ${qty}x ${item.name}\n`);
      parts.push(ESC_POS.BOLD_OFF);
      if (item.note && item.note.trim()) {
        parts.push(`       > Note: ${item.note.trim()}\n`);
      }
    }

    // 2. Quantity Decreases
    for (const item of modified) {
      if (item.old_qty !== undefined && item.new_qty !== undefined && item.new_qty < item.old_qty) {
        hasActionableChanges = true;
        const diff = item.old_qty - item.new_qty;
        parts.push(ESC_POS.BOLD_ON);
        parts.push(`REMOVE ${diff}x ${item.name}\n`);
        parts.push(ESC_POS.BOLD_OFF);
      }
    }

    // 3. Additions
    for (const item of added) {
      hasActionableChanges = true;
      const qty = item.qty ?? 1;
      parts.push(ESC_POS.BOLD_ON);
      parts.push(`ADD ${qty}x ${item.name}\n`);
      parts.push(ESC_POS.BOLD_OFF);
      if (item.note && item.note.trim()) {
        parts.push(`    > Note: ${item.note.trim()}\n`);
      }
    }

    // 4. Quantity Increases
    for (const item of modified) {
      if (item.old_qty !== undefined && item.new_qty !== undefined && item.new_qty > item.old_qty) {
        hasActionableChanges = true;
        const diff = item.new_qty - item.old_qty;
        parts.push(ESC_POS.BOLD_ON);
        parts.push(`ADD ${diff}x ${item.name}\n`);
        parts.push(ESC_POS.BOLD_OFF);
      }
    }

    // 5. Note modifications
    for (const item of modified) {
      if (item.new_note !== undefined && item.new_note !== item.old_note) {
        hasActionableChanges = true;
        parts.push(ESC_POS.BOLD_ON);
        parts.push(`MOD ${item.name} (Note: "${item.new_note || "(none)"}")\n`);
        parts.push(ESC_POS.BOLD_OFF);
      }
    }

    if (!hasActionableChanges) {
      parts.push(ESC_POS.ALIGN_CENTER);
      parts.push("*** NO ACTIONABLE CHANGES ***\n");
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

    parts.push(doubleDivider);

    parts.push(ESC_POS.LINE_FEED);
    parts.push(ESC_POS.LINE_FEED);
    parts.push(ESC_POS.FEED_AND_CUT);

    return parts.join("");
  }

  // =========================================================================
  // REVISED COMPACT CANCELLATION KOT BUILDERS (Original KOT #)
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
   * Format:
   * KOT #105
   * *** CANCELLED ***
   * Table 4
   * --------------------------------
   * STOP PREPARATION
   * --------------------------------
   * 2x Burger
   * 1x Fries
   */
  public static buildCancelText(payload: KotCancelBuilderPayload, widthmm: 58 | 80 = 58): string {
    const cols = widthmm === 58 ? 32 : 48;
    const divider = "-".repeat(cols);
    const doubleDivider = "=".repeat(cols);

    const lines: string[] = [];

    lines.push(doubleDivider);
    if (payload.restaurantName) {
      lines.push(this.center(payload.restaurantName.toUpperCase(), cols));
    }

    const safeKotNum = payload.kotNumber && String(payload.kotNumber) !== "undefined" ? payload.kotNumber : payload.orderNumber || 1;

    // Prominent Original KOT number & CANCELLED banner
    lines.push(this.center(`KOT #${safeKotNum}`, cols));
    lines.push(this.center("*** CANCELLED ***", cols));

    const source = payload.orderSource || "DINE_IN";
    const cleanLabel = this.formatTableLabel(payload.tableLabel, source, payload.externalOrderRef);
    lines.push(this.center(cleanLabel, cols));
    lines.push(doubleDivider);

    // STOP PREPARATION banner
    lines.push(this.center("STOP PREPARATION", cols));
    lines.push(divider);

    if (payload.reason && payload.reason.trim()) {
      lines.push(`Reason: ${payload.reason.trim()}`);
      lines.push(divider);
    }

    if (payload.cancelledItems && payload.cancelledItems.length > 0) {
      for (const item of payload.cancelledItems) {
        const qtyStr = `${item.qty}x`.padEnd(5);
        const nameLines = this.wrapText(item.name, cols - 5);
        lines.push(`${qtyStr}${nameLines[0]}`);
        for (let i = 1; i < nameLines.length; i++) {
          lines.push(`     ${nameLines[i]}`);
        }
        if (item.notes && item.notes.trim()) {
          lines.push(`     > ${item.notes.trim()}`);
        }
      }
    } else {
      lines.push(this.center("*** ALL ITEMS FOR THIS ORDER ***", cols));
    }

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

    const safeKotNum = payload.kotNumber && String(payload.kotNumber) !== "undefined" ? payload.kotNumber : payload.orderNumber || 1;

    // Double Height & Width Cancel Banner with Original KOT #
    parts.push(ESC_POS.BOLD_ON);
    parts.push("\x1D\x21\x11"); // Double Width & Height
    parts.push(`KOT #${safeKotNum}\n`);
    parts.push("*** CANCELLED ***\n");
    parts.push("\x1D\x21\x00");

    const source = payload.orderSource || "DINE_IN";
    const cleanLabel = this.formatTableLabel(payload.tableLabel, source, payload.externalOrderRef);
    parts.push(`${cleanLabel}\n`);
    parts.push(ESC_POS.BOLD_OFF);

    parts.push(doubleDivider);

    // Stop Preparation Banner
    parts.push(ESC_POS.BOLD_ON);
    parts.push("\x1D\x21\x11");
    parts.push("STOP PREPARATION\n");
    parts.push("\x1D\x21\x00");
    parts.push(ESC_POS.BOLD_OFF);
    parts.push(divider);

    parts.push(ESC_POS.ALIGN_LEFT);

    if (payload.reason && payload.reason.trim()) {
      parts.push(`Reason: ${payload.reason.trim()}\n`);
      parts.push(divider);
    }

    if (payload.cancelledItems && payload.cancelledItems.length > 0) {
      for (const item of payload.cancelledItems) {
        const qtyStr = `${item.qty}x`.padEnd(5);
        const nameLines = this.wrapText(item.name, cols - 5);

        parts.push(ESC_POS.BOLD_ON);
        parts.push(qtyStr);
        parts.push(ESC_POS.BOLD_OFF);
        parts.push(`${nameLines[0]}\n`);

        for (let i = 1; i < nameLines.length; i++) {
          parts.push(`     ${nameLines[i]}\n`);
        }
        if (item.notes && item.notes.trim()) {
          parts.push(`     > ${item.notes.trim()}\n`);
        }
      }
    } else {
      parts.push(ESC_POS.ALIGN_CENTER);
      parts.push("*** ALL ITEMS FOR THIS ORDER ***\n");
      parts.push(ESC_POS.ALIGN_LEFT);
    }

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
