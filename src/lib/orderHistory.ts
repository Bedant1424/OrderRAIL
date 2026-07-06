const HISTORY_KEY = "orderrail.order_history";

export function addOrderToHistory(orderId: string) {
  const history = getOrderHistory();
  if (!history.includes(orderId)) {
    history.push(orderId);
    try {
      sessionStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    } catch (e) {
      console.error("Could not write to sessionStorage", e);
    }
  }
}

export function getOrderHistory(): string[] {
  try {
    const data = sessionStorage.getItem(HISTORY_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error("Could not read from sessionStorage", e);
    return [];
  }
}
