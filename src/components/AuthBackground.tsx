import React from "react";
import logo from "../assets/logo.png";

/**
 * Shared sky/cloud background for the auth pages (login, forgot, OTP, reset),
 * with a faded HealWin logo watermark and the brand mark top-left. Centers its
 * children (the auth card) on top.
 */
const AuthBackground: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-gradient-to-b from-sky-300 via-sky-100 to-white px-4">
    {/* Soft cloud layers + logo watermark */}
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute -top-24 left-1/2 h-72 w-[44rem] -translate-x-1/2 rounded-full bg-white/50 blur-3xl" />
      <div className="absolute bottom-0 left-0 h-64 w-[40rem] rounded-full bg-white/70 blur-3xl" />
      <div className="absolute -bottom-10 right-0 h-72 w-[36rem] rounded-full bg-white/80 blur-3xl" />
      <div className="absolute bottom-24 left-1/3 h-40 w-96 rounded-full bg-white/60 blur-2xl" />
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

    <div className="relative z-10 w-full max-w-md">{children}</div>
  </div>
);

export default AuthBackground;
