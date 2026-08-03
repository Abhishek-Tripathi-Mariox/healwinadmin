import { useCallback, useEffect, useState } from "react";
import { faqApi } from "../services/admin-api";
import { useAuth } from "../auth/useAuth";
import { PERMISSIONS } from "../auth/permissions";
import {
  PageHeader, Button, Table, THead, TBody, TR, Th, Td, TableState, Badge, Modal, Field, Input,
} from "../components/ui";

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

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems((await faqApi.list()).data?.items || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

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

  const save = async () => {
    if (!form.question.trim() || !form.answer.trim() || saving) return;
    setSaving(true);
    try {
      if (editing) await faqApi.update(editing._id, form);
      else await faqApi.create(form);
      setShowForm(false);
      load();
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (f: Faq) => {
    await faqApi.update(f._id, { isActive: !(f.isActive !== false) });
    load();
  };
  const del = async (f: Faq) => {
    if (!window.confirm("Delete this FAQ?")) return;
    await faqApi.remove(f._id);
    load();
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Help FAQs"
        subtitle="FAQs shown in the patient app's Help & Support screen"
        actions={canManage && <Button onClick={openNew}>Add FAQ</Button>}
      />

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
            <TableState colSpan={5}>No FAQs yet. Add the first one.</TableState>
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
                      <Button size="sm" variant="ghost" onClick={() => openEdit(f)}>Edit</Button>
                      <Button size="sm" variant="ghost" className="text-red-600 hover:bg-red-50" onClick={() => del(f)}>Delete</Button>
                    </>
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
        title={editing ? "Edit FAQ" : "Add FAQ"}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving || !form.question.trim() || !form.answer.trim()}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </>
        }
      >
        <div className="space-y-3 p-6">
          <Field label="Question">
            <Input value={form.question} onChange={(e) => setForm({ ...form, question: e.target.value })} placeholder="e.g. How do I cancel a booking?" />
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
