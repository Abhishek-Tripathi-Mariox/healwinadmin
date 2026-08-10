import React, { useEffect, useState } from "react";
import { applicationsApi, careersApi } from "../services/admin-api";
import Pagination from "../components/Pagination";
import {
  PageHeader,
  Button,
  SearchInput,
  Select,
  Input,
  Table,
  THead,
  TBody,
  TR,
  Th,
  Td,
  TableState,
  Badge,
  Modal,
  Alert,
} from "../components/ui";

const statusOptions = [
  "NEW",
  "IN_REVIEW",
  "SHORTLISTED",
  "ONHOLD",
  "REJECTED",
  "HIRED",
];

type BadgeTone = "neutral" | "success" | "warning" | "danger" | "info" | "accent";

const statusTone: Record<string, BadgeTone> = {
  NEW: "info",
  IN_REVIEW: "warning",
  SHORTLISTED: "success",
  ONHOLD: "warning",
  REJECTED: "danger",
  HIRED: "success",
};

interface AppDoc {
  _id: string;
  name: string;
  email: string;
  phone: string;
  dob?: string;
  gender?: string;
  maritalStatus?: string;
  address?: string;
  department?: string;
  position?: string;
  resumeUrl?: string;
  passportPhotoUrl?: string;
  idProofUrl?: string;
  educationalCertificatesUrl?: string;
  professionalRegistrationUrl?: string;
  experienceCertificatesUrl?: string;
  otherDocumentsUrl?: string;
  declaration?: boolean;
  experience?: string;
  coverLetter?: string;
  status: string;
  appliedAt: string;
  selectedStates?: { _id: string; name: string }[];
  selectedDistricts?: { _id: string; name: string }[];
  careerId?: { title: string; department?: string; location?: string };
}

const docFields: { key: keyof AppDoc; label: string }[] = [
  { key: "resumeUrl", label: "Resume / CV" },
  { key: "passportPhotoUrl", label: "Passport Photo" },
  { key: "idProofUrl", label: "ID Proof" },
  { key: "educationalCertificatesUrl", label: "Educational Certificates" },
  { key: "professionalRegistrationUrl", label: "Professional Registration" },
  { key: "experienceCertificatesUrl", label: "Experience Certificates" },
  { key: "otherDocumentsUrl", label: "Other Documents" },
];

