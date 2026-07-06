import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import QRCode from "qrcode";
import { QrCode, Coffee, Zap, WifiOff, ArrowRight, ChefHat, LayoutDashboard } from "lucide-react";
import { supabase, type TableRow } from "@/lib/db";
import { useCafe } from "@/lib/cafe";
import { useAuth, hasRole } from "@/lib/auth";

function TableQR({ tableId, label }: { tableId: string; label: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!canvasRef.current) return;
    const url = `${window.location.origin}/t/${tableId}`;
    void QRCode.toCanvas(canvasRef.current, url, { margin: 1, width: 180, color: { dark: "#1a1210", light: "#ffffff" } });
  }, [tableId]);
  return (
    <Link
      to={`/t/${tableId}`}
      className="group flex flex-col items-center gap-3 rounded-3xl bg-card p-4 shadow-soft ring-1 ring-border/60 transition hover:shadow-float"
    >
      <canvas ref={canvasRef} className="rounded-xl" aria-label={`QR for table ${label}`} />
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground group-hover:text-foreground">
        Table {label} <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
      </div>
    </Link>
  );
}

export default function Index() {
  const [showQRs, setShowQRs] = useState(false);
  const { cafe, cafeId } = useCafe();
  const { session, roles, loading } = useAuth();
  const navigate = useNavigate();

  const { data: tables = [] } = useQuery({
    queryKey: ["landing-tables", cafeId],
    enabled: !!cafeId,
    queryFn: async () => {
      const { data } = await supabase
        .from("tables")
        .select("*")
        .eq("cafe_id", cafeId!)
        .order("label");
      return ((data ?? []) as TableRow[]).sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
    },
  });

  const firstTable = tables[0];

  useEffect(() => {
    console.log("Index: Redirect check evaluation:", {
      loading,
      sessionExists: !!session,
      roles,
      isOwner: hasRole(roles, "owner"),
      isStaff: hasRole(roles, "staff")
    });
    if (!loading && session) {
      if (hasRole(roles, "owner")) {
        console.log("Index: Redirecting to /owner");
        navigate("/owner", { replace: true });
      } else if (hasRole(roles, "staff")) {
        console.log("Index: Redirecting to /staff");
        navigate("/staff", { replace: true });
      }
    }
  }, [loading, session, roles, navigate]);

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-gradient-warm text-muted-foreground">
        <div className="flex flex-col items-center gap-2">
          <Coffee className="h-8 w-8 animate-bounce text-accent" />
          <span className="text-sm font-medium animate-pulse">Checking session…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-warm">
      {/* Nav */}
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-accent text-accent-foreground shadow-soft">
            <span className="font-display text-sm font-bold">OR</span>
          </span>
          <span className="font-display text-lg font-semibold">OrderRail</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Link
            to="/staff/login"
            className="inline-flex items-center gap-1.5 rounded-full bg-card px-4 py-2 font-medium ring-1 ring-border hover:bg-secondary"
          >
            <LayoutDashboard className="h-4 w-4" /> Staff sign in
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-5xl px-6 pt-6 pb-16">
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1 text-xs font-medium text-muted-foreground ring-1 ring-border">
              <Coffee className="h-3 w-3" /> Digital cafe upgrade
            </span>
            <h1 className="mt-5 font-display text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
              Scan. Order. <span className="italic text-accent">Sip.</span>
            </h1>
            <p className="mt-5 max-w-md text-lg text-muted-foreground">
              OrderRail modernizes independent cafes with QR-based ordering, real-time kitchen updates, and one-tap
              service — without changing how you run your floor.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              {firstTable && (
                <Link
                  to={`/t/${firstTable.id}`}
                  className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-soft transition hover:opacity-90"
                >
                  Try the customer app <ArrowRight className="h-4 w-4" />
                </Link>
              )}
              <button
                onClick={() => setShowQRs((v) => !v)}
                className="inline-flex items-center gap-2 rounded-full bg-card px-6 py-3 text-sm font-semibold ring-1 ring-border transition hover:bg-secondary"
              >
                <QrCode className="h-4 w-4" /> {showQRs ? "Hide" : "Show"} demo QR codes
              </button>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Staff & owner dashboards are shipping next. Data is live via Lovable Cloud.
            </p>
          </div>

          {/* Feature panels */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { icon: QrCode, title: "QR ordering", body: "Every table gets its own code — customers browse instantly." },
              { icon: Zap, title: "Real-time", body: "Kitchen and floor see updates the moment they happen." },
              { icon: WifiOff, title: "Offline-ready", body: "Orders queue and sync automatically when reconnected." },
              { icon: ChefHat, title: "Staff-friendly", body: "Fits your workflow — no cash register replacement needed." },
            ].map(({ icon: Icon, title, body }) => (
              <div key={title} className="rounded-3xl bg-card p-4 shadow-soft ring-1 ring-border/60">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-secondary text-secondary-foreground">
                  <Icon className="h-4 w-4" />
                </span>
                <h3 className="mt-3 font-display text-base font-semibold">{title}</h3>
                <p className="mt-1 text-xs text-muted-foreground">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Demo tables / QR codes */}
      {showQRs && tables.length ? (
        <section className="mx-auto max-w-5xl px-6 pb-24">
          <div className="mb-6 flex items-end justify-between">
            <div>
              <h2 className="font-display text-2xl font-semibold">Demo tables — {cafe?.name}</h2>
              <p className="text-sm text-muted-foreground">Scan with a phone camera, or click a card to open.</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {tables.map((t) => (
              <TableQR key={t.id} tableId={t.id} label={t.label} />
            ))}
          </div>
        </section>
      ) : null}

      {/* Placeholder for future staff/owner links */}
      <section className="mx-auto max-w-5xl px-6 pb-24">
        <div className="rounded-3xl border border-dashed border-border bg-card/60 p-6 text-sm text-muted-foreground">
          <div className="flex items-center gap-2 font-medium text-foreground">
            <LayoutDashboard className="h-4 w-4" /> Coming next
          </div>
          <p className="mt-1">Staff dashboard for live orders & service requests, and owner dashboard for analytics, menu, and QR management.</p>
        </div>
      </section>
    </div>
  );
}
