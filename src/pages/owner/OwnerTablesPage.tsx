import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import QRCode from "qrcode";
import { Plus, Printer, Trash2, Download } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { supabase, type Cafe, type TableRow } from "@/lib/db";
import { useCafe } from "@/lib/cafe";
import { GlobalNotificationControls } from "@/components/owner/GlobalNotificationControls";

/* ── QR size: reduced ~28% from 200→144. Canvas stays square. ── */
const QR_SIZE = 144;
const QR_PADDING = 12; // consistent whitespace around the QR

/*
  IMPLEMENTATION NOTES FOR FUTURE STAND TEMPLATES:
  To support additional templates (e.g., A6 Acrylic Stand, Round Coaster, Foldable Tent Card):
  1. Add a template parameter to this function: template: 'minimal' | 'tent' | 'sticker'.
  2. For 'tent': Increase canvas height (e.g., to 1800px), draw folding lines, copy artwork to top section rotated 180 degrees (upside down) for double-sided folding prints.
  3. For 'sticker': Use a circular clipping path: ctx.arc(width/2, height/2, radius, 0, Math.PI*2) and draw layout centered within circle boundaries.
  4. Allow owners to dynamically select brand primary/secondary colors and font styles from CafeContext, replacing hardcoded color hex values like "#E65F2B".
*/
export const generateQRArtwork = async (
  tableLabel: string,
  cafeName: string,
  qrCanvas: HTMLCanvasElement
): Promise<string> => {
  return new Promise((resolve) => {
    const canvas = document.createElement("canvas");
    canvas.width = 600;
    canvas.height = 900;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      resolve("");
      return;
    }

    // 1. Draw Background
    ctx.fillStyle = "#FAF8F6"; // Warm cream paper background
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Subtle border
    ctx.strokeStyle = "#E3DDD5";
    ctx.lineWidth = 16;
    ctx.strokeRect(8, 8, canvas.width - 16, canvas.height - 16);

    // 2. Draw Cafe Name / Branding
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Small tagline
    ctx.fillStyle = "#8C8375";
    ctx.font = "bold 13px sans-serif";
    ctx.fillText("WELCOME TO", canvas.width / 2, 80);

    // Cafe Name
    ctx.fillStyle = "#1A1210";
    ctx.font = "bold 32px Georgia, serif";
    const displayCafe = cafeName.length > 25 ? cafeName.substring(0, 22) + "..." : cafeName;
    ctx.fillText(displayCafe, canvas.width / 2, 125);

    // Decorative line
    ctx.strokeStyle = "#8C8375";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(canvas.width / 2 - 60, 165);
    ctx.lineTo(canvas.width / 2 + 60, 165);
    ctx.stroke();

    // 3. Draw Table Number
    ctx.fillStyle = "#E65F2B"; // Brand Orange
    ctx.font = "bold 56px sans-serif";
    ctx.fillText(`TABLE ${tableLabel.toUpperCase()}`, canvas.width / 2, 230);

    // 4. Draw QR Code card
    ctx.fillStyle = "#FFFFFF";
    const qrCardSize = 340;
    const qrCardX = (canvas.width - qrCardSize) / 2;
    const qrCardY = 300;
    
    const r = 24;
    ctx.beginPath();
    ctx.moveTo(qrCardX + r, qrCardY);
    ctx.lineTo(qrCardX + qrCardSize - r, qrCardY);
    ctx.quadraticCurveTo(qrCardX + qrCardSize, qrCardY, qrCardX + qrCardSize, qrCardY + r);
    ctx.lineTo(qrCardX + qrCardSize, qrCardY + qrCardSize - r);
    ctx.quadraticCurveTo(qrCardX + qrCardSize, qrCardY + qrCardSize, qrCardX + qrCardSize - r, qrCardY + qrCardSize);
    ctx.lineTo(qrCardX + r, qrCardY + qrCardSize);
    ctx.quadraticCurveTo(qrCardX, qrCardY + qrCardSize, qrCardX, qrCardY + qrCardSize - r);
    ctx.lineTo(qrCardX, qrCardY + r);
    ctx.quadraticCurveTo(qrCardX, qrCardY, qrCardX + r, qrCardY);
    ctx.closePath();
    
    ctx.shadowColor = "rgba(26, 18, 16, 0.08)";
    ctx.shadowBlur = 30;
    ctx.shadowOffsetY = 10;
    ctx.fill();
    
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    // Draw QR canvas image
    const qrInnerSize = 280;
    const qrInnerX = (canvas.width - qrInnerSize) / 2;
    const qrInnerY = qrCardY + (qrCardSize - qrInnerSize) / 2;
    ctx.drawImage(qrCanvas, qrInnerX, qrInnerY, qrInnerSize, qrInnerSize);

    // 5. Draw Helper instructions
    ctx.fillStyle = "#1A1210";
    ctx.font = "bold 20px sans-serif";
    ctx.fillText("Scan QR to Order & Pay", canvas.width / 2, 700);

    ctx.fillStyle = "#8C8375";
    ctx.font = "14px sans-serif";
    ctx.fillText("No app download required · Pay at table", canvas.width / 2, 740);

    // 6. Draw Footer branding
    ctx.fillStyle = "#C2BCB2";
    ctx.font = "11px sans-serif";
    ctx.fillText("POWERED BY ORDERRAIL", canvas.width / 2, 830);

    resolve(canvas.toDataURL("image/png"));
  });
};

