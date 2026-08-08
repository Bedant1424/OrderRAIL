import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Download } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { supabase, type TableRow } from "@/lib/db";
import { useCafe } from "@/lib/cafe";
import { GlobalNotificationControls } from "@/components/owner/GlobalNotificationControls";

import { usePermissions } from "@/lib/permissions";
import { getTableStatus } from "@/lib/tables/occupancy";
import { cn } from "@/lib/utils";
import { sortTablesNatural } from "@/lib/tables/naturalTableSort";

import { CHEESE_CORNER_CONFIG } from "@/branding/cheesecorner/config";

const QR_SIZE = 144;
const QR_PADDING = 12;

// Layout Regions for Native-Res (1023x1537) Branded QR Artwork Compositing (Sprint 11J)
const TEMPLATE_LAYOUT = {
  templateUrl: CHEESE_CORNER_CONFIG.qrArtworkTemplate || "/branding/cheesecorner/qr/qr-stand.png",

  // Reserved Table Number Rounded White Rectangle (under "Table" heading)
  tableArea: {
    x: 511, // Horizontally centered (1023 / 2)
    y: 445, // Vertically centered inside the white rectangle under "Table"
    font: "900 48px 'Outfit', 'Inter', sans-serif",
    color: "#321300",
  },

  // QR Placement Region inside Cream Container Box
  qrArea: {
    cardX: (1023 - 420) / 2, // 301.5px
    cardY: 640,
    cardSize: 420,
    borderRadius: 28,
    qrX: (1023 - 360) / 2, // 331.5px
    qrY: 670,
    qrSize: 360,
  },
};

export const generateQRArtwork = async (
  tableLabel: string,
  cafeName: string,
  qrCanvas: HTMLCanvasElement
): Promise<string> => {
  return new Promise((resolve) => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    const templateImg = new Image();
    templateImg.crossOrigin = "anonymous";
    templateImg.onload = () => {
      // 1. Render Artwork at Native Dimensions (Issue 1)
      const nativeWidth = templateImg.naturalWidth || templateImg.width || 1023;
      const nativeHeight = templateImg.naturalHeight || templateImg.height || 1537;
      canvas.width = nativeWidth;
      canvas.height = nativeHeight;

      if (!ctx) {
        resolve("");
        return;
      }

      // Draw artwork template without stretching or compressing
      ctx.drawImage(templateImg, 0, 0, nativeWidth, nativeHeight);

      // 2. Render ONLY Numeric Table Number inside White Rounded Rectangle (Issue 4 & 5)
      const numericOnly = tableLabel.replace(/^[^\d]*/, "") || tableLabel;
      const fontSize = numericOnly.length > 2 ? 38 : 48;

      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = TEMPLATE_LAYOUT.tableArea.color;
      ctx.font = `900 ${fontSize}px 'Outfit', 'Inter', sans-serif`;
      ctx.fillText(
        numericOnly,
        TEMPLATE_LAYOUT.tableArea.x,
        TEMPLATE_LAYOUT.tableArea.y
      );

      // 3. Draw White Backing Card inside Cream QR Placeholder (Issue 2)
      const { cardX, cardY, cardSize, borderRadius: r, qrX, qrY, qrSize } = TEMPLATE_LAYOUT.qrArea;

      ctx.beginPath();
      ctx.moveTo(cardX + r, cardY);
      ctx.lineTo(cardX + cardSize - r, cardY);
      ctx.quadraticCurveTo(cardX + cardSize, cardY, cardX + cardSize, cardY + r);
      ctx.lineTo(cardX + cardSize, cardY + cardSize - r);
      ctx.quadraticCurveTo(cardX + cardSize, cardY + cardSize, cardX + cardSize - r, cardY + cardSize);
      ctx.lineTo(cardX + r, cardY + cardSize);
      ctx.quadraticCurveTo(cardX, cardY + cardSize, cardX, cardY + cardSize - r);
      ctx.lineTo(cardX, cardY + r);
      ctx.quadraticCurveTo(cardX, cardY, cardX + r, cardY);
      ctx.closePath();

      ctx.fillStyle = "#FFFFFF";
      ctx.shadowColor = "rgba(50, 19, 0, 0.12)";
      ctx.shadowBlur = 24;
      ctx.shadowOffsetY = 6;
      ctx.fill();

      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;

      // 4. Draw Dynamic QR Code (Issue 3 - Slightly reduced size with comfortable padding)
      ctx.drawImage(qrCanvas, qrX, qrY, qrSize, qrSize);

      // 5. Export High-Res PNG
      resolve(canvas.toDataURL("image/png"));
    };

    templateImg.onerror = () => {
      // Fallback drawing if template image fails to load
      ctx.fillStyle = "#FAF8F6";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.textAlign = "center";
      ctx.fillStyle = "#1A1210";
      ctx.font = "bold 32px sans-serif";
      ctx.fillText(cafeName, canvas.width / 2, 120);
      ctx.fillText(`TABLE ${tableLabel}`, canvas.width / 2, 220);
      ctx.drawImage(qrCanvas, (canvas.width - 300) / 2, 300, 300, 300);
      resolve(canvas.toDataURL("image/png"));
    };

    try {
      templateImg.src = TEMPLATE_LAYOUT.templateUrl;
    } catch (e) {
      console.error("Failed to load QR artwork template:", e);
      templateImg.onerror(e as any);
    }
  });
};

