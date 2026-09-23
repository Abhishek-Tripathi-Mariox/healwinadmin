import { useCallback, useEffect, useState } from "react";
import { Search } from "lucide-react";
import { firstAidApi } from "../services/admin-api";
import Pagination from "../components/Pagination";
import {
  PageHeader, Button, Select, Table, THead, TBody, TR, Th, Td, TableState, Badge,
  Modal, Field, Input, Alert,
} from "../components/ui";
import { dialog } from "../services/dialog";

export default function FirstAidManagement() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState<any | null>(null);
  const [form, setForm] = useState<any>({ title: "", category: "", type: "video", videoUrl: "", content: "", durationLabel: "", sortOrder: 0, isActive: true });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  // What's actually queried: typing shouldn't fire a request per keystroke.
  const [searchQuery, setSearchQuery] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, limit };
      if (searchQuery.trim()) params.search = searchQuery.trim();
      const res = await firstAidApi.list(params);
      setRows(res.data?.items || []);
      setTotal(res.data?.pagination?.total || 0);
    }
    finally { setLoading(false); }
  }, [page, limit, searchQuery]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const t = setTimeout(() => setSearchQuery(search), 300);
    return () => clearTimeout(t);
  }, [search]);
  useEffect(() => { setPage(1); }, [searchQuery, limit]);

  const openNew = () => { setForm({ title: "", category: "", type: "video", videoUrl: "", content: "", durationLabel: "", sortOrder: 0, isActive: true }); setError(""); setModal({}); };
  const openEdit = (g: any) => { setForm({ ...g }); setError(""); setModal(g); };

  const save = async () => {
    if (!form.title?.trim()) { setError("Title is required"); return; }
    setSaving(true); setError("");
    try {
      if (modal?._id) await firstAidApi.update(modal._id, form);
      else await firstAidApi.create(form);
      setModal(null); load();
    } catch (e: any) { setError(e.message || "Failed"); } finally { setSaving(false); }
  };
  const remove = async (id: string) => { if (await dialog.confirm({ message: "Delete this guide?", confirmLabel: "Delete", tone: "danger" })) { await firstAidApi.remove(id); load(); } };

  return (
    <div className="p-6">
      <PageHeader title="First Aid & Emergency Guides" subtitle="Videos & quick guides shown in the patient app"
        actions={<><Button variant="secondary" onClick={load}>Refresh</Button><Button onClick={openNew}>+ Guide</Button></>} />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            className="w-64 pl-9"
            placeholder="Title or category…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select
          value={String(limit)}
          onChange={(e) => setLimit(Number(e.target.value))}
          className="w-32"
          aria-label="Rows per page"
        >
          {[25, 50, 100].map((n) => (
            <option key={n} value={n}>{n} / page</option>
          ))}
        </Select>
        <span className="text-sm text-gray-500">{total} guide(s)</span>
      </div>

      <Table>
        <THead><Th>Title</Th><Th>Category</Th><Th>Type</Th><Th>Status</Th><Th className="text-right">Actions</Th></THead>
        <TBody>
          {loading && rows.length === 0 ? <TableState colSpan={5}>Loading…</TableState>
            : rows.length === 0 ? <TableState colSpan={5}>{searchQuery.trim() ? "No guides match this search." : "No guides yet."}</TableState>
            : rows.map((g) => (
              <TR key={g._id}>
                <Td className="font-medium text-gray-900">{g.title}</Td>
                <Td className="text-gray-500">{g.category || "—"}</Td>
                <Td><Badge tone={g.type === "video" ? "danger" : "info"}>{g.type}</Badge></Td>
                <Td><Badge tone={g.isActive ? "success" : "neutral"}>{g.isActive ? "Active" : "Hidden"}</Badge></Td>
                <Td className="text-right whitespace-nowrap">
                  <Button size="sm" variant="secondary" onClick={() => openEdit(g)}>Edit</Button>
                  <Button size="sm" variant="ghost" className="text-red-600 hover:bg-red-50" onClick={() => remove(g._id)}>Delete</Button>
                </Td>
              </TR>
            ))}
        </TBody>
      </Table>

      <div className="mt-4">
        <Pagination
          page={page}
          totalPages={Math.max(1, Math.ceil(total / limit))}
          total={total}
          label="guides"
          onPageChange={setPage}
        />
      </div>

      <Modal open={!!modal} onClose={() => setModal(null)} title={modal?._id ? "Edit Guide" : "Add Guide"}
        footer={<><Button variant="secondary" onClick={() => setModal(null)}>Cancel</Button><Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button></>}>
        <div className="space-y-3">
          {error && <Alert tone="danger">{error}</Alert>}
          <Field label="Title *"><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Category"><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="CPR / Bleeding / Burns" /></Field>
            <Field label="Type">
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
                <option value="video">Video</option><option value="article">Article</option>
              </select>
            </Field>
          </div>
          {form.type === "video" ? (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Video URL"><Input value={form.videoUrl} onChange={(e) => setForm({ ...form, videoUrl: e.target.value })} placeholder="https://youtu.be/…" /></Field>
              <Field label="Duration label"><Input value={form.durationLabel} onChange={(e) => setForm({ ...form, durationLabel: e.target.value })} placeholder="3 min" /></Field>
            </div>
          ) : (
            <Field label="Content (steps)"><textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} rows={5} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" /></Field>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Sort order"><Input type="number" value={String(form.sortOrder ?? 0)} onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) || 0 })} /></Field>
            <Field label="Active">
              <select value={form.isActive ? "1" : "0"} onChange={(e) => setForm({ ...form, isActive: e.target.value === "1" })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
                <option value="1">Yes</option><option value="0">No</option>
              </select>
            </Field>
          </div>
        </div>
      </Modal>
    </div>
  );
}
