import { useRef, useEffect, type ReactNode } from "react";

interface CellWrapperProps {
  isEditing: boolean;
  onClick: () => void;
  display: ReactNode;
  editor: ReactNode;
  className?: string;
}

export function CellWrapper({ isEditing, onClick, display, editor, className = "" }: CellWrapperProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Trap focus inside editor when editing
  useEffect(() => {
    if (!isEditing) return;
    const el = wrapperRef.current;
    if (!el) return;
    const focusable = el.querySelector<HTMLElement>("input, button, select, [tabindex]");
    focusable?.focus();
  }, [isEditing]);

  if (isEditing) {
    return (
      <div
        ref={wrapperRef}
        className={className}
        onKeyDown={(e) => e.stopPropagation()}
      >
        {editor}
      </div>
    );
  }

  return (
    <div
      className={`cursor-default ${className}`}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      {display}
    </div>
  );
}
