import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Pencil, Trash2, Eye, Power } from "lucide-react";
import { ambulanceStaffApi, providerApi } from "../services/admin-api";
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

type Staff = {
  _id: string;
  fullName: string;
  mobileNumber: string;
  role: "driver" | "attendant";
  providerId: string | { _id: string; name: string };
  isActive: boolean;
  isOnline: boolean;
  isDutyOn?: boolean;
  licenseNumber?: string;
  certifications?: string[];
};

type Provider = { _id: string; name: string };

export default function AmbulanceStaffManagement() {
  const [items, setItems] = useState<Staff[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [filters, setFilters] = useState<{
    providerId?: string;
    role?: string;
    search?: string;
  }>({});
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Staff | null>(null);
  const [form, setForm] = useState<any>({
    role: "driver",
    countryCode: "+91",
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      // Always scope to provider-affiliated staff. Hospital paramedics
      // live in the same collection but belong to a different party —
      // they're managed under Hospitals → [hospital] → Staff.
      const clean: Record<string, string | boolean> = {
        affiliation: "provider",
      };
      if (filters.providerId) clean.providerId = filters.providerId;
      if (filters.role) clean.role = filters.role;
      if (filters.search) clean.search = filters.search;
      const res = await ambulanceStaffApi.list(clean);
      setItems(res.data?.items || res.items || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    providerApi.list({ isActive: true }).then((r) => {
      setProviders(r.data?.items || r.items || []);
    });
    load();
  }, []);

  const validate = () => {
    const errs: Record<string, string> = {};
    const name = (form.fullName || "").trim();
    const phone = (form.mobileNumber || "").trim();
    const email = (form.email || "").trim();

    if (!name) errs.fullName = "Full name is required.";
    else if (name.length < 2) errs.fullName = "Enter a valid name.";

    if (!phone) errs.mobileNumber = "Mobile number is required.";
    else if (!/^[6-9]\d{9}$/.test(phone))
      errs.mobileNumber = "Enter a valid 10-digit number (starting 6–9).";

    if (!form.role) errs.role = "Select a role.";
    if (!form.providerId) errs.providerId = "Select a service provider.";

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      errs.email = "Enter a valid email address.";

    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const setField = (key: string, value: any) => {
    setForm((f: any) => ({ ...f, [key]: value }));
    setFormErrors((e) => (e[key] ? { ...e, [key]: "" } : e));
    setSubmitError("");
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError("");
    if (!validate() || saving) return;
    setSaving(true);
    try {
      if (editing) await ambulanceStaffApi.update(editing._id, form);
      else await ambulanceStaffApi.create(form);
      setShowForm(false);
      setEditing(null);
      setForm({ role: "driver", countryCode: "+91" });
      setFormErrors({});
      load();
    } catch (err: any) {
      setSubmitError(err?.message || "Could not save staff. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6">
      <PageHeader
        title="Ambulance Staff"
        subtitle="Drivers and on-vehicle attendants employed by an Ambulance Service Provider. Hospital paramedics are managed under Hospitals → [hospital] → Staff."
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setForm({ role: "driver", countryCode: "+91" });
              setFormErrors({});
              setSubmitError("");
              setShowForm(true);
            }}
          >
            + New Staff
          </Button>
        }
      />

      <div className="flex flex-wrap gap-2 mb-4">
        <SearchInput
          placeholder="Search by name or phone"
          value={filters.search || ""}
          onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          className="w-full max-w-xs"
        />
        <Select
          value={filters.providerId || ""}
          onChange={(e) => setFilters({ ...filters, providerId: e.target.value })}
          className="w-auto"
        >
          <option value="">All providers</option>
          {providers.map((p) => (
            <option key={p._id} value={p._id}>
              {p.name}
            </option>
          ))}
        </Select>
        <Select
          value={filters.role || ""}
          onChange={(e) => setFilters({ ...filters, role: e.target.value })}
          className="w-auto"
        >
          <option value="">All roles</option>
          <option value="driver">Driver</option>
          <option value="attendant">Attendant</option>
        </Select>
        <Button variant="secondary" onClick={load}>
          Apply
        </Button>
      </div>

      <Table>
        <THead>
          <Th>Name</Th>
          <Th>Role</Th>
          <Th>Provider</Th>
          <Th>Phone</Th>
          <Th>Online</Th>
          <Th>Active</Th>
          <Th className="text-right">Actions</Th>
        </THead>
        <TBody>
          {loading ? (
            <TableState colSpan={7}>Loading…</TableState>
          ) : items.length === 0 ? (
            <TableState colSpan={7}>No staff found.</TableState>
          ) : (
            items.map((s) => (
              <TR key={s._id}>
                <Td className="font-medium text-gray-900">{s.fullName}</Td>
                <Td className="capitalize">{s.role}</Td>
                <Td>
                  {s.providerId && typeof s.providerId === "object"
                    ? (s.providerId as { name?: string }).name || "-"
                    : "-"}
                </Td>
                <Td>{s.mobileNumber}</Td>
                <Td>
                  <Badge tone={s.isOnline ? "success" : "neutral"} dot>
                    {s.isOnline ? "Online" : "Offline"}
                  </Badge>
                </Td>
                <Td>
                  <Badge tone={s.isActive ? "success" : "neutral"} dot>
                    {s.isActive ? "Yes" : "No"}
                  </Badge>
                </Td>
                <Td className="text-right whitespace-nowrap">
                  <Link to={`/admin/ambulance-staff/${s._id}`}>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="px-2"
                      title="View"
                      aria-label="View"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </Link>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="px-2"
                    title="Edit"
                    aria-label="Edit"
                    onClick={() => {
                      setEditing(s);
                      setForm({
                        ...s,
                        providerId:
                          typeof s.providerId === "object"
                            ? s.providerId._id
                            : s.providerId,
                      });
                      setFormErrors({});
                      setSubmitError("");
                      setShowForm(true);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className={`px-2 text-xs ${s.isDutyOn ? "text-green-600 hover:bg-green-50" : "text-gray-500 hover:bg-gray-100"}`}
                    title={s.isDutyOn ? "Set Off Duty" : "Set On Duty"}
                    aria-label="Toggle duty"
                    onClick={async () => {
                      await ambulanceStaffApi.setDuty(s._id, !s.isDutyOn);
                      load();
                    }}
                  >
                    {s.isDutyOn ? "On Duty" : "Off Duty"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="px-2 text-orange-600 hover:bg-orange-50 hover:text-orange-700"
                    title="Deactivate"
                    aria-label="Deactivate"
                    onClick={async () => {
                      if (!confirm("Deactivate staff? They will be logged out."))
                        return;
                      await ambulanceStaffApi.deactivate(s._id);
                      load();
                    }}
                  >
                    <Power className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="px-2 text-red-600 hover:bg-red-50 hover:text-red-700"
                    title="Delete"
                    aria-label="Delete"
                    onClick={async () => {
                      if (!confirm("Delete staff?")) return;
                      await ambulanceStaffApi.remove(s._id);
                      load();
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </Td>
              </TR>
            ))
          )}
        </TBody>
      </Table>

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editing ? "Edit Staff" : "New Staff"}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
            <Button onClick={onSubmit} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </>
        }
      >
        <form onSubmit={onSubmit} className="space-y-4">
          {submitError && (
            <div className="px-3 py-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg">
              {submitError}
            </div>
          )}
          <Field label="Provider *">
            <Select
              value={form.providerId || ""}
              onChange={(e) => setField("providerId", e.target.value)}
            >
              <option value="">Select Provider</option>
              {providers.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name}
                </option>
              ))}
            </Select>
            {formErrors.providerId && (
              <p className="mt-1 text-xs text-red-500">{formErrors.providerId}</p>
            )}
          </Field>
          <Field label="Role *">
            <Select value={form.role} onChange={(e) => setField("role", e.target.value)}>
              <option value="driver">Driver</option>
              <option value="attendant">Attendant</option>
            </Select>
            {formErrors.role && (
              <p className="mt-1 text-xs text-red-500">{formErrors.role}</p>
            )}
          </Field>
          <Field label="Full Name *">
            <Input
              placeholder="Full Name"
              value={form.fullName || ""}
              onChange={(e) => setField("fullName", e.target.value)}
            />
            {formErrors.fullName && (
              <p className="mt-1 text-xs text-red-500">{formErrors.fullName}</p>
            )}
          </Field>
          <Field label="Mobile Number *">
            <Input
              type="tel"
              inputMode="numeric"
              maxLength={10}
              placeholder="10-digit mobile number"
              value={form.mobileNumber || ""}
              onChange={(e) =>
                setField("mobileNumber", e.target.value.replace(/\D/g, "").slice(0, 10))
              }
            />
            {formErrors.mobileNumber && (
              <p className="mt-1 text-xs text-red-500">{formErrors.mobileNumber}</p>
            )}
          </Field>
          <Field label="Email">
            <Input
              placeholder="Email (optional)"
              value={form.email || ""}
              onChange={(e) => setField("email", e.target.value)}
            />
            {formErrors.email && (
              <p className="mt-1 text-xs text-red-500">{formErrors.email}</p>
            )}
          </Field>
          {form.role === "driver" && (
            <Field label="License Number">
              <Input
                placeholder="License Number"
                value={form.licenseNumber || ""}
                onChange={(e) =>
                  setForm({ ...form, licenseNumber: e.target.value })
                }
              />
            </Field>
          )}
          {form.role === "attendant" && (
            <Field label="Certifications (comma-separated)">
              <Input
                placeholder="Certifications (comma-separated)"
                value={(form.certifications || []).join(",")}
                onChange={(e) =>
                  setForm({
                    ...form,
                    certifications: e.target.value
                      .split(",")
                      .map((s: string) => s.trim())
                      .filter(Boolean),
                  })
                }
              />
            </Field>
          )}

          {/* Monthly salary — when set (CTC > 0), this crew member is included in
              the central HR payroll run, paid by present days from attendance. */}
          <div className="pt-2 border-t border-gray-100">
            <p className="mb-2 text-sm font-semibold text-gray-700">Monthly Salary (payroll)</p>
            <div className="grid grid-cols-2 gap-3">
              {([
                ["ctcAnnual", "Annual CTC"],
                ["basic", "Basic (monthly)"],
                ["hra", "HRA (monthly)"],
                ["specialAllowance", "Special allowance"],
              ] as const).map(([key, label]) => (
                <Field key={key} label={label}>
                  <Input
                    type="number"
                    value={form.salaryStructure?.[key] ?? ""}
                    onChange={(e) =>
                      setForm((f: any) => ({
                        ...f,
                        salaryStructure: { ...(f.salaryStructure || {}), [key]: Number(e.target.value) || 0 },
                      }))
                    }
                  />
                </Field>
              ))}
            </div>
            <div className="mt-2 flex gap-4 text-sm text-gray-600">
              {([["pfApplicable", "PF"], ["esiApplicable", "ESI"], ["ptApplicable", "PT"]] as const).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.salaryStructure?.[key] ?? true}
                    onChange={(e) =>
                      setForm((f: any) => ({
                        ...f,
                        salaryStructure: { ...(f.salaryStructure || {}), [key]: e.target.checked },
                      }))
                    }
                  />
                  {label}
                </label>
              ))}
            </div>
            <p className="mt-1 text-xs text-gray-400">Leave CTC at 0 to keep this crew member off payroll.</p>
          </div>
        </form>
      </Modal>
    </div>
  );
}
