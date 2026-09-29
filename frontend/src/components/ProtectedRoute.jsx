import { Navigate, useLocation } from "react-router-dom";
import useAuthStore from "../store/authStore";

/**
 * Sends visitors to /login unless there's a session, remembering where they
 * were headed so login can send them back there.
 */
export default function ProtectedRoute({ children }) {
  const token = useAuthStore((s) => s.token);
  const location = useLocation();

  if (!token) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <>{children}</>;
}
