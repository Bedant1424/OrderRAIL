import { Plus } from "lucide-react";
import { motion } from "framer-motion";
import type { MenuItem } from "@/lib/db";
import { formatMoney } from "@/lib/db";
import { useCart } from "@/lib/cart";
import { useImageUrl } from "@/lib/useImageUrl";

export function MenuItemCard({ item, currency }: { item: MenuItem; currency: string }) {
  const { add } = useCart();
  const imgUrl = useImageUrl(item.image_url);
  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="group relative flex gap-4 rounded-3xl bg-card p-3 shadow-soft ring-1 ring-border/60"
    >
      {imgUrl ? (
        <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-muted">
          <img
            src={imgUrl}
            alt={item.name}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        </div>
      ) : (
        <div className="h-24 w-24 shrink-0 rounded-2xl bg-gradient-warm" aria-hidden />
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <h3 className="truncate font-display text-lg font-semibold leading-tight">{item.name}</h3>
        {item.description && (
          <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{item.description}</p>
        )}
        <div className="mt-auto flex items-end justify-between pt-2">
          <span className="font-semibold tabular-nums">{formatMoney(item.price_cents, currency)}</span>
          <button
            type="button"
            aria-label={`Add ${item.name}`}
            onClick={() => add({ id: item.id, name: item.name, price_cents: item.price_cents, image_url: item.image_url })}
            className="grid h-10 w-10 place-items-center rounded-full bg-primary text-primary-foreground shadow-soft transition-transform active:scale-90"
          >
            <Plus className="h-5 w-5" strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </motion.article>
  );
}
