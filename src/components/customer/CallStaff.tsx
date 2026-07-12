import { useState } from "react";
import { Droplet, Hand, Receipt, HelpCircle, Check } from "lucide-react";
import { motion } from "framer-motion";
import { supabase, type Cafe, type TableRow, type ServiceRequestType } from "@/lib/db";
import { getSessionId } from "@/lib/session";
import { toast } from "@/components/ui/sonner";
import { APP_CONFIG } from "@/config/app";
import { useServiceRequestCooldown } from "@/hooks/useServiceRequestCooldown";

const actions: { type: ServiceRequestType; label: string; sub: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { type: "water", label: "Need Water", sub: "Refill or a fresh glass", icon: Droplet },
  { type: "waiter", label: "Call Waiter", sub: "A team member will be right over", icon: Hand },
  { type: "bill", label: "Need Bill", sub: "Request your check", icon: Receipt },
  { type: "help", label: "Need Help", sub: "Anything else — we're here", icon: HelpCircle },
];

export function CallStaff({ cafe, table }: { cafe: Cafe; table: TableRow }) {
  const [sending, setSending] = useState<ServiceRequestType | null>(null);
  const cooldown = useServiceRequestCooldown(APP_CONFIG.serviceRequestCooldownMs, APP_CONFIG.serviceRequestTimeoutMs);

  const send = async (type: ServiceRequestType) => {
    if (!cooldown.canSend(type)) return;
    setSending(type);
    try {
      const { error } = await supabase.from("service_requests").insert({
        cafe_id: cafe.id,
        table_id: table.id,
        // Align payload with schema refactor: use browser_session_id and dining_session_id instead of session_id
        browser_session_id: getSessionId(),
        dining_session_id: table.active_session_id,
        type,
      });
      if (error) throw error;
      cooldown.markSent(type);
      toast.success("Staff notified");
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
          const isSending = sending === type;
          const isPending = cooldown.isPending(type);
          const remaining = cooldown.remainingCooldownMs(type);
          return (
            <motion.button
              key={type}
              whileTap={{ scale: 0.98 }}
              onClick={() => send(type)}
              disabled={isSending || remaining > 0}
              className="group relative flex items-start gap-4 overflow-hidden rounded-3xl bg-card p-5 text-left shadow-soft ring-1 ring-border/60 transition hover:ring-accent/40 disabled:opacity-70"
            >
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-accent text-accent-foreground">
                {isPending ? <Check className="h-6 w-6" /> : <Icon className="h-6 w-6" />}
              </span>
              <span className="min-w-0">
                <span className="block font-display text-lg font-semibold">{label}</span>
                <span className="mt-0.5 block text-sm text-muted-foreground">
                  {remaining > 0
                    ? `Sent — you can ask again in ${Math.ceil(remaining / 1000)}s`
                    : isPending
                    ? "Sent — staff is on the way"
                    : sub}
                </span>
              </span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

