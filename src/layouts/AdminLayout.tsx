import React, { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import Sidebar from "../components/Layout/Sidebar";
import Header from "../components/Layout/Header";
import SosRealtime from "../components/SosRealtime";
import StaffActivityRealtime from "../components/StaffActivityRealtime";

const AdminLayout: React.FC = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();

  return (
    <div className="flex h-screen bg-gradient-to-b from-sky-100 via-sky-50 to-white">
      {/* Real-time SOS/ambulance alerts (toast + chime) + toast host */}
      <SosRealtime />
      <StaffActivityRealtime />
      <Toaster position="top-right" />
      <Sidebar
        isMobileMenuOpen={isMobileMenuOpen}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
      />

      {/* min-w-0 is what lets this column shrink to the screen. A flex child
          defaults to min-width: auto — its content's width — so a page with a
          wide table grew past the viewport and overflow-hidden clipped its
          right edge, taking header buttons and Actions columns with it. With
          it, wide content scrolls inside its own container instead. */}
      <div className="flex min-w-0 flex-col flex-1 overflow-hidden">
        <Header setIsMobileMenuOpen={setIsMobileMenuOpen} />
        <main className="flex-1 overflow-y-auto">
          {/* Keyed by route so each navigation replays a smooth entrance. */}
          <div key={location.pathname} className="min-h-full animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
