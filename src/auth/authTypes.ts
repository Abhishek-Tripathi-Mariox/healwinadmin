import { createContext } from "react";

export interface AdminUser {
  _id: string;
  name: string;
  email: string;
  roleName: string;
  permissions: string[];
  accessibleModules: string[];
  avatar?: string;
}

export interface AuthContextType {
  login: (token: string, user: AdminUser) => void;
  logout: () => void;
  isAuthenticated: boolean;
  user: AdminUser | null;
  hasPermission: (permission: string | string[]) => boolean;
  canAccessModule: (moduleId: string) => boolean;
  isLoading: boolean;
}

export const AuthContext = createContext<AuthContextType | undefined>(
  undefined,
);
