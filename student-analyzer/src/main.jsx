import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import ErrorBoundary from "./components/ErrorBoundary";
import App from "./App";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ErrorBoundary title="Kelzo failed to start" description="Please refresh the page. If this keeps happening, contact support.">
      <App />
    </ErrorBoundary>
  </StrictMode>
);
