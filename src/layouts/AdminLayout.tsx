import React, { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import Sidebar from "../components/Layout/Sidebar";
import Header from "../components/Layout/Header";
import SosRealtime from "../components/SosRealtime";

const AdminLayout: React.FC = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();

  return (
    <div className="flex h-screen bg-gradient-to-b from-sky-100 via-sky-50 to-white">
      {/* Real-time SOS/ambulance alerts (toast + chime) + toast host */}
      <SosRealtime />
      <Toaster position="top-right" />
      <Sidebar
        isMobileMenuOpen={isMobileMenuOpen}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
      />

      <div className="flex flex-col flex-1 overflow-hidden">
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
