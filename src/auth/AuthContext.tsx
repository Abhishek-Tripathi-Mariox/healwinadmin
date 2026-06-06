import React, { useState, useEffect } from "react";
import type { ReactNode } from "react";
import { SIDEBAR_PERMISSION_MAP } from "./permissions";
import { AuthContext } from "./authTypes";
import type { AdminUser } from "./authTypes";
import { adminSocket } from "../services/socket";

export type { AdminUser, AuthContextType } from "./authTypes";
export { AuthContext } from "./authTypes";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:9050/v1/api";

export const AuthProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<AdminUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check for existing token on mount
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem("adminToken");
      if (token) {
        try {
          const response = await fetch(`${API_URL}/admin/auth/me`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
          if (response.ok) {
            const data = await response.json();
            if (data.success && data.data) {
              const { admin, accessibleModules } = data.data;
              setUser({
                _id: admin._id,
                name: admin.fullName,
                email: admin.email,
                roleName: admin.roleName,
                permissions: admin.permissions || [],
                accessibleModules: accessibleModules || [],
                avatar: admin.profileImage,
              });
              setIsAuthenticated(true);
            } else {
              localStorage.removeItem("adminToken");
            }
          } else {
            localStorage.removeItem("adminToken");
          }
        } catch {
          localStorage.removeItem("adminToken");
        }
      }
      setIsLoading(false);
    };
    checkAuth();
  }, []);

  const login = (token: string, userData: AdminUser) => {
    localStorage.setItem("adminToken", token);
    setUser(userData);
    setIsAuthenticated(true);
  };

  const logout = () => {
    adminSocket.disconnect();
    localStorage.removeItem("adminToken");
    setUser(null);
    setIsAuthenticated(false);
  };

  const hasPermission = (permission: string | string[]): boolean => {
    if (!user) return false;

    // Super Admin has all permissions
    if (user.roleName === "Super Admin") return true;

    if (Array.isArray(permission)) {
      return permission.some((p) => user.permissions.includes(p));
    }
    return user.permissions.includes(permission);
  };

  const canAccessModule = (moduleId: string): boolean => {
    if (!user) return false;

    // Menu visibility strictly follows the role's ticked permissions — for
    // every role including Super Admin. Since Super Admin's role holds all
    // permissions it still sees everything; un-ticking a permission hides the
    // matching menu. Unmapped modules stay hidden (least privilege).
    // (Action buttons + backend keep a Super Admin safety net via
    // hasPermission / requirePermission, so you can never lock yourself out.)
    const requiredPermissions = SIDEBAR_PERMISSION_MAP[moduleId];
    if (!requiredPermissions || requiredPermissions.length === 0) return false;

    return requiredPermissions.some((p) => user.permissions.includes(p));
  };

  return (
    <AuthContext.Provider
      value={{
        login,
        logout,
        isAuthenticated,
        user,
        hasPermission,
        canAccessModule,
        isLoading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
