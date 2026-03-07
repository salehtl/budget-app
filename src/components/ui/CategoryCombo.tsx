import { useState, useRef, useEffect, useCallback, useId } from "react";
import type { Category } from "../../types/database.ts";

const inputBase = "bg-transparent outline-none transition-colors";
const inputUnderline = "border-b border-accent/30 focus:border-accent";
const inputUnderlineIdle = "border-b border-transparent focus:border-accent/40";

interface CategoryComboProps {
  value: string;
  onChange: (id: string) => void;
  categories: Category[];
  variant: "edit" | "add";
  disabled?: boolean;
  onCreateCategory?: (name: string) => Promise<string>;
}

export function CategoryCombo({
  value,
  onChange,
  categories,
  variant,
  disabled,
  onCreateCategory,
}: CategoryComboProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const comboId = useId();
  const listboxId = `${comboId}-listbox`;
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selectedName = categories.find((c) => c.id === value)?.name ?? "";
  const isEdit = variant === "edit";

  const filtered = query.trim()
    ? categories.filter((c) => c.name.toLowerCase().includes(query.toLowerCase()))
    : categories;

  const exactMatch = categories.some((c) => c.name.toLowerCase() === query.trim().toLowerCase());
  const showCreate = !!(query.trim() && !exactMatch && onCreateCategory);

  // Build the flat option list: [None?, ...filtered, Create?]
  type ComboOption =
    | { kind: "none" }
    | { kind: "category"; cat: Category }
    | { kind: "create"; name: string };

  const options: ComboOption[] = [];
  if (value) options.push({ kind: "none" });
  for (const c of filtered) options.push({ kind: "category", cat: c });
  if (showCreate) options.push({ kind: "create", name: query.trim() });

  const getOptionId = (index: number) => `${comboId}-opt-${index}`;

  // Clamp active index when options change
  useEffect(() => {
    if (activeIndex >= options.length) setActiveIndex(options.length - 1);
  }, [options.length, activeIndex]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        closeCombo();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Scroll active option into view
  useEffect(() => {
    if (!open || activeIndex < 0) return;
    const el = listRef.current?.children[activeIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex]);

  const closeCombo = useCallback(() => {
    setOpen(false);
    setQuery("");
    setActiveIndex(-1);
  }, []);

  function openCombo() {
    setOpen(true);
    setActiveIndex(-1);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function handleSelect(id: string) {
    onChange(id);
    closeCombo();
  }

  async function handleCreate() {
    if (!onCreateCategory || !query.trim()) return;
    const id = await onCreateCategory(query.trim());
    onChange(id);
    closeCombo();
  }

  function commitActiveOption() {
    if (activeIndex < 0 || activeIndex >= options.length) return false;
    const opt = options[activeIndex]!;
    if (opt.kind === "none") { handleSelect(""); return true; }
    if (opt.kind === "category") { handleSelect(opt.cat.id); return true; }
    if (opt.kind === "create") { handleCreate(); return true; }
    return false;
  }

  function handleInputKeyDown(e: React.KeyboardEvent) {
    switch (e.key) {
      case "Escape":
        e.preventDefault();
        e.stopPropagation();
        closeCombo();
        break;

      case "ArrowDown":
        e.preventDefault();
        setActiveIndex((prev) => (prev < options.length - 1 ? prev + 1 : 0));
        break;

      case "ArrowUp":
        e.preventDefault();
        setActiveIndex((prev) => (prev > 0 ? prev - 1 : options.length - 1));
        break;

      case "Enter":
        e.preventDefault();
        e.stopPropagation();
        if (activeIndex >= 0) {
          commitActiveOption();
        } else if (showCreate && filtered.length === 0) {
          handleCreate();
        } else if (filtered.length === 1 && filtered[0]) {
          handleSelect(filtered[0].id);
        }
        break;

      case "Tab":
        // Allow natural tab, but close the combo
        closeCombo();
        break;

      case "Home":
        e.preventDefault();
        setActiveIndex(0);
        break;

      case "End":
        e.preventDefault();
        setActiveIndex(options.length - 1);
        break;
    }
  }

  // Reset active index when query changes
  useEffect(() => {
    setActiveIndex(-1);
  }, [query]);

  // --- Closed state: trigger button ---
  if (!open) {
    return (
      <button
        type="button"
        tabIndex={0}
        onClick={openCombo}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
            e.preventDefault();
            e.stopPropagation();
            openCombo();
          }
        }}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={false}
        className={`w-full text-[11px] text-center truncate py-0.5 cursor-pointer ${inputBase} border-b ${
          isEdit ? "border-accent/30 text-text-muted" : "border-transparent text-text-muted"
        } hover:border-accent/50 focus:border-accent/50 focus:outline-none`}
      >
        {selectedName || (isEdit ? "None" : "Cat...")}
      </button>
    );
  }

  // --- Open state: input + listbox ---
  const activeOptionId = activeIndex >= 0 ? getOptionId(activeIndex) : undefined;

  return (
    <div ref={ref} className="relative">
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-expanded={true}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={activeOptionId}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleInputKeyDown}
        placeholder={selectedName || "Search..."}
        className={`w-full text-[11px] text-text-muted text-center py-0.5 ${inputBase} ${isEdit ? inputUnderline : inputUnderlineIdle} placeholder:text-text-light/50`}
      />
      <ul
        ref={listRef}
        id={listboxId}
        role="listbox"
        aria-label="Categories"
        className="absolute left-1/2 -translate-x-1/2 top-full mt-1 z-[60] w-48 max-h-48 overflow-y-auto rounded-lg border border-border bg-surface shadow-lg py-1 animate-slide-up"
      >
        {options.map((opt, i) => {
          const isActive = i === activeIndex;

          if (opt.kind === "none") {
            return (
              <li
                key="__none"
                id={getOptionId(i)}
                role="option"
                aria-selected={!value}
                data-active={isActive || undefined}
                onClick={() => handleSelect("")}
                onMouseEnter={() => setActiveIndex(i)}
                className={`px-2.5 py-1.5 text-[11px] text-text-light cursor-pointer italic transition-colors ${
                  isActive ? "bg-surface-alt" : ""
                }`}
              >
                None
              </li>
            );
          }

          if (opt.kind === "category") {
            const c = opt.cat;
            const isSelected = c.id === value;
            return (
              <li
                key={c.id}
                id={getOptionId(i)}
                role="option"
                aria-selected={isSelected}
                data-active={isActive || undefined}
                onClick={() => handleSelect(c.id)}
                onMouseEnter={() => setActiveIndex(i)}
                className={`px-2.5 py-1.5 text-[11px] cursor-pointer flex items-center gap-1.5 transition-colors ${
                  isActive
                    ? "bg-accent/10 text-accent"
                    : isSelected
                      ? "bg-accent/8 text-accent font-medium"
                      : "text-text hover:bg-surface-alt"
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                <span className="truncate">{c.name}</span>
                {isSelected && (
                  <svg className="w-3 h-3 ml-auto shrink-0 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </li>
            );
          }

          if (opt.kind === "create") {
            return (
              <li
                key="__create"
                id={getOptionId(i)}
                role="option"
                aria-selected={false}
                data-active={isActive || undefined}
                onClick={handleCreate}
                onMouseEnter={() => setActiveIndex(i)}
                className={`px-2.5 py-1.5 text-[11px] text-accent font-medium cursor-pointer flex items-center gap-1.5 border-t border-border mt-0.5 pt-1.5 transition-colors ${
                  isActive ? "bg-accent/10" : "hover:bg-accent/8"
                }`}
              >
                <svg className="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                Create &ldquo;{opt.name}&rdquo;
              </li>
            );
          }

          return null;
        })}

        {options.length === 0 && (
          <li className="px-2.5 py-2 text-[11px] text-text-light text-center" role="presentation">
            No matches
          </li>
        )}
      </ul>

      {/* Live region for screen readers */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {options.length === 0
          ? "No matching categories"
          : `${options.length} option${options.length !== 1 ? "s" : ""} available`}
      </div>
    </div>
  );
}
