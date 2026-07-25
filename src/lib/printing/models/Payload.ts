/**
 * Strongly typed, device-agnostic structured print payloads.
 * Business logic generates these models without referencing ESC/POS or HTML.
 */

export interface CartItemPayload {
  id: string;
  name: string;
  price: number;
  qty: number;
  notes?: string;
}

export interface KotPrintPayloadData {
  type: 'KOT';
  orderId?: string;
  orderNumber: number;
  tableLabel: string;
  timestamp: string;
  items: CartItemPayload[];
  notes?: string;
}

export interface ReceiptTenderPayload {
  method: 'cash' | 'card' | 'upi';
  amount: number;
}

export interface ReceiptPrintPayloadData {
  type: 'RECEIPT';
  orderId?: string;
  billNumber?: string;
  sessionId?: string;
  tableLabel: string;
  cashierName: string;
  timestamp: string;
  items: CartItemPayload[];
  subtotal: number;
  tax: number;
  discountPct: number;
  discountAmt: number;
  netTotal: number;
  tenders: ReceiptTenderPayload[];
}

export interface TestPrintPayloadData {
  type: 'TEST';
  timestamp: string;
  message: string;
}

export type PrintPayloadData = KotPrintPayloadData | ReceiptPrintPayloadData | TestPrintPayloadData;
