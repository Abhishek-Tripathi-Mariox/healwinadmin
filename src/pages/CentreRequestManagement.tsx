import React, { useEffect, useState, useCallback } from "react";
import { Check, X, Trash2 } from "lucide-react";
import { centreRequestApi, stateApi, districtApi } from "../services/admin-api";
import Pagination from "../components/Pagination";
import {
  PageHeader,
  Button,
  Badge,
  Card,
  Alert,
  SearchInput,
  Select,
  Input,
  Field,
  Spinner,
} from "../components/ui";

interface CentreRequestItem {
  _id: string;
  name: string;
  type: string;
  address: string;
  state: string;
  district: string;
  division: { _id: string; name: string } | null;
  phone: string;
  email: string;
  website: string;
  serviceTypes: { _id: string; name: string }[];
  departments: { _id: string; name: string }[];
  services: string[];
  timings: string;
  info: string;
  contactPerson: string;
  contactPhone: string;
  contactEmail: string;
  status: "pending" | "approved" | "rejected";
  adminNote: string;
  createdAt: string;
}

const STATUS_TONES: Record<string, "warning" | "success" | "danger"> = {
  pending: "warning",
  approved: "success",
  rejected: "danger",
};

const CentreRequestManagement: React.FC = () => {
  const [requests, setRequests] = useState<CentreRequestItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [noteId, setNoteId] = useState<string | null>(null);
  const [adminNote, setAdminNote] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [districtFilter, setDistrictFilter] = useState("");
  const [stateOptions, setStateOptions] = useState<
    { _id: string; name: string }[]
  >([]);
  const [approveStateId, setApproveStateId] = useState("");
  const [approveDistrictId, setApproveDistrictId] = useState("");
  const [approveDistrictOptions, setApproveDistrictOptions] = useState<
    { _id: string; name: string }[]
  >([]);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = {};
      if (statusFilter !== "all") params.status = statusFilter;
      if (stateFilter) params.state = stateFilter;
      if (districtFilter) params.district = districtFilter;
      if (search.trim()) params.q = search.trim();
      params.page = String(page);
      params.limit = "20";
      const res = await centreRequestApi.getAll(params);
      const d = res.data;
      if (d?.items) {
        setRequests(d.items);
        setTotalPages(d.pagination?.pages || 1);
        setTotal(d.pagination?.total || 0);
      } else {
        setRequests(d || []);
      }
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to load centre requests",
      );
    } finally {
      setLoading(false);
    }
  }, [statusFilter, stateFilter, districtFilter, search, page]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, stateFilter, districtFilter, search]);

  useEffect(() => {
    const loadStates = async () => {
      try {
        const res = await stateApi.getAll({ status: "active", limit: "500" });
        setStateOptions(res.data?.items || res.data || []);
      } catch (err: unknown) {
        console.error("Failed to load states:", err);
      }
    };
    loadStates();
  }, []);

  useEffect(() => {
    if (!approveStateId) {
      setApproveDistrictOptions([]);
      setApproveDistrictId("");
      return;
    }
    const loadDists = async () => {
      try {
        const res = await districtApi.getAll({
          state: approveStateId,
          status: "active",
          limit: "500",
        });
        setApproveDistrictOptions(res.data?.items || res.data || []);
      } catch (err: unknown) {
        console.error("Failed to load districts:", err);
      }
    };
    loadDists();
  }, [approveStateId]);

  const handleApprove = async (id: string) => {
    if (!approveStateId || !approveDistrictId) {
      setError("Please select State and District before approving.");
      return;
    }
    if (
      !window.confirm(
        "Approve this centre request? It will be added to Centres.",
      )
    )
      return;
    setError(null);
    try {
      await centreRequestApi.approve(id, {
        adminNote,
        state: approveStateId,
        district: approveDistrictId,
      });
      setNoteId(null);
      setAdminNote("");
      setApproveStateId("");
      setApproveDistrictId("");
      await loadRequests();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to approve");
    }
  };

  const handleReject = async (id: string) => {
    if (!window.confirm("Reject this centre request?")) return;
    setError(null);
    try {
      await centreRequestApi.reject(id, { adminNote });
      setNoteId(null);
      setAdminNote("");
      await loadRequests();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to reject");
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this centre request permanently?")) return;
    setError(null);
    try {
      await centreRequestApi.remove(id);
      await loadRequests();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    }
  };

  return (
    <div className="p-6">
      <PageHeader
        title="Centre Locator Requests"
        subtitle={`${total} request${total !== 1 ? "s" : ""}`}
      />

      {error && (
        <Alert className="mb-4" tone="danger">
          <span className="flex items-center justify-between gap-4">
            {error}
            <button onClick={() => setError(null)} className="font-bold">
              ×
            </button>
          </span>
        </Alert>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <SearchInput
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, address, contact..."
          className="flex-1 min-w-[200px]"
        />
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-auto"
        >
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </Select>
        <Input
          value={stateFilter}
          onChange={(e) => {
            setStateFilter(e.target.value);
            setDistrictFilter("");
          }}
          placeholder="Filter by state..."
          className="min-w-[150px] w-auto"
        />
        <Input
          value={districtFilter}
          onChange={(e) => setDistrictFilter(e.target.value)}
          placeholder="Filter by district..."
          className="min-w-[150px] w-auto"
        />
      </div>

      {/* Requests List */}
      {loading ? (
        <Card padded className="flex items-center justify-center py-12 text-sm text-gray-400">
          <Spinner className="mr-2" /> Loading...
        </Card>
      ) : requests.length === 0 ? (
        <Card padded className="py-12 text-center text-sm text-gray-400">
          No centre requests found.
        </Card>
      ) : (
        <div className="space-y-4">
          {requests.map((req) => (
            <Card key={req._id} className="overflow-hidden">
              {/* Request Summary Row */}
              <div
                className="flex flex-wrap items-center justify-between gap-4 p-4 cursor-pointer hover:bg-gray-50"
                onClick={() =>
                  setExpandedId(expandedId === req._id ? null : req._id)
                }
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-semibold text-gray-800 truncate">
                      {req.name}
                    </h3>
                    <Badge tone={STATUS_TONES[req.status] || "neutral"} dot>
                      {req.status}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-gray-500 truncate">
                    {req.address}
                  </p>
                  <p className="mt-1 text-xs text-gray-400">
                    Contact: {req.contactPerson} &middot; {req.contactPhone}
                    {req.contactEmail ? ` · ${req.contactEmail}` : ""}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-400">
                    {new Date(req.createdAt).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                  <p className="mt-1 text-xs text-gray-400">
                    {req.state || "—"}, {req.district || "—"}
                  </p>
                </div>
              </div>

              {/* Expanded Details */}
              {expandedId === req._id && (
                <div className="px-4 pb-4 border-t border-gray-100">
                  <div className="grid grid-cols-1 gap-4 pt-4 md:grid-cols-2 lg:grid-cols-3">
                    <div>
                      <p className="text-xs font-medium text-gray-500">Phone</p>
                      <p className="text-sm">{req.phone || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-500">Email</p>
                      <p className="text-sm">{req.email || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-500">
                        Website
                      </p>
                      <p className="text-sm">{req.website || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-500">
                        Timings
                      </p>
                      <p className="text-sm">{req.timings || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-500">
                        Department
                      </p>
                      <p className="text-sm">{req.division?.name || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-500">
                        Service Types
                      </p>
                      <p className="text-sm">
                        {req.serviceTypes?.length
                          ? req.serviceTypes.map((s) => s.name).join(", ")
                          : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-500">
                        Departments
                      </p>
                      <p className="text-sm">
                        {req.departments?.length
                          ? req.departments.map((d) => d.name).join(", ")
                          : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-500">
                        Services
                      </p>
                      <p className="text-sm">
                        {req.services?.length ? req.services.join(", ") : "—"}
                      </p>
                    </div>
                    {req.info && (
                      <div className="col-span-full">
                        <p className="text-xs font-medium text-gray-500">
                          Description / Info
                        </p>
                        <p className="text-sm">{req.info}</p>
                      </div>
                    )}
                    {req.adminNote && (
                      <div className="col-span-full">
                        <p className="text-xs font-medium text-gray-500">
                          Admin Note
                        </p>
                        <p className="text-sm italic text-gray-600">
                          {req.adminNote}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap items-center gap-3 pt-4 mt-4 border-t border-gray-100">
                    {req.status === "pending" && (
                      <>
                        {noteId === req._id ? (
                          <div className="flex-1 min-w-0 space-y-3">
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                              <Field
                                label="Assign State *"
                                hint={`Submitted: ${req.state || "—"}`}
                              >
                                <Select
                                  value={approveStateId}
                                  onChange={(e) => {
                                    setApproveStateId(e.target.value);
                                    setApproveDistrictId("");
                                  }}
                                >
                                  <option value="">Select State</option>
                                  {stateOptions.map((s) => (
                                    <option key={s._id} value={s._id}>
                                      {s.name}
                                    </option>
                                  ))}
                                </Select>
                              </Field>
                              <Field
                                label="Assign District *"
                                hint={`Submitted: ${req.district || "—"}`}
                              >
                                <Select
                                  value={approveDistrictId}
                                  onChange={(e) =>
                                    setApproveDistrictId(e.target.value)
                                  }
                                  disabled={!approveStateId}
                                >
                                  <option value="">Select District</option>
                                  {approveDistrictOptions.map((d) => (
                                    <option key={d._id} value={d._id}>
                                      {d.name}
                                    </option>
                                  ))}
                                </Select>
                              </Field>
                            </div>
                            <div className="flex flex-wrap items-end gap-2">
                              <Field
                                label="Admin Note (optional)"
                                className="flex-1 min-w-[200px]"
                              >
                                <Input
                                  value={adminNote}
                                  onChange={(e) => setAdminNote(e.target.value)}
                                  placeholder="Add a note..."
                                />
                              </Field>
                              <Button
                                onClick={() => handleApprove(req._id)}
                                className="bg-green-600 hover:bg-green-700 focus-visible:ring-green-500"
                              >
                                Confirm Approve
                              </Button>
                              <Button
                                variant="danger"
                                onClick={() => handleReject(req._id)}
                              >
                                Confirm Reject
                              </Button>
                              <Button
                                variant="secondary"
                                onClick={() => {
                                  setNoteId(null);
                                  setAdminNote("");
                                  setApproveStateId("");
                                  setApproveDistrictId("");
                                }}
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <Button
                              className="px-2 bg-green-600 hover:bg-green-700 focus-visible:ring-green-500"
                              title="Approve"
                              aria-label="Approve"
                              onClick={() => setNoteId(req._id)}
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="danger"
                              className="px-2"
                              title="Reject"
                              aria-label="Reject"
                              onClick={() => setNoteId(req._id)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </>
                    )}
                    <Button
                      variant="ghost"
                      className="px-2 text-red-600 hover:bg-red-50 hover:text-red-700"
                      title="Delete"
                      aria-label="Delete"
                      onClick={() => handleDelete(req._id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <Pagination
        page={page}
        totalPages={totalPages}
        total={total}
        label="centre requests"
        onPageChange={setPage}
      />
    </div>
  );
};

export default CentreRequestManagement;
