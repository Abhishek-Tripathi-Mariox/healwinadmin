import React, { useCallback, useEffect, useState, useRef, useMemo } from "react";
import ReactQuill, { Quill } from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";
import { Eye, EyeOff, Pencil, Trash2 } from "lucide-react";
import ImageResize from "../components/QuillImageResize";
import { newsApi, categoryApi } from "../services/admin-api";
import Pagination from "../components/Pagination";
import {
  PageHeader,
  Button,
  SearchInput,
  Select,
  Card,
  Badge,
  Field,
  Input,
  Textarea,
  Alert,
} from "../components/ui";

// Extend Image blot to preserve width/height/style for resize
const BaseImage = Quill.import("formats/image") as any;
class ResizableImage extends BaseImage {
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
ResizableImage.blotName = "image";
ResizableImage.tagName = "IMG";

Quill.register(ResizableImage, true);
Quill.register("modules/imageResize", ImageResize);

interface Article {
  _id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  image: string;
  images: string[];
  category: string;
  author: string;
  readTime: string;
  isFeatured: boolean;
  isPublished: boolean;
  publishedAt: string;
  sortOrder: number;
}

const emptyArticle = {
  title: "",
  excerpt: "",
  content: "",
  category: "",
  author: "HealWin Team",
  readTime: "3 min read",
  isFeatured: false,
  isPublished: false,
};

const NewsManagement: React.FC = () => {
  const [articles, setArticles] = useState<Article[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [categories, setCategories] = useState<string[]>([]);
  const [form, setForm] = useState({ ...emptyArticle });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [total, setTotal] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const quillRef = useRef<any>(null);

  const loadArticles = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = {};
      if (statusFilter !== "all") params.status = statusFilter;
      if (search.trim()) params.q = search.trim();
      if (categoryFilter !== "all") params.category = categoryFilter;
      params.page = String(page);
      params.limit = "20";
      const res = await newsApi.getAll(params);
      const d = res.data;
      if (d?.items) {
        setArticles(d.items);
        setTotalPages(d.pagination?.pages || 1);
        setTotal(d.pagination?.total || 0);
      } else {
        setArticles(d || []);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load articles");
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, search, categoryFilter, page]);

  const loadCategories = async () => {
    try {
      const res = await categoryApi.getAll();
      const names = (res.data?.items || res.data || [])
        .filter((c: { isActive: boolean }) => c.isActive)
        .map((c: { name: string }) => c.name);
      setCategories(names);
    } catch {
      // silently fail
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  useEffect(() => {
    loadArticles();
  }, [statusFilter, categoryFilter, loadArticles]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, categoryFilter, search]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      setImageFiles((prev) => [...prev, ...files]);
      const previews = files.map((f) => URL.createObjectURL(f));
      setImagePreviews((prev) => [...prev, ...previews]);
    }
  };

  const removeNewImage = (index: number) => {
    setImageFiles((prev) => prev.filter((_, i) => i !== index));
    setImagePreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const removeExistingImage = (index: number) => {
    setExistingImages((prev) => prev.filter((_, i) => i !== index));
  };

  const quillImageHandler = () => {
    const input = document.createElement("input");
    input.setAttribute("type", "file");
    input.setAttribute("accept", "image/*");
    input.click();
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const res = await newsApi.uploadImage(file);
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

  const quillModules = useMemo(
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
          image: quillImageHandler,
        },
      },
      imageResize: true,
    }),
    [],
  );

  const quillFormats = [
    "header", "font", "size", "bold", "italic", "underline", "strike",
    "color", "background", "align", "list", "indent", "blockquote",
    "code-block", "link", "image", "width", "height", "style",
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!form.title.trim()) {
      setError("Title is required");
      return;
    }

    try {
      const fd = new FormData();
      fd.append("title", form.title);
      fd.append("excerpt", form.excerpt);
      fd.append("content", form.content);
      fd.append("category", form.category);
      fd.append("author", form.author);
      fd.append("readTime", form.readTime);
      fd.append("isFeatured", String(form.isFeatured));
      fd.append("isPublished", String(form.isPublished));
      fd.append("existingImages", JSON.stringify(existingImages));
      imageFiles.forEach((file) => fd.append("images", file));

      if (editingId) {
        await newsApi.update(editingId, fd);
      } else {
        await newsApi.create(fd);
      }

      resetForm();
      await loadArticles();
      await loadCategories();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save article");
    }
  };

  const resetForm = () => {
    setForm({ ...emptyArticle });
    setEditingId(null);
    setImageFiles([]);
    setImagePreviews([]);
    setExistingImages([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleEdit = (article: Article) => {
    setEditingId(article._id);
    setForm({
      title: article.title || "",
      excerpt: article.excerpt || "",
      content: article.content || "",
      category: article.category || "",
      author: article.author || "HealWin Team",
      readTime: article.readTime || "3 min read",
      isFeatured: Boolean(article.isFeatured),
      isPublished: Boolean(article.isPublished),
    });
    const imgs = article.images?.length ? article.images : article.image ? [article.image] : [];
    setExistingImages(imgs);
    setImageFiles([]);
    setImagePreviews([]);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this article?")) return;
    setError(null);
    try {
      await newsApi.remove(id);
      await loadArticles();
      await loadCategories();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete article");
    }
  };

  const handleTogglePublish = async (article: Article) => {
    setError(null);
    try {
      const fd = new FormData();
      fd.append("isPublished", String(!article.isPublished));
      await newsApi.update(article._id, fd);
      await loadArticles();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update article");
    }
  };

  const [view, setView] = useState<"list" | "form" | "detail">("list");
  const [detailArticle, setDetailArticle] = useState<Article | null>(null);

  const goToAdd = () => {
    resetForm();
    setView("form");
  };

  const goToEdit = (article: Article) => {
    handleEdit(article);
    setView("form");
  };

  const goToDetail = (article: Article) => {
    setDetailArticle(article);
    setView("detail");
  };

  const goToList = () => {
    resetForm();
    setDetailArticle(null);
    setView("form");
    setTimeout(() => setView("list"), 0);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    await handleSubmit(e);
    setView("list");
  };

  if (view === "detail" && detailArticle) {
    const imgs = detailArticle.images?.length ? detailArticle.images : detailArticle.image ? [detailArticle.image] : [];
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Top bar */}
        <div className="flex items-center justify-between">
          <Button variant="secondary" onClick={goToList}>
            ← Back to Articles
          </Button>
          <Button onClick={() => goToEdit(detailArticle)}>
            Edit Article
          </Button>
        </div>

        {/* Hero banner */}
        {imgs.length > 0 && (
          <Card className="overflow-hidden">
            <div className="relative w-full h-64 md:h-80 bg-gray-100">
              <img
                src={imgs[0]}
                alt={detailArticle.title}
                className="w-full h-full object-cover cursor-pointer"
                onClick={() => { setLightboxImages(imgs); setLightboxIndex(0); }}
              />
            </div>
            {imgs.length > 1 && (
              <div className="p-4 border-t bg-gray-50">
                <div className="flex gap-3 overflow-x-auto pb-1">
                  {imgs.map((url, i) => (
                    <img
                      key={i}
                      src={url}
                      alt={`Image ${i + 1}`}
                      className={`w-20 h-20 object-cover rounded-lg border-2 cursor-pointer shrink-0 transition ${
                        i === 0 ? "border-healwin-500" : "border-transparent hover:border-gray-300"
                      }`}
                      onClick={() => { setLightboxImages(imgs); setLightboxIndex(i); }}
                    />
                  ))}
                </div>
              </div>
            )}
          </Card>
        )}

        {/* Title + badges */}
        <Card className="p-6">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            {detailArticle.isFeatured && (
              <Badge tone="warning">★ Featured</Badge>
            )}
            <Badge tone={detailArticle.isPublished ? "success" : "neutral"}>
              {detailArticle.isPublished ? "Published" : "Draft"}
            </Badge>
            {detailArticle.category && (
              <Badge tone="info">{detailArticle.category}</Badge>
            )}
          </div>
          <h1 className="text-2xl font-bold text-gray-900 leading-tight">{detailArticle.title}</h1>
          {detailArticle.excerpt && (
            <p className="mt-2 text-gray-500 leading-relaxed">{detailArticle.excerpt}</p>
          )}
        </Card>

        {/* Metadata grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Author</p>
            <p className="text-sm font-semibold text-gray-800 truncate">{detailArticle.author || "—"}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Read Time</p>
            <p className="text-sm font-semibold text-gray-800">{detailArticle.readTime || "—"}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Published Date</p>
            <p className="text-sm font-semibold text-gray-800">{detailArticle.publishedAt ? new Date(detailArticle.publishedAt).toLocaleDateString() : "—"}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Slug</p>
            <p className="text-sm font-semibold text-gray-800 truncate" title={detailArticle.slug}>{detailArticle.slug || "—"}</p>
          </Card>
        </div>

        {/* Content */}
        {detailArticle.content && (
          <Card className="p-6 md:p-8">
            <h2 className="text-lg font-semibold text-gray-800 mb-4 pb-3 border-b">Article Content</h2>
            <div
              className="prose prose-sm sm:prose max-w-none text-gray-700 overflow-hidden break-words [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-lg"
              dangerouslySetInnerHTML={{ __html: detailArticle.content }}
            />
          </Card>
        )}

        {/* Image Lightbox */}
        {lightboxImages.length > 0 && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={() => setLightboxImages([])}>
            <div className="relative bg-white rounded-xl shadow-2xl max-w-3xl w-full mx-4 max-h-[90vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <button onClick={() => setLightboxImages([])} className="absolute top-3 right-3 z-10 w-8 h-8 flex items-center justify-center bg-black/50 hover:bg-black/70 text-white rounded-full text-lg">×</button>
              <div className="flex items-center justify-center bg-gray-100 p-4" style={{ minHeight: 300 }}>
                <img src={lightboxImages[lightboxIndex]} alt={`Image ${lightboxIndex + 1}`} className="max-w-full max-h-[60vh] object-contain rounded" />
              </div>
              {lightboxImages.length > 1 && (
                <>
                  <button onClick={() => setLightboxIndex((prev) => (prev - 1 + lightboxImages.length) % lightboxImages.length)} className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center bg-black/50 hover:bg-black/70 text-white rounded-full text-xl">‹</button>
                  <button onClick={() => setLightboxIndex((prev) => (prev + 1) % lightboxImages.length)} className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center bg-black/50 hover:bg-black/70 text-white rounded-full text-xl">›</button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (view === "form") {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="secondary" onClick={goToList}>
            ← Back to Articles
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">
              {editingId ? "Edit Article" : "New Article"}
            </h1>
            <p className="text-gray-500">
              {editingId ? "Update article details" : "Create a new article"}
            </p>
          </div>
        </div>

        {error && <Alert tone="danger">{error}</Alert>}

        <form
          onSubmit={handleFormSubmit}
          className="space-y-5 bg-white p-6 rounded-xl shadow-sm border"
        >
          <div className="grid md:grid-cols-2 gap-4">
            <Field label="Title *">
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Article title"
                required
              />
            </Field>
            <Field label="Category">
              <Select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                <option value="">Select Category</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <Field label="Author">
              <Input
                value={form.author}
                onChange={(e) => setForm({ ...form, author: e.target.value })}
                placeholder="Author name"
              />
            </Field>
            <Field label="Read Time">
              <Input
                value={form.readTime}
                onChange={(e) => setForm({ ...form, readTime: e.target.value })}
                placeholder="3 min read"
              />
            </Field>
          </div>

          <Field label="Excerpt">
            <Textarea
              value={form.excerpt}
              onChange={(e) => setForm({ ...form, excerpt: e.target.value })}
              placeholder="Short summary..."
              rows={3}
            />
          </Field>

          <div>
            <label className="block mb-1 text-sm font-medium text-gray-700">
              Content
            </label>
            <ReactQuill
              ref={quillRef}
              theme="snow"
              value={form.content}
              onChange={(val: string) => setForm({ ...form, content: val })}
              modules={quillModules}
              formats={quillFormats}
              placeholder="Full article content..."
              className="bg-white rounded-lg [&_.ql-editor]:min-h-[300px]"
            />
          </div>

          <div>
            <label className="block mb-1 text-sm font-medium text-gray-700">
              Cover Images
            </label>
            <input
              type="file"
              accept="image/*"
              multiple
              ref={fileInputRef}
              onChange={handleImageChange}
              className="block w-full cursor-pointer rounded-lg border border-gray-300 text-sm text-gray-600 file:mr-3 file:cursor-pointer file:border-0 file:bg-healwin-50 file:px-4 file:py-2.5 file:text-sm file:font-medium file:text-healwin-700 hover:file:bg-healwin-100"
            />
            {(existingImages.length > 0 || imagePreviews.length > 0) && (
              <div className="mt-2 flex flex-wrap gap-2">
                {existingImages.map((url, i) => (
                  <div key={`existing-${i}`} className="relative group">
                    <img
                      src={url}
                      alt={`Cover ${i + 1}`}
                      className="w-20 h-20 object-cover rounded-lg border"
                    />
                    <button
                      type="button"
                      onClick={() => removeExistingImage(i)}
                      className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      ×
                    </button>
                  </div>
                ))}
                {imagePreviews.map((url, i) => (
                  <div key={`new-${i}`} className="relative group">
                    <img
                      src={url}
                      alt={`New ${i + 1}`}
                      className="w-20 h-20 object-cover rounded-lg border border-blue-300"
                    />
                    <button
                      type="button"
                      onClick={() => removeNewImage(i)}
                      className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={form.isFeatured}
                onChange={(e) =>
                  setForm({ ...form, isFeatured: e.target.checked })
                }
              />
              Featured
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={form.isPublished}
                onChange={(e) =>
                  setForm({ ...form, isPublished: e.target.checked })
                }
              />
              Published
            </label>
          </div>

          <div className="flex gap-2">
            <Button type="submit">
              {editingId ? "Update Article" : "Create Article"}
            </Button>
            <Button type="button" variant="secondary" onClick={goToList}>
              Cancel
            </Button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="p-6">
      <PageHeader
        title="News Articles"
        subtitle="Manage news & blog articles"
        actions={<Button onClick={goToAdd}>+ Add Article</Button>}
      />

      <div className="flex flex-wrap gap-2 mb-4">
        <SearchInput
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search articles..."
          className="w-full max-w-xs"
        />
        <Button variant="secondary" onClick={loadArticles}>
          Search
        </Button>
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-auto"
        >
          <option value="all">All Status</option>
          <option value="published">Published</option>
          <option value="draft">Drafts</option>
        </Select>
        <Select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="w-auto"
        >
          <option value="all">All Categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
      </div>

      {error && <Alert className="mb-4" tone="danger">{error}</Alert>}

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800">Articles</h2>
          <span className="text-sm text-gray-500">
            {total} total
          </span>
        </div>
        {isLoading ? (
          <Card className="p-6 text-sm text-gray-400">Loading…</Card>
        ) : articles.length === 0 ? (
          <Card className="p-6 text-sm text-gray-400">No articles found.</Card>
        ) : (
          <div className="space-y-3">
            {articles.map((article) => (
              <Card
                key={article._id}
                className="overflow-hidden flex"
              >
                {article.image && (
                  <div
                    className="w-28 h-28 shrink-0 hidden sm:block relative cursor-pointer"
                    onClick={() => {
                      const imgs = article.images?.length ? article.images : [article.image];
                      setLightboxImages(imgs);
                      setLightboxIndex(0);
                    }}
                  >
                    <img
                      src={article.images?.length ? article.images[0] : article.image}
                      alt={article.title}
                      className="w-full h-full object-cover"
                    />
                    {(article.images?.length ?? 0) > 1 && (
                      <span className="absolute bottom-1 right-1 bg-black/60 text-white text-xs px-1.5 py-0.5 rounded">
                        +{article.images!.length - 1}
                      </span>
                    )}
                  </div>
                )}
                <div className="flex-1 p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="font-semibold text-gray-800">
                          {article.title}
                        </h3>
                        {article.isFeatured && (
                          <Badge tone="warning">Featured</Badge>
                        )}
                        <Badge tone={article.isPublished ? "success" : "neutral"}>
                          {article.isPublished ? "Published" : "Draft"}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-sm text-gray-500">
                        {article.category && (
                          <Badge tone="info">{article.category}</Badge>
                        )}
                        <span>{article.author}</span>
                        <span>•</span>
                        <span>{article.readTime}</span>
                        {article.publishedAt && (
                          <>
                            <span>•</span>
                            <span>
                              {new Date(
                                article.publishedAt,
                              ).toLocaleDateString()}
                            </span>
                          </>
                        )}
                      </div>
                      {article.excerpt && (
                        <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                          {article.excerpt}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant="secondary"
                        className="px-2 text-blue-600 hover:bg-blue-50"
                        title="Detail"
                        aria-label="Detail"
                        onClick={() => goToDetail(article)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="px-2"
                        title="Edit"
                        aria-label="Edit"
                        onClick={() => goToEdit(article)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="px-2"
                        title={article.isPublished ? "Unpublish" : "Publish"}
                        aria-label={article.isPublished ? "Unpublish" : "Publish"}
                        onClick={() => handleTogglePublish(article)}
                      >
                        {article.isPublished ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="px-2 text-red-600 hover:bg-red-50 hover:text-red-700"
                        title="Delete"
                        aria-label="Delete"
                        onClick={() => handleDelete(article._id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
      <Pagination
        page={page}
        totalPages={totalPages}
        total={total}
        label="articles"
        onPageChange={setPage}
      />

      {/* Image Lightbox */}
      {lightboxImages.length > 0 && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
          onClick={() => setLightboxImages([])}
        >
          <div
            className="relative bg-white rounded-xl shadow-2xl max-w-3xl w-full mx-4 max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={() => setLightboxImages([])}
              className="absolute top-3 right-3 z-10 w-8 h-8 flex items-center justify-center bg-black/50 hover:bg-black/70 text-white rounded-full text-lg"
            >
              ×
            </button>

            {/* Main image */}
            <div className="flex items-center justify-center bg-gray-100 p-4" style={{ minHeight: 300 }}>
              <img
                src={lightboxImages[lightboxIndex]}
                alt={`Image ${lightboxIndex + 1}`}
                className="max-w-full max-h-[60vh] object-contain rounded"
              />
            </div>

            {/* Navigation arrows */}
            {lightboxImages.length > 1 && (
              <>
                <button
                  onClick={() => setLightboxIndex((prev) => (prev - 1 + lightboxImages.length) % lightboxImages.length)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center bg-black/50 hover:bg-black/70 text-white rounded-full text-xl"
                >
                  ‹
                </button>
                <button
                  onClick={() => setLightboxIndex((prev) => (prev + 1) % lightboxImages.length)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center bg-black/50 hover:bg-black/70 text-white rounded-full text-xl"
                >
                  ›
                </button>
              </>
            )}

            {/* Thumbnail strip */}
            {lightboxImages.length > 1 && (
              <div className="flex gap-2 p-3 overflow-x-auto bg-white border-t justify-center">
                {lightboxImages.map((img, i) => (
                  <img
                    key={i}
                    src={img}
                    alt={`Thumb ${i + 1}`}
                    onClick={() => setLightboxIndex(i)}
                    className={`w-16 h-16 object-cover rounded cursor-pointer border-2 shrink-0 ${
                      i === lightboxIndex ? "border-blue-500" : "border-transparent hover:border-gray-300"
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NewsManagement;
