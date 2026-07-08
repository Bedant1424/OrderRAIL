import { useQuery } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { supabase, type Cafe } from "@/lib/db";
import { cn } from "@/lib/utils";

import { useCafe } from "@/lib/cafe";
import { GlobalNotificationControls } from "@/components/owner/GlobalNotificationControls";

type Review = {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  order_id: string | null;
};

export default function OwnerReviewsPage() {
  const { cafe } = useCafe();

  const q = useQuery({
    queryKey: ["owner-reviews", cafe?.id],
    enabled: !!cafe?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("reviews")
        .select("id, rating, comment, created_at, order_id")
        .eq("cafe_id", cafe!.id)
        .order("created_at", { ascending: false })
        .limit(100);
      return (data ?? []) as Review[];
    },
  });

  const reviews = q.data ?? [];
  const avg = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;

  return (
    <div className="space-y-8 overflow-x-hidden min-w-0">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Reviews</h1>
          <p className="mt-1 text-sm text-muted-foreground">Feedback from customers who scanned & ordered.</p>
        </div>
        <GlobalNotificationControls />
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl bg-card p-4 shadow-soft ring-1 ring-border/60">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Average</div>
          <div className="mt-2 flex items-baseline gap-1 font-display text-3xl font-semibold">
            {avg.toFixed(1)}
            <Star className="h-4 w-4 fill-accent text-accent" />
          </div>
        </div>
        <div className="rounded-2xl bg-card p-4 shadow-soft ring-1 ring-border/60">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Reviews</div>
          <div className="mt-2 font-display text-3xl font-semibold tabular-nums">{reviews.length}</div>
        </div>
      </section>

      <ul className="space-y-3">
        {reviews.length === 0 && (
          <li className="rounded-3xl border border-dashed border-border bg-card/60 p-10 text-center text-sm text-muted-foreground">
            No reviews yet.
          </li>
        )}
        {reviews.map((r) => (
          <li key={r.id} className="rounded-2xl bg-card p-4 shadow-soft ring-1 ring-border/60 min-w-0 overflow-hidden">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Star
                    key={i}
                    className={cn("h-4 w-4", i <= r.rating ? "fill-accent text-accent" : "text-muted")}
                  />
                ))}
              </div>
              <span className="text-xs text-muted-foreground">
                {new Date(r.created_at).toLocaleDateString()}
              </span>
            </div>
            {r.comment ? (
              <p className="mt-2 text-sm" style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}>{r.comment}</p>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">No comment.</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
