import React, { useEffect, useState } from "react";
import { bookingsApi } from "../services/admin-api";
import Pagination from "../components/Pagination";
import {
  PageHeader,
  Button,
  SearchInput,
  Select,
  Badge,
  Alert,
  Modal,
  Field,
  Input,
  Table,
  THead,
  TBody,
  TR,
  Th,
  Td,
  TableState,
} from "../components/ui";

interface Populated {
  _id: string;
  fullName?: string;
  mobileNumber?: string;
  name?: string;
}
interface Booking {
  _id: string;
  bookingNumber?: string;
  status: string;
  paymentStatus?: string;
  serviceType?: string;
  finalFare?: number;
  createdAt: string;
  userId?: Populated;
  driverId?: Populated;
  vehicleTypeId?: { _id: string; name?: string };
  pickup?: { address?: string };
  drop?: { address?: string };
}
interface DriverOption {
  _id: string;
  fullName?: string;
  mobileNumber?: string;
  vehicleNumber?: string;
  isOnline?: boolean;
}

const STATUSES = [
  "DRAFT",
  "SEARCHING",
  "ASSIGNED",
  "DRIVER_ARRIVED",
  "PICKED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
];

const statusTone = (
  s: string,
): "success" | "danger" | "warning" | "info" | "neutral" => {
  if (s === "COMPLETED") return "success";
  if (s === "CANCELLED") return "danger";
  if (s === "SEARCHING") return "warning";
  if (s === "DRAFT") return "neutral";
  return "info";
};

const PAGE_LIMIT = 20;

