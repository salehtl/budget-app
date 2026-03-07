import { useRef } from "react";
import { Button } from "../ui/Button.tsx";

interface PdfImportButtonProps {
  onFilesSelect: (files: File[]) => void;
}

export function PdfImportButton({ onFilesSelect }: PdfImportButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <Button
        size="sm"
        variant="secondary"
        onClick={() => inputRef.current?.click()}
      >
        <svg
          className="w-3.5 h-3.5 mr-1 inline-block"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="12" y1="18" x2="12" y2="12" />
          <line x1="9" y1="15" x2="12" y2="12" />
          <line x1="15" y1="15" x2="12" y2="12" />
        </svg>
        Import Statement{"\u200A"}(s)
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = e.target.files;
          if (files && files.length > 0) {
            onFilesSelect(Array.from(files));
            e.target.value = "";
          }
        }}
      />
    </>
  );
}
