// src/pages/UserManagement.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Users,
  RefreshCw,
  Lock,
  Unlock,
  Trash2,
  RotateCcw,
  Eye,
  X,
  CheckCircle,
  AlertCircle,
  Phone,
  Mail,
  MapPin,
  Wallet,
  Coins,
  Calendar,
  Filter,
} from "lucide-react";
import { usersApi } from "../services/admin-api";
import { useAuth } from "../auth/useAuth";
import Pagination from "../components/Pagination";
import {
  PageHeader,
  Button,
  Card,
  Badge,
  SearchInput,
  Table,
  THead,
  TBody,
  TR,
  Th,
  Td,
  TableState,
  Modal,
  Spinner,
  cn,
} from "../components/ui";

type UserStatus = "all" | "active" | "inactive" | "blocked" | "deleted";

interface AddressLite {
  id?: string;
  address?: string;
  area?: string;
  district?: string;
  state?: string;
  country?: string;
  pinCode?: string;
  addressType?: string;
}

interface PatientUser {
  _id: string;
  fullName?: string;
  email?: string;
  countryCode?: string;
  mobileNumber?: string;
  profileImage?: string;
  gender?: string;
  dob?: string;
  isActive?: boolean;
  isBlocked?: boolean;
  isDeleted?: boolean;
  blockReason?: string | null;
  blockedAt?: string | null;
  notificationAllowed?: boolean;
  referralCode?: string;
  createdAt?: string;
  updatedAt?: string;
  bookingCount?: number;
  completedBookings?: number;
  totalSpent?: number;
  coinBalance?: number;
  walletBalance?: number;
  addressCount?: number;
  primaryAddress?: AddressLite | null;
  allAddresses?: AddressLite[];
}

interface UserStats {
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  blockedUsers: number;
  deletedUsers: number;
  newToday: number;
  newThisMonth: number;
  totalBookings: number;
  totalRevenue: number;
}

const STATUS_LABELS: Record<UserStatus, string> = {
  all: "All",
  active: "Active",
  inactive: "Inactive",
  blocked: "Blocked",
  deleted: "Deleted",
};

