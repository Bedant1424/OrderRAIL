import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import QRCode from "qrcode";
import { Plus, Printer, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase, type Cafe, type TableRow } from "@/lib/db";

function TableQRCard({ table }: { table: TableRow }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const url = `${window.location.origin}/t/${table.id}`;
    void QRCode.toCanvas(ref.current, url, { margin: 1, width: 200, color: { dark: "#1a1210", light: "#ffffff" } });
  }, [table.id]);
  return (
    <div className="rounded-3xl bg-card p-4 text-center shadow-soft ring-1 ring-border/60 print:break-inside-avoid">
      <canvas ref={ref} className="mx-auto rounded-xl" />
      <div className="mt-3 font-display text-xl font-semibold">Table {table.label}</div>
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Scan to order</div>
    </div>
  );
}

import { useCafe } from "@/lib/cafe";

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
      return (data ?? []) as TableRow[];
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
    if (!confirm(`Remove table ${t.label}?`)) return;
    const { error } = await supabase.from("tables").delete().eq("id", t.id);
    if (error) return toast.error(error.message);
    void qc.invalidateQueries({ queryKey: ["owner-tables", cafeId] });
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-3 print:hidden">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Tables & QR</h1>
          <p className="mt-1 text-sm text-muted-foreground">Print a code for every table — customers scan to order.</p>
        </div>
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-soft"
        >
          <Printer className="h-4 w-4" /> Print all QR codes
        </button>
      </header>

      <section className="rounded-3xl bg-card p-4 shadow-soft ring-1 ring-border/60 print:hidden">
        <h2 className="mb-3 font-display text-base font-semibold">Add a table</h2>
        <div className="grid gap-3 sm:grid-cols-[1fr_120px_auto]">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Label (e.g. 12 or Patio-3)"
            className="rounded-2xl border border-border bg-background p-2.5 text-sm outline-none focus:ring-2 focus:ring-ring/60"
          />
          <input
            type="number"
            value={seats}
            min={1}
            onChange={(e) => setSeats(Number(e.target.value))}
            className="rounded-2xl border border-border bg-background p-2.5 text-sm outline-none focus:ring-2 focus:ring-ring/60"
          />
          <button
            onClick={() => void add()}
            className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground"
          >
            <Plus className="mr-1 inline h-4 w-4" /> Add
          </button>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 print:grid-cols-3">
        {(tablesQ.data ?? []).map((t) => (
          <div key={t.id} className="relative">
            <TableQRCard table={t} />
            <button
              onClick={() => void remove(t)}
              className="absolute right-2 top-2 rounded-full bg-background/90 p-1.5 text-muted-foreground shadow-soft hover:text-destructive print:hidden"
              aria-label="Remove table"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </section>
    </div>
  );
}
