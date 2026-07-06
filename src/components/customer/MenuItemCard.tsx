import { Plus } from "lucide-react";
import { motion } from "framer-motion";
import type { MenuItem } from "@/lib/db";
import { formatMoney } from "@/lib/db";
import { useCart } from "@/lib/cart";
import { useImageUrl } from "@/lib/useImageUrl";

import { useState } from "react";

function MenuImage({ src, alt }: { src: string; alt: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  if (error) {
    return (
      <div className="h-24 w-24 shrink-0 rounded-2xl bg-gradient-warm flex flex-col items-center justify-center text-xs text-muted-foreground font-semibold ring-1 ring-border/60">
        <span className="text-xl">☕</span>
        <span className="text-[9px] mt-1 text-muted-foreground/80">No Image</span>
      </div>
    );
  }

  return (
    <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-secondary/35 ring-1 ring-border/60">
      {loading && (
        <div className="absolute inset-0 animate-pulse bg-secondary/70 flex items-center justify-center">
          <span className="text-xs text-muted-foreground/60">Loading…</span>
        </div>
      )}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        onLoad={() => setLoading(false)}
        onError={() => {
          setLoading(false);
          setError(true);
        }}
        className={`h-full w-full object-cover transition-opacity duration-300 group-hover:scale-105 ${
          loading ? "opacity-0" : "opacity-100"
        }`}
      />
    </div>
  );
}

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
        <MenuImage src={imgUrl} alt={item.name} />
      ) : (
        <div className="h-24 w-24 shrink-0 rounded-2xl bg-gradient-warm flex items-center justify-center ring-1 ring-border/60" aria-hidden>
          <span className="text-xl">☕</span>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {item.tags && item.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-1">
            {item.tags.map((tag) => (
              <span
                key={tag}
                className={`rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                  tag === "Bestseller" ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" :
                  tag === "New" ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300" :
                  tag === "Popular" ? "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300" :
                  tag === "Chef's Choice" ? "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300" :
                  tag === "Spicy" ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300" :
                  tag === "Veg" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" :
                  tag === "Non-Veg" ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300" :
                  "bg-secondary text-secondary-foreground"
                }`}
              >
                {tag}
              </span>
            ))}
          </div>
        )}
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
