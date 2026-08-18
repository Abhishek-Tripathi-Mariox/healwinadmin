// src/pages/PharmacyDispense.tsx
//
// Pharmacy counter — the queue of prescriptions doctors have raised.
// Fulfilling a request draws the medicine from HMS inventory (FEFO batches)
// and writes a StockTransaction, so prescribing and stock stay in step.
import { useCallback, useEffect, useState } from "react";
import { pharmacyDispenseApi } from "../services/admin-api";
import { useAuth } from "../auth/useAuth";
import { PERMISSIONS } from "../auth/permissions";
import Pagination from "../components/Pagination";
import {
  PageHeader,
  Button,
  Select,
  Card,
  Badge,
  Modal,
  Input,
  Alert,
} from "../components/ui";

interface DispenseLine {
  itemId?: string;
  drug: string;
  dosage?: string;
  frequency?: string;
  duration?: string;
  quantity: number;
  dispensedQuantity: number;
}

interface Dispense {
  _id: string;
  status: "pending" | "partial" | "dispensed" | "cancelled";
  lines: DispenseLine[];
  createdAt: string;
  patientId?: { _id: string; patientId?: string; fullName?: string; phone?: string };
  doctorId?: { fullName?: string };
}

const tone: Record<string, "warning" | "info" | "success" | "neutral"> = {
  pending: "warning",
  partial: "info",
  dispensed: "success",
  cancelled: "neutral",
};

