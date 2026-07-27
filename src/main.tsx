
import { createRoot } from "react-dom/client";
import App from "./app/App.tsx";
import { registerGlobalClientErrorMonitoring } from "./app/lib/monitoring";
import { applyThemePreference, readThemePreference } from "./app/lib/theme";
import "./styles/index.css";

registerGlobalClientErrorMonitoring();
applyThemePreference(readThemePreference());

createRoot(document.getElementById("root")!).render(<App />);
  
