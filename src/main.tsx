import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { ErrorBoundary } from "./components/ErrorBoundary";
import "./index.css";

try {
  console.log("STEP 1: main.tsx starting");

  // ── Deployment verification (dev only) ──────────────────────────
  // Logs the build-time value of VITE_DEMO_MODE so you can confirm
  // the correct environment was compiled into this bundle.
  // Safe to remove once deployment configuration is verified.
  if (import.meta.env.DEV) {
    console.info(
      `[env] VITE_DEMO_MODE = "${import.meta.env.VITE_DEMO_MODE}" → demo deployment: ${import.meta.env.VITE_DEMO_MODE === "true"}`
    );
  }
  const rootEl = document.getElementById("root");
  console.log("STEP 2: root element found:", !!rootEl);
  const root = createRoot(rootEl!);
  console.log("STEP 3: root created");
  root.render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
  console.log("STEP 4: root.render called");
} catch (e) {
  console.error("MAIN FAILED", e);
}
