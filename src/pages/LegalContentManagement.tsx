import React, { useEffect, useMemo, useState } from "react";
import { legalContentApi } from "../services/admin-api";
import {
  PageHeader,
  Button,
  Card,
  Badge,
  Alert,
  Field,
  Input,
  Textarea,
  cn,
} from "../components/ui";

type DocType = "ABOUT" | "PRIVACY" | "TERMS";
type Audience = "PATIENT" | "DRIVER";

interface Cell {
  type: DocType;
  audience: Audience;
  title: string;
  content: string;
  version: number;
  updatedAt: string | null;
  updatedBy?: { name?: string; email?: string } | null;
  exists: boolean;
}

const DOC_TYPES: { id: DocType; label: string; subtitle: string }[] = [
  { id: "ABOUT", label: "About Us", subtitle: "Company / app overview" },
  {
    id: "PRIVACY",
    label: "Privacy Policy",
    subtitle: "How user data is collected & used",
  },
  {
    id: "TERMS",
    label: "Terms & Conditions",
    subtitle: "Legal terms users agree to",
  },
];

const AUDIENCES: { id: Audience; label: string }[] = [
  { id: "PATIENT", label: "Patient app" },
  { id: "DRIVER", label: "Driver app" },
];

const cellKey = (type: DocType, audience: Audience) => `${type}:${audience}`;

const formatDate = (iso: string | null) => {
  if (!iso) return "Never";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
};

const LegalContentManagement: React.FC = () => {
  const [cells, setCells] = useState<Record<string, Cell>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [activeType, setActiveType] = useState<DocType>("ABOUT");
  const [activeAudience, setActiveAudience] = useState<Audience>("PATIENT");

  // Local editor state — what's in the textareas right now. Persisted to
  // the backend on Save; reset to server values on tab switch + post-save.
  const [draftTitle, setDraftTitle] = useState("");
  const [draftContent, setDraftContent] = useState("");

  const activeCell = useMemo(
    () => cells[cellKey(activeType, activeAudience)],
    [cells, activeType, activeAudience],
  );

  const dirty = useMemo(() => {
    if (!activeCell) return draftTitle !== "" || draftContent !== "";
    return (
      draftTitle !== (activeCell.title ?? "") ||
      draftContent !== (activeCell.content ?? "")
    );
  }, [activeCell, draftTitle, draftContent]);

  const loadAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await legalContentApi.list();
      const items: Cell[] = res?.data?.items || [];
      const map: Record<string, Cell> = {};
      for (const it of items) {
        map[cellKey(it.type, it.audience)] = it;
      }
      setCells(map);
    } catch (e: any) {
      setError(e?.message || "Failed to load legal documents");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  // Whenever the active cell changes (tab switch or after reload), reseat
  // the draft so the editor reflects the server state for that slot.
  useEffect(() => {
    setDraftTitle(activeCell?.title ?? "");
    setDraftContent(activeCell?.content ?? "");
  }, [activeCell?.title, activeCell?.content, activeType, activeAudience]);

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await legalContentApi.update(activeType, activeAudience, {
        title: draftTitle,
        content: draftContent,
      });
      const updated: Cell = {
        type: activeType,
        audience: activeAudience,
        title: res?.data?.title ?? draftTitle,
        content: res?.data?.content ?? draftContent,
        version: res?.data?.version ?? (activeCell?.version ?? 0) + 1,
        updatedAt: res?.data?.updatedAt ?? new Date().toISOString(),
        updatedBy: res?.data?.updatedBy ?? null,
        exists: true,
      };
      setCells((prev) => ({
        ...prev,
        [cellKey(activeType, activeAudience)]: updated,
      }));
      setSuccess(
        `${DOC_TYPES.find((t) => t.id === activeType)?.label} for ` +
          `${AUDIENCES.find((a) => a.id === activeAudience)?.label} saved.`,
      );
      setTimeout(() => setSuccess(null), 3500);
    } catch (e: any) {
      setError(e?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-gray-500">Loading…</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <PageHeader
        title="Legal Content"
        subtitle="Manage the About, Privacy Policy and Terms & Conditions text shown inside the Patient and Driver apps. Each document has a separate version for each audience."
      />

      {error && (
        <Alert className="mb-4" tone="danger">
          <span className="flex items-center justify-between gap-4">
            {error}
            <button onClick={() => setError(null)} className="font-bold">
              ✕
            </button>
          </span>
        </Alert>
      )}
      {success && (
        <Alert className="mb-4" tone="success">
          {success}
        </Alert>
      )}

      {/* Document-type tabs */}
      <div className="flex gap-1 mb-3 bg-gray-100 p-1 rounded-lg overflow-x-auto">
        {DOC_TYPES.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveType(t.id)}
            className={cn(
              "flex-1 px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors",
              activeType === t.id
                ? "bg-white text-healwin-600 shadow-sm"
                : "text-gray-600 hover:text-gray-800",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Audience tabs */}
      <div className="flex gap-2 mb-6">
        {AUDIENCES.map((a) => {
          const cell = cells[cellKey(activeType, a.id)];
          const isActive = activeAudience === a.id;
          return (
            <button
              key={a.id}
              onClick={() => setActiveAudience(a.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-colors",
                isActive
                  ? "bg-healwin-600 text-white border-healwin-600"
                  : "bg-white text-gray-700 border-gray-200 hover:border-healwin-400",
              )}
            >
              {a.label}
              {isActive ? (
                <span className="inline-block text-xs px-1.5 py-0.5 rounded bg-white/25">
                  {cell?.exists ? `v${cell.version}` : "Not set"}
                </span>
              ) : (
                <Badge tone={cell?.exists ? "success" : "neutral"}>
                  {cell?.exists ? `v${cell.version}` : "Not set"}
                </Badge>
              )}
            </button>
          );
        })}
      </div>

      {/* Editor */}
      <Card className="p-6 space-y-4">
        <div className="flex justify-between items-start mb-2">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">
              {DOC_TYPES.find((t) => t.id === activeType)?.label} —{" "}
              {AUDIENCES.find((a) => a.id === activeAudience)?.label}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {DOC_TYPES.find((t) => t.id === activeType)?.subtitle}
            </p>
          </div>
          <div className="text-xs text-gray-500 text-right">
            <div>Last updated: {formatDate(activeCell?.updatedAt ?? null)}</div>
            {activeCell?.updatedBy?.name && (
              <div>By: {activeCell.updatedBy.name}</div>
            )}
          </div>
        </div>

        <Field label="Title (optional — shown as a header in the app)">
          <Input
            type="text"
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
            placeholder={`e.g. ${DOC_TYPES.find((t) => t.id === activeType)?.label}`}
          />
        </Field>

        <Field
          label="Content"
          hint="Plain text + basic Markdown. The apps render this with a Markdown viewer so headings, bullets and links display correctly."
        >
          <Textarea
            value={draftContent}
            onChange={(e) => setDraftContent(e.target.value)}
            rows={22}
            placeholder={
              "Write the content shown in the app. Basic Markdown is supported:\n" +
              "\n# Heading\n## Subheading\n- Bullet point\n**bold** *italic*\n\n[Link text](https://example.com)"
            }
            className="font-mono"
          />
        </Field>

        <div className="flex justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setDraftTitle(activeCell?.title ?? "");
              setDraftContent(activeCell?.content ?? "");
            }}
            disabled={!dirty || saving}
          >
            Revert
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={!dirty || saving}
          >
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default LegalContentManagement;
