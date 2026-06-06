import React, { useCallback, useEffect, useState, useRef } from "react";
import { Eye, Pencil, Power, Trash2 } from "lucide-react";
import { galleryApi, categoryApi } from "../services/admin-api";
import Pagination from "../components/Pagination";
import {
  PageHeader,
  Button,
  SearchInput,
  Select,
  Card,
  Badge,
  Alert,
  Field,
  Input,
  Textarea,
} from "../components/ui";

interface GalleryImageItem {
  _id: string;
  title: string;
  image: string;
  images: string[];
  category: string;
  description: string;
  isActive: boolean;
  sortOrder: number;
}

const emptyImage = {
  title: "",
  category: "",
  description: "",
  isActive: true,
  sortOrder: 0,
};

const GalleryManagement: React.FC = () => {
  const [images, setImages] = useState<GalleryImageItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [categories, setCategories] = useState<string[]>([]);
  const [form, setForm] = useState({ ...emptyImage });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadImages = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = {};
      if (search.trim()) params.q = search.trim();
      if (categoryFilter !== "all") params.category = categoryFilter;
      params.page = String(page);
      params.limit = "20";
      const res = await galleryApi.getAll(params);
      const d = res.data;
      if (d?.items) {
        setImages(d.items);
        setTotalPages(d.pagination?.pages || 1);
        setTotal(d.pagination?.total || 0);
      } else {
        setImages(d || []);
      }
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to load gallery images",
      );
    } finally {
      setIsLoading(false);
    }
  }, [search, categoryFilter, page]);

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
    loadImages();
  }, [categoryFilter, loadImages]);

  useEffect(() => {
    setPage(1);
  }, [search, categoryFilter]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setImageFiles((prev) => [...prev, ...files]);
    const newPreviews = files.map((f) => URL.createObjectURL(f));
    setImagePreviews((prev) => [...prev, ...newPreviews]);
  };

  const removeExistingImage = (index: number) => {
    setExistingImages((prev) => prev.filter((_, i) => i !== index));
  };

  const removeNewImage = (index: number) => {
    setImageFiles((prev) => prev.filter((_, i) => i !== index));
    setImagePreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) {
      setError("Title is required");
      return;
    }
    if (!editingId && imageFiles.length === 0) {
      setError("Please select at least one image");
      return;
    }
    setError(null);
    try {
      const fd = new FormData();
      fd.append("title", form.title);
      fd.append("category", form.category);
      fd.append("description", form.description);
      fd.append("isActive", String(form.isActive));
      fd.append("sortOrder", String(form.sortOrder));
      if (editingId) {
        fd.append("existingImages", JSON.stringify(existingImages));
      }
      imageFiles.forEach((file) => fd.append("images", file));

      if (editingId) {
        await galleryApi.update(editingId, fd);
      } else {
        await galleryApi.create(fd);
      }

      resetForm();
      await loadImages();
      await loadCategories();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save image");
    }
  };

  const resetForm = () => {
    setForm({ ...emptyImage });
    setEditingId(null);
    setImageFiles([]);
    setImagePreviews([]);
    setExistingImages([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleEdit = (img: GalleryImageItem) => {
    setEditingId(img._id);
    setForm({
      title: img.title || "",
      category: img.category || "",
      description: img.description || "",
      isActive: Boolean(img.isActive),
      sortOrder: img.sortOrder || 0,
    });
    const imgs = img.images?.length ? img.images : img.image ? [img.image] : [];
    setExistingImages(imgs);
    setImageFiles([]);
    setImagePreviews([]);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this gallery image?")) return;
    setError(null);
    try {
      await galleryApi.remove(id);
      await loadImages();
      await loadCategories();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete image");
    }
  };

  const handleToggleActive = async (img: GalleryImageItem) => {
    setError(null);
    try {
      const fd = new FormData();
      fd.append("isActive", String(!img.isActive));
      await galleryApi.update(img._id, fd);
      await loadImages();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update status");
    }
  };

  const [view, setView] = useState<"list" | "form" | "detail">("list");
  const [detailImage, setDetailImage] = useState<GalleryImageItem | null>(null);

  const goToAdd = () => {
    resetForm();
    setView("form");
  };

  const goToEdit = (img: GalleryImageItem) => {
    handleEdit(img);
    setView("form");
  };

  const goToDetail = (img: GalleryImageItem) => {
    setDetailImage(img);
    setView("detail");
  };

  const goToList = () => {
    resetForm();
    setDetailImage(null);
    setView("form");
    setTimeout(() => setView("list"), 0);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    await handleSubmit(e);
    if (form.title.trim() && (editingId || imageFiles.length > 0)) {
      setView("list");
    }
  };

  if (view === "detail" && detailImage) {
    const imgs = detailImage.images?.length ? detailImage.images : detailImage.image ? [detailImage.image] : [];
    return (
      <div className="p-6 space-y-6">
        {/* Top bar */}
        <div className="flex items-center justify-between">
          <Button variant="secondary" onClick={goToList} icon={<span>←</span>}>
            Back to Gallery
          </Button>
          <Button onClick={() => goToEdit(detailImage)}>Edit Image</Button>
        </div>

        {/* Title + badges */}
        <Card padded>
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <Badge tone={detailImage.isActive ? "success" : "neutral"} dot>
              {detailImage.isActive ? "Active" : "Hidden"}
            </Badge>
            {detailImage.category && (
              <Badge tone="info">{detailImage.category}</Badge>
            )}
          </div>
          <h1 className="text-2xl font-bold text-gray-900 leading-tight">{detailImage.title}</h1>
          {detailImage.description && (
            <p className="mt-2 text-gray-500 leading-relaxed">{detailImage.description}</p>
          )}
        </Card>

        {/* Metadata */}
        <div className="grid grid-cols-2 gap-4">
          <Card className="p-4">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Category</p>
            <p className="text-sm font-semibold text-gray-800">{detailImage.category || "—"}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Sort Order</p>
            <p className="text-sm font-semibold text-gray-800">{detailImage.sortOrder}</p>
          </Card>
        </div>

        {/* Image gallery */}
        {imgs.length > 0 && (
          <Card className="overflow-hidden">
            <div className="relative w-full h-72 md:h-96 bg-gray-100">
              <img
                src={imgs[0]}
                alt={detailImage.title}
                className="w-full h-full object-cover cursor-pointer"
                onClick={() => { setLightboxImages(imgs); setLightboxIndex(0); }}
              />
              <div className="absolute bottom-3 right-3 bg-black/50 text-white text-xs px-2.5 py-1 rounded-full">
                {imgs.length} image{imgs.length !== 1 ? "s" : ""}
              </div>
            </div>
            {imgs.length > 1 && (
              <div className="p-4 border-t bg-gray-50">
                <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3">
                  {imgs.map((url, i) => (
                    <img
                      key={i}
                      src={url}
                      alt={`Image ${i + 1}`}
                      className="w-full aspect-square object-cover rounded-lg border-2 border-transparent hover:border-healwin-400 cursor-pointer transition"
                      onClick={() => { setLightboxImages(imgs); setLightboxIndex(i); }}
                    />
                  ))}
                </div>
              </div>
            )}
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
          <Button variant="secondary" onClick={goToList} icon={<span>←</span>}>
            Back to Gallery
          </Button>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-gray-900">
              {editingId ? "Edit Image" : "Add Image"}
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              {editingId ? "Update image details" : "Upload a new gallery image"}
            </p>
          </div>
        </div>

        {error && (
          <Alert tone="danger">
            <span className="flex items-center justify-between gap-4">
              {error}
              <button onClick={() => setError(null)} className="font-bold">
                ×
              </button>
            </span>
          </Alert>
        )}

        <Card padded>
          <form onSubmit={handleFormSubmit} className="space-y-5">
            <div className="grid md:grid-cols-2 gap-4">
              <Field label="Title *">
                <Input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Image title"
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

            <Field label="Description">
              <Textarea
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                placeholder="Optional description"
                rows={3}
              />
            </Field>

            <div className="grid md:grid-cols-2 gap-4">
              <Field label="Sort Order">
                <Input
                  type="number"
                  value={form.sortOrder}
                  onChange={(e) =>
                    setForm({ ...form, sortOrder: Number(e.target.value) })
                  }
                />
              </Field>
              <div className="flex items-end pb-2">
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                  />
                  Active
                </label>
              </div>
            </div>

            <Field label={`Images ${editingId ? "" : "*"}`}>
              <input
                type="file"
                accept="image/*"
                multiple
                ref={fileInputRef}
                onChange={handleImageChange}
                className="block w-full cursor-pointer rounded-lg border border-gray-300 text-sm text-gray-600 file:mr-3 file:cursor-pointer file:border-0 file:bg-healwin-50 file:px-4 file:py-2.5 file:text-sm file:font-medium file:text-healwin-700 hover:file:bg-healwin-100"
              />
              {(existingImages.length > 0 || imagePreviews.length > 0) && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {existingImages.map((url, i) => (
                    <div key={`ex-${i}`} className="relative group">
                      <img
                        src={url}
                        alt={`Existing ${i + 1}`}
                        className="object-cover w-20 h-20 border rounded-lg"
                      />
                      <button
                        type="button"
                        onClick={() => removeExistingImage(i)}
                        className="absolute w-5 h-5 text-xs text-white bg-red-500 rounded-full -top-1 -right-1 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
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
                        className="object-cover w-20 h-20 border-2 border-blue-300 rounded-lg"
                      />
                      <button
                        type="button"
                        onClick={() => removeNewImage(i)}
                        className="absolute w-5 h-5 text-xs text-white bg-red-500 rounded-full -top-1 -right-1 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </Field>

            <div className="flex gap-2">
              <Button type="submit">
                {editingId ? "Update Image" : "Upload Image"}
              </Button>
              <Button type="button" variant="secondary" onClick={goToList}>
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6">
      <PageHeader
        title="Gallery"
        subtitle={`${total} total · Manage gallery photos`}
        actions={<Button onClick={goToAdd}>+ Add Image</Button>}
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
          placeholder="Search images…"
          className="w-full max-w-xs"
        />
        <Button variant="secondary" onClick={loadImages}>
          Search
        </Button>
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

      {isLoading ? (
        <Card padded className="text-center text-sm text-gray-400">
          Loading…
        </Card>
      ) : images.length === 0 ? (
        <Card padded className="text-center text-sm text-gray-400">
          No images found.
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {images.map((img) => (
            <Card key={img._id} className="overflow-hidden">
              <div
                className="relative h-40 overflow-hidden bg-gray-100 cursor-pointer"
                onClick={() => {
                  const imgs = img.images?.length ? img.images : img.image ? [img.image] : [];
                  if (imgs.length > 0) {
                    setLightboxImages(imgs);
                    setLightboxIndex(0);
                  }
                }}
              >
                <img
                  src={img.images?.length ? img.images[0] : img.image}
                  alt={img.title}
                  className="object-contain w-full h-full"
                />
                {(img.images?.length ?? 0) > 1 && (
                  <span className="absolute px-1.5 py-0.5 text-xs text-white bg-black/60 rounded bottom-2 right-2">
                    +{img.images.length - 1}
                  </span>
                )}
                <div className="absolute flex gap-1 top-2 right-2">
                  <Badge tone={img.isActive ? "success" : "neutral"} dot>
                    {img.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </div>
              <div className="p-3">
                <h3 className="mb-1 text-sm font-semibold text-gray-800 truncate">
                  {img.title}
                </h3>
                <div className="flex items-center gap-2 mb-3 text-xs text-gray-500">
                  {img.category && (
                    <Badge tone="info">{img.category}</Badge>
                  )}
                  {img.sortOrder > 0 && <span>Order: {img.sortOrder}</span>}
                </div>
                <div className="flex gap-1.5">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="flex-1 px-2 text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                    title="Detail"
                    aria-label="Detail"
                    onClick={() => goToDetail(img)}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="flex-1 px-2"
                    title="Edit"
                    aria-label="Edit"
                    onClick={() => goToEdit(img)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="flex-1 px-2"
                    title={img.isActive ? "Hide" : "Show"}
                    aria-label={img.isActive ? "Hide" : "Show"}
                    onClick={() => handleToggleActive(img)}
                  >
                    <Power className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="px-2 text-red-600 hover:bg-red-50 hover:text-red-700"
                    title="Delete"
                    aria-label="Delete"
                    onClick={() => handleDelete(img._id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Pagination
        page={page}
        totalPages={totalPages}
        total={total}
        label="images"
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
            <button
              onClick={() => setLightboxImages([])}
              className="absolute z-10 flex items-center justify-center w-8 h-8 text-lg text-white rounded-full top-3 right-3 bg-black/50 hover:bg-black/70"
            >
              ×
            </button>
            <div className="flex items-center justify-center p-4 bg-gray-100" style={{ minHeight: 300 }}>
              <img
                src={lightboxImages[lightboxIndex]}
                alt={`Image ${lightboxIndex + 1}`}
                className="max-w-full max-h-[60vh] object-contain rounded"
              />
            </div>
            {lightboxImages.length > 1 && (
              <>
                <button
                  onClick={() => setLightboxIndex((prev) => (prev - 1 + lightboxImages.length) % lightboxImages.length)}
                  className="absolute flex items-center justify-center w-10 h-10 text-xl text-white -translate-y-1/2 rounded-full left-3 top-1/2 bg-black/50 hover:bg-black/70"
                >
                  ‹
                </button>
                <button
                  onClick={() => setLightboxIndex((prev) => (prev + 1) % lightboxImages.length)}
                  className="absolute flex items-center justify-center w-10 h-10 text-xl text-white -translate-y-1/2 rounded-full right-3 top-1/2 bg-black/50 hover:bg-black/70"
                >
                  ›
                </button>
                <div className="flex justify-center gap-2 p-3 overflow-x-auto bg-white border-t">
                  {lightboxImages.map((imgUrl, i) => (
                    <img
                      key={i}
                      src={imgUrl}
                      alt={`Thumb ${i + 1}`}
                      onClick={() => setLightboxIndex(i)}
                      className={`w-16 h-16 object-cover rounded cursor-pointer border-2 shrink-0 ${
                        i === lightboxIndex ? "border-blue-500" : "border-transparent hover:border-gray-300"
                      }`}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default GalleryManagement;
