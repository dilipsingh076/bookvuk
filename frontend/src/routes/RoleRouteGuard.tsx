import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Loader from "../components/ui/Loader";
import type { ReactNode } from "react";

type Role = string;

type RoleRouteGuardProps = {
  variant:
    | "adminOnly"
    | "redirectAdminsOnUserRoutes"
    | "authenticatedOnly"
    | "unauthenticatedOnly"
    /** Customer-only (cart / wishlist / checkout): guests → landing `/`, admins → `/admin` */
    | "customerRoutes";
  allowedRoles?: Role[];
  children: ReactNode;
};

const RoleRouteGuard = ({ variant, allowedRoles, children }: RoleRouteGuardProps) => {
  const { user, isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="py-10">
        <Loader />
      </div>
    );
  }

  const role = user?.role;

  if (variant === "adminOnly") {
    if (!isAuthenticated) {
      return <Navigate to="/" replace />;
    }
    if (role !== "admin") {
      return <Navigate to="/" replace />;
    }
    if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(role || "")) {
      return <Navigate to="/" replace />;
    }
    return <>{children}</>;
  }

  if (variant === "authenticatedOnly") {
    if (!isAuthenticated) {
      return <Navigate to="/" replace />;
    }
    if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(role || "")) {
      return <Navigate to="/" replace />;
    }
    return <>{children}</>;
  }

  if (variant === "unauthenticatedOnly") {
    if (isAuthenticated) {
      return <Navigate to={role === "admin" ? "/admin" : "/home"} replace />;
    }
    return <>{children}</>;
  }

  if (variant === "customerRoutes") {
    if (!isAuthenticated) {
      return <Navigate to="/" replace />;
    }
    if (role === "admin") {
      return <Navigate to="/admin" replace />;
    }
    return <>{children}</>;
  }

  // redirectAdminsOnUserRoutes
  if (isAuthenticated && role === "admin") {
    return <Navigate to="/admin" replace />;
  }
  return <>{children}</>;
};

export default RoleRouteGuard;

