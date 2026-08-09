import { CHEESE_CORNER_CONFIG } from "./config";

/**
 * Centralized Layout Configuration for Cheese Corner Dynamic QR Artwork
 * Template: Native Resolution (948x1660) blank artwork source
 * Recalibrated for Sprint 12C to eliminate gaps & completely cover placeholder text
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
    font: "900 54px 'Outfit', 'Fredoka', 'Quicksand', 'Nunito', 'Comfortaa', sans-serif",
    fontFamily: "'Outfit', 'Fredoka', 'Quicksand', 'Nunito', 'Comfortaa', sans-serif",
    baseFontSize: 54,
  },

  // QR Placement Region inside Cream Container Box (Sprint 12C Recalibrated)
  qr: {
    centerX: 474, // Centered horizontally inside template container
    centerY: 648, // Centered vertically to fully cover "QR PLACEHOLDER" graphic (y: 428..868)
    cardSize: 440, // Expanded white card completely covering "QR PLACEHOLDER" text & dashed box
    qrSize: 350, // Scaled QR code maintaining even 45px white padding on all 4 sides
    borderRadius: 24, // Rounded corners matching artwork style
    cardShadowColor: "rgba(50, 19, 0, 0.12)",
    cardShadowBlur: 24,
    cardShadowOffsetY: 6,
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
 * Execution Order:
 * 1. Load blank template (`public/branding/cheesecorner/qr/qr-stand.png`)
 * 2. Draw template at native resolution (948x1660)
 * 3. Draw numeric table number (centered inside existing rounded rectangle)
 * 4. Draw QR code (from table UUID, centered inside white card covering placeholder text)
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

  return new Promise((resolve) => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      resolve("");
      return;
    }

    const templateImg = new Image();
    templateImg.crossOrigin = "anonymous";

    templateImg.onload = () => {
      // 1. Native Dimensions (948x1660)
      const nativeWidth = templateImg.naturalWidth || templateImg.width || ARTWORK_LAYOUT.template.width;
      const nativeHeight = templateImg.naturalHeight || templateImg.height || ARTWORK_LAYOUT.template.height;

      canvas.width = nativeWidth;
      canvas.height = nativeHeight;

      // 2. Draw Blank Artwork Template
      ctx.drawImage(templateImg, 0, 0, nativeWidth, nativeHeight);

      // 3. Render Numeric Table Number (Task 2: Extract numeric portion)
      const numericOnly = extractTableNumber(tableLabel);

      // Auto scale font size for larger numbers
      let fontSize = ARTWORK_LAYOUT.tableNumber.baseFontSize;
      if (numericOnly.length === 3) {
        fontSize = 42;
      } else if (numericOnly.length >= 4) {
        fontSize = 34;
      }

      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = ARTWORK_LAYOUT.tableNumber.color;
      ctx.font = `900 ${fontSize}px ${ARTWORK_LAYOUT.tableNumber.fontFamily}`;
      ctx.fillText(
        numericOnly,
        ARTWORK_LAYOUT.tableNumber.centerX,
        ARTWORK_LAYOUT.tableNumber.centerY
      );

      // 4. Render White QR Backing Card & QR Code (Task 4: Centered, even borders/padding)
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
      resolve(canvas.toDataURL("image/png"));
    };

    templateImg.onerror = (err) => {
      console.error("Failed to load QR artwork template:", err);
      // Fallback rendering if template image fails to load
      canvas.width = ARTWORK_LAYOUT.template.width;
      canvas.height = ARTWORK_LAYOUT.template.height;
      ctx.fillStyle = "#FAF8F6";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.textAlign = "center";
      ctx.fillStyle = "#1A1210";
      ctx.font = "bold 36px sans-serif";
      ctx.fillText(`TABLE ${tableLabel}`, canvas.width / 2, 240);
      ctx.drawImage(qrCanvas, (canvas.width - 320) / 2, 520, 320, 320);
      resolve(canvas.toDataURL("image/png"));
    };

    try {
      templateImg.src = templateUrl;
    } catch (e) {
      console.error("Failed to assign template image src:", e);
      templateImg.onerror(e as any);
    }
  });
}

// Backwards compatibility alias for existing function calls
export const generateQRArtwork = (
  tableLabel: string,
  _cafeName: string,
  qrCanvas: HTMLCanvasElement
) => generateArtwork(tableLabel, qrCanvas);
