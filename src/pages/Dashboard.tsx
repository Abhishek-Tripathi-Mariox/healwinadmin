// src/pages/Dashboard.tsx
import React, { useEffect, useState } from "react";
import {
  AlertTriangle,
  Building2,
  Heart,
  Users,
  Briefcase,
  Newspaper,
  MapPin,
  TrendingUp,
  Ambulance,
  BedDouble,
  IndianRupee,
  UserCheck,
} from "lucide-react";
import { dashboardApi } from "../services/admin-api";
import { PageHeader, Card, Spinner } from "../components/ui";

interface DashboardStats {
  totalSosAlerts: number;
  activeCentres: number;
  totalServices: number;
  teamMembers: number;
  activeJobs: number;
  newsArticles: number;
  totalStates: number;
  totalDistricts: number;
  operations?: {
    ambulance: { ridesToday: number; revenueToday: number };
    hms: {
      opdToday: number;
      occupancyPct: number;
      occupiedBeds: number;
      totalBeds: number;
      revenueBilled: number;
      revenueOutstanding: number;
    };
    staff: { headcount: number; presentToday: number; onLeaveToday: number };
  };
}

const money = (n: number) => `₹${Math.round(n || 0).toLocaleString("en-IN")}`;

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStats = async () => {
      try {
        const response = await dashboardApi.getStats();
        if (response.data) {
          setStats(response.data);
        }
      } catch {
        // Stats API may not be ready yet — show placeholder
      } finally {
        setLoading(false);
      }
    };
    loadStats();
  }, []);

  const statCards = [
    {
      label: "SOS Alerts",
      value: stats?.totalSosAlerts ?? "—",
      icon: AlertTriangle,
      color: "bg-red-100 text-red-600",
    },
    {
      label: "Health Centres",
      value: stats?.activeCentres ?? "—",
      icon: Building2,
      color: "bg-blue-100 text-blue-600",
    },
    {
      label: "Services",
      value: stats?.totalServices ?? "—",
      icon: Heart,
      color: "bg-green-100 text-green-600",
    },
    {
      label: "Team Members",
      value: stats?.teamMembers ?? "—",
      icon: Users,
      color: "bg-purple-100 text-purple-600",
    },
  ];

  const secondaryStats = [
    {
      label: "Active Job Listings",
      value: stats?.activeJobs ?? "—",
      icon: Briefcase,
      color: "bg-orange-100 text-orange-600",
    },
    {
      label: "News Articles",
      value: stats?.newsArticles ?? "—",
      icon: Newspaper,
      color: "bg-cyan-100 text-cyan-600",
    },
    {
      label: "States Covered",
      value: stats?.totalStates ?? "—",
      icon: MapPin,
      color: "bg-indigo-100 text-indigo-600",
    },
    {
      label: "Districts Covered",
      value: stats?.totalDistricts ?? "—",
      icon: TrendingUp,
      color: "bg-teal-100 text-teal-600",
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Spinner className="h-10 w-10 border-4" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <PageHeader
        title="Dashboard"
        subtitle="Overview of your healthcare platform"
      />

      {/* Today's Operations — real cross-module snapshot (ambulance ops,
          hospital/OPD/beds, staff), each linking to its full dashboard. */}
      {stats?.operations && (
        <div className="mb-6">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Today's Operations</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <a href="/admin/sos" className="block">
              <Card className="p-5 hover:shadow-md transition-shadow">
                <div className="mb-3 flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-100 text-red-600">
                    <Ambulance className="h-5 w-5" />
                  </div>
                  <span className="text-sm font-semibold text-gray-700">Ambulance</span>
                </div>
                <div className="flex items-baseline gap-4">
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{stats.operations.ambulance.ridesToday}</p>
                    <p className="text-xs text-gray-500">rides today</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{money(stats.operations.ambulance.revenueToday)}</p>
                    <p className="text-xs text-gray-500">revenue today</p>
                  </div>
                </div>
              </Card>
            </a>
            <a href="/admin/hms-reports" className="block">
              <Card className="p-5 hover:shadow-md transition-shadow">
                <div className="mb-3 flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                    <BedDouble className="h-5 w-5" />
                  </div>
                  <span className="text-sm font-semibold text-gray-700">Hospital</span>
                </div>
                <div className="flex items-baseline gap-4">
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{stats.operations.hms.opdToday}</p>
                    <p className="text-xs text-gray-500">OPD today</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{stats.operations.hms.occupancyPct}%</p>
                    <p className="text-xs text-gray-500">
                      beds occupied ({stats.operations.hms.occupiedBeds}/{stats.operations.hms.totalBeds})
                    </p>
                  </div>
                </div>
                <p className="mt-2 flex items-center gap-1 text-xs text-gray-500">
                  <IndianRupee className="h-3 w-3" />
                  {money(stats.operations.hms.revenueBilled)} billed · {money(stats.operations.hms.revenueOutstanding)} outstanding
                </p>
              </Card>
            </a>
            <a href="/admin/hr" className="block">
              <Card className="p-5 hover:shadow-md transition-shadow">
                <div className="mb-3 flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-100 text-purple-600">
                    <UserCheck className="h-5 w-5" />
                  </div>
                  <span className="text-sm font-semibold text-gray-700">Staff</span>
                </div>
                <div className="flex items-baseline gap-4">
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{stats.operations.staff.headcount}</p>
                    <p className="text-xs text-gray-500">active headcount</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{stats.operations.staff.presentToday}</p>
                    <p className="text-xs text-gray-500">present today</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{stats.operations.staff.onLeaveToday}</p>
                    <p className="text-xs text-gray-500">on leave</p>
                  </div>
                </div>
              </Card>
            </a>
          </div>
        </div>
      )}

      {/* Primary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Card key={index} className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center ${stat.color}`}
                >
                  <Icon className="w-6 h-6" />
                </div>
              </div>
              <h3 className="text-3xl font-bold text-gray-900">{stat.value}</h3>
              <p className="text-sm text-gray-500 mt-1">{stat.label}</p>
            </Card>
          );
        })}
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mt-6">
        {secondaryStats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Card key={index} className="p-5">
              <div className="flex items-center space-x-4">
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center ${stat.color}`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xl font-bold text-gray-900">
                    {stat.value}
                  </p>
                  <p className="text-xs text-gray-500">{stat.label}</p>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Quick Links */}
      <Card className="p-6 mt-6">
        <h3 className="text-lg font-bold text-gray-800 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            {
              label: "SOS Dashboard",
              path: "/admin/sos",
              icon: AlertTriangle,
              color: "text-red-600 bg-red-50 hover:bg-red-100",
            },
            {
              label: "Manage Centres",
              path: "/admin/centres",
              icon: Building2,
              color: "text-blue-600 bg-blue-50 hover:bg-blue-100",
            },
            {
              label: "Team Members",
              path: "/admin/team",
              icon: Users,
              color: "text-purple-600 bg-purple-50 hover:bg-purple-100",
            },
            {
              label: "Services",
              path: "/admin/services",
              icon: Heart,
              color: "text-green-600 bg-green-50 hover:bg-green-100",
            },
          ].map((action) => {
            const Icon = action.icon;
            return (
              <a
                key={action.path}
                href={action.path}
                className={`flex flex-col items-center justify-center p-4 rounded-xl transition-colors ${action.color}`}
              >
                <Icon className="w-6 h-6 mb-2" />
                <span className="text-sm font-medium">{action.label}</span>
              </a>
            );
          })}
        </div>
      </Card>
    </div>
  );
};

export default Dashboard;
