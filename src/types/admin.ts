// Admin Types

// Staff & Role Types
export interface Permission {
  id: string;
  name: string;
  description: string;
  module: string;
}

export interface Role {
  _id: string;
  name: string;
  description: string;
  permissions: string[];
  isSystem: boolean;
  staffCount: number;
  createdAt: string;
  updatedAt?: string;
}

export interface StaffMember {
  _id: string;
  name: string;
  email: string;
  phone: string;
  avatar?: string;
  role: Role;
  isActive: boolean;
  lastLogin?: string;
  createdAt: string;
  createdBy?: string;
}

// SOS Types
export interface SOSAlert {
  _id: string;
  userId?: string;
  location: {
    lat: number;
    lng: number;
    address?: string;
  };
  status: "ACTIVE" | "RESPONDED" | "RESOLVED" | "CANCELLED";
  respondedBy?: string;
  respondedAt?: string;
  resolvedAt?: string;
  resolution?: string;
  policeNotified: boolean;
  contactsNotified: number;
  createdAt: string;
  user?: {
    name: string;
    phone: string;
  };
}

// SOS Submission Types (Public SOS)
export interface SOSSubmission {
  _id: string;
  type: "CALL" | "FORM" | "APP_DOWNLOAD";
  name: string;
  phone: string;
  email?: string;
  location?: {
    type: "Point";
    coordinates: [number, number]; // [lng, lat]
  };
  address?: string;
  emergencyType?: string;
  description?: string;
  numberOfPeople?: number;
  status: "PENDING" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
  respondedBy?: {
    _id: string;
    name: string;
    email: string;
  };
  respondedAt?: string;
  resolvedAt?: string;
  resolutionNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SOSSubmissionStats {
  byType: {
    CALL: number;
    FORM: number;
    APP_DOWNLOAD: number;
  };
  byStatus: {
    PENDING: number;
    IN_PROGRESS: number;
    RESOLVED: number;
    CLOSED: number;
  };
  today: {
    CALL: number;
    FORM: number;
    APP_DOWNLOAD: number;
  };
  total: number;
}

export interface EmergencyDispatch {
  _id: string;
  sosSubmission: string | SOSSubmission;
  dispatchType:
    | "AMBULANCE"
    | "POLICE"
    | "FIRE_BRIGADE"
    | "EMERGENCY_CENTER"
    | "RESCUE_TEAM";
  serviceName: string;
  servicePhone: string;
  serviceAddress?: string;
  serviceLocation?: {
    type: "Point";
    coordinates: [number, number];
  };
  dispatchedBy?: {
    _id: string;
    name: string;
    email: string;
  };
  dispatchedAt: string;
  message?: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  status:
    | "DISPATCHED"
    | "ACKNOWLEDGED"
    | "EN_ROUTE"
    | "ON_SCENE"
    | "COMPLETED"
    | "CANCELLED";
  acknowledgedAt?: string;
  arrivedAt?: string;
  completedAt?: string;
  cancelledAt?: string;
  cancelReason?: string;
  responseNotes?: string;
  estimatedArrival?: number;
  createdAt: string;
  updatedAt: string;
}

export interface DispatchStats {
  byType: {
    AMBULANCE: number;
    POLICE: number;
    FIRE_BRIGADE: number;
    EMERGENCY_CENTER: number;
    RESCUE_TEAM: number;
  };
  byStatus: {
    DISPATCHED: number;
    ACKNOWLEDGED: number;
    EN_ROUTE: number;
    ON_SCENE: number;
    COMPLETED: number;
    CANCELLED: number;
  };
  total: number;
}

// Generic Pagination
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
