import { useState } from "react";
import { DsButton } from "@/components/ui/ds/DsButton";
import { DsInput } from "@/components/ui/ds/DsInput";
import { DsCard } from "@/components/ui/ds/DsCard";
import { DsBadge } from "@/components/ui/ds/DsBadge";
import { DsPanel } from "@/components/ui/ds/DsPanel";
import { DsTable } from "@/components/ui/ds/DsTable";
import { Sparkles, Send, Trash2, Utensils, CheckCircle2, Bell, Layers, Zap, Flame, ShieldAlert, ArrowRight, RefreshCcw } from "lucide-react";
import { cn } from "@/lib/utils";

export default function DesignSystemShowcasePage() {
  const [selectedCard, setSelectedCard] = useState<string>("c-1");
  const [comparisonMode, setComparisonMode] = useState<"v2" | "v1">("v2");

  const sampleData = [
    { id: "1", order: "#104", table: "Table 4", items: "2x Club Sandwich, 1x Espresso", total: "$28.50", status: "PREPARING" },
    { id: "2", order: "#105", table: "Table 2", items: "1x Iced Latte, 1x Truffle Fries", total: "$13.50", status: "READY" },
    { id: "3", order: "#106", table: "Table 8", items: "1x Margherita Pizza", total: "$15.00", status: "SERVED" },
  ];

  return (
    <div className="min-h-screen bg-background font-sans text-foreground p-6 sm:p-12 select-none pb-24 antialiased">
      {/* Portfolio Hero Header */}
      <div className="max-w-6xl mx-auto mb-12 pb-8 border-b border-white/10">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 text-brand font-extrabold text-xs tracking-widest uppercase mb-2">
              <Sparkles className="h-4 w-4 text-amber-500 animate-pulse" />
              <span>ORDERRAIL DESIGN LANGUAGE V2.0</span>
            </div>
            <h1 className="font-display text-4xl sm:text-5xl font-extrabold tracking-tight text-foreground">
              Warm Hospitality Visual Identity
            </h1>
            <p className="text-sm text-muted-foreground mt-2 max-w-2xl font-medium leading-relaxed">
              An industrial design exercise transforming OrderRail from a generic flat dashboard into a warm, crafted, memorable POS interface inspired by premium hospitality.
            </p>
          </div>

          {/* Before / After Toggle Pill */}
          <div className="flex items-center gap-1 bg-card/80 p-1.5 rounded-2xl border border-white/10 shadow-soft">
            <button
              onClick={() => setComparisonMode("v2")}
              className={cn(
                "px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition",
                comparisonMode === "v2"
                  ? "bg-brand text-brand-foreground shadow-soft"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              V2.0 Warm Material
            </button>
            <button
              onClick={() => setComparisonMode("v1")}
              className={cn(
                "px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition",
                comparisonMode === "v1"
                  ? "bg-muted text-foreground shadow-soft"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              V1.0 Legacy Flat
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto space-y-16">
        {/* 1. Palette Swatch Grid: Warm Hospitality Palette */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-extrabold text-foreground flex items-center gap-2">
              <Flame className="h-5 w-5 text-amber-500" />
              <span>1. Warm Hospitality Palette (Espresso, Caramel, Forest, Copper)</span>
            </h2>
            <span className="text-xs font-mono text-muted-foreground">DESIGN_LANGUAGE_V2.md</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 text-xs font-bold">
            <div className="p-4 rounded-2xl bg-[hsl(28,45%,8%)] border border-white/10 text-white shadow-soft flex flex-col justify-between h-24">
              <span>Espresso</span>
              <span className="text-[10px] opacity-70 font-mono">hsl(28 45% 8%)</span>
            </div>
            <div className="p-4 rounded-2xl bg-[hsl(28,75%,52%)] text-white shadow-soft flex flex-col justify-between h-24">
              <span>Caramel / Copper</span>
              <span className="text-[10px] opacity-80 font-mono">hsl(28 75% 52%)</span>
            </div>
            <div className="p-4 rounded-2xl bg-[hsl(35,30%,95%)] text-neutral-900 shadow-soft flex flex-col justify-between h-24">
              <span>Cream Text</span>
              <span className="text-[10px] opacity-80 font-mono">hsl(35 30% 95%)</span>
            </div>
            <div className="p-4 rounded-2xl bg-[hsl(155,60%,45%)] text-white shadow-soft flex flex-col justify-between h-24">
              <span>Forest Emerald</span>
              <span className="text-[10px] opacity-80 font-mono">hsl(155 60% 45%)</span>
            </div>
            <div className="p-4 rounded-2xl bg-[hsl(25,15%,14%)] border border-white/10 text-white shadow-soft flex flex-col justify-between h-24">
              <span>Slate Base</span>
              <span className="text-[10px] opacity-70 font-mono">hsl(25 15% 14%)</span>
            </div>
            <div className="p-4 rounded-2xl bg-[hsl(25,12%,20%)] border border-white/10 text-white shadow-soft flex flex-col justify-between h-24">
              <span>Stone Surface</span>
              <span className="text-[10px] opacity-70 font-mono">hsl(25 12% 20%)</span>
            </div>
          </div>
        </section>

        {/* 2. Material Layer Depth Sandbox */}
        <section className="space-y-4">
          <h2 className="font-display text-lg font-extrabold text-foreground flex items-center gap-2">
            <Layers className="h-5 w-5 text-brand" />
            <span>2. Material Depth & Soft Glass Layers</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <DsPanel variant="workspace" className="h-32">
              <span className="text-xs font-bold text-muted-foreground uppercase">Workspace Surface</span>
              <div className="text-xs text-foreground font-mono mt-1">bg-card/70 backdrop-blur-md</div>
            </DsPanel>

            <DsPanel variant="secondary" className="h-32">
              <span className="text-xs font-bold text-muted-foreground uppercase">Secondary Layer</span>
              <div className="text-xs text-foreground font-mono mt-1">bg-muted/20 border-white/5</div>
            </DsPanel>

            <DsPanel variant="floating" className="h-32">
              <span className="text-xs font-bold text-brand uppercase">Floating Card Panel</span>
              <div className="text-xs text-foreground font-mono mt-1">shadow-float border-white/15</div>
            </DsPanel>

            <DsPanel variant="drawer" className="h-32">
              <span className="text-xs font-bold text-emerald-400 uppercase">Overlay Drawer Panel</span>
              <div className="text-xs text-foreground font-mono mt-1">shadow-2xl backdrop-blur-xl</div>
            </DsPanel>
          </div>
        </section>

        {/* 3. Craft Component Showcase */}
        <section className="space-y-6">
          <h2 className="font-display text-lg font-extrabold text-foreground border-b border-white/10 pb-2">
            3. Crafted Component Primitives (`DsButton`, `DsCard`, `DsBadge`, `DsInput`)
          </h2>

          {/* Button States */}
          <div className="space-y-2">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest block">Buttons</span>
            <div className="flex flex-wrap items-center gap-3">
              <DsButton variant="primary" leftIcon={<Send className="h-4 w-4" />}>
                Primary Copper Action
              </DsButton>
              <DsButton variant="warm" leftIcon={<Flame className="h-4 w-4" />}>
                Warm Caramel CTA
              </DsButton>
              <DsButton variant="secondary" leftIcon={<Utensils className="h-4 w-4" />}>
                Secondary Frosted
              </DsButton>
              <DsButton variant="ghost">Ghost Action</DsButton>
              <DsButton variant="danger" leftIcon={<Trash2 className="h-4 w-4" />}>
                Danger Action
              </DsButton>
              <DsButton variant="primary" isLoading>Processing</DsButton>
              <DsButton variant="icon">
                <Bell className="h-4 w-4 text-brand" />
              </DsButton>
            </div>
          </div>

          {/* Status Badges */}
          <div className="space-y-2">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest block">Ceramic Status Pills</span>
            <div className="flex flex-wrap items-center gap-2">
              <DsBadge variant="success">AVAILABLE / FREE</DsBadge>
              <DsBadge variant="warning">OCCUPIED 34M</DsBadge>
              <DsBadge variant="danger">BILL REQUESTED</DsBadge>
              <DsBadge variant="info">CLEANING</DsBadge>
              <DsBadge variant="brand">PRIMARY BRAND</DsBadge>
              <DsBadge variant="warm">SPECIAL OFFER</DsBadge>
              <DsBadge variant="neutral">OUT OF SERVICE</DsBadge>
            </div>
          </div>

          {/* Metric Cards */}
          <div className="space-y-2">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest block">Metric & Selectable Cards</span>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <DsCard variant="info">
                <span className="text-xs font-semibold text-muted-foreground">Information Card</span>
                <div className="font-bold text-sm text-foreground mt-1">Frosted Glass Surface</div>
              </DsCard>

              <DsCard variant="interactive">
                <span className="text-xs font-semibold text-brand">Interactive Card</span>
                <div className="font-bold text-sm text-foreground mt-1">Warm Hover & Scale Glow</div>
              </DsCard>

              <DsCard variant="metric" title="Shift Revenue" metricValue="$2,480.00" metricChange="+18.4% vs last shift" />

              <DsCard
                variant="selectable"
                isSelected={selectedCard === "c-1"}
                onClick={() => setSelectedCard("c-1")}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-foreground">Table 4 Card</span>
                  <CheckCircle2 className="h-4 w-4 text-brand" />
                </div>
                <span className="text-xs text-muted-foreground mt-1 block font-mono">4 Guests • Session Active</span>
              </DsCard>
            </div>
          </div>
        </section>

        {/* 4. Operational Data Table */}
        <section className="space-y-4">
          <h2 className="font-display text-lg font-extrabold text-foreground border-b border-white/10 pb-2">
            4. Operational Data Table (`DsTable`)
          </h2>

          <DsTable
            columns={[
              { key: "order", header: "Order ID" },
              { key: "table", header: "Location" },
              { key: "items", header: "Order Summary" },
              { key: "total", header: "Amount" },
              {
                key: "status",
                header: "Status",
                render: (row) => (
                  <DsBadge
                    variant={row.status === "PREPARING" ? "warning" : row.status === "READY" ? "info" : "success"}
                  >
                    {row.status}
                  </DsBadge>
                ),
              },
            ]}
            data={sampleData}
            onRowClick={(row) => alert(`Clicked order ${row.order}`)}
          />
        </section>

        {/* 5. Minimal Elegant Empty State */}
        <section className="space-y-4">
          <h2 className="font-display text-lg font-extrabold text-foreground border-b border-white/10 pb-2">
            5. Minimal Operational Empty State
          </h2>

          <div className="rounded-3xl bg-card/40 border border-white/5 p-8 text-center flex flex-col items-center justify-center space-y-3">
            <div className="h-12 w-12 rounded-2xl bg-brand/10 border border-brand/20 flex items-center justify-center text-brand">
              <Utensils className="h-6 w-6" />
            </div>
            <h3 className="font-display text-base font-extrabold text-foreground">No Active KOT Orders</h3>
            <p className="text-xs text-muted-foreground max-w-sm font-medium">
              Kitchen queue is currently clear. New orders submitted at the counter will spoo directly into this live feed.
            </p>
            <DsButton variant="secondary" size="sm" leftIcon={<RefreshCcw className="h-3.5 w-3.5" />}>
              Refresh Feed
            </DsButton>
          </div>
        </section>
      </div>
    </div>
  );
}
