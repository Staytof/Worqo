import { createElement } from "react";
import { createBrowserRouter, Navigate } from "react-router";
import { AppShell } from "./components/AppShell";
import { AdminRouteRedirect } from "./components/AdminRouteRedirect";
import { AdminPanel } from "./components/AdminPanel";
import { AuthLayout } from "./components/AuthLayout";
import { ChatList } from "./components/ChatList";
import { ClientOrders } from "./components/ClientOrders";
import { Home } from "./components/Home";
import { LegalPage } from "./components/LegalPage";
import { Login } from "./components/Login";
import { Notifications } from "./components/Notifications";
import { Profile } from "./components/Profile";
import { ProfileAccount } from "./components/ProfileAccount";
import { ProfileLegal } from "./components/ProfileLegal";
import { ProfileSetup } from "./components/ProfileSetup";
import { ProfileSupport } from "./components/ProfileSupport";
import { Register } from "./components/Register";
import { RouteErrorScreen } from "./components/RouteErrorScreen";
import { ServiceDetails } from "./components/service/ServiceDetails";
import { ServicePayment } from "./components/service/ServicePayment";
import { ServiceRequestStatus } from "./components/service/ServiceRequestStatus";
import { ServiceWaiting } from "./components/service/ServiceWaiting";
import { Verify } from "./components/Verify";
import { Wallet } from "./components/Wallet";

export const router = createBrowserRouter([
  {
    path: "/legal",
    Component: LegalPage,
    errorElement: createElement(RouteErrorScreen),
  },
  {
    path: "/",
    Component: AuthLayout,
    errorElement: createElement(RouteErrorScreen),
    children: [
      { index: true, Component: Login },
      { path: "register", Component: Register },
      { path: "verify", Component: Verify },
      { path: "profile-setup", Component: ProfileSetup },
    ],
  },
  {
    path: "/admin",
    Component: AdminPanel,
    errorElement: createElement(RouteErrorScreen),
  },
  {
    path: "/app",
    Component: AppShell,
    errorElement: createElement(RouteErrorScreen),
    children: [
      { index: true, Component: Home },
      { path: "mural", element: createElement(Navigate, { to: "/app/chat", replace: true }) },
      { path: "chat", Component: ChatList },
      { path: "orders", Component: ClientOrders },
      { path: "notifications", Component: Notifications },
      { path: "profile", Component: Profile },
      { path: "wallet", Component: Wallet },
      { path: "admin", Component: AdminRouteRedirect },
      { path: "profile/data", Component: ProfileAccount },
      { path: "profile/legal", Component: ProfileLegal },
      { path: "profile/support", Component: ProfileSupport },
      { path: "service/details", Component: ServiceDetails },
      { path: "service/request", Component: ServiceRequestStatus },
      { path: "service/waiting", Component: ServiceWaiting },
      { path: "service/payment", Component: ServicePayment },
    ],
  },
]);
