export default function RouteLoadingFallback() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-background text-foreground">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-3 border-accent border-t-transparent" />
        <span className="font-display text-xs font-semibold tracking-wider text-muted-foreground uppercase">
          Loading...
        </span>
      </div>
    </div>
  );
}
