import { useEffect, useState } from "react";
import { Star, Check, ExternalLink, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { supabase, type Cafe } from "@/lib/db";
import { getSessionId } from "@/lib/session";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/sonner";
import { APP_CONFIG } from "@/config/app";

export function ReviewForm({ cafe, orderId, onComplete }: { cafe: Cafe; orderId: string; onComplete: () => void }) {
  const storageKey = `review-sent:${orderId}`;
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && localStorage.getItem(storageKey)) {
      setSent(true);
    }
  }, [storageKey]);

  const submit = async () => {
    if (rating < 1) {
      toast.error("Please pick a rating");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.from("reviews").insert({
        cafe_id: cafe.id,
        order_id: orderId,
        session_id: getSessionId(),
        rating,
        comment: comment.trim() || null,
      });
      if (error) throw error;
      localStorage.setItem(storageKey, "1");
      setSent(true);
      toast.success("Thanks for the feedback!");
      onComplete();
    } catch (e) {
      console.error(e);
      toast.error("Couldn't send review — please try again.");
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <section className="mx-4 mt-6 rounded-3xl bg-card p-5 shadow-soft ring-1 ring-border/60">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-success text-success-foreground">
              <Check className="h-5 w-5" />
            </span>
            <div>
              <div className="font-display text-base font-semibold">Thanks for the review</div>
              <div className="text-xs text-muted-foreground">We appreciate your feedback.</div>
            </div>
          </div>
          {cafe.google_maps_review_url && (
            <div className="border-t border-border/60 pt-3">
              <p className="text-xs text-muted-foreground mb-2">Mind sharing it on Google too?</p>
              <a
                href={cafe.google_maps_review_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 rounded-full border border-border bg-background px-4 py-2.5 text-xs font-semibold text-foreground transition hover:bg-secondary"
              >
                <ExternalLink className="h-3.5 w-3.5" /> Write a Google Review
              </a>
            </div>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="mx-4 mt-6 rounded-3xl bg-card p-5 shadow-soft ring-1 ring-border/60">
      <div className="mb-4 flex items-center gap-2 rounded-2xl bg-secondary/40 p-3.5 text-xs text-foreground font-medium">
        <Sparkles className="h-4 w-4 shrink-0 text-accent animate-pulse" />
        <span>Thank you for dining with us! We hope you enjoyed your meal.</span>
      </div>

      <h2 className="font-display text-lg font-semibold">How was it?</h2>
      <p className="mt-1 text-xs text-muted-foreground">A quick tap helps {cafe.name} improve.</p>

      <div className="mt-4 flex items-center gap-1" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((i) => {
          const filled = (hover || rating) >= i;
          return (
            <motion.button
              key={i}
              type="button"
              whileTap={{ scale: 0.85 }}
              onMouseEnter={() => setHover(i)}
              onClick={() => setRating(i)}
              aria-label={`${i} star${i > 1 ? "s" : ""}`}
              className="p-1"
            >
              <Star
                className={cn(
                  "h-8 w-8 transition-colors",
                  filled ? "fill-accent text-accent" : "text-muted-foreground",
                )}
              />
            </motion.button>
          );
        })}
      </div>

      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value.slice(0, 500))}
        rows={3}
        placeholder="Tell us more (optional)"
        maxLength={500}
        className="mt-4 w-full resize-none rounded-2xl border border-border bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-ring/60"
      />
      <div className="mt-1 flex justify-end">
        <span className={`text-xs tabular-nums ${comment.length >= 500 ? 'text-destructive font-semibold' : 'text-muted-foreground'}`}>
          {comment.length} / 500
        </span>
      </div>

      <div className="mt-3 space-y-2">
        <button
          onClick={submit}
          disabled={busy || rating < 1}
          className="w-full rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-soft disabled:opacity-60"
        >
          {busy ? "Sending…" : "Submit review"}
        </button>

        <button
          type="button"
          onClick={onComplete}
          className="w-full rounded-full bg-secondary px-6 py-3 text-sm font-semibold text-secondary-foreground shadow-soft transition hover:bg-secondary/80"
        >
          Skip
        </button>

        {cafe.google_maps_review_url && (
          <a
            href={cafe.google_maps_review_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-full items-center justify-center gap-2 rounded-full border border-border bg-background px-6 py-3 text-sm font-semibold text-foreground transition hover:bg-secondary"
          >
            <ExternalLink className="h-4 w-4" /> Write a Google Review
          </a>
        )}
      </div>
    </section>
  );
}
