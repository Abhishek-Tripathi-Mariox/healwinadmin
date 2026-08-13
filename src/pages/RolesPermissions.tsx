// src/pages/RolesPermissions.tsx
import { useState, useEffect, useCallback } from "react";
import {
  Users,
  Plus,
  Edit2,
  Trash2,
  Shield,
  X,
  Check,
  Key,
  RefreshCw,
  AlertCircle,
  CheckCircle,
} from "lucide-react";
import { rolesApi } from "../services/admin-api";
import { useAuth } from "../auth/useAuth";
import { PERMISSIONS } from "../auth/permissions";
import {
  PageHeader,
  Button,
  Card,
  Modal,
  Field,
  Input,
} from "../components/ui";

interface Role {
  _id: string;
  name: string;
  description: string;
  permissions: string[];
  isSystem: boolean;
  staffCount: number;
  createdAt: string;
}

// Permission modules - IDs must match backend PERMISSIONS format (using colons).
// Kept in lockstep with backend/src/models/role.model.ts PERMISSIONS: every id
// below must exist there, and every permission there should appear here or it
// is ungrantable through the UI.
const PERMISSION_MODULES = [
  {
    module: "Dashboard",
    permissions: [
      {
        id: "dashboard:view",
        name: "View Dashboard",
        description: "Can view dashboard statistics",
      },
    ],
  },
  {
    module: "SOS Dashboard",
    permissions: [
      {
        id: "sos:view",
        name: "View SOS Alerts",
        description: "Can view SOS alerts",
      },
      {
        id: "sos:respond",
        name: "Respond to SOS",
        description: "Can respond to SOS alerts",
      },
      {
        id: "sos:resolve",
        name: "Resolve SOS",
        description: "Can resolve SOS alerts",
      },
    ],
  },
  {
    module: "Users",
    permissions: [
      { id: "users:view", name: "View Users", description: "Can view patient users" },
      { id: "users:create", name: "Create Users", description: "Can add users" },
      { id: "users:update", name: "Edit Users", description: "Can edit users" },
      { id: "users:delete", name: "Delete Users", description: "Can remove users" },
      { id: "users:block", name: "Block Users", description: "Can block / unblock users" },
    ],
  },
  {
    module: "Drivers",
    permissions: [
      { id: "drivers:view", name: "View Drivers", description: "Can view drivers" },
      { id: "drivers:create", name: "Create Drivers", description: "Can add drivers" },
      { id: "drivers:update", name: "Edit Drivers", description: "Can edit drivers" },
      { id: "drivers:delete", name: "Delete Drivers", description: "Can remove drivers" },
      { id: "drivers:verify", name: "Verify Drivers", description: "Can approve driver KYC" },
      { id: "drivers:block", name: "Block Drivers", description: "Can block / unblock drivers" },
    ],
  },
  {
    module: "Vehicles",
    permissions: [
      { id: "vehicles:view", name: "View Vehicles", description: "Can view vehicles" },
      { id: "vehicles:create", name: "Create Vehicles", description: "Can add vehicles" },
      { id: "vehicles:update", name: "Edit Vehicles", description: "Can edit vehicles" },
      { id: "vehicles:delete", name: "Delete Vehicles", description: "Can remove vehicles" },
    ],
  },
  {
    module: "Bookings",
    permissions: [
      { id: "bookings:view", name: "View Bookings", description: "Can view bookings" },
      { id: "bookings:create", name: "Create Bookings", description: "Can create bookings" },
      { id: "bookings:update", name: "Edit Bookings", description: "Can edit bookings" },
      { id: "bookings:cancel", name: "Cancel Bookings", description: "Can cancel bookings" },
      { id: "bookings:refund", name: "Refund Bookings", description: "Can issue booking refunds" },
    ],
  },
  {
    module: "Payments",
    permissions: [
      { id: "payments:view", name: "View Payments", description: "Can view payments" },
      { id: "payments:process", name: "Process Payments", description: "Can process payments" },
      { id: "payments:refund", name: "Refund Payments", description: "Can issue refunds" },
    ],
  },
  {
    module: "Promo Codes",
    permissions: [
      { id: "promos:view", name: "View Promos", description: "Can view promo codes" },
      { id: "promos:create", name: "Create Promos", description: "Can create promo codes" },
      { id: "promos:update", name: "Edit Promos", description: "Can edit promo codes" },
      { id: "promos:delete", name: "Delete Promos", description: "Can delete promo codes" },
    ],
  },
  {
    module: "Enterprises",
    permissions: [
      { id: "enterprises:view", name: "View Enterprises", description: "Can view B2B accounts" },
      { id: "enterprises:create", name: "Create Enterprises", description: "Can add B2B accounts" },
      { id: "enterprises:update", name: "Edit Enterprises", description: "Can edit B2B accounts" },
      { id: "enterprises:approve", name: "Approve Enterprises", description: "Can approve B2B accounts" },
      { id: "enterprises:suspend", name: "Suspend Enterprises", description: "Can suspend B2B accounts" },
    ],
  },
  {
    module: "Tracking",
    permissions: [
      { id: "tracking:view", name: "View Tracking", description: "Can view live tracking" },
    ],
  },
  {
    module: "Notifications",
    permissions: [
      { id: "notifications:view", name: "View Notifications", description: "Can view notifications" },
      { id: "notifications:send", name: "Send Notifications", description: "Can broadcast notifications" },
    ],
  },
  {
    module: "Support Tickets",
    permissions: [
      { id: "support:view", name: "View Tickets", description: "Can view support tickets" },
      { id: "support:respond", name: "Reply to Tickets", description: "Can reply to tickets" },
      { id: "support:resolve", name: "Resolve Tickets", description: "Can close / resolve tickets" },
      { id: "support:assign", name: "Assign Tickets", description: "Can assign tickets to staff" },
    ],
  },
  {
    module: "Settings",
    permissions: [
      { id: "settings:view", name: "View Settings", description: "Can view app settings" },
      { id: "settings:update", name: "Manage Settings", description: "Can edit app settings" },
    ],
  },
  {
    module: "Team Management",
    permissions: [
      {
        id: "staff:view",
        name: "View Staff",
        description: "Can view staff members",
      },
      {
        id: "staff:create",
        name: "Create Staff",
        description: "Can add staff members",
      },
      {
        id: "staff:update",
        name: "Edit Staff",
        description: "Can edit staff members",
      },
      {
        id: "staff:delete",
        name: "Delete Staff",
        description: "Can remove staff members",
      },
      {
        id: "roles:view",
        name: "View Roles",
        description: "Can view roles",
      },
      {
        id: "roles:create",
        name: "Create Roles",
        description: "Can create roles",
      },
      {
        id: "roles:update",
        name: "Edit Roles",
        description: "Can edit roles",
      },
      {
        id: "roles:delete",
        name: "Delete Roles",
        description: "Can delete roles",
      },
    ],
  },
  {
    module: "Website Team",
    permissions: [
      {
        id: "team:view",
        name: "View Team Members",
        description: "Can view team members",
      },
      {
        id: "team:create",
        name: "Create Team Members",
        description: "Can add team members",
      },
      {
        id: "team:update",
        name: "Edit Team Members",
        description: "Can edit team members",
      },
      {
        id: "team:delete",
        name: "Delete Team Members",
        description: "Can remove team members",
      },
    ],
  },
  {
    module: "Careers",
    permissions: [
      {
        id: "careers:view",
        name: "View Job Listings",
        description: "Can view careers/job listings",
      },
      {
        id: "careers:create",
        name: "Create Job Listings",
        description: "Can create careers/job listings",
      },
      {
        id: "careers:update",
        name: "Edit Job Listings",
        description: "Can edit careers/job listings",
      },
      {
        id: "careers:delete",
        name: "Delete Job Listings",
        description: "Can delete careers/job listings",
      },
    ],
  },
  {
    module: "Applications",
    permissions: [
      {
        id: "applications:view",
        name: "View Applications",
        description: "Can view job applications",
      },
      {
        id: "applications:update",
        name: "Update Applications",
        description: "Can update application status/details",
      },
    ],
  },
  {
    module: "Services",
    permissions: [
      {
        id: "services:view",
        name: "View Services",
        description: "Can view services",
      },
      {
        id: "services:create",
        name: "Create Services",
        description: "Can create services",
      },
      {
        id: "services:update",
        name: "Edit Services",
        description: "Can edit services",
      },
      {
        id: "services:delete",
        name: "Delete Services",
        description: "Can delete services",
      },
    ],
  },
  {
    module: "Categories",
    permissions: [
      {
        id: "categories:view",
        name: "View Categories",
        description: "Can view service categories",
      },
      {
        id: "categories:create",
        name: "Create Categories",
        description: "Can create service categories",
      },
      {
        id: "categories:update",
        name: "Edit Categories",
        description: "Can edit service categories",
      },
      {
        id: "categories:delete",
        name: "Delete Categories",
        description: "Can delete service categories",
      },
    ],
  },
  {
    module: "States",
    permissions: [
      {
        id: "states:view",
        name: "View States",
        description: "Can view states",
      },
      {
        id: "states:create",
        name: "Create States",
        description: "Can create states",
      },
      {
        id: "states:update",
        name: "Edit States",
        description: "Can edit states",
      },
      {
        id: "states:delete",
        name: "Delete States",
        description: "Can delete states",
      },
    ],
  },
  {
    module: "Districts",
    permissions: [
      {
        id: "districts:view",
        name: "View Districts",
        description: "Can view districts",
      },
      {
        id: "districts:create",
        name: "Create Districts",
        description: "Can create districts",
      },
      {
        id: "districts:update",
        name: "Edit Districts",
        description: "Can edit districts",
      },
      {
        id: "districts:delete",
        name: "Delete Districts",
        description: "Can delete districts",
      },
    ],
  },
  {
    module: "Divisions",
    permissions: [
      {
        id: "divisions:view",
        name: "View Divisions",
        description: "Can view divisions",
      },
      {
        id: "divisions:create",
        name: "Create Divisions",
        description: "Can create divisions",
      },
      {
        id: "divisions:update",
        name: "Edit Divisions",
        description: "Can edit divisions",
      },
      {
        id: "divisions:delete",
        name: "Delete Divisions",
        description: "Can delete divisions",
      },
    ],
  },
  {
    module: "Centres",
    permissions: [
      {
        id: "centres:view",
        name: "View Centres",
        description: "Can view centres",
      },
      {
        id: "centres:create",
        name: "Create Centres",
        description: "Can create centres",
      },
      {
        id: "centres:update",
        name: "Edit Centres",
        description: "Can edit centres",
      },
      {
        id: "centres:delete",
        name: "Delete Centres",
        description: "Can delete centres",
      },
    ],
  },
  {
    module: "Service Types",
    permissions: [
      {
        id: "locator_types:view",
        name: "View Service Types",
        description: "Can view locator service types",
      },
      {
        id: "locator_types:create",
        name: "Create Service Types",
        description: "Can create locator service types",
      },
      {
        id: "locator_types:update",
        name: "Edit Service Types",
        description: "Can edit locator service types",
      },
      {
        id: "locator_types:delete",
        name: "Delete Service Types",
        description: "Can delete locator service types",
      },
    ],
  },
  {
    module: "Departments",
    permissions: [
      {
        id: "departments:view",
        name: "View Departments",
        description: "Can view departments",
      },
      {
        id: "departments:create",
        name: "Create Departments",
        description: "Can create departments",
      },
      {
        id: "departments:update",
        name: "Edit Departments",
        description: "Can edit departments",
      },
      {
        id: "departments:delete",
        name: "Delete Departments",
        description: "Can delete departments",
      },
    ],
  },
  {
    module: "Designations",
    permissions: [
      {
        id: "designations:view",
        name: "View Designations",
        description: "Can view designations",
      },
      {
        id: "designations:create",
        name: "Create Designations",
        description: "Can create designations",
      },
      {
        id: "designations:update",
        name: "Edit Designations",
        description: "Can edit designations",
      },
      {
        id: "designations:delete",
        name: "Delete Designations",
        description: "Can delete designations",
      },
    ],
  },
  {
    module: "Employment Types",
    permissions: [
      {
        id: "employment_types:view",
        name: "View Employment Types",
        description: "Can view employment types",
      },
      {
        id: "employment_types:create",
        name: "Create Employment Types",
        description: "Can create employment types",
      },
      {
        id: "employment_types:update",
        name: "Edit Employment Types",
        description: "Can edit employment types",
      },
      {
        id: "employment_types:delete",
        name: "Delete Employment Types",
        description: "Can delete employment types",
      },
    ],
  },
  {
    module: "Home Page",
    permissions: [
      {
        id: "home:view",
        name: "View Home Page",
        description: "Can view home page settings",
      },
      {
        id: "home:update",
        name: "Update Home Page",
        description: "Can update home page settings",
      },
    ],
  },
  {
    module: "About Page",
    permissions: [
      {
        id: "about:view",
        name: "View About Page",
        description: "Can view about page settings",
      },
      {
        id: "about:update",
        name: "Update About Page",
        description: "Can update about page settings",
      },
    ],
  },
  {
    module: "Contact Page",
    permissions: [
      {
        id: "contact:view",
        name: "View Contact Page",
        description: "Can view contact page settings",
      },
      {
        id: "contact:update",
        name: "Update Contact Page",
        description: "Can update contact page settings",
      },
      {
        id: "contact-messages:view",
        name: "View Contact Messages",
        description: "Can view enquiries submitted from the website",
      },
      {
        id: "contact-messages:update",
        name: "Manage Contact Messages",
        description: "Can act on website enquiries",
      },
      {
        id: "contact-messages:delete",
        name: "Delete Contact Messages",
        description: "Can delete website enquiries",
      },
    ],
  },
  {
    module: "CMS Pages",
    permissions: [
      {
        id: "cms:view",
        name: "View CMS Pages",
        description: "Can view CMS pages",
      },
      {
        id: "cms:create",
        name: "Create CMS Pages",
        description: "Can create CMS pages",
      },
      {
        id: "cms:update",
        name: "Edit CMS Pages",
        description: "Can edit CMS pages",
      },
      {
        id: "cms:delete",
        name: "Delete CMS Pages",
        description: "Can delete CMS pages",
      },
    ],
  },
  {
    module: "News Articles",
    permissions: [
      {
        id: "news:view",
        name: "View News",
        description: "Can view news articles",
      },
      {
        id: "news:create",
        name: "Create News",
        description: "Can create news articles",
      },
      {
        id: "news:update",
        name: "Edit News",
        description: "Can edit news articles",
      },
      {
        id: "news:delete",
        name: "Delete News",
        description: "Can delete news articles",
      },
    ],
  },
  {
    module: "Gallery",
    permissions: [
      {
        id: "gallery:view",
        name: "View Gallery",
        description: "Can view gallery items",
      },
      {
        id: "gallery:create",
        name: "Create Gallery Items",
        description: "Can create gallery items",
      },
      {
        id: "gallery:update",
        name: "Edit Gallery Items",
        description: "Can edit gallery items",
      },
      {
        id: "gallery:delete",
        name: "Delete Gallery Items",
        description: "Can delete gallery items",
      },
    ],
  },
  {
    module: "Submissions",
    permissions: [
      {
        id: "submissions:view",
        name: "View Submissions",
        description: "Can view article submissions",
      },
      {
        id: "submissions:update",
        name: "Update Submissions",
        description: "Can review/update article submissions",
      },
      {
        id: "submissions:delete",
        name: "Delete Submissions",
        description: "Can delete article submissions",
      },
    ],
  },
  {
    module: "Logo Management",
    permissions: [
      {
        id: "logo_settings:view",
        name: "View Logo Settings",
        description: "Can view logo settings",
      },
      {
        id: "logo_settings:update",
        name: "Update Logo Settings",
        description: "Can update logo settings",
      },
    ],
  },
  {
    module: "Email Templates",
    permissions: [
      {
        id: "email_templates:view",
        name: "View Email Templates",
        description: "Can view email templates",
      },
      {
        id: "email_templates:create",
        name: "Create Email Templates",
        description: "Can create email templates",
      },
      {
        id: "email_templates:update",
        name: "Edit Email Templates",
        description: "Can edit email templates",
      },
      {
        id: "email_templates:delete",
        name: "Delete Email Templates",
        description: "Can delete email templates",
      },
    ],
  },
  {
    module: "Activity Logs",
    permissions: [
      {
        id: "activity_logs:view",
        name: "View Activity Logs",
        description: "Can view admin activity logs",
      },
    ],
  },
  {
    module: "Reports",
    permissions: [
      {
        id: "reports:view",
        name: "View Reports",
        description: "Can view reports",
      },
      {
        id: "reports:export",
        name: "Export Reports",
        description: "Can export reports",
      },
    ],
  },
  {
    module: "Hospital (HMS) — Patients",
    permissions: [
      { id: "hms_patients:view", name: "View Patients", description: "Can view hospital patient records" },
      { id: "hms_patients:create", name: "Register Patients", description: "Can register new patients" },
      { id: "hms_patients:update", name: "Edit Patients", description: "Can edit patient demographics" },
      { id: "hms_patients:delete", name: "Delete Patients", description: "Can remove patient records" },
    ],
  },
  {
    module: "Hospital (HMS) — EMR",
    permissions: [
      { id: "emr:view", name: "View EMR", description: "Can view SOAP encounters" },
      { id: "emr:create", name: "Create EMR", description: "Can write new encounters" },
      { id: "emr:update", name: "Edit EMR", description: "Can edit existing encounters" },
    ],
  },
  {
    module: "Hospital (HMS) — OPD",
    permissions: [
      { id: "opd:view", name: "View OPD", description: "Can view out-patient queue & visits" },
      { id: "opd:manage", name: "Manage OPD", description: "Can manage out-patient visits" },
    ],
  },
  {
    module: "Hospital (HMS) — IPD & Beds",
    permissions: [
      { id: "ipd:view", name: "View IPD", description: "Can view admissions" },
      { id: "ipd:manage", name: "Manage IPD", description: "Can admit / discharge / transfer" },
      { id: "beds:view", name: "View Beds", description: "Can view wards & bed occupancy" },
      { id: "beds:manage", name: "Manage Beds", description: "Can add / edit wards & beds" },
    ],
  },
  {
    module: "Inventory",
    permissions: [
      { id: "inventory:view", name: "View Inventory", description: "Can view stock & items" },
      { id: "inventory:create", name: "Create Items", description: "Can add inventory items" },
      { id: "inventory:update", name: "Edit Items", description: "Can edit inventory items" },
      { id: "inventory:delete", name: "Delete Items", description: "Can remove inventory items" },
      { id: "inventory:adjust", name: "Adjust Stock", description: "Can record stock in / out movements" },
      { id: "inventory:approve", name: "Approve Adjustments", description: "Can approve write-offs (maker-checker)" },
    ],
  },
  {
    module: "Billing",
    permissions: [
      { id: "billing:view", name: "View Billing", description: "Can view invoices" },
      { id: "billing:create", name: "Create Invoices", description: "Can raise invoices" },
      { id: "billing:update", name: "Edit Invoices", description: "Can edit invoices" },
      { id: "billing:payment", name: "Record Payments", description: "Can record invoice payments" },
      { id: "billing:refund", name: "Refund Invoices", description: "Can issue billing refunds" },
      { id: "billing:reports", name: "Billing Reports", description: "Can view billing reports" },
    ],
  },
  {
    module: "Pharmacies",
    permissions: [
      { id: "pharmacies:view", name: "View Pharmacies", description: "Can view pharmacy listings" },
      { id: "pharmacies:create", name: "Create Pharmacies", description: "Can onboard pharmacies" },
      { id: "pharmacies:update", name: "Edit Pharmacies", description: "Can edit pharmacy listings" },
      { id: "pharmacies:delete", name: "Delete Pharmacies", description: "Can remove pharmacies" },
      { id: "pharmacies:approve", name: "Approve Pharmacies", description: "Can approve pharmacy onboarding" },
    ],
  },
  {
    module: "Labs",
    permissions: [
      { id: "labs:view", name: "View Labs", description: "Can view lab listings" },
      { id: "labs:create", name: "Create Labs", description: "Can onboard labs" },
      { id: "labs:update", name: "Edit Labs", description: "Can edit lab listings" },
      { id: "labs:delete", name: "Delete Labs", description: "Can remove labs" },
      { id: "labs:approve", name: "Approve Labs", description: "Can approve lab onboarding" },
    ],
  },
  {
    module: "IVR Escalation",
    permissions: [
      { id: "ivr:view", name: "View IVR Escalations", description: "Can view SOS phone-tree escalations" },
      { id: "ivr:manage", name: "Manage IVR Escalations", description: "Can act on escalations" },
    ],
  },
  {
    module: "Ambulance — Types & Pricing",
    permissions: [
      { id: "ambulance_config:view", name: "View Ambulance Config", description: "Can view fare config & vehicle types" },
      { id: "ambulance_config:manage", name: "Manage Ambulance Config", description: "Can edit fare config & vehicle types" },
    ],
  },
  {
    module: "Ambulance — Shifts",
    permissions: [
      { id: "ambulance_shifts:view", name: "View Shifts", description: "Can view crew shift roster" },
      { id: "ambulance_shifts:manage", name: "Manage Shifts", description: "Can create / edit crew shifts" },
    ],
  },
  {
    module: "Patient App — Catalog",
    permissions: [
      { id: "catalog:view", name: "View Catalog", description: "Can view doctors / products / lab tests" },
      { id: "catalog:manage", name: "Manage Catalog", description: "Can edit doctors / products / lab tests" },
    ],
  },
  {
    module: "Patient App — Orders",
    permissions: [
      { id: "patient_commerce:view", name: "View Orders", description: "Can view consultations, lab bookings & pharmacy orders" },
      { id: "patient_commerce:manage", name: "Manage Orders", description: "Can act on patient-app orders" },
    ],
  },
  {
    module: "Patient App — Home Promos",
    permissions: [
      { id: "home_promos:view", name: "View Home Promos", description: "Can view app home promo cards" },
      { id: "home_promos:manage", name: "Manage Home Promos", description: "Can edit app home promo cards" },
    ],
  },
  {
    module: "Membership Plans",
    permissions: [
      { id: "membership_plans:view", name: "View Plans", description: "Can view membership plans" },
      { id: "membership_plans:manage", name: "Manage Plans", description: "Can edit membership plans" },
    ],
  },
  {
    module: "Help FAQs",
    permissions: [
      { id: "faq:view", name: "View FAQs", description: "Can view help FAQs" },
      { id: "faq:manage", name: "Manage FAQs", description: "Can edit help FAQs" },
    ],
  },
  {
    module: "Legal Documents",
    permissions: [
      { id: "legal:view", name: "View Legal Content", description: "Can view About / Privacy / T&C" },
      { id: "legal:update", name: "Manage Legal Content", description: "Can edit About / Privacy / T&C" },
    ],
  },
  {
    module: "Centre Requests",
    permissions: [
      { id: "centre_requests:view", name: "View Centre Requests", description: "Can view centre listing requests" },
      { id: "centre_requests:update", name: "Edit Centre Requests", description: "Can act on centre requests" },
      { id: "centre_requests:delete", name: "Delete Centre Requests", description: "Can remove centre requests" },
    ],
  },
  {
    module: "HR — Dashboard",
    permissions: [
      {
        id: "hr_dashboard:view",
        name: "View HR Dashboard",
        description: "Can view the HR dashboard",
      },
    ],
  },
  {
    module: "HR — Employees",
    permissions: [
      { id: "employees:view", name: "View Employees", description: "Can view employees" },
      { id: "employees:create", name: "Create Employees", description: "Can add employees" },
      { id: "employees:update", name: "Edit Employees", description: "Can edit employees" },
      { id: "employees:delete", name: "Delete Employees", description: "Can remove employees" },
      { id: "salary_structure:view", name: "View Salary Structure", description: "Can view salary / CTC" },
      { id: "salary_structure:manage", name: "Manage Salary Structure", description: "Can edit salary / CTC" },
    ],
  },
  {
    module: "HR — Attendance",
    permissions: [
      { id: "attendance:view", name: "View Attendance", description: "Can view attendance" },
      { id: "attendance:manage", name: "Mark Attendance", description: "Can mark / edit attendance" },
    ],
  },
  {
    module: "HR — Leave",
    permissions: [
      { id: "leave:view", name: "View Leave", description: "Can view leave requests & types" },
      { id: "leave:manage", name: "Manage Leave", description: "Can create requests & leave types" },
      { id: "leave:approve", name: "Approve Leave", description: "Can approve / reject leave" },
    ],
  },
  {
    module: "HR — Holidays",
    permissions: [
      { id: "holidays:view", name: "View Holidays", description: "Can view the holiday calendar" },
      { id: "holidays:manage", name: "Manage Holidays", description: "Can add / edit holidays" },
    ],
  },
  {
    module: "HR — Payroll",
    permissions: [
      { id: "payroll:view", name: "View Payroll", description: "Can view payroll & payslips" },
      { id: "payroll:process", name: "Process Payroll", description: "Can generate payroll runs" },
      { id: "payroll:finalize", name: "Finalize Payroll", description: "Can finalize payroll runs" },
    ],
  },
];

