import { RotateCw } from "lucide-react";

interface LoadingStateProps {
  message?: string;
}

export function LoadingState({ message = "Loading Counter Workspace..." }: LoadingStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-muted-foreground gap-3">
      <RotateCw className="h-7 w-7 animate-spin text-brand" />
      <span className="text-xs font-semibold">{message}</span>
    </div>
  );
}
