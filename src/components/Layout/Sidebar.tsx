import React, { useState } from "react";
import {
  Activity,
  Ambulance,
  Award,
  BarChart3,
  BedDouble,
  Bell,
  Boxes,
  Briefcase,
  BriefcaseMedical,
  Building2,
  CalendarCheck,
  CalendarDays,
  CalendarOff,
  Car,
  ChevronDown,
  CircleHelp,
  ClipboardList,
  Clock,
  Contact,
  FileText,
  FlaskConical,
  FolderOpen,
  Globe,
  Heart,
  HeartPulse,
  History,
  Home,
  Hospital,
  Image,
  ImageIcon,
  IndianRupee,
  Key,
  Layers,
  LayoutDashboard,
  LogOut,
  Mail,
  Map,
  MapPin,
  Newspaper,
  Package,
  Phone,
  PhoneCall,
  Pill,
  Receipt,
  ScrollText,
  Send,
  Settings,
  Shield,
  Siren,
  Stethoscope,
  Syringe,
  Ticket,
  TicketPercent,
  UserCog,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../auth/useAuth";
import logo from "../../assets/logo.png";

interface SidebarProps {
  isMobileMenuOpen: boolean;
  setIsMobileMenuOpen: (open: boolean) => void;
}

interface MenuChild {
  id: string;
  label: string;
  icon: React.FC<any>;
  path?: string;
  children?: MenuChild[];
}

interface MenuItem {
  id: string;
  label: string;
  icon: React.FC<any>;
  path?: string;
  children?: MenuChild[];
}

const Sidebar: React.FC<SidebarProps> = ({
  isMobileMenuOpen,
  setIsMobileMenuOpen,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout, canAccessModule, user } = useAuth();

  // Track which dropdowns are open
  const [openDropdowns, setOpenDropdowns] = useState<Record<string, boolean>>({
    "team-management-group":
      location.pathname.includes("/admin/staff") ||
      location.pathname.includes("/admin/team"),
    "careers-group":
      location.pathname.includes("/admin/careers") ||
      location.pathname.includes("/admin/applications"),
    "services-group":
      location.pathname.includes("/admin/services") ||
      location.pathname.includes("/admin/categories"),
    "location-group":
      location.pathname.includes("/admin/states") ||
      location.pathname.includes("/admin/districts") ||
      location.pathname.includes("/admin/divisions"),
    "centre-group":
      location.pathname.includes("/admin/centres") ||
      location.pathname.includes("/admin/centre-requests") ||
      location.pathname.includes("/admin/locator-types"),
    "master-data-group":
      location.pathname.includes("/admin/departments") ||
      location.pathname.includes("/admin/designations") ||
      location.pathname.includes("/admin/employment-types"),
    "website-content-group":
      location.pathname.includes("/admin/home") ||
      location.pathname.includes("/admin/about") ||
      location.pathname.includes("/admin/contact") ||
      location.pathname.includes("/admin/cms") ||
      location.pathname.includes("/admin/news") ||
      location.pathname.includes("/admin/gallery") ||
      location.pathname.includes("/admin/article-submissions") ||
      location.pathname.includes("/admin/logo-settings"),
    "providers-group":
      location.pathname.includes("/admin/service-providers") ||
      location.pathname.includes("/admin/ambulance-staff") ||
      location.pathname.includes("/admin/staff-records") ||
      location.pathname.includes("/admin/ambulances") ||
      location.pathname.includes("/admin/ambulance-inventory") ||
      location.pathname.includes("/admin/shifts") ||
      location.pathname.includes("/admin/off-duty-reasons") ||
      location.pathname.includes("/admin/ambulance-pricing"),
    "reports-group": location.pathname.includes("/admin/reports"),
    "system-group":
      location.pathname.includes("/admin/email-templates") ||
      location.pathname.includes("/admin/activity-logs") ||
      location.pathname.includes("/admin/notifications") ||
      location.pathname.includes("/admin/roles"),
    "hr-group":
      location.pathname.includes("/admin/hr") ||
      location.pathname.includes("/admin/employees") ||
      location.pathname.includes("/admin/attendance") ||
      location.pathname.includes("/admin/leave") ||
      location.pathname.includes("/admin/holidays") ||
      location.pathname.includes("/admin/payroll"),
  });

  const allMenuItems: MenuItem[] = [
    {
      id: "sos",
      label: "SOS Dashboard",
      icon: Siren,
      path: "/admin/sos",
    },
    {
      id: "fleet-health",
      label: "Fleet Health",
      icon: Activity,
      path: "/admin/fleet-health",
    },
    {
      id: "ambulance-requests",
      label: "Ambulance Requests",
      icon: Ambulance,
      path: "/admin/ambulance-requests",
    },
    {
      id: "ivr-escalations",
      label: "IVR Escalation",
      icon: PhoneCall,
      path: "/admin/ivr-escalations",
    },
    // Legacy ride-hailing "Bookings" (Booking model) — hidden from the nav.
    // The current ambulance flow lives entirely under "Ambulance Requests"
    // (+ SOS Dashboard). The /admin/bookings route still exists for any old
    // enterprise/cab records, just not surfaced in the sidebar.
    // "Patient Orders" (consultations/lab/pharmacy from the patient app)
    // moved into the Doctor Panel group below — that's where clinical staff
    // actually look for it, not here alongside ambulance ops.
    {
      id: "help-faqs",
      label: "Help FAQs",
      icon: CircleHelp,
      path: "/admin/help-faqs",
    },
    {
      id: "support-tickets",
      label: "Support Tickets",
      icon: Ticket,
      path: "/admin/support-tickets",
    },
    {
      id: "users",
      label: "User Management",
      icon: Users,
      path: "/admin/users",
    },
    // Named for what it holds (providers + crew + vehicles + shifts + pricing)
    // rather than "Service Providers", which collided with its own first child.
    // `id` stays "providers-group" — it is the openDropdowns state key.
    {
      id: "providers-group",
      label: "Ambulance Operations",
      icon: Ambulance,
      children: [
        {
          id: "service-providers",
          label: "Service Providers",
          icon: Building2,
          path: "/admin/service-providers",
        },
        {
          id: "ambulance-staff",
          label: "Drivers & Attendants",
          icon: Users,
          path: "/admin/ambulance-staff",
        },
        {
          id: "staff-records",
          label: "Staff App Records",
          icon: ClipboardList,
          path: "/admin/staff-records",
        },
        {
          id: "ambulances",
          label: "Ambulances",
          icon: Ambulance,
          path: "/admin/ambulances",
        },
        {
          id: "ambulance-inventory",
          label: "Ambulance Inventory",
          icon: Package,
          path: "/admin/ambulance-inventory",
        },
        {
          id: "shifts",
          label: "Shifts",
          icon: Clock,
          path: "/admin/shifts",
        },
        {
          id: "off-duty-reasons",
          label: "Off-Duty Reasons",
          icon: CalendarOff,
          path: "/admin/off-duty-reasons",
        },
        {
          id: "ambulance-pricing",
          label: "Types & Pricing",
          icon: IndianRupee,
          path: "/admin/ambulance-pricing",
        },
      ],
    },
    // Hospitals is its own root entry rather than sitting under Service
    // Providers: attendants (paramedics / MTs) are employed by hospitals, not
    // by ambulance providers. Each hospital page drills into its own staff.
    {
      id: "hospitals",
      label: "Hospitals Registry",
      icon: Hospital,
      path: "/admin/hospitals",
    },
    {
      id: "reports-group",
      label: "Reports",
      icon: BarChart3,
      children: [
        {
          id: "reports-bookings",
          label: "Bookings",
          icon: BarChart3,
          path: "/admin/reports/bookings",
        },
        {
          id: "reports-revenue",
          label: "Revenue",
          icon: Receipt,
          path: "/admin/reports/revenue",
        },
        {
          id: "reports-users",
          label: "Users",
          icon: Users,
          path: "/admin/reports/users",
        },
        {
          id: "reports-drivers",
          label: "Drivers",
          icon: Car,
          path: "/admin/reports/drivers",
        },
      ],
    },
    // "People" groups two different things: Team Management (/admin/staff) is
    // admin-panel login accounts, and Website Team (/admin/team) is the public
    // website's staff directory (team.routes.ts, rendered on the site's Team
    // page, with per-member QR verification).
    {
      id: "team-management-group",
      label: "People",
      icon: Users,
      children: [
        {
          id: "staff",
          label: "Team Management",
          icon: UserCog,
          path: "/admin/staff",
        },
        {
          id: "team",
          label: "Website Team",
          icon: Users,
          path: "/admin/team",
        },
      ],
    },
    {
      id: "careers-group",
      label: "Careers",
      icon: Briefcase,
      children: [
        {
          id: "careers",
          label: "Job Listings",
          icon: Briefcase,
          path: "/admin/careers",
        },
        {
          id: "applications",
          label: "Applications",
          icon: FileText,
          path: "/admin/applications",
        },
      ],
    },
    {
      id: "services-group",
      label: "Services",
      icon: Heart,
      children: [
        {
          id: "services",
          label: "All Services",
          icon: Heart,
          path: "/admin/services",
        },
        {
          id: "categories",
          label: "Categories",
          icon: FolderOpen,
          path: "/admin/categories",
        },
      ],
    },
    {
      id: "location-group",
      label: "Location",
      icon: Globe,
      children: [
        {
          id: "states",
          label: "States",
          icon: Map,
          path: "/admin/states",
        },
        {
          id: "districts",
          label: "Districts",
          icon: MapPin,
          path: "/admin/districts",
        },
        {
          id: "divisions",
          label: "Divisions",
          icon: Layers,
          path: "/admin/divisions",
        },
      ],
    },
    {
      id: "centre-group",
      label: "Centre Locator",
      icon: Building2,
      children: [
        {
          id: "centres",
          label: "Centres",
          icon: Building2,
          path: "/admin/centres",
        },
        {
          id: "centre-requests",
          label: "Centre Requests",
          icon: Send,
          path: "/admin/centre-requests",
        },
        {
          id: "locator-types",
          label: "Service Types",
          icon: Layers,
          path: "/admin/locator-types",
        },
        {
          id: "pharmacies",
          label: "Pharmacies",
          icon: Pill,
          path: "/admin/pharmacies",
        },
        {
          id: "labs",
          label: "Labs",
          icon: FlaskConical,
          path: "/admin/labs",
        },
      ],
    },
    {
      id: "master-data-group",
      label: "Master Data",
      icon: Layers,
      children: [
        {
          id: "departments",
          label: "Departments",
          icon: FolderOpen,
          path: "/admin/departments",
        },
        {
          id: "designations",
          label: "Designations",
          icon: Award,
          path: "/admin/designations",
        },
        {
          id: "employment-types",
          label: "Employment Types",
          icon: Briefcase,
          path: "/admin/employment-types",
        },
      ],
    },
    {
      id: "website-content-group",
      label: "Website Content",
      icon: FileText,
      children: [
        {
          id: "home",
          label: "Home Page",
          icon: Home,
          path: "/admin/home",
        },
        {
          id: "home-promos",
          label: "App Home Promos",
          icon: Image,
          path: "/admin/home-promos",
        },
        {
          id: "promo-codes",
          label: "Promo Codes",
          icon: TicketPercent,
          path: "/admin/promo-codes",
        },
        {
          id: "membership-plans",
          label: "Membership Plans",
          icon: Award,
          path: "/admin/membership-plans",
        },
        {
          id: "about",
          label: "About Page",
          icon: FileText,
          path: "/admin/about",
        },
        {
          id: "legal-content",
          label: "Legal Content (App)",
          icon: ScrollText,
          path: "/admin/legal-content",
        },
        {
          id: "contact",
          label: "Contact Page",
          icon: Phone,
          path: "/admin/contact",
        },
        {
          id: "cms",
          label: "CMS Pages",
          icon: FileText,
          path: "/admin/cms",
        },
        {
          id: "news",
          label: "News Articles",
          icon: Newspaper,
          path: "/admin/news",
        },
        {
          id: "first-aid",
          label: "First Aid Guides",
          icon: BriefcaseMedical,
          path: "/admin/first-aid",
        },
        {
          id: "gallery",
          label: "Gallery",
          icon: Image,
          path: "/admin/gallery",
        },
        {
          id: "submissions",
          label: "Submissions",
          icon: Send,
          path: "/admin/article-submissions",
        },
        {
          id: "logo-settings",
          label: "Logo Management",
          icon: ImageIcon,
          path: "/admin/logo-settings",
        },
      ],
    },
    {
      id: "doctor-panel-group",
      // Named for its CONTENTS, like every sibling group. It was briefly
      // role-derived ("Reception Panel"), which fixed a Reception login seeing
      // "Doctor Panel" but regressed everyone else — Super Admin got "Super
      // Admin Panel" and Admin got "Admin Panel", which collides with the name
      // of the whole app. A function name is correct for all roles at once.
      // The `id` must stay "doctor-panel-group": it is the openDropdowns state
      // key and the canAccessModule / React key.
      label: "Hospital (HMS)",
      icon: HeartPulse,
      children: [
        {
          id: "patients",
          label: "Patients",
          icon: Contact,
          path: "/admin/patients",
        },
        {
          id: "patient-orders",
          label: "Consultations & Orders",
          icon: Stethoscope,
          path: "/admin/patient-orders",
        },
        {
          id: "hms-reports",
          label: "Hospital MIS",
          icon: BarChart3,
          path: "/admin/hms-reports",
        },
        {
          id: "opd",
          label: "OPD",
          icon: Stethoscope,
          path: "/admin/opd",
        },
        {
          id: "doctor-schedules",
          label: "Doctor Availability",
          icon: CalendarCheck,
          path: "/admin/doctor-schedules",
        },
        {
          id: "doctor-roster",
          label: "Doctor Roster",
          icon: CalendarDays,
          path: "/admin/doctor-roster",
        },
        {
          id: "ipd",
          label: "IPD",
          icon: BedDouble,
          path: "/admin/ipd",
        },
        {
          id: "ot",
          label: "Operation Theatre",
          icon: Syringe,
          path: "/admin/ot",
        },
        {
          id: "procurement",
          label: "Procurement",
          icon: Boxes,
          path: "/admin/procurement",
        },
        {
          id: "pharmacy-dispense",
          label: "Pharmacy Dispense",
          icon: Pill,
          path: "/admin/pharmacy-dispense",
        },
        {
          id: "inventory",
          label: "Inventory",
          icon: Boxes,
          path: "/admin/inventory",
        },
        {
          id: "ward-inventory",
          label: "Ward Inventory",
          icon: Boxes,
          path: "/admin/ward-inventory",
        },
        {
          id: "billing",
          label: "Billing",
          icon: Receipt,
          path: "/admin/billing",
        },
        {
          id: "insurance",
          label: "Insurance & TPA",
          icon: Shield,
          path: "/admin/insurance",
        },
        {
          id: "catalog",
          label: "Pharmacy & Lab Catalog",
          icon: Pill,
          path: "/admin/catalog",
        },
      ],
    },
    {
      id: "hr-group",
      label: "HR & Payroll",
      icon: UserCog,
      children: [
        {
          id: "hr",
          label: "HR Dashboard",
          icon: LayoutDashboard,
          path: "/admin/hr",
        },
        {
          id: "employees",
          label: "Employees",
          icon: Users,
          path: "/admin/employees",
        },
        {
          id: "staff-directory",
          label: "Staff Directory",
          icon: Users,
          path: "/admin/staff-directory",
        },
        {
          id: "employee-shifts",
          label: "Employee Shifts",
          icon: CalendarCheck,
          path: "/admin/employee-shifts",
        },
        {
          id: "attendance",
          label: "Attendance",
          icon: CalendarCheck,
          path: "/admin/attendance",
        },
        {
          id: "leave",
          label: "Leave",
          icon: CalendarDays,
          path: "/admin/leave",
        },
        {
          id: "holidays",
          label: "Holidays",
          icon: CalendarDays,
          path: "/admin/holidays",
        },
        {
          id: "payroll",
          label: "Payroll & Salary Slips",
          icon: Wallet,
          path: "/admin/payroll",
        },
      ],
    },
    {
      id: "system-group",
      label: "System",
      icon: Settings,
      children: [
        {
          id: "notifications",
          label: "Notifications",
          icon: Bell,
          path: "/admin/notifications",
        },
        {
          id: "email-templates",
          label: "Email Templates",
          icon: Mail,
          path: "/admin/email-templates",
        },
        {
          id: "activity-logs",
          label: "Activity Logs",
          icon: History,
          path: "/admin/activity-logs",
        },
        {
          id: "roles",
          label: "Roles & Permissions",
          icon: Key,
          path: "/admin/roles",
        },
      ],
    },
  ];

  // Filter based on permissions (recursively for nested groups)
  const isAccessible = (node: MenuItem | MenuChild): boolean => {
    if (node.children && node.children.length > 0) {
      return node.children.some((c) => isAccessible(c));
    }
    return canAccessModule(node.id);
  };
  const menuItems = allMenuItems.filter((item) => isAccessible(item));

  const toggleDropdown = (id: string) => {
    setOpenDropdowns((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Recursive renderer for child items (supports one or more levels of nesting)
  const renderChild = (child: MenuChild): React.ReactNode => {
    const ChildIcon = child.icon;

    if (child.children && child.children.length > 0) {
      const isOpen = !!openDropdowns[child.id];
      const isChildActive = child.children.some(
        (c) => c.path && location.pathname === c.path,
      );
      return (
        <div key={child.id}>
          <button
            onClick={() => toggleDropdown(child.id)}
            className={`group flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              isChildActive
                ? "text-healwin-700"
                : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
            }`}
          >
            <span className="flex items-center gap-3">
              <ChildIcon
                className={`h-4 w-4 shrink-0 ${
                  isChildActive
                    ? "text-healwin-600"
                    : "text-gray-400 group-hover:text-gray-500"
                }`}
              />
              <span>{child.label}</span>
            </span>
            <ChevronDown
              className={`h-4 w-4 shrink-0 text-gray-400 transition-transform duration-200 ${
                isOpen ? "rotate-180" : ""
              }`}
            />
          </button>
          {isOpen && (
            <div className="mt-1 ml-[1.15rem] space-y-0.5 border-l border-gray-200 pl-3">
              {child.children
                .filter((c) => isAccessible(c))
                .map((c) => renderChild(c))}
            </div>
          )}
        </div>
      );
    }

    return (
      <NavLink
        key={child.id}
        to={child.path!}
        onClick={() => setIsMobileMenuOpen(false)}
        className={({ isActive }) =>
          `group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
            isActive
              ? "bg-healwin-600 text-white shadow-sm shadow-healwin-600/30"
              : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
          }`
        }
      >
        {({ isActive }) => (
          <>
            <ChildIcon
              className={`h-4 w-4 shrink-0 ${
                isActive
                  ? "text-white"
                  : "text-gray-400 group-hover:text-gray-500"
              }`}
            />
            <span>{child.label}</span>
          </>
        )}
      </NavLink>
    );
  };

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const initials =
    (user?.name || "")
      .split(" ")
      .map((p) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "AD";

  return (
    <>
      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black bg-opacity-50 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 transform border-r border-white/60 bg-white/80 shadow-xl backdrop-blur-xl transition-transform duration-300 ease-in-out lg:shadow-none ${
          isMobileMenuOpen
            ? "translate-x-0"
            : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between gap-3 border-b border-gray-200 px-5 py-4">
            <div className="flex items-center gap-3">
              <img
                src={logo}
                alt="HealWin"
                className="h-10 w-10 shrink-0 object-contain"
              />
              <div className="min-w-0">
                <h1 className="text-lg font-bold tracking-tight text-gray-900">
                  HealWin
                </h1>
                {user && (
                  <p className="truncate text-xs text-gray-500">
                    {user.roleName}
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="text-gray-400 lg:hidden hover:text-gray-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Menu */}
          <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4 animate-fade-in">
            {menuItems.map((item) => {
              const Icon = item.icon;

              // Dropdown item (has children)
              if (item.children) {
                const isOpen = openDropdowns[item.id];
                const isChildActive = item.children.some(
                  (child) => location.pathname === child.path,
                );
                return (
                  <div key={item.id}>
                    <button
                      onClick={() => toggleDropdown(item.id)}
                      className={`group flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                        isChildActive
                          ? "text-healwin-700"
                          : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                      }`}
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        <Icon
                          className={`h-5 w-5 shrink-0 ${
                            isChildActive
                              ? "text-healwin-600"
                              : "text-gray-400 group-hover:text-gray-500"
                          }`}
                        />
                        {/* Wrap rather than truncate: one group label is
                            role-derived ("Call Centre Executive Panel") and
                            others are simply long ("Ambulance Operations"), and
                            clipping them to "Ambulance Operat…" hides the name.
                            min-w-0 on the parent lets the text wrap instead of
                            overflowing, and the chevron is shrink-0 so it stays
                            put — same behaviour the child links already have. */}
                        <span className="text-left leading-tight">
                          {item.label}
                        </span>
                      </span>
                      <ChevronDown
                        className={`h-4 w-4 shrink-0 text-gray-400 transition-transform duration-200 ${
                          isOpen ? "rotate-180" : ""
                        }`}
                      />
                    </button>
                    {isOpen && (
                      <div className="mt-1 ml-[1.15rem] space-y-0.5 border-l border-gray-200 pl-3">
                        {item.children
                          .filter((child) => isAccessible(child))
                          .map((child) => renderChild(child))}
                      </div>
                    )}
                  </div>
                );
              }

              // Regular menu item (no children)
              return (
                <NavLink
                  key={item.id}
                  to={item.path!}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    `group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-healwin-600 text-white shadow-sm shadow-healwin-600/30"
                        : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Icon
                        className={`h-5 w-5 shrink-0 ${
                          isActive
                            ? "text-white"
                            : "text-gray-400 group-hover:text-gray-500"
                        }`}
                      />
                      <span>{item.label}</span>
                    </>
                  )}
                </NavLink>
              );
            })}
          </nav>

          {/* User Info & Logout */}
          <div className="border-t border-gray-200 p-3">
            {user && (
              <div className="mb-1 flex items-center gap-3 px-3 py-2">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-healwin-100 text-sm font-semibold text-healwin-700">
                  {initials}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-900">
                    {user.name}
                  </p>
                  <p className="truncate text-xs text-gray-500">{user.email}</p>
                </div>
              </div>
            )}
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
            >
              <LogOut className="h-5 w-5 shrink-0" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
