import { updateOrderStatusInDb } from "@/lib/orders/repository";
import { generateCounterKot, type GeneratedCounterKot } from "./counterKotService";
import {
  type CounterPrinter,
  type PrintResult,
  defaultCounterPrinter,
} from "./printer/counterPrinter";
import type { CounterOrder } from "../types/counterTypes";

export interface AcceptOrderResult {
  success: boolean;
  orderId: string;
  orderNumber: number;
  newStatus?: 'preparing';
  kot?: GeneratedCounterKot;
  printResult?: PrintResult;
  error?: string;
}

export interface PrintKotResult {
  success: boolean;
  orderId: string;
  kot?: GeneratedCounterKot;
  printResult?: PrintResult;
  error?: string;
}

/**
 * Service managing native counter order state transitions and KOT dispatching
 */
export class CounterOrderActionService {
  /**
   * Accepts an incoming pending customer order, transitions status to 'preparing',
   * generates the ESC/POS Kitchen Order Ticket, and sends it to the printer abstraction.
   */
  public static async acceptOrder(
    order: CounterOrder,
    tableLabel: string,
    cafeName: string = "Cheese Corner",
    printer: CounterPrinter = defaultCounterPrinter
  ): Promise<AcceptOrderResult> {
    const orderId = order.id;
    const orderNumber = order.orderNumber;

    // 1. Guard against duplicate acceptance
    if (order.status !== "pending") {
      return {
        success: false,
        orderId,
        orderNumber,
        error: `Order #${orderNumber} is already in '${order.status}' status. Only pending orders can be accepted.`,
      };
    }

    // 2. Authoritative Database State Transition: pending -> preparing
    try {
      await updateOrderStatusInDb(orderId, "preparing", "counter");
    } catch (dbErr: any) {
      console.error("[CounterOrderActionService] Database update failed:", dbErr);
      return {
        success: false,
        orderId,
        orderNumber,
        error: dbErr?.message || "Failed to update order status in database. Order remains Pending.",
      };
    }

    // 3. Generate KOT Ticket Payload
    let kot: GeneratedCounterKot;
    try {
      kot = generateCounterKot(
        { ...order, status: "preparing" },
        tableLabel,
        cafeName
      );
    } catch (kotErr: any) {
      console.error("[CounterOrderActionService] KOT Generation failed:", kotErr);
      return {
        success: true,
        orderId,
        orderNumber,
        newStatus: "preparing",
        error: "Order accepted in database, but KOT generation encountered an error.",
      };
    }

    // 4. Send KOT payload to printer abstraction
    let printResult: PrintResult;
    try {
      printResult = await printer.printRaw(kot.rawBytes, {
        title: "Kitchen Order Ticket",
        orderNumber,
        tableLabel,
      });
    } catch (printErr: any) {
      console.error("[CounterOrderActionService] Printer abstraction call failed:", printErr);
      printResult = {
        status: "FAILED",
        message: printErr?.message || "Printer communication exception",
        timestamp: new Date(),
      };
    }

    return {
      success: true,
      orderId,
      orderNumber,
      newStatus: "preparing",
      kot,
      printResult,
    };
  }

  /**
   * Reprints / sends KOT for an existing order without changing its status
   */
  public static async reprintKot(
    order: CounterOrder,
    tableLabel: string,
    cafeName: string = "Cheese Corner",
    printer: CounterPrinter = defaultCounterPrinter
  ): Promise<PrintKotResult> {
    try {
      const kot = generateCounterKot(order, tableLabel, cafeName);
      const printResult = await printer.printRaw(kot.rawBytes, {
        title: "Kitchen Order Ticket",
        orderNumber: order.orderNumber,
        tableLabel,
      });

      return {
        success: printResult.status === "SUCCESS" || printResult.status === "ACCEPTED_FOR_TEST_PRINT",
        orderId: order.id,
        kot,
        printResult,
      };
    } catch (err: any) {
      return {
        success: false,
        orderId: order.id,
        error: err?.message || "Failed to generate or send KOT to printer",
      };
    }
  }
}
