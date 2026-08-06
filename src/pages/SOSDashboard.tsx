// src/pages/SOSDashboard.tsx
import React, { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  Phone,
  MapPin,
  Clock,
  FileText,
  Download,
  CheckCircle,
  Search,
  RefreshCw,
  Bell,
  Eye,
  Play,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Map as MapIcon,
  Send,
  Shield,
  Flame,
  Siren,
  Users,
  X,
} from "lucide-react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import {
  sosSubmissionApi,
  dispatchApi,
  ambulanceDispatchApi,
} from "../services/admin-api";
import DispatchPanel from "../components/DispatchPanel";
import type { NearbyAmbulance } from "../components/DispatchPanel";
import { adminSocket } from "../services/socket";
import {
  PageHeader,
  Button,
  Card,
  Alert,
  Modal,
  SearchInput,
  Select,
  Input,
  Textarea,
  Field,
  Spinner,
} from "../components/ui";

const ambulanceFeature =
  import.meta.env.VITE_FEATURE_AMBULANCE_DISPATCH === "true";
import type {
  SOSSubmission,
  SOSSubmissionStats,
  EmergencyDispatch,
} from "../types/admin";

type TabType = "CALL" | "FORM" | "APP_DOWNLOAD";

// Red marker icon for SOS locations
const sosIcon = new L.Icon({
  iconUrl:
    "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const DISPATCH_TYPES = [
  {
    key: "AMBULANCE",
    label: "Ambulance",
    color: "red",
    bgColor: "bg-red-50",
    textColor: "text-red-700",
    borderColor: "border-red-200",
    btnColor: "bg-red-500 hover:bg-red-600",
  },
  {
    key: "POLICE",
    label: "Police",
    color: "blue",
    bgColor: "bg-blue-50",
    textColor: "text-blue-700",
    borderColor: "border-blue-200",
    btnColor: "bg-blue-500 hover:bg-blue-600",
  },
  {
    key: "FIRE_BRIGADE",
    label: "Fire Brigade",
    color: "orange",
    bgColor: "bg-orange-50",
    textColor: "text-orange-700",
    borderColor: "border-orange-200",
    btnColor: "bg-orange-500 hover:bg-orange-600",
  },
  {
    key: "EMERGENCY_CENTER",
    label: "Emergency Center",
    color: "purple",
    bgColor: "bg-purple-50",
    textColor: "text-purple-700",
    borderColor: "border-purple-200",
    btnColor: "bg-purple-500 hover:bg-purple-600",
  },
  {
    key: "RESCUE_TEAM",
    label: "Rescue Team",
    color: "teal",
    bgColor: "bg-teal-50",
    textColor: "text-teal-700",
    borderColor: "border-teal-200",
    btnColor: "bg-teal-500 hover:bg-teal-600",
  },
];

const getDispatchIcon = (type: string) => {
  switch (type) {
    case "AMBULANCE":
      return Siren;
    case "POLICE":
      return Shield;
    case "FIRE_BRIGADE":
      return Flame;
    case "EMERGENCY_CENTER":
      return Siren;
    case "RESCUE_TEAM":
      return Users;
    default:
      return Siren;
  }
};

const SOSDashboard: React.FC = () => {
  // Tab & Submissions
  const [activeTab, setActiveTab] = useState<TabType>("CALL");
  const [submissions, setSubmissions] = useState<SOSSubmission[]>([]);
  const [searchParams, setSearchParams] = useSearchParams();
  const [stats, setStats] = useState<SOSSubmissionStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Detail modal
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedSubmission, setSelectedSubmission] =
    useState<SOSSubmission | null>(null);
  const [submissionDispatches, setSubmissionDispatches] = useState<
    EmergencyDispatch[]
  >([]);
  const [dispatchesLoading, setDispatchesLoading] = useState(false);

  // Resolve modal
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [resolutionNotes, setResolutionNotes] = useState("");

  // Dispatch modal
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [dispatchForm, setDispatchForm] = useState({
    dispatchType: "AMBULANCE",
    serviceName: "",
    servicePhone: "",
    serviceAddress: "",
    message: "",
    priority: "HIGH",
    estimatedArrival: 15,
  });

  // Ambulance picker state (used when dispatchType === "AMBULANCE").
  // Loaded on-demand when the modal opens, refreshed every 10s while open
  // so distances/ETAs stay current as drivers move.
  const [nearbyAmbulances, setNearbyAmbulances] = useState<NearbyAmbulance[]>(
    [],
  );
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [nearbyError, setNearbyError] = useState<string | null>(null);
  const [nearbyDiagnostics, setNearbyDiagnostics] = useState<{
    total: number;
    inactive: number;
    onDispatch: number;
    offline: number;
    maintenance: number;
    missingAttendant: number;
    missingDriver: number;
    driverOffDuty: number;
    attendantOffDuty: number;
    locationStale: number;
    available: number;
  } | null>(null);
  const [selectedAmbulanceId, setSelectedAmbulanceId] = useState<string | null>(
    null,
  );
  // When admin types a mobile number, we bypass the geo+duty filters
  // and search the whole fleet. Empty string = back to the nearby view.
  const [ambulanceSearch, setAmbulanceSearch] = useState("");
  const [searchMode, setSearchMode] = useState(false);
  // Configurable from the picker — defaults to 10 km but ops can widen
  // when no vehicle is within range (rural SOS, sparse test data, etc.).
  // 0 = no cap, show every vehicle with fresh location sorted by distance.
  const [radiusKm, setRadiusKm] = useState<number>(10);

  // Map
  const [showMap, setShowMap] = useState(false);
  const [mapSubmissions, setMapSubmissions] = useState<SOSSubmission[]>([]);
  const [mapLoading, setMapLoading] = useState(false);

  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // ---------- Fetchers ----------
  const fetchSubmissions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await sosSubmissionApi.getAll({
        type: activeTab,
        status: statusFilter,
        search,
        page,
        limit: 15,
      });
      if (res.success) {
        setSubmissions(res.data.submissions);
        setTotalPages(res.data.pagination.pages);
        setTotal(res.data.pagination.total);
      }
    } catch (err) {
      console.error("Failed to fetch submissions:", err);
    }
    setLoading(false);
  }, [activeTab, statusFilter, search, page]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await sosSubmissionApi.getStats();
      if (res.success) setStats(res.data);
    } catch (err) {
      console.error("Failed to fetch stats:", err);
    }
  }, []);

  const fetchMapData = useCallback(async () => {
    setMapLoading(true);
    try {
      const res = await sosSubmissionApi.getLocations({ type: activeTab });
      if (res.success) setMapSubmissions(res.data);
    } catch (err) {
      console.error("Failed to fetch map data:", err);
    }
    setMapLoading(false);
  }, [activeTab]);

  const fetchSubmissionDispatches = useCallback(async (id: string) => {
    setDispatchesLoading(true);
    try {
      const res = await sosSubmissionApi.getDispatches(id);
      if (res.success) setSubmissionDispatches(res.data);
    } catch (err) {
      console.error("Failed to fetch dispatches:", err);
    }
    setDispatchesLoading(false);
  }, []);

  // ---------- Effects ----------
  useEffect(() => {
    fetchSubmissions();
  }, [fetchSubmissions]);
  useEffect(() => {
    fetchStats();
  }, [fetchStats]);
  useEffect(() => {
    if (showMap) fetchMapData();
  }, [showMap, fetchMapData]);

  // Auto-refresh 30s (fallback safety net behind the realtime socket below)
  useEffect(() => {
    const iv = setInterval(() => {
      fetchSubmissions();
      fetchStats();
      if (showMap) fetchMapData();
    }, 30000);
    return () => clearInterval(iv);
  }, [fetchSubmissions, fetchStats, fetchMapData, showMap]);

  // Realtime: the instant a SOS form/call is submitted (patient app or website)
  // or a submission/dispatch changes, refresh the list + stats — no manual
  // refresh, no 30s wait. The backend emits these to the "admin" room.
  useEffect(() => {
    adminSocket.connect();
    const refresh = () => {
      fetchSubmissions();
      fetchStats();
      if (showMap) fetchMapData();
    };
    const offs = [
      adminSocket.on("sos:new", refresh),
      adminSocket.on("sos:submission-updated", refresh),
      adminSocket.on("sos:dispatch-created", refresh),
      adminSocket.on("sos:dispatch-updated", refresh),
    ];
    return () => offs.forEach((off) => off());
  }, [fetchSubmissions, fetchStats, fetchMapData, showMap]);

  // ---------- Handlers ----------
  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    setPage(1);
    setSearch("");
    setStatusFilter("");
  };

  const handleUpdateStatus = async (
    id: string,
    status: string,
    notes?: string,
  ) => {
    setActionLoading(id);
    try {
      const res = await sosSubmissionApi.updateStatus(id, status, notes);
      if (res.success) {
        fetchSubmissions();
        fetchStats();
        if (showResolveModal) {
          setShowResolveModal(false);
          setResolutionNotes("");
          setSelectedSubmission(null);
        }
      }
    } catch (err) {
      console.error("Failed to update status:", err);
    }
    setActionLoading(null);
  };

  const handleViewDetails = async (sub: SOSSubmission) => {
    setSelectedSubmission(sub);
    setShowDetailModal(true);
    fetchSubmissionDispatches(sub._id);
  };

  // Deep-link: the realtime SOS alarm's "Dispatch now" navigates here with
  // ?open=<sosId> — auto-open that submission's detail (with the dispatch panel)
  // instead of dropping the dispatcher on the plain listing.
  useEffect(() => {
    const openId = searchParams.get("open");
    if (!openId || submissions.length === 0) return;
    const sub = submissions.find((s) => s._id === openId);
    if (sub) {
      handleViewDetails(sub);
      searchParams.delete("open");
      setSearchParams(searchParams, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submissions, searchParams]);

  const handleOpenDispatch = (sub: SOSSubmission) => {
    setSelectedSubmission(sub);
    setDispatchForm({
      // SOS always defaults to AMBULANCE so dispatch goes straight to an
      // ambulance; the dispatcher can still switch type if needed.
      dispatchType: "AMBULANCE",
      serviceName: "",
      servicePhone: "",
      serviceAddress: "",
      message: "",
      priority: "HIGH",
      estimatedArrival: 15,
    });
    setSelectedAmbulanceId(null);
    setNearbyAmbulances([]);
    setNearbyError(null);
    setNearbyDiagnostics(null);
    setAmbulanceSearch("");
    setSearchMode(false);
    setRadiusKm(10);
    setShowDispatchModal(true);
  };

  const fetchNearbyAmbulances = useCallback(
    async (sosId: string, mobileSearch?: string, radius?: number) => {
      setNearbyLoading(true);
      setNearbyError(null);
      setNearbyDiagnostics(null);
      try {
        const res = mobileSearch
          ? await ambulanceDispatchApi.search(sosId, mobileSearch)
          : await ambulanceDispatchApi.nearby(sosId, radius);
        const data = res?.data || res;
        // Backend signals special states via `data.reason`. "no_location"
        // means the SOS row has no GPS — no point showing the fleet, ops
        // needs to add a pin first. Anything else: render the list (which
        // may be empty, in which case `data.diagnostics` explains why).
        if (data?.reason === "no_location") {
          setNearbyError(
            "This SOS has no GPS location — can't auto-dispatch an ambulance. " +
              "Add a location pin to the submission, or use the legacy form " +
              "(non-Ambulance service types).",
          );
          setNearbyAmbulances([]);
          return;
        }
        const list: NearbyAmbulance[] = data?.ambulances || [];
        setNearbyAmbulances(list);
        if (list.length === 0 && !mobileSearch) {
          // Diagnostics only make sense for the geo-filtered view —
          // the mobile-search bypasses those filters intentionally.
          setNearbyDiagnostics(data?.diagnostics || null);
        }
      } catch (e: unknown) {
        const raw = e instanceof Error ? e.message : "";
        setNearbyError(
          raw && raw !== "Request failed"
            ? raw
            : "SOS submission not found (it may have been deleted).",
        );
        setNearbyAmbulances([]);
      }
      setNearbyLoading(false);
    },
    [],
  );

  // Refresh ambulance list while the Ambulance picker is showing — drivers
  // move and statuses flip (on_dispatch / offline), so a stale snapshot
  // would let admin pick an ambulance that's no longer eligible.
  useEffect(() => {
    if (
      !showDispatchModal ||
      dispatchForm.dispatchType !== "AMBULANCE" ||
      !selectedSubmission
    ) {
      return;
    }
    const searchTerm = searchMode ? ambulanceSearch.trim() : undefined;
    fetchNearbyAmbulances(selectedSubmission._id, searchTerm, radiusKm);
    const iv = setInterval(
      () =>
        fetchNearbyAmbulances(selectedSubmission._id, searchTerm, radiusKm),
      10000,
    );
    return () => clearInterval(iv);
  }, [
    showDispatchModal,
    dispatchForm.dispatchType,
    selectedSubmission,
    fetchNearbyAmbulances,
    searchMode,
    ambulanceSearch,
    radiusKm,
  ]);

  const handleDispatch = async () => {
    if (!selectedSubmission) return;
    setActionLoading("dispatch");
    try {
      // Ambulance dispatches go through the fleet endpoint so we get the
      // ringing FCM, driver/attendant auto-assignment, and the real
      // road-distance/ETA. The legacy free-text endpoint is kept only for
      // Police/Fire/Emergency-Center/Rescue where we don't model the
      // responder yet.
      if (dispatchForm.dispatchType === "AMBULANCE") {
        if (!selectedAmbulanceId) {
          setActionLoading(null);
          return;
        }
        const res = await ambulanceDispatchApi.dispatch(
          selectedSubmission._id,
          selectedAmbulanceId,
        );
        if (res?.success !== false) {
          setShowDispatchModal(false);
          fetchSubmissions();
          fetchStats();
          if (showDetailModal) {
            fetchSubmissionDispatches(selectedSubmission._id);
          }
        }
      } else {
        const res = await sosSubmissionApi.createDispatch(
          selectedSubmission._id,
          {
            dispatchType: dispatchForm.dispatchType,
            serviceName: dispatchForm.serviceName,
            servicePhone: dispatchForm.servicePhone,
            serviceAddress: dispatchForm.serviceAddress || undefined,
            message: dispatchForm.message || undefined,
            priority: dispatchForm.priority,
            estimatedArrival: dispatchForm.estimatedArrival || undefined,
          },
        );
        if (res.success) {
          setShowDispatchModal(false);
          fetchSubmissions();
          fetchStats();
          if (showDetailModal) {
            fetchSubmissionDispatches(selectedSubmission._id);
          }
        }
      }
    } catch (err: any) {
      console.error("Failed to dispatch:", err);
      alert(err?.message || "Dispatch failed");
    }
    setActionLoading(null);
  };

  const handleUpdateDispatchStatus = async (
    dispatchId: string,
    status: string,
    data?: { responseNotes?: string; cancelReason?: string },
  ) => {
    setActionLoading(dispatchId);
    try {
      const res = await dispatchApi.updateStatus(dispatchId, status, data);
      if (res.success && selectedSubmission) {
        fetchSubmissionDispatches(selectedSubmission._id);
      }
    } catch (err) {
      console.error("Failed to update dispatch:", err);
    }
    setActionLoading(null);
  };

  // ---------- Helpers ----------
  const getTimeAgo = (dateString: string) => {
    const diff = Date.now() - new Date(dateString).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  const humanizeCancelReason = (reason: string): string => {
    const map: Record<string, string> = {
      no_response: "Not answered — no crew response",
      driver_rejected: "Driver rejected",
      admin_cancelled: "Cancelled by admin",
    };
    return map[reason] || reason.replace(/_/g, " ");
  };

  const getStatusBadge = (status: string) => {
    const s: Record<string, string> = {
      PENDING: "bg-red-100 text-red-800 animate-pulse",
      IN_PROGRESS: "bg-yellow-100 text-yellow-800",
      RESOLVED: "bg-green-100 text-green-800",
      CLOSED: "bg-gray-100 text-gray-800",
    };
    return s[status] || "bg-gray-100 text-gray-800";
  };

  const getDispatchStatusBadge = (status: string) => {
    const s: Record<string, string> = {
      DISPATCHED: "bg-blue-100 text-blue-800",
      ACKNOWLEDGED: "bg-indigo-100 text-indigo-800",
      EN_ROUTE: "bg-yellow-100 text-yellow-800",
      ON_SCENE: "bg-orange-100 text-orange-800",
      COMPLETED: "bg-green-100 text-green-800",
      CANCELLED: "bg-red-100 text-red-800",
    };
    return s[status] || "bg-gray-100 text-gray-800";
  };

  const getEmergencyTypeLabel = (type: string) => {
    const m: Record<string, string> = {
      MEDICAL: "Medical Emergency",
      ACCIDENT: "Accident",
      FIRE: "Fire",
      NATURAL_DISASTER: "Natural Disaster",
      VIOLENCE: "Violence / Threat",
      OTHER: "Other",
    };
    return m[type] || type;
  };

  const getCategoryBadge = (type: string) => {
    if (type === "CALL")
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 border border-red-200">
          <Phone className="w-3 h-3" />
          CALL
        </span>
      );
    if (type === "FORM")
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 border border-blue-200">
          <FileText className="w-3 h-3" />
          FORM
        </span>
      );
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-100 text-cyan-700 border border-cyan-200">
        <Download className="w-3 h-3" />
        APP
      </span>
    );
  };

  const getDispatchTypeConfig = (type: string) =>
    DISPATCH_TYPES.find((d) => d.key === type) || DISPATCH_TYPES[0];

  const tabConfig = [
    {
      key: "CALL" as TabType,
      label: "SOS Calls",
      icon: Phone,
      color: "red",
      count: stats?.byType.CALL || 0,
      todayCount: stats?.today.CALL || 0,
    },
    {
      key: "FORM" as TabType,
      label: "SOS Forms",
      icon: FileText,
      color: "blue",
      count: stats?.byType.FORM || 0,
      todayCount: stats?.today.FORM || 0,
    },
    {
      key: "APP_DOWNLOAD" as TabType,
      label: "App Downloads",
      icon: Download,
      color: "cyan",
      count: stats?.byType.APP_DOWNLOAD || 0,
      todayCount: stats?.today.APP_DOWNLOAD || 0,
    },
  ];

  const pendingCount = stats?.byStatus.PENDING || 0;

  // ======================== RENDER ========================
  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="SOS Management Dashboard"
        subtitle="Monitor & dispatch emergency services for SOS calls & form submissions"
        actions={
          <>
            <Button
              variant={showMap ? "subtle" : "secondary"}
              onClick={() => setShowMap(!showMap)}
              icon={<MapIcon className="w-4 h-4" />}
            >
              {showMap ? "Hide Map" : "Live Map"}
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                fetchSubmissions();
                fetchStats();
              }}
              icon={<RefreshCw className="w-4 h-4" />}
            >
              Refresh
            </Button>
          </>
        }
      />

      {/* Alert Banner */}
      {pendingCount > 0 && (
        <Alert tone="danger" className="flex items-center gap-4 animate-pulse">
          <div className="flex items-center justify-center w-12 h-12 bg-red-100 rounded-full shrink-0">
            <Bell className="w-6 h-6 text-red-600" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-red-800">
              {pendingCount} Pending SOS Submission
              {pendingCount > 1 ? "s" : ""} — Immediate Action Required
            </p>
            <p className="text-sm text-red-600">
              Click "Dispatch" to send ambulance, police, or emergency services
            </p>
          </div>
        </Alert>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <Card padded>
          <p className="text-sm text-gray-500">Total</p>
          <p className="mt-1 text-2xl font-bold text-gray-800">
            {stats?.total || 0}
          </p>
        </Card>
        <Card padded className="border-red-100">
          <p className="text-sm text-red-500">Pending</p>
          <p className="mt-1 text-2xl font-bold text-red-600">
            {stats?.byStatus.PENDING || 0}
          </p>
        </Card>
        <Card padded className="border-yellow-100">
          <p className="text-sm text-yellow-600">In Progress</p>
          <p className="mt-1 text-2xl font-bold text-yellow-600">
            {stats?.byStatus.IN_PROGRESS || 0}
          </p>
        </Card>
        <Card padded className="border-green-100">
          <p className="text-sm text-green-600">Resolved</p>
          <p className="mt-1 text-2xl font-bold text-green-600">
            {stats?.byStatus.RESOLVED || 0}
          </p>
        </Card>
        <Card padded>
          <p className="text-sm text-gray-500">Closed</p>
          <p className="mt-1 text-2xl font-bold text-gray-600">
            {stats?.byStatus.CLOSED || 0}
          </p>
        </Card>
      </div>

      {/* Tabs + Content */}
      <div className="overflow-hidden bg-white border border-gray-100 shadow-sm rounded-2xl">
        {/* Tab Header */}
        <div className="flex border-b border-gray-100">
          {tabConfig.map((tab) => (
            <button
              key={tab.key}
              onClick={() => handleTabChange(tab.key)}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-4 text-sm font-medium transition-all ${
                activeTab === tab.key
                  ? `border-b-2 ${
                      tab.color === "red"
                        ? "border-red-500 text-red-700 bg-red-50/50"
                        : tab.color === "blue"
                          ? "border-blue-500 text-blue-700 bg-blue-50/50"
                          : "border-cyan-500 text-cyan-700 bg-cyan-50/50"
                    }`
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              }`}
            >
              <tab.icon className="w-4 h-4" />
              <span>{tab.label}</span>
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                  tab.color === "red"
                    ? "bg-red-100 text-red-700"
                    : tab.color === "blue"
                      ? "bg-blue-100 text-blue-700"
                      : "bg-cyan-100 text-cyan-700"
                }`}
              >
                {tab.count}
              </span>
              {tab.todayCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-700">
                  +{tab.todayCount} today
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-3 p-4 border-b border-gray-100 md:flex-row">
          <SearchInput
            placeholder="Search by name, phone or email..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="flex-1"
          />
          <Select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="w-auto"
          >
            <option value="">All Statuses</option>
            <option value="PENDING">Pending</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="RESOLVED">Resolved</option>
            <option value="CLOSED">Closed</option>
          </Select>
        </div>

        {/* Live Map */}
        {showMap && (
          <div className="p-4 border-b border-gray-100">
            <div className="overflow-hidden bg-gray-50 rounded-2xl">
              <div className="flex items-center justify-between p-3 bg-gray-100">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <MapIcon className="w-4 h-4" />
                  Live Location Tracking —{" "}
                  {tabConfig.find((t) => t.key === activeTab)?.label}
                </div>
                <span className="text-xs text-gray-500">
                  {mapSubmissions.length} with location data
                </span>
              </div>
              {mapLoading ? (
                <div className="flex items-center justify-center h-80">
                  <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
                </div>
              ) : mapSubmissions.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-gray-400 h-80">
                  <MapPin className="w-12 h-12 mb-3 opacity-50" />
                  <p className="text-sm">No location data available</p>
                </div>
              ) : (
                <div className="relative h-80">
                  <MapContainer
                    center={[
                      mapSubmissions[0]?.location?.coordinates?.[1] || 26.1,
                      mapSubmissions[0]?.location?.coordinates?.[0] || 91.7,
                    ]}
                    zoom={10}
                    style={{ height: "100%", width: "100%" }}
                    scrollWheelZoom={true}
                  >
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    {mapSubmissions.map((sub) => (
                      <Marker
                        key={sub._id}
                        position={[
                          sub.location?.coordinates?.[1] || 0,
                          sub.location?.coordinates?.[0] || 0,
                        ]}
                        icon={sosIcon}
                      >
                        <Popup>
                          <div className="text-xs">
                            <p className="font-semibold">{sub.name}</p>
                            <p className="text-gray-500">
                              {sub.address ||
                                `${sub.location?.coordinates?.[1]?.toFixed(4)}, ${sub.location?.coordinates?.[0]?.toFixed(4)}`}
                            </p>
                            <p className="mt-1 text-gray-400">
                              {getTimeAgo(sub.createdAt)}
                            </p>
                          </div>
                        </Popup>
                      </Marker>
                    ))}
                  </MapContainer>
                  <div className="absolute z-[1000] w-64 overflow-y-auto bg-white shadow-lg top-2 right-2 rounded-xl max-h-72">
                    <div className="sticky top-0 p-2 text-xs font-semibold text-gray-600 bg-white border-b border-gray-100">
                      SOS Locations ({mapSubmissions.length})
                    </div>
                    {mapSubmissions.map((sub) => (
                      <a
                        key={sub._id}
                        href={`https://www.openstreetmap.org/?mlat=${sub.location?.coordinates?.[1]}&mlon=${sub.location?.coordinates?.[0]}#map=15/${sub.location?.coordinates?.[1]}/${sub.location?.coordinates?.[0]}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-start gap-2 p-2 border-b hover:bg-gray-50 border-gray-50 last:border-0"
                      >
                        <MapPin className="w-3.5 h-3.5 text-red-500 mt-0.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1">
                            {getCategoryBadge(sub.type)}
                            <p className="text-xs font-medium text-gray-800 truncate">
                              {sub.name}
                            </p>
                          </div>
                          <p className="text-[10px] text-gray-500 truncate mt-0.5">
                            {sub.address ||
                              `${sub.location?.coordinates?.[1]?.toFixed(4)}, ${sub.location?.coordinates?.[0]?.toFixed(4)}`}
                          </p>
                          <p className="text-[10px] text-gray-400">
                            {getTimeAgo(sub.createdAt)}
                          </p>
                        </div>
                        <ExternalLink className="w-3 h-3 text-gray-300 shrink-0 mt-0.5" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Submissions List */}
        <div className="divide-y divide-gray-100">
          {loading ? (
            <div className="p-12 text-center">
              <Spinner className="mx-auto mb-3" />
              <p className="text-sm text-gray-500">Loading submissions...</p>
            </div>
          ) : submissions.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <AlertTriangle className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No submissions found</p>
            </div>
          ) : (
            submissions.map((sub) => (
              <div
                key={sub._id}
                className={`p-5 hover:bg-gray-50 transition-colors ${
                  sub.status === "PENDING" ? "bg-red-50/30" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start flex-1 min-w-0 gap-4">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                        sub.status === "PENDING"
                          ? "bg-red-100 animate-pulse"
                          : sub.status === "IN_PROGRESS"
                            ? "bg-yellow-100"
                            : "bg-green-100"
                      }`}
                    >
                      {sub.type === "CALL" ? (
                        <Phone
                          className={`w-5 h-5 ${sub.status === "PENDING" ? "text-red-600" : sub.status === "IN_PROGRESS" ? "text-yellow-600" : "text-green-600"}`}
                        />
                      ) : sub.type === "FORM" ? (
                        <FileText
                          className={`w-5 h-5 ${sub.status === "PENDING" ? "text-red-600" : sub.status === "IN_PROGRESS" ? "text-yellow-600" : "text-green-600"}`}
                        />
                      ) : (
                        <Download
                          className={`w-5 h-5 ${sub.status === "PENDING" ? "text-red-600" : sub.status === "IN_PROGRESS" ? "text-yellow-600" : "text-green-600"}`}
                        />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-gray-800">
                          {sub.name}
                        </span>
                        {getCategoryBadge(sub.type)}
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(sub.status)}`}
                        >
                          {sub.status.replace("_", " ")}
                        </span>
                        <span className="flex items-center gap-1 text-xs text-gray-400">
                          <Clock className="w-3 h-3" />
                          {getTimeAgo(sub.createdAt)}
                        </span>
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600">
                        <span className="flex items-center gap-1">
                          <Phone className="w-3.5 h-3.5 text-gray-400" />
                          {sub.phone}
                        </span>
                        {sub.email && (
                          <span className="text-gray-500">{sub.email}</span>
                        )}
                        {sub.emergencyType && (
                          <span className="px-2 py-0.5 rounded-lg bg-orange-50 text-orange-700 text-xs font-medium">
                            {getEmergencyTypeLabel(sub.emergencyType)}
                          </span>
                        )}
                        {sub.location?.coordinates && (
                          <a
                            href={`https://www.openstreetmap.org/?mlat=${sub.location.coordinates[1]}&mlon=${sub.location.coordinates[0]}#map=15/${sub.location.coordinates[1]}/${sub.location.coordinates[0]}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs text-healwin-600 hover:underline"
                          >
                            <MapPin className="w-3 h-3" />
                            View Location
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                      {sub.description && (
                        <p className="mt-1.5 text-sm text-gray-500 line-clamp-2">
                          {sub.description}
                        </p>
                      )}
                      {sub.address && (
                        <p className="flex items-center gap-1 mt-1 text-xs text-gray-400">
                          <MapPin className="w-3 h-3" />
                          {sub.address}
                        </p>
                      )}
                      {sub.resolutionNotes && (
                        <div className="p-2 mt-2 rounded-lg bg-green-50">
                          <p className="text-xs text-green-700">
                            <strong>Resolution:</strong> {sub.resolutionNotes}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="secondary"
                      className="px-2"
                      title="View"
                      aria-label="View"
                      onClick={() => handleViewDetails(sub)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    {/* DISPATCH BUTTON */}
                    {(sub.status === "PENDING" ||
                      sub.status === "IN_PROGRESS") && (
                      <Button
                        size="sm"
                        onClick={() => handleOpenDispatch(sub)}
                        className="px-2 bg-gradient-to-r from-red-500 to-orange-500 text-white hover:from-red-600 hover:to-orange-600"
                        title="Dispatch"
                        aria-label="Dispatch"
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    )}
                    {sub.status === "PENDING" && (
                      <Button
                        size="sm"
                        onClick={() =>
                          handleUpdateStatus(sub._id, "IN_PROGRESS")
                        }
                        disabled={actionLoading === sub._id}
                        className="bg-yellow-500 text-white hover:bg-yellow-600"
                        icon={
                          actionLoading === sub._id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Play className="w-3.5 h-3.5" />
                          )
                        }
                      >
                        Respond
                      </Button>
                    )}
                    {(sub.status === "PENDING" ||
                      sub.status === "IN_PROGRESS") && (
                      <Button
                        size="sm"
                        onClick={() => {
                          setSelectedSubmission(sub);
                          setShowResolveModal(true);
                          setResolutionNotes("");
                        }}
                        className="bg-green-500 text-white hover:bg-green-600"
                        icon={<CheckCircle className="w-3.5 h-3.5" />}
                      >
                        Resolve
                      </Button>
                    )}
                    {sub.phone && sub.phone !== "N/A" && (
                      <a
                        href={`tel:${sub.phone}`}
                        className="inline-flex items-center justify-center gap-1.5 h-8 px-3 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 text-xs font-medium"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        Call
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t border-gray-100">
            <p className="text-sm text-gray-500">
              Page {page} of {totalPages} ({total} total)
            </p>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page <= 1}
                icon={<ChevronLeft className="w-4 h-4" />}
              />
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page >= totalPages}
                icon={<ChevronRight className="w-4 h-4" />}
              />
            </div>
          </div>
        )}
      </div>

      {/* ================ DETAIL MODAL ================ */}
      {showDetailModal && selectedSubmission && (
        <Modal
          open={showDetailModal}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedSubmission(null);
            setSubmissionDispatches([]);
          }}
          size="lg"
          title={
            selectedSubmission.type === "CALL"
              ? "SOS Call Details"
              : selectedSubmission.type === "FORM"
                ? "SOS Form Details"
                : "App Download Details"
          }
          footer={
            <>
              {selectedSubmission.phone &&
                selectedSubmission.phone !== "N/A" && (
                  <a
                    href={`tel:${selectedSubmission.phone}`}
                    className="inline-flex items-center justify-center gap-2 h-10 px-4 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-medium text-sm"
                  >
                    <Phone className="w-4 h-4" />
                    Call User
                  </a>
                )}
              {(selectedSubmission.status === "PENDING" ||
                selectedSubmission.status === "IN_PROGRESS") && (
                <Button
                  onClick={() => handleOpenDispatch(selectedSubmission)}
                  className="bg-gradient-to-r from-red-500 to-orange-500 text-white hover:from-red-600 hover:to-orange-600 shadow-lg shadow-red-200"
                  icon={<Send className="w-4 h-4" />}
                >
                  Dispatch Emergency
                </Button>
              )}
              <Button
                variant="secondary"
                onClick={() => {
                  setShowDetailModal(false);
                  setSelectedSubmission(null);
                  setSubmissionDispatches([]);
                }}
              >
                Close
              </Button>
            </>
          }
        >
          <div className="space-y-5">
              {/* Info Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="mb-1 text-xs text-gray-500">Name</p>
                  <p className="font-medium text-gray-800">
                    {selectedSubmission.name}
                  </p>
                </div>
                <div>
                  <p className="mb-1 text-xs text-gray-500">Phone</p>
                  <p className="font-medium text-gray-800">
                    {selectedSubmission.phone}
                  </p>
                </div>
                {selectedSubmission.email && (
                  <div>
                    <p className="mb-1 text-xs text-gray-500">Email</p>
                    <p className="font-medium text-gray-800">
                      {selectedSubmission.email}
                    </p>
                  </div>
                )}
                <div>
                  <p className="mb-1 text-xs text-gray-500">Category</p>
                  {getCategoryBadge(selectedSubmission.type)}
                </div>
                <div>
                  <p className="mb-1 text-xs text-gray-500">Status</p>
                  <span
                    className={`px-2.5 py-1 rounded-full text-xs font-medium ${getStatusBadge(selectedSubmission.status)}`}
                  >
                    {selectedSubmission.status.replace("_", " ")}
                  </span>
                </div>
                <div>
                  <p className="mb-1 text-xs text-gray-500">Submitted</p>
                  <p className="text-sm text-gray-700">
                    {new Date(selectedSubmission.createdAt).toLocaleString()}
                  </p>
                </div>
                {selectedSubmission.emergencyType && (
                  <div>
                    <p className="mb-1 text-xs text-gray-500">Emergency Type</p>
                    <p className="font-medium text-orange-700">
                      {getEmergencyTypeLabel(selectedSubmission.emergencyType)}
                    </p>
                  </div>
                )}
                {selectedSubmission.numberOfPeople && (
                  <div>
                    <p className="mb-1 text-xs text-gray-500">
                      People Affected
                    </p>
                    <p className="font-medium text-gray-800">
                      {selectedSubmission.numberOfPeople}
                    </p>
                  </div>
                )}
              </div>

              {selectedSubmission.description && (
                <div>
                  <p className="mb-1 text-xs text-gray-500">Description</p>
                  <p className="p-3 text-sm text-gray-700 rounded-lg bg-gray-50">
                    {selectedSubmission.description}
                  </p>
                </div>
              )}
              {selectedSubmission.address && (
                <div>
                  <p className="mb-1 text-xs text-gray-500">Address</p>
                  <p className="flex items-center gap-1 text-sm text-gray-700">
                    <MapPin className="w-3.5 h-3.5 text-gray-400" />
                    {selectedSubmission.address}
                  </p>
                </div>
              )}
              {selectedSubmission.location?.coordinates && (
                <div>
                  <p className="mb-1 text-xs text-gray-500">GPS Location</p>
                  <a
                    href={`https://www.openstreetmap.org/?mlat=${selectedSubmission.location.coordinates[1]}&mlon=${selectedSubmission.location.coordinates[0]}#map=15/${selectedSubmission.location.coordinates[1]}/${selectedSubmission.location.coordinates[0]}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-sm text-healwin-600 hover:underline"
                  >
                    <MapPin className="w-3.5 h-3.5" />
                    {selectedSubmission.location.coordinates[1].toFixed(
                      6,
                    )}, {selectedSubmission.location.coordinates[0].toFixed(6)}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
              {selectedSubmission.resolutionNotes && (
                <div>
                  <p className="mb-1 text-xs text-gray-500">Resolution</p>
                  <p className="p-3 text-sm text-green-800 rounded-lg bg-green-50">
                    {selectedSubmission.resolutionNotes}
                  </p>
                </div>
              )}

              {/* ---- DISPATCHES SECTION ---- */}
              <div className="pt-4 border-t border-gray-100">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="flex items-center gap-2 font-semibold text-gray-800">
                    <Send className="w-4 h-4 text-red-500" />
                    Emergency Dispatches
                  </h4>
                  {(selectedSubmission.status === "PENDING" ||
                    selectedSubmission.status === "IN_PROGRESS") && (
                    <button
                      onClick={() => handleOpenDispatch(selectedSubmission)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-red-500 to-orange-500 text-white rounded-lg hover:from-red-600 hover:to-orange-600 text-xs font-medium"
                    >
                      <Send className="w-3.5 h-3.5" />
                      Send Dispatch
                    </button>
                  )}
                </div>

                {dispatchesLoading ? (
                  <div className="py-6 text-center">
                    <Loader2 className="w-5 h-5 mx-auto text-gray-400 animate-spin" />
                  </div>
                ) : submissionDispatches.length === 0 ? (
                  <div className="py-6 text-center text-gray-400 bg-gray-50 rounded-xl">
                    <Siren className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">No dispatches sent yet</p>
                    <p className="mt-1 text-xs">
                      Click "Send Dispatch" to alert nearby emergency services
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {submissionDispatches.map((d) => {
                      const config = getDispatchTypeConfig(d.dispatchType);
                      const Icon = getDispatchIcon(d.dispatchType);
                      return (
                        <div
                          key={d._id}
                          className={`rounded-xl border p-4 ${config.bgColor} ${config.borderColor}`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3">
                              <div
                                className={`w-10 h-10 rounded-lg flex items-center justify-center ${config.btnColor} shrink-0`}
                              >
                                <Icon className="w-5 h-5 text-white" />
                              </div>
                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <span
                                    className={`font-semibold ${config.textColor}`}
                                  >
                                    {config.label}
                                  </span>
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${getDispatchStatusBadge(d.status)}`}
                                  >
                                    {d.status.replace("_", " ")}
                                  </span>
                                  <span className="text-[10px] text-gray-500 px-1.5 py-0.5 rounded bg-white/60">
                                    {d.priority}
                                  </span>
                                </div>
                                <p className="text-sm font-medium text-gray-800 mt-0.5">
                                  {d.serviceName}
                                </p>
                                <p className="text-xs text-gray-600">
                                  {d.servicePhone}
                                  {d.serviceAddress && ` • ${d.serviceAddress}`}
                                </p>
                                {d.message && (
                                  <p className="mt-1 text-xs italic text-gray-500">
                                    "{d.message}"
                                  </p>
                                )}
                                <p className="text-[10px] text-gray-400 mt-1">
                                  Dispatched {getTimeAgo(d.dispatchedAt)}
                                  {d.dispatchedBy &&
                                    typeof d.dispatchedBy === "object" &&
                                    d.dispatchedBy.name &&
                                    ` by ${d.dispatchedBy.name}`}
                                  {d.estimatedArrival &&
                                    ` • ETA: ${d.estimatedArrival} min`}
                                </p>
                                {d.responseNotes && (
                                  <p className="mt-1 text-xs text-green-700">
                                    Response: {d.responseNotes}
                                  </p>
                                )}
                                {d.hospitalPatientId && (
                                  <p className="mt-1 text-xs font-medium text-blue-700">
                                    HMS patient: {d.hospitalPatientId.fullName || d.hospitalPatientId.patientId}
                                  </p>
                                )}
                                {d.otp && !["COMPLETED", "CANCELLED"].includes(d.status) && (
                                  <p className="mt-1 text-xs font-semibold text-amber-700">
                                    Pickup OTP: {d.otp}
                                  </p>
                                )}
                                {d.cancelReason && (
                                  <p className="mt-1 text-xs text-red-700">
                                    {d.cancelReason === "no_response"
                                      ? "⏱ Not answered — no crew response"
                                      : `Cancelled: ${humanizeCancelReason(d.cancelReason)}`}
                                  </p>
                                )}
                              </div>
                            </div>

                            {/* Dispatch status actions. Forward steps only
                                appear AFTER the crew accepts (ACKNOWLEDGED) —
                                a never-accepted (DISPATCHED) ride can only be
                                cancelled/reassigned, never advanced. */}
                            <div className="flex flex-col gap-1 shrink-0">
                              {d.status === "DISPATCHED" && (
                                <span className="text-[10px] px-2 py-1 rounded-md bg-gray-100 text-gray-500 text-center">
                                  Waiting for driver to accept…
                                </span>
                              )}
                              {d.status === "ACKNOWLEDGED" && (
                                <button
                                  onClick={() =>
                                    handleUpdateDispatchStatus(
                                      d._id,
                                      "EN_ROUTE",
                                    )
                                  }
                                  disabled={actionLoading === d._id}
                                  className="text-[10px] px-2 py-1 bg-yellow-500 text-white rounded-md hover:bg-yellow-600 disabled:opacity-50"
                                >
                                  {actionLoading === d._id ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    "En Route"
                                  )}
                                </button>
                              )}
                              {d.status === "EN_ROUTE" && (
                                <button
                                  onClick={() =>
                                    handleUpdateDispatchStatus(
                                      d._id,
                                      "ON_SCENE",
                                    )
                                  }
                                  disabled={actionLoading === d._id}
                                  className="text-[10px] px-2 py-1 bg-orange-500 text-white rounded-md hover:bg-orange-600 disabled:opacity-50"
                                >
                                  On Scene
                                </button>
                              )}
                              {["ACKNOWLEDGED", "EN_ROUTE", "ON_SCENE"].includes(
                                d.status,
                              ) && (
                                  <button
                                    onClick={() =>
                                      handleUpdateDispatchStatus(
                                        d._id,
                                        "COMPLETED",
                                        {
                                          responseNotes:
                                            "Emergency service completed",
                                        },
                                      )
                                    }
                                    disabled={actionLoading === d._id}
                                    className="text-[10px] px-2 py-1 bg-green-500 text-white rounded-md hover:bg-green-600 disabled:opacity-50"
                                  >
                                    Complete
                                  </button>
                                )}
                              {d.status !== "COMPLETED" &&
                                d.status !== "CANCELLED" && (
                                  <button
                                    onClick={() =>
                                      handleUpdateDispatchStatus(
                                        d._id,
                                        "CANCELLED",
                                        {
                                          cancelReason: "Cancelled by admin",
                                        },
                                      )
                                    }
                                    disabled={actionLoading === d._id}
                                    className="text-[10px] px-2 py-1 bg-red-100 text-red-700 rounded-md hover:bg-red-200 disabled:opacity-50"
                                  >
                                    Cancel
                                  </button>
                                )}
                              {d.servicePhone && (
                                <a
                                  href={`tel:${d.servicePhone}`}
                                  className="text-[10px] px-2 py-1 bg-blue-50 text-blue-700 rounded-md hover:bg-blue-100 text-center"
                                >
                                  <Phone className="w-3 h-3 inline mr-0.5" />
                                  Call
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* ---- AMBULANCE DISPATCH PANEL ---- */}
              {ambulanceFeature &&
                (selectedSubmission.status === "PENDING" ||
                  selectedSubmission.status === "IN_PROGRESS") && (
                  <div className="pt-4 border-t border-gray-100">
                    <h4 className="flex items-center gap-2 mb-3 font-semibold text-gray-800">
                      <Siren className="w-4 h-4 text-red-500" />
                      Ambulance Dispatch
                    </h4>
                    <DispatchPanel sosId={selectedSubmission._id} />
                  </div>
                )}
          </div>
        </Modal>
      )}

      {/* ================ DISPATCH MODAL ================ */}
      {showDispatchModal && selectedSubmission && (
        <Modal
          open={showDispatchModal}
          onClose={() => setShowDispatchModal(false)}
          title="Dispatch Emergency Service"
          subtitle={`For: ${selectedSubmission.name} (${selectedSubmission.phone}) — ${
            selectedSubmission.type === "CALL" ? "SOS Call" : "SOS Form"
          }`}
          footer={
            <>
              <Button
                variant="secondary"
                onClick={() => setShowDispatchModal(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleDispatch}
                disabled={
                  actionLoading === "dispatch" ||
                  (dispatchForm.dispatchType === "AMBULANCE"
                    ? !selectedAmbulanceId
                    : !dispatchForm.serviceName || !dispatchForm.servicePhone)
                }
                className="bg-gradient-to-r from-red-500 to-orange-500 text-white hover:from-red-600 hover:to-orange-600 shadow-lg shadow-red-200"
                icon={
                  actionLoading === "dispatch" ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )
                }
              >
                {actionLoading === "dispatch"
                  ? "Dispatching..."
                  : "Dispatch Now"}
              </Button>
            </>
          }
        >
          <div className="space-y-4 max-h-[65vh] overflow-y-auto">
              {/* Dispatch Type Selection */}
              <div>
                <label className="block mb-2 text-sm font-medium text-gray-700">
                  Emergency Service Type *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {DISPATCH_TYPES.map((dt) => {
                    const Icon = getDispatchIcon(dt.key);
                    return (
                      <button
                        key={dt.key}
                        type="button"
                        onClick={() =>
                          setDispatchForm({
                            ...dispatchForm,
                            dispatchType: dt.key,
                          })
                        }
                        className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-all text-left ${
                          dispatchForm.dispatchType === dt.key
                            ? `${dt.borderColor} ${dt.bgColor} ring-1 ring-offset-1`
                            : "border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        <Icon
                          className={`w-5 h-5 ${dispatchForm.dispatchType === dt.key ? dt.textColor : "text-gray-400"}`}
                        />
                        <span
                          className={`text-sm font-medium ${dispatchForm.dispatchType === dt.key ? dt.textColor : "text-gray-600"}`}
                        >
                          {dt.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* AMBULANCE → real fleet picker. Everything else → legacy
                  free-text inputs (kept until Police/Fire/Rescue get
                  modelled in the fleet system). */}
              {dispatchForm.dispatchType === "AMBULANCE" ? (
                <div>
                  <div className="flex items-center justify-between mb-2 gap-2">
                    <label className="text-sm font-medium text-gray-700">
                      {searchMode ? "Search Results" : "Nearby Ambulances"}
                      {nearbyAmbulances.length > 0 &&
                        ` (${nearbyAmbulances.length})`}
                    </label>
                    <div className="flex items-center gap-2">
                      {!searchMode && (
                        <select
                          value={radiusKm}
                          onChange={(e) =>
                            setRadiusKm(Number(e.target.value))
                          }
                          className="text-xs border border-gray-200 rounded-md px-2 py-1 bg-white"
                          title="Search radius from the SOS location"
                        >
                          <option value={5}>Within 5 km</option>
                          <option value={10}>Within 10 km</option>
                          <option value={25}>Within 25 km</option>
                          <option value={50}>Within 50 km</option>
                          <option value={100}>Within 100 km</option>
                          <option value={0}>Any distance</option>
                        </select>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          if (!selectedSubmission) return;
                          fetchNearbyAmbulances(
                            selectedSubmission._id,
                            searchMode ? ambulanceSearch.trim() : undefined,
                            radiusKm,
                          );
                        }}
                        className="flex items-center gap-1 text-xs text-healwin-600 hover:underline"
                      >
                        <RefreshCw className="w-3 h-3" />
                        Refresh
                      </button>
                    </div>
                  </div>
                  {/* Mobile-number search — when populated, switches the
                      list to a fleet-wide search that bypasses the
                      10 km radius and duty filters. Lets ops grab a
                      specific ambulance by phone even if it's outside
                      the nearby window. Clearing the box reverts to the
                      nearby view automatically. */}
                  <div className="relative mb-3">
                    <Search className="absolute w-3.5 h-3.5 text-gray-400 -translate-y-1/2 left-3 top-1/2" />
                    <input
                      type="text"
                      inputMode="tel"
                      placeholder="Search by driver/attendant mobile (e.g. 9800003)"
                      value={ambulanceSearch}
                      onChange={(e) => {
                        const v = e.target.value;
                        setAmbulanceSearch(v);
                        const trimmed = v.trim();
                        if (trimmed.length >= 3) {
                          setSearchMode(true);
                        } else if (trimmed.length === 0) {
                          setSearchMode(false);
                        }
                      }}
                      className="w-full pl-9 pr-9 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-red-200 focus:border-red-400 outline-none"
                    />
                    {ambulanceSearch && (
                      <button
                        type="button"
                        onClick={() => {
                          setAmbulanceSearch("");
                          setSearchMode(false);
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full flex items-center justify-center bg-gray-100 hover:bg-gray-200"
                        aria-label="Clear search"
                      >
                        <X className="w-3 h-3 text-gray-500" />
                      </button>
                    )}
                  </div>
                  {nearbyLoading && nearbyAmbulances.length === 0 ? (
                    <div className="flex items-center justify-center py-8 text-gray-400 bg-gray-50 rounded-xl">
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      <span className="text-sm">Locating ambulances…</span>
                    </div>
                  ) : nearbyAmbulances.length === 0 ? (
                    <div className="py-6 px-4 text-center text-gray-600 bg-gray-50 rounded-xl">
                      <Siren className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      <p className="text-sm font-medium">
                        {nearbyError ||
                          "No ambulances currently available in range."}
                      </p>
                      {nearbyDiagnostics && (
                        <div className="mt-3 text-left text-xs text-gray-500 bg-white border border-gray-200 rounded-lg p-3 space-y-1">
                          <p className="font-semibold text-gray-700 mb-1">
                            Fleet status: {nearbyDiagnostics.total} vehicle
                            {nearbyDiagnostics.total === 1 ? "" : "s"} ·{" "}
                            {nearbyDiagnostics.available} dispatchable
                          </p>
                          {nearbyDiagnostics.missingAttendant > 0 && (
                            <p>
                              • {nearbyDiagnostics.missingAttendant} missing an
                              attendant assignment
                            </p>
                          )}
                          {nearbyDiagnostics.missingDriver > 0 && (
                            <p>
                              • {nearbyDiagnostics.missingDriver} missing a
                              driver assignment
                            </p>
                          )}
                          {nearbyDiagnostics.driverOffDuty > 0 && (
                            <p>
                              • {nearbyDiagnostics.driverOffDuty} driver
                              {nearbyDiagnostics.driverOffDuty === 1
                                ? ""
                                : "s"}{" "}
                              off duty
                            </p>
                          )}
                          {nearbyDiagnostics.attendantOffDuty > 0 && (
                            <p>
                              • {nearbyDiagnostics.attendantOffDuty} attendant
                              {nearbyDiagnostics.attendantOffDuty === 1
                                ? ""
                                : "s"}{" "}
                              off duty
                            </p>
                          )}
                          {nearbyDiagnostics.locationStale > 0 && (
                            <p>
                              • {nearbyDiagnostics.locationStale} with stale
                              location (no ping in last 5 min)
                            </p>
                          )}
                          {nearbyDiagnostics.onDispatch > 0 && (
                            <p>
                              • {nearbyDiagnostics.onDispatch} already on a
                              dispatch
                            </p>
                          )}
                          {nearbyDiagnostics.offline > 0 && (
                            <p>
                              • {nearbyDiagnostics.offline} marked offline
                            </p>
                          )}
                          {nearbyDiagnostics.maintenance > 0 && (
                            <p>
                              • {nearbyDiagnostics.maintenance} in maintenance
                            </p>
                          )}
                          {nearbyDiagnostics.inactive > 0 && (
                            <p>
                              • {nearbyDiagnostics.inactive} deactivated by
                              admin
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <ul className="space-y-2 max-h-60 overflow-y-auto pr-1">
                      {nearbyAmbulances.map((a, i) => {
                        const isSelected =
                          selectedAmbulanceId === a.ambulanceId;
                        return (
                          <li key={a.ambulanceId}>
                            <button
                              type="button"
                              onClick={() =>
                                setSelectedAmbulanceId(a.ambulanceId)
                              }
                              className={`w-full flex items-center justify-between gap-3 p-3 rounded-xl border text-left transition-all ${
                                isSelected
                                  ? "border-red-300 bg-red-50 ring-1 ring-red-200"
                                  : "border-gray-200 hover:border-gray-300 bg-white"
                              }`}
                            >
                              <div className="min-w-0">
                                <p className="font-mono text-sm font-medium text-gray-800 truncate">
                                  #{i + 1} {a.registrationNumber}
                                  <span className="ml-2 text-[10px] uppercase font-semibold text-gray-500">
                                    {a.ambulanceType}
                                  </span>
                                </p>
                                <p className="text-xs text-gray-600 truncate">
                                  {a.providerName} · Driver {a.driverName}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {a.roadDistanceKm} km · ETA {a.etaMinutes} min
                                </p>
                              </div>
                              <span
                                className={`shrink-0 inline-flex items-center justify-center w-6 h-6 rounded-full border-2 ${
                                  isSelected
                                    ? "bg-red-500 border-red-500"
                                    : "border-gray-300"
                                }`}
                              >
                                {isSelected && (
                                  <CheckCircle className="w-4 h-4 text-white" />
                                )}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              ) : (
                <>
                  <Field label="Service / Center Name *">
                    <Input
                      type="text"
                      value={dispatchForm.serviceName}
                      onChange={(e) =>
                        setDispatchForm({
                          ...dispatchForm,
                          serviceName: e.target.value,
                        })
                      }
                      placeholder="e.g. City Hospital, Local Police Station"
                    />
                  </Field>
                  <Field label="Service Phone Number *">
                    <Input
                      type="tel"
                      value={dispatchForm.servicePhone}
                      onChange={(e) =>
                        setDispatchForm({
                          ...dispatchForm,
                          servicePhone: e.target.value,
                        })
                      }
                      placeholder="e.g. 108, 100, +91 XXXXX XXXXX"
                    />
                  </Field>
                  <Field label="Service Address">
                    <Input
                      type="text"
                      value={dispatchForm.serviceAddress}
                      onChange={(e) =>
                        setDispatchForm({
                          ...dispatchForm,
                          serviceAddress: e.target.value,
                        })
                      }
                      placeholder="Address of the emergency center"
                    />
                  </Field>
                </>
              )}

              {/* Priority & ETA */}
              <div className="grid grid-cols-2 gap-4">
                <Field label="Priority">
                  <Select
                    value={dispatchForm.priority}
                    onChange={(e) =>
                      setDispatchForm({
                        ...dispatchForm,
                        priority: e.target.value,
                      })
                    }
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="CRITICAL">Critical</option>
                  </Select>
                </Field>
                <Field label="ETA (minutes)">
                  <Input
                    type="number"
                    min={1}
                    value={dispatchForm.estimatedArrival}
                    onChange={(e) =>
                      setDispatchForm({
                        ...dispatchForm,
                        estimatedArrival: Number(e.target.value),
                      })
                    }
                  />
                </Field>
              </div>

              {/* Message */}
              <Field label="Admin Notes / Message">
                <Textarea
                  value={dispatchForm.message}
                  onChange={(e) =>
                    setDispatchForm({
                      ...dispatchForm,
                      message: e.target.value,
                    })
                  }
                  rows={2}
                  className="resize-none"
                  placeholder="Any notes for the dispatch team..."
                />
              </Field>

              {/* User location info */}
              {selectedSubmission.location?.coordinates && (
                <div className="flex items-center gap-2 px-3 py-2 text-xs text-green-700 rounded-lg bg-green-50">
                  <MapPin className="w-3.5 h-3.5" />
                  User location:{" "}
                  {selectedSubmission.location.coordinates[1].toFixed(4)},{" "}
                  {selectedSubmission.location.coordinates[0].toFixed(4)}
                  <a
                    href={`https://www.openstreetmap.org/?mlat=${selectedSubmission.location.coordinates[1]}&mlon=${selectedSubmission.location.coordinates[0]}#map=15/${selectedSubmission.location.coordinates[1]}/${selectedSubmission.location.coordinates[0]}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-auto text-healwin-600 hover:underline flex items-center gap-0.5"
                  >
                    Open Map <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
          </div>
        </Modal>
      )}

      {/* ================ RESOLVE MODAL ================ */}
      {showResolveModal && selectedSubmission && (
        <Modal
          open={showResolveModal}
          onClose={() => {
            setShowResolveModal(false);
            setSelectedSubmission(null);
            setResolutionNotes("");
          }}
          size="sm"
          title="Resolve SOS Submission"
          subtitle={`From: ${selectedSubmission.name} (${selectedSubmission.phone})`}
          footer={
            <>
              <Button
                variant="secondary"
                onClick={() => {
                  setShowResolveModal(false);
                  setSelectedSubmission(null);
                  setResolutionNotes("");
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={() =>
                  handleUpdateStatus(
                    selectedSubmission._id,
                    "RESOLVED",
                    resolutionNotes,
                  )
                }
                disabled={!resolutionNotes || actionLoading !== null}
                className="bg-green-600 text-white hover:bg-green-700"
                icon={
                  actionLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle className="w-4 h-4" />
                  )
                }
              >
                Resolve
              </Button>
            </>
          }
        >
          <Field label="Resolution Notes">
            <Textarea
              value={resolutionNotes}
              onChange={(e) => setResolutionNotes(e.target.value)}
              rows={4}
              placeholder="Describe how the situation was resolved..."
            />
          </Field>
        </Modal>
      )}
    </div>
  );
};

export default SOSDashboard;
