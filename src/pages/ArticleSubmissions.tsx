import React, { useCallback, useEffect, useState } from "react";
import { Eye, ClipboardCheck, Check, X, Trash2 } from "lucide-react";
import { articleSubmissionsApi } from "../services/admin-api";
import Pagination from "../components/Pagination";
import {
  PageHeader,
  Button,
  SearchInput,
  Select,
  Card,
  Badge,
  Alert,
  Input,
  Modal,
  cn,
} from "../components/ui";

interface Submission {
  _id: string;
  title: string;
  content: string;
  authorName: string;
  authorEmail: string;
  submissionType?: "article" | "gallery";
  attachments?: {
    url: string;
    originalName: string;
    mimeType: string;
    size: number;
  }[];
  status: "pending" | "approved" | "rejected";
  reviewNote: string;
  reviewedBy?: { name: string; email: string };
  reviewedAt?: string;
  createdAt: string;
}

const ArticleSubmissions: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"article" | "gallery">("article");
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [viewing, setViewing] = useState<Submission | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const loadSubmissions = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = { type: activeTab };
      if (statusFilter !== "all") params.status = statusFilter;
      if (search.trim()) params.q = search.trim();
      params.page = String(page);
      params.limit = "20";
      const res = await articleSubmissionsApi.getAll(params);
      const d = res.data;
      if (d?.items) {
        setSubmissions(d.items);
        setTotalPages(d.pagination?.pages || 1);
        setTotal(d.pagination?.total || 0);
      } else {
        setSubmissions(d || []);
      }
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to load submissions",
      );
    } finally {
      setIsLoading(false);
    }
  }, [activeTab, statusFilter, search, page]);

  useEffect(() => {
    loadSubmissions();
  }, [activeTab, statusFilter, loadSubmissions]);

  useEffect(() => {
    setPage(1);
    setViewing(null);
    setReviewingId(null);
    setReviewNote("");
  }, [activeTab, statusFilter, search]);

  const handleReview = async (id: string, status: "approved" | "rejected") => {
    setError(null);
    try {
      await articleSubmissionsApi.review(id, {
        status,
        reviewNote: reviewNote.trim() || undefined,
      });
      setReviewingId(null);
      setReviewNote("");
      await loadSubmissions();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to review submission",
      );
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this submission?")) return;
    setError(null);
    try {
      await articleSubmissionsApi.remove(id);
      await loadSubmissions();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to delete submission",
      );
    }
  };

  const getStatusTone = (
    status: string,
  ): "success" | "danger" | "warning" => {
    switch (status) {
      case "approved":
        return "success";
      case "rejected":
        return "danger";
      default:
        return "warning";
    }
  };

  return (
    <div className="p-6">
      <PageHeader
        title="Submissions"
        subtitle="Review user-submitted content"
        actions={
          <>
            <SearchInput
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search submissions…"
              className="w-full sm:w-64"
            />
            <Button onClick={loadSubmissions}>Search</Button>
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-auto"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </Select>
          </>
        }
      />

      {/* Tabs */}
      <div className="flex border-b mb-4">
        <button
          onClick={() => setActiveTab("article")}
          className={cn(
            "px-5 py-2.5 text-sm font-medium border-b-2 transition-colors",
            activeTab === "article"
              ? "border-healwin-500 text-healwin-600"
              : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300",
          )}
        >
          Article / News Submissions
        </button>
        <button
          onClick={() => setActiveTab("gallery")}
          className={cn(
            "px-5 py-2.5 text-sm font-medium border-b-2 transition-colors",
            activeTab === "gallery"
              ? "border-healwin-500 text-healwin-600"
              : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300",
          )}
        >
          Gallery Submissions
        </button>
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

      {isLoading ? (
        <Card padded className="text-sm text-gray-400">
          Loading…
        </Card>
      ) : submissions.length === 0 ? (
        <Card padded className="text-sm text-gray-400">
          No submissions found.
        </Card>
      ) : (
        <div className="space-y-4">
          {submissions.map((sub) => (
            <Card key={sub._id} className="overflow-hidden">
              <div className="p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <h3 className="text-lg font-semibold text-gray-800">
                        {sub.title}
                      </h3>
                      <Badge tone={getStatusTone(sub.status)} dot>
                        {sub.status}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500">
                      <span>
                        <strong>By:</strong> {sub.authorName}
                      </span>
                      <span>•</span>
                      <span>{sub.authorEmail}</span>
                      <span>•</span>
                      <span>
                        {new Date(sub.createdAt).toLocaleDateString()}
                      </span>
                      {Array.isArray(sub.attachments) &&
                        sub.attachments.length > 0 && (
                          <>
                            <span>|</span>
                            <span>{sub.attachments.length} attachment(s)</span>
                          </>
                        )}
                    </div>
                    {sub.reviewedBy && (
                      <div className="mt-1 text-xs text-gray-400">
                        Reviewed by{" "}
                        {sub.reviewedBy.name || sub.reviewedBy.email} on{" "}
                        {sub.reviewedAt
                          ? new Date(sub.reviewedAt).toLocaleDateString()
                          : ""}
                      </div>
                    )}
                    {sub.reviewNote && (
                      <div className="px-3 py-2 mt-2 text-sm text-gray-600 rounded-lg bg-gray-50">
                        <strong>Review Note:</strong> {sub.reviewNote}
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2 sm:justify-end">
                    <Button
                      size="sm"
                      variant="secondary"
                      className="px-2"
                      title="Read"
                      aria-label="Read"
                      onClick={() => setViewing(sub)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    {sub.status === "pending" && reviewingId !== sub._id && (
                      <Button
                        size="sm"
                        className="px-2"
                        title="Review"
                        aria-label="Review"
                        onClick={() => setReviewingId(sub._id)}
                      >
                        <ClipboardCheck className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="px-2 text-red-600 hover:bg-red-50 hover:text-red-700"
                      title="Delete"
                      aria-label="Delete"
                      onClick={() => handleDelete(sub._id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Review form — own row so it never crowds the action buttons */}
                {sub.status === "pending" && reviewingId === sub._id && (
                  <div className="mt-4 flex flex-col gap-2 rounded-lg border border-gray-100 bg-gray-50 p-3 sm:flex-row sm:items-center">
                    <Input
                      value={reviewNote}
                      onChange={(e) => setReviewNote(e.target.value)}
                      placeholder="Review note (optional)"
                      className="h-9 flex-1"
                    />
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        className="px-2 bg-emerald-500 hover:bg-emerald-600"
                        title="Approve"
                        aria-label="Approve"
                        onClick={() => handleReview(sub._id, "approved")}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        className="px-2"
                        title="Reject"
                        aria-label="Reject"
                        onClick={() => handleReview(sub._id, "rejected")}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setReviewingId(null);
                          setReviewNote("");
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* View submission — full content + attachment previews */}
      <Modal
        open={!!viewing}
        onClose={() => setViewing(null)}
        title={viewing?.title}
        subtitle={
          viewing
            ? `${viewing.submissionType === "gallery" ? "Gallery" : "Article / News"} submission`
            : undefined
        }
        size="xl"
        footer={
          <Button variant="secondary" onClick={() => setViewing(null)}>
            Close
          </Button>
        }
      >
        {viewing && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500">
              <Badge tone={getStatusTone(viewing.status)} dot>
                {viewing.status}
              </Badge>
              <span>
                <strong>By:</strong> {viewing.authorName}
              </span>
              <span>•</span>
              <span>{viewing.authorEmail}</span>
              <span>•</span>
              <span>{new Date(viewing.createdAt).toLocaleDateString()}</span>
            </div>

            {viewing.reviewNote && (
              <Alert tone="info">
                <strong>Review note:</strong> {viewing.reviewNote}
              </Alert>
            )}

            {viewing.content?.trim() && (
              <div>
                <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Content
                </h4>
                <div className="prose prose-sm max-w-none whitespace-pre-wrap text-gray-700">
                  {viewing.content}
                </div>
              </div>
            )}

            {Array.isArray(viewing.attachments) &&
              viewing.attachments.length > 0 && (
                <div>
                  <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Attachments ({viewing.attachments.length})
                  </h4>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {viewing.attachments.map((file, idx) => {
                      const isImage = file.mimeType?.startsWith("image/");
                      return (
                        <a
                          key={`${viewing._id}-att-${idx}`}
                          href={file.url}
                          target="_blank"
                          rel="noreferrer"
                          title={file.originalName}
                          className="group block overflow-hidden rounded-lg border border-gray-200 transition-colors hover:border-healwin-400"
                        >
                          {isImage ? (
                            <img
                              src={file.url}
                              alt={file.originalName}
                              className="h-56 w-full bg-gray-100 object-contain"
                              loading="lazy"
                            />
                          ) : (
                            <div className="flex h-56 w-full items-center justify-center bg-gray-50 text-xs text-gray-400">
                              {file.mimeType || "file"}
                            </div>
                          )}
                          <p className="truncate border-t border-gray-100 px-3 py-2 text-xs text-gray-600 group-hover:text-healwin-600">
                            {file.originalName}
                          </p>
                        </a>
                      );
                    })}
                  </div>
                </div>
              )}

            {!viewing.content?.trim() &&
              (!viewing.attachments || viewing.attachments.length === 0) && (
                <p className="text-sm text-gray-400">No content or attachments.</p>
              )}
          </div>
        )}
      </Modal>
      <Pagination
        page={page}
        totalPages={totalPages}
        total={total}
        label="submissions"
        onPageChange={setPage}
      />
    </div>
  );
};

export default ArticleSubmissions;
