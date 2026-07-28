/**
 * Constants and ESC/POS Command definitions for OrderRail Printing Infrastructure.
 */

export const PRINTING_CONSTANTS = {
  LOG_PREFIX: "[Printing]",
  RECONNECT_ATTEMPTS: 3,
  RECONNECT_DELAY_MS: 2000,
  POS_58_CHAR_WIDTH: 32,
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
  FEED_AND_CUT: "\x1D\x56\x41\x03", // Feed 3 lines & Cut paper (partial)
  LINE_FEED: "\x0A",
};
