import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import logo from "../assets/logo.png";
import { AlertCircle, Eye, EyeOff, Loader2, LogIn, Mail, Lock } from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:9050/v1/api";

const Login: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setInfo("");
    setIsLoading(true);

    try {
      const response = await fetch(`${API_URL}/admin/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Login failed");
      }

      if (data.success && data.data) {
        const { token, admin, accessibleModules } = data.data;
        login(token, {
          _id: admin._id,
          name: admin.fullName,
          email: admin.email,
          roleName: admin.roleName,
          permissions: admin.permissions || [],
          accessibleModules: accessibleModules || [],
          avatar: admin.profileImage,
        });

        const firstModule = accessibleModules?.[0] || "staff";
        navigate(`/admin/${firstModule}`, { replace: true });
      } else {
        throw new Error(data.message || "Login failed");
      }
    } catch (err: any) {
      setError(err.message || "An error occurred during login");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-gradient-to-b from-sky-300 via-sky-100 to-white px-4">
      {/* Soft cloud layers */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 left-1/2 h-72 w-[44rem] -translate-x-1/2 rounded-full bg-white/50 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-64 w-[40rem] rounded-full bg-white/70 blur-3xl" />
        <div className="absolute -bottom-10 right-0 h-72 w-[36rem] rounded-full bg-white/80 blur-3xl" />
        <div className="absolute bottom-24 left-1/3 h-40 w-96 rounded-full bg-white/60 blur-2xl" />
        {/* HealWin logo watermark */}
        <img
          src={logo}
          alt=""
          aria-hidden="true"
          className="absolute left-1/2 top-1/2 w-[34rem] max-w-[85vw] -translate-x-1/2 -translate-y-1/2 select-none object-contain opacity-[0.07]"
        />
      </div>

      {/* Brand top-left */}
      <div className="absolute left-6 top-5 z-10 flex items-center gap-2">
        <img src={logo} alt="HealWin" className="h-8 w-8 object-contain" />
        <span className="text-sm font-semibold tracking-tight text-gray-800">
          HealWin
        </span>
      </div>

      {/* Card */}
      <div className="relative z-10 w-full max-w-sm rounded-3xl border border-white/60 bg-white/70 p-8 shadow-[0_20px_60px_-15px_rgba(30,64,175,0.25)] backdrop-blur-xl">
        {/* Icon badge */}
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
          <LogIn className="h-6 w-6 text-gray-700" />
        </div>

        <h1 className="text-center text-2xl font-bold tracking-tight text-gray-900">
          Sign in to HealWin
        </h1>
        <p className="mx-auto mt-1 mb-6 max-w-xs text-center text-sm text-gray-500">
          Enter your credentials to access your dashboard.
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          {error && (
            <div className="flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-700 ring-1 ring-red-100">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          {info && !error && (
            <div className="rounded-xl bg-sky-50 px-3 py-2.5 text-sm text-sky-700 ring-1 ring-sky-100">
              {info}
            </div>
          )}

          {/* Email */}
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLoading}
              className="h-12 w-full rounded-xl border border-gray-200 bg-white/80 pl-10 pr-3 text-sm text-gray-900 placeholder-gray-400 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-400/30"
            />
          </div>

          {/* Password */}
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLoading}
              className="h-12 w-full rounded-xl border border-gray-200 bg-white/80 pl-10 pr-10 text-sm text-gray-900 placeholder-gray-400 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-400/30"
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 transition hover:text-gray-600"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          <div className="flex justify-end">
            <Link
              to="/forgot-password"
              className="text-xs font-medium text-gray-500 transition hover:text-gray-800"
            >
              Forgot password?
            </Link>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="flex h-12 w-full items-center justify-center rounded-xl bg-gray-900 text-sm font-semibold text-white shadow-sm transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Signing in…
              </>
            ) : (
              "Sign In"
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
