import { RouterProvider } from "react-router";
import { AppErrorBoundary } from "./components/AppErrorBoundary";
import { SystemStatusBanner } from "./components/SystemStatusBanner";
import { AppProvider } from "./context/AppContext";
import { router } from "./routes";

export default function App() {
  return (
    <AppErrorBoundary>
      <AppProvider>
        <SystemStatusBanner />
        <RouterProvider router={router} />
      </AppProvider>
    </AppErrorBoundary>
  );
}