const formatDate = (value?: string) => {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const formatINR = (value?: number) =>
  `₹${(value ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

const StatusBadge: React.FC<{ user: PatientUser }> = ({ user }) => {
  if (user.isDeleted) {
    return (
      <Badge tone="neutral" dot>
        Deleted
      </Badge>
    );
  }
  if (user.isBlocked) {
    return (
      <Badge tone="danger" dot>
        Blocked
      </Badge>
    );
  }
  if (user.isActive) {
    return (
      <Badge tone="success" dot>
        Active
      </Badge>
    );
  }
  return (
    <Badge tone="warning" dot>
      Inactive
    </Badge>
  );
};

const Toast: React.FC<{
  type: "success" | "error";
  message: string;
  onClose: () => void;
}> = ({ type, message, onClose }) => (
  <div
    className={`fixed top-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg ${
      type === "success"
        ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
        : "bg-red-50 text-red-800 border border-red-200"
    }`}
  >
    {type === "success" ? (
      <CheckCircle className="w-5 h-5" />
    ) : (
      <AlertCircle className="w-5 h-5" />
    )}
    <span className="text-sm font-medium">{message}</span>
    <button onClick={onClose} className="ml-2 hover:opacity-70">
      <X className="w-4 h-4" />
    </button>
  </div>
);

const UserManagement: React.FC = () => {
  const { hasPermission } = useAuth();

  const canBlock = hasPermission("users:block");
  const canDelete = hasPermission("users:delete");

  const [users, setUsers] = useState<PatientUser[]>([]);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<UserStatus>("all");
  const [page, setPage] = useState(1); // 1-based for Pagination
  const [limit] = useState(20);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [selectedUser, setSelectedUser] = useState<PatientUser | null>(null);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const showToast = (type: "success" | "error", message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const res = await usersApi.getStats();
      setStats(res.data ?? res);
    } catch (err: any) {
      console.error("[UserManagement] stats error", err);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await usersApi.list({
        page: page - 1, // backend is 0-based
        limit,
        search: search.trim() || undefined,
        status: status === "all" ? undefined : status,
      });
      const data = res.data ?? res;
      setUsers(data.users ?? []);
      setTotal(data.total ?? 0);
      setTotalPages(data.totalPages ?? 0);
    } catch (err: any) {
      showToast("error", err?.message || "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, status]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchUsers();
  };

  const handleStatusChange = (next: UserStatus) => {
    setStatus(next);
    setPage(1);
  };

  const refreshAll = () => {
    fetchStats();
    fetchUsers();
  };

  const handleBlock = async (user: PatientUser) => {
    if (!canBlock) return;
    const reason = window.prompt(
      `Block ${user.fullName || user.mobileNumber}?\nOptional reason:`,
      "",
    );
    if (reason === null) return;
    setActionBusy(user._id);
    try {
      await usersApi.block(user._id, reason || undefined);
      showToast("success", "User blocked");
      await Promise.all([fetchUsers(), fetchStats()]);
    } catch (err: any) {
      showToast("error", err?.message || "Failed to block user");
    } finally {
      setActionBusy(null);
    }
  };

  const handleUnblock = async (user: PatientUser) => {
    if (!canBlock) return;
    if (!window.confirm(`Unblock ${user.fullName || user.mobileNumber}?`))
      return;
    setActionBusy(user._id);
    try {
      await usersApi.unblock(user._id);
      showToast("success", "User unblocked");
      await Promise.all([fetchUsers(), fetchStats()]);
    } catch (err: any) {
      showToast("error", err?.message || "Failed to unblock user");
    } finally {
      setActionBusy(null);
    }
  };

  const handleDelete = async (user: PatientUser) => {
    if (!canDelete) return;
    if (
      !window.confirm(
        `Delete ${user.fullName || user.mobileNumber}? This is a soft delete and can be restored.`,
      )
    )
      return;
    setActionBusy(user._id);
    try {
      await usersApi.remove(user._id);
      showToast("success", "User deleted");
      await Promise.all([fetchUsers(), fetchStats()]);
    } catch (err: any) {
      showToast("error", err?.message || "Failed to delete user");
    } finally {
      setActionBusy(null);
    }
  };

  const handleRestore = async (user: PatientUser) => {
    if (!canDelete) return;
    if (!window.confirm(`Restore ${user.fullName || user.mobileNumber}?`))
      return;
    setActionBusy(user._id);
    try {
      await usersApi.restore(user._id);
      showToast("success", "User restored");
      await Promise.all([fetchUsers(), fetchStats()]);
    } catch (err: any) {
      showToast("error", err?.message || "Failed to restore user");
    } finally {
      setActionBusy(null);
    }
  };

  const statCards = useMemo(
    () => [
      {
        label: "Total Users",
        value: stats?.totalUsers ?? 0,
        icon: Users,
        color: "text-healwin-600 bg-healwin-50",
      },
      {
        label: "Active",
        value: stats?.activeUsers ?? 0,
        icon: CheckCircle,
        color: "text-emerald-600 bg-emerald-50",
      },
      {
        label: "Blocked",
        value: stats?.blockedUsers ?? 0,
        icon: Lock,
        color: "text-red-600 bg-red-50",
      },
      {
        label: "New This Month",
        value: stats?.newThisMonth ?? 0,
        icon: Calendar,
        color: "text-blue-600 bg-blue-50",
      },
    ],
    [stats],
  );

  return (
    <div className="p-6">
      {toast && (
        <Toast
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}

      <PageHeader
        title="User Management"
        subtitle="Manage patient app users — block, unblock, delete and review account activity."
        actions={
          <Button
            variant="secondary"
            onClick={refreshAll}
            disabled={loading || statsLoading}
            icon={
              <RefreshCw
                className={cn(
                  "w-4 h-4",
                  (loading || statsLoading) && "animate-spin",
                )}
              />
            }
          >
            Refresh
          </Button>
        }
      />

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 mb-6">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.label} padded>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium tracking-wide text-gray-500 uppercase">
                    {card.label}
                  </p>
                  <p className="mt-1 text-2xl font-bold text-gray-800">
                    {card.value.toLocaleString("en-IN")}
                  </p>
                </div>
                <div
                  className={`flex items-center justify-center w-10 h-10 rounded-lg ${card.color}`}
                >
                  <Icon className="w-5 h-5" />
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Filter bar */}
      <Card padded className="mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <form
            onSubmit={handleSearchSubmit}
            className="flex-1 min-w-[240px]"
          >
            <SearchInput
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, mobile, email or referral code"
            />
          </form>
          <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-lg">
            <Filter className="w-4 h-4 ml-2 text-gray-500" />
            {(Object.keys(STATUS_LABELS) as UserStatus[]).map((s) => (
              <button
                key={s}
                onClick={() => handleStatusChange(s)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                  status === s
                    ? "bg-white text-healwin-700 shadow-sm"
                    : "text-gray-600 hover:text-gray-800"
                }`}
              >
                {STATUS_LABELS[s]}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Table */}
      <Table>
        <THead>
          <Th>User</Th>
          <Th>Contact</Th>
          <Th>Status</Th>
          <Th className="text-right">Bookings</Th>
          <Th className="text-right">Spent</Th>
          <Th className="text-right">Wallet</Th>
          <Th>Joined</Th>
          <Th className="text-right">Actions</Th>
        </THead>
        <TBody>
          {loading ? (
            <TableState colSpan={8}>
              <RefreshCw className="inline-block w-5 h-5 mr-2 animate-spin" />
              Loading users…
            </TableState>
          ) : users.length === 0 ? (
            <TableState colSpan={8}>No users found.</TableState>
          ) : (
            users.map((user) => {
              const busy = actionBusy === user._id;
              return (
                <TR key={user._id}>
                  <Td>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-9 h-9 text-sm font-semibold text-white rounded-full bg-gradient-to-br from-healwin-500 to-healwin-600">
                        {(user.fullName || "U").charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-gray-800">
                          {user.fullName || "Unnamed"}
                        </p>
                        {user.referralCode && (
                          <p className="text-xs text-gray-400">
                            Ref: {user.referralCode}
                          </p>
                        )}
                      </div>
                    </div>
                  </Td>
                  <Td>
                    <div className="flex flex-col text-xs text-gray-600">
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {user.countryCode || "+91"} {user.mobileNumber}
                      </span>
                      {user.email && (
                        <span className="flex items-center gap-1 mt-0.5">
                          <Mail className="w-3 h-3" />
                          {user.email}
                        </span>
                      )}
                    </div>
                  </Td>
                  <Td>
                    <StatusBadge user={user} />
                    {user.isBlocked && user.blockReason && (
                      <p
                        className="mt-1 text-[10px] text-red-500 max-w-[180px] truncate"
                        title={user.blockReason}
                      >
                        {user.blockReason}
                      </p>
                    )}
                  </Td>
                  <Td className="text-right tabular-nums">
                    <p className="font-semibold text-gray-800">
                      {user.bookingCount ?? 0}
                    </p>
                    <p className="text-[10px] text-gray-400">
                      {user.completedBookings ?? 0} done
                    </p>
                  </Td>
                  <Td className="font-medium text-right tabular-nums text-gray-800">
                    {formatINR(user.totalSpent)}
                  </Td>
                  <Td className="text-right tabular-nums">
                    <p className="text-gray-800">
                      {formatINR(user.walletBalance)}
                    </p>
                    <p className="text-[10px] text-gray-400">
                      {user.coinBalance ?? 0} coins
                    </p>
                  </Td>
                  <Td className="text-xs text-gray-500">
                    {formatDate(user.createdAt)}
                  </Td>
                  <Td>
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setSelectedUser(user)}
                        title="View details"
                        className="p-2 text-gray-500 rounded-lg hover:bg-gray-100"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      {user.isDeleted
                        ? canDelete && (
                            <button
                              onClick={() => handleRestore(user)}
                              disabled={busy}
                              title="Restore"
                              className="p-2 text-emerald-600 rounded-lg hover:bg-emerald-50 disabled:opacity-50"
                            >
                              <RotateCcw className="w-4 h-4" />
                            </button>
                          )
                        : (
                            <>
                              {canBlock &&
                                (user.isBlocked ? (
                                  <button
                                    onClick={() => handleUnblock(user)}
                                    disabled={busy}
                                    title="Unblock"
                                    className="p-2 text-emerald-600 rounded-lg hover:bg-emerald-50 disabled:opacity-50"
                                  >
                                    <Unlock className="w-4 h-4" />
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handleBlock(user)}
                                    disabled={busy}
                                    title="Block"
                                    className="p-2 text-amber-600 rounded-lg hover:bg-amber-50 disabled:opacity-50"
                                  >
                                    <Lock className="w-4 h-4" />
                                  </button>
                                ))}
                              {canDelete && (
                                <button
                                  onClick={() => handleDelete(user)}
                                  disabled={busy}
                                  title="Delete"
                                  className="p-2 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </>
                          )}
                    </div>
                  </Td>
                </TR>
              );
            })
          )}
        </TBody>
      </Table>

      <Pagination
        page={page}
        totalPages={totalPages}
        total={total}
        label="users"
        onPageChange={setPage}
      />

      {/* Detail drawer */}
      {selectedUser && (
        <UserDetailDrawer
          user={selectedUser}
          onClose={() => setSelectedUser(null)}
        />
      )}
    </div>
  );
};

