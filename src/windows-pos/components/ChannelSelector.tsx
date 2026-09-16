import React from "react";
import { Utensils, ShoppingBag, Bike } from "lucide-react";
import type { OrderSource } from "../types/counterTypes";

interface ChannelSelectorProps {
  activeChannel: OrderSource;
  onSelectChannel: (channel: OrderSource) => void;
}

export const ChannelSelector: React.FC<ChannelSelectorProps> = ({
  activeChannel,
  onSelectChannel,
}) => {
  const channels: Array<{
    key: OrderSource;
    label: string;
    icon: React.ReactNode;
    activeClass: string;
    borderClass: string;
  }> = [
    {
      key: "DINE_IN",
      label: "Dine-In",
      icon: <Utensils className="w-3.5 h-3.5" />,
      activeClass: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
      borderClass: "hover:border-emerald-500/30",
    },
    {
      key: "TAKEAWAY",
      label: "Takeaway",
      icon: <ShoppingBag className="w-3.5 h-3.5" />,
      activeClass: "bg-amber-500/20 text-amber-300 border-amber-500/40",
      borderClass: "hover:border-amber-500/30",
    },
    {
      key: "SWIGGY",
      label: "Swiggy",
      icon: <Bike className="w-3.5 h-3.5" />,
      activeClass: "bg-orange-500/20 text-orange-300 border-orange-500/40",
      borderClass: "hover:border-orange-500/30",
    },
    {
      key: "ZOMATO",
      label: "Zomato",
      icon: <Bike className="w-3.5 h-3.5" />,
      activeClass: "bg-rose-500/20 text-rose-300 border-rose-500/40",
      borderClass: "hover:border-rose-500/30",
    },
  ];

  return (
    <div className="flex items-center gap-1.5 bg-zinc-950 p-1 rounded-xl border border-zinc-800">
      {channels.map((ch) => {
        const isActive = activeChannel === ch.key;
        return (
          <button
            key={ch.key}
            onClick={() => onSelectChannel(ch.key)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
              isActive
                ? `${ch.activeClass} shadow-sm`
                : `bg-transparent text-zinc-400 border-transparent hover:text-zinc-200 ${ch.borderClass}`
            }`}
          >
            {ch.icon}
            <span>{ch.label}</span>
          </button>
        );
      })}
    </div>
  );
};
