import { CHEESE_CORNER_CONFIG } from "./config";

/**
 * Centralized Layout Configuration for Cheese Corner Dynamic QR Artwork
 * Template: Native Resolution (948x1660) blank artwork source
 * Recalibrated for Sprint 12G with exact template fit & trace logging
 */
export const ARTWORK_LAYOUT = {
  template: {
    width: 948,
    height: 1660,
    url: CHEESE_CORNER_CONFIG.qrArtworkTemplate || "/branding/cheesecorner/qr/qr-stand.png",
  },

  // Table Number Rounded Pill Region (under "Table" heading)
  tableNumber: {
    centerX: 499, // Centered horizontally inside template white pill (433..565)
    centerY: 241, // Centered vertically inside template white pill (211..271)
    color: "#321300",
    font: "bold 48px 'Outfit', 'Fredoka', 'Quicksand', 'Nunito', 'Comfortaa', sans-serif",
    fontFamily: "'Outfit', 'Fredoka', 'Quicksand', 'Nunito', 'Comfortaa', sans-serif",
    baseFontSize: 48,
  },

  // QR Placement Region inside Cream Container Box (Sprint 12G Overlay)
  qr: {
    centerX: 474, // Centered horizontally on template artwork
    centerY: 675, // Centered vertically to fill the QR placeholder area (y: 495..855)
    cardSize: 360, // White card completely covering & filling the intended QR placeholder box
    qrSize: 300, // QR code size preserving even 30px white padding on all 4 sides
    borderRadius: 24, // Rounded corners matching artwork style
    cardShadowColor: "rgba(50, 19, 0, 0.10)",
    cardShadowBlur: 20,
    cardShadowOffsetY: 5,
  },
};

/**
 * Extracts only the numeric portion of a table label.
 * Examples:
 * - "Table 1" -> "1"
 * - "Table 5" -> "5"
 * - "Table 10" -> "10"
 * - "T-25" -> "25"
 */
export function extractTableNumber(label: string): string {
  const digits = label.replace(/\D+/g, "");
  return digits || label;
}

/**
 * Generates a dynamic high-resolution QR artwork PNG for a table.
 *
 * Execution Order (Sprint 12G):
 * 1. Load blank template (`public/branding/cheesecorner/qr/qr-stand.png`)
 * 2. Draw template at native resolution (948x1660)
 * 3. Overlay numeric table number (centered inside white rounded pill at cx: 499, cy: 241)
 * 4. Overlay QR code (from table UUID, centered inside white card at cx: 474, cy: 675)
 * 5. Export high-res PNG
 *
 * Never modifies the template source file itself.
 */
export async function generateArtwork(
  tableLabel: string,
  qrCanvas: HTMLCanvasElement,
  templateUrl: string = ARTWORK_LAYOUT.template.url
): Promise<string> {
  if (typeof document !== "undefined" && document.fonts) {
    try {
      await document.fonts.ready;
    } catch {
      // Ignore font readiness errors
    }
  }

  // 1. Asynchronously load the template image
  const templateImg = await new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = (err) => {
      console.error("Failed to load QR artwork template image:", err);
      resolve(null);
    };
    img.src = templateUrl;
  });

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    return "";
  }

  const nativeWidth = templateImg?.naturalWidth || templateImg?.width || ARTWORK_LAYOUT.template.width;
  const nativeHeight = templateImg?.naturalHeight || templateImg?.height || ARTWORK_LAYOUT.template.height;

  canvas.width = nativeWidth;
  canvas.height = nativeHeight;

  // 2. Draw Blank Artwork Template
  if (templateImg) {
    ctx.drawImage(templateImg, 0, 0, nativeWidth, nativeHeight);
  } else {
    ctx.fillStyle = "#FAF8F6";
    ctx.fillRect(0, 0, nativeWidth, nativeHeight);
  }

  // 3. Render Numeric Table Number (Sprint 12G Requirement)
  const numericOnly = extractTableNumber(tableLabel);

  console.log("[QR Artwork] table label:", tableLabel);
  console.log("[QR Artwork] extracted number:", numericOnly);
  console.log("[QR Artwork] drawing table number:", numericOnly);

  // Auto scale font size for larger numbers
  let fontSize = ARTWORK_LAYOUT.tableNumber.baseFontSize;
  if (numericOnly.length === 3) {
    fontSize = 38;
  } else if (numericOnly.length >= 4) {
    fontSize = 30;
  }

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = ARTWORK_LAYOUT.tableNumber.color;
  ctx.font = `bold ${fontSize}px ${ARTWORK_LAYOUT.tableNumber.fontFamily}`;
  ctx.fillText(
    numericOnly,
    ARTWORK_LAYOUT.tableNumber.centerX,
    ARTWORK_LAYOUT.tableNumber.centerY
  );

  // 4. Render White QR Backing Card & QR Code
  const {
    centerX,
    centerY,
    cardSize,
    borderRadius,
    qrSize,
    cardShadowColor,
    cardShadowBlur,
    cardShadowOffsetY,
  } = ARTWORK_LAYOUT.qr;

  const cardX = centerX - cardSize / 2;
  const cardY = centerY - cardSize / 2;

  // Draw rounded white card
  ctx.beginPath();
  ctx.moveTo(cardX + borderRadius, cardY);
  ctx.lineTo(cardX + cardSize - borderRadius, cardY);
  ctx.quadraticCurveTo(cardX + cardSize, cardY, cardX + cardSize, cardY + borderRadius);
  ctx.lineTo(cardX + cardSize, cardY + cardSize - borderRadius);
  ctx.quadraticCurveTo(cardX + cardSize, cardY + cardSize, cardX + cardSize - borderRadius, cardY + cardSize);
  ctx.lineTo(cardX + borderRadius, cardY + cardSize);
  ctx.quadraticCurveTo(cardX, cardY + cardSize, cardX, cardY + cardSize - borderRadius);
  ctx.lineTo(cardX, cardY + borderRadius);
  ctx.quadraticCurveTo(cardX, cardY, cardX + borderRadius, cardY);
  ctx.closePath();

  ctx.fillStyle = "#FFFFFF";
  ctx.shadowColor = cardShadowColor;
  ctx.shadowBlur = cardShadowBlur;
  ctx.shadowOffsetY = cardShadowOffsetY;
  ctx.fill();

  // Reset shadow for QR image
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  // Draw QR image centered inside card
  const qrX = centerX - qrSize / 2;
  const qrY = centerY - qrSize / 2;
  ctx.drawImage(qrCanvas, qrX, qrY, qrSize, qrSize);

  // 5. Export High-Res PNG
  return canvas.toDataURL("image/png");
}

// Backwards compatibility alias for existing function calls
export const generateQRArtwork = (
  tableLabel: string,
  _cafeName: string,
  qrCanvas: HTMLCanvasElement
) => generateArtwork(tableLabel, qrCanvas);
