# Scroll Execution Timeline Report

This document reports the scroll execution mechanics for each of the four realtime events in the Staff Dashboard: **New Order**, **Updated Order**, **Cancelled Order**, and **Service Request**.

---

## 1. New Order (INSERT event on `orders`)

### Every Function Calling Scroll
1. `el.scrollIntoView({ behavior: "smooth", block: "center" })` called inline in the `runScroll` callback inside `executeScroll`.

### Exact Execution Order & Timeline
* **T = 0ms**: Realtime insert event received. `qc.invalidateQueries({ queryKey: ["staff-orders"] })` starts an asynchronous database query.
* **T = 0ms**: A `setTimeout` is registered with a `1000ms` delay.
* **T = 1000ms**: The timeout fires. 
  * Resolves card element `order-card-${newOrder.id}`.
  * Calls `executeScroll(newOrder.id, ...)`.
  * Triggers `el.scrollIntoView({ behavior: "smooth", block: "center" })`.

### Multiple Scroll Calls?
* **No**. Only one scroll call is triggered.

### Scroll Call Executing Last
* The single `el.scrollIntoView({ behavior: "smooth", block: "center" })` at `T = 1000ms`.

### Overrides?
* **No**. No other scrolls are pending.

### React Query Invalidation Impact
* The invalidation itself does not trigger scrolling. The scroll is triggered by the single `setTimeout` registered in the websocket callback. The 1000ms delay gives the invalidation time to finish rendering before targeting the card.

---

## 2. Updated Order (UPDATE event on `orders` — Case B)

### Every Function Calling Scroll
1. `el.scrollIntoView({ behavior: "smooth", block: "center" })` called inline in the `runScroll` callback inside `executeScroll`.

### Exact Execution Order & Timeline
* **T = 0ms**: Realtime update event received. `qc.invalidateQueries({ queryKey: ["staff-orders"] })` starts an asynchronous query.
* **T = 0ms**: A `setTimeout` is registered with a `1000ms` delay.
* **T = 1000ms**: The timeout fires.
  * Resolves card element `order-card-${newOrder.id}`.
  * Calls `executeScroll(newOrder.id, ...)`.
  * Triggers `el.scrollIntoView({ behavior: "smooth", block: "center" })`.

### Multiple Scroll Calls?
* **No**. Only one scroll call is triggered.

### Scroll Call Executing Last
* The single `el.scrollIntoView({ behavior: "smooth", block: "center" })` at `T = 1000ms`.

### Overrides?
* **No**. No other scrolls are pending.

### React Query Invalidation Impact
* The invalidation itself does not trigger additional scrolling. The 1000ms timer gives the query time to complete before targeting the card.

---

## 3. Cancelled Order (UPDATE event on `orders` — Case A)

### Every Function Calling Scroll
1. **First Call**: `el.scrollIntoView({ behavior: "smooth", block: "center" })` at `T = 100ms` (Pre-transition scroll).
2. **Second Call**: `el.scrollIntoView({ behavior: "smooth", block: "center" })` at `T = 1200ms` (Post-transition scroll).

### Exact Execution Order & Timeline
* **T = 0ms**: Realtime update event received. `qc.invalidateQueries({ queryKey: ["staff-orders"] })` starts query invalidation.
* **T = 0ms**: Two `setTimeout` timers are registered (one at `100ms`, one at `1200ms`).
* **T = 100ms**: **Timer 1 fires**.
  * Resolves card element `order-card-${newOrder.id}`.
  * Calls `executeScroll(newOrder.id + "-cancel-pre", ...)`.
  * Executes the **first** scroll: `el.scrollIntoView({ behavior: "smooth", block: "center" })`.
* **T = ~300ms - 800ms**: The query invalidation query resolves. React updates state and moves the card to the "Recently done" column.
* **T = 1200ms**: **Timer 2 fires**.
  * Resolves card element `order-card-${newOrder.id}`.
  * Calls `executeScroll(newOrder.id + "-cancel-post", ...)`.
  * Executes the **second** scroll: `el.scrollIntoView({ behavior: "smooth", block: "center" })`.

### Multiple Scroll Calls?
* **Yes**. Two scroll calls are executed.

### Scroll Call Executing Last
* The second scroll call (Timer 2 at `T = 1200ms`).

### Overrides?
* **Yes**. The second smooth scroll at `1200ms` interrupts and overrides the first smooth scroll from `100ms`.

### React Query Invalidation Impact
* The invalidation itself does not trigger scrolling, but the delay between Timer 1 and Timer 2 allows the invalidation to finish moving the card's position in the DOM.

---

## 4. Service Request (INSERT event on `service_requests`)

### Every Function Calling Scroll
1. **First Call**: `targetEl.scrollIntoView({ behavior: "smooth", block: "center" })` inside `scrollToVertical`.
2. **Second Call**: `targetEl.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" })` inside `scrollToHorizontal`.

### Exact Execution Order & Timeline
* **T = 0ms**: Realtime insert event received. `qc.invalidateQueries({ queryKey: ["staff-sr"] })` starts query invalidation.
* **T = 0ms**: `pendingScrollRequestIdRef.current` is set to the request ID.
* **T = ~300ms - 600ms**: The query invalidation query completes. `srQ.data` updates, triggering the component to render and mount the new card.
* **T = ~600ms**: The `useEffect` hook dependency on `srQ.data` triggers.
  * Finds the new card `sr-card-${pendingId}`.
  * Calls `executeScroll(pendingId, ...)`.
  * Triggers **vertical scroll** (`scrollToVertical`): `section.scrollIntoView({ behavior: "smooth", block: "center" })`.
* **T = ~600ms + vertical scroll duration (approx. 500ms - 1000ms)**: The window `'scrollend'` event (or fallback debounce) fires, indicating the vertical scroll is complete.
  * Triggers **horizontal scroll** (`scrollToHorizontal`): `cardEl.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" })`.
* **T = ~horizontal scroll completion**: The container `'scrollend'` event fires, and the card's blue flash animation triggers.

### Multiple Scroll Calls?
* **Yes**. Two scroll calls are executed sequentially.

### Scroll Call Executing Last
* The horizontal scroll targeting the card (`cardEl.scrollIntoView({ inline: "center" })`).

### Overrides?
* **No**. Because they are chained sequentially (the horizontal scroll only executes *after* the vertical scroll completes), they do not fight or interrupt each other.

### React Query Invalidation Impact
* **Yes**. The entire scrolling sequence is initiated by the `useEffect` hook reacting to `srQ.data` updates post-invalidation. Without the invalidation completing and mounting the new card, no scroll operations are triggered.
