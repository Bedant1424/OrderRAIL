# Notification Architecture Audit

This audit evaluates the existing notification systems and components to determine their readiness for reuse within the Staff Dashboard.

## Audit Table

| Component | Currently Shared? | Reusable? | Needs Changes? |
|---|---|---|---|
| **Shared notification hooks** | ✗ No (Only customer-facing `useOrderNotifications` exists) | ✗ No | Yes, we need a hook or shared context pattern to unify layout notifications for Staff/Owner |
| **Shared notification service** | ✓ Yes (`notificationSystem.ts`) | ✓ Yes | No, `triggerNotification` and `initNotificationSystem` are fully functional and reusable |
| **Shared notification state** | ✗ No (Enclosed in `OwnerLayoutContext`) | ✗ No | Yes, a similar context/state system is needed for `StaffLayout` or a unified layout pattern |
| **Shared notification storage** | ✓ Yes (`notificationHistory.ts`) | ✓ Yes | No, it reads/writes from localStorage under a common key `orderrail.staff.notifications` |
| **Shared sound engine** | ✓ Yes (Web Audio API synth in `playChime`) | ✓ Yes | No, integrated directly within the shared notification service |
| **Shared notification center UI** | ✓ Yes (`NotificationCenter.tsx`) | ✓ Yes | No, the UI component takes simple props and can be rendered anywhere |
| **Shared notification settings** | ✓ Yes (`localStorage` via `notificationSystem.ts`) | ✓ Yes | No, storage utility functions are already shared |

## Analysis of Reuse Strategy

To satisfy the constraint **"Reuse the existing shared notification infrastructure wherever possible"**, we will:
1. Unify the state handling inside `StaffLayout.tsx` similarly to `OwnerLayout.tsx` by setting up context/state.
2. Reuse `notificationHistory.ts` for storage.
3. Reuse `notificationSystem.ts` for audio alarms and rate-limiting.
4. Reuse `NotificationCenter.tsx` inside an `AnchoredPopover` in `StaffLayout.tsx`.
5. Expose the settings drawer/popover inside the staff header.
