import { useEffect, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { hospitalPatientApi } from "../services/admin-api";
import type {
  PatientPayload,
  EmergencyContact,
  DuplicateGroup,
} from "../services/admin-api";
import { useAuth } from "../auth/useAuth";
import { PERMISSIONS } from "../auth/permissions";
import {
  PageHeader,
  Button,
  SearchInput,
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
  Select,
  Textarea,
  Alert,
} from "../components/ui";

interface PatientRow {
  _id: string;
  patientId: string;
  fullName: string;
  gender: string;
  age?: number;
  bloodGroup?: string;
  phone: string;
  isActive: boolean;
  source?: string; // "admin" | "ambulance_staff"
  createdAt?: string;
}

const BLOOD_GROUPS = [
  "unknown",
  "A+",
  "A-",
  "B+",
  "B-",
  "AB+",
  "AB-",
  "O+",
  "O-",
];

const emptyForm: PatientPayload = {
  fullName: "",
  gender: "male",
  dateOfBirth: "",
  age: "",
  bloodGroup: "unknown",
  phone: "",
  email: "",
  address: { line1: "", line2: "", city: "", state: "", pincode: "" },
  emergencyContacts: [],
  healthHistory: {
    pastMedical: "",
    surgical: "",
    medications: "",
    allergies: "",
    familyHistory: "",
  },
};

export default function PatientRegistrationManagement() {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const canCreate = hasPermission(PERMISSIONS.HMS_PATIENTS_CREATE);
  const canUpdate = hasPermission(PERMISSIONS.HMS_PATIENTS_UPDATE);
  const canDelete = hasPermission(PERMISSIONS.HMS_PATIENTS_DELETE);
  const canMerge = canDelete; // merge soft-deletes the source record

  const [items, setItems] = useState<PatientRow[]>([]);
  const [showDuplicates, setShowDuplicates] = useState(false);
  const [duplicatesLoading, setDuplicatesLoading] = useState(false);
  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroup[]>([]);
  const [targetByGroup, setTargetByGroup] = useState<Record<number, string>>({});
  const [merging, setMerging] = useState(false);
  const [mergeError, setMergeError] = useState("");
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PatientPayload>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (search.trim()) params.search = search.trim();
      const res = await hospitalPatientApi.list(params);
      setItems(res.data?.items || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setError("");
    setShowForm(true);
  };

  const openEdit = async (row: PatientRow) => {
    setError("");
    const res = await hospitalPatientApi.detail(row._id);
    const p = res.data?.patient;
    setEditingId(row._id);
    setForm({
      fullName: p.fullName || "",
      gender: p.gender || "male",
      dateOfBirth: p.dateOfBirth ? p.dateOfBirth.substring(0, 10) : "",
      age: p.age ?? "",
      bloodGroup: p.bloodGroup || "unknown",
      phone: p.phone || "",
      email: p.email || "",
      address: p.address || {},
      emergencyContacts: p.emergencyContacts || [],
      healthHistory: p.healthHistory || {},
    });
    setShowForm(true);
  };

  const addContact = () =>
    setForm((f) => ({
      ...f,
      emergencyContacts: [
        ...(f.emergencyContacts || []),
        { name: "", relation: "", phone: "" },
      ],
    }));

  const updateContact = (
    i: number,
    key: keyof EmergencyContact,
    value: string,
  ) =>
    setForm((f) => {
      const contacts = [...(f.emergencyContacts || [])];
      contacts[i] = { ...contacts[i], [key]: value };
      return { ...f, emergencyContacts: contacts };
    });

  const removeContact = (i: number) =>
    setForm((f) => ({
      ...f,
      emergencyContacts: (f.emergencyContacts || []).filter(
        (_, idx) => idx !== i,
      ),
    }));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.fullName.trim() || !form.phone.trim()) {
      setError("Full name and phone are required.");
      return;
    }
    if (!/^[6-9]\d{9}$/.test(form.phone.trim())) {
      setError("Phone must be a valid 10-digit mobile number (starting 6-9).");
      return;
    }
    setSaving(true);
    try {
      if (editingId) await hospitalPatientApi.update(editingId, form);
      else await hospitalPatientApi.create(form);
      setShowForm(false);
      load();
    } catch (err: any) {
      setError(err.message || "Failed to save patient");
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (row: PatientRow) => {
    if (!window.confirm(`Delete patient ${row.fullName} (${row.patientId})?`))
      return;
    await hospitalPatientApi.remove(row._id);
    load();
  };

  const openDuplicates = async () => {
    setShowDuplicates(true);
    setMergeError("");
    setDuplicatesLoading(true);
    try {
      const res = await hospitalPatientApi.duplicates();
      const groups: DuplicateGroup[] = res.data?.groups || [];
      setDuplicateGroups(groups);
      // Default target = the patient with the most real records in each group.
      const defaults: Record<number, string> = {};
      groups.forEach((g, i) => {
        const richest = [...g.patients].sort((a, b) => {
          const score = (p: typeof a) =>
            p.recordCounts.admissions + p.recordCounts.appointments + p.recordCounts.invoices;
          return score(b) - score(a);
        })[0];
        defaults[i] = richest._id;
      });
      setTargetByGroup(defaults);
    } finally {
      setDuplicatesLoading(false);
    }
  };

  const mergeGroup = async (group: DuplicateGroup, groupIndex: number) => {
    const targetId = targetByGroup[groupIndex];
    const sources = group.patients.filter((p) => p._id !== targetId);
    if (!targetId || sources.length === 0) return;
    if (
      !window.confirm(
        `Merge ${sources.length} record(s) into the selected patient? Merged records will be soft-deleted and all their admissions, appointments, bills, diagnostics, insurance, ambulance and surgery history will be re-pointed to the kept record. This cannot be undone from the UI.`,
      )
    )
      return;
    setMergeError("");
    setMerging(true);
    try {
      for (const src of sources) {
        await hospitalPatientApi.merge(src._id, targetId);
      }
      await openDuplicates();
      load();
    } catch (err: any) {
      setMergeError(err.message || "Failed to merge patients");
    } finally {
      setMerging(false);
    }
  };

  return (
    <div className="p-6">
      <PageHeader
        title="Patient Registration"
        subtitle="Demographics & health history — Doctor Panel (HMS)"
        actions={
          <div className="flex gap-2">
            {canMerge && (
              <Button variant="secondary" onClick={openDuplicates}>
                Find Duplicates
              </Button>
            )}
            {canCreate && (
              <Button onClick={openCreate}>+ Register Patient</Button>
            )}
          </div>
        }
      />

      <div className="flex flex-wrap gap-2 mb-4">
        <SearchInput
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load()}
          placeholder="Search by name, patient ID or phone"
          className="w-full max-w-md"
        />
        <Button variant="secondary" onClick={load}>
          Search
        </Button>
      </div>

      <Table>
        <THead>
          <Th>Patient ID</Th>
          <Th>Name</Th>
          <Th>Gender / Age</Th>
          <Th>Blood</Th>
          <Th>Phone</Th>
          <Th>Status</Th>
          <Th className="text-right">Actions</Th>
        </THead>
        <TBody>
          {loading ? (
            <TableState colSpan={7}>Loading…</TableState>
          ) : items.length === 0 ? (
            <TableState colSpan={7}>No patients registered yet.</TableState>
          ) : (
            items.map((row) => (
              <TR key={row._id}>
                <Td className="font-mono text-xs">{row.patientId}</Td>
                <Td className="font-medium text-gray-900">
                  {row.fullName}
                  {row.source === "ambulance_staff" && (
                    <Badge tone="info" className="ml-2 align-middle">Field / Ambulance</Badge>
                  )}
                </Td>
                <Td className="capitalize">
                  {row.gender}
                  {row.age != null ? ` / ${row.age}y` : ""}
                </Td>
                <Td>{row.bloodGroup}</Td>
                <Td>{row.phone}</Td>
                <Td>
                  <Badge tone={row.isActive ? "success" : "neutral"} dot>
                    {row.isActive ? "Active" : "Inactive"}
                  </Badge>
                </Td>
                <Td className="text-right whitespace-nowrap">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => navigate(`/admin/patients/${row._id}`)}
                  >
                    Open EMR
                  </Button>
                  {canUpdate && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="px-2"
                      title="Edit"
                      aria-label="Edit"
                      onClick={() => openEdit(row)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
                  {canDelete && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="px-2 text-red-600 hover:bg-red-50 hover:text-red-700"
                      title="Delete"
                      aria-label="Delete"
                      onClick={() => onDelete(row)}
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

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editingId ? "Edit Patient" : "Register Patient"}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
            <Button onClick={onSubmit} disabled={saving}>
              {saving ? "Saving…" : editingId ? "Update" : "Register"}
            </Button>
          </>
        }
      >
        <form onSubmit={onSubmit} className="space-y-5">
          {error && <Alert tone="danger">{error}</Alert>}

          {/* Demographics */}
          <section>
            <h3 className="mb-2 text-sm font-semibold text-gray-700">
              Personal Details
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Full Name *">
                <Input
                  value={form.fullName}
                  onChange={(e) =>
                    setForm({ ...form, fullName: e.target.value })
                  }
                />
              </Field>
              <Field label="Phone *">
                <Input
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  placeholder="10-digit mobile number"
                  value={form.phone}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      phone: e.target.value.replace(/\D/g, "").slice(0, 10),
                    })
                  }
                />
              </Field>
              <Field label="Gender *">
                <Select
                  value={form.gender}
                  onChange={(e) =>
                    setForm({ ...form, gender: e.target.value as any })
                  }
                >
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </Select>
              </Field>
              <Field label="Blood Group">
                <Select
                  value={form.bloodGroup}
                  onChange={(e) =>
                    setForm({ ...form, bloodGroup: e.target.value })
                  }
                >
                  {BLOOD_GROUPS.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Date of Birth">
                <Input
                  type="date"
                  value={form.dateOfBirth}
                  onChange={(e) =>
                    setForm({ ...form, dateOfBirth: e.target.value })
                  }
                />
              </Field>
              <Field label="Age (if DOB unknown)">
                <Input
                  type="number"
                  value={form.age as any}
                  onChange={(e) => setForm({ ...form, age: e.target.value })}
                />
              </Field>
              <Field label="Email" className="col-span-2">
                <Input
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </Field>
            </div>
          </section>

          {/* Address */}
          <section>
            <h3 className="mb-2 text-sm font-semibold text-gray-700">
              Address
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <Input
                placeholder="Address line 1"
                value={form.address?.line1 || ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    address: { ...form.address, line1: e.target.value },
                  })
                }
                className="col-span-2"
              />
              <Input
                placeholder="City"
                value={form.address?.city || ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    address: { ...form.address, city: e.target.value },
                  })
                }
              />
              <Input
                placeholder="State"
                value={form.address?.state || ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    address: { ...form.address, state: e.target.value },
                  })
                }
              />
              <Input
                placeholder="Pincode"
                value={form.address?.pincode || ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    address: { ...form.address, pincode: e.target.value },
                  })
                }
              />
            </div>
          </section>

          {/* Emergency contacts */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-700">
                Emergency Contacts
              </h3>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={addContact}
              >
                + Add
              </Button>
            </div>
            {(form.emergencyContacts || []).map((c, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 mb-2">
                <Input
                  placeholder="Name"
                  value={c.name}
                  onChange={(e) => updateContact(i, "name", e.target.value)}
                  className="col-span-4"
                />
                <Input
                  placeholder="Relation"
                  value={c.relation}
                  onChange={(e) =>
                    updateContact(i, "relation", e.target.value)
                  }
                  className="col-span-3"
                />
                <Input
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  placeholder="Phone"
                  value={c.phone}
                  onChange={(e) =>
                    updateContact(
                      i,
                      "phone",
                      e.target.value.replace(/\D/g, "").slice(0, 10),
                    )
                  }
                  className="col-span-4"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="col-span-1 text-red-600 hover:bg-red-50 hover:text-red-700"
                  onClick={() => removeContact(i)}
                >
                  ✕
                </Button>
              </div>
            ))}
          </section>

          {/* Health history */}
          <section>
            <h3 className="mb-2 text-sm font-semibold text-gray-700">
              Health History
            </h3>
            <div className="grid grid-cols-1 gap-3">
              {(
                [
                  ["pastMedical", "Past medical history"],
                  ["surgical", "Past surgical history"],
                  ["medications", "Ongoing medications"],
                  ["allergies", "Allergies"],
                  ["familyHistory", "Family medical history"],
                ] as const
              ).map(([key, label]) => (
                <Field key={key} label={label}>
                  <Textarea
                    rows={2}
                    value={(form.healthHistory as any)?.[key] || ""}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        healthHistory: {
                          ...form.healthHistory,
                          [key]: e.target.value,
                        },
                      })
                    }
                  />
                </Field>
              ))}
            </div>
          </section>
        </form>
      </Modal>

      <Modal
        open={showDuplicates}
        onClose={() => setShowDuplicates(false)}
        title="Possible Duplicate Patients"
        size="lg"
        footer={
          <Button variant="secondary" onClick={() => setShowDuplicates(false)}>
            Close
          </Button>
        }
      >
        {mergeError && <Alert tone="danger" className="mb-3">{mergeError}</Alert>}
        {duplicatesLoading ? (
          <p className="text-sm text-gray-500">Scanning for duplicates…</p>
        ) : duplicateGroups.length === 0 ? (
          <p className="text-sm text-gray-500">No likely duplicates found.</p>
        ) : (
          <div className="space-y-5">
            {duplicateGroups.map((group, gi) => (
              <div key={gi} className="rounded-lg border border-gray-200 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <Badge tone={group.reason === "phone" ? "info" : "warning"}>
                    {group.reason === "phone" ? "Same phone number" : "Same name & date of birth"}
                  </Badge>
                  {canMerge && (
                    <Button
                      size="sm"
                      disabled={merging}
                      onClick={() => mergeGroup(group, gi)}
                    >
                      {merging ? "Merging…" : "Merge into selected"}
                    </Button>
                  )}
                </div>
                <div className="space-y-2">
                  {group.patients.map((p) => (
                    <label
                      key={p._id}
                      className="flex items-center gap-3 rounded border border-gray-100 p-2 text-sm hover:bg-gray-50"
                    >
                      <input
                        type="radio"
                        name={`target-${gi}`}
                        checked={targetByGroup[gi] === p._id}
                        onChange={() =>
                          setTargetByGroup((t) => ({ ...t, [gi]: p._id }))
                        }
                      />
                      <div className="flex-1">
                        <span className="font-medium text-gray-900">{p.fullName}</span>{" "}
                        <span className="font-mono text-xs text-gray-500">{p.patientId}</span>
                        <div className="text-xs text-gray-500">
                          {p.phone} · {p.gender}
                          {p.dateOfBirth ? ` · DOB ${p.dateOfBirth.substring(0, 10)}` : ""} · registered{" "}
                          {p.createdAt ? new Date(p.createdAt).toLocaleDateString() : "—"}
                        </div>
                        <div className="text-xs text-gray-500">
                          {p.recordCounts.admissions} admission(s) · {p.recordCounts.appointments} appointment(s) ·{" "}
                          {p.recordCounts.invoices} invoice(s)
                        </div>
                      </div>
                      {targetByGroup[gi] === p._id && <Badge tone="success">Keep</Badge>}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}
