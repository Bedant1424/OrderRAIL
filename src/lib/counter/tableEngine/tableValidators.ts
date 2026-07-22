import { TableState } from "./tableTypes";

// Allowed transition map enforced strictly by CORE_STATE_MACHINES.md
const ALLOWED_TABLE_TRANSITIONS: Record<TableState, TableState[]> = {
  AVAILABLE: ["OCCUPIED", "RESERVED", "OUT_OF_SERVICE"],
  OCCUPIED: ["BILL_REQUESTED", "CLEANING", "AVAILABLE"],
  BILL_REQUESTED: ["OCCUPIED", "CLEANING", "AVAILABLE"],
  CLEANING: ["AVAILABLE"],
  RESERVED: ["OCCUPIED", "AVAILABLE"],
  OUT_OF_SERVICE: ["AVAILABLE"],
};

export interface ValidationResult {
  valid: boolean;
  reason?: string;
}

/**
 * Validates table state transitions according to CORE_STATE_MACHINES.md
 */
export function validateTableTransition(
  currentStatus: TableState,
  targetStatus: TableState
): ValidationResult {
  if (currentStatus === targetStatus) {
    return {
      valid: true,
    };
  }

  const allowedTargets = ALLOWED_TABLE_TRANSITIONS[currentStatus];

  if (!allowedTargets || !allowedTargets.includes(targetStatus)) {
    return {
      valid: false,
      reason: `Invalid transition from ${currentStatus} to ${targetStatus}. Not permitted by Table State Machine.`,
    };
  }

  return {
    valid: true,
  };
}

/**
 * Checks if a table can open a new dining session.
 * Only AVAILABLE or RESERVED tables can be opened.
 */
export function canOpenTable(tableStatus: TableState): ValidationResult {
  if (tableStatus === "OUT_OF_SERVICE") {
    return {
      valid: false,
      reason: "Cannot open a table that is OUT_OF_SERVICE.",
    };
  }

  if (tableStatus === "CLEANING") {
    return {
      valid: false,
      reason: "Table is currently being cleaned. Mark AVAILABLE first.",
    };
  }

  if (tableStatus === "OCCUPIED" || tableStatus === "BILL_REQUESTED") {
    return {
      valid: false,
      reason: "Table already has an active dining session.",
    };
  }

  return { valid: true };
}
