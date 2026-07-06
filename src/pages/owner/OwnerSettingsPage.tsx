import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useCafe } from "@/lib/cafe";
import { supabase } from "@/lib/db";

const CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD", "JPY", "INR", "BRL", "MXN", "CHF"];

export default function OwnerSettingsPage() {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [busy, setBusy] = useState(false);

  const { cafe, refreshCafe } = useCafe();

  useEffect(() => {
    if (cafe) {
      setName(cafe.name);
      setDescription(cafe.description ?? "");
      setCurrency(cafe.currency);
    }
  }, [cafe]);

  const save = async () => {
    if (!cafe) return;
    setBusy(true);
    const { error } = await supabase
      .from("cafes")
      .update({ name: name.trim(), description: description.trim() || null, currency })
      .eq("id", cafe.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    void refreshCafe();
  };

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Cafe details customers see.</p>
      </header>

      <section className="rounded-3xl bg-card p-5 shadow-soft ring-1 ring-border/60">
        <label className="block text-xs font-medium text-muted-foreground">Cafe name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full rounded-2xl border border-border bg-background p-2.5 text-sm outline-none focus:ring-2 focus:ring-ring/60"
        />

        <label className="mt-4 block text-xs font-medium text-muted-foreground">Short description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="mt-1 w-full resize-none rounded-2xl border border-border bg-background p-2.5 text-sm outline-none focus:ring-2 focus:ring-ring/60"
        />

        <label className="mt-4 block text-xs font-medium text-muted-foreground">Currency</label>
        <select
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
          className="mt-1 w-full rounded-2xl border border-border bg-background p-2.5 text-sm outline-none focus:ring-2 focus:ring-ring/60"
        >
          {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>

        <button
          onClick={() => void save()}
          disabled={busy}
          className="mt-5 w-full rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          {busy ? "Saving…" : "Save changes"}
        </button>
      </section>
    </div>
  );
}
