import { Navigate } from "react-router-dom";
import useAuthStore from "../store/authStore";

/** Keeps signed-in users out of the login and register pages. */
export default function GuestRoute({ children }) {
  const token = useAuthStore((s) => s.token);

  if (token) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
