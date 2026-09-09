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
  Field,
  Textarea,
} from "../components/ui";
import { dialog } from "../services/dialog";

const statusOptions = [
  "NEW",
  "IN_REVIEW",
  "SHORTLISTED",
  "INTERVIEW_SCHEDULED",
  "OFFER_ACCEPTED",
  "APPOINTED",
  "ONHOLD",
  "REJECTED",
  "HIRED",
];

const statusLabel = (s: string) =>
  s
    .split("_")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");

type BadgeTone = "neutral" | "success" | "warning" | "danger" | "info" | "accent";

const statusTone: Record<string, BadgeTone> = {
  NEW: "info",
  IN_REVIEW: "warning",
  SHORTLISTED: "success",
  INTERVIEW_SCHEDULED: "accent",
  OFFER_ACCEPTED: "info",
  APPOINTED: "success",
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
  interview?: {
    evaluationRemarks?: string;
    rating?: number;
    interviewerName?: string;
    recommendation?: string;
    hrReview?: string;
    managementReview?: string;
    mode: "ONLINE" | "WALK_IN";
    scheduledAt: string;
    durationMinutes?: number;
    roundName?: string;
    meetingLink?: string;
    venueName?: string;
    venueAddress?: string;
    contactPerson?: string;
    contactPhone?: string;
    instructions?: string;
  } | null;
  appointment?: {
    designation: string;
    department?: string;
    joiningDate: string;
    location?: string;
    reportingTo?: string;
    appointmentLetterUrl?: string;
  } | null;
  offer?: {
    designation: string;
    department?: string;
    ctcAnnual: number;
    joiningDate: string;
    location?: string;
    reportingTo?: string;
    offerLetterUrl?: string;
    notes?: string;
    acceptedAt?: string;
    declinedAt?: string;
    declineReason?: string;
    signedOfferUrl?: string;
  } | null;
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

  // Interview scheduling. The form starts as a walk-in at a Healwin centre
  // because that is the common case; switching to ONLINE swaps which fields
  // are required (link vs address).
  const [interviewOpen, setInterviewOpen] = useState(false);
  const [offerOpen, setOfferOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modalErr, setModalErr] = useState("");
  const [notice, setNotice] = useState("");
  const [ivForm, setIvForm] = useState({
    mode: "WALK_IN" as "ONLINE" | "WALK_IN",
    scheduledAt: "",
    durationMinutes: 30,
    roundName: "",
    meetingLink: "",
    venueName: "",
    venueAddress: "",
    contactPerson: "",
    contactPhone: "",
    instructions: "",
  });
  const [offerForm, setOfferForm] = useState({
    designation: "",
    department: "",
    ctcAnnual: "",
    joiningDate: "",
    location: "",
    reportingTo: "",
    notes: "",
  });

  const openInterview = () => {
    if (!selected) return;
    setModalErr("");
    const iv = selected.interview;
    setIvForm({
      mode: iv?.mode || "WALK_IN",
      // Prefill from the existing interview so a reschedule edits rather than
      // starts from a blank form.
      scheduledAt: iv?.scheduledAt
        ? new Date(iv.scheduledAt).toISOString().slice(0, 16)
        : "",
      durationMinutes: iv?.durationMinutes || 30,
      roundName: iv?.roundName || "",
      meetingLink: iv?.meetingLink || "",
      venueName: iv?.venueName || "",
      venueAddress: iv?.venueAddress || "",
      contactPerson: iv?.contactPerson || "",
      contactPhone: iv?.contactPhone || "",
      instructions: iv?.instructions || "",
    });
    setInterviewOpen(true);
  };

  const [evalOpen, setEvalOpen] = useState(false);
  const [apptOpen, setApptOpen] = useState(false);
  const [evalForm, setEvalForm] = useState({
    interviewerName: "", rating: "", recommendation: "",
    evaluationRemarks: "", hrReview: "", managementReview: "",
  });
  const [apptForm, setApptForm] = useState({
    designation: "", department: "", joiningDate: "",
    location: "", reportingTo: "", employeeCode: "",
  });

  const openEval = () => {
    if (!selected?.interview) return;
    setModalErr("");
    const iv = selected.interview;
    setEvalForm({
      interviewerName: iv.interviewerName || "",
      rating: iv.rating != null ? String(iv.rating) : "",
      recommendation: iv.recommendation || "",
      evaluationRemarks: iv.evaluationRemarks || "",
      hrReview: iv.hrReview || "",
      managementReview: iv.managementReview || "",
    });
    setEvalOpen(true);
  };

  const submitEval = async () => {
    if (!selected) return;
    setSaving(true);
    setModalErr("");
    try {
      const res = await applicationsApi.saveEvaluation(selected._id, evalForm);
      setEvalOpen(false);
      await loadApplications();
      setSelected(res.data?.application || null);
      setNotice("Interview evaluation saved.");
    } catch (err) {
      setModalErr(
        err instanceof Error ? err.message : "Failed to save the evaluation",
      );
    } finally {
      setSaving(false);
    }
  };

  // Acceptance gates the appointment letter — an appointment letter for an
  // offer nobody accepted is not a real document.
  const recordResponse = async (accepted: boolean) => {
    if (!selected) return;
    const declineReason = accepted
      ? undefined
      : window.prompt("Reason for declining (optional)") || undefined;
    if (
      !await dialog.confirm(
        accepted
          ? "Record that the candidate ACCEPTED the offer?"
          : "Record that the candidate DECLINED the offer? They will be marked rejected.",
      )
    )
      return;
    try {
      const res = await applicationsApi.recordOfferResponse(selected._id, {
        accepted,
        declineReason,
      });
      await loadApplications();
      setSelected(res.data?.application || null);
      setNotice(accepted ? "Offer marked accepted." : "Offer marked declined.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  };

  const openAppt = () => {
    if (!selected) return;
    setModalErr("");
    setApptForm({
      designation: selected.offer?.designation || selected.position || "",
      department: selected.offer?.department || selected.department || "",
      joiningDate: selected.offer?.joiningDate
        ? new Date(selected.offer.joiningDate).toISOString().slice(0, 10)
        : "",
      location: selected.offer?.location || "",
      reportingTo: selected.offer?.reportingTo || "",
      employeeCode: "",
    });
    setApptOpen(true);
  };

  const submitAppt = async () => {
    if (!selected) return;
    setSaving(true);
    setModalErr("");
    try {
      const res = await applicationsApi.issueAppointment(selected._id, apptForm);
      setApptOpen(false);
      await loadApplications();
      setSelected(res.data?.application || null);
      setNotice(
        res.data?.emailSent
          ? `Appointment letter issued and emailed.${
              res.data?.archivedToS3 ? "" : " (Warning: the PDF was not archived to S3.)"
            }`
          : `Appointment saved, but the email FAILED: ${res.data?.emailError || "unknown error"}`,
      );
    } catch (err: unknown) {
      const e = err as { data?: { hint?: string }; message?: string };
      setModalErr(e.data?.hint || e.message || "Failed to issue the appointment");
    } finally {
      setSaving(false);
    }
  };

  const openOffer = () => {
    if (!selected) return;
    setModalErr("");
    setOfferForm({
      designation: selected.offer?.designation || selected.position || "",
      department: selected.offer?.department || selected.department || "",
      ctcAnnual: selected.offer?.ctcAnnual ? String(selected.offer.ctcAnnual) : "",
      joiningDate: selected.offer?.joiningDate
        ? new Date(selected.offer.joiningDate).toISOString().slice(0, 10)
        : "",
      location: selected.offer?.location || selected.careerId?.location || "",
      reportingTo: selected.offer?.reportingTo || "",
      notes: selected.offer?.notes || "",
    });
    setOfferOpen(true);
  };

  const submitInterview = async () => {
    if (!selected) return;
    setSaving(true);
    setModalErr("");
    try {
      const res = await applicationsApi.scheduleInterview(selected._id, {
        ...ivForm,
        // Send an absolute instant; the input is local time.
        scheduledAt: new Date(ivForm.scheduledAt).toISOString(),
        durationMinutes: Number(ivForm.durationMinutes) || 30,
      });
      setInterviewOpen(false);
      await loadApplications();
      setSelected(res.data?.application || null);
      // The email is the point of the action — report it, don't assume it.
      setNotice(
        res.data?.emailSent
          ? "Interview scheduled and the invitation was emailed to the candidate."
          : `Interview saved, but the email FAILED: ${res.data?.emailError || "unknown error"}`,
      );
    } catch (err) {
      setModalErr(
        err instanceof Error ? err.message : "Failed to schedule the interview",
      );
    } finally {
      setSaving(false);
    }
  };

  const submitOffer = async () => {
    if (!selected) return;
    setSaving(true);
    setModalErr("");
    try {
      const res = await applicationsApi.issueOffer(selected._id, {
        ...offerForm,
        ctcAnnual: Number(offerForm.ctcAnnual),
      });
      setOfferOpen(false);
      await loadApplications();
      setSelected(res.data?.application || null);
      setNotice(
        res.data?.emailSent
          ? `Offer issued and emailed with the letter attached.${
              res.data?.archivedToS3 ? "" : " (Warning: the PDF was not archived to S3.)"
            }`
          : `Offer saved, but the email FAILED: ${res.data?.emailError || "unknown error"}`,
      );
    } catch (err) {
      setModalErr(
        err instanceof Error ? err.message : "Failed to issue the offer",
      );
    } finally {
      setSaving(false);
    }
  };

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
              {statusLabel(s)}
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
                    {statusLabel(app.status)}
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
                {statusLabel(selected.status)}
              </Badge>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="secondary" onClick={openInterview}>
                  {selected.interview ? "Reschedule interview" : "Schedule interview"}
                </Button>
                {selected.interview && (
                  <Button size="sm" variant="secondary" onClick={openEval}>
                    {selected.interview.evaluationRemarks ? "Edit evaluation" : "Add evaluation"}
                  </Button>
                )}
                <Button size="sm" onClick={openOffer}>
                  {selected.offer ? "Re-issue offer" : "Issue offer"}
                </Button>
                {selected.offer && !selected.offer.acceptedAt && !selected.offer.declinedAt && (
                  <>
                    <Button size="sm" variant="secondary" onClick={() => recordResponse(true)}>
                      Mark accepted
                    </Button>
                    <Button size="sm" variant="ghost" className="text-red-600 hover:bg-red-50" onClick={() => recordResponse(false)}>
                      Declined
                    </Button>
                  </>
                )}
                {selected.offer?.acceptedAt && (
                  <Button size="sm" onClick={openAppt}>
                    {selected.appointment ? "Re-issue appointment" : "Issue appointment letter"}
                  </Button>
                )}
                <Select
                  value={selected.status}
                  onChange={(e) => handleStatusChange(selected._id, e.target.value)}
                  className="w-auto"
                >
                  {statusOptions.map((s) => (
                    <option key={s} value={s}>
                      {statusLabel(s)}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            {notice && (
              <Alert tone={notice.includes("FAILED") ? "danger" : "success"}>
                {notice}
              </Alert>
            )}

            {/* What the candidate has already been told. */}
            {selected.interview && (
              <section className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                <h4 className="mb-2 font-semibold text-gray-900">
                  Interview —{" "}
                  {selected.interview.mode === "ONLINE" ? "Online" : "Walk-in"}
                </h4>
                <p className="text-sm text-gray-700">
                  {new Date(selected.interview.scheduledAt).toLocaleString("en-IN")}
                  {selected.interview.durationMinutes
                    ? ` · ${selected.interview.durationMinutes} min`
                    : ""}
                  {selected.interview.roundName ? ` · ${selected.interview.roundName}` : ""}
                </p>
                {selected.interview.mode === "ONLINE" ? (
                  <p className="mt-1 break-all text-sm">
                    <a
                      href={selected.interview.meetingLink}
                      target="_blank"
                      rel="noreferrer"
                      className="text-cyan-700 underline"
                    >
                      {selected.interview.meetingLink}
                    </a>
                  </p>
                ) : (
                  <p className="mt-1 text-sm text-gray-700">
                    {selected.interview.venueName}
                    {selected.interview.venueName ? " — " : ""}
                    {selected.interview.venueAddress}
                    {selected.interview.contactPerson
                      ? ` · Ask for ${selected.interview.contactPerson}`
                      : ""}
                    {selected.interview.contactPhone
                      ? ` · ${selected.interview.contactPhone}`
                      : ""}
                  </p>
                )}
                {selected.interview.instructions && (
                  <p className="mt-1 text-sm text-gray-500">
                    {selected.interview.instructions}
                  </p>
                )}
              </section>
            )}

            {selected.interview?.evaluationRemarks && (
              <section className="rounded-lg border border-gray-200 bg-white p-4">
                <h4 className="mb-2 font-semibold text-gray-900">Interview evaluation</h4>
                <p className="text-sm text-gray-700">
                  {selected.interview.interviewerName || "Panel"}
                  {selected.interview.rating != null && ` · ${selected.interview.rating}/10`}
                  {selected.interview.recommendation && ` · ${selected.interview.recommendation.replace("_", " ")}`}
                </p>
                <p className="mt-1 text-sm text-gray-600">{selected.interview.evaluationRemarks}</p>
                {selected.interview.hrReview && (
                  <p className="mt-1 text-sm text-gray-500"><b>HR:</b> {selected.interview.hrReview}</p>
                )}
                {selected.interview.managementReview && (
                  <p className="mt-1 text-sm text-gray-500"><b>Management:</b> {selected.interview.managementReview}</p>
                )}
              </section>
            )}

            {selected.appointment && (
              <section className="rounded-lg border border-emerald-300 bg-emerald-50 p-4">
                <h4 className="mb-2 font-semibold text-emerald-900">Appointed</h4>
                <p className="text-sm text-gray-700">
                  {selected.appointment.designation}
                  {selected.appointment.department ? ` · ${selected.appointment.department}` : ""} ·
                  joining {new Date(selected.appointment.joiningDate).toLocaleDateString("en-IN")}
                </p>
                {selected.appointment.appointmentLetterUrl && (
                  <a href={selected.appointment.appointmentLetterUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block text-sm text-cyan-700 underline">
                    Download the appointment letter that was sent
                  </a>
                )}
              </section>
            )}

            {selected.offer && (
              <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                <h4 className="mb-2 font-semibold text-emerald-900">Offer issued</h4>
                <p className="text-sm text-gray-700">
                  {selected.offer.designation}
                  {selected.offer.department ? ` · ${selected.offer.department}` : ""} ·
                  ₹{Number(selected.offer.ctcAnnual).toLocaleString("en-IN")} p.a. ·
                  joining {new Date(selected.offer.joiningDate).toLocaleDateString("en-IN")}
                </p>
                <p className="mt-1 text-sm">
                  {selected.offer.acceptedAt ? (
                    <span className="text-emerald-700">
                      Accepted on {new Date(selected.offer.acceptedAt).toLocaleDateString("en-IN")}
                    </span>
                  ) : selected.offer.declinedAt ? (
                    <span className="text-red-700">
                      Declined on {new Date(selected.offer.declinedAt).toLocaleDateString("en-IN")}
                      {selected.offer.declineReason ? ` — ${selected.offer.declineReason}` : ""}
                    </span>
                  ) : (
                    <span className="text-amber-700">Awaiting the candidate's response</span>
                  )}
                </p>
                {selected.offer.offerLetterUrl && (
                  <a
                    href={selected.offer.offerLetterUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-block text-sm text-cyan-700 underline"
                  >
                    Download the offer letter that was sent
                  </a>
                )}
              </section>
            )}

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

      {/* ── Schedule / reschedule interview ── */}
      <Modal
        open={interviewOpen}
        onClose={() => setInterviewOpen(false)}
        title="Schedule interview"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setInterviewOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitInterview} disabled={saving}>
              {saving ? "Sending…" : "Schedule & email candidate"}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {modalErr && <Alert tone="danger">{modalErr}</Alert>}
          <Field label="Mode">
            <Select
              value={ivForm.mode}
              onChange={(e) =>
                setIvForm({
                  ...ivForm,
                  mode: e.target.value as "ONLINE" | "WALK_IN",
                })
              }
            >
              <option value="WALK_IN">Walk-in — at a Healwin centre</option>
              <option value="ONLINE">Online — video call</option>
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date & time *">
              <Input
                type="datetime-local"
                value={ivForm.scheduledAt}
                onChange={(e) =>
                  setIvForm({ ...ivForm, scheduledAt: e.target.value })
                }
              />
            </Field>
            <Field label="Duration (minutes)">
              <Input
                type="number"
                min="5"
                value={ivForm.durationMinutes}
                onChange={(e) =>
                  setIvForm({
                    ...ivForm,
                    durationMinutes: Number(e.target.value),
                  })
                }
              />
            </Field>
          </div>
          <Field label="Round" hint="e.g. Technical round, HR round">
            <Input
              value={ivForm.roundName}
              onChange={(e) => setIvForm({ ...ivForm, roundName: e.target.value })}
            />
          </Field>

          {ivForm.mode === "ONLINE" ? (
            <Field
              label="Meeting link *"
              hint="Google Meet / Zoom / Teams — the candidate joins with this."
            >
              <Input
                placeholder="https://meet.google.com/xxx-xxxx-xxx"
                value={ivForm.meetingLink}
                onChange={(e) =>
                  setIvForm({ ...ivForm, meetingLink: e.target.value })
                }
              />
            </Field>
          ) : (
            <>
              <Field label="Centre / venue name">
                <Input
                  placeholder="Healwin Centre, Lucknow"
                  value={ivForm.venueName}
                  onChange={(e) =>
                    setIvForm({ ...ivForm, venueName: e.target.value })
                  }
                />
              </Field>
              <Field label="Full address *" hint="The candidate has to find this.">
                <Textarea
                  rows={2}
                  value={ivForm.venueAddress}
                  onChange={(e) =>
                    setIvForm({ ...ivForm, venueAddress: e.target.value })
                  }
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Ask for (contact person)">
                  <Input
                    value={ivForm.contactPerson}
                    onChange={(e) =>
                      setIvForm({ ...ivForm, contactPerson: e.target.value })
                    }
                  />
                </Field>
                <Field label="Contact number">
                  <Input
                    value={ivForm.contactPhone}
                    onChange={(e) =>
                      setIvForm({ ...ivForm, contactPhone: e.target.value })
                    }
                  />
                </Field>
              </div>
            </>
          )}

          <Field
            label="Instructions"
            hint="What to bring, documents, parking, dress code…"
          >
            <Textarea
              rows={3}
              value={ivForm.instructions}
              onChange={(e) =>
                setIvForm({ ...ivForm, instructions: e.target.value })
              }
            />
          </Field>
        </div>
      </Modal>

      {/* ── Interview evaluation (§9.3) ── */}
      <Modal
        open={evalOpen}
        onClose={() => setEvalOpen(false)}
        title="Interview evaluation"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEvalOpen(false)}>Cancel</Button>
            <Button onClick={submitEval} disabled={saving}>
              {saving ? "Saving…" : "Save evaluation"}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {modalErr && <Alert tone="danger">{modalErr}</Alert>}
          <p className="text-sm text-gray-500">
            The panel's assessment. The recommendation is advice — the decision
            is the application status, which you set separately.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Interviewer">
              <Input value={evalForm.interviewerName} onChange={(e) => setEvalForm({ ...evalForm, interviewerName: e.target.value })} />
            </Field>
            <Field label="Rating (out of 10)">
              <Input type="number" min="0" max="10" value={evalForm.rating} onChange={(e) => setEvalForm({ ...evalForm, rating: e.target.value })} />
            </Field>
          </div>
          <Field label="Recommendation">
            <Select value={evalForm.recommendation} onChange={(e) => setEvalForm({ ...evalForm, recommendation: e.target.value })}>
              <option value="">—</option>
              <option value="SELECT">Select</option>
              <option value="NEXT_ROUND">Next round</option>
              <option value="HOLD">Hold</option>
              <option value="REJECT">Reject</option>
            </Select>
          </Field>
          <Field label="Panel remarks">
            <Textarea rows={3} value={evalForm.evaluationRemarks} onChange={(e) => setEvalForm({ ...evalForm, evaluationRemarks: e.target.value })} />
          </Field>
          <Field label="HR review">
            <Textarea rows={2} value={evalForm.hrReview} onChange={(e) => setEvalForm({ ...evalForm, hrReview: e.target.value })} />
          </Field>
          <Field label="Management review">
            <Textarea rows={2} value={evalForm.managementReview} onChange={(e) => setEvalForm({ ...evalForm, managementReview: e.target.value })} />
          </Field>
        </div>
      </Modal>

      {/* ── Appointment letter (§9.5) ── */}
      <Modal
        open={apptOpen}
        onClose={() => setApptOpen(false)}
        title="Issue appointment letter"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setApptOpen(false)}>Cancel</Button>
            <Button onClick={submitAppt} disabled={saving}>
              {saving ? "Sending…" : "Issue & email letter"}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {modalErr && <Alert tone="danger">{modalErr}</Alert>}
          <p className="text-sm text-gray-500">
            Issued on the joining date, after the offer has been accepted.
            Generates the letter, archives it to S3 and emails it as a PDF.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Designation *">
              <Input value={apptForm.designation} onChange={(e) => setApptForm({ ...apptForm, designation: e.target.value })} />
            </Field>
            <Field label="Department">
              <Input value={apptForm.department} onChange={(e) => setApptForm({ ...apptForm, department: e.target.value })} />
            </Field>
            <Field label="Date of joining *">
              <Input type="date" value={apptForm.joiningDate} onChange={(e) => setApptForm({ ...apptForm, joiningDate: e.target.value })} />
            </Field>
            <Field label="Employee code" hint="If an HR employee record already exists.">
              <Input value={apptForm.employeeCode} onChange={(e) => setApptForm({ ...apptForm, employeeCode: e.target.value })} />
            </Field>
            <Field label="Place of posting">
              <Input value={apptForm.location} onChange={(e) => setApptForm({ ...apptForm, location: e.target.value })} />
            </Field>
            <Field label="Reporting to">
              <Input value={apptForm.reportingTo} onChange={(e) => setApptForm({ ...apptForm, reportingTo: e.target.value })} />
            </Field>
          </div>
        </div>
      </Modal>

      {/* ── Issue offer ── */}
      <Modal
        open={offerOpen}
        onClose={() => setOfferOpen(false)}
        title="Issue offer letter"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOfferOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitOffer} disabled={saving}>
              {saving ? "Sending…" : "Issue offer & email letter"}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {modalErr && <Alert tone="danger">{modalErr}</Alert>}
          <p className="text-sm text-gray-500">
            This marks the candidate as hired, generates the offer letter PDF,
            archives it to S3 and emails it to them as an attachment.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Designation *">
              <Input
                value={offerForm.designation}
                onChange={(e) =>
                  setOfferForm({ ...offerForm, designation: e.target.value })
                }
              />
            </Field>
            <Field label="Department">
              <Input
                value={offerForm.department}
                onChange={(e) =>
                  setOfferForm({ ...offerForm, department: e.target.value })
                }
              />
            </Field>
            <Field label="Annual CTC (₹) *">
              <Input
                type="number"
                min="1"
                value={offerForm.ctcAnnual}
                onChange={(e) =>
                  setOfferForm({ ...offerForm, ctcAnnual: e.target.value })
                }
              />
            </Field>
            <Field label="Date of joining *">
              <Input
                type="date"
                value={offerForm.joiningDate}
                onChange={(e) =>
                  setOfferForm({ ...offerForm, joiningDate: e.target.value })
                }
              />
            </Field>
            <Field label="Place of posting">
              <Input
                value={offerForm.location}
                onChange={(e) =>
                  setOfferForm({ ...offerForm, location: e.target.value })
                }
              />
            </Field>
            <Field label="Reporting to">
              <Input
                value={offerForm.reportingTo}
                onChange={(e) =>
                  setOfferForm({ ...offerForm, reportingTo: e.target.value })
                }
              />
            </Field>
          </div>
          <Field label="Additional terms" hint="Printed on the offer letter.">
            <Textarea
              rows={3}
              value={offerForm.notes}
              onChange={(e) => setOfferForm({ ...offerForm, notes: e.target.value })}
            />
          </Field>
        </div>
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