function TableQRCard({ 
  table, 
  cafeName, 
  onDownloadQR, 
  onDownloadCard, 
  onDelete,
  isDemo = false
}: { 
  table: TableRow; 
  cafeName: string; 
  onDownloadQR: () => void;
  onDownloadCard: () => void;
  onDelete: () => void;
  isDemo?: boolean;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const url = `${window.location.origin}/t/${table.id}`;
    import("qrcode").then((QRCodeModule) => {
      const QRCode = QRCodeModule.default || QRCodeModule;
      if (ref.current) {
        void QRCode.toCanvas(ref.current, url, { margin: 1, width: QR_SIZE, color: { dark: "#1a1210", light: "#ffffff" } });
      }
    });
  }, [table.id]);

  return (
    <div className="rounded-2xl bg-card text-center shadow-soft ring-1 ring-border/60 print:break-inside-avoid print:shadow-none print:ring-0 print:border">
      <div
        className="mx-auto flex items-center justify-center overflow-visible"
        style={{ padding: QR_PADDING }}
      >
        <canvas
          ref={ref}
          className="block rounded-lg"
          style={{ width: QR_SIZE, height: QR_SIZE }}
        />
      </div>

      <div className="px-3 pb-1 font-display text-lg font-semibold leading-tight">
        Table {table.label}
      </div>
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground px-3">
        Scan to order
      </div>

      {/* Simplified two-row action grid */}
      <div className="px-3 pb-3 pt-2 space-y-2 print:hidden">
        {/* Top row: QR & Card */}
        <div className="flex gap-2">
          <button
            onClick={isDemo ? undefined : onDownloadQR}
            disabled={isDemo}
            className={cn(
              "flex-1 inline-flex items-center justify-center gap-1 rounded-full shadow-sm transition",
              isDemo
                ? "bg-muted text-muted-foreground border border-border cursor-not-allowed opacity-60"
                : "bg-secondary text-secondary-foreground hover:bg-secondary/80 active:scale-95"
            )}
            style={{ height: 44 }}
            title={isDemo ? "This action is disabled in the public demo." : "Download raw QR code PNG"}
            aria-label={`Download QR for table ${table.label}`}
          >
            <Download className="h-4 w-4" />
            <span className="text-xs font-semibold">{isDemo ? "🔒 QR" : "QR"}</span>
          </button>
          <button
            onClick={isDemo ? undefined : onDownloadCard}
            disabled={isDemo}
            className={cn(
              "flex-1 inline-flex items-center justify-center gap-1 rounded-full shadow-sm transition",
              isDemo
                ? "bg-muted text-muted-foreground border border-border cursor-not-allowed opacity-60"
                : "bg-primary/10 text-primary hover:bg-primary/20 active:scale-95"
            )}
            style={{ height: 44 }}
            title={isDemo ? "This action is disabled in the public demo." : "Download printable stand artwork"}
            aria-label={`Download artwork for table ${table.label}`}
          >
            <Download className="h-4 w-4" />
            <span className="text-xs font-semibold">{isDemo ? "🔒 Card" : "Card"}</span>
          </button>
        </div>
        {/* Bottom row: Full-width Delete Table */}
        <button
          onClick={isDemo ? undefined : onDelete}
          disabled={isDemo}
          className={cn(
            "w-full inline-flex items-center justify-center gap-1.5 rounded-full shadow-sm transition",
            isDemo
              ? "bg-muted text-muted-foreground border border-border cursor-not-allowed opacity-60"
              : "bg-destructive/10 text-destructive hover:bg-destructive/20 active:scale-95"
          )}
          style={{ height: 44 }}
          title={isDemo ? "This action is disabled in the public demo." : "Delete Table"}
          aria-label={`Delete table ${table.label}`}
        >
          <Trash2 className="h-4 w-4" />
          <span className="text-xs font-semibold">{isDemo ? "🔒 Disabled" : "Delete Table"}</span>
        </button>
      </div>
    </div>
  );
}

