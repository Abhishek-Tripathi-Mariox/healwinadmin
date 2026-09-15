// Your own account — who the system thinks you are, and changing your password.
//
// Until now a password could only be changed by an administrator resetting it,
// which meant someone who suspected their password was known had to ask
// permission to do something about it.
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { KeyRound, ShieldCheck, Mail, Phone, IdCard, Building2 } from "lucide-react";
import { meApi } from "../services/admin-api";
import {
  PageHeader, Card, Button, Field, Input, Alert, Badge,
} from "../components/ui";

interface Profile {
  _id: string;
  fullName: string;
  email: string;
  phone?: string;
  roleName?: string;
  profileImage?: string;
  lastLogin?: string;
  passwordChangedAt?: string;
  employee?: {
    employeeCode?: string;
    department?: string;
    designation?: string;
  };
}

const fmt = (iso?: string) =>
  iso
    ? new Date(iso).toLocaleString("en-IN", {
        day: "2-digit", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit",
      })
    : "—";

export default function MyProfile() {
  const [me, setMe] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState({ current: "", next: "", confirm: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    meApi
      .profile()
      .then((res) => setMe(res.data?.admin || res.data))
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load your profile."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const change = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setDone("");
    // Checked here as well as on the server so the mistake is caught before a
    // round trip, not because the server's check can be skipped.
    if (form.next.length < 8) {
      setError("The new password must be at least 8 characters.");
      return;
    }
    if (form.next !== form.confirm) {
      setError("The two new passwords do not match.");
      return;
    }
    setSaving(true);
    try {
      const res = await meApi.changePassword(form.current, form.next);
      setDone(res.data?.message || "Password changed.");
      setForm({ current: "", next: "", confirm: "" });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not change your password.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6">
      <PageHeader title="My Profile" subtitle="Your account details and password" />

      {error && <Alert className="mb-4">{error}</Alert>}
      {done && <Alert tone="success" className="mb-4">{done}</Alert>}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* ── Who you are ─────────────────────────────────────────────────── */}
        <Card padded>
          {loading ? (
            <p className="text-sm text-gray-500">Loading…</p>
          ) : (
            <>
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-healwin-50 text-lg font-semibold text-healwin-700">
                  {me?.fullName?.[0]?.toUpperCase() || "?"}
                </div>
                <div>
                  <div className="text-base font-semibold text-gray-900">{me?.fullName}</div>
                  {me?.roleName && <Badge tone="info">{me.roleName}</Badge>}
                </div>
              </div>

              <dl className="space-y-2 text-sm">
                <Row icon={<Mail className="h-4 w-4" />} label="Email" value={me?.email} />
                <Row icon={<Phone className="h-4 w-4" />} label="Phone" value={me?.phone} />
                {me?.employee?.employeeCode && (
                  <Row icon={<IdCard className="h-4 w-4" />} label="Employee ID" value={me.employee.employeeCode} />
                )}
                {(me?.employee?.department || me?.employee?.designation) && (
                  <Row
                    icon={<Building2 className="h-4 w-4" />}
                    label="Department"
                    value={[me?.employee?.designation, me?.employee?.department].filter(Boolean).join(" · ")}
                  />
                )}
                <Row icon={<ShieldCheck className="h-4 w-4" />} label="Last sign-in" value={fmt(me?.lastLogin)} />
                <Row icon={<KeyRound className="h-4 w-4" />} label="Password changed" value={fmt(me?.passwordChangedAt)} />
              </dl>

              <p className="mt-4 text-xs text-gray-400">
                Your name, department and role are maintained by HR. Ask them to
                change anything that is wrong here.
              </p>
              {me?.employee?.employeeCode && (
                <Link
                  to="/admin/my-attendance"
                  className="mt-3 inline-block text-sm text-healwin-600 hover:underline"
                >
                  View my attendance →
                </Link>
              )}
            </>
          )}
        </Card>

        {/* ── Change password ─────────────────────────────────────────────── */}
        <Card padded>
          <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-gray-900">
            <KeyRound className="h-4 w-4 text-healwin-600" />
            Change password
          </h2>
          <p className="mb-4 text-xs text-gray-500">
            Your other devices will be signed out. This one stays signed in.
          </p>

          <form onSubmit={change} className="space-y-4">
            <Field label="Current password">
              <Input
                type="password"
                autoComplete="current-password"
                value={form.current}
                onChange={(e) => setForm({ ...form, current: e.target.value })}
              />
            </Field>
            <Field label="New password" hint="At least 8 characters">
              <Input
                type="password"
                autoComplete="new-password"
                value={form.next}
                onChange={(e) => setForm({ ...form, next: e.target.value })}
              />
            </Field>
            <Field label="Confirm new password">
              <Input
                type="password"
                autoComplete="new-password"
                value={form.confirm}
                onChange={(e) => setForm({ ...form, confirm: e.target.value })}
              />
            </Field>
            <Button type="submit" disabled={saving || !form.current || !form.next}>
              {saving ? "Changing…" : "Change password"}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}

function Row({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-gray-50 py-1.5 last:border-0">
      <dt className="flex items-center gap-2 text-gray-500">
        <span className="text-gray-300">{icon}</span>
        {label}
      </dt>
      <dd className="text-right font-medium text-gray-900">{value || "—"}</dd>
    </div>
  );
}
