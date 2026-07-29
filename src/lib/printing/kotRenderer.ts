/**
 * Sprint 9.2.3.2 — KOT Renderer
 * Formats Kitchen Order Tickets for 58mm and 80mm thermal receipt printers.
 */

import { KotBuilder, type KotItemInput, type KotBuilderPayload } from "./kotBuilder";

export type KotRenderItem = KotItemInput;
export type KotRenderPayload = KotBuilderPayload & { orderId?: string };

export { KotBuilder };

export function renderKotText(payload: KotRenderPayload, widthmm: 58 | 80 = 58): string {
  return KotBuilder.buildText(payload, widthmm);
}