export default function RolesPermissions() {
  const { hasPermission } = useAuth();
  const canCreate = hasPermission(PERMISSIONS.ROLES_CREATE);
  const canUpdate = hasPermission(PERMISSIONS.ROLES_UPDATE);
  const canDelete = hasPermission(PERMISSIONS.ROLES_DELETE);

  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [showRoleModal, setShowRoleModal] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [roleForm, setRoleForm] = useState({
    name: "",
    description: "",
    permissions: [] as string[],
  });
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  const fetchRoles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await rolesApi.getAll();
      if (res.success) setRoles(res.data.roles || []);
    } catch (err: any) {
      setError(err.message || "Failed to load roles");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  const openCreateModal = () => {
    setEditingRole(null);
    setRoleForm({ name: "", description: "", permissions: [] });
    setShowRoleModal(true);
  };

  const openEditRoleModal = (role: Role) => {
    setEditingRole(role);
    setRoleForm({
      name: role.name || "",
      description: role.description || "",
      // Spread the FULL stored list, including any permission this UI has no
      // checkbox for — otherwise saving an unrecognised permission would drop it.
      permissions: [...(role.permissions || [])],
    });
    setShowRoleModal(true);
  };

  const handleSaveRole = async () => {
    if (!roleForm.name || roleForm.permissions.length === 0) {
      setError("Please provide a role name and select at least one permission");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (editingRole) {
        await rolesApi.update(editingRole._id, {
          name: roleForm.name,
          description: roleForm.description,
          permissions: roleForm.permissions,
        });
        setSuccess("Role updated successfully");
      } else {
        await rolesApi.create({
          name: roleForm.name,
          description: roleForm.description,
          permissions: roleForm.permissions,
        });
        setSuccess("Role created successfully");
      }
      setShowRoleModal(false);
      setEditingRole(null);
      setRoleForm({ name: "", description: "", permissions: [] });
      fetchRoles();
    } catch (err: any) {
      setError(err.message || "Failed to save role");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRole = async (id: string) => {
    const role = roles.find((r) => r._id === id);
    if (role?.isSystem) {
      setError("Cannot delete system role");
      return;
    }
    if (role && role.staffCount > 0) {
      setError("Cannot delete role with assigned staff members");
      return;
    }
    try {
      await rolesApi.delete(id);
      setSuccess("Role deleted successfully");
      setDeleteConfirm(null);
      fetchRoles();
    } catch (err: any) {
      setError(err.message || "Failed to delete role");
    }
  };

  const togglePermission = (permissionId: string) => {
    setRoleForm((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(permissionId)
        ? prev.permissions.filter((p) => p !== permissionId)
        : [...prev.permissions, permissionId],
    }));
  };

  const toggleModulePermissions = (module: string) => {
    const modulePerms =
      PERMISSION_MODULES.find((m) => m.module === module)?.permissions.map(
        (p) => p.id,
      ) || [];
    const allSelected = modulePerms.every((p) =>
      roleForm.permissions.includes(p),
    );
    setRoleForm((prev) =>
      allSelected
        ? {
            ...prev,
            permissions: prev.permissions.filter(
              (p) => !modulePerms.includes(p),
            ),
          }
        : {
            ...prev,
            permissions: [...new Set([...prev.permissions, ...modulePerms])],
          },
    );
  };

  const systemRoles = roles.filter((r) => r.isSystem).length;
  const totalAssigned = roles.reduce((sum, r) => sum + (r.staffCount || 0), 0);

  return (
    <div className="space-y-6 p-6">
      {success && (
        <div className="flex items-center gap-2 p-4 text-green-700 border border-green-200 bg-green-50 rounded-xl">
          <CheckCircle className="w-5 h-5" />
          <span className="font-medium">{success}</span>
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 p-4 text-red-700 border border-red-200 bg-red-50 rounded-xl">
          <AlertCircle className="w-5 h-5" />
          <span className="font-medium">{error}</span>
          <button
            onClick={() => setError(null)}
            className="ml-2 text-red-600 hover:text-red-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <PageHeader
        title="Roles & Permissions"
        subtitle="Define what each admin role can see and do"
        actions={
          canCreate && (
            <Button icon={<Plus className="w-4 h-4" />} onClick={openCreateModal}>
              Create Role
            </Button>
          )
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Roles</p>
              <p className="mt-1 text-2xl font-bold text-purple-600">
                {roles.length}
              </p>
            </div>
            <div className="flex items-center justify-center w-12 h-12 bg-purple-100 rounded-xl">
              <Key className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">System Roles</p>
              <p className="mt-1 text-2xl font-bold text-gray-800">
                {systemRoles}
              </p>
            </div>
            <div className="flex items-center justify-center w-12 h-12 bg-gray-100 rounded-xl">
              <Shield className="w-6 h-6 text-gray-600" />
            </div>
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Assigned Staff</p>
              <p className="mt-1 text-2xl font-bold text-blue-600">
                {totalAssigned}
              </p>
            </div>
            <div className="flex items-center justify-center w-12 h-12 bg-blue-100 rounded-xl">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </Card>
      </div>

      {loading ? (
        <Card className="p-10 text-center text-gray-500">Loading roles…</Card>
      ) : roles.length === 0 ? (
        <Card className="p-10 text-center text-gray-500">
          No roles yet. Create one to get started.
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {roles.map((role) => {
            const matchedModules = PERMISSION_MODULES.filter((m) =>
              m.permissions.some((p) => role.permissions.includes(p.id)),
            );
            return (
              <Card
                key={role._id}
                className="p-5 transition-shadow hover:shadow-md"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        role.isSystem ? "bg-purple-100" : "bg-blue-100"
                      }`}
                    >
                      <Shield
                        className={`w-5 h-5 ${role.isSystem ? "text-purple-600" : "text-blue-600"}`}
                      />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-800">
                        {role.name}
                      </h3>
                      {role.isSystem && (
                        <span className="text-xs font-medium text-purple-600">
                          System Role
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {/* Permissions are editable on every role; system role
                        names can't change (enforced in the modal + backend). */}
                    {canUpdate && (
                      <button
                        onClick={() => openEditRoleModal(role)}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                        title={role.isSystem ? "Edit permissions" : "Edit"}
                        aria-label="Edit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    )}
                    {canDelete && !role.isSystem && (
                      <button
                        onClick={() => setDeleteConfirm(role._id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                        title="Delete"
                        aria-label="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                <p className="mb-4 text-sm text-gray-500">{role.description}</p>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">
                    <Users className="inline-block w-4 h-4 mr-1" />
                    {role.staffCount} members
                  </span>
                  <span className="text-gray-500">
                    <Key className="inline-block w-4 h-4 mr-1" />
                    {role.permissions.length} permissions
                  </span>
                </div>

                <div className="pt-4 mt-4 border-t border-gray-100">
                  <p className="mb-2 text-xs text-gray-500">Permissions:</p>
                  <div className="flex flex-wrap gap-1">
                    {matchedModules.slice(0, 4).map((m) => (
                      <span
                        key={m.module}
                        className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded"
                      >
                        {m.module}
                      </span>
                    ))}
                    {matchedModules.length > 4 && (
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
                        +{matchedModules.length - 4} more
                      </span>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create / Edit Role */}
      <Modal
        open={showRoleModal}
        onClose={() => setShowRoleModal(false)}
        title={editingRole ? "Edit Role" : "Create New Role"}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowRoleModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveRole}
              icon={
                saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : undefined
              }
              disabled={
                !roleForm.name || roleForm.permissions.length === 0 || saving
              }
            >
              {editingRole ? "Save Changes" : "Create Role"}
            </Button>
          </>
        }
      >
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field
              label="Role Name *"
              hint={
                editingRole?.isSystem
                  ? "System role name can't be changed — only its permissions."
                  : undefined
              }
            >
              <Input
                type="text"
                value={roleForm.name}
                onChange={(e) =>
                  setRoleForm({ ...roleForm, name: e.target.value })
                }
                placeholder="e.g. Support Manager"
                disabled={editingRole?.isSystem}
              />
            </Field>
            <Field label="Description">
              <Input
                type="text"
                value={roleForm.description}
                onChange={(e) =>
                  setRoleForm({ ...roleForm, description: e.target.value })
                }
                placeholder="Brief description of this role"
              />
            </Field>
          </div>

          <div>
            <h4 className="mb-4 font-medium text-gray-800">
              Permissions ({roleForm.permissions.length} selected)
            </h4>
            <div className="space-y-4">
              {PERMISSION_MODULES.map((module) => {
                const modulePerms = module.permissions.map((p) => p.id);
                const selectedCount = modulePerms.filter((p) =>
                  roleForm.permissions.includes(p),
                ).length;
                const allSelected = selectedCount === modulePerms.length;

                return (
                  <div
                    key={module.module}
                    className="overflow-hidden border border-gray-200 rounded-xl"
                  >
                    <div
                      className="flex items-center justify-between p-3 cursor-pointer bg-gray-50"
                      onClick={() => toggleModulePermissions(module.module)}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-5 h-5 rounded border flex items-center justify-center ${
                            allSelected
                              ? "bg-healwin-500 border-healwin-500"
                              : selectedCount > 0
                                ? "bg-healwin-100 border-healwin-300"
                                : "border-gray-300"
                          }`}
                        >
                          {allSelected && (
                            <Check className="w-3 h-3 text-white" />
                          )}
                        </div>
                        <span className="font-medium text-gray-800">
                          {module.module}
                        </span>
                      </div>
                      <span className="text-sm text-gray-500">
                        {selectedCount}/{modulePerms.length}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 gap-2 p-3 md:grid-cols-2">
                      {module.permissions.map((perm) => (
                        <label
                          key={perm.id}
                          className="flex items-center gap-2 p-2 rounded-lg cursor-pointer hover:bg-gray-50"
                        >
                          <input
                            type="checkbox"
                            checked={roleForm.permissions.includes(perm.id)}
                            onChange={() => togglePermission(perm.id)}
                            className="w-4 h-4 rounded text-healwin-500 focus:ring-healwin-500"
                          />
                          <div>
                            <p className="text-sm font-medium text-gray-700">
                              {perm.name}
                            </p>
                            <p className="text-xs text-gray-500">
                              {perm.description}
                            </p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </Modal>

      {/* Delete confirmation */}
      <Modal
        open={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title=""
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => deleteConfirm && handleDeleteRole(deleteConfirm)}
            >
              Delete
            </Button>
          </>
        }
      >
        <div className="text-center">
          <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-red-100 rounded-full">
            <Trash2 className="w-6 h-6 text-red-600" />
          </div>
          <h3 className="mb-2 text-lg font-semibold text-gray-800">
            Delete Role?
          </h3>
          <p className="text-sm text-gray-500">
            This role will be permanently removed. Roles with assigned staff
            can't be deleted.
          </p>
        </div>
      </Modal>
    </div>
  );
}
