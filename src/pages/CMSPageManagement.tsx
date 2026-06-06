import React, { useEffect, useState, useRef, useMemo } from "react";
import ReactQuill, { Quill } from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";
import { Pencil, Trash2 } from "lucide-react";
import ImageResize from "../components/QuillImageResize";
import { cmsApi } from "../services/admin-api";
import Pagination from "../components/Pagination";
import {
  PageHeader,
  Button,
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
  Select,
  Alert,
} from "../components/ui";

// Extend Image blot to preserve width/height/style for resize
const BaseImageCms = Quill.import("formats/image") as any;
class ResizableImageCms extends BaseImageCms {
  static formats(domNode: HTMLElement) {
    const formats = super.formats(domNode);
    for (const attr of ["style", "width", "height"]) {
      if (domNode.hasAttribute(attr)) formats[attr] = domNode.getAttribute(attr);
    }
    return formats;
  }
  format(name: string, value: any) {
    if (["style", "width", "height"].includes(name)) {
      if (value) this.domNode.setAttribute(name, value);
      else this.domNode.removeAttribute(name);
    } else {
      super.format(name, value);
    }
  }
}
ResizableImageCms.blotName = "image";
ResizableImageCms.tagName = "IMG";

Quill.register(ResizableImageCms, true);
Quill.register("modules/imageResize", ImageResize);

interface CmsPageItem {
  _id: string;
  slug: string;
  title: string;
  content: string;
  isActive: boolean;
  updatedBy?: { name: string; email: string };
  updatedAt: string;
}

const SLUG_OPTIONS = [
  { value: "terms-and-conditions", label: "Terms & Conditions" },
  { value: "privacy-policy", label: "Privacy Policy" },
  { value: "refund-policy", label: "Refund Policy" },
  { value: "about-us", label: "About Us" },
  { value: "disclaimer", label: "Disclaimer" },
  // Website navbar pages (Business / Health Card / Financial Services tabs).
  // The public site fetches these by slug at /cms/<slug>.
  { value: "business", label: "Business" },
  { value: "health-card", label: "Health Card" },
  { value: "financial-services", label: "Financial Services" },
];

const emptyCms = { slug: "", title: "", content: "", isActive: true };