function TableQRCard({ table, cafeName, onDelete }: { table: TableRow; cafeName: string; onDelete: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const url = `${window.location.origin}/t/${table.id}`;
    void QRCode.toCanvas(ref.current, url, { margin: 1, width: QR_SIZE, color: { dark: "#1a1210", light: "#ffffff" } });
  }, [table.id]);

  const downloadSingle = () => {
    if (!ref.current) return;
    const link = document.createElement("a");
    link.download = `table-${table.label}-qr.png`;
    link.href = ref.current.toDataURL("image/png");
    link.click();
  };

  const downloadArtworkSingle = async () => {
    if (!ref.current) return;
    toast.info(`Generating artwork for Table ${table.label}...`);
    const dataUrl = await generateQRArtwork(table.label, cafeName, ref.current);
    const link = document.createElement("a");
    link.download = `table-${table.label}-artwork.png`;
    link.href = dataUrl;
    link.click();
    toast.success(`Artwork downloaded for Table ${table.label}`);
  };

  return (
    <div className="rounded-2xl bg-card text-center shadow-soft ring-1 ring-border/60 print:break-inside-avoid print:shadow-none print:ring-0 print:border">
      {/* QR container — enforces square + padding, prevents clipping */}
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

      {/* Label + tagline */}
      <div className="px-3 pb-1 font-display text-lg font-semibold leading-tight">
        Table {table.label}
      </div>
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground px-3 print:mb-0">
        Scan to order
      </div>

      {/* Actions row — icon-only buttons, space-between */}
      <div className="flex items-center justify-between px-3 py-2.5 print:hidden">
        <button
          onClick={downloadSingle}
          className="inline-flex items-center justify-center rounded-full bg-secondary text-secondary-foreground shadow-sm transition hover:bg-secondary/80 active:scale-95"
          style={{ width: 44, height: 44, minWidth: 44, minHeight: 44 }}
          title="Download raw QR code PNG"
          aria-label={`Download QR for table ${table.label}`}
        >
          <Download className="h-[18px] w-[18px]" />
        </button>
        <button
          onClick={downloadArtworkSingle}
          className="inline-flex items-center justify-center rounded-full bg-primary/10 text-primary shadow-sm transition hover:bg-primary/20 active:scale-95"
          style={{ width: 44, height: 44, minWidth: 44, minHeight: 44 }}
          title="Download printable stand artwork"
          aria-label={`Download artwork for table ${table.label}`}
        >
          <Printer className="h-[18px] w-[18px]" />
        </button>
        <button
          onClick={onDelete}
          className="inline-flex items-center justify-center rounded-full bg-destructive/10 text-destructive shadow-sm transition hover:bg-destructive/20 active:scale-95"
          style={{ width: 44, height: 44, minWidth: 44, minHeight: 44 }}
          title="Delete Table"
          aria-label={`Delete table ${table.label}`}
        >
          <Trash2 className="h-[18px] w-[18px]" />
        </button>
      </div>
    </div>
  );
}

