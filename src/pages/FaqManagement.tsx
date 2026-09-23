import { useCallback, useEffect, useMemo, useState } from "react";
import { Pencil, Search, Trash2 } from "lucide-react";
import { faqApi } from "../services/admin-api";
import { useAuth } from "../auth/useAuth";
import { PERMISSIONS } from "../auth/permissions";
import {
  PageHeader, Button, Select, Table, THead, TBody, TR, Th, Td, TableState, Badge, Modal, Field, Input, Alert,
} from "../components/ui";
import Pagination from "../components/Pagination";
import { dialog } from "../services/dialog";

/**
 * Manage the Help & Support FAQs shown in the patient app (Help & Support
 * screen). Add / edit / activate / delete — changes appear in the app
 * immediately (the public FAQ cache is cleared on every mutation).
 */

interface Faq {
  _id: string;
  question: string;
  answer: string;
  category?: string;
  sortOrder?: number;
  isActive?: boolean;
}

const empty = { question: "", answer: "", category: "General", sortOrder: 0, isActive: true };

export default function FaqManagement() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission(PERMISSIONS.FAQ_MANAGE);

  const [items, setItems] = useState<Faq[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Faq | null>(null);
  const [form, setForm] = useState<typeof empty>(empty);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
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
      const res = await faqApi.list(params);
      setItems(res.data?.items || []);
      setTotal(res.data?.pagination?.total || 0);
    } finally {
      setLoading(false);
    }
  }, [page, limit, searchQuery]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const t = setTimeout(() => setSearchQuery(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, limit]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  const openNew = () => {
    setEditing(null);
    setForm(empty);
    setShowForm(true);
  };
  const openEdit = (f: Faq) => {
    setEditing(f);
    setForm({
      question: f.question,
      answer: f.answer,
      category: f.category || "General",
      sortOrder: f.sortOrder || 0,
      isActive: f.isActive !== false,
    });
    setShowForm(true);
  };

  const normQuestion = (q: string) => q.trim().toLowerCase().replace(/\s+/g, " ");
  // Instant feedback against what's on screen only — the list is a page of the
  // collection now, so the backend has the final say on uniqueness.
  const isDuplicate = useMemo(
    () =>
      !!form.question.trim() &&
      items.some((f) => f._id !== editing?._id && normQuestion(f.question) === normQuestion(form.question)),
    [items, form.question, editing],
  );

  const save = async () => {
    const question = form.question.trim();
    if (!question || !form.answer.trim() || saving || isDuplicate) return;
    setSaving(true);
    setError("");
    try {
      if (editing) await faqApi.update(editing._id, form);
      else await faqApi.create(form);
      setShowForm(false);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save FAQ");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (f: Faq) => {
    await faqApi.update(f._id, { isActive: !(f.isActive !== false) });
    load();
  };
  const del = async (f: Faq) => {
    if (!await dialog.confirm({ message: "Delete this FAQ?", confirmLabel: "Delete", tone: "danger" })) return;
    await faqApi.remove(f._id);
    load();
  };

  return (
    <div className="space-y-4 p-6">
      <PageHeader
        title="Help FAQs"
        subtitle="FAQs shown in the patient app's Help & Support screen"
        actions={canManage && <Button onClick={openNew}>Add FAQ</Button>}
      />

      {error && <Alert tone="danger">{error}</Alert>}

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            className="w-64 pl-9"
            placeholder="Question, answer or category…"
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
        <span className="text-sm text-gray-500">{total} FAQ(s)</span>
      </div>

      <Table>
        <THead>
          <Th>Question</Th>
          <Th>Category</Th>
          <Th>Order</Th>
          <Th>Status</Th>
          <Th className="text-right">Actions</Th>
        </THead>
        <TBody>
          {loading && items.length === 0 ? (
            <TableState colSpan={5}>Loading…</TableState>
          ) : items.length === 0 ? (
            <TableState colSpan={5}>
              {searchQuery.trim()
                ? "No FAQs match this search."
                : "No FAQs yet. Add the first one."}
            </TableState>
          ) : (
            items.map((f) => (
              <TR key={f._id}>
                <Td className="max-w-md">
                  <div className="font-medium text-gray-900">{f.question}</div>
                  <div className="truncate text-xs text-gray-500">{f.answer}</div>
                </Td>
                <Td>{f.category || "General"}</Td>
                <Td>{f.sortOrder ?? 0}</Td>
                <Td>
                  {canManage ? (
                    <button onClick={() => toggleActive(f)}>
                      <Badge tone={f.isActive !== false ? "success" : "neutral"} dot>
                        {f.isActive !== false ? "Active" : "Hidden"}
                      </Badge>
                    </button>
                  ) : (
                    <Badge tone={f.isActive !== false ? "success" : "neutral"} dot>
                      {f.isActive !== false ? "Active" : "Hidden"}
                    </Badge>
                  )}
                </Td>
                <Td className="text-right whitespace-nowrap">
                  {canManage && (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="px-2"
                        title="Edit"
                        aria-label="Edit"
                        onClick={() => openEdit(f)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="px-2 text-red-600 hover:bg-red-50 hover:text-red-700"
                        title="Delete"
                        aria-label="Delete"
                        onClick={() => del(f)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </Td>
              </TR>
            ))
          )}
        </TBody>
      </Table>

      <Pagination page={page} totalPages={totalPages} total={total} label="FAQs" onPageChange={setPage} />

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editing ? "Edit FAQ" : "Add FAQ"}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving || !form.question.trim() || !form.answer.trim() || isDuplicate}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </>
        }
      >
        <div className="space-y-3 p-6">
          {isDuplicate && <Alert tone="danger">An FAQ with this question already exists.</Alert>}
          <Field label="Question">
            <Input
              value={form.question}
              onChange={(e) => setForm({ ...form, question: e.target.value })}
              placeholder="e.g. How do I cancel a booking?"
            />
          </Field>
          <Field label="Answer">
            <textarea
              value={form.answer}
              onChange={(e) => setForm({ ...form, answer: e.target.value })}
              rows={4}
              placeholder="The answer shown to patients…"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </Field>
          <div className="flex gap-3">
            <Field label="Category" className="flex-1">
              <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
            </Field>
            <Field label="Sort order" className="w-32">
              <Input type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })} />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
            Show in app (active)
          </label>
        </div>
      </Modal>
    </div>
  );
}
