const HISTORY_KEY = "orderrail.order_history";

export function addOrderToHistory(orderId: string) {
  const history = getOrderHistory();
  if (!history.includes(orderId)) {
    history.push(orderId);
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
      sessionStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    } catch (e) {
      console.error("Could not write to localStorage/sessionStorage", e);
    }
  }
}

export function getOrderHistory(): string[] {
  try {
    const localData = localStorage.getItem(HISTORY_KEY);
    const sessionData = sessionStorage.getItem(HISTORY_KEY);
    const local: string[] = localData ? JSON.parse(localData) : [];
    const session: string[] = sessionData ? JSON.parse(sessionData) : [];
    return Array.from(new Set([...local, ...session]));
  } catch (e) {
    console.error("Could not read from storage", e);
    return [];
  }
}

export function clearOrderHistory() {
  try {
    localStorage.removeItem(HISTORY_KEY);
    sessionStorage.removeItem(HISTORY_KEY);
  } catch (e) {
    console.error("Could not clear order history storage", e);
  }
}
