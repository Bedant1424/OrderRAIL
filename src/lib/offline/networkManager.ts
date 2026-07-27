import { useState, useEffect } from "react";
import type { ConnectionState, NetworkState } from "./types";
import { OfflineEventBus } from "./events";

class NetworkManagerClass {
  private forcedOffline: boolean = false;
  private isCurrentlyOnline: boolean = true;
  private listeners: Set<(state: NetworkState) => void> = new Set();

  constructor() {
    if (typeof window !== "undefined") {
      this.isCurrentlyOnline = window.navigator?.onLine ?? true;
      window.addEventListener("online", () => this.handleNetworkEvent());
      window.addEventListener("offline", () => this.handleNetworkEvent());
    }
  }

  public isOnline(): boolean {
    if (this.forcedOffline) return false;
    if (typeof navigator !== "undefined" && "onLine" in navigator) {
      return navigator.onLine;
    }
    return true;
  }

  public isForcedOffline(): boolean {
    return this.forcedOffline;
  }

  public getConnectionState(): ConnectionState {
    if (this.forcedOffline) return "offline";
    return this.isOnline() ? "online" : "offline";
  }

  public forceOffline(): void {
    this.forcedOffline = true;
    this.handleNetworkEvent();
  }

  public forceOnline(): void {
    this.forcedOffline = false;
    this.handleNetworkEvent();
  }

  public resetForceOverride(): void {
    this.forcedOffline = false;
    this.handleNetworkEvent();
  }

  public getState(): NetworkState {
    return {
      isOnline: this.isOnline(),
      isForcedOffline: this.forcedOffline,
      connectionState: this.getConnectionState(),
    };
  }

  public subscribe(listener: (state: NetworkState) => void): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private handleNetworkEvent(): void {
    const nextOnline = this.isOnline();
    const wasOnline = this.isCurrentlyOnline;
    this.isCurrentlyOnline = nextOnline;

    const state = this.getState();
    for (const listener of Array.from(this.listeners)) {
      listener(state);
    }

    // Emit event strictly on state transitions
    if (!wasOnline && nextOnline) {
      OfflineEventBus.emit("NetworkConnected", undefined);
    } else if (wasOnline && !nextOnline) {
      OfflineEventBus.emit("NetworkDisconnected", undefined);
    }
  }
}

export const NetworkManager = new NetworkManagerClass();

export function useNetworkState(): NetworkState {
  const [state, setState] = useState<NetworkState>(() => NetworkManager.getState());

  useEffect(() => {
    return NetworkManager.subscribe((newState) => {
      setState(newState);
    });
  }, []);

  return state;
}
