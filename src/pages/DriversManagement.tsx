// src/pages/DriversManagement.tsx
//
// Ride drivers (the driver app's Driver collection) — NOT ambulance crew,
// which lives under Ambulance Operations -> Drivers & Attendants.
//
// Driver-app login is invite-only: the backend only sends an OTP to a number
// that already has a Driver record, so "Add Driver" here is the only way a
// driver can get into the app at all.
import { useCallback, useEffect, useState } from "react";
import { Ban, CheckCircle2, Trash2 } from "lucide-react";
import { driversApi } from "../services/admin-api";
import Pagination from "../components/Pagination";
import { useAuth } from "../auth/useAuth";
import { PERMISSIONS } from "../auth/permissions";
import {
  PageHeader,
  Button,
  SearchInput,
  Select,
  Table,
  THead,
  TBody,
  TR,
  Th,
  Td,
  TableState,
  Badge,
  Modal,
  Field,
  Input,
} from "../components/ui";
import { dialog } from "../services/dialog";

type Driver = {
  _id: string;
  fullName?: string;
  mobileNumber: string;
  countryCode?: string;
  email?: string;
  status: string;
  isOnline?: boolean;
  isActive?: boolean;
  completedTrips?: number;
  createdAt?: string;
};

const STATUSES = [
  "draft",
  "documents_uploaded",
  "vehicle_added",
  "under_verification",
  "approved",
  "rejected",
  "suspended",
];

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  documents_uploaded: "Documents uploaded",
  vehicle_added: "Vehicle added",
  under_verification: "Under verification",
  approved: "Approved",
  rejected: "Rejected",
  suspended: "Suspended",
};

const statusTone = (status: string) => {
  if (status === "approved") return "success" as const;
  if (status === "rejected" || status === "suspended") return "danger" as const;
  if (status === "under_verification") return "warning" as const;
  return "neutral" as const;
};

const emptyForm = { fullName: "", mobileNumber: "", email: "" };

