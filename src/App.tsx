import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Suspense } from "react";
import { AuthProvider } from "./auth/AuthContext";
import PrivateRoute from "./routes/privateRoute";
import ErrorBoundary from "./components/ErrorBoundary";

import AuthLayout from "./layouts/AuthLayout";
import AdminLayout from "./layouts/AdminLayout";
import { authRoutes, adminRoutes } from "./routes";

const LoadingSpinner = () => (
  <div className="flex items-center justify-center min-h-[60vh]">
    <div className="w-10 h-10 border-4 rounded-full border-healwin-500 border-t-transparent animate-spin" />
  </div>
);

const App = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Auth routes */}
          <Route element={<AuthLayout />}>
            {authRoutes.map((route) => (
              <Route
                key={route.path}
                path={route.path}
                element={
                  <Suspense fallback={<LoadingSpinner />}>
                    <route.element />
                  </Suspense>
                }
              />
            ))}
          </Route>

          {/* Protected admin routes */}
          <Route element={<PrivateRoute />}>
            <Route path="/admin" element={<AdminLayout />}>
              {adminRoutes.map((route) => (
                <Route
                  key={route.path}
                  path={route.path}
                  element={
                    <ErrorBoundary>
                      <Suspense fallback={<LoadingSpinner />}>
                        <route.element />
                      </Suspense>
                    </ErrorBoundary>
                  }
                />
              ))}
              {/* default admin route */}
              <Route index element={<Navigate to="/admin/staff" replace />} />
              {/* catch-all within admin - stay in admin, don't redirect to login */}
              <Route
                path="*"
                element={<Navigate to="/admin/staff" replace />}
              />
            </Route>
          </Route>

          {/* fallback */}
          <Route path="*" element={<Navigate to="/login" />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
