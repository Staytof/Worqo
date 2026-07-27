import { Navigate } from "react-router";

export function AdminRouteRedirect() {
  return <Navigate to="/admin" replace />;
}
