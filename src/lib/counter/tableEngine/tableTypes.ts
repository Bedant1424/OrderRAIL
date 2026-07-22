export type TableState =
  | "AVAILABLE"
  | "OCCUPIED"
  | "BILL_REQUESTED"
  | "CLEANING"
  | "RESERVED"
  | "OUT_OF_SERVICE";

export type DiningSessionState =
  | "OPEN"
  | "ORDERING"
  | "BILLING"
  | "PAID"
  | "CLOSED";

export interface DiningSessionModel {
  id: string;
  tableId: string;
  tableLabel: string;
  guestCount: number;
  status: DiningSessionState;
  startedAt: string; // ISO string or time string
  itemCount: number;
  totalAmount: number;
  sessionCode: string;
}

export interface TableEntity {
  id: string;
  label: string;
  seats: number;
  status: TableState;
  activeSessionId?: string | null;
  activeSession?: DiningSessionModel | null;
  updatedAt: string;
}

export type TableFilterType =
  | "all"
  | "available"
  | "occupied"
  | "bill_requested"
  | "cleaning"
  | "reserved"
  | "out_of_service";

export interface TransitionResult {
  success: boolean;
  error?: string;
  table?: TableEntity;
  session?: DiningSessionModel | null;
}
