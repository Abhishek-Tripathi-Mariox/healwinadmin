import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, Users, MapPin } from "lucide-react";
import { hospitalApi } from "../services/admin-api";
import Pagination from "../components/Pagination";
import {
  PageHeader,
  SearchInput,
  Select,
  Card,
  Badge,
  Spinner,
  EmptyState,
  Alert,
} from "../components/ui";

interface Hospital {
  _id: string;
  name: string;
  type: "healwin_operated" | "healwin_approved" | "other";
  address: string;
  phone?: string;
  state?: { _id: string; name: string };
  district?: { _id: string; name: string };
  staffCount: number;
  isActive: boolean;
}

interface ListResponse<T> {
  data?: { items?: T[]; total?: number };
  rData?: { items?: T[]; total?: number };
}

const unwrap = <T,>(res: ListResponse<T>): T[] =>
  res?.data?.items ?? res?.rData?.items ?? [];

const typeTone: Record<
  Hospital["type"],
  "success" | "info" | "neutral"
> = {
  healwin_operated: "success",
  healwin_approved: "info",
  other: "neutral",
};

const typeLabel: Record<Hospital["type"], string> = {
  healwin_operated: "Operated",
  healwin_approved: "Approved",
  other: "Other",
};

/**
 * Hospitals listing. Backed by the Centre Locator rows — hospitals ARE
 * centres in the data model. Clicking a row drills into the per-hospital
 * staff management page.
 */
const HospitalsManagement: React.FC = () => {
  const navigate = useNavigate();
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [total, setTotal] = useState(0);

  const fetchHospitals = async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = {
        page: String(page),
        limit: String(limit),
      };
      if (search) params.search = search;
      if (typeFilter) params.type = typeFilter;
      const res = (await hospitalApi.list(params)) as ListResponse<Hospital>;
      setHospitals(unwrap(res));
      setTotal(res?.data?.total ?? res?.rData?.total ?? 0);
    } catch (e: any) {
      setError(e?.message || "Failed to load hospitals");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHospitals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit]);

  // Debounce search → server. Small UX nicety so typing doesn't fire
  // a request per keystroke.
  useEffect(() => {
    const t = setTimeout(() => {
      // A narrowed list is a different list: go back to its first page
      // rather than leaving the viewer on a page that no longer exists.
      if (page !== 1) setPage(1);
      else fetchHospitals();
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, typeFilter]);

  return (
    <div className="p-6">
      <PageHeader
        title="Hospitals"
        subtitle="Centres from the locator that employ ambulance attendants. Click a hospital to manage its staff."
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
          placeholder="Search by name or address…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-md"
        />
        <Select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="w-auto"
        >
          <option value="">All types</option>
          <option value="healwin_operated">HealWin operated</option>
          <option value="healwin_approved">HealWin approved</option>
          <option value="other">Other</option>
        </Select>
        <Select
          value={String(limit)}
          onChange={(e) => {
            setLimit(Number(e.target.value));
            setPage(1);
          }}
          className="w-auto"
          aria-label="Rows per page"
        >
          {[25, 50, 100].map((n) => (
            <option key={n} value={n}>{n} / page</option>
          ))}
        </Select>
        <span className="text-sm text-gray-500">{total} hospital(s)</span>
      </div>

      <Card>
        {loading && hospitals.length === 0 ? (
          <div className="p-12 text-center">
            <Spinner className="mx-auto" />
          </div>
        ) : hospitals.length === 0 ? (
          <EmptyState
            icon={<Building2 className="w-6 h-6" />}
            title="No hospitals found."
            description="Add Centres in Centre Locator to surface them here."
          />
        ) : (
          <ul className="divide-y divide-gray-100">
            {hospitals.map((h) => (
              <li
                key={h._id}
                onClick={() => navigate(`/admin/hospitals/${h._id}`)}
                className="flex items-center justify-between p-4 cursor-pointer transition-colors hover:bg-gray-50"
              >
                <div className="flex items-center min-w-0 space-x-3">
                  <div className="flex items-center justify-center flex-shrink-0 w-10 h-10 rounded-lg bg-healwin-50">
                    <Building2 className="w-5 h-5 text-healwin-600" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center space-x-2">
                      <p className="font-semibold text-gray-800 truncate">
                        {h.name}
                      </p>
                      <Badge tone={typeTone[h.type]}>
                        {typeLabel[h.type]}
                      </Badge>
                    </div>
                    <p className="flex items-center mt-1 text-xs text-gray-500 truncate">
                      <MapPin className="w-3 h-3 mr-1 flex-shrink-0" />
                      {[h.address, h.district?.name, h.state?.name]
                        .filter(Boolean)
                        .join(", ")}
                    </p>
                  </div>
                </div>
                <div className="flex items-center pl-4 space-x-1 text-sm text-gray-700 whitespace-nowrap">
                  <Users className="w-4 h-4 text-gray-400" />
                  <span className="font-semibold">{h.staffCount}</span>
                  <span className="text-gray-500">staff</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Pagination
        page={page}
        totalPages={Math.max(1, Math.ceil(total / limit))}
        total={total}
        label="hospitals"
        onPageChange={setPage}
      />
    </div>
  );
};

export default HospitalsManagement;
