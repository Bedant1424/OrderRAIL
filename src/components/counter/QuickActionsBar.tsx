export function QuickActionsBar() {
  const shortcuts = [
    { key: "F1", label: "New Takeaway" },
    { key: "F2", label: "Search Menu" },
    { key: "F3", label: "Service Calls (2)" },
    { key: "F4", label: "Switch Mode" },
    { key: "F8", label: "Print Bill" },
    { key: "F10", label: "Pay Cash" },
    { key: "F11", label: "Pay Card" },
  ];

  return (
    <div className="fixed bottom-8 left-0 right-0 z-20 h-9 bg-card/95 backdrop-blur border-t border-border/80 px-4 flex items-center justify-between text-xs font-mono select-none shadow-soft overflow-x-auto no-scrollbar">
      <div className="flex items-center gap-2 min-w-max">
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mr-1">
          QUICK KEYS:
        </span>
        {shortcuts.map((s) => (
          <div
            key={s.key}
            className="flex items-center gap-1 rounded-lg bg-secondary/80 px-2.5 py-1 text-[11px] font-medium border border-border/40 hover:bg-secondary transition cursor-pointer"
          >
            <span className="font-bold text-brand">{s.key}:</span>
            <span className="text-foreground">{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