export default function PharmacyDispense() {
  const { hasPermission } = useAuth();
  const canDispense = hasPermission(PERMISSIONS.INVENTORY_ADJUST);

  const [items, setItems] = useState<Dispense[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [total, setTotal] = useState(0);
  const totalPages = Math.max(1, Math.ceil(total / limit));

  // Fulfil modal — quantity actually handed over, per line.
  const [fulfilling, setFulfilling] = useState<Dispense | null>(null);
  const [qty, setQty] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);
  const [modalErr, setModalErr] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params: Record<string, string | number> = { page, limit };
      if (status) params.status = status;
      const res = await pharmacyDispenseApi.list(params);
      const data = res.data || res;
      setItems(data.items || []);
      setTotal(data.pagination?.total ?? (data.items || []).length);
    } catch (e: any) {
      setError(e?.message || "Failed to load the dispense queue");
    } finally {
      setLoading(false);
    }
  }, [status, page, limit]);

  useEffect(() => {
    setPage(1);
  }, [status]);
  useEffect(() => {
    load();
  }, [load]);

  const openFulfil = (d: Dispense) => {
    setFulfilling(d);
    setModalErr("");
    setQty(
      Object.fromEntries(
        d.lines.map((l, i) => [
          i,
          String(Math.max(0, (l.quantity || 0) - (l.dispensedQuantity || 0))),
        ]),
      ),
    );
  };

  const submitFulfil = async (overrideAllergyWarning = false) => {
    if (!fulfilling) return;
    setSaving(true);
    setModalErr("");
    try {
      const lines = fulfilling.lines.map((l, i) => ({
        index: i,
        quantity: (l.dispensedQuantity || 0) + (Number(qty[i]) || 0),
      }));
      const res = await pharmacyDispenseApi.fulfil(
        fulfilling._id,
        lines,
        overrideAllergyWarning,
      );
      const shortfalls: string[] = res.data?.shortfalls || [];
      setFulfilling(null);
      load();
      if (shortfalls.length) {
        alert(
          "Some lines could not be issued:\n\n" + shortfalls.join("\n"),
        );
      }
    } catch (e: any) {
      // Allergy conflict — the server refuses until a human acknowledges it.
      const warnings = e?.data?.allergyWarnings as
        | { drug: string; allergyTerm: string }[]
        | undefined;
      if (warnings?.length) {
        const list = warnings
          .map((w) => `${w.drug} — conflicts with recorded allergy "${w.allergyTerm}"`)
          .join("\n");
        setSaving(false);
        if (
          window.confirm(
            `⚠ Allergy warning:\n\n${list}\n\nDispense anyway? This is recorded as an overridden allergy warning.`,
          )
        ) {
          return submitFulfil(true);
        }
        return;
      }
      setModalErr(e?.message || "Failed to dispense");
    } finally {
      setSaving(false);
    }
  };

  const cancel = async (d: Dispense) => {
    if (!window.confirm("Cancel this prescription request?")) return;
    try {
      await pharmacyDispenseApi.cancel(d._id);
      load();
    } catch (e: any) {
      setError(e?.message || "Failed to cancel");
    }
  };

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Pharmacy — Dispense Queue"
        subtitle="Prescriptions raised by doctors, fulfilled against hospital stock"
      />

      <div className="flex flex-wrap items-center gap-3">
        <Select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="w-48"
        >
          <option value="">Open queue</option>
          <option value="pending">Pending</option>
          <option value="partial">Partially dispensed</option>
          <option value="dispensed">Dispensed</option>
          <option value="cancelled">Cancelled</option>
        </Select>
        <span className="text-sm text-gray-500">{total} request(s)</span>
      </div>

      {loading ? (
        <Card className="p-10 text-center text-gray-500">Loading…</Card>
      ) : error ? (
        // A failed load must NOT claim the queue is empty — that asserts
        // something we don't know. "Nothing in the queue" was showing whenever
        // the API was unreachable, which reads as "no prescriptions" when the
        // truth is "we couldn't ask".
        <Card className="p-10 text-center">
          <p className="font-medium text-red-700">Could not load the queue</p>
          <p className="mt-1 text-sm text-gray-500">{error}</p>
          <Button size="sm" className="mt-3" onClick={load}>
            Retry
          </Button>
        </Card>
      ) : items.length === 0 ? (
        <Card className="p-10 text-center text-gray-500">
          Nothing in the queue. Prescriptions appear here as soon as a doctor
          finalises an encounter.
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((d) => (
            <Card key={d._id} className="p-4">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Badge tone={tone[d.status] || "neutral"} dot>
                  {d.status}
                </Badge>
                <span className="font-semibold text-gray-900">
                  {d.patientId?.fullName || "Patient"}
                </span>
                {d.patientId?.patientId && (
                  <span className="text-xs text-gray-400">
                    {d.patientId.patientId}
                  </span>
                )}
                <span className="text-sm text-gray-500">
                  · Dr. {d.doctorId?.fullName || "—"}
                </span>
                <span className="ml-auto text-xs text-gray-400">
                  {new Date(d.createdAt).toLocaleString()}
                </span>
              </div>

              <div className="space-y-1">
                {d.lines.map((l, i) => (
                  <div
                    key={i}
                    className="flex flex-wrap items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 text-sm"
                  >
                    <span className="font-medium text-gray-900">{l.drug}</span>
                    {!l.itemId && (
                      <span
                        className="text-xs text-amber-600"
                        title="Not linked to hospital stock — nothing will be decremented."
                      >
                        (not stocked)
                      </span>
                    )}
                    <span className="text-gray-500">
                      {[l.dosage, l.frequency, l.duration]
                        .filter(Boolean)
                        .join(" · ") || "—"}
                    </span>
                    <span className="ml-auto text-gray-600">
                      {l.dispensedQuantity || 0} / {l.quantity} issued
                    </span>
                  </div>
                ))}
              </div>

              {canDispense && d.status !== "dispensed" && d.status !== "cancelled" && (
                <div className="mt-3 flex justify-end gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-red-600 hover:bg-red-50"
                    onClick={() => cancel(d)}
                  >
                    Cancel
                  </Button>
                  <Button size="sm" onClick={() => openFulfil(d)}>
                    Dispense
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          Rows per page
          <Select
            value={String(limit)}
            onChange={(e) => {
              setLimit(Number(e.target.value));
              setPage(1);
            }}
            className="w-20"
          >
            {[10, 20, 50].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </Select>
        </div>
        <Pagination
          page={page}
          totalPages={totalPages}
          total={total}
          onPageChange={setPage}
        />
      </div>

      <Modal
        open={!!fulfilling}
        onClose={() => setFulfilling(null)}
        title="Dispense Medicine"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setFulfilling(null)}>
              Cancel
            </Button>
            <Button onClick={() => submitFulfil()} disabled={saving}>
              {saving ? "Issuing…" : "Confirm Dispense"}
            </Button>
          </>
        }
      >
        {fulfilling && (
          <div className="space-y-3">
            {modalErr && <Alert tone="danger">{modalErr}</Alert>}
            <p className="text-sm text-gray-500">
              Enter how many units you are handing over now. Stock is drawn
              oldest-expiry-first; lines without hospital stock are recorded but
              do not affect inventory.
            </p>
            {fulfilling.lines.map((l, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{l.drug}</p>
                  <p className="text-xs text-gray-500">
                    prescribed {l.quantity} · already issued{" "}
                    {l.dispensedQuantity || 0}
                  </p>
                </div>
                <Input
                  type="number"
                  min="0"
                  className="w-24"
                  value={qty[i] ?? ""}
                  onChange={(e) => setQty({ ...qty, [i]: e.target.value })}
                />
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}