const ApplicationsManagement: React.FC = () => {
  const [applications, setApplications] = useState<AppDoc[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [genderFilter, setGenderFilter] = useState("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selected, setSelected] = useState<AppDoc | null>(null);
  const [departments, setDepartments] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const buildParams = (): Record<string, string> => {
    const params: Record<string, string> = {};
    if (statusFilter !== "all") params.status = statusFilter;
    if (genderFilter !== "all") params.gender = genderFilter;
    if (departmentFilter !== "all") params.department = departmentFilter;
    if (search.trim()) params.q = search.trim();
    if (dateFrom) params.dateFrom = dateFrom;
    if (dateTo) params.dateTo = dateTo;
    return params;
  };

  const loadApplications = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await applicationsApi.getAll({
        ...buildParams(),
        page: String(page),
        limit: String(limit),
      });
      const d = res.data;
      if (d?.items) {
        setApplications(d.items);
        setTotalPages(d.pagination?.pages || 1);
        setTotal(d.pagination?.total || 0);
      } else {
        setApplications(d || []);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load applications");
    } finally {
      setIsLoading(false);
    }
  };

  const loadDepartments = async () => {
    try {
      const res = await careersApi.getDepartments();
      setDepartments(res.data || []);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    loadDepartments();
  }, []);

  useEffect(() => {
    loadApplications();
  }, [statusFilter, genderFilter, departmentFilter, dateFrom, dateTo, page, limit]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, genderFilter, departmentFilter, dateFrom, dateTo, search, limit]);

  const handleStatusChange = async (id: string, status: string) => {
    setError(null);
    try {
      await applicationsApi.updateStatus(id, status);
      await loadApplications();
      if (selected && selected._id === id) {
        setSelected((prev) => (prev ? { ...prev, status } : null));
      }
    } catch (err: any) {
      setError(err.message || "Failed to update status");
    }
  };

  const handleExport = async () => {
    setExporting(true);
    setError(null);
    try {
      const res = await applicationsApi.exportData(buildParams());
      const rows = res.data || [];
      if (rows.length === 0) {
        setError("No data to export");
        return;
      }
      const headers = Object.keys(rows[0]);
      const csv = [
        headers.join(","),
        ...rows.map((row: any) =>
          headers
            .map((h) => {
              const v = String(row[h] || "").replace(/"/g, '""');
              return `"${v}"`;
            })
            .join(","),
        ),
      ].join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `applications_export_${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (err: any) {
      setError(err.message || "Failed to export");
    } finally {
      setExporting(false);
    }
  };

  const fmtDate = (d?: string) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <div className="p-6">
      <PageHeader
        title="Job Applications"
        subtitle="Review candidates and manage application status"
        actions={
          <>
            <Button variant="secondary" onClick={() => setShowFilters(!showFilters)}>
              {showFilters ? "Hide Filters" : "More Filters"}
            </Button>
            <Button onClick={handleExport} disabled={exporting}>
              {exporting ? "Exporting..." : "Export Excel"}
            </Button>
          </>
        }
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

      <div className="flex flex-wrap gap-2 mb-4">
        <SearchInput
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && loadApplications()}
          placeholder="Search name, email, or phone"
          className="w-full max-w-xs"
        />
        <Button variant="secondary" onClick={loadApplications}>
          Search
        </Button>
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-auto"
        >
          <option value="all">All Status</option>
          {statusOptions.map((s) => (
            <option key={s} value={s}>
              {s.replace("_", " ")}
            </option>
          ))}
        </Select>
        {showFilters && (
          <>
            <Select
              value={genderFilter}
              onChange={(e) => setGenderFilter(e.target.value)}
              className="w-auto"
            >
              <option value="all">All Genders</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </Select>
            <Select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="w-auto"
            >
              <option value="all">All Departments</option>
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </Select>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-auto"
            />
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-auto"
            />
          </>
        )}
      </div>

      <Table>
        <THead>
          <Th>Name</Th>
          <Th>Phone</Th>
          <Th>Email</Th>
          <Th>Department</Th>
          <Th>Position</Th>
          <Th>Applied On</Th>
          <Th>Status</Th>
          <Th className="text-right">Actions</Th>
        </THead>
        <TBody>
          {isLoading ? (
            <TableState colSpan={8}>Loading applications...</TableState>
          ) : applications.length === 0 ? (
            <TableState colSpan={8}>No applications found.</TableState>
          ) : (
            applications.map((app) => (
              <TR
                key={app._id}
                clickable
                onClick={() => setSelected(app)}
              >
                <Td className="font-medium text-gray-900 whitespace-nowrap">
                  {app.name}
                </Td>
                <Td className="text-gray-500 whitespace-nowrap">{app.phone}</Td>
                <Td className="text-gray-500 whitespace-nowrap">{app.email}</Td>
                <Td className="text-gray-500 whitespace-nowrap">
                  {app.department || app.careerId?.department || "—"}
                </Td>
                <Td className="text-gray-500 whitespace-nowrap">
                  {app.position || app.careerId?.title || "—"}
                </Td>
                <Td className="text-gray-500 whitespace-nowrap">
                  {fmtDate(app.appliedAt)}
                </Td>
                <Td className="whitespace-nowrap">
                  <Badge tone={statusTone[app.status] || "neutral"} dot>
                    {app.status.replace("_", " ")}
                  </Badge>
                </Td>
                <Td className="text-right whitespace-nowrap">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelected(app);
                    }}
                  >
                    View →
                  </Button>
                </Td>
              </TR>
            ))
          )}
        </TBody>
      </Table>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm text-gray-600">
          Rows per page
          <select
            value={limit}
            onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}
            className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-sky-500 focus:outline-none"
          >
            {[5, 10, 20, 50, 100].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </label>
        <Pagination
          page={page}
          totalPages={totalPages}
          total={total}
          label="applications"
          onPageChange={setPage}
        />
      </div>

      {/* Application detail */}
      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title="Application Detail"
        size="lg"
      >
        {selected && (
          <div className="space-y-6">
            {/* Status */}
            <div className="flex items-center justify-between">
              <Badge tone={statusTone[selected.status] || "neutral"} dot>
                {selected.status.replace("_", " ")}
              </Badge>
              <Select
                value={selected.status}
                onChange={(e) => handleStatusChange(selected._id, e.target.value)}
                className="w-auto"
              >
                {statusOptions.map((s) => (
                  <option key={s} value={s}>
                    {s.replace("_", " ")}
                  </option>
                ))}
              </Select>
            </div>

            {/* Personal Details */}
            <section>
              <h3 className="mb-3 text-sm font-semibold text-gray-400 uppercase tracking-wider">
                Personal Details
              </h3>
              <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-sm">
                <Detail label="Name" value={selected.name} />
                <Detail label="Phone" value={selected.phone} />
                <Detail label="Email" value={selected.email} span2 />
                <Detail label="Date of Birth" value={fmtDate(selected.dob)} />
                <Detail label="Gender" value={selected.gender} />
                <Detail label="Marital Status" value={selected.maritalStatus} />
                <Detail label="Address" value={selected.address} span2 />
              </div>
            </section>

            {/* Position */}
            <section>
              <h3 className="mb-3 text-sm font-semibold text-gray-400 uppercase tracking-wider">
                Position Info
              </h3>
              <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-sm">
                <Detail
                  label="Department"
                  value={
                    selected.department || selected.careerId?.department || "—"
                  }
                />
                <Detail
                  label="Position"
                  value={selected.position || selected.careerId?.title || "—"}
                />
                <Detail label="Applied On" value={fmtDate(selected.appliedAt)} />
                <Detail
                  label="Declaration"
                  value={selected.declaration ? "✓ Yes" : "✗ No"}
                />
              </div>
            </section>

            {/* Selected Locations */}
            {((selected.selectedStates && selected.selectedStates.length > 0) ||
              (selected.selectedDistricts &&
                selected.selectedDistricts.length > 0)) && (
              <section>
                <h3 className="mb-3 text-sm font-semibold text-gray-400 uppercase tracking-wider">
                  Preferred Locations
                </h3>
                <div className="flex flex-wrap gap-2">
                  {(selected.selectedStates || []).map((s: any) => (
                    <Badge key={s._id} tone="info">
                      {s.name}
                    </Badge>
                  ))}
                  {(selected.selectedDistricts || []).map((d: any) => (
                    <Badge key={d._id} tone="success">
                      {d.name}
                    </Badge>
                  ))}
                </div>
              </section>
            )}

            {/* Documents */}
            <section>
              <h3 className="mb-3 text-sm font-semibold text-gray-400 uppercase tracking-wider">
                Documents
              </h3>
              <div className="space-y-2">
                {docFields.map(({ key, label }) => {
                  const url = selected[key] as string | undefined;
                  return (
                    <div
                      key={key}
                      className="flex items-center justify-between p-2.5 rounded-lg border"
                    >
                      <span className="text-sm text-gray-700">{label}</span>
                      {url ? (
                        <a
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3 py-1 text-xs font-medium rounded-lg bg-healwin-50 text-healwin-600 hover:bg-healwin-100"
                        >
                          Download ↓
                        </a>
                      ) : (
                        <span className="text-xs text-gray-400">
                          Not uploaded
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Legacy fields */}
            {(selected.experience || selected.coverLetter) && (
              <section>
                <h3 className="mb-3 text-sm font-semibold text-gray-400 uppercase tracking-wider">
                  Additional Info
                </h3>
                {selected.experience && (
                  <Detail label="Experience" value={selected.experience} />
                )}
                {selected.coverLetter && (
                  <div className="mt-2">
                    <span className="text-xs text-gray-400">Cover Letter</span>
                    <p className="mt-1 text-sm text-gray-700 whitespace-pre-wrap">
                      {selected.coverLetter}
                    </p>
                  </div>
                )}
              </section>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

/* ── Tiny Detail row component ── */
const Detail: React.FC<{
  label: string;
  value?: string | null;
  span2?: boolean;
}> = ({ label, value, span2 }) => (
  <div className={span2 ? "col-span-2" : ""}>
    <span className="text-xs text-gray-400">{label}</span>
    <p className="text-gray-800">{value || "—"}</p>
  </div>
);

export default ApplicationsManagement;