const CMSPageManagement: React.FC = () => {
  const [pages, setPages] = useState<CmsPageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState(emptyCms);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const quillRef = useRef<any>(null);

  const imageHandler = () => {
    const input = document.createElement("input");
    input.setAttribute("type", "file");
    input.setAttribute("accept", "image/*");
    input.click();

    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const res = await cmsApi.uploadImage(file);
        const url = res.data?.url;
        if (url) {
          const quill = quillRef.current?.getEditor();
          if (quill) {
            const range = quill.getSelection(true);
            quill.insertEmbed(range.index, "image", url);
            quill.setSelection(range.index + 1);
          }
        }
      } catch (err: any) {
        alert("Image upload failed: " + (err.message || "Unknown error"));
      }
    };
  };

  const modules = useMemo(
    () => ({
      toolbar: {
        container: [
          [{ header: [1, 2, 3, 4, 5, 6, false] }],
          [{ font: [] }],
          [{ size: ["small", false, "large", "huge"] }],
          ["bold", "italic", "underline", "strike"],
          [{ color: [] }, { background: [] }],
          [{ align: [] }],
          [{ list: "ordered" }, { list: "bullet" }],
          [{ indent: "-1" }, { indent: "+1" }],
          ["blockquote", "code-block"],
          ["link", "image"],
          ["clean"],
        ],
        handlers: {
          image: imageHandler,
        },
      },
      imageResize: true,
    }),
    [],
  );

  const formats = [
    "header",
    "font",
    "size",
    "bold",
    "italic",
    "underline",
    "strike",
    "color",
    "background",
    "align",
    "list",
    "indent",
    "blockquote",
    "code-block",
    "link",
    "image",
    "width",
    "height",
    "style",
  ];

  const loadPages = async () => {
    try {
      setLoading(true);
      const params: Record<string, string> = {
        page: String(page),
        limit: "20",
      };
      const res = await cmsApi.getAll(params);
      const d = res.data;
      if (d?.items) {
        setPages(d.items);
        setTotalPages(d.pagination?.pages || 1);
        setTotal(d.pagination?.total || 0);
      } else {
        setPages(d || []);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPages();
  }, [page]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const plainText = form.content.replace(/<[^>]*>/g, "").trim();
    if (!form.slug.trim() || !form.title.trim() || !plainText) {
      setError("Slug, Title, and Content are required");
      return;
    }

    try {
      if (editingId) await cmsApi.update(editingId, form);
      else await cmsApi.create(form);
      setForm(emptyCms);
      setEditingId(null);
      setShowForm(false);
      loadPages();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleEdit = (page: CmsPageItem) => {
    setForm({
      slug: page.slug,
      title: page.title,
      content: page.content,
      isActive: page.isActive,
    });
    setEditingId(page._id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this CMS page?")) return;
    try {
      await cmsApi.remove(id);
      loadPages();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleCancel = () => {
    setForm(emptyCms);
    setEditingId(null);
    setShowForm(false);
  };

  return (
    <div className="p-6">
      <PageHeader
        title="CMS Management"
        subtitle={`${total || pages.length} page(s) configured`}
        actions={<Button onClick={() => setShowForm(true)}>+ Add Page</Button>}
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

      <Table>
        <THead>
          <Th>Title</Th>
          <Th>Slug</Th>
          <Th>Last Updated</Th>
          <Th>Status</Th>
          <Th className="text-right">Actions</Th>
        </THead>
        <TBody>
          {loading ? (
            <TableState colSpan={5}>Loading…</TableState>
          ) : pages.length === 0 ? (
            <TableState colSpan={5}>
              No CMS pages found. Create one to get started.
            </TableState>
          ) : (
            pages.map((p) => (
              <TR key={p._id}>
                <Td className="font-medium text-gray-900">{p.title}</Td>
                <Td className="text-gray-500">/{p.slug}</Td>
                <Td className="text-gray-500">
                  {p.updatedAt
                    ? `${p.updatedBy?.name ? `${p.updatedBy.name} · ` : ""}${new Date(
                        p.updatedAt,
                      ).toLocaleDateString()}`
                    : "—"}
                </Td>
                <Td>
                  <Badge tone={p.isActive ? "success" : "danger"} dot>
                    {p.isActive ? "Active" : "Inactive"}
                  </Badge>
                </Td>
                <Td className="text-right whitespace-nowrap">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="px-2"
                    title="Edit"
                    aria-label="Edit"
                    onClick={() => handleEdit(p)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="px-2 text-red-600 hover:bg-red-50 hover:text-red-700"
                    title="Delete"
                    aria-label="Delete"
                    onClick={() => handleDelete(p._id)}
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
        label="pages"
        onPageChange={setPage}
      />

      <Modal
        open={showForm}
        onClose={handleCancel}
        title={editingId ? "Edit CMS Page" : "Add CMS Page"}
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
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Slug *">
              {editingId ? (
                <Input type="text" value={form.slug} readOnly />
              ) : (
                <Select
                  value={form.slug}
                  onChange={(e) => {
                    const opt = SLUG_OPTIONS.find(
                      (o) => o.value === e.target.value,
                    );
                    setForm({
                      ...form,
                      slug: e.target.value,
                      title: opt?.label || form.title,
                    });
                  }}
                  required
                >
                  <option value="">Select Page Type</option>
                  {SLUG_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Title *">
              <Input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
              />
            </Field>
          </div>
          <Field label="Content *">
            <div className="border border-gray-300 rounded-lg overflow-hidden">
              <ReactQuill
                ref={quillRef}
                theme="snow"
                value={form.content}
                onChange={(value: string) =>
                  setForm({ ...form, content: value })
                }
                modules={modules}
                formats={formats}
                placeholder="Write your content here..."
                style={{ minHeight: "300px" }}
              />
            </div>
          </Field>
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

      <style>{`
        .ql-editor {
          min-height: 300px;
          font-size: 15px;
          line-height: 1.6;
        }
        .ql-editor img {
          max-width: 100%;
          height: auto;
          border-radius: 8px;
          margin: 12px 0;
        }
        .ql-toolbar.ql-snow {
          border-top-left-radius: 8px;
          border-top-right-radius: 8px;
          border-color: #e5e7eb;
          background: #f9fafb;
        }
        .ql-container.ql-snow {
          border-bottom-left-radius: 8px;
          border-bottom-right-radius: 8px;
          border-color: #e5e7eb;
        }
      `}</style>
    </div>
  );
};

export default CMSPageManagement;
