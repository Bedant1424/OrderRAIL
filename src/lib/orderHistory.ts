function getStorageKey(tableId?: string, diningSessionId?: string): string {
  if (tableId && diningSessionId) {
    return `orderrail.order_history.${tableId}.${diningSessionId}`;
  }
  return "orderrail.order_history";
}

export function addOrderToHistory(orderId: string, tableId?: string, diningSessionId?: string) {
  const key = getStorageKey(tableId, diningSessionId);
  const history = getOrderHistory(tableId, diningSessionId);
  if (!history.includes(orderId)) {
    history.push(orderId);
    try {
      localStorage.setItem(key, JSON.stringify(history));
      sessionStorage.setItem(key, JSON.stringify(history));
    } catch (e) {
      console.error("Could not write to localStorage/sessionStorage", e);
    }
  }
}

export function getOrderHistory(tableId?: string, diningSessionId?: string): string[] {
  try {
    const key = getStorageKey(tableId, diningSessionId);
    const localData = localStorage.getItem(key);
    const sessionData = sessionStorage.getItem(key);
    const local: string[] = localData ? JSON.parse(localData) : [];
    const session: string[] = sessionData ? JSON.parse(sessionData) : [];

    let fallback: string[] = [];
    if (key !== "orderrail.order_history") {
      const gLocal = localStorage.getItem("orderrail.order_history");
      const gSess = sessionStorage.getItem("orderrail.order_history");
      if (gLocal) fallback.push(...JSON.parse(gLocal));
      if (gSess) fallback.push(...JSON.parse(gSess));
    }

    return Array.from(new Set([...local, ...session, ...fallback]));
  } catch (e) {
    console.error("Could not read from storage", e);
    return [];
  }
}

export function clearOrderHistory(tableId?: string, diningSessionId?: string) {
  try {
    if (tableId && diningSessionId) {
      const targetKey = getStorageKey(tableId, diningSessionId);
      localStorage.removeItem(targetKey);
      sessionStorage.removeItem(targetKey);
    }

    localStorage.removeItem("orderrail.order_history");
    sessionStorage.removeItem("orderrail.order_history");

    if (tableId) {
      const prefix = `orderrail.order_history.${tableId}.`;
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (k && k.startsWith(prefix) && (!diningSessionId || !k.endsWith(`.${diningSessionId}`))) {
          localStorage.removeItem(k);
        }
      }
      for (let i = sessionStorage.length - 1; i >= 0; i--) {
        const k = sessionStorage.key(i);
        if (k && k.startsWith(prefix) && (!diningSessionId || !k.endsWith(`.${diningSessionId}`))) {
          sessionStorage.removeItem(k);
        }
      }
    }
  } catch (e) {
    console.error("Could not clear order history storage", e);
  }
}
