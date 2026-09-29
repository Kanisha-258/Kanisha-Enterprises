import { Navigate, useLocation } from "react-router-dom";
import useAuthStore, { selectIsAdmin } from "../store/authStore";

/**
 * Guards the admin area. Requires both a session and the admin role — the
 * API enforces this too, but blocking it here avoids showing a shell that
 * would immediately fail every request.
 */
export default function AdminRoute({ children }) {
  const token = useAuthStore((s) => s.token);
  const isAdmin = useAuthStore(selectIsAdmin);
  const location = useLocation();

  if (!token) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
