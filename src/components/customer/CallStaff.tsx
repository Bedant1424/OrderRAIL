import { useState } from "react";
import { Droplet, Hand, Receipt, HelpCircle, Check, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { supabase, type Cafe, type TableRow, type ServiceRequestType } from "@/lib/db";
import { getSessionId } from "@/lib/session";
import { toast } from "@/components/ui/sonner";
import { APP_CONFIG } from "@/config/app";
import { useServiceRequestCooldown } from "@/hooks/useServiceRequestCooldown";
import { createServiceRequestInDb } from "@/lib/serviceRequests";

const actions: { type: ServiceRequestType; label: string; sub: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { type: "water", label: "Need Water", sub: "Refill or a fresh glass", icon: Droplet },
  { type: "waiter", label: "Call Waiter", sub: "A team member will be right over", icon: Hand },
  { type: "bill", label: "Need Bill", sub: "Request your check", icon: Receipt },
  { type: "help", label: "Need Help", sub: "Anything else — we're here to help", icon: HelpCircle },
];

export function CallStaff({ cafe, table }: { cafe: Cafe; table: TableRow }) {
  const [sending, setSending] = useState<ServiceRequestType | null>(null);
  const cooldown = useServiceRequestCooldown(APP_CONFIG.serviceRequestCooldownMs, APP_CONFIG.serviceRequestTimeoutMs);

  const send = async (type: ServiceRequestType) => {
    if (!cooldown.canSend(type)) return;
    setSending(type);
    try {
      await createServiceRequestInDb({
        cafe_id: cafe.id,
        table_id: table.id,
        browser_session_id: getSessionId(),
        dining_session_id: table.active_session_id,
        type,
      });
      cooldown.markSent(type);
      toast.success("Staff notified — someone will be with you shortly! ☕");
    } catch (e) {
      console.error(e);
      toast.error("Couldn't reach staff — please try again.");
    } finally {
      setSending(null);
    }
  };

  return (
    <div className="pb-28">
      {/* Screen Header */}
      <div className="px-4 pt-3 pb-1">
        <h1 className="font-display text-2xl font-black text-cc-text tracking-tight">Need Anything?</h1>
        <p className="mt-0.5 text-xs text-cc-text-muted font-medium">
          Let us know and we'll come to your table.
        </p>
      </div>

      {/* Service Action Cards Grid */}
      <div className="mt-4 grid grid-cols-1 gap-3 px-4 sm:grid-cols-2">
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
              className="group relative flex items-start gap-4 overflow-hidden rounded-2xl bg-cc-surface p-4 text-left shadow-xs border border-cc-border hover:border-cc-primary/40 transition disabled:opacity-75 min-h-[80px]"
            >
              <span
                className={
                  isPending
                    ? "grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-300 shadow-xs"
                    : "grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-cc-surface-soft text-cc-primary border border-cc-border shadow-xs group-hover:bg-cc-primary group-hover:text-white transition-colors"
                }
              >
                {isSending ? (
                  <Loader2 className="h-5 w-5 animate-spin" strokeWidth={2.2} />
                ) : isPending ? (
                  <Check className="h-5 w-5" strokeWidth={2.2} />
                ) : (
                  <Icon className="h-5 w-5" strokeWidth={2.2} />
                )}
              </span>

              <span className="min-w-0 flex-1 pt-0.5">
                <span className="block font-display text-base font-bold text-cc-text">{label}</span>
                <span className="mt-0.5 block text-xs font-medium text-cc-text-muted leading-relaxed">
                  {remaining > 0
                    ? `Staff notified — please wait ${Math.ceil(remaining / 1000)}s`
                    : isPending
                    ? "Staff has been notified — on the way"
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
