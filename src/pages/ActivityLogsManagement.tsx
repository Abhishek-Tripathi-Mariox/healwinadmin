import React, { useEffect, useState, useCallback } from "react";
import { activityLogsApi } from "../services/admin-api";
import {
  PageHeader,
  Button,
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
  Alert,
} from "../components/ui";

const timeRangeOptions = [
  { label: "Last 1 min", value: "1min" },
  { label: "Last 10 min", value: "10min" },
  { label: "Last 1 hr", value: "1hr" },
  { label: "Last 6 hrs", value: "6hr" },
  { label: "Last 12 hrs", value: "12hr" },
  { label: "Last 24 hrs", value: "24hr" },
  { label: "All Time", value: "" },
];

type BadgeTone = "neutral" | "success" | "warning" | "danger" | "info" | "accent";

const methodTone: Record<string, BadgeTone> = {
  POST: "success",
  PUT: "warning",
  DELETE: "danger",
  PATCH: "info",
};

interface LogEntry {
  _id: string;
  staffName: string;
  staffEmail: string;
  action: string;
  module: string;
  method: string;
  path: string;
  responseStatus?: number;
  timeTaken?: number;
  ip?: string;
  createdAt: string;
}

const ActivityLogsManagement: React.FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Filters
  const [timeRange, setTimeRange] = useState("");
  const [staffFilter, setStaffFilter] = useState("");
  const [moduleFilter, setModuleFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Dropdown options
  const [staffList, setStaffList] = useState<
    { _id: string; staffName: string; staffEmail: string }[]
  >([]);
  const [moduleList, setModuleList] = useState<string[]>([]);

  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadFilters = async () => {
    try {
      const [sRes, mRes] = await Promise.all([
        activityLogsApi.getStaff(),
        activityLogsApi.getModules(),
      ]);
      setStaffList(sRes.data || []);
      setModuleList(mRes.data || []);
    } catch {
      /* ignore */
    }
  };

  const loadLogs = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = {
        page: String(page),
        limit: "30",
      };
      if (timeRange) params.timeRange = timeRange;
      if (staffFilter) params.staffId = staffFilter;
      if (moduleFilter) params.module = moduleFilter;
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;
      const res = await activityLogsApi.getAll(params);
      setLogs(res.data?.logs || []);
      setTotalPages(res.data?.pagination?.pages || 1);
      setTotal(res.data?.pagination?.total || 0);
    } catch (err: unknown) {
      setError((err as Error).message || "Failed to load activity logs");
    } finally {
      setIsLoading(false);
    }
  }, [page, timeRange, staffFilter, moduleFilter, dateFrom, dateTo]);

  useEffect(() => {
    loadFilters();
  }, []);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [timeRange, staffFilter, moduleFilter, dateFrom, dateTo]);

  const fmtTime = (d: string) => {
    return new Date(d).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  return (
    <div className="p-6">
      <PageHeader
        title="Activity Logs"
        subtitle="Monitor sub-admin actions and mutations"
        actions={<Button onClick={() => loadLogs()}>Refresh</Button>}
      />

      {/* Filters */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
        <Select
          value={timeRange}
          onChange={(e) => setTimeRange(e.target.value)}
        >
          {timeRangeOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
        <Select
          value={staffFilter}
          onChange={(e) => setStaffFilter(e.target.value)}
        >
          <option value="">All Staff</option>
          {staffList.map((s) => (
            <option key={s._id} value={s._id}>
              {s.staffName} ({s.staffEmail})
            </option>
          ))}
        </Select>
        <Select
          value={moduleFilter}
          onChange={(e) => setModuleFilter(e.target.value)}
        >
          <option value="">All Modules</option>
          {moduleList.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </Select>
        <Input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          placeholder="From"
        />
        <Input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          placeholder="To"
        />
      </div>

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

      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-gray-500">
          {total} log{total !== 1 && "s"} found
        </span>
      </div>

      {/* Table */}
      <Table>
        <THead>
          <Th>Time</Th>
          <Th>Staff</Th>
          <Th>Action</Th>
          <Th>Module</Th>
          <Th>Method</Th>
          <Th>Path</Th>
          <Th>Status</Th>
          <Th>Duration</Th>
          <Th></Th>
        </THead>
        <TBody>
          {isLoading ? (
            <TableState colSpan={9}>Loading logs...</TableState>
          ) : logs.length === 0 ? (
            <TableState colSpan={9}>No activity logs found.</TableState>
          ) : (
            logs.map((log) => (
              <React.Fragment key={log._id}>
                <TR
                  clickable
                  onClick={() =>
                    setExpandedId(expandedId === log._id ? null : log._id)
                  }
                >
                  <Td className="text-gray-600 whitespace-nowrap">
                    {fmtTime(log.createdAt)}
                  </Td>
                  <Td className="whitespace-nowrap">
                    <div className="font-medium text-gray-800">
                      {log.staffName}
                    </div>
                    <div className="text-xs text-gray-400">
                      {log.staffEmail}
                    </div>
                  </Td>
                  <Td className="text-gray-700 whitespace-nowrap">
                    {log.action}
                  </Td>
                  <Td className="whitespace-nowrap">
                    <Badge tone="info">{log.module}</Badge>
                  </Td>
                  <Td className="whitespace-nowrap">
                    <Badge tone={methodTone[log.method] || "neutral"}>
                      {log.method}
                    </Badge>
                  </Td>
                  <Td className="text-gray-600 font-mono text-xs max-w-[200px] truncate">
                    {log.path}
                  </Td>
                  <Td className="whitespace-nowrap">
                    <span
                      className={`text-xs font-medium ${
                        (log.responseStatus || 0) < 400
                          ? "text-green-600"
                          : "text-red-600"
                      }`}
                    >
                      {log.responseStatus || "—"}
                    </span>
                  </Td>
                  <Td className="text-gray-500 text-xs whitespace-nowrap">
                    {log.timeTaken ? `${log.timeTaken}ms` : "—"}
                  </Td>
                  <Td className="text-xs text-gray-400">
                    {expandedId === log._id ? "▲" : "▼"}
                  </Td>
                </TR>
                {expandedId === log._id && (
                  <tr>
                    <td colSpan={9} className="px-6 py-4 bg-gray-50 text-sm">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <span className="text-xs text-gray-400">IP</span>
                          <p className="text-gray-700 font-mono text-xs">
                            {log.ip || "—"}
                          </p>
                        </div>
                        <div>
                          <span className="text-xs text-gray-400">
                            Full Path
                          </span>
                          <p className="text-gray-700 font-mono text-xs break-all">
                            {log.path}
                          </p>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))
          )}
        </TBody>
      </Table>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
          >
            ← Prev
          </Button>
          <span className="text-sm text-gray-600">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
          >
            Next →
          </Button>
        </div>
      )}
    </div>
  );
};

export default ActivityLogsManagement;
