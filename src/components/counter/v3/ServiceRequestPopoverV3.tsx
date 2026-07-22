import { Droplet, Receipt, Check, Bell, X } from "lucide-react";
import { toast } from "sonner";

interface ServiceRequestPopoverV3Props {
  isOpen: boolean;
  onClose: () => void;
}

export function ServiceRequestPopoverV3({ isOpen, onClose }: ServiceRequestPopoverV3Props) {
  if (!isOpen) return null;

  const handleAcknowledge = (tableName: string, type: string) => {
    toast.success(`Acknowledged ${type} call for ${tableName}`);
  };

  return (
    <div className="absolute top-14 right-16 z-50 w-80 rounded-2xl bg-card border border-border/80 shadow-2xl p-3.5 select-none animate-in fade-in slide-in-from-top-2 duration-150">
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-border/60">
        <h3 className="font-display text-xs font-bold flex items-center gap-1.5 text-foreground">
          <Bell className="h-3.5 w-3.5 text-amber-500" />
          <span>ACTIVE SERVICE REQUESTS (2)</span>
        </h3>
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground rounded-lg p-1 transition"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="space-y-2 text-xs">
        <div className="flex items-center justify-between rounded-xl bg-amber-500/10 border border-amber-500/20 p-2.5">
          <div className="flex items-center gap-2">
            <Droplet className="h-4 w-4 text-blue-500 shrink-0" />
            <div>
              <div className="font-semibold text-foreground">Table 2: Water</div>
              <div className="text-[10px] text-muted-foreground">45s ago</div>
            </div>
          </div>
          <button
            onClick={() => handleAcknowledge("Table 2", "Water")}
            className="rounded-lg bg-card hover:bg-muted text-foreground border border-border px-2 py-1 text-[10px] font-bold flex items-center gap-1 transition"
          >
            <Check className="h-3 w-3 text-emerald-500" /> Ack
          </button>
        </div>

        <div className="flex items-center justify-between rounded-xl bg-orange-500/10 border border-orange-500/20 p-2.5">
          <div className="flex items-center gap-2">
            <Receipt className="h-4 w-4 text-orange-500 shrink-0" />
            <div>
              <div className="font-semibold text-foreground">Table 4: Bill Request</div>
              <div className="text-[10px] text-muted-foreground">12s ago</div>
            </div>
          </div>
          <button
            onClick={() => handleAcknowledge("Table 4", "Bill Request")}
            className="rounded-lg bg-card hover:bg-muted text-foreground border border-border px-2 py-1 text-[10px] font-bold flex items-center gap-1 transition"
          >
            <Check className="h-3 w-3 text-emerald-500" /> Ack
          </button>
        </div>
      </div>
    </div>
  );
}
