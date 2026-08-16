/**
 * Constants and ESC/POS Command definitions for OrderRail Printing Infrastructure.
 */

export const PRINTING_CONSTANTS = {
  LOG_PREFIX: "[Printing]",
  RECONNECT_ATTEMPTS: 3,
  RECONNECT_DELAY_MS: 2000,
  POS_58_CHAR_WIDTH: 32,
  LAST_USED_PRINTER_KEY: "orderrail_last_used_printer",
};

/**
 * Basic ESC/POS formatting commands compatible with POS-58 Series thermal printers.
 */
export const ESC_POS = {
  INIT: "\x1B\x40",            // Reset/Initialize printer
  ALIGN_LEFT: "\x1B\x61\x00",   // Align Left
  ALIGN_CENTER: "\x1B\x61\x01", // Align Center
  ALIGN_RIGHT: "\x1B\x61\x02",  // Align Right
  BOLD_ON: "\x1B\x45\x01",      // Bold text mode ON
  BOLD_OFF: "\x1B\x45\x00",     // Bold text mode OFF
  SET_LINE_SPACING_24: "\x1B\x33\x18", // Compact line spacing (24 dots)
  RESET_LINE_SPACING: "\x1B\x32",      // Default line spacing (1/6 inch)
  FEED_AND_CUT: "\x1D\x56\x41\x03",    // Feed 3 lines & Cut paper (partial)
  LINE_FEED: "\x0A",
};
