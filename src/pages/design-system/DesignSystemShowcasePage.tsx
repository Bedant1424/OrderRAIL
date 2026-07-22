import { useState } from "react";
import { DsButton } from "@/components/ui/ds/DsButton";
import { DsInput } from "@/components/ui/ds/DsInput";
import { DsCard } from "@/components/ui/ds/DsCard";
import { DsBadge } from "@/components/ui/ds/DsBadge";
import { DsPanel } from "@/components/ui/ds/DsPanel";
import { DsTable } from "@/components/ui/ds/DsTable";
import { Sparkles, Send, Trash2, Search, Utensils, CheckCircle2, ArrowRight, Layers, Bell } from "lucide-react";

export default function DesignSystemShowcasePage() {
  const [activeTab, setActiveTab] = useState<string>("all");
  const [selectedCard, setSelectedCard] = useState<string>("c-1");

  const sampleData = [
    { id: "1", order: "#104", table: "Table 4", items: "2x Club Sandwich, 1x Espresso", total: "$28.50", status: "PREPARING" },
    { id: "2", order: "#105", table: "Table 2", items: "1x Iced Latte, 1x Truffle Fries", total: "$13.50", status: "READY" },
    { id: "3", order: "#106", table: "Table 8", items: "1x Margherita Pizza", total: "$15.00", status: "SERVED" },
  ];

  return (
    <div className="min-h-screen bg-background font-sans text-foreground p-6 sm:p-10 select-none pb-20">
      {/* Header Banner */}
      <div className="max-w-6xl mx-auto mb-10 pb-6 border-b border-border/40">
        <div className="flex items-center gap-2 text-brand font-extrabold text-xs tracking-wider uppercase mb-1">
          <Sparkles className="h-4 w-4" />
          <span>ORDERRAIL DESIGN SYSTEM V1.0</span>
        </div>
        <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
          Living Component Showcase
        </h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          The foundational, reusable UI design system for OrderRail across Counter, Owner Dashboard, Staff Console, Kitchen Display, and Analytics.
        </p>
      </div>

      <div className="max-w-6xl mx-auto space-y-12">
        {/* 1. Design Tokens Section */}
        <section className="space-y-4">
          <h2 className="font-display text-lg font-extrabold text-foreground border-b border-border/20 pb-2">
            1. Design Tokens (Colors, Typography, Elevation)
          </h2>

          {/* Color Tokens */}
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 text-xs font-semibold">
            <div className="p-3 rounded-2xl bg-brand text-brand-foreground shadow-soft flex flex-col justify-between h-20">
              <span>Primary Brand</span>
              <span className="text-[10px] opacity-80 font-mono">--brand</span>
            </div>
            <div className="p-3 rounded-2xl bg-card border border-border/40 text-foreground shadow-soft flex flex-col justify-between h-20">
              <span>Surface Card</span>
              <span className="text-[10px] text-muted-foreground font-mono">--card</span>
            </div>
            <div className="p-3 rounded-2xl bg-emerald-500 text-white shadow-soft flex flex-col justify-between h-20">
              <span>Success Green</span>
              <span className="text-[10px] opacity-80 font-mono">#10B981</span>
            </div>
            <div className="p-3 rounded-2xl bg-amber-500 text-white shadow-soft flex flex-col justify-between h-20">
              <span>Warning Amber</span>
              <span className="text-[10px] opacity-80 font-mono">#F59E0B</span>
            </div>
            <div className="p-3 rounded-2xl bg-red-500 text-white shadow-soft flex flex-col justify-between h-20">
              <span>Danger Red</span>
              <span className="text-[10px] opacity-80 font-mono">#EF4444</span>
            </div>
            <div className="p-3 rounded-2xl bg-blue-500 text-white shadow-soft flex flex-col justify-between h-20">
              <span>Info Blue</span>
              <span className="text-[10px] opacity-80 font-mono">#3B82F6</span>
            </div>
          </div>
        </section>

        {/* 2. Buttons Section */}
        <section className="space-y-4">
          <h2 className="font-display text-lg font-extrabold text-foreground border-b border-border/20 pb-2">
            2. Button Primitives (`DsButton`)
          </h2>

          <div className="flex flex-wrap items-center gap-3">
            <DsButton variant="primary" leftIcon={<Send className="h-4 w-4" />}>
              Primary Button
            </DsButton>

            <DsButton variant="secondary" leftIcon={<Utensils className="h-4 w-4" />}>
              Secondary Button
            </DsButton>

            <DsButton variant="ghost">
              Ghost Button
            </DsButton>

            <DsButton variant="danger" leftIcon={<Trash2 className="h-4 w-4" />}>
              Danger Button
            </DsButton>

            <DsButton variant="primary" isLoading>
              Loading State
            </DsButton>

            <DsButton variant="icon">
              <Bell className="h-4 w-4 text-brand" />
            </DsButton>
          </div>
        </section>

        {/* 3. Inputs Section */}
        <section className="space-y-4">
          <h2 className="font-display text-lg font-extrabold text-foreground border-b border-border/20 pb-2">
            3. Input Primitives (`DsInput`)
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <DsInput label="Search Menu" isSearch placeholder="Search by dish or code..." />
            <DsInput label="Cash Tendered" leftElement="$" defaultValue="40.00" />
            <DsInput label="Invalid Pin Input" defaultValue="1234" error="Invalid Cashier Pairing Code" />
          </div>
        </section>

        {/* 4. Badges & Status Section */}
        <section className="space-y-4">
          <h2 className="font-display text-lg font-extrabold text-foreground border-b border-border/20 pb-2">
            4. Status Badges & Pills (`DsBadge`)
          </h2>

          <div className="flex flex-wrap items-center gap-2">
            <DsBadge variant="success">AVAILABLE / FREE</DsBadge>
            <DsBadge variant="warning">OCCUPIED</DsBadge>
            <DsBadge variant="danger">BILL REQUESTED</DsBadge>
            <DsBadge variant="info">CLEANING</DsBadge>
            <DsBadge variant="brand">PRIMARY BRAND</DsBadge>
            <DsBadge variant="neutral">OUT OF SERVICE</DsBadge>
          </div>
        </section>

        {/* 5. Cards Section */}
        <section className="space-y-4">
          <h2 className="font-display text-lg font-extrabold text-foreground border-b border-border/20 pb-2">
            5. Card Primitives (`DsCard`)
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <DsCard variant="info">
              <span className="text-xs font-semibold text-muted-foreground">Information Card</span>
              <div className="font-bold text-sm text-foreground mt-1">Standard Info Container</div>
            </DsCard>

            <DsCard variant="interactive">
              <span className="text-xs font-semibold text-brand">Interactive Card</span>
              <div className="font-bold text-sm text-foreground mt-1">Hover & Scale Micro-Motion</div>
            </DsCard>

            <DsCard variant="metric" title="Today's Revenue" metricValue="$1,840.50" metricChange="+14% vs yesterday" />

            <DsCard
              variant="selectable"
              isSelected={selectedCard === "c-1"}
              onClick={() => setSelectedCard("c-1")}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-foreground">Table 4 Card</span>
                <CheckCircle2 className="h-4 w-4 text-brand" />
              </div>
              <span className="text-xs text-muted-foreground mt-1 block font-mono">4 Seats • Occupied 34m</span>
            </DsCard>
          </div>
        </section>

        {/* 6. Table Component Showcase */}
        <section className="space-y-4">
          <h2 className="font-display text-lg font-extrabold text-foreground border-b border-border/20 pb-2">
            6. Data Table Primitive (`DsTable`)
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
      </div>
    </div>
  );
}
