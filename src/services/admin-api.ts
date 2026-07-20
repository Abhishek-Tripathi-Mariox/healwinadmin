// Admin API Service
// Resolve the API base robustly: an explicit VITE_API_URL wins; otherwise
// localhost dev hits the local backend, but ANY non-localhost host (e.g. the
// deployed admin.healwin.in) falls back to the production API instead of
// localhost:9050 — so a build that missed .env.production still works.
const resolveApiUrl = (): string => {
  const host = typeof window !== "undefined" ? window.location.hostname : "localhost";
  const isLocal = host === "localhost" || host === "127.0.0.1";
  const fromEnv = (import.meta.env.VITE_API_URL as string | undefined)?.trim();
  // An explicit env URL wins — EXCEPT a localhost URL baked into a DEPLOYED
  // (non-localhost) build. That happens when `vite build` picked up `.env`
  // instead of `.env.production`, and would make the live admin try to reach
  // the developer's machine on :9050 ("Cannot connect to backend"). In that
  // case ignore the bad env and fall back to the production API.
  const envIsLocalhost = !!fromEnv && /localhost|127\.0\.0\.1/.test(fromEnv);
  if (fromEnv && !(envIsLocalhost && !isLocal)) return fromEnv;
  return isLocal ? "http://localhost:9050/v1/api" : "https://apis.healwin.in/v1/api";
};
const API_URL = resolveApiUrl();

// Helper function to get auth token
const getAuthToken = () => localStorage.getItem("adminToken");

// Generic fetch wrapper with auth
const fetchWithAuth = async (endpoint: string, options: RequestInit = {}) => {
  const token = getAuthToken();

  // If no token exists, throw error but don't redirect
  if (!token) {
    console.error("[API] No token found in localStorage");
    throw new Error("No authentication token. Please login.");
  }

  console.log(`[API] Calling: ${API_URL}${endpoint}`);
  console.log(`[API] Token (first 50 chars): ${token.substring(0, 50)}...`);

  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
    });

    console.log(`[API] Response status: ${response.status}`);

    // Handle 401 Unauthorized - token expired or invalid
    if (response.status === 401) {
      const errorData = await response.json().catch(() => ({}));
      console.error("[API] 401 Unauthorized:", errorData);
      // DON'T auto-logout - let the user see the error first
      alert(
        `API returned 401: ${errorData.message || "Session expired"}\n\nCheck console for details.`,
      );
      throw new Error(
        errorData.message || "Session expired. Please login again.",
      );
    }

    // Handle 403 Forbidden - no permission (don't logout)
    if (response.status === 403) {
      const errorData = await response.json().catch(() => ({}));
      console.error("[API] 403 Forbidden:", errorData.message);
      throw new Error(
        errorData.message || "You don't have permission for this action.",
      );
    }

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ message: "Request failed" }));
      const msg = error.message || error.rMsg || error.msg || "Request failed";
      console.error(`[API] Error: ${msg}`);
      throw new Error(msg);
    }

    return response.json();
  } catch (error: any) {
    // Network error or other fetch error
    if (error.name === "TypeError" && error.message === "Failed to fetch") {
      console.error("[API] Network error - is the backend running?");
      alert("Cannot connect to backend. Is the server running on port 9050?");
      throw new Error(
        "Unable to connect to server. Please check your connection.",
      );
    }
    throw error;
  }
};

