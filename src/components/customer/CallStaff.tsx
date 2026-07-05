import { useState } from "react";
import { Droplet, Hand, Receipt, HelpCircle, Check } from "lucide-react";
import { motion } from "framer-motion";
import { supabase, type Cafe, type TableRow, type ServiceRequestType } from "@/lib/db";
import { getSessionId } from "@/lib/session";
import { toast } from "sonner";

const actions: { type: ServiceRequestType; label: string; sub: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { type: "water", label: "Need Water", sub: "Refill or a fresh glass", icon: Droplet },
  { type: "waiter", label: "Call Waiter", sub: "A team member will be right over", icon: Hand },
  { type: "bill", label: "Need Bill", sub: "Request your check", icon: Receipt },
  { type: "help", label: "Need Help", sub: "Anything else — we're here", icon: HelpCircle },
];

export function CallStaff({ cafe, table }: { cafe: Cafe; table: TableRow }) {
  const [sending, setSending] = useState<ServiceRequestType | null>(null);
  const [sent, setSent] = useState<Record<string, number>>({});

  const send = async (type: ServiceRequestType) => {
    setSending(type);
    try {
      const { error } = await supabase.from("service_requests").insert({
        cafe_id: cafe.id,
        table_id: table.id,
        session_id: getSessionId(),
        type,
      });
      if (error) throw error;
      setSent((s) => ({ ...s, [type]: Date.now() }));
      toast.success("Staff notified");
      setTimeout(() => {
        setSent((s) => {
          const next = { ...s };
          delete next[type];
          return next;
        });
      }, 3000);
    } catch (e) {
      console.error(e);
      toast.error("Couldn't reach staff — please try again.");
    } finally {
      setSending(null);
    }
  };

  return (
    <div className="pb-32">
      <div className="px-4 pt-4">
        <h1 className="font-display text-3xl font-semibold">Call Staff</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Table {table.label} · {cafe.name}
        </p>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-3 px-4 sm:grid-cols-2">
        {actions.map(({ type, label, sub, icon: Icon }) => {
          const wasSent = sent[type];
          const isSending = sending === type;
          return (
            <motion.button
              key={type}
              whileTap={{ scale: 0.98 }}
              onClick={() => send(type)}
              disabled={isSending}
              className="group relative flex items-start gap-4 overflow-hidden rounded-3xl bg-card p-5 text-left shadow-soft ring-1 ring-border/60 transition hover:ring-accent/40 disabled:opacity-70"
            >
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-accent text-accent-foreground">
                {wasSent ? <Check className="h-6 w-6" /> : <Icon className="h-6 w-6" />}
              </span>
              <span className="min-w-0">
                <span className="block font-display text-lg font-semibold">{label}</span>
                <span className="mt-0.5 block text-sm text-muted-foreground">
                  {wasSent ? "Sent — staff is on the way" : sub}
                </span>
              </span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
