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
      <section className="mx-4 mt-6 rounded-3xl bg-cc-surface p-5 shadow-xs border border-cc-border">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-cc-success text-white">
              <Check className="h-5 w-5" strokeWidth={2.2} />
            </span>
            <div>
              <div className="font-display text-base font-semibold text-cc-text">Thanks for the review</div>
              <div className="text-xs text-cc-text-muted">We appreciate your feedback.</div>
            </div>
          </div>
          {cafe.google_maps_review_url && (
            <div className="border-t border-cc-border pt-3">
              <p className="text-xs text-cc-text-muted mb-2">Mind sharing it on Google too?</p>
              <a
                href={cafe.google_maps_review_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 rounded-full border border-cc-border bg-cc-surface px-4 py-2.5 text-xs font-semibold text-cc-text transition hover:bg-cc-surface-soft"
              >
                <ExternalLink className="h-3.5 w-3.5" strokeWidth={2.2} /> Write a Google Review
              </a>
            </div>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="mx-4 mt-6 rounded-3xl bg-cc-surface p-5 shadow-xs border border-cc-border">
      <div className="mb-4 flex items-center gap-2 rounded-2xl bg-cc-surface-soft p-3.5 text-xs text-cc-text font-medium">
        <Sparkles className="h-4 w-4 shrink-0 text-cc-accent animate-pulse" strokeWidth={2.2} />
        <span>Thank you for dining with us! We hope you enjoyed your meal.</span>
      </div>

      <h2 className="font-display text-lg font-extrabold text-cc-text">How was it?</h2>
      <p className="mt-1 text-xs font-medium text-cc-text-muted">A quick tap helps {cafe.name} improve.</p>

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
                  filled ? "fill-cc-accent text-cc-accent" : "text-cc-text-muted/40",
                )}
                strokeWidth={2.2}
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
        className="mt-4 w-full resize-none rounded-2xl border border-cc-border bg-cc-surface p-3 text-xs font-medium text-cc-text placeholder:text-cc-text-muted outline-none focus:border-cc-primary focus:ring-2 focus:ring-cc-primary/20 font-sans"
      />
      <div className="mt-1 flex justify-end">
        <span className={`text-xs tabular-nums ${comment.length >= 500 ? 'text-cc-danger font-semibold' : 'text-cc-text-muted'}`}>
          {comment.length} / 500
        </span>
      </div>

      <div className="mt-3 space-y-2">
        <button
          onClick={submit}
          disabled={busy || rating < 1}
          className="w-full rounded-full bg-cc-primary text-white hover:bg-cc-primary-hover px-6 py-3 text-sm font-bold shadow-md transition disabled:opacity-50"
        >
          {busy ? "Sending…" : "Submit review"}
        </button>

        <button
          type="button"
          onClick={onComplete}
          className="w-full rounded-full bg-cc-surface-soft border border-cc-border px-6 py-3 text-sm font-semibold text-cc-text transition hover:bg-cc-surface"
        >
          Skip
        </button>

        {cafe.google_maps_review_url && (
          <a
            href={cafe.google_maps_review_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-full items-center justify-center gap-2 rounded-full border border-cc-border bg-cc-surface px-6 py-3 text-sm font-semibold text-cc-text transition hover:bg-cc-surface-soft"
          >
            <ExternalLink className="h-3.5 w-3.5" strokeWidth={2.2} /> Write a Google Review
          </a>
        )}
      </div>
    </section>
  );
}