export default function OwnerTablesPage() {
  const qc = useQueryClient();
  const [label, setLabel] = useState("");
  const [seats, setSeats] = useState(2);

  const { cafe, cafeId } = useCafe();

  const tablesQ = useQuery({
    queryKey: ["owner-tables", cafeId],
    enabled: !!cafeId,
    queryFn: async () => {
      const { data } = await supabase.from("tables").select("*").eq("cafe_id", cafeId!).order("label");
      return ((data ?? []) as TableRow[]).sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
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
    // Prevent deleting table if there are active orders
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

  const downloadAll = async () => {
    const list = tablesQ.data ?? [];
    if (list.length === 0) return;
    toast.info("Starting QR downloads...");
    for (let i = 0; i < list.length; i++) {
      const t = list[i];
      const canvas = document.createElement("canvas");
      const url = `${window.location.origin}/t/${t.id}`;
      await QRCode.toCanvas(canvas, url, { margin: 1, width: 400 });
      const link = document.createElement("a");
      link.download = `table-${t.label}-qr.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      await new Promise((r) => setTimeout(r, 250)); // Throttling
    }
    toast.success("All QR downloads initiated");
  };

  const downloadAllArtworks = async () => {
    const list = tablesQ.data ?? [];
    if (list.length === 0) return;
    toast.info("Generating printable artworks...");
    for (let i = 0; i < list.length; i++) {
      const t = list[i];
      const canvas = document.createElement("canvas");
      const url = `${window.location.origin}/t/${t.id}`;
      await QRCode.toCanvas(canvas, url, { margin: 1, width: 400 });
      const artworkDataUrl = await generateQRArtwork(t.label, cafe?.name ?? "Cafe", canvas);
      const link = document.createElement("a");
      link.download = `table-${t.label}-artwork.png`;
      link.href = artworkDataUrl;
      link.click();
      await new Promise((r) => setTimeout(r, 300)); // Throttling
    }
    toast.success("All artwork downloads initiated");
  };

  return (
    <div className="space-y-6">
      {/* ── Header + CTA buttons ── */}
      <header className="flex flex-wrap items-end justify-between gap-3 print:hidden">
        <div className="flex items-center justify-between w-full lg:w-auto">
          <div>
            <h1 className="font-display text-3xl font-semibold tracking-tight">Tables & QR</h1>
            <p className="mt-1 text-sm text-muted-foreground">Print a code for every table — customers scan to order.</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <GlobalNotificationControls />
        {/* CTA stack: Print = primary, Download = secondary */}
        <div className="flex gap-2">
          <button
            onClick={() => void downloadAll()}
            className="inline-flex items-center gap-2 rounded-full bg-secondary px-4 py-2 text-xs font-semibold text-secondary-foreground shadow-soft transition hover:bg-secondary/80"
          >
            <Download className="h-4 w-4" /> Download all PNGs
          </button>
          <button
            onClick={() => void downloadAllArtworks()}
            className="inline-flex items-center gap-2 rounded-full bg-secondary px-4 py-2 text-xs font-semibold text-secondary-foreground shadow-soft transition hover:bg-secondary/80"
          >
            <Printer className="h-4 w-4" /> Download all Artworks
          </button>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-soft"
          >
            <Printer className="h-4 w-4" /> Print all QR codes
          </button>
        </div>
        </div>
      </header>

      {/* ── Add-table section (compact) ── */}
      <section className="rounded-2xl bg-card p-3 shadow-soft ring-1 ring-border/60 print:hidden">
        <h2 className="mb-2 font-display text-sm font-semibold">Add a table</h2>
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Label (e.g. 12 or Patio-3)"
            className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/60"
          />
          <input
            type="number"
            value={seats}
            min={1}
            onChange={(e) => setSeats(Number(e.target.value))}
            className="w-20 rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/60"
          />
          <button
            onClick={() => void add()}
            className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground whitespace-nowrap"
          >
            <Plus className="mr-1 inline h-4 w-4" /> Add
          </button>
        </div>
      </section>

      {/* ── QR grid — increased gap, responsive columns ── */}
      <section className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4 print:grid-cols-3 print:gap-6 print:w-full print:mx-auto">
        {(tablesQ.data ?? []).map((t) => (
          <TableQRCard key={t.id} table={t} cafeName={cafe?.name ?? "Cafe"} onDelete={() => void remove(t)} />
        ))}
      </section>
    </div>
  );
}
