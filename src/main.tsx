import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { ErrorBoundary } from "./components/ErrorBoundary";
import "./index.css";

try {
  console.log("STEP 1: main.tsx starting");
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
