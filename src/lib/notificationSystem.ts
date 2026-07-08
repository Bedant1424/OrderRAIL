// Premium Staff Notification Coordinator for sound, vibration, and visual queuing

interface NotificationTask {
  id: string;
  orderId?: string;
  type: "new" | "updated" | "sr" | "cancelled";
  title: string;
  body: string;
  vibratePattern: number | number[];
}

interface NotificationSettings {
  sound: boolean;
  vibration: boolean;
  flashCards: boolean;
}

const SETTINGS_KEY = "orderrail.staff.notification_settings";

let currentSettings: NotificationSettings = {
  sound: true,
  vibration: true,
  flashCards: true,
};

let audioCtx: AudioContext | null = null;
const queue: NotificationTask[] = [];
let processing = false;

let originalTitle = typeof document !== "undefined" ? document.title : "OrderRail";
let pendingNotificationCount = 0;

const recentNotifications = new Map<string, number>(); // key: `orderId:type` or `type`, value: timestamp

// Module-level early activation to catch the first user interaction
if (typeof window !== "undefined") {
  const earlyInit = () => {
    initAudio();
    try {
      if (audioCtx && audioCtx.state === "suspended") {
        void audioCtx.resume();
      }
    } catch {}
    window.removeEventListener("click", earlyInit, true);
    window.removeEventListener("touchstart", earlyInit, true);
    window.removeEventListener("keydown", earlyInit, true);
  };
  window.addEventListener("click", earlyInit, true);
  window.addEventListener("touchstart", earlyInit, true);
  window.addEventListener("keydown", earlyInit, true);
}

/**
 * Initialize AudioContext on first user interaction to satisfy autoplay policies
 */
export function initAudio() {
  if (audioCtx) {
    if (audioCtx.state === "suspended") {
      void audioCtx.resume();
    }
    return;
  }
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
      if (audioCtx.state === "suspended") {
        void audioCtx.resume();
      }
    }
  } catch (e) {
    console.warn("Could not create AudioContext:", e);
  }
}

/**
 * Load settings from localStorage
 */
export function loadNotificationSettings(): NotificationSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      currentSettings = { ...currentSettings, ...JSON.parse(raw) };
    }
  } catch {
    // fallback to defaults
  }
  return currentSettings;
}

/**
 * Save settings to localStorage
 */
export function saveNotificationSettings(settings: Partial<NotificationSettings>) {
  currentSettings = { ...currentSettings, ...settings };
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(currentSettings));
  } catch {
    // ignore
  }
}

/**
 * Get current settings state
 */
export function getNotificationSetting(key: keyof NotificationSettings): boolean {
  return currentSettings[key];
}

/**
 * Play a premium double-frequency synthesized chime
 */
function playChime() {
  try {
    console.log("[NOTIFY] playChime invoked");
    if (!audioCtx) {
      initAudio();
    }
    if (!audioCtx) return;

    const playNodeChimes = () => {
      const now = audioCtx!.currentTime;

      // Chime 1 (Primary warm tone)
      const osc1 = audioCtx!.createOscillator();
      const gain1 = audioCtx!.createGain();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(880, now); // A5
      osc1.frequency.exponentialRampToValueAtTime(1174.66, now + 0.08); // slide to D6

      gain1.gain.setValueAtTime(0.001, now);
      gain1.gain.linearRampToValueAtTime(0.12, now + 0.03);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc1.connect(gain1);
      gain1.connect(audioCtx!.destination);
      osc1.start(now);
      osc1.stop(now + 0.35);

      // Chime 2 (Harmony, slightly delayed)
      const osc2 = audioCtx!.createOscillator();
      const gain2 = audioCtx!.createGain();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(1396.91, now + 0.06); // F6

      gain2.gain.setValueAtTime(0.001, now + 0.06);
      gain2.gain.linearRampToValueAtTime(0.08, now + 0.09);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

      osc2.connect(gain2);
      gain2.connect(audioCtx!.destination);
      osc2.start(now + 0.06);
      osc2.stop(now + 0.5);
    };

    if (audioCtx.state === "suspended") {
      audioCtx.resume().then(playNodeChimes).catch((e) => {
        console.warn("Failed to resume AudioContext in playChime:", e);
      });
    } else {
      playNodeChimes();
    }
  } catch (e) {
    console.warn("Chime generation failed:", e);
  }
}

/**
 * Trigger vibration pattern safely
 */
function triggerVibration(pattern: number | number[]) {
  try {
    console.log("[NOTIFY] triggerVibration invoked with pattern:", JSON.stringify(pattern));
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate(pattern);
    }
  } catch (e) {
    console.warn("Vibration API failed:", e);
  }
}

/**
 * Update document title if browser is hidden
 */
function updateDocumentTitle(titleText: string) {
  if (typeof document === "undefined") return;
  pendingNotificationCount++;
  document.title = `(${pendingNotificationCount}) ${titleText} • OrderRail`;
  console.log("[NOTIFY] updateDocumentTitle invoked, title set to:", document.title);
}

/**
 * Reset document title and counter
 */
export function resetNotificationTitle() {
  if (typeof document === "undefined") return;
  pendingNotificationCount = 0;
  document.title = originalTitle;
}

/**
 * Initialize system-wide visibility listeners and audio handlers
 */
export function initNotificationSystem() {
  if (typeof window === "undefined") return;
  originalTitle = document.title;

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      resetNotificationTitle();
      if (audioCtx && audioCtx.state === "suspended") {
        void audioCtx.resume();
      }
    }
  });

  window.addEventListener("focus", () => {
    if (audioCtx && audioCtx.state === "suspended") {
      void audioCtx.resume();
    }
  });

  const initOnInteraction = () => {
    initAudio();
    try {
      if (audioCtx && audioCtx.state === "suspended") {
        void audioCtx.resume();
      }
    } catch {}
    window.removeEventListener("click", initOnInteraction, true);
    window.removeEventListener("touchstart", initOnInteraction, true);
    window.removeEventListener("keydown", initOnInteraction, true);
  };
  window.addEventListener("click", initOnInteraction, true);
  window.addEventListener("touchstart", initOnInteraction, true);
  window.addEventListener("keydown", initOnInteraction, true);

  loadNotificationSettings();
}

/**
 * Queue loop to process notifications sequentially
 */
async function processQueue() {
  if (processing) return;
  processing = true;

  while (queue.length > 0) {
    const task = queue.shift()!;

    // Play chime sound if enabled
    if (currentSettings.sound) {
      playChime();
    }

    // Trigger vibration pattern if enabled
    if (currentSettings.vibration) {
      triggerVibration(task.vibratePattern);
    }

    // Modify document title if page is hidden
    if (typeof document !== "undefined" && document.hidden) {
      updateDocumentTitle(task.title);
    }

    // Minimum delay of 1.2 seconds between notifications to keep it premium and non-overlapping
    await new Promise((r) => setTimeout(r, 1200));
  }

  processing = false;
}

/**
 * Enqueue a notification task
 */
export function triggerNotification(task: Omit<NotificationTask, "id">): boolean {
  const now = Date.now();

  // Avoid duplicate notifications for the same order/event within 5 seconds
  if (task.orderId) {
    const dupeKey = `${task.orderId}:${task.type}`;
    const lastTime = recentNotifications.get(dupeKey);
    if (lastTime && now - lastTime < 5000) {
      return false; // Ignore duplicate
    }
    recentNotifications.set(dupeKey, now);
  }

  const fullTask: NotificationTask = {
    ...task,
    id: Math.random().toString(36).substring(2),
  };

  queue.push(fullTask);
  void processQueue();
  return true;
}
