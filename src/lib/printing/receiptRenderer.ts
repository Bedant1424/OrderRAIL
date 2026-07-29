/**
 * Sprint 9.2.3.3 — Receipt Renderer
 * Formats Customer Bill Receipts for 58mm and 80mm thermal receipt printers.
 */

import { ReceiptBuilder, type ReceiptItemInput, type ReceiptBuilderPayload } from "./receiptBuilder";

export type ReceiptItem = ReceiptItemInput;
export type ReceiptRenderPayload = ReceiptBuilderPayload;

export { ReceiptBuilder };

export function renderReceiptText(payload: ReceiptRenderPayload, widthmm: 58 | 80 = 58): string {
  return ReceiptBuilder.buildText(payload, widthmm);
}
