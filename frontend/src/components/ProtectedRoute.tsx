import { Navigate } from "react-router-dom";
import { ReactNode, useEffect } from "react";
import { toast } from "sonner";

type ProtectedRouteProps = {
  children: ReactNode;
};

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const token = localStorage.getItem("access_token");

  useEffect(() => {
    if (!token) {
      toast.info("Please login first!!!", {
        id: "login-nudge",
      });
    }
  }, [token]);

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