// ==================== CAREERS API ====================
export const careersApi = {
  getDepartments: () => fetchWithAuth("/admin/careers/departments"),
  getLocations: () => fetchWithAuth("/admin/careers/locations"),
  getTypes: () => fetchWithAuth("/admin/careers/types"),
  getAll: (params?: {
    status?: string;
    q?: string;
    department?: string;
    page?: string;
    limit?: string;
  }) => {
    const query = new URLSearchParams(
      params as Record<string, string>,
    ).toString();
    return fetchWithAuth(`/admin/careers?${query}`);
  },
  getById: (id: string) => fetchWithAuth(`/admin/careers/${id}`),
  create: (data: Record<string, any>) =>
    fetchWithAuth("/admin/careers", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (id: string, data: Record<string, any>) =>
    fetchWithAuth(`/admin/careers/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  remove: (id: string) =>
    fetchWithAuth(`/admin/careers/${id}`, { method: "DELETE" }),
};

// ==================== APPLICATIONS API ====================
export const applicationsApi = {
  getAll: (params?: {
    status?: string;
    careerId?: string;
    q?: string;
    gender?: string;
    department?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: string;
    limit?: string;
  }) => {
    const query = new URLSearchParams(
      Object.fromEntries(
        Object.entries(params || {}).filter(
          ([_, v]) => v !== undefined && v !== "",
        ),
      ) as Record<string, string>,
    ).toString();
    return fetchWithAuth(`/admin/applications?${query}`);
  },
  getById: (id: string) => fetchWithAuth(`/admin/applications/${id}`),
  updateStatus: (id: string, status: string) =>
    fetchWithAuth(`/admin/applications/${id}/status`, {
      method: "PUT",
      body: JSON.stringify({ status }),
    }),
  exportData: (params?: Record<string, string>) => {
    const query = new URLSearchParams(
      Object.fromEntries(
        Object.entries(params || {}).filter(
          ([_, v]) => v !== undefined && v !== "",
        ),
      ) as Record<string, string>,
    ).toString();
    return fetchWithAuth(`/admin/applications/export?${query}`);
  },
};

// ==================== TEAM API ====================
// Multipart fetch wrapper for file uploads
const fetchWithAuthMultipart = async (
  endpoint: string,
  options: RequestInit = {},
) => {
  const token = getAuthToken();
  if (!token) throw new Error("No authentication token. Please login.");

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (response.status === 401) {
    const errorData = await response.json().catch(() => ({}));
    alert(`API returned 401: ${errorData.message || "Session expired"}`);
    throw new Error(errorData.message || "Session expired.");
  }
  if (response.status === 403) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || "No permission.");
  }
  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ message: "Request failed" }));
    throw new Error(error.message || "Request failed");
  }
  return response.json();
};

export const teamApi = {
  getDivisions: () => fetchWithAuth("/admin/team/divisions"),
  getStates: () => fetchWithAuth("/admin/team/states"),
  getAll: (params?: {
    status?: string;
    q?: string;
    division?: string;
    page?: string;
    limit?: string;
  }) => {
    const query = new URLSearchParams(
      params as Record<string, string>,
    ).toString();
    return fetchWithAuth(`/admin/team?${query}`);
  },
  getById: (id: string) => fetchWithAuth(`/admin/team/${id}`),
  create: (data: FormData) =>
    fetchWithAuthMultipart("/admin/team", {
      method: "POST",
      body: data,
    }),
  update: (id: string, data: FormData) =>
    fetchWithAuthMultipart(`/admin/team/${id}`, {
      method: "PUT",
      body: data,
    }),
  remove: (id: string) =>
    fetchWithAuth(`/admin/team/${id}`, { method: "DELETE" }),
};

export const serviceApi = {
  getAll: (params?: {
    status?: string;
    q?: string;
    page?: string;
    limit?: string;
  }) => {
    const query = new URLSearchParams(
      params as Record<string, string>,
    ).toString();
    return fetchWithAuth(`/admin/services?${query}`);
  },
  getById: (id: string) => fetchWithAuth(`/admin/services/${id}`),
  create: (data: FormData) =>
    fetchWithAuthMultipart("/admin/services", {
      method: "POST",
      body: data,
    }),
  update: (id: string, data: FormData) =>
    fetchWithAuthMultipart(`/admin/services/${id}`, {
      method: "PUT",
      body: data,
    }),
  remove: (id: string) =>
    fetchWithAuth(`/admin/services/${id}`, { method: "DELETE" }),
};

// ==================== SERVICE CATEGORIES API ====================
export const categoryApi = {
  getAll: (params?: {
    status?: string;
    q?: string;
    page?: string;
    limit?: string;
  }) => {
    const query = new URLSearchParams(
      params as Record<string, string>,
    ).toString();
    return fetchWithAuth(`/admin/service-categories?${query}`);
  },
  getById: (id: string) => fetchWithAuth(`/admin/service-categories/${id}`),
  create: (data: Record<string, any>) =>
    fetchWithAuth("/admin/service-categories", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (id: string, data: Record<string, any>) =>
    fetchWithAuth(`/admin/service-categories/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  remove: (id: string) =>
    fetchWithAuth(`/admin/service-categories/${id}`, { method: "DELETE" }),
};

// ==================== SOS/EMERGENCY API ====================
export const sosApi = {
  // Get active SOS alerts
  getActiveAlerts: () => fetchWithAuth("/admin/sos/active"),

  // Get all SOS alerts
  getAll: (params?: { status?: string; page?: number; limit?: number }) => {
    const query = new URLSearchParams(
      params as Record<string, string>,
    ).toString();
    return fetchWithAuth(`/admin/sos?${query}`);
  },

  // Respond to SOS
  respond: (id: string) =>
    fetchWithAuth(`/admin/sos/${id}/respond`, { method: "PUT" }),

  // Resolve SOS
  resolve: (id: string, resolution: string) =>
    fetchWithAuth(`/admin/sos/${id}/resolve`, {
      method: "PUT",
      body: JSON.stringify({ resolution }),
    }),

  // Notify police
  notifyPolice: (id: string) =>
    fetchWithAuth(`/admin/sos/${id}/notify-police`, { method: "POST" }),

  // Get SOS stats
  getStats: () => fetchWithAuth("/admin/sos/stats"),
};

// ==================== SOS SUBMISSIONS API (Public SOS) ====================
export const sosSubmissionApi = {
  // Get all submissions with filters
  getAll: (params?: {
    type?: string;
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) => {
    const query = new URLSearchParams(
      Object.fromEntries(
        Object.entries(params || {}).filter(
          ([_, v]) => v !== undefined && v !== "",
        ),
      ) as Record<string, string>,
    ).toString();
    return fetchWithAuth(`/admin/sos-submissions?${query}`);
  },

  // Get submission stats
  getStats: () => fetchWithAuth("/admin/sos-submissions/stats"),

  // Get submissions with location (for map)
  getLocations: (params?: { type?: string; status?: string }) => {
    const query = new URLSearchParams(
      Object.fromEntries(
        Object.entries(params || {}).filter(
          ([_, v]) => v !== undefined && v !== "",
        ),
      ) as Record<string, string>,
    ).toString();
    return fetchWithAuth(`/admin/sos-submissions/locations?${query}`);
  },

  // Get single submission
  getById: (id: string) => fetchWithAuth(`/admin/sos-submissions/${id}`),

  // Update submission status
  updateStatus: (id: string, status: string, resolutionNotes?: string) =>
    fetchWithAuth(`/admin/sos-submissions/${id}/status`, {
      method: "PUT",
      body: JSON.stringify({ status, resolutionNotes }),
    }),

  // Create emergency dispatch for a submission
  createDispatch: (
    id: string,
    data: {
      dispatchType: string;
      serviceName: string;
      servicePhone: string;
      serviceAddress?: string;
      message?: string;
      priority?: string;
      estimatedArrival?: number;
    },
  ) =>
    fetchWithAuth(`/admin/sos-submissions/${id}/dispatch`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Get dispatches for a submission
  getDispatches: (id: string) =>
    fetchWithAuth(`/admin/sos-submissions/${id}/dispatches`),
};

// ==================== EMERGENCY DISPATCH API ====================
export const dispatchApi = {
  // Get all dispatches
  getAll: (params?: {
    dispatchType?: string;
    status?: string;
    priority?: string;
    page?: number;
    limit?: number;
  }) => {
    const query = new URLSearchParams(
      Object.fromEntries(
        Object.entries(params || {}).filter(
          ([_, v]) => v !== undefined && v !== "",
        ),
      ) as Record<string, string>,
    ).toString();
    return fetchWithAuth(`/admin/dispatches?${query}`);
  },

  // Get dispatch stats
  getStats: () => fetchWithAuth("/admin/dispatches/stats"),

  // Update dispatch status
  updateStatus: (
    dispatchId: string,
    status: string,
    data?: { responseNotes?: string; cancelReason?: string },
  ) =>
    fetchWithAuth(`/admin/dispatches/${dispatchId}/status`, {
      method: "PUT",
      body: JSON.stringify({ status, ...data }),
    }),
};

// ==================== DASHBOARD API ====================
export const dashboardApi = {
  // Get dashboard stats
  getStats: () => fetchWithAuth("/admin/dashboard/stats"),

  // Get recent activity
  getRecentActivity: () => fetchWithAuth("/admin/dashboard/activity"),
};

// ==================== REPORTS API ====================
const reportQuery = (params: Record<string, string | undefined>) => {
  const clean = Object.fromEntries(
    Object.entries(params).filter(([, v]) => v),
  ) as Record<string, string>;
  const qs = new URLSearchParams(clean).toString();
  return qs ? `?${qs}` : "";
};

export const reportsApi = {
  // Booking trend + vehicle-type breakdown
  bookings: (dateFrom?: string, dateTo?: string, groupBy?: string) =>
    fetchWithAuth(
      `/admin/reports/bookings${reportQuery({ dateFrom, dateTo, groupBy })}`,
    ),
  // Daily revenue + payment-method split
  revenue: (dateFrom?: string, dateTo?: string) =>
    fetchWithAuth(`/admin/reports/revenue${reportQuery({ dateFrom, dateTo })}`),
  // Monthly user growth + top customers
  users: (dateFrom?: string, dateTo?: string) =>
    fetchWithAuth(`/admin/reports/users${reportQuery({ dateFrom, dateTo })}`),
  // Top drivers + driver status distribution
  drivers: (dateFrom?: string, dateTo?: string) =>
    fetchWithAuth(`/admin/reports/drivers${reportQuery({ dateFrom, dateTo })}`),
};

// ==================== HMS OPERATIONAL ALERTS API ====================
export const alertsApi = {
  get: () => fetchWithAuth("/admin/alerts"),
};

// ==================== CONFIG: FARE + VEHICLE TYPES API ====================
export const configApi = {
  getFareConfig: () => fetchWithAuth("/admin/config/fare-config"),
  updateFareConfig: (data: Record<string, unknown>) =>
    fetchWithAuth("/admin/config/fare-config", {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  getVehicleTypes: () => fetchWithAuth("/admin/config/vehicle-types"),
  createVehicleType: (data: Record<string, unknown>) =>
    fetchWithAuth("/admin/config/vehicle-types", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateVehicleType: (id: string, data: Record<string, unknown>) =>
    fetchWithAuth(`/admin/config/vehicle-types/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  toggleVehicleType: (id: string) =>
    fetchWithAuth(`/admin/config/vehicle-types/${id}/toggle`, {
      method: "PATCH",
    }),
  deleteVehicleType: (id: string) =>
    fetchWithAuth(`/admin/config/vehicle-types/${id}`, { method: "DELETE" }),
};

// ==================== BOOKING MANAGEMENT API ====================
export const bookingsApi = {
  getAll: (params: Record<string, string> = {}) => {
    const qs = new URLSearchParams(params).toString();
    return fetchWithAuth(`/admin/bookings${qs ? `?${qs}` : ""}`);
  },
  drivers: () => fetchWithAuth("/admin/bookings/drivers"),
  getById: (id: string) => fetchWithAuth(`/admin/bookings/${id}`),
  assign: (id: string, driverId: string) =>
    fetchWithAuth(`/admin/bookings/${id}/assign`, {
      method: "POST",
      body: JSON.stringify({ driverId }),
    }),
  cancel: (id: string, reason?: string, refundAmount?: number) =>
    fetchWithAuth(`/admin/bookings/${id}/cancel`, {
      method: "POST",
      body: JSON.stringify({ reason, refundAmount }),
    }),
};

// ==================== STAFF MANAGEMENT API ====================
export const staffApi = {
  // Get all staff members
  getAll: (params?: {
    role?: string;
    status?: string;
    page?: number;
    limit?: number;
    search?: string;
  }) => {
    const query = new URLSearchParams(
      params as Record<string, string>,
    ).toString();
    return fetchWithAuth(`/admin/staff?${query}`);
  },

  // Get single staff member
  getById: (id: string) => fetchWithAuth(`/admin/staff/${id}`),

  // Create staff member
  create: (data: {
    fullName: string;
    email: string;
    phone?: string;
    password: string;
    roleId: string;
    doctorProfile?: Record<string, any>;
  }) =>
    fetchWithAuth("/admin/staff", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Update staff member
  update: (
    id: string,
    data: {
      fullName?: string;
      email?: string;
      phone?: string;
      roleId?: string;
      doctorProfile?: Record<string, any>;
    },
  ) =>
    fetchWithAuth(`/admin/staff/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // Delete staff member
  delete: (id: string) =>
    fetchWithAuth(`/admin/staff/${id}`, { method: "DELETE" }),

  // Activate/Deactivate staff
  toggleStatus: (id: string) =>
    fetchWithAuth(`/admin/staff/${id}/toggle-status`, { method: "PUT" }),

  // Reset password
  resetPassword: (id: string, newPassword: string) =>
    fetchWithAuth(`/admin/staff/${id}/reset-password`, {
      method: "PUT",
      body: JSON.stringify({ newPassword }),
    }),

  // Get activity log
  getActivityLog: (id: string, params?: { page?: number; limit?: number }) => {
    const query = new URLSearchParams(
      params as Record<string, string>,
    ).toString();
    return fetchWithAuth(`/admin/staff/${id}/activity?${query}`);
  },
};

// ==================== ROLES API ====================
export const rolesApi = {
  // Get all roles
  getAll: () => fetchWithAuth("/admin/roles"),

  // Get single role
  getById: (id: string) => fetchWithAuth(`/admin/roles/${id}`),

  // Create role
  create: (data: {
    name: string;
    description?: string;
    permissions: string[];
  }) =>
    fetchWithAuth("/admin/roles", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Update role
  update: (
    id: string,
    data: { name?: string; description?: string; permissions?: string[] },
  ) =>
    fetchWithAuth(`/admin/roles/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // Delete role
  delete: (id: string) =>
    fetchWithAuth(`/admin/roles/${id}`, { method: "DELETE" }),

  // Get all permissions
  getPermissions: () => fetchWithAuth("/admin/roles/permissions"),

  // Initialize default roles
  initializeDefaults: () =>
    fetchWithAuth("/admin/roles/initialize", { method: "POST" }),

  // Get sidebar modules
  getSidebarModules: () => fetchWithAuth("/admin/sidebar-modules"),
};

// ==================== STATE API ====================
export const stateApi = {
  getAll: (params?: {
    status?: string;
    q?: string;
    page?: string;
    limit?: string;
  }) => {
    const query = new URLSearchParams(
      params as Record<string, string>,
    ).toString();
    return fetchWithAuth(`/admin/states?${query}`);
  },
  getById: (id: string) => fetchWithAuth(`/admin/states/${id}`),
  create: (data: Record<string, any>) =>
    fetchWithAuth("/admin/states", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (id: string, data: Record<string, any>) =>
    fetchWithAuth(`/admin/states/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  remove: (id: string) =>
    fetchWithAuth(`/admin/states/${id}`, { method: "DELETE" }),
};

// ==================== DISTRICT API ====================
export const districtApi = {
  getAll: (params?: {
    status?: string;
    q?: string;
    state?: string;
    page?: string;
    limit?: string;
  }) => {
    const query = new URLSearchParams(
      params as Record<string, string>,
    ).toString();
    return fetchWithAuth(`/admin/districts?${query}`);
  },
  getById: (id: string) => fetchWithAuth(`/admin/districts/${id}`),
  create: (data: Record<string, any>) =>
    fetchWithAuth("/admin/districts", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (id: string, data: Record<string, any>) =>
    fetchWithAuth(`/admin/districts/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  remove: (id: string) =>
    fetchWithAuth(`/admin/districts/${id}`, { method: "DELETE" }),
};

// ==================== DIVISION API ====================
export const divisionApi = {
  getAll: (params?: {
    status?: string;
    q?: string;
    district?: string;
    page?: string;
    limit?: string;
  }) => {
    const query = new URLSearchParams(
      params as Record<string, string>,
    ).toString();
    return fetchWithAuth(`/admin/divisions?${query}`);
  },
  getById: (id: string) => fetchWithAuth(`/admin/divisions/${id}`),
  create: (data: Record<string, any>) =>
    fetchWithAuth("/admin/divisions", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (id: string, data: Record<string, any>) =>
    fetchWithAuth(`/admin/divisions/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  remove: (id: string) =>
    fetchWithAuth(`/admin/divisions/${id}`, { method: "DELETE" }),
};

// ==================== DEPARTMENT API ====================
export const departmentApi = {
  getAll: (params?: {
    status?: string;
    q?: string;
    page?: string;
    limit?: string;
  }) => {
    const query = new URLSearchParams(
      params as Record<string, string>,
    ).toString();
    return fetchWithAuth(`/admin/departments?${query}`);
  },
  getById: (id: string) => fetchWithAuth(`/admin/departments/${id}`),
  create: (data: Record<string, any>) =>
    fetchWithAuth("/admin/departments", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (id: string, data: Record<string, any>) =>
    fetchWithAuth(`/admin/departments/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  remove: (id: string) =>
    fetchWithAuth(`/admin/departments/${id}`, { method: "DELETE" }),
};

// ==================== DESIGNATION API ====================
export const designationApi = {
  getAll: (params?: {
    status?: string;
    q?: string;
    page?: string;
    limit?: string;
  }) => {
    const query = new URLSearchParams(
      params as Record<string, string>,
    ).toString();
    return fetchWithAuth(`/admin/designations?${query}`);
  },
  getById: (id: string) => fetchWithAuth(`/admin/designations/${id}`),
  create: (data: Record<string, any>) =>
    fetchWithAuth("/admin/designations", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (id: string, data: Record<string, any>) =>
    fetchWithAuth(`/admin/designations/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  remove: (id: string) =>
    fetchWithAuth(`/admin/designations/${id}`, { method: "DELETE" }),
};

// ==================== EMPLOYMENT TYPE API ====================
export const employmentTypeApi = {
  getAll: (params?: {
    status?: string;
    q?: string;
    page?: string;
    limit?: string;
  }) => {
    const query = new URLSearchParams(
      params as Record<string, string>,
    ).toString();
    return fetchWithAuth(`/admin/employment-types?${query}`);
  },
  getById: (id: string) => fetchWithAuth(`/admin/employment-types/${id}`),
  create: (data: Record<string, any>) =>
    fetchWithAuth("/admin/employment-types", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (id: string, data: Record<string, any>) =>
    fetchWithAuth(`/admin/employment-types/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  remove: (id: string) =>
    fetchWithAuth(`/admin/employment-types/${id}`, { method: "DELETE" }),
};

// ==================== LOCATOR SERVICE TYPE API ====================
export const locatorServiceTypeApi = {
  getAll: (params?: {
    status?: string;
    q?: string;
    applicableTo?: string;
    page?: string;
    limit?: string;
  }) => {
    const query = new URLSearchParams(
      params as Record<string, string>,
    ).toString();
    return fetchWithAuth(`/admin/locator-service-types?${query}`);
  },
  getById: (id: string) => fetchWithAuth(`/admin/locator-service-types/${id}`),
  create: (data: Record<string, any>) =>
    fetchWithAuth("/admin/locator-service-types", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (id: string, data: Record<string, any>) =>
    fetchWithAuth(`/admin/locator-service-types/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  remove: (id: string) =>
    fetchWithAuth(`/admin/locator-service-types/${id}`, { method: "DELETE" }),
};

// ==================== CENTRE API ====================
export const centreApi = {
  getAll: (params?: {
    status?: string;
    q?: string;
    state?: string;
    district?: string;
    type?: string;
    serviceType?: string;
    page?: string;
    limit?: string;
  }) => {
    const query = new URLSearchParams(
      params as Record<string, string>,
    ).toString();
    return fetchWithAuth(`/admin/centres?${query}`);
  },
  getById: (id: string) => fetchWithAuth(`/admin/centres/${id}`),
  create: (data: FormData) =>
    fetchWithAuthMultipart("/admin/centres", { method: "POST", body: data }),
  update: (id: string, data: FormData) =>
    fetchWithAuthMultipart(`/admin/centres/${id}`, {
      method: "PUT",
      body: data,
    }),
  remove: (id: string) =>
    fetchWithAuth(`/admin/centres/${id}`, { method: "DELETE" }),
};

// ==================== CENTRE REQUESTS API ====================
export const centreRequestApi = {
  getAll: (params?: {
    status?: string;
    q?: string;
    page?: string;
    limit?: string;
  }) => {
    const query = new URLSearchParams(
      params as Record<string, string>,
    ).toString();
    return fetchWithAuth(`/admin/centre-requests?${query}`);
  },
  getById: (id: string) => fetchWithAuth(`/admin/centre-requests/${id}`),
  approve: (
    id: string,
    data?: { adminNote?: string; state?: string; district?: string },
  ) =>
    fetchWithAuth(`/admin/centre-requests/${id}/approve`, {
      method: "POST",
      body: JSON.stringify(data || {}),
    }),
  reject: (id: string, data?: { adminNote?: string }) =>
    fetchWithAuth(`/admin/centre-requests/${id}/reject`, {
      method: "POST",
      body: JSON.stringify(data || {}),
    }),
  remove: (id: string) =>
    fetchWithAuth(`/admin/centre-requests/${id}`, { method: "DELETE" }),
};

// ==================== CMS API ====================
export const cmsApi = {
  getAll: (params?: { q?: string; page?: string; limit?: string }) => {
    const query = new URLSearchParams(
      params as Record<string, string>,
    ).toString();
    return fetchWithAuth(`/admin/cms?${query}`);
  },
  getById: (id: string) => fetchWithAuth(`/admin/cms/${id}`),
  create: (data: Record<string, any>) =>
    fetchWithAuth("/admin/cms", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: Record<string, any>) =>
    fetchWithAuth(`/admin/cms/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  remove: (id: string) =>
    fetchWithAuth(`/admin/cms/${id}`, { method: "DELETE" }),
  uploadImage: (file: File) => {
    const formData = new FormData();
    formData.append("image", file);
    return fetchWithAuthMultipart("/admin/cms/upload-image", {
      method: "POST",
      body: formData,
    });
  },
};

// ==================== ABOUT PAGE CONTENT API ====================
export const aboutContentApi = {
  get: () => fetchWithAuth("/admin/about-content"),
  update: (data: Record<string, any>) =>
    fetchWithAuth("/admin/about-content", {
      method: "PUT",
      body: JSON.stringify(data),
    }),
};

// ==================== LEGAL CONTENT API ====================
// One singleton per (type, audience). The page edits all six cells
// (3 types × 2 audiences) from the same surface; we always upsert by
// the compound key so editors can tab freely.
export const legalContentApi = {
  list: () => fetchWithAuth("/admin/legal-documents"),
  get: (type: string, audience: string) =>
    fetchWithAuth(`/admin/legal-documents/${type}/${audience}`),
  update: (
    type: string,
    audience: string,
    data: { title?: string; content: string },
  ) =>
    fetchWithAuth(`/admin/legal-documents/${type}/${audience}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
};

// ==================== HOME PAGE CONTENT API ====================
export const homeContentApi = {
  get: () => fetchWithAuth("/admin/home-content"),
  update: (
    data: Record<string, any>,
    heroImageFile?: File,
    appMockupImageFile?: File,
  ) => {
    const formData = new FormData();
    // Strip image URLs from data payload (they're handled by file upload)
    const { heroImage, appMockupImage, ...rest } = data;
    formData.append("data", JSON.stringify(rest));
    if (heroImageFile) {
      formData.append("heroImage", heroImageFile);
    }
    if (appMockupImageFile) {
      formData.append("appMockupImage", appMockupImageFile);
    }
    return fetchWithAuthMultipart("/admin/home-content", {
      method: "PUT",
      body: formData,
    });
  },
};

// ==================== CONTACT PAGE CONTENT API ====================
export const contactContentApi = {
  get: () => fetchWithAuth("/admin/contact-content"),
  update: (data: Record<string, any>) =>
    fetchWithAuth("/admin/contact-content", {
      method: "PUT",
      body: JSON.stringify(data),
    }),
};

// ==================== CONTACT MESSAGES API ====================
export const contactMessagesApi = {
  getAll: (params?: {
    status?: string;
    q?: string;
    page?: string;
    limit?: string;
  }) => {
    const query = new URLSearchParams(
      params as Record<string, string>,
    ).toString();
    return fetchWithAuth(`/admin/contact-messages?${query}`);
  },
  getStats: () => fetchWithAuth("/admin/contact-messages/stats"),
  getById: (id: string) => fetchWithAuth(`/admin/contact-messages/${id}`),
  update: (id: string, data: Record<string, any>) =>
    fetchWithAuth(`/admin/contact-messages/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  remove: (id: string) =>
    fetchWithAuth(`/admin/contact-messages/${id}`, { method: "DELETE" }),
};

// ==================== NEWS ARTICLES API ====================
export const newsApi = {
  getAll: (params?: {
    status?: string;
    q?: string;
    category?: string;
    page?: string;
    limit?: string;
  }) => {
    const query = new URLSearchParams(
      params as Record<string, string>,
    ).toString();
    return fetchWithAuth(`/admin/news?${query}`);
  },
  getById: (id: string) => fetchWithAuth(`/admin/news/${id}`),
  getCategories: () => fetchWithAuth("/admin/news/categories"),
  create: (data: FormData) =>
    fetchWithAuthMultipart("/admin/news", { method: "POST", body: data }),
  update: (id: string, data: FormData) =>
    fetchWithAuthMultipart(`/admin/news/${id}`, { method: "PUT", body: data }),
  remove: (id: string) =>
    fetchWithAuth(`/admin/news/${id}`, { method: "DELETE" }),
  uploadImage: (file: File) => {
    const formData = new FormData();
    formData.append("image", file);
    return fetchWithAuthMultipart("/admin/news/upload-image", {
      method: "POST",
      body: formData,
    });
  },
};

// ==================== GALLERY API ====================
export const galleryApi = {
  getAll: (params?: {
    q?: string;
    category?: string;
    page?: string;
    limit?: string;
  }) => {
    const query = new URLSearchParams(
      params as Record<string, string>,
    ).toString();
    return fetchWithAuth(`/admin/gallery?${query}`);
  },
  getById: (id: string) => fetchWithAuth(`/admin/gallery/${id}`),
  getCategories: () => fetchWithAuth("/admin/gallery/categories"),
  create: (data: FormData) =>
    fetchWithAuthMultipart("/admin/gallery", { method: "POST", body: data }),
  update: (id: string, data: FormData) =>
    fetchWithAuthMultipart(`/admin/gallery/${id}`, {
      method: "PUT",
      body: data,
    }),
  remove: (id: string) =>
    fetchWithAuth(`/admin/gallery/${id}`, { method: "DELETE" }),
};

// ==================== ARTICLE SUBMISSIONS API ====================
export const articleSubmissionsApi = {
  getAll: (params?: {
    status?: string;
    q?: string;
    type?: string;
    page?: string;
    limit?: string;
  }) => {
    const query = new URLSearchParams(
      params as Record<string, string>,
    ).toString();
    return fetchWithAuth(`/admin/article-submissions?${query}`);
  },
  getById: (id: string) => fetchWithAuth(`/admin/article-submissions/${id}`),
  review: (id: string, data: { status: string; reviewNote?: string }) =>
    fetchWithAuth(`/admin/article-submissions/${id}/review`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  remove: (id: string) =>
    fetchWithAuth(`/admin/article-submissions/${id}`, { method: "DELETE" }),
};

// ==================== DEFAULT EXPORT ====================

// ==================== LOGO SETTINGS API ====================
export const logoSettingsApi = {
  get: () => fetchWithAuth("/admin/logo-settings"),
  update: (data: FormData) =>
    fetchWithAuthMultipart("/admin/logo-settings", {
      method: "PUT",
      body: data,
    }),
};

// ==================== ACTIVITY LOGS API ====================
export const activityLogsApi = {
  getAll: (params?: {
    staffId?: string;
    module?: string;
    timeRange?: string;
    page?: string;
    limit?: string;
    dateFrom?: string;
    dateTo?: string;
  }) => {
    const query = new URLSearchParams(
      Object.fromEntries(
        Object.entries(params || {}).filter(
          ([_, v]) => v !== undefined && v !== "",
        ),
      ) as Record<string, string>,
    ).toString();
    return fetchWithAuth(`/admin/activity-logs?${query}`);
  },
  getStaff: () => fetchWithAuth("/admin/activity-logs/staff"),
  getModules: () => fetchWithAuth("/admin/activity-logs/modules"),
};

// ==================== EMAIL TEMPLATES API ====================
export const emailTemplateApi = {
  getAll: (params?: {
    type?: string;
    q?: string;
    page?: string;
    limit?: string;
  }) => {
    const query = new URLSearchParams(
      Object.fromEntries(
        Object.entries(params || {}).filter(
          ([_, v]) => v !== undefined && v !== "",
        ),
      ) as Record<string, string>,
    ).toString();
    return fetchWithAuth(`/admin/email-templates?${query}`);
  },
  getById: (id: string) => fetchWithAuth(`/admin/email-templates/${id}`),
  create: (data: Record<string, any>) =>
    fetchWithAuth("/admin/email-templates", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (id: string, data: Record<string, any>) =>
    fetchWithAuth(`/admin/email-templates/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  remove: (id: string) =>
    fetchWithAuth(`/admin/email-templates/${id}`, { method: "DELETE" }),
  sendTestEmail: (templateId: string, testEmail: string) =>
    fetchWithAuth("/admin/email-templates/test", {
      method: "POST",
      body: JSON.stringify({ templateId, testEmail }),
    }),
  getSmtpStatus: () => fetchWithAuth("/admin/email-templates/smtp-status"),
  getPlaceholders: (type: string) =>
    fetchWithAuth(`/admin/email-templates/placeholders?type=${type}`),
};

// ==================== SMTP SETTINGS API ====================
export const smtpSettingsApi = {
  get: (purpose: "notifications" | "otp" = "notifications") =>
    fetchWithAuth(`/admin/smtp-settings?purpose=${purpose}`),
  update: (
    data: Record<string, any>,
    purpose: "notifications" | "otp" = "notifications",
  ) =>
    fetchWithAuth(`/admin/smtp-settings?purpose=${purpose}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  testConnection: (purpose: "notifications" | "otp" = "notifications") =>
    fetchWithAuth(`/admin/smtp-settings/test?purpose=${purpose}`, {
      method: "POST",
    }),
};

// ==================== SMS SETTINGS API ====================
// ==================== NOTIFICATIONS API ====================
export const notificationsApi = {
  stats: () => fetchWithAuth("/admin/notifications/stats"),
  history: (params?: { page?: number; limit?: number; type?: string }) => {
    const query = new URLSearchParams(
      Object.fromEntries(
        Object.entries(params || {}).filter(
          ([_, v]) => v !== undefined && v !== "",
        ),
      ) as Record<string, string>,
    ).toString();
    return fetchWithAuth(`/admin/notifications/history?${query}`);
  },
  searchUsers: (q: string) =>
    fetchWithAuth(`/admin/notifications/users?q=${encodeURIComponent(q)}`),
  broadcast: (data: {
    title: string;
    body: string;
    audience?: "ALL" | "ANONYMOUS" | "PATIENTS" | "DRIVERS";
    route?: string;
    type?: string;
    data?: Record<string, string>;
  }) =>
    fetchWithAuth("/admin/notifications/broadcast", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  sendToUser: (data: {
    userId: string;
    title: string;
    body: string;
    route?: string;
    type?: string;
    data?: Record<string, string>;
  }) =>
    fetchWithAuth("/admin/notifications/send-to-user", {
      method: "POST",
      body: JSON.stringify(data),
    }),
};

export const smsSettingsApi = {
  get: () => fetchWithAuth("/admin/sms-settings"),
  getStatus: () => fetchWithAuth("/admin/sms-settings/status"),
  update: (data: Record<string, any>) =>
    fetchWithAuth("/admin/sms-settings", {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  testConnection: () =>
    fetchWithAuth("/admin/sms-settings/test", { method: "POST" }),
};

// ==================== USERS (Patient app) API ====================
export const usersApi = {
  getStats: () => fetchWithAuth("/admin/users/stats"),
  list: (params: Record<string, string | number | undefined> = {}) => {
    const cleaned: Record<string, string> = {};
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== "" && v !== null) cleaned[k] = String(v);
    });
    const qs = new URLSearchParams(cleaned).toString();
    return fetchWithAuth(`/admin/users${qs ? `?${qs}` : ""}`);
  },
  detail: (id: string) => fetchWithAuth(`/admin/users/${id}`),
  update: (id: string, data: Record<string, unknown>) =>
    fetchWithAuth(`/admin/users/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  setStatus: (id: string, isActive: boolean, reason?: string) =>
    fetchWithAuth(`/admin/users/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ isActive, reason }),
    }),
  block: (id: string, reason?: string) =>
    fetchWithAuth(`/admin/users/${id}/block`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),
  unblock: (id: string) =>
    fetchWithAuth(`/admin/users/${id}/unblock`, { method: "POST" }),
  remove: (id: string) =>
    fetchWithAuth(`/admin/users/${id}`, { method: "DELETE" }),
  restore: (id: string) =>
    fetchWithAuth(`/admin/users/${id}/restore`, { method: "POST" }),
  bookings: (id: string, params: Record<string, string | number> = {}) => {
    const qs = new URLSearchParams(params as any).toString();
    return fetchWithAuth(`/admin/users/${id}/bookings${qs ? `?${qs}` : ""}`);
  },
  wallet: (id: string) => fetchWithAuth(`/admin/users/${id}/wallet`),
  creditWallet: (id: string, amount: number, reason?: string) =>
    fetchWithAuth(`/admin/users/${id}/wallet/credit`, {
      method: "POST",
      body: JSON.stringify({ amount, reason }),
    }),
  transactions: (id: string, params: Record<string, string | number> = {}) => {
    const qs = new URLSearchParams(params as any).toString();
    return fetchWithAuth(
      `/admin/users/${id}/transactions${qs ? `?${qs}` : ""}`,
    );
  },
  addresses: (id: string) => fetchWithAuth(`/admin/users/${id}/addresses`),
};

// ==================== AMBULANCE SERVICE PROVIDERS API ====================
export const providerApi = {
  list: (params: Record<string, string | number | boolean> = {}) => {
    const qs = new URLSearchParams(params as any).toString();
    return fetchWithAuth(`/admin/service-providers${qs ? `?${qs}` : ""}`);
  },
  detail: (id: string) => fetchWithAuth(`/admin/service-providers/${id}`),
  create: (data: Record<string, unknown>) =>
    fetchWithAuth("/admin/service-providers", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (id: string, data: Record<string, unknown>) =>
    fetchWithAuth(`/admin/service-providers/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  remove: (id: string) =>
    fetchWithAuth(`/admin/service-providers/${id}`, { method: "DELETE" }),
};

// ==================== AMBULANCES API ====================
export const ambulanceApi = {
  list: (params: Record<string, string | number | boolean> = {}) => {
    const qs = new URLSearchParams(params as any).toString();
    return fetchWithAuth(`/admin/ambulances${qs ? `?${qs}` : ""}`);
  },
  detail: (id: string) => fetchWithAuth(`/admin/ambulances/${id}`),
  create: (data: Record<string, unknown>) =>
    fetchWithAuth("/admin/ambulances", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (id: string, data: Record<string, unknown>) =>
    fetchWithAuth(`/admin/ambulances/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  // Backend assigns ONE seat per call and derives the seat from the staff's
  // own role — the client only sends staffId.
  assign: (id: string, staffId: string) =>
    fetchWithAuth(`/admin/ambulances/${id}/assign`, {
      method: "POST",
      body: JSON.stringify({ staffId }),
    }),
  unassign: (id: string, role: "driver" | "attendant") =>
    fetchWithAuth(`/admin/ambulances/${id}/unassign`, {
      method: "POST",
      body: JSON.stringify({ role }),
    }),
  remove: (id: string) =>
    fetchWithAuth(`/admin/ambulances/${id}`, { method: "DELETE" }),
  // Manually free a stuck ambulance: cancels its active dispatch + notifies
  // crew/patient, then flips it back to available.
  free: (id: string, reason?: string) =>
    fetchWithAuth(`/admin/ambulances/${id}/free`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),
};

// ==================== SHIFTS API ====================
export const shiftApi = {
  list: (params: Record<string, string | number | boolean> = {}) => {
    const qs = new URLSearchParams(params as any).toString();
    return fetchWithAuth(`/admin/shifts${qs ? `?${qs}` : ""}`);
  },
  detail: (id: string) => fetchWithAuth(`/admin/shifts/${id}`),
  // staffId is now optional — leave it out to create an "open" shift
  // that admin assigns later via assignStaff().
  create: (data: {
    ambulanceId: string;
    staffId?: string;
    role: "driver" | "attendant";
    startAt: string;
    endAt: string;
    notes?: string;
  }) =>
    fetchWithAuth("/admin/shifts", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (id: string, data: {
    startAt?: string;
    endAt?: string;
    notes?: string;
  }) =>
    fetchWithAuth(`/admin/shifts/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  cancel: (id: string, reason?: string) =>
    fetchWithAuth(`/admin/shifts/${id}/cancel`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),
  assignStaff: (id: string, staffId: string) =>
    fetchWithAuth(`/admin/shifts/${id}/assign`, {
      method: "POST",
      body: JSON.stringify({ staffId }),
    }),
  unassignStaff: (id: string) =>
    fetchWithAuth(`/admin/shifts/${id}/unassign`, {
      method: "POST",
    }),
};

// ==================== HOSPITALS API ====================
// Hospitals are Centre rows from the Centre Locator that employ
// ambulance attendants. The list endpoint returns enriched rows with
// a `staffCount` for at-a-glance triage on the listing page.
export const hospitalApi = {
  list: (params: Record<string, string | number | boolean> = {}) => {
    const qs = new URLSearchParams(params as any).toString();
    return fetchWithAuth(`/admin/hospitals${qs ? `?${qs}` : ""}`);
  },
  detail: (id: string) => fetchWithAuth(`/admin/hospitals/${id}`),
  staff: (id: string, params: Record<string, string | number | boolean> = {}) => {
    const qs = new URLSearchParams(params as any).toString();
    return fetchWithAuth(`/admin/hospitals/${id}/staff${qs ? `?${qs}` : ""}`);
  },
  // Hospital staff are NOT linked to any service provider — they're
  // employed by the hospital directly. Backend forces role to attendant
  // and providerId to null on insert.
  createStaff: (
    id: string,
    data: {
      fullName: string;
      mobileNumber: string;
      email?: string;
      gender?: string;
      certifications?: string[];
    },
  ) =>
    fetchWithAuth(`/admin/hospitals/${id}/staff`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  assignStaff: (id: string, staffId: string) =>
    fetchWithAuth(`/admin/hospitals/${id}/staff/assign`, {
      method: "POST",
      body: JSON.stringify({ staffId }),
    }),
  removeStaff: (id: string, staffId: string) =>
    fetchWithAuth(`/admin/hospitals/${id}/staff/${staffId}`, {
      method: "DELETE",
    }),
};

// ==================== OFF-DUTY REASONS API ====================
export const offDutyReasonsApi = {
  list: (params: Record<string, string | number | boolean> = {}) => {
    const qs = new URLSearchParams(params as any).toString();
    return fetchWithAuth(`/admin/off-duty-reasons${qs ? `?${qs}` : ""}`);
  },
  create: (data: { label: string; isActive?: boolean; sortOrder?: number }) =>
    fetchWithAuth("/admin/off-duty-reasons", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (
    id: string,
    data: { label?: string; isActive?: boolean; sortOrder?: number },
  ) =>
    fetchWithAuth(`/admin/off-duty-reasons/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  remove: (id: string) =>
    fetchWithAuth(`/admin/off-duty-reasons/${id}`, { method: "DELETE" }),
};

// ==================== AMBULANCE STAFF API ====================
export const ambulanceStaffApi = {
  list: (params: Record<string, string | number | boolean> = {}) => {
    const qs = new URLSearchParams(params as any).toString();
    return fetchWithAuth(`/admin/ambulance-staff${qs ? `?${qs}` : ""}`);
  },
  detail: (id: string) => fetchWithAuth(`/admin/ambulance-staff/${id}`),
  create: (data: Record<string, unknown>) =>
    fetchWithAuth("/admin/ambulance-staff", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (id: string, data: Record<string, unknown>) =>
    fetchWithAuth(`/admin/ambulance-staff/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deactivate: (id: string) =>
    fetchWithAuth(`/admin/ambulance-staff/${id}/deactivate`, { method: "POST" }),
  // Control-centre remote on/off-duty toggle.
  setDuty: (id: string, isDutyOn: boolean, reasonLabel?: string) =>
    fetchWithAuth(`/admin/ambulance-staff/${id}/duty`, {
      method: "POST",
      body: JSON.stringify({ isDutyOn, reasonLabel }),
    }),
  remove: (id: string) =>
    fetchWithAuth(`/admin/ambulance-staff/${id}`, { method: "DELETE" }),
};

// ==================== SOS ALERTS (LIVE) API ====================
export const sosAlertApi = {
  list: (params: Record<string, string | number | boolean> = {}) => {
    const qs = new URLSearchParams(params as any).toString();
    return fetchWithAuth(`/admin/sos-alerts${qs ? `?${qs}` : ""}`);
  },
  detail: (id: string) => fetchWithAuth(`/admin/sos-alerts/${id}`),
  create: (data: { lat: number; lng: number; address?: string }) =>
    fetchWithAuth("/admin/sos-alerts", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateStatus: (id: string, status: string, resolutionNotes?: string) =>
    fetchWithAuth(`/admin/sos-alerts/${id}/status`, {
      method: "POST",
      body: JSON.stringify({ status, resolutionNotes }),
    }),
};

// ==================== AMBULANCE DISPATCH API ====================
// Note: this is for the ambulance dispatch flow (Phase E). The existing
// `dispatchApi` above handles legacy emergency dispatches on `/admin/dispatches`.
export const ambulanceDispatchApi = {
  nearby: (sosId: string, radiusKm?: number) =>
    fetchWithAuth(
      `/admin/sos/${sosId}/nearby-ambulances${
        radiusKm != null ? `?radiusKm=${radiusKm}` : ""
      }`,
    ),
  search: (sosId: string, mobile: string) =>
    fetchWithAuth(
      `/admin/sos/${sosId}/search-ambulances?mobile=${encodeURIComponent(mobile)}`,
    ),
  dispatch: (sosId: string, ambulanceId: string) =>
    fetchWithAuth(`/admin/sos/${sosId}/dispatch`, {
      method: "POST",
      body: JSON.stringify({ ambulanceId }),
    }),
  current: (sosId: string) => fetchWithAuth(`/admin/sos/${sosId}/dispatch`),
  cancel: (sosId: string) =>
    fetchWithAuth(`/admin/sos/${sosId}/dispatch/cancel`, { method: "POST" }),
  list: (params: Record<string, string | number | boolean> = {}) => {
    const qs = new URLSearchParams(params as any).toString();
    return fetchWithAuth(`/admin/ambulance-dispatches${qs ? `?${qs}` : ""}`);
  },
};

// ==================== DOCTOR PANEL / HMS ====================

export interface EmergencyContact {
  name: string;
  relation?: string;
  phone: string;
}

export interface HealthHistory {
  pastMedical?: string;
  surgical?: string;
  medications?: string;
  allergies?: string;
  familyHistory?: string;
}

export interface PatientPayload {
  fullName: string;
  gender: "male" | "female" | "other";
  dateOfBirth?: string;
  age?: number | string;
  bloodGroup?: string;
  phone: string;
  email?: string;
  address?: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    pincode?: string;
  };
  emergencyContacts?: EmergencyContact[];
  healthHistory?: HealthHistory;
  isActive?: boolean;
}

// Patient Registration / Demographics
export const hospitalPatientApi = {
  list: (params: Record<string, string | number | boolean> = {}) => {
    const qs = new URLSearchParams(params as any).toString();
    return fetchWithAuth(`/admin/patients${qs ? `?${qs}` : ""}`);
  },
  detail: (id: string) => fetchWithAuth(`/admin/patients/${id}`),
  create: (data: PatientPayload) =>
    fetchWithAuth("/admin/patients", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (id: string, data: Partial<PatientPayload>) =>
    fetchWithAuth(`/admin/patients/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  remove: (id: string) =>
    fetchWithAuth(`/admin/patients/${id}`, { method: "DELETE" }),
  // Upload a supporting document or photograph (multipart).
  uploadDocument: (id: string, data: FormData) =>
    fetchWithAuthMultipart(`/admin/patients/${id}/documents`, {
      method: "POST",
      body: data,
    }),
};

export interface Prescription {
  drug: string;
  dosage?: string;
  frequency?: string;
  duration?: string;
  notes?: string;
}

export interface EncounterPayload {
  patientId: string;
  encounterType?: "OPD" | "IPD" | "consultation" | "emergency";
  visitDate?: string;
  chiefComplaint?: string;
  vitals?: {
    bloodPressure?: string;
    pulse?: number;
    temperature?: number;
    spo2?: number;
    respiratoryRate?: number;
    height?: number;
    weight?: number;
    bmi?: number;
  };
  soap?: {
    subjective?: string;
    objective?: string;
    assessment?: string;
    plan?: string;
  };
  subjectiveDetail?: {
    symptoms?: string;
    duration?: string;
    painLevel?: number;
    complaints?: string;
    lifestyle?: string;
  };
  objectiveDetail?: { examFindings?: string; deviceData?: string };
  diagnoses?: string[];
  icdDiagnoses?: { code?: string; text: string }[];
  severity?: "mild" | "moderate" | "severe" | "critical";
  differentialDiagnoses?: string[];
  treatmentPlan?: string;
  prescriptions?: Prescription[];
  labOrders?: string[];
  imagingOrders?: string[];
  referrals?: { department?: string; reason?: string; urgency?: "routine" | "urgent" | "emergency" }[];
  followUpAt?: string;
  followUpNotes?: string;
  admissionRecommended?: boolean;
  admissionNote?: string;
  notes?: string;
  status?: "draft" | "finalized";
}

// EMR (SOAP) encounters
export const emrApi = {
  listByPatient: (patientId: string) =>
    fetchWithAuth(`/admin/emr/patient/${patientId}`),
  detail: (id: string) => fetchWithAuth(`/admin/emr/${id}`),
  create: (data: EncounterPayload) =>
    fetchWithAuth("/admin/emr", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (id: string, data: Partial<EncounterPayload>) =>
    fetchWithAuth(`/admin/emr/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  // Push an encounter's prescriptions into pharmacy inventory (stock-out).
  dispense: (id: string, items?: { drug: string; quantity?: number }[]) =>
    fetchWithAuth(`/admin/emr/${id}/dispense`, {
      method: "POST",
      body: JSON.stringify(items ? { items } : {}),
    }),
};

// ==================== DIAGNOSTICS (LAB & RADIOLOGY) API ====================
export const diagnosticsApi = {
  listByPatient: (patientId: string) =>
    fetchWithAuth(`/admin/diagnostics?patientId=${patientId}`),
  create: (data: {
    patientId: string;
    category: "lab" | "imaging";
    name: string;
    encounterId?: string;
  }) =>
    fetchWithAuth("/admin/diagnostics", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (
    id: string,
    data: { status?: string; resultValue?: string; resultNotes?: string },
  ) =>
    fetchWithAuth(`/admin/diagnostics/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  uploadReport: (id: string, data: FormData) =>
    fetchWithAuth(`/admin/diagnostics/${id}/report`, {
      method: "POST",
      body: data,
    }),
  remove: (id: string) =>
    fetchWithAuth(`/admin/diagnostics/${id}`, { method: "DELETE" }),
};

// Inventory Management
export const inventoryApi = {
  list: (params: Record<string, string | number | boolean> = {}) => {
    const qs = new URLSearchParams(params as any).toString();
    return fetchWithAuth(`/admin/inventory${qs ? `?${qs}` : ""}`);
  },
  alerts: (days = 30) => fetchWithAuth(`/admin/inventory/alerts?days=${days}`),
  detail: (id: string) => fetchWithAuth(`/admin/inventory/${id}`),
  create: (data: Record<string, any>) =>
    fetchWithAuth("/admin/inventory", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (id: string, data: Record<string, any>) =>
    fetchWithAuth(`/admin/inventory/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  remove: (id: string) =>
    fetchWithAuth(`/admin/inventory/${id}`, { method: "DELETE" }),
  adjust: (
    id: string,
    data: {
      type: "in" | "out";
      quantity: number;
      reason?: string;
      issuedToType?: string;
      issuedToRef?: string;
    },
  ) =>
    fetchWithAuth(`/admin/inventory/${id}/adjust`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
};

export interface InvoiceLineItem {
  section:
    | "consultation"
    | "procedure"
    | "nursing"
    | "room"
    | "bed"
    | "pharmacy"
    | "diagnostics"
    | "other";
  description: string;
  quantity: number;
  unitPrice: number;
}

// Billing Management
export const billingApi = {
  list: (params: Record<string, string | number | boolean> = {}) => {
    const qs = new URLSearchParams(params as any).toString();
    return fetchWithAuth(`/admin/billing${qs ? `?${qs}` : ""}`);
  },
  reports: (from?: string, to?: string) => {
    const qs = new URLSearchParams(
      { ...(from ? { from } : {}), ...(to ? { to } : {}) } as Record<
        string,
        string
      >,
    ).toString();
    return fetchWithAuth(`/admin/billing/reports${qs ? `?${qs}` : ""}`);
  },
  detail: (id: string) => fetchWithAuth(`/admin/billing/${id}`),
  create: (data: {
    patientId: string;
    lineItems: InvoiceLineItem[];
    taxPercent?: number;
    discount?: number;
    notes?: string;
    status?: string;
  }) =>
    fetchWithAuth("/admin/billing", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (id: string, data: Record<string, any>) =>
    fetchWithAuth(`/admin/billing/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  recordPayment: (
    id: string,
    data: { method: string; amount: number; reference?: string },
  ) =>
    fetchWithAuth(`/admin/billing/${id}/payment`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  refund: (id: string, data: { amount: number; method?: string; reference?: string }) =>
    fetchWithAuth(`/admin/billing/${id}/refund`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  advance: (id: string, data: { method: string; amount: number; reference?: string }) =>
    fetchWithAuth(`/admin/billing/${id}/advance`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  audits: (id: string) => fetchWithAuth(`/admin/billing/${id}/audits`),
  // Stream a PDF (invoice or receipt) with the auth header and download it.
  downloadPdf: async (id: string, kind: "pdf" | "receipt") => {
    const token = getAuthToken();
    const res = await fetch(`${API_URL}/admin/billing/${id}/${kind}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error("Failed to download PDF");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${kind === "receipt" ? "receipt" : "invoice"}-${id}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
  // Cross-module auto-generated invoice (bed charges / diagnostics / consultation).
  generate: (data: {
    patientId: string;
    admissionId?: string;
    encounterId?: string;
    includeBedCharges?: boolean;
    includeDiagnostics?: boolean;
    includeConsultation?: boolean;
    consultationFee?: number;
    diagnosticRate?: number;
    taxPercent?: number;
    discount?: number;
  }) =>
    fetchWithAuth("/admin/billing/generate", {
      method: "POST",
      body: JSON.stringify(data),
    }),
};

// OPD — appointments & queue
export const doctorScheduleApi = {
  // Doctors + whether they have a published OPD availability schedule.
  listDoctors: () => fetchWithAuth("/admin/doctor-schedules"),
  get: (doctorId: string) => fetchWithAuth(`/admin/doctor-schedules/${doctorId}`),
  save: (
    doctorId: string,
    data: {
      slotMinutes: number;
      windows: { weekday: number; start: string; end: string }[];
      isActive?: boolean;
    },
  ) =>
    fetchWithAuth(`/admin/doctor-schedules/${doctorId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
};

export const insuranceApi = {
  // Payers (insurer/TPA)
  listPayers: () => fetchWithAuth("/admin/insurance/payers"),
  createPayer: (data: any) =>
    fetchWithAuth("/admin/insurance/payers", { method: "POST", body: JSON.stringify(data) }),
  updatePayer: (id: string, data: any) =>
    fetchWithAuth(`/admin/insurance/payers/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deletePayer: (id: string) => fetchWithAuth(`/admin/insurance/payers/${id}`, { method: "DELETE" }),
  // Policies
  listPolicies: (patientId?: string) =>
    fetchWithAuth(`/admin/insurance/policies${patientId ? `?patientId=${patientId}` : ""}`),
  createPolicy: (data: any) =>
    fetchWithAuth("/admin/insurance/policies", { method: "POST", body: JSON.stringify(data) }),
  updatePolicy: (id: string, data: any) =>
    fetchWithAuth(`/admin/insurance/policies/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  // Claims
  listClaims: (status?: string) =>
    fetchWithAuth(`/admin/insurance/claims${status ? `?status=${status}` : ""}`),
  createClaim: (data: any) =>
    fetchWithAuth("/admin/insurance/claims", { method: "POST", body: JSON.stringify(data) }),
  updateClaimStatus: (id: string, data: any) =>
    fetchWithAuth(`/admin/insurance/claims/${id}/status`, { method: "POST", body: JSON.stringify(data) }),
};

export const hmsReportsApi = {
  summary: () => fetchWithAuth("/admin/hms-reports/summary"),
};

export const fleetHealthApi = {
  summary: () => fetchWithAuth("/admin/fleet-health"),
};

export const firstAidApi = {
  list: () => fetchWithAuth("/admin/first-aid"),
  create: (data: any) => fetchWithAuth("/admin/first-aid", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: any) => fetchWithAuth(`/admin/first-aid/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  remove: (id: string) => fetchWithAuth(`/admin/first-aid/${id}`, { method: "DELETE" }),
};

export const staffDirectoryApi = {
  list: (params: { type?: string; q?: string } = {}) => {
    const qs = new URLSearchParams(params as any).toString();
    return fetchWithAuth(`/admin/staff-directory${qs ? `?${qs}` : ""}`);
  },
  attendance: (date: string) => fetchWithAuth(`/admin/staff-directory/attendance?date=${date}`),
};

export const doctorRosterApi = {
  list: (date: string) => fetchWithAuth(`/admin/doctor-roster?date=${date}`),
  add: (data: { doctorId: string; date: string; shift: string; isOnCall?: boolean; department?: string; notes?: string }) =>
    fetchWithAuth("/admin/doctor-roster", { method: "POST", body: JSON.stringify(data) }),
  remove: (id: string) => fetchWithAuth(`/admin/doctor-roster/${id}`, { method: "DELETE" }),
};

export const employeeShiftApi = {
  list: (date: string) => fetchWithAuth(`/admin/employee-shifts?date=${date}`),
  employees: () => fetchWithAuth("/admin/employee-shifts/employees"),
  add: (data: { employeeId: string; date: string; shift: string; startTime?: string; endTime?: string; department?: string; section?: string; notes?: string }) =>
    fetchWithAuth("/admin/employee-shifts", { method: "POST", body: JSON.stringify(data) }),
  remove: (id: string) => fetchWithAuth(`/admin/employee-shifts/${id}`, { method: "DELETE" }),
};

export const otApi = {
  listTheatres: () => fetchWithAuth("/admin/ot/theatres"),
  createTheatre: (data: any) => fetchWithAuth("/admin/ot/theatres", { method: "POST", body: JSON.stringify(data) }),
  updateTheatre: (id: string, data: any) => fetchWithAuth(`/admin/ot/theatres/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteTheatre: (id: string) => fetchWithAuth(`/admin/ot/theatres/${id}`, { method: "DELETE" }),
  listSurgeries: (status?: string) => fetchWithAuth(`/admin/ot/surgeries${status ? `?status=${status}` : ""}`),
  createSurgery: (data: any) => fetchWithAuth("/admin/ot/surgeries", { method: "POST", body: JSON.stringify(data) }),
  updateSurgeryStatus: (id: string, status: string) =>
    fetchWithAuth(`/admin/ot/surgeries/${id}/status`, { method: "POST", body: JSON.stringify({ status }) }),
};

export const procurementApi = {
  listSuppliers: () => fetchWithAuth("/admin/procurement/suppliers"),
  createSupplier: (data: any) => fetchWithAuth("/admin/procurement/suppliers", { method: "POST", body: JSON.stringify(data) }),
  updateSupplier: (id: string, data: any) => fetchWithAuth(`/admin/procurement/suppliers/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteSupplier: (id: string) => fetchWithAuth(`/admin/procurement/suppliers/${id}`, { method: "DELETE" }),
  listPurchaseOrders: (status?: string) => fetchWithAuth(`/admin/procurement/purchase-orders${status ? `?status=${status}` : ""}`),
  createPurchaseOrder: (data: any) => fetchWithAuth("/admin/procurement/purchase-orders", { method: "POST", body: JSON.stringify(data) }),
  updatePurchaseOrderStatus: (id: string, status: string) =>
    fetchWithAuth(`/admin/procurement/purchase-orders/${id}/status`, { method: "POST", body: JSON.stringify({ status }) }),
};

export const opdApi = {
  list: (params: Record<string, string> = {}) => {
    const qs = new URLSearchParams(params).toString();
    return fetchWithAuth(`/admin/opd${qs ? `?${qs}` : ""}`);
  },
  create: (data: {
    patientId: string;
    doctorId: string;
    scheduledAt: string;
    reason?: string;
    notes?: string;
  }) =>
    fetchWithAuth("/admin/opd", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (id: string, data: Record<string, any>) =>
    fetchWithAuth(`/admin/opd/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
};

// IPD — beds & admissions
export const ipdApi = {
  // Wards (managed picklist the bed form draws from).
  listWards: (params: Record<string, string> = {}) => {
    const qs = new URLSearchParams(params).toString();
    return fetchWithAuth(`/admin/ipd/wards${qs ? `?${qs}` : ""}`);
  },
  createWard: (data: { name: string; description?: string }) =>
    fetchWithAuth("/admin/ipd/wards", { method: "POST", body: JSON.stringify(data) }),
  updateWard: (id: string, data: { name?: string; description?: string; isActive?: boolean }) =>
    fetchWithAuth(`/admin/ipd/wards/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteWard: (id: string) =>
    fetchWithAuth(`/admin/ipd/wards/${id}`, { method: "DELETE" }),
  listBeds: (params: Record<string, string> = {}) => {
    const qs = new URLSearchParams(params).toString();
    return fetchWithAuth(`/admin/ipd/beds${qs ? `?${qs}` : ""}`);
  },
  createBed: (data: Record<string, any>) =>
    fetchWithAuth("/admin/ipd/beds", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateBed: (id: string, data: Record<string, any>) =>
    fetchWithAuth(`/admin/ipd/beds/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  listAdmissions: (params: Record<string, string | number> = {}) => {
    const qs = new URLSearchParams(params as any).toString();
    return fetchWithAuth(`/admin/ipd/admissions${qs ? `?${qs}` : ""}`);
  },
  admissionDetail: (id: string) =>
    fetchWithAuth(`/admin/ipd/admissions/${id}`),
  admit: (data: {
    patientId: string;
    attendingDoctorId: string;
    bedId: string;
    reason?: string;
    carePlan?: string;
  }) =>
    fetchWithAuth("/admin/ipd/admissions", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  transfer: (id: string, bedId: string) =>
    fetchWithAuth(`/admin/ipd/admissions/${id}/transfer`, {
      method: "POST",
      body: JSON.stringify({ bedId }),
    }),
  discharge: (id: string, dischargeSummary?: string) =>
    fetchWithAuth(`/admin/ipd/admissions/${id}/discharge`, {
      method: "POST",
      body: JSON.stringify({ dischargeSummary }),
    }),
  addLog: (id: string, data: Record<string, any>) =>
    fetchWithAuth(`/admin/ipd/admissions/${id}/log`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
};

// Pharmacy platform
export const pharmacyApi = {
  list: (params: Record<string, string | number> = {}) => {
    const qs = new URLSearchParams(params as any).toString();
    return fetchWithAuth(`/admin/pharmacies${qs ? `?${qs}` : ""}`);
  },
  detail: (id: string) => fetchWithAuth(`/admin/pharmacies/${id}`),
  create: (data: FormData) =>
    fetchWithAuthMultipart("/admin/pharmacies", {
      method: "POST",
      body: data,
    }),
  update: (id: string, data: FormData) =>
    fetchWithAuthMultipart(`/admin/pharmacies/${id}`, {
      method: "PUT",
      body: data,
    }),
  approve: (id: string, approve: boolean, reason?: string) =>
    fetchWithAuth(`/admin/pharmacies/${id}/approve`, {
      method: "POST",
      body: JSON.stringify({ approve, reason }),
    }),
  remove: (id: string) =>
    fetchWithAuth(`/admin/pharmacies/${id}`, { method: "DELETE" }),
};

// IVR escalation
export const ivrApi = {
  list: (params: Record<string, string | number> = {}) => {
    const qs = new URLSearchParams(params as any).toString();
    return fetchWithAuth(`/admin/ivr-escalations${qs ? `?${qs}` : ""}`);
  },
  detail: (id: string) => fetchWithAuth(`/admin/ivr-escalations/${id}`),
  start: (data: {
    sosSubmission?: string;
    emergencyDispatch?: string;
    triggerReason?: string;
    contacts: { tier: number; name?: string; phone: string; role?: string }[];
  }) =>
    fetchWithAuth("/admin/ivr-escalations", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  advance: (id: string) =>
    fetchWithAuth(`/admin/ivr-escalations/${id}/advance`, { method: "POST" }),
  acknowledge: (id: string, phone?: string) =>
    fetchWithAuth(`/admin/ivr-escalations/${id}/acknowledge`, {
      method: "POST",
      body: JSON.stringify({ phone }),
    }),
  cancel: (id: string) =>
    fetchWithAuth(`/admin/ivr-escalations/${id}/cancel`, { method: "POST" }),
};

// ==================== HR — EMPLOYEES API ====================
export const hrEmployeeApi = {
  list: (params: Record<string, string | number | boolean> = {}) => {
    const qs = new URLSearchParams(params as any).toString();
    return fetchWithAuth(`/admin/hr/employees${qs ? `?${qs}` : ""}`);
  },
  detail: (id: string) => fetchWithAuth(`/admin/hr/employees/${id}`),
  create: (data: Record<string, any>) =>
    fetchWithAuth("/admin/hr/employees", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (id: string, data: Record<string, any>) =>
    fetchWithAuth(`/admin/hr/employees/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  updateSalaryStructure: (id: string, data: Record<string, any>) =>
    fetchWithAuth(`/admin/hr/employees/${id}/salary-structure`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  remove: (id: string) =>
    fetchWithAuth(`/admin/hr/employees/${id}`, { method: "DELETE" }),
};

// ==================== HR — ATTENDANCE API ====================
export const attendanceApi = {
  byDate: (date: string) =>
    fetchWithAuth(`/admin/hr/attendance?date=${encodeURIComponent(date)}`),
  byEmployeeMonth: (employeeId: string, month: number, year: number) =>
    fetchWithAuth(
      `/admin/hr/attendance/employee/${employeeId}?month=${month}&year=${year}`,
    ),
  summary: (month: number, year: number) =>
    fetchWithAuth(`/admin/hr/attendance/summary?month=${month}&year=${year}`),
  mark: (data: {
    date: string;
    entries: { employeeId: string; status: string; remarks?: string }[];
  }) =>
    fetchWithAuth("/admin/hr/attendance/mark", {
      method: "POST",
      body: JSON.stringify(data),
    }),
};

// ==================== HR — LEAVE API ====================
export const leaveApi = {
  listTypes: () => fetchWithAuth("/admin/hr/leave/types"),
  saveType: (data: Record<string, any>, id?: string) =>
    fetchWithAuth(`/admin/hr/leave/types${id ? `/${id}` : ""}`, {
      method: id ? "PUT" : "POST",
      body: JSON.stringify(data),
    }),
  balances: (params: Record<string, string | number> = {}) => {
    const qs = new URLSearchParams(params as any).toString();
    return fetchWithAuth(`/admin/hr/leave/balances${qs ? `?${qs}` : ""}`);
  },
  listRequests: (params: Record<string, string> = {}) => {
    const qs = new URLSearchParams(params).toString();
    return fetchWithAuth(`/admin/hr/leave/requests${qs ? `?${qs}` : ""}`);
  },
  createRequest: (data: Record<string, any>) =>
    fetchWithAuth("/admin/hr/leave/requests", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  approve: (id: string, decisionNote?: string) =>
    fetchWithAuth(`/admin/hr/leave/requests/${id}/approve`, {
      method: "POST",
      body: JSON.stringify({ decisionNote }),
    }),
  reject: (id: string, decisionNote?: string) =>
    fetchWithAuth(`/admin/hr/leave/requests/${id}/reject`, {
      method: "POST",
      body: JSON.stringify({ decisionNote }),
    }),
};

// ==================== HR — HOLIDAYS API ====================
export const holidayApi = {
  list: (year: number) => fetchWithAuth(`/admin/hr/holidays?year=${year}`),
  save: (data: Record<string, any>, id?: string) =>
    fetchWithAuth(`/admin/hr/holidays${id ? `/${id}` : ""}`, {
      method: id ? "PUT" : "POST",
      body: JSON.stringify(data),
    }),
  remove: (id: string) =>
    fetchWithAuth(`/admin/hr/holidays/${id}`, { method: "DELETE" }),
};

// ==================== HR — PAYROLL API ====================
export const payrollApi = {
  runs: () => fetchWithAuth("/admin/hr/payroll/runs"),
  generate: (data: { month: number; year: number; tds?: Record<string, number> }) =>
    fetchWithAuth("/admin/hr/payroll/generate", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  runDetail: (id: string) => fetchWithAuth(`/admin/hr/payroll/runs/${id}`),
  finalize: (id: string) =>
    fetchWithAuth(`/admin/hr/payroll/runs/${id}/finalize`, { method: "POST" }),
  payslip: (id: string) => fetchWithAuth(`/admin/hr/payroll/payslip/${id}`),
  // Streams a PDF blob and triggers a browser download.
  downloadPayslip: async (id: string, filename: string) => {
    const token = localStorage.getItem("adminToken");
    const base = API_URL;
    const res = await fetch(`${base}/admin/hr/payroll/payslip/${id}/pdf`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error("Failed to download payslip");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  },
};

// ==================== HR — DASHBOARD API ====================
export const hrDashboardApi = {
  summary: () => fetchWithAuth("/admin/hr/dashboard"),
};

// ==================== PATIENT CATALOG API ====================
const catalogResource = (base: string) => ({
  list: (params: Record<string, string | number> = {}) => {
    const qs = new URLSearchParams(params as any).toString();
    return fetchWithAuth(`/admin/catalog/${base}${qs ? `?${qs}` : ""}`);
  },
  create: (data: Record<string, any>) =>
    fetchWithAuth(`/admin/catalog/${base}`, { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: Record<string, any>) =>
    fetchWithAuth(`/admin/catalog/${base}/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  remove: (id: string) =>
    fetchWithAuth(`/admin/catalog/${base}/${id}`, { method: "DELETE" }),
});

export const catalogApi = {
  doctors: catalogResource("doctors"),
  products: catalogResource("products"),
  labTests: catalogResource("lab-tests"),
};

// ==================== AMBULANCE REQUESTS (patient dispatch) ====================
export const ambulanceRequestApi = {
  list: (status?: string) =>
    fetchWithAuth(`/admin/ambulance-requests${status ? `?status=${status}` : ""}`),
  // Geo-ranked available ambulances for a request's pickup — same as SOS dispatch.
  nearby: (id: string, radiusKm?: number) =>
    fetchWithAuth(
      `/admin/ambulance-requests/${id}/nearby-ambulances${
        radiusKm != null ? `?radiusKm=${radiusKm}` : ""
      }`,
    ),
  assign: (
    id: string,
    data: {
      driverName?: string;
      driverPhone?: string;
      vehicleNumber?: string;
      etaMinutes?: number;
      driverStaffId?: string;
      ambulanceId?: string;
    },
  ) =>
    fetchWithAuth(`/admin/ambulance-requests/${id}/assign`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateStatus: (id: string, status: string) =>
    fetchWithAuth(`/admin/ambulance-requests/${id}/status`, {
      method: "POST",
      body: JSON.stringify({ status }),
    }),
  // In-transit medical expenses (oxygen, medicines, procedures) billed on top
  // of the ambulance fare. The full list replaces the previous one.
  setExpenses: (
    id: string,
    expenses: { inventoryItemId?: string; item: string; qty: number; rate: number }[],
  ) =>
    fetchWithAuth(`/admin/ambulance-requests/${id}/expenses`, {
      method: "PUT",
      body: JSON.stringify({ expenses }),
    }),
  // Mark the bill collected (e.g. crew took Cash/UPI on the spot).
  markPaid: (id: string, method = "CASH") =>
    fetchWithAuth(`/admin/ambulance-requests/${id}/payment`, {
      method: "POST",
      body: JSON.stringify({ method }),
    }),
};

// ==================== MEMBERSHIP PLANS ====================
export const membershipPlanApi = {
  list: () => fetchWithAuth(`/admin/membership-plans`),
  create: (data: Record<string, unknown>) =>
    fetchWithAuth(`/admin/membership-plans`, { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: Record<string, unknown>) =>
    fetchWithAuth(`/admin/membership-plans/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  toggle: (id: string) =>
    fetchWithAuth(`/admin/membership-plans/${id}/toggle`, { method: "PATCH" }),
  remove: (id: string) =>
    fetchWithAuth(`/admin/membership-plans/${id}`, { method: "DELETE" }),
};

// ==================== HOME PROMOS ====================
export const homePromoApi = {
  list: () => fetchWithAuth(`/admin/home-promos`),
  create: (data: Record<string, unknown>) =>
    fetchWithAuth(`/admin/home-promos`, { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: Record<string, unknown>) =>
    fetchWithAuth(`/admin/home-promos/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  toggle: (id: string) =>
    fetchWithAuth(`/admin/home-promos/${id}/toggle`, { method: "PATCH" }),
  remove: (id: string) =>
    fetchWithAuth(`/admin/home-promos/${id}`, { method: "DELETE" }),
};

// Discount coupons (logistics + ambulance). Distinct from homePromoApi, which
// manages the patient-app home shortcut cards.
export const promoApi = {
  list: (params: Record<string, string | undefined> = {}) => {
    const clean = Object.fromEntries(
      Object.entries(params).filter(([, v]) => v != null && v !== ""),
    ) as Record<string, string>;
    const q = new URLSearchParams(clean).toString();
    return fetchWithAuth(`/admin/promos${q ? `?${q}` : ""}`);
  },
  get: (id: string) => fetchWithAuth(`/admin/promos/${id}`),
  create: (data: Record<string, unknown>) =>
    fetchWithAuth(`/admin/promos`, { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: Record<string, unknown>) =>
    fetchWithAuth(`/admin/promos/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  toggle: (id: string) =>
    fetchWithAuth(`/admin/promos/${id}/toggle`, { method: "PATCH" }),
  remove: (id: string) =>
    fetchWithAuth(`/admin/promos/${id}`, { method: "DELETE" }),
  stats: (id: string) => fetchWithAuth(`/admin/promos/${id}/stats`),
};

// Records created by the ambulance-staff (attendant) app: staff-registered
// patients, case notes, stock requests and leave applications.
const qstr = (params: Record<string, string | undefined> = {}) => {
  const clean = Object.fromEntries(
    Object.entries(params).filter(([, v]) => v != null && v !== ""),
  ) as Record<string, string>;
  const q = new URLSearchParams(clean).toString();
  return q ? `?${q}` : "";
};

export const supportApi = {
  tickets: (params?: Record<string, string>) =>
    fetchWithAuth(`/admin/support/tickets${qstr(params)}`),
  ticket: (ticketId: string) =>
    fetchWithAuth(`/admin/support/tickets/${ticketId}`),
  stats: () => fetchWithAuth(`/admin/support/stats`),
  reply: (ticketId: string, message: string) =>
    fetchWithAuth(`/admin/support/tickets/${ticketId}/reply`, {
      method: "POST",
      body: JSON.stringify({ message }),
    }),
  setStatus: (ticketId: string, status: string, resolution?: string) =>
    fetchWithAuth(`/admin/support/tickets/${ticketId}/status`, {
      method: "PUT",
      body: JSON.stringify({ status, resolution }),
    }),
};

export const staffRecordsApi = {
  patients: (params?: Record<string, string>) =>
    fetchWithAuth(`/admin/staff-records/patients${qstr(params)}`),
  caseNotes: (params?: Record<string, string>) =>
    fetchWithAuth(`/admin/staff-records/case-notes${qstr(params)}`),
  stockRequests: (params?: Record<string, string>) =>
    fetchWithAuth(`/admin/staff-records/stock-requests${qstr(params)}`),
  // `ambulanceId` (optional) tells the backend which vehicle to load the stock
  // onto when fulfilling — needed when the crew isn't assigned to one.
  setStockRequestStatus: (id: string, status: string, ambulanceId?: string) =>
    fetchWithAuth(`/admin/staff-records/stock-requests/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status, ambulanceId }),
    }),
  leaves: (params?: Record<string, string>) =>
    fetchWithAuth(`/admin/staff-records/leaves${qstr(params)}`),
  setLeaveStatus: (id: string, status: string) =>
    fetchWithAuth(`/admin/staff-records/leaves/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),
};

// Geocoding helpers (address autocomplete + resolve to coords) for forms.
export const geocodeApi = {
  search: (q: string) => fetchWithAuth(`/admin/geocode/search?q=${encodeURIComponent(q)}`),
  resolve: (opts: { placeId?: string; description?: string }) => {
    const qs = new URLSearchParams();
    if (opts.placeId) qs.set("placeId", opts.placeId);
    if (opts.description) qs.set("description", opts.description);
    return fetchWithAuth(`/admin/geocode/resolve?${qs.toString()}`);
  },
};

// Help & Support FAQ management (patient-app Help screen).
export const faqApi = {
  list: () => fetchWithAuth(`/admin/faqs`),
  create: (data: { question: string; answer: string; category?: string; sortOrder?: number; isActive?: boolean }) =>
    fetchWithAuth(`/admin/faqs`, { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: Record<string, unknown>) =>
    fetchWithAuth(`/admin/faqs/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  remove: (id: string) => fetchWithAuth(`/admin/faqs/${id}`, { method: "DELETE" }),
};

// Patient-app commerce inbox — doctor consultations, lab bookings, pharmacy orders.
export const patientCommerceApi = {
  consultations: (params?: Record<string, string>) =>
    fetchWithAuth(`/admin/patient-commerce/consultations${qstr(params)}`),
  setConsultationStatus: (id: string, status: string) =>
    fetchWithAuth(`/admin/patient-commerce/consultations/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),
  rescheduleConsultation: (id: string, date: string, slot: string) =>
    fetchWithAuth(`/admin/patient-commerce/consultations/${id}/reschedule`, {
      method: "PATCH",
      body: JSON.stringify({ date, slot }),
    }),
  setConsultationSummary: (id: string, summary: string) =>
    fetchWithAuth(`/admin/patient-commerce/consultations/${id}/summary`, {
      method: "PATCH",
      body: JSON.stringify({ summary }),
    }),
  labBookings: (params?: Record<string, string>) =>
    fetchWithAuth(`/admin/patient-commerce/lab-bookings${qstr(params)}`),
  setLabBookingStatus: (id: string, status: string) =>
    fetchWithAuth(`/admin/patient-commerce/lab-bookings/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),
  rescheduleLabBooking: (id: string, date: string, slot: string) =>
    fetchWithAuth(`/admin/patient-commerce/lab-bookings/${id}/reschedule`, {
      method: "PATCH",
      body: JSON.stringify({ date, slot }),
    }),
  // Lab report: a file (FormData field `file`) and/or typed findings (`reportNotes`).
  setLabReport: (id: string, form: FormData) =>
    fetchWithAuthMultipart(`/admin/patient-commerce/lab-bookings/${id}/report`, {
      method: "POST",
      body: form,
    }),
  pharmacyOrders: (params?: Record<string, string>) =>
    fetchWithAuth(`/admin/patient-commerce/pharmacy-orders${qstr(params)}`),
  setPharmacyOrderStatus: (id: string, status: string) =>
    fetchWithAuth(`/admin/patient-commerce/pharmacy-orders/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),
};

// Ambulance inventory — per-vehicle on-hand stock + spend reports.
export const ambulanceStockApi = {
  reports: () => fetchWithAuth("/admin/ambulance-stock/reports"),
  ambulance: (ambulanceId: string) =>
    fetchWithAuth(`/admin/ambulance-stock/${ambulanceId}`),
};

export default {
  staffRecords: staffRecordsApi,
  sosSubmissions: sosSubmissionApi,
  dispatches: dispatchApi,
  providers: providerApi,
  ambulances: ambulanceApi,
  ambulanceStaff: ambulanceStaffApi,
  ambulanceDispatches: ambulanceDispatchApi,
  sosAlerts: sosAlertApi,
  dashboard: dashboardApi,
  reports: reportsApi,
  config: configApi,
  bookings: bookingsApi,
  diagnostics: diagnosticsApi,
  alerts: alertsApi,
  staff: staffApi,
  roles: rolesApi,
  states: stateApi,
  districts: districtApi,
  divisions: divisionApi,
  departments: departmentApi,
  designations: designationApi,
  employmentTypes: employmentTypeApi,
  locatorServiceTypes: locatorServiceTypeApi,
  centres: centreApi,
  cms: cmsApi,
  aboutContent: aboutContentApi,
  homeContent: homeContentApi,
  contactContent: contactContentApi,
  contactMessages: contactMessagesApi,
  news: newsApi,
  gallery: galleryApi,
  articleSubmissions: articleSubmissionsApi,
  logoSettings: logoSettingsApi,
  activityLogs: activityLogsApi,
  emailTemplates: emailTemplateApi,
  smtpSettings: smtpSettingsApi,
  smsSettings: smsSettingsApi,
  notifications: notificationsApi,
  users: usersApi,
  hospitalPatients: hospitalPatientApi,
  emr: emrApi,
  inventory: inventoryApi,
  billing: billingApi,
  opd: opdApi,
  ipd: ipdApi,
  pharmacies: pharmacyApi,
  ivr: ivrApi,
  hrEmployees: hrEmployeeApi,
  attendance: attendanceApi,
  leave: leaveApi,
  holidays: holidayApi,
  payroll: payrollApi,
  hrDashboard: hrDashboardApi,
  catalog: catalogApi,
  ambulanceRequests: ambulanceRequestApi,
};
