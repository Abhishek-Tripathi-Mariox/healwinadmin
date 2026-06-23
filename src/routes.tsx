import { lazy } from "react";
import {
  AlertTriangle,
  Award,
  BedDouble,
  Bell,
  Boxes,
  Briefcase,
  Building2,
  BarChart3,
  CalendarCheck,
  CalendarDays,
  Car,
  IndianRupee,
  ClipboardList,
  LifeBuoy,
  Clock,
  FileText,
  FolderOpen,
  Globe,
  Heart,
  HeartPulse,
  ImageIcon,
  LayoutDashboard,
  Layers,
  Mail,
  Map,
  MapPin,
  Phone,
  PhoneCall,
  Pill,
  Receipt,
  Shield,
  TicketPercent,
  UserCog,
  Users,
  Wallet,
} from "lucide-react";

// Auth Pages
const Login = lazy(() => import("./pages/Login"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const OTPVerification = lazy(() => import("./pages/OTPVerification"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));

// Admin Pages
const SOSDashboard = lazy(() => import("./pages/SOSDashboard"));
const StaffManagement = lazy(() => import("./pages/StaffManagement"));
const CareersManagement = lazy(() => import("./pages/CareersManagement"));
const ApplicationsManagement = lazy(
  () => import("./pages/ApplicationsManagement"),
);
const TeamManagement = lazy(() => import("./pages/TeamManagement"));
const ServiceManagement = lazy(() => import("./pages/ServiceManagement"));
const CategoryManagement = lazy(() => import("./pages/CategoryManagement"));
const StateManagement = lazy(() => import("./pages/StateManagement"));
const DistrictManagement = lazy(() => import("./pages/DistrictManagement"));
const DivisionManagement = lazy(() => import("./pages/DivisionManagement"));
const DepartmentManagement = lazy(() => import("./pages/DepartmentManagement"));
const DesignationManagement = lazy(
  () => import("./pages/DesignationManagement"),
);
const EmploymentTypeManagement = lazy(
  () => import("./pages/EmploymentTypeManagement"),
);
const LocatorServiceTypeManagement = lazy(
  () => import("./pages/LocatorServiceTypeManagement"),
);
const CentreManagement = lazy(() => import("./pages/CentreManagement"));
const CentreRequestManagement = lazy(
  () => import("./pages/CentreRequestManagement"),
);
const CMSPageManagement = lazy(() => import("./pages/CMSPageManagement"));
const AboutManagement = lazy(() => import("./pages/AboutManagement"));
const LegalContentManagement = lazy(
  () => import("./pages/LegalContentManagement"),
);
const ContactManagement = lazy(() => import("./pages/ContactManagement"));
const HomeManagement = lazy(() => import("./pages/HomeManagement"));
const NewsManagement = lazy(() => import("./pages/NewsManagement"));
const GalleryManagement = lazy(() => import("./pages/GalleryManagement"));
const ArticleSubmissions = lazy(() => import("./pages/ArticleSubmissions"));
const LogoManagement = lazy(() => import("./pages/LogoManagement"));
const ActivityLogsManagement = lazy(
  () => import("./pages/ActivityLogsManagement"),
);
const EmailTemplateManagement = lazy(
  () => import("./pages/EmailTemplateManagement"),
);
const NotificationsManagement = lazy(
  () => import("./pages/NotificationsManagement"),
);
const UserManagement = lazy(() => import("./pages/UserManagement"));
const ServiceProviderManagement = lazy(
  () => import("./pages/ServiceProviderManagement"),
);
const AmbulanceStaffManagement = lazy(
  () => import("./pages/AmbulanceStaffManagement"),
);
const AmbulanceStaffDetail = lazy(
  () => import("./pages/AmbulanceStaffDetail"),
);
const StaffAppRecords = lazy(() => import("./pages/StaffAppRecords"));
const SupportTickets = lazy(() => import("./pages/SupportTickets"));
const PatientOrders = lazy(() => import("./pages/PatientOrders"));
const FaqManagement = lazy(() => import("./pages/FaqManagement"));
const AmbulanceManagement = lazy(() => import("./pages/AmbulanceManagement"));
const HospitalsManagement = lazy(() => import("./pages/HospitalsManagement"));
const HospitalDetail = lazy(() => import("./pages/HospitalDetail"));
const ShiftManagement = lazy(() => import("./pages/ShiftManagement"));
const OffDutyReasonsManagement = lazy(
  () => import("./pages/OffDutyReasonsManagement"),
);
const SOSAlertsDashboard = lazy(() => import("./pages/SOSAlertsDashboard"));
// Doctor Panel / HMS
const PatientRegistrationManagement = lazy(
  () => import("./pages/PatientRegistrationManagement"),
);
const PatientDetail = lazy(() => import("./pages/PatientDetail"));
const InventoryManagement = lazy(() => import("./pages/InventoryManagement"));
const BillingManagement = lazy(() => import("./pages/BillingManagement"));
const OPDManagement = lazy(() => import("./pages/OPDManagement"));
const IPDManagement = lazy(() => import("./pages/IPDManagement"));
const PharmaciesManagement = lazy(() => import("./pages/PharmaciesManagement"));
const IvrEscalationsManagement = lazy(
  () => import("./pages/IvrEscalationsManagement"),
);
// Operations
const BookingManagement = lazy(() => import("./pages/BookingManagement"));
const AmbulancePricingManagement = lazy(
  () => import("./pages/AmbulancePricingManagement"),
);
// HR & Payroll
const HRDashboard = lazy(() => import("./pages/hr/HRDashboard"));
const EmployeeManagement = lazy(() => import("./pages/hr/EmployeeManagement"));
const EmployeeDetail = lazy(() => import("./pages/hr/EmployeeDetail"));
const AttendanceManagement = lazy(
  () => import("./pages/hr/AttendanceManagement"),
);
const LeaveManagement = lazy(() => import("./pages/hr/LeaveManagement"));
const HolidayManagement = lazy(() => import("./pages/hr/HolidayManagement"));
const PayrollManagement = lazy(() => import("./pages/hr/PayrollManagement"));
// Patient Catalog
const CatalogManagement = lazy(() => import("./pages/CatalogManagement"));
const AmbulanceRequestsManagement = lazy(() => import("./pages/AmbulanceRequestsManagement"));
const MembershipPlansManagement = lazy(() => import("./pages/MembershipPlansManagement"));
const HomePromosManagement = lazy(() => import("./pages/HomePromosManagement"));
const PromoCodesManagement = lazy(() => import("./pages/PromoCodesManagement"));
// Reports
const ReportsBookings = lazy(() => import("./pages/ReportsBookings"));
const ReportsRevenue = lazy(() => import("./pages/ReportsRevenue"));
const ReportsUsers = lazy(() => import("./pages/ReportsUsers"));
const ReportsDrivers = lazy(() => import("./pages/ReportsDrivers"));

const ambulanceFeature =
  import.meta.env.VITE_FEATURE_AMBULANCE_DISPATCH === "true";

export const authRoutes = [
  { path: "/login", element: Login },
  { path: "/forgot-password", element: ForgotPassword },
  { path: "/otp-verification", element: OTPVerification },
  { path: "/reset-password", element: ResetPassword },
];

export const adminRoutes = [
  {
    path: "sos",
    element: SOSDashboard,
    name: "SOS Dashboard",
    icon: AlertTriangle,
  },
  {
    path: "staff",
    element: StaffManagement,
    name: "Admin Management",
    icon: Shield,
  },
  {
    path: "users",
    element: UserManagement,
    name: "User Management",
    icon: Users,
  },
  {
    path: "careers",
    element: CareersManagement,
    name: "Careers",
    icon: Briefcase,
  },
  {
    path: "applications",
    element: ApplicationsManagement,
    name: "Applications",
    icon: FileText,
  },
  {
    path: "team",
    element: TeamManagement,
    name: "Team Management",
    icon: Users,
  },
  {
    path: "services",
    element: ServiceManagement,
    name: "Services",
    icon: Heart,
  },
  {
    path: "categories",
    element: CategoryManagement,
    name: "Categories",
    icon: FolderOpen,
  },
  {
    path: "states",
    element: StateManagement,
    name: "States",
    icon: Map,
  },
  {
    path: "districts",
    element: DistrictManagement,
    name: "Districts",
    icon: MapPin,
  },
  {
    path: "divisions",
    element: DivisionManagement,
    name: "Divisions",
    icon: Layers,
  },
  {
    path: "departments",
    element: DepartmentManagement,
    name: "Departments",
    icon: FolderOpen,
  },
  {
    path: "designations",
    element: DesignationManagement,
    name: "Designations",
    icon: Award,
  },
  {
    path: "employment-types",
    element: EmploymentTypeManagement,
    name: "Employment Types",
    icon: Clock,
  },
  {
    path: "locator-types",
    element: LocatorServiceTypeManagement,
    name: "Service Types",
    icon: Layers,
  },
  {
    path: "centres",
    element: CentreManagement,
    name: "Centres",
    icon: Building2,
  },
  {
    path: "centre-requests",
    element: CentreRequestManagement,
    name: "Centre Requests",
    icon: ClipboardList,
  },
  {
    path: "cms",
    element: CMSPageManagement,
    name: "CMS Pages",
    icon: FileText,
  },
  {
    path: "about",
    element: AboutManagement,
    name: "About Page",
    icon: FileText,
  },
  {
    path: "legal-content",
    element: LegalContentManagement,
    name: "Legal Content",
    icon: FileText,
  },
  {
    path: "contact",
    element: ContactManagement,
    name: "Contact Page",
    icon: Phone,
  },
  {
    path: "home",
    element: HomeManagement,
    name: "Home Page",
    icon: Globe,
  },
  {
    path: "news",
    element: NewsManagement,
    name: "News Articles",
    icon: FileText,
  },
  {
    path: "gallery",
    element: GalleryManagement,
    name: "Gallery",
    icon: FileText,
  },
  {
    path: "article-submissions",
    element: ArticleSubmissions,
    name: "Article Submissions",
    icon: FileText,
  },
  {
    path: "logo-settings",
    element: LogoManagement,
    name: "Logo Management",
    icon: ImageIcon,
  },
  {
    path: "activity-logs",
    element: ActivityLogsManagement,
    name: "Activity Logs",
    icon: ClipboardList,
  },
  {
    path: "email-templates",
    element: EmailTemplateManagement,
    name: "Email Templates",
    icon: Mail,
  },
  {
    path: "notifications",
    element: NotificationsManagement,
    name: "Notifications",
    icon: Bell,
  },
  {
    path: "service-providers",
    element: ServiceProviderManagement,
    name: "Service Providers",
    icon: Building2,
  },
  {
    path: "ambulance-staff",
    element: AmbulanceStaffManagement,
    name: "Ambulance Staff",
    icon: Users,
  },
  // Drill-in route — reached by clicking a row on the Drivers list.
  // Hidden from the sidebar; permission piggy-backs on the parent.
  {
    path: "ambulance-staff/:id",
    element: AmbulanceStaffDetail,
    name: "Driver Detail",
    icon: Users,
    hidden: true,
  },
  {
    path: "staff-records",
    element: StaffAppRecords,
    name: "Staff App Records",
    icon: ClipboardList,
  },
  {
    path: "support-tickets",
    element: SupportTickets,
    name: "Support Tickets",
    icon: LifeBuoy,
  },
  {
    path: "patient-orders",
    element: PatientOrders,
    name: "Patient Orders",
    icon: ClipboardList,
  },
  {
    path: "help-faqs",
    element: FaqManagement,
    name: "Help FAQs",
    icon: ClipboardList,
  },
  {
    path: "ambulances",
    element: AmbulanceManagement,
    name: "Ambulances",
    icon: Heart,
  },
  {
    path: "shifts",
    element: ShiftManagement,
    name: "Shifts",
    icon: Clock,
  },
  {
    path: "hospitals",
    element: HospitalsManagement,
    name: "Hospitals",
    icon: Building2,
  },
  // Drill-in route. Not surfaced in the sidebar — reached by clicking a
  // row on the Hospitals list. Same role-gating as its parent.
  {
    path: "hospitals/:id",
    element: HospitalDetail,
    name: "Hospital Detail",
    icon: Building2,
    hidden: true,
  },
  {
    path: "off-duty-reasons",
    element: OffDutyReasonsManagement,
    name: "Off-Duty Reasons",
    icon: Clock,
  },
  // Doctor Panel / HMS
  {
    path: "patients",
    element: PatientRegistrationManagement,
    name: "Patients",
    icon: HeartPulse,
  },
  // Drill-in: patient demographics + EMR. Hidden from sidebar; gated by parent.
  {
    path: "patients/:id",
    element: PatientDetail,
    name: "Patient Detail",
    icon: HeartPulse,
    hidden: true,
  },
  {
    path: "inventory",
    element: InventoryManagement,
    name: "Inventory",
    icon: Boxes,
  },
  {
    path: "billing",
    element: BillingManagement,
    name: "Billing",
    icon: Receipt,
  },
  {
    path: "opd",
    element: OPDManagement,
    name: "OPD",
    icon: ClipboardList,
  },
  {
    path: "ipd",
    element: IPDManagement,
    name: "IPD",
    icon: BedDouble,
  },
  {
    path: "pharmacies",
    element: PharmaciesManagement,
    name: "Pharmacies",
    icon: Pill,
  },
  {
    path: "ivr-escalations",
    element: IvrEscalationsManagement,
    name: "IVR Escalation",
    icon: PhoneCall,
  },
  {
    path: "bookings",
    element: BookingManagement,
    name: "Bookings",
    icon: ClipboardList,
  },
  {
    path: "ambulance-pricing",
    element: AmbulancePricingManagement,
    name: "Ambulance Types & Pricing",
    icon: IndianRupee,
  },
  // ===== HR & Payroll =====
  {
    path: "hr",
    element: HRDashboard,
    name: "HR Dashboard",
    icon: LayoutDashboard,
  },
  {
    path: "employees",
    element: EmployeeManagement,
    name: "Employees",
    icon: UserCog,
  },
  // Drill-in: employee profile, attendance, leaves, payslips. Hidden from sidebar.
  {
    path: "employees/:id",
    element: EmployeeDetail,
    name: "Employee Detail",
    icon: UserCog,
    hidden: true,
  },
  {
    path: "attendance",
    element: AttendanceManagement,
    name: "Attendance",
    icon: CalendarCheck,
  },
  {
    path: "leave",
    element: LeaveManagement,
    name: "Leave",
    icon: CalendarDays,
  },
  {
    path: "holidays",
    element: HolidayManagement,
    name: "Holidays",
    icon: CalendarDays,
  },
  {
    path: "payroll",
    element: PayrollManagement,
    name: "Payroll",
    icon: Wallet,
  },
  {
    path: "ambulance-requests",
    element: AmbulanceRequestsManagement,
    name: "Ambulance Requests",
    icon: AlertTriangle,
  },
  {
    path: "catalog",
    element: CatalogManagement,
    name: "Pharmacy & Lab Catalog",
    icon: HeartPulse,
  },
  {
    path: "membership-plans",
    element: MembershipPlansManagement,
    name: "Membership Plans",
    icon: Award,
  },
  {
    path: "home-promos",
    element: HomePromosManagement,
    name: "Home Promos",
    icon: ImageIcon,
  },
  {
    path: "promo-codes",
    element: PromoCodesManagement,
    name: "Promo Codes",
    icon: TicketPercent,
  },
  {
    path: "reports/bookings",
    element: ReportsBookings,
    name: "Bookings Report",
    icon: BarChart3,
  },
  {
    path: "reports/revenue",
    element: ReportsRevenue,
    name: "Revenue Report",
    icon: IndianRupee,
  },
  {
    path: "reports/users",
    element: ReportsUsers,
    name: "Users Report",
    icon: Users,
  },
  {
    path: "reports/drivers",
    element: ReportsDrivers,
    name: "Drivers Report",
    icon: Car,
  },
  ...(ambulanceFeature
    ? [
        {
          path: "sos-alerts",
          element: SOSAlertsDashboard,
          name: "SOS Alerts (Live)",
          icon: AlertTriangle,
        },
      ]
    : []),
];