const UserDetailDrawer: React.FC<{
  user: PatientUser;
  onClose: () => void;
}> = ({ user, onClose }) => {
  const [detail, setDetail] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await usersApi.detail(user._id);
        if (!cancelled) setDetail(res.data ?? res);
      } catch (err) {
        console.error(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user._id]);

  return (
    <Modal open onClose={onClose} title="User details" size="md">
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-12 h-12 text-lg font-semibold text-white rounded-full bg-gradient-to-br from-healwin-500 to-healwin-600">
            {(user.fullName || "U").charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-semibold text-gray-800">
              {user.fullName || "Unnamed"}
            </p>
            <p className="text-xs text-gray-500">
              {user.countryCode || "+91"} {user.mobileNumber}
            </p>
            {user.email && (
              <p className="text-xs text-gray-500">{user.email}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <InfoTile
            label="Status"
            value={
              user.isDeleted
                ? "Deleted"
                : user.isBlocked
                  ? "Blocked"
                  : user.isActive
                    ? "Active"
                    : "Inactive"
            }
          />
          <InfoTile label="Gender" value={user.gender || "—"} />
          <InfoTile label="DOB" value={user.dob || "—"} />
          <InfoTile
            label="Notifications"
            value={user.notificationAllowed ? "Enabled" : "Disabled"}
          />
          <InfoTile label="Joined" value={formatDate(user.createdAt)} />
          <InfoTile
            label="Last updated"
            value={formatDate(user.updatedAt)}
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <SmallStat
            icon={Wallet}
            label="Wallet"
            value={formatINR(user.walletBalance)}
          />
          <SmallStat
            icon={Coins}
            label="Coins"
            value={(user.coinBalance ?? 0).toString()}
          />
          <SmallStat
            icon={Calendar}
            label="Bookings"
            value={(user.bookingCount ?? 0).toString()}
          />
        </div>

        {user.isBlocked && user.blockReason && (
          <div className="p-3 text-sm border rounded-lg bg-red-50 border-red-200 text-red-700">
            <p className="font-medium">Block reason</p>
            <p className="mt-1 text-xs">{user.blockReason}</p>
            {user.blockedAt && (
              <p className="mt-1 text-[10px] text-red-500">
                Blocked on {formatDate(user.blockedAt)}
              </p>
            )}
          </div>
        )}

        <div>
          <h3 className="flex items-center gap-2 mb-2 text-sm font-semibold text-gray-700">
            <MapPin className="w-4 h-4" />
            Addresses ({user.addressCount ?? user.allAddresses?.length ?? 0})
          </h3>
          <div className="space-y-2">
            {(user.allAddresses ?? []).length === 0 ? (
              <p className="text-xs text-gray-400">No addresses on file.</p>
            ) : (
              (user.allAddresses ?? []).map((addr) => (
                <div
                  key={addr.id ?? addr.address}
                  className="p-3 text-xs border rounded-lg text-gray-700"
                >
                  {addr.addressType && (
                    <span className="inline-block px-2 py-0.5 mb-1 text-[10px] font-medium rounded-full bg-healwin-50 text-healwin-700">
                      {addr.addressType}
                    </span>
                  )}
                  <p>{addr.address}</p>
                  <p className="text-gray-400">
                    {[addr.area, addr.district, addr.state, addr.pinCode]
                      .filter(Boolean)
                      .join(", ")}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        {!loading && (
          <div>
            <h3 className="flex items-center gap-2 mb-2 text-sm font-semibold text-gray-700">
              <Phone className="w-4 h-4" />
              Emergency Contacts ({detail?.emergencyContacts?.length ?? 0})
            </h3>
            <div className="space-y-2">
              {(detail?.emergencyContacts ?? []).length === 0 ? (
                <p className="text-xs text-gray-400">No emergency contacts added in the app.</p>
              ) : (
                (detail?.emergencyContacts ?? []).map((c: any) => (
                  <div key={c._id} className="flex items-center justify-between p-3 text-xs border rounded-lg text-gray-700">
                    <div>
                      <p className="font-medium text-gray-800">{c.name}</p>
                      <p className="text-gray-400">{c.phone}</p>
                    </div>
                    {c.relationship && (
                      <span className="inline-block px-2 py-0.5 text-[10px] font-medium rounded-full bg-healwin-50 text-healwin-700 capitalize">
                        {String(c.relationship).toLowerCase()}
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {loading ? (
          <p className="flex items-center gap-2 text-xs text-gray-400">
            <Spinner className="h-4 w-4" />
            Loading additional details…
          </p>
        ) : (
          detail?.bookingStats && (
            <div>
              <h3 className="mb-2 text-sm font-semibold text-gray-700">
                Booking breakdown
              </h3>
              <div className="space-y-1">
                {detail.bookingStats.length === 0 ? (
                  <p className="text-xs text-gray-400">
                    No bookings recorded.
                  </p>
                ) : (
                  detail.bookingStats.map((s: any) => (
                    <div
                      key={s._id}
                      className="flex items-center justify-between p-2 text-xs border rounded-lg"
                    >
                      <span className="font-medium text-gray-700">
                        {s._id}
                      </span>
                      <span className="text-gray-500">
                        {s.count} • {formatINR(s.totalSpent)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )
        )}
      </div>
    </Modal>
  );
};

const InfoTile: React.FC<{ label: string; value: string }> = ({
  label,
  value,
}) => (
  <div className="p-3 border rounded-lg">
    <p className="text-[10px] tracking-wide text-gray-400 uppercase">
      {label}
    </p>
    <p className="mt-1 text-sm font-medium text-gray-800">{value}</p>
  </div>
);

const SmallStat: React.FC<{
  icon: React.FC<any>;
  label: string;
  value: string;
}> = ({ icon: Icon, label, value }) => (
  <div className="p-3 text-center border rounded-lg">
    <Icon className="w-4 h-4 mx-auto text-healwin-500" />
    <p className="mt-1 text-sm font-semibold text-gray-800">{value}</p>
    <p className="text-[10px] text-gray-400">{label}</p>
  </div>
);

export default UserManagement;