export default function OwnerTablesPage() {
  const qc = useQueryClient();
  const permissions = usePermissions();
  const isDemo = permissions.isDemo;
  const [label, setLabel] = useState("");
  const [seats, setSeats] = useState(2);

  const { cafe, cafeId } = useCafe();

  const tablesQ = useQuery({
    queryKey: ["owner-tables", cafeId],
    enabled: !!cafeId,
    queryFn: async () => {
      const { data } = await supabase.from("tables").select("*").eq("cafe_id", cafeId!).order("label");
      return sortTablesNatural((data ?? []) as TableRow[]);
    },
  });

  const add = async () => {
    if (!label.trim() || !cafeId) return;
    const { error } = await supabase.from("tables").insert({ cafe_id: cafeId, label: label.trim(), seats });
    if (error) return toast.error(error.message);
    setLabel("");
    toast.success("Table added");
    void qc.invalidateQueries({ queryKey: ["owner-tables", cafeId] });
  };

  const remove = async (t: TableRow) => {
    const { data: activeOrds, error: checkError } = await supabase
      .from("orders")
      .select("id")
      .eq("table_id", t.id)
      .neq("status", "served")
      .neq("status", "cancelled")
      .limit(1);

    if (checkError) {
      toast.error(checkError.message);
      return;
    }

    if (activeOrds && activeOrds.length > 0) {
      toast.error(`Cannot delete table "${t.label}" because it has active orders in progress.`);
      return;
    }

    if (!confirm(`Remove table ${t.label}?`)) return;
    const { error } = await supabase.from("tables").delete().eq("id", t.id);
    if (error) return toast.error(error.message);
    void qc.invalidateQueries({ queryKey: ["owner-tables", cafeId] });
  };

  const downloadQRSingle = async (t: TableRow) => {
    const QRCodeModule = await import("qrcode");
    const QRCode = QRCodeModule.default || QRCodeModule;
    const canvas = document.createElement("canvas");
    const url = `${window.location.origin}/t/${t.id}`;
    await QRCode.toCanvas(canvas, url, { margin: 1, width: 400 });
    const link = document.createElement("a");
    link.download = `table-${t.label}-qr.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  const downloadArtworkSingle = async (t: TableRow) => {
    const QRCodeModule = await import("qrcode");
    const QRCode = QRCodeModule.default || QRCodeModule;
    const canvas = document.createElement("canvas");
    const url = `${window.location.origin}/t/${t.id}`;
    await QRCode.toCanvas(canvas, url, { margin: 1, width: 400 });
    toast.info(`Generating artwork for Table ${t.label}...`);
    const dataUrl = await generateQRArtwork(t.label, cafe?.name ?? "Cafe", canvas);
    const link = document.createElement("a");
    link.download = `table-${t.label}-artwork.png`;
    link.href = dataUrl;
    link.click();
    toast.success(`Artwork downloaded for Table ${t.label}`);
  };

  const downloadAllArtworks = async () => {
    const list = tablesQ.data ?? [];
    if (list.length === 0) return;
    
    toast.info("Generating ZIP archive of all artworks...");
    
    try {
      const QRCodeModule = await import("qrcode");
      const QRCode = QRCodeModule.default || QRCodeModule;
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      
      for (let i = 0; i < list.length; i++) {
        const t = list[i];
        const canvas = document.createElement("canvas");
        const url = `${window.location.origin}/t/${t.id}`;
        
        await QRCode.toCanvas(canvas, url, { margin: 1, width: 400 });
        const artworkDataUrl = await generateQRArtwork(t.label, cafe?.name ?? "Cafe", canvas);
        
        const base64Data = artworkDataUrl.split(",")[1];
        zip.file(`table-${t.label}-artwork.png`, base64Data, { base64: true });
      }
      
      const content = await zip.generateAsync({ type: "blob" });
      const link = document.createElement("a");
      const filename = `${cafe?.name?.toLowerCase().replace(/\s+/g, "-") ?? "cafe"}-table-artworks.zip`;
      link.download = filename;
      link.href = URL.createObjectURL(content);
      link.click();
      
      toast.success("Artworks ZIP downloaded successfully!");
    } catch (error) {
      console.error("ZIP Generation error:", error);
      toast.error("Failed to generate ZIP archive of artworks.");
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3 print:hidden">
        <div className="flex items-center justify-between w-full lg:w-auto">
          <div>
            <h1 className="font-display text-3xl font-semibold tracking-tight">Tables & QR</h1>
            <p className="mt-1 text-sm text-muted-foreground">Print a code for every table — customers scan to order.</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <GlobalNotificationControls />
          <button
            onClick={isDemo ? undefined : () => void downloadAllArtworks()}
            disabled={isDemo}
            className={cn(
              "inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition",
              isDemo
                ? "bg-muted text-muted-foreground border border-border cursor-not-allowed opacity-75"
                : "btn-primary-action"
            )}
            title={isDemo ? "This action is disabled in the public demo." : "Download all Artworks"}
          >
            <Download className="h-4 w-4" /> {isDemo ? "🔒 Artworks Blocked" : "Download all Artworks (ZIP)"}
          </button>
        </div>
      </header>

      <section className="rounded-2xl bg-card p-3 shadow-soft ring-1 ring-border/60 print:hidden">
        <h2 className="mb-2 font-display text-sm font-semibold">Add a table</h2>
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={label}
            disabled={isDemo}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={isDemo ? "Adding tables is disabled" : "Label (e.g. 12 or Patio-3)"}
            className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/60 disabled:opacity-60 disabled:bg-muted/35"
          />
          <input
            type="number"
            value={seats}
            disabled={isDemo}
            min={1}
            onChange={(e) => setSeats(Number(e.target.value))}
            className="w-20 rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/60 disabled:opacity-60 disabled:bg-muted/35"
          />
          <button
            onClick={isDemo ? undefined : () => void add()}
            disabled={isDemo || !label.trim()}
            className={cn(
              "rounded-full px-4 py-2 text-sm font-semibold whitespace-nowrap transition",
              isDemo 
                ? "bg-muted text-muted-foreground border border-border cursor-not-allowed opacity-75" 
                : "btn-primary-action"
            )}
            title={isDemo ? "This action is disabled in the public demo." : "Add table"}
          >
            <Plus className="mr-1 inline h-4 w-4" /> {isDemo ? "🔒 Disabled" : "Add"}
          </button>
        </div>
        {isDemo && (
          <p className="mt-3 text-[11px] text-amber-600 bg-amber-500/8 border border-amber-500/20 p-2.5 rounded-xl text-center font-medium">
            This action is disabled in the public demo.
          </p>
        )}
      </section>

      <section className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4 print:grid-cols-3 print:gap-6 print:w-full print:mx-auto">
        {tablesQ.isLoading ? (
          <p className="col-span-full py-8 text-center text-sm text-muted-foreground">Loading tables...</p>
        ) : (tablesQ.data ?? []).length === 0 ? (
          <p className="col-span-full py-8 text-center text-sm text-muted-foreground">No tables configured. Add a table above to start.</p>
        ) : (
          (tablesQ.data ?? []).map((t) => (
            <TableQRCard 
              key={t.id} 
              table={t} 
              cafeName={cafe?.name ?? "Cafe"} 
              onDownloadQR={() => void downloadQRSingle(t)}
              onDownloadCard={() => void downloadArtworkSingle(t)}
              onDelete={() => void remove(t)} 
              isDemo={isDemo}
            />
          ))
        )}
      </section>
    </div>
  );
}