export default function DriversManagement() {
  const { hasPermission } = useAuth();
  const canCreate = hasPermission(PERMISSIONS.DRIVERS_CREATE);
  const canBlock = hasPermission(PERMISSIONS.DRIVERS_BLOCK);
  const canDelete = hasPermission(PERMISSIONS.DRIVERS_DELETE);

  const [items, setItems] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  // What's actually queried: typing shouldn't fire a request per keystroke.
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [total, setTotal] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = {
        // The list endpoint pages from 0; the Pagination control is 1-based.
        page: page - 1,
        limit,
      };
      if (searchQuery.trim()) params.search = searchQuery.trim();
      if (statusFilter) params.status = statusFilter;
      const res = await driversApi.list(params);
      setItems(res.data?.drivers || []);
      setTotal(res.data?.total ?? 0);
    } finally {
      setLoading(false);
    }
  }, [page, limit, searchQuery, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const t = setTimeout(() => setSearchQuery(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, statusFilter, limit]);

  const openCreate = () => {
    setForm(emptyForm);
    setFormError("");
    setShowForm(true);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setFormError("");
    setSaving(true);
    try {
      await driversApi.create({
        fullName: form.fullName.trim(),
        mobileNumber: form.mobileNumber.trim(),
        ...(form.email.trim() ? { email: form.email.trim() } : {}),
      });
      setShowForm(false);
      load();
    } catch (err: unknown) {
      setFormError(
        err instanceof Error ? err.message : "Could not add this driver.",
      );
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (d: Driver, status: string, prompt: string) => {
    if (
      !(await dialog.confirm({
        message: prompt,
        confirmLabel: "Confirm",
        tone: status === "suspended" ? "danger" : "default",
      }))
    )
      return;
    await driversApi.setStatus(d._id, status);
    load();
  };

  return (
    <div className="p-6">
      <PageHeader
        title="Drivers"
        subtitle="Driver-app sign-in is invite-only — a number can only request an OTP once it exists here. Suspended and rejected drivers are refused at login."
        actions={
          canCreate ? <Button onClick={openCreate}>+ Add Driver</Button> : null
        }
      />

      <div className="flex flex-wrap gap-2 mb-4">
        <SearchInput
          placeholder="Search by name, mobile or email"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-xs"
        />
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-52"
          aria-label="Status"
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </Select>
        <Select
          value={String(limit)}
          onChange={(e) => setLimit(Number(e.target.value))}
          className="w-32"
          aria-label="Rows per page"
        >
          {[25, 50, 100].map((n) => (
            <option key={n} value={n}>
              {n} / page
            </option>
          ))}
        </Select>
      </div>

      <Table>
        <THead>
          <Th>Name</Th>
          <Th>Mobile</Th>
          <Th>Status</Th>
          <Th className="w-24">Trips</Th>
          <Th className="text-right">Actions</Th>
        </THead>
        <TBody>
          {loading ? (
            <TableState colSpan={5}>Loading…</TableState>
          ) : items.length === 0 ? (
            <TableState colSpan={5}>
              {searchQuery.trim() || statusFilter ? (
                "No drivers match this filter."
              ) : (
                <>
                  No drivers yet. Click <b>Add Driver</b> to onboard one — until
                  then nobody can sign in to the driver app.
                </>
              )}
            </TableState>
          ) : (
            items.map((d) => (
              <TR key={d._id}>
                <Td className="font-medium text-gray-900">
                  {d.fullName || (
                    <span className="text-gray-400">Not filled in yet</span>
                  )}
                </Td>
                <Td className="font-mono text-gray-600">
                  {d.countryCode || "+91"} {d.mobileNumber}
                </Td>
                <Td>
                  <Badge tone={statusTone(d.status)} dot>
                    {STATUS_LABELS[d.status] || d.status}
                  </Badge>
                </Td>
                <Td className="text-gray-600">{d.completedTrips ?? 0}</Td>
                <Td className="text-right whitespace-nowrap">
                  {canBlock && d.status === "suspended" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="px-2"
                      title="Reinstate"
                      aria-label="Reinstate"
                      onClick={() =>
                        setStatus(
                          d,
                          "approved",
                          `Reinstate ${d.fullName || d.mobileNumber}? They will be able to log in again.`,
                        )
                      }
                    >
                      <CheckCircle2 className="h-4 w-4" />
                    </Button>
                  )}
                  {canBlock && d.status !== "suspended" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="px-2 text-red-600 hover:bg-red-50 hover:text-red-700"
                      title="Suspend"
                      aria-label="Suspend"
                      onClick={() =>
                        setStatus(
                          d,
                          "suspended",
                          `Suspend ${d.fullName || d.mobileNumber}? They will be refused at login until reinstated.`,
                        )
                      }
                    >
                      <Ban className="h-4 w-4" />
                    </Button>
                  )}
                  {canDelete && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="px-2 text-red-600 hover:bg-red-50 hover:text-red-700"
                      title="Delete"
                      aria-label="Delete"
                      onClick={async () => {
                        if (
                          !(await dialog.confirm({
                            message: `Delete ${d.fullName || d.mobileNumber}? Their number will stop working in the driver app.`,
                            confirmLabel: "Delete",
                            tone: "danger",
                          }))
                        )
                          return;
                        await driversApi.remove(d._id);
                        load();
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </Td>
              </TR>
            ))
          )}
        </TBody>
      </Table>

      <div className="mt-4">
        <Pagination
          page={page}
          totalPages={Math.max(1, Math.ceil(total / limit))}
          total={total}
          label="drivers"
          onPageChange={setPage}
        />
      </div>

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title="Add Driver"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
            <Button onClick={onSubmit} disabled={saving}>
              {saving ? "Adding…" : "Add Driver"}
            </Button>
          </>
        }
      >
        <form onSubmit={onSubmit} className="space-y-4">
          <Field label="Full name">
            <Input
              required
              maxLength={80}
              placeholder="As on the driving licence"
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            />
          </Field>
          <Field
            label="Mobile number"
            hint="The number they will sign in with. 10 digits, no +91."
          >
            <Input
              required
              inputMode="numeric"
              maxLength={10}
              placeholder="9876543210"
              value={form.mobileNumber}
              onChange={(e) =>
                setForm({
                  ...form,
                  mobileNumber: e.target.value.replace(/\D/g, ""),
                })
              }
            />
          </Field>
          <Field label="Email (optional)">
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </Field>
          {formError ? (
            <p className="text-sm text-red-600">{formError}</p>
          ) : null}
          <p className="text-sm text-gray-500">
            The driver completes their documents, photo and vehicle inside the
            app. You approve them from this list once they submit.
          </p>
        </form>
      </Modal>
    </div>
  );
}
