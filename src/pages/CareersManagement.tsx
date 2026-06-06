/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { Pencil, Power, Trash2 } from "lucide-react";
import {
  careersApi,
  stateApi,
  districtApi,
  departmentApi,
  employmentTypeApi,
} from "../services/admin-api";
import Pagination from "../components/Pagination";
import SearchableSelect from "../components/SearchableSelect";
import type { FetchResult } from "../components/SearchableSelect";
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
  Textarea,
  Alert,
} from "../components/ui";

const emptyCareer = {
  title: "",
  department: "",
  type: "",
  experience: "",
  salary: "",
  qualification: "",
  rolesAndResponsibilities: "",
  states: [] as string[],
  districts: [] as string[],
  cardColor: "#2563eb",
  isActive: true,
};

const CareersManagement: React.FC = () => {
  const [careers, setCareers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [form, setForm] = useState({ ...emptyCareer });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  // Dropdown states for department, type (from global master data)
  const [departments, setDepartments] = useState<any[]>([]);
  const [, setTypes] = useState<any[]>([]);

  // States & Districts for multi-select
  const [allStates, setAllStates] = useState<any[]>([]);
  const [allDistricts, setAllDistricts] = useState<any[]>([]);
  const [filteredDistricts, setFilteredDistricts] = useState<any[]>([]);

  // Searchable dropdown state
  const [stateSearch, setStateSearch] = useState("");
  const [districtSearch, setDistrictSearch] = useState("");
  const [stateDropdownOpen, setStateDropdownOpen] = useState(false);
  const [districtDropdownOpen, setDistrictDropdownOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const stateDropdownRef = useRef<HTMLDivElement>(null);
  const districtDropdownRef = useRef<HTMLDivElement>(null);

  const loadCareers = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = {};
      if (statusFilter !== "all") params.status = statusFilter;
      if (search.trim()) params.q = search.trim();
      if (departmentFilter !== "all") params.department = departmentFilter;
      params.page = String(page);
      params.limit = "20";
      const res = await careersApi.getAll(params);
      const d = res.data;
      if (d?.items) {
        setCareers(d.items);
        setTotalPages(d.pagination?.pages || 1);
        setTotal(d.pagination?.total || 0);
      } else {
        setCareers(d || []);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load careers");
    } finally {
      setIsLoading(false);
    }
  };

  const loadDropdowns = async () => {
    try {
      const [dRes, tRes, sRes, dtRes] = await Promise.all([
        departmentApi.getAll({ status: "active", limit: "1000" }),
        employmentTypeApi.getAll({ status: "active", limit: "1000" }),
        stateApi.getAll({ status: "active", limit: "1000" }),
        districtApi.getAll({ status: "active", limit: "1000" }),
      ]);
      setDepartments(dRes.data?.items || dRes.data || []);
      setTypes(tRes.data?.items || tRes.data || []);
      setAllStates(sRes.data?.items || sRes.data || []);
      setAllDistricts(dtRes.data?.items || dtRes.data || []);
    } catch {
      // silently fail
    }
  };

  const fetchDepartments = useCallback(
    async (params: { q: string; page: number; limit: number }): Promise<FetchResult> => {
      const res = await departmentApi.getAll({
        status: "active",
        ...(params.q && { q: params.q }),
        page: String(params.page),
        limit: String(params.limit),
      });
      const items = res.data?.items || res.data || [];
      const totalPages = res.data?.pagination?.pages || 1;
      return { items, hasMore: params.page < totalPages };
    },
    []
  );

  const fetchEmploymentTypes = useCallback(
    async (params: { q: string; page: number; limit: number }): Promise<FetchResult> => {
      const res = await employmentTypeApi.getAll({
        status: "active",
        ...(params.q && { q: params.q }),
        page: String(params.page),
        limit: String(params.limit),
      });
      const items = res.data?.items || res.data || [];
      const totalPages = res.data?.pagination?.pages || 1;
      return { items, hasMore: params.page < totalPages };
    },
    []
  );

  // Filter districts by selected states
  useEffect(() => {
    if (form.states.length === 0) {
      setFilteredDistricts(allDistricts);
    } else {
      setFilteredDistricts(
        allDistricts.filter((d: any) =>
          form.states.includes(d.state?._id || d.state),
        ),
      );
    }
  }, [form.states, allDistricts]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        stateDropdownRef.current &&
        !stateDropdownRef.current.contains(e.target as Node)
      ) {
        setStateDropdownOpen(false);
      }
      if (
        districtDropdownRef.current &&
        !districtDropdownRef.current.contains(e.target as Node)
      ) {
        setDistrictDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    loadDropdowns();
  }, []);

  useEffect(() => {
    loadCareers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, departmentFilter, page]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, departmentFilter, search]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (
      !form.title.trim() ||
      !form.department.trim() ||
      !form.type.trim() ||
      !form.experience.trim() ||
      !form.qualification.trim()
    ) {
      setError(
        "Title, Department, Type, Experience, and Qualification are required",
      );
      return;
    }

    try {
      const payload = {
        ...form,
        rolesAndResponsibilities: form.rolesAndResponsibilities
          .split("\n")
          .map((r: string) => r.trim())
          .filter(Boolean),
      };

      if (editingId) {
        await careersApi.update(editingId, payload);
      } else {
        await careersApi.create(payload);
      }

      setForm({ ...emptyCareer });
      setEditingId(null);
      setShowForm(false);
      await loadCareers();
    } catch (err: any) {
      setError(err.message || "Failed to save career");
    }
  };

  const handleEdit = (career: any) => {
    setEditingId(career._id);
    setForm({
      title: career.title || "",
      department: career.department || "",
      type: career.type || "",
      experience: career.experience || "",
      salary: career.salary || "",
      qualification: career.qualification || "",
      rolesAndResponsibilities: (career.rolesAndResponsibilities || []).join(
        "\n",
      ),
      states: (career.states || []).map((s: any) =>
        typeof s === "string" ? s : s._id,
      ),
      districts: (career.districts || []).map((d: any) =>
        typeof d === "string" ? d : d._id,
      ),
      cardColor: career.cardColor || "#2563eb",
      isActive: Boolean(career.isActive),
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this career?")) return;
    setError(null);
    try {
      await careersApi.remove(id);
      await loadCareers();
    } catch (err: any) {
      setError(err.message || "Failed to delete career");
    }
  };

  const handleToggleStatus = async (career: any) => {
    setError(null);
    try {
      await careersApi.update(career._id, { isActive: !career.isActive });
      await loadCareers();
    } catch (err: any) {
      setError(err.message || "Failed to update status");
    }
  };

  const handleCancel = () => {
    setEditingId(null);
    setForm({ ...emptyCareer });
    setShowForm(false);
  };

  const statusLabel = useMemo(() => {
    if (statusFilter === "active") return "Active";
    if (statusFilter === "inactive") return "Inactive";
    return "All";
  }, [statusFilter]);

  return (
    <div className="p-6">
      <PageHeader
        title="Careers"
        subtitle={`Manage website job openings • ${statusLabel} • ${total || careers.length} total`}
        actions={<Button onClick={() => setShowForm(true)}>+ Add Career</Button>}
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
          placeholder="Search by title or department"
          className="w-full max-w-xs"
        />
        <Button variant="secondary" onClick={loadCareers}>
          Search
        </Button>
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-auto"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </Select>
        <Select
          value={departmentFilter}
          onChange={(e) => setDepartmentFilter(e.target.value)}
          className="w-auto"
        >
          <option value="all">All Departments</option>
          {departments.map((d: any) => (
            <option key={d._id} value={d.name}>
              {d.name}
            </option>
          ))}
        </Select>
      </div>

      <Table>
        <THead>
          <Th>Title</Th>
          <Th>Department</Th>
          <Th>Type</Th>
          <Th>Salary</Th>
          <Th>Locations</Th>
          <Th>Status</Th>
          <Th className="text-right">Actions</Th>
        </THead>
        <TBody>
          {isLoading ? (
            <TableState colSpan={7}>Loading…</TableState>
          ) : careers.length === 0 ? (
            <TableState colSpan={7}>No careers found.</TableState>
          ) : (
            careers.map((career) => (
              <TR key={career._id}>
                <Td>
                  <span className="flex items-center gap-2">
                    <span
                      className="inline-block h-3 w-3 shrink-0 rounded-full"
                      style={{ backgroundColor: career.cardColor || "#2563eb" }}
                    />
                    <span className="font-medium text-gray-900">
                      {career.title}
                    </span>
                  </span>
                </Td>
                <Td className="text-gray-500">{career.department}</Td>
                <Td className="text-gray-500">{career.type}</Td>
                <Td className="text-gray-500">{career.salary || "—"}</Td>
                <Td>
                  {((career.states && career.states.length > 0) ||
                  (career.districts && career.districts.length > 0)) ? (
                    <div className="flex flex-wrap gap-1">
                      {(career.states || []).map((s: any) => (
                        <Badge key={s._id || s} tone="info">
                          {s.name || s}
                        </Badge>
                      ))}
                      {(career.districts || []).map((d: any) => (
                        <Badge key={d._id || d} tone="success">
                          {d.name || d}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </Td>
                <Td>
                  <Badge tone={career.isActive ? "success" : "neutral"} dot>
                    {career.isActive ? "Active" : "Inactive"}
                  </Badge>
                </Td>
                <Td className="text-right whitespace-nowrap">
                  <Button size="sm" variant="ghost" className="px-2" title="Edit" aria-label="Edit" onClick={() => handleEdit(career)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="px-2"
                    title={career.isActive ? "Deactivate" : "Activate"}
                    aria-label={career.isActive ? "Deactivate" : "Activate"}
                    onClick={() => handleToggleStatus(career)}
                  >
                    <Power className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="px-2 text-red-600 hover:bg-red-50 hover:text-red-700"
                    title="Delete"
                    aria-label="Delete"
                    onClick={() => handleDelete(career._id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
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
        label="careers"
        onPageChange={setPage}
      />

      <Modal
        open={showForm}
        onClose={handleCancel}
        title={editingId ? "Edit Career" : "New Career"}
        size="xl"
        footer={
          <>
            <Button variant="secondary" onClick={handleCancel}>
              Cancel
            </Button>
            <Button onClick={handleSubmit}>
              {editingId ? "Update" : "Create"}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Title">
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Job title"
              required
            />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Department dropdown (global) */}
            <div>
              <SearchableSelect
                label="Department"
                value={form.department}
                onChange={(e) => setForm({ ...form, department: e })}
                fetchOptions={fetchDepartments}
                placeholder="Search department..."
                required
              />
            </div>
            {/* Type dropdown (global) */}
            <div>
              <SearchableSelect
                label="Type (Full-time, Part-time, etc.)"
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e })}
                fetchOptions={fetchEmploymentTypes}
                placeholder="Search type..."
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Experience">
              <Input
                value={form.experience}
                onChange={(e) =>
                  setForm({ ...form, experience: e.target.value })
                }
                placeholder="e.g. 2-3 years"
                required
              />
            </Field>
            <Field label="Salary (optional)">
              <Input
                value={form.salary}
                onChange={(e) => setForm({ ...form, salary: e.target.value })}
                placeholder="e.g. ₹20,000 - ₹30,000"
              />
            </Field>
          </div>
          <Field label="Qualification">
            <Textarea
              value={form.qualification}
              onChange={(e) =>
                setForm({ ...form, qualification: e.target.value })
              }
              placeholder="Enter qualification details"
              rows={4}
              required
            />
          </Field>
          <Field label="Roles & Responsibilities">
            <Textarea
              value={form.rolesAndResponsibilities}
              onChange={(e) =>
                setForm({ ...form, rolesAndResponsibilities: e.target.value })
              }
              placeholder="One per line"
              rows={4}
            />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* States searchable dropdown */}
          <div ref={stateDropdownRef}>
            <label className="block mb-1 text-xs font-medium text-gray-600">
              States
            </label>
            {form.states.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {form.states.map((sId: string) => {
                  const st = allStates.find((s: any) => s._id === sId);
                  return st ? (
                    <span
                      key={sId}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 text-xs font-medium rounded-full"
                    >
                      {st.name}
                      <button
                        type="button"
                        onClick={() => {
                          const newStates = form.states.filter(
                            (id: string) => id !== sId,
                          );
                          const validDistricts = form.districts.filter(
                            (dId: string) => {
                              const dist = allDistricts.find(
                                (d: any) => d._id === dId,
                              );
                              return (
                                dist &&
                                newStates.includes(
                                  dist.state?._id || dist.state,
                                )
                              );
                            },
                          );
                          setForm({
                            ...form,
                            states: newStates,
                            districts: validDistricts,
                          });
                        }}
                        className="font-bold leading-none hover:text-blue-900"
                      >
                        ×
                      </button>
                    </span>
                  ) : null;
                })}
              </div>
            )}
            <div className="relative">
              <input
                type="text"
                value={stateSearch}
                onChange={(e) => {
                  setStateSearch(e.target.value);
                  setStateDropdownOpen(true);
                }}
                onFocus={() => setStateDropdownOpen(true)}
                placeholder="Search states..."
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-healwin-500 focus:outline-none"
              />
              {stateDropdownOpen && (
                <div className="absolute z-20 w-full mt-1 overflow-y-auto bg-white border rounded-lg shadow-lg max-h-48">
                  {allStates
                    .filter((s: any) =>
                      s.name.toLowerCase().includes(stateSearch.toLowerCase()),
                    )
                    .map((s: any) => {
                      const isSelected = form.states.includes(s._id);
                      return (
                        <button
                          key={s._id}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              const newStates = form.states.filter(
                                (id: string) => id !== s._id,
                              );
                              const validDistricts = form.districts.filter(
                                (dId: string) => {
                                  const dist = allDistricts.find(
                                    (d: any) => d._id === dId,
                                  );
                                  return (
                                    dist &&
                                    newStates.includes(
                                      dist.state?._id || dist.state,
                                    )
                                  );
                                },
                              );
                              setForm({
                                ...form,
                                states: newStates,
                                districts: validDistricts,
                              });
                            } else {
                              setForm({
                                ...form,
                                states: [...form.states, s._id],
                              });
                            }
                            setStateSearch("");
                          }}
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 ${
                            isSelected ? "bg-blue-50 text-blue-700" : ""
                          }`}
                        >
                          <span
                            className={`w-4 h-4 rounded border flex items-center justify-center text-xs ${
                              isSelected
                                ? "bg-blue-500 border-blue-500 text-white"
                                : "border-gray-300"
                            }`}
                          >
                            {isSelected && "✓"}
                          </span>
                          {s.name}
                        </button>
                      );
                    })}
                  {allStates.filter((s: any) =>
                    s.name.toLowerCase().includes(stateSearch.toLowerCase()),
                  ).length === 0 && (
                    <div className="px-3 py-2 text-sm text-gray-400">
                      No states found
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          {/* Districts searchable dropdown */}
          <div ref={districtDropdownRef}>
            <label className="block mb-1 text-xs font-medium text-gray-600">
              Districts
            </label>
            {form.districts.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {form.districts.map((dId: string) => {
                  const dt = allDistricts.find((d: any) => d._id === dId);
                  return dt ? (
                    <span
                      key={dId}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-50 text-green-700 text-xs font-medium rounded-full"
                    >
                      {dt.name}
                      <button
                        type="button"
                        onClick={() => {
                          setForm({
                            ...form,
                            districts: form.districts.filter(
                              (id: string) => id !== dId,
                            ),
                          });
                        }}
                        className="font-bold leading-none hover:text-green-900"
                      >
                        ×
                      </button>
                    </span>
                  ) : null;
                })}
              </div>
            )}
            <div className="relative">
              <input
                type="text"
                value={districtSearch}
                onChange={(e) => {
                  setDistrictSearch(e.target.value);
                  setDistrictDropdownOpen(true);
                }}
                onFocus={() => setDistrictDropdownOpen(true)}
                placeholder={
                  form.states.length === 0
                    ? "Select states first..."
                    : "Search districts..."
                }
                disabled={form.states.length === 0}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-healwin-500 focus:outline-none disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
              {districtDropdownOpen && form.states.length > 0 && (
                <div className="absolute z-20 w-full mt-1 overflow-y-auto bg-white border rounded-lg shadow-lg max-h-48">
                  {filteredDistricts
                    .filter((d: any) =>
                      d.name
                        .toLowerCase()
                        .includes(districtSearch.toLowerCase()),
                    )
                    .map((d: any) => {
                      const isSelected = form.districts.includes(d._id);
                      return (
                        <button
                          key={d._id}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              setForm({
                                ...form,
                                districts: form.districts.filter(
                                  (id: string) => id !== d._id,
                                ),
                              });
                            } else {
                              setForm({
                                ...form,
                                districts: [...form.districts, d._id],
                              });
                            }
                            setDistrictSearch("");
                          }}
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 ${
                            isSelected ? "bg-green-50 text-green-700" : ""
                          }`}
                        >
                          <span
                            className={`w-4 h-4 rounded border flex items-center justify-center text-xs ${
                              isSelected
                                ? "bg-green-500 border-green-500 text-white"
                                : "border-gray-300"
                            }`}
                          >
                            {isSelected && "✓"}
                          </span>
                          {d.name}
                        </button>
                      );
                    })}
                  {filteredDistricts.filter((d: any) =>
                    d.name.toLowerCase().includes(districtSearch.toLowerCase()),
                  ).length === 0 && (
                    <div className="px-3 py-2 text-sm text-gray-400">
                      {form.states.length > 0
                        ? "No districts found"
                        : "Select states first"}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          </div>
          <div>
            <label className="block mb-1 text-xs font-medium text-gray-600">
              Card Color
            </label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={form.cardColor}
                onChange={(e) =>
                  setForm({ ...form, cardColor: e.target.value })
                }
                className="w-10 h-10 p-0.5 border rounded-lg cursor-pointer"
              />
              <div className="flex flex-wrap gap-1.5">
                {[
                  "#ef4444",
                  "#2563eb",
                  "#06b6d4",
                  "#8b5cf6",
                  "#10b981",
                  "#f59e0b",
                  "#ec4899",
                  "#64748b",
                ].map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setForm({ ...form, cardColor: c })}
                    className={`w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 ${
                      form.cardColor === c
                        ? "border-gray-800 scale-110"
                        : "border-transparent"
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
            />
            Active
          </label>
        </form>
      </Modal>
    </div>
  );
};

export default CareersManagement;