const BookingManagement: React.FC = () => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1); // 1-indexed in UI
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Assign-driver modal
  const [assignFor, setAssignFor] = useState<Booking | null>(null);
  const [drivers, setDrivers] = useState<DriverOption[]>([]);
  const [driverId, setDriverId] = useState("");
  const [working, setWorking] = useState(false);

  // Cancel modal
  const [cancelFor, setCancelFor] = useState<Booking | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  const load = async () => {
    try {
      setLoading(true);
      const params: Record<string, string> = {
        page: String(page - 1), // API is 0-indexed
        limit: String(PAGE_LIMIT),
      };
      if (search.trim()) params.search = search.trim();
      if (statusFilter) params.status = statusFilter;
      const res = await bookingsApi.getAll(params);
      const d = res.data || {};
      setBookings(d.bookings || []);
      setTotal(d.total || 0);
      setTotalPages(d.totalPages || 1);
    } catch (err: any) {
      setError(err.message || "Failed to load bookings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, statusFilter]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, search]);

  const openAssign = async (b: Booking) => {
    setAssignFor(b);
    setDriverId("");
    try {
      const res = await bookingsApi.drivers();
      setDrivers(res.data?.drivers || []);
    } catch {
      setDrivers([]);
    }
  };

  const submitAssign = async () => {
    if (!assignFor || !driverId) return;
    setError("");
    try {
      setWorking(true);
      await bookingsApi.assign(assignFor._id, driverId);
      setAssignFor(null);
      load();
    } catch (err: any) {
      setError(err.message || "Failed to assign driver");
    } finally {
      setWorking(false);
    }
  };

  const submitCancel = async () => {
    if (!cancelFor) return;
    setError("");
    try {
      setWorking(true);
      await bookingsApi.cancel(cancelFor._id, cancelReason.trim() || undefined);
      setCancelFor(null);
      setCancelReason("");
      load();
    } catch (err: any) {
      setError(err.message || "Failed to cancel booking");
    } finally {
      setWorking(false);
    }
  };

  const canCancel = (s: string) => !["COMPLETED", "CANCELLED"].includes(s);

  return (
    <div className="p-6">
      <PageHeader
        title="Bookings"
        subtitle={`${total} booking(s)`}
      />

      {error && (
        <Alert className="mb-4" tone="danger">
          <span className="flex items-center justify-between gap-4">
            {error}
            <button onClick={() => setError("")} className="font-bold">
              ×
            </button>
          </span>
        </Alert>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            load();
          }}
          className="flex gap-2"
        >
          <SearchInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search booking # / address…"
            className="w-full max-w-xs"
          />
          <Button type="submit" variant="secondary">
            Search
          </Button>
        </form>
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-auto"
        >
          <option value="">All status</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.replace(/_/g, " ")}
            </option>
          ))}
        </Select>
      </div>

      <Table>
        <THead>
          <Th>Booking #</Th>
          <Th>Customer</Th>
          <Th>Driver</Th>
          <Th>Vehicle</Th>
          <Th className="text-right">Fare</Th>
          <Th>Status</Th>
          <Th>Date</Th>
          <Th className="text-right">Actions</Th>
        </THead>
        <TBody>
          {loading ? (
            <TableState colSpan={8}>Loading…</TableState>
          ) : bookings.length === 0 ? (
            <TableState colSpan={8}>No bookings found.</TableState>
          ) : (
            bookings.map((b) => (
              <TR key={b._id}>
                <Td className="font-medium text-gray-900">
                  {b.bookingNumber || b._id.slice(-6)}
                </Td>
                <Td className="text-gray-600">
                  {b.userId?.fullName || "—"}
                  {b.userId?.mobileNumber && (
                    <span className="block text-xs text-gray-400">
                      {b.userId.mobileNumber}
                    </span>
                  )}
                </Td>
                <Td className="text-gray-600">
                  {b.driverId?.fullName || (
                    <span className="text-gray-400">Unassigned</span>
                  )}
                </Td>
                <Td className="text-gray-500">{b.vehicleTypeId?.name || "—"}</Td>
                <Td className="text-right font-medium text-gray-900">
                  {b.finalFare != null ? `₹${b.finalFare}` : "—"}
                </Td>
                <Td>
                  <Badge tone={statusTone(b.status)} dot>
                    {b.status.replace(/_/g, " ")}
                  </Badge>
                </Td>
                <Td className="text-gray-500">
                  {new Date(b.createdAt).toLocaleDateString()}
                </Td>
                <Td className="text-right whitespace-nowrap">
                  {b.status === "SEARCHING" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => openAssign(b)}
                    >
                      Assign
                    </Button>
                  )}
                  {canCancel(b.status) && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-600 hover:bg-red-50 hover:text-red-700"
                      onClick={() => setCancelFor(b)}
                    >
                      Cancel
                    </Button>
                  )}
                </Td>
              </TR>
            ))
          )}
        </TBody>
      </Table>

      <Pagination
        page={page}
        totalPages={totalPages}
        total={total}
        label="bookings"
        onPageChange={setPage}
      />

      {/* Assign driver */}
      <Modal
        open={!!assignFor}
        onClose={() => setAssignFor(null)}
        title="Assign Driver"
        subtitle={
          assignFor
            ? `Booking ${assignFor.bookingNumber || assignFor._id.slice(-6)}`
            : undefined
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setAssignFor(null)}>
              Cancel
            </Button>
            <Button onClick={submitAssign} disabled={!driverId || working}>
              {working ? "Assigning…" : "Assign"}
            </Button>
          </>
        }
      >
        <Field label="Driver">
          <Select
            value={driverId}
            onChange={(e) => setDriverId(e.target.value)}
          >
            <option value="">Select a driver…</option>
            {drivers.map((d) => (
              <option key={d._id} value={d._id}>
                {d.fullName || "Driver"}
                {d.mobileNumber ? ` · ${d.mobileNumber}` : ""}
                {d.isOnline ? " · online" : ""}
              </option>
            ))}
          </Select>
        </Field>
        {drivers.length === 0 && (
          <p className="mt-2 text-xs text-gray-400">
            No approved drivers available.
          </p>
        )}
      </Modal>

      {/* Cancel booking */}
      <Modal
        open={!!cancelFor}
        onClose={() => setCancelFor(null)}
        title="Cancel Booking"
        subtitle={
          cancelFor
            ? `Booking ${cancelFor.bookingNumber || cancelFor._id.slice(-6)}`
            : undefined
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setCancelFor(null)}>
              Keep
            </Button>
            <Button variant="danger" onClick={submitCancel} disabled={working}>
              {working ? "Cancelling…" : "Cancel Booking"}
            </Button>
          </>
        }
      >
        <Field label="Reason (optional)">
          <Input
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="Why is this booking being cancelled?"
          />
        </Field>
      </Modal>
    </div>
  );
};

export default BookingManagement;
