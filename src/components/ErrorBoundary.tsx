import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  componentStack?: string | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    componentStack: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, componentStack: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
    this.setState({
      error,
      componentStack: errorInfo?.componentStack || null,
    });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = "/";
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="grid min-h-screen place-items-center bg-gradient-warm px-6 text-center py-10">
          <div className="max-w-2xl w-full rounded-3xl bg-card p-8 shadow-soft ring-1 ring-border/60">
            <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-destructive/10 text-destructive mb-6" aria-hidden>
              <span className="text-3xl">⚠️</span>
            </span>
            <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">Something went wrong</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              An unexpected error occurred. You can try reloading the application or returning to the home screen.
            </p>

            {/* DEBUG DIAGNOSTIC PANEL */}
            <div className="mt-6 p-4 rounded-2xl bg-destructive/10 border border-destructive/30 text-left text-xs font-mono overflow-auto max-h-96">
              <div className="font-extrabold text-destructive uppercase tracking-wider mb-2 text-sm">
                DEBUG - Counter Runtime Error
              </div>
              <div className="text-foreground">
                <strong>ERROR NAME:</strong> {this.state.error?.name || "UnknownError"}
              </div>
              <div className="mt-1 text-foreground">
                <strong>ERROR MESSAGE:</strong> {this.state.error?.message || "No message available"}
              </div>
              {this.state.error?.stack && (
                <div className="mt-3">
                  <strong className="text-foreground">STACK:</strong>
                  <pre className="whitespace-pre-wrap text-[10px] mt-1 text-muted-foreground bg-background/50 p-2.5 rounded-lg border border-border/40">
                    {this.state.error.stack}
                  </pre>
                </div>
              )}
              {this.state.componentStack && (
                <div className="mt-3">
                  <strong className="text-foreground">COMPONENT STACK:</strong>
                  <pre className="whitespace-pre-wrap text-[10px] mt-1 text-muted-foreground bg-background/50 p-2.5 rounded-lg border border-border/40">
                    {this.state.componentStack}
                  </pre>
                </div>
              )}
            </div>

            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <button
                onClick={this.handleReload}
                className="flex-1 rounded-full btn-primary-action px-6 py-3 text-sm font-semibold"
              >
                Reload Application
              </button>
              <button
                onClick={this.handleGoHome}
                className="flex-1 rounded-full bg-secondary px-6 py-3 text-sm font-semibold text-secondary-foreground shadow-soft transition hover:bg-secondary/80 active:scale-[0.99]"
              >
                Return to Home
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
