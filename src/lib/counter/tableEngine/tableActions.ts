import { TableEntity, TableState, DiningSessionModel } from "./tableTypes";

export const INITIAL_DEFAULT_TABLES: TableEntity[] = [
  { id: "t-1", label: "Table 1", seats: 4, status: "AVAILABLE", updatedAt: new Date().toISOString() },
  {
    id: "t-2",
    label: "Table 2",
    seats: 2,
    status: "OCCUPIED",
    activeSessionId: "s-102",
    activeSession: {
      id: "s-102",
      tableId: "t-2",
      tableLabel: "Table 2",
      guestCount: 2,
      status: "ORDERING",
      startedAt: new Date(Date.now() - 14 * 60 * 1000).toISOString(),
      itemCount: 3,
      totalAmount: 28.5,
      sessionCode: "s-102",
    },
    updatedAt: new Date().toISOString(),
  },
  { id: "t-3", label: "Table 3", seats: 6, status: "AVAILABLE", updatedAt: new Date().toISOString() },
  {
    id: "t-4",
    label: "Table 4",
    seats: 4,
    status: "BILL_REQUESTED",
    activeSessionId: "s-9821",
    activeSession: {
      id: "s-9821",
      tableId: "t-4",
      tableLabel: "Table 4",
      guestCount: 4,
      status: "BILLING",
      startedAt: new Date(Date.now() - 34 * 60 * 1000).toISOString(),
      itemCount: 4,
      totalAmount: 37.5,
      sessionCode: "s-9821",
    },
    updatedAt: new Date().toISOString(),
  },
  { id: "t-5", label: "Table 5", seats: 2, status: "AVAILABLE", updatedAt: new Date().toISOString() },
  {
    id: "t-6",
    label: "Table 6",
    seats: 8,
    status: "OCCUPIED",
    activeSessionId: "s-106",
    activeSession: {
      id: "s-106",
      tableId: "t-6",
      tableLabel: "Table 6",
      guestCount: 6,
      status: "ORDERING",
      startedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      itemCount: 2,
      totalAmount: 16.0,
      sessionCode: "s-106",
    },
    updatedAt: new Date().toISOString(),
  },
  { id: "t-7", label: "Table 7", seats: 4, status: "AVAILABLE", updatedAt: new Date().toISOString() },
  { id: "t-8", label: "Table 8", seats: 4, status: "AVAILABLE", updatedAt: new Date().toISOString() },
  { id: "t-9", label: "Table 9", seats: 2, status: "CLEANING", updatedAt: new Date().toISOString() },
  { id: "t-10", label: "Table 10", seats: 6, status: "RESERVED", updatedAt: new Date().toISOString() },
  { id: "t-11", label: "Table 11", seats: 4, status: "OUT_OF_SERVICE", updatedAt: new Date().toISOString() },
  { id: "t-12", label: "Table 12", seats: 4, status: "AVAILABLE", updatedAt: new Date().toISOString() },
];

export function createDiningSession(
  tableId: string,
  tableLabel: string,
  guestCount: number = 2
): DiningSessionModel {
  const randomCode = Math.floor(1000 + Math.random() * 9000).toString();
  const sessionId = `s-${randomCode}`;

  return {
    id: sessionId,
    tableId,
    tableLabel,
    guestCount,
    status: "OPEN",
    startedAt: new Date().toISOString(),
    itemCount: 0,
    totalAmount: 0.0,
    sessionCode: sessionId,
  };
}
