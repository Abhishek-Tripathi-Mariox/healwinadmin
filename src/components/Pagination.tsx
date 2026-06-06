import React from "react";

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  label?: string;
  onPageChange: (page: number) => void;
}

const WINDOW = 9;

const Pagination: React.FC<PaginationProps> = ({
  page,
  totalPages,
  total,
  label = "items",
  onPageChange,
}) => {
  if (totalPages <= 1) return null;

  // Build page numbers: show a window of 9, plus last page
  const getPages = (): (number | "...")[] => {
    const pages: (number | "...")[] = [];

    // Which group of 9 the current page falls in
    const groupStart = Math.floor((page - 1) / WINDOW) * WINDOW + 1;
    const groupEnd = Math.min(groupStart + WINDOW - 1, totalPages);

    for (let i = groupStart; i <= groupEnd; i++) {
      pages.push(i);
    }

    // Add last page with ellipsis if not already included
    if (groupEnd < totalPages) {
      if (groupEnd < totalPages - 1) {
        pages.push("...");
      }
      pages.push(totalPages);
    }

    return pages;
  };

  const pages = getPages();

  // Navigate to next/prev group of 9
  const groupStart = Math.floor((page - 1) / WINDOW) * WINDOW + 1;
  const groupEnd = Math.min(groupStart + WINDOW - 1, totalPages);
  const hasPrevGroup = groupStart > 1;
  const hasNextGroup = groupEnd < totalPages;

  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-500">
        {total} {total === 1 ? label.replace(/s$/, "") : label}
      </span>
      <div className="flex items-center gap-1">
        {/* Prev group button */}
        <button
          onClick={() => onPageChange(groupStart - 1)}
          disabled={!hasPrevGroup}
          className="px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          ← Prev
        </button>

        {/* Page numbers */}
        {pages.map((p, i) =>
          p === "..." ? (
            <span key={`dots-${i}`} className="px-2 py-1.5 text-sm text-gray-400">
              ...
            </span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              className={`min-w-[36px] px-2 py-1.5 text-sm rounded-lg border ${
                p === page
                  ? "bg-blue-600 text-white border-blue-600"
                  : "hover:bg-gray-50 text-gray-700 border-gray-200"
              }`}
            >
              {p}
            </button>
          )
        )}

        {/* Next group button */}
        <button
          onClick={() => onPageChange(groupEnd + 1)}
          disabled={!hasNextGroup}
          className="px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Next →
        </button>
      </div>
    </div>
  );
};

export default Pagination;
