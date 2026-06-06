import React, { useState, useRef, useEffect, useCallback } from "react";

interface Option {
  _id?: string;
  id?: string;
  name: string;
  [key: string]: any;
}

export interface FetchResult {
  items: Option[];
  hasMore: boolean;
}

interface SearchableSelectProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  displayField?: string;
  valueField?: string;
  // Async mode: provide fetchOptions instead of options
  fetchOptions?: (params: {
    q: string;
    page: number;
    limit: number;
  }) => Promise<FetchResult>;
  // Static mode (legacy): provide options array
  options?: Option[];
}

const PAGE_LIMIT = 50;

const SearchableSelect: React.FC<SearchableSelectProps> = ({
  value,
  onChange,
  placeholder = "Search and select...",
  label,
  required = false,
  disabled = false,
  displayField = "name",
  valueField = "name",
  fetchOptions,
  options: staticOptions,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Async state
  const [asyncOptions, setAsyncOptions] = useState<Option[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef(0); // counter to ignore stale responses

  const isAsync = !!fetchOptions;

  // For async mode: the selected option display text might not be in current page
  const [selectedDisplay, setSelectedDisplay] = useState("");

  // Determine which options to render
  const displayOptions = isAsync
    ? asyncOptions
    : (staticOptions || []).filter((option) =>
        option[displayField]?.toLowerCase().includes(searchTerm.toLowerCase())
      );

  // Fetch options from API (async mode)
  const fetchData = useCallback(
    async (query: string, pageNum: number, append: boolean) => {
      if (!fetchOptions) return;
      const requestId = ++abortRef.current;
      setLoading(true);
      try {
        const result = await fetchOptions({
          q: query,
          page: pageNum,
          limit: PAGE_LIMIT,
        });
        if (requestId !== abortRef.current) return; // stale
        if (append) {
          setAsyncOptions((prev) => [...prev, ...result.items]);
        } else {
          setAsyncOptions(result.items);
        }
        setHasMore(result.hasMore);
        setPage(pageNum);
      } catch {
        // silently fail
      } finally {
        if (requestId === abortRef.current) {
          setLoading(false);
        }
      }
    },
    [fetchOptions]
  );

  // When dropdown opens, load first page
  useEffect(() => {
    if (isOpen && isAsync && !initialLoaded) {
      fetchData("", 1, false);
      setInitialLoaded(true);
    }
  }, [isOpen, isAsync, initialLoaded, fetchData]);

  // Debounced search for async mode
  useEffect(() => {
    if (!isAsync || !isOpen) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchData(searchTerm, 1, false);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchTerm, isAsync, isOpen, fetchData]);

  // Scroll pagination: prefetch next page at 60% scroll (no delay for user)
  const handleScroll = useCallback(() => {
    if (!isAsync || !hasMore || loading) return;
    const list = listRef.current;
    if (!list) return;
    const scrolledRatio = (list.scrollTop + list.clientHeight) / list.scrollHeight;
    if (scrolledRatio >= 0.6) {
      fetchData(searchTerm, page + 1, true);
    }
  }, [isAsync, hasMore, loading, searchTerm, page, fetchData]);

  // Get display text for current value
  const getDisplayText = () => {
    if (isAsync) {
      // Check current loaded options first
      const found = asyncOptions.find((opt) => opt[valueField] === value);
      if (found) return found[displayField];
      return selectedDisplay || "";
    }
    const selected = (staticOptions || []).find(
      (opt) => opt[valueField] === value
    );
    return selected ? selected[displayField] : "";
  };

  // Handle clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setSearchTerm("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < displayOptions.length - 1 ? prev + 1 : prev
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
        break;
      case "Enter":
        e.preventDefault();
        if (displayOptions[highlightedIndex]) {
          handleSelect(displayOptions[highlightedIndex]);
        }
        break;
      case "Escape":
        e.preventDefault();
        setIsOpen(false);
        setSearchTerm("");
        break;
    }
  };

  const handleSelect = (option: Option) => {
    onChange(option[valueField]);
    if (isAsync) {
      setSelectedDisplay(option[displayField]);
    }
    setIsOpen(false);
    setSearchTerm("");
    setHighlightedIndex(0);
  };

  // Reset async state when dropdown closes
  useEffect(() => {
    if (!isOpen && isAsync) {
      setInitialLoaded(false);
    }
  }, [isOpen, isAsync]);

  useEffect(() => {
    if (isOpen && highlightedIndex >= 0 && listRef.current) {
      const el = listRef.current.children[highlightedIndex] as HTMLElement;
      if (el) el.scrollIntoView({ block: "nearest" });
    }
  }, [highlightedIndex, isOpen]);

  return (
    <div ref={containerRef} className="relative">
      {label && (
        <label className="block mb-1 text-sm font-medium text-gray-700">
          {label}
          {required && <span className="text-red-500">*</span>}
        </label>
      )}

      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) {
            setTimeout(() => inputRef.current?.focus(), 0);
          }
        }}
        disabled={disabled}
        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-left bg-white flex justify-between items-center disabled:bg-gray-100 disabled:cursor-not-allowed"
      >
        <span className={getDisplayText() ? "text-gray-900" : "text-gray-500"}>
          {getDisplayText() || placeholder}
        </span>
        <svg
          className={`w-4 h-4 transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 14l-7 7m0 0l-7-7m7 7V3"
          />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg">
          {/* Search Input */}
          <input
            ref={inputRef}
            type="text"
            placeholder="Type to search..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setHighlightedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            className="w-full px-3 py-2 border-b focus:outline-none focus:ring-1 focus:ring-blue-500"
            autoFocus
          />

          {/* Options List */}
          <ul
            ref={listRef}
            className="max-h-60 overflow-y-auto"
            role="listbox"
            onScroll={handleScroll}
          >
            {displayOptions.length > 0 ? (
              displayOptions.map((option, index) => (
                <li key={option._id || option.id || index}>
                  <button
                    type="button"
                    onClick={() => handleSelect(option)}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    className={`w-full text-left px-3 py-2 flex items-center gap-2 ${
                      index === highlightedIndex
                        ? "bg-blue-500 text-white"
                        : option[valueField] === value
                        ? "bg-blue-100 text-gray-900"
                        : "text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    {option[valueField] === value && (
                      <svg
                        className="w-4 h-4 flex-shrink-0"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                    <span>{option[displayField]}</span>
                  </button>
                </li>
              ))
            ) : loading ? null : (
              <li className="px-3 py-4 text-center text-gray-500">
                No options found
              </li>
            )}
            {loading && (
              <li className="px-3 py-3 text-center text-gray-400 text-sm">
                Loading...
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
};

export default SearchableSelect;
