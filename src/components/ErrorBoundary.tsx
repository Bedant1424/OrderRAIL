import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(_: Error): State {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
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
        <div className="grid min-h-screen place-items-center bg-gradient-warm px-6 text-center">
          <div className="max-w-md rounded-3xl bg-card p-8 shadow-soft ring-1 ring-border/60">
            <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-destructive/10 text-destructive mb-6" aria-hidden>
              <span className="text-3xl">⚠️</span>
            </span>
            <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">Something went wrong</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              An unexpected error occurred. You can try reloading the application or returning to the home screen.
            </p>
            <div className="mt-6 flex flex-col gap-3">
              <button
                onClick={this.handleReload}
                className="w-full rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-soft transition active:scale-[0.99]"
              >
                Reload Application
              </button>
              <button
                onClick={this.handleGoHome}
                className="w-full rounded-full bg-secondary px-6 py-3 text-sm font-semibold text-secondary-foreground shadow-soft transition hover:bg-secondary/80 active:scale-[0.99]"
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
