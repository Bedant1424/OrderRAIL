import { ShoppingBag } from "lucide-react";

interface EmptyStateProps {
  title?: string;
  description?: string;
}

export function EmptyState({
  title = "No active selection",
  description = "Select a table from the left grid or create a new takeaway order.",
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground rounded-2xl border border-dashed border-border/80 bg-muted/20">
      <div className="grid h-12 w-12 place-items-center rounded-2xl bg-muted text-muted-foreground mb-3">
        <ShoppingBag className="h-6 w-6" />
      </div>
      <h3 className="font-display text-sm font-semibold text-foreground mb-1">{title}</h3>
      <p className="text-xs text-muted-foreground max-w-xs">{description}</p>
    </div>
  );
}
