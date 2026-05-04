import { Navigate } from "react-router-dom";
import { ReactNode, useEffect } from "react";
import { toast } from "sonner";
import { useSelector } from "react-redux";
import type { RootState } from "@/app/store";

type ProtectedRouteProps = {
  children: ReactNode;
};

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const isAuthenticated = useSelector(
    (state: RootState) => state.auth.isAuthenticated
  );

  useEffect(() => {
    if (!isAuthenticated) {
      toast.info("Please login first!!!", {
        id: "login-nudge",
      });
    }
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;