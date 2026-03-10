import { StatusPill } from "../../../ui/StatusPill.tsx";

interface StatusCellProps {
  status: "planned" | "confirmed" | "review";
  onToggle: () => void;
}

export function StatusCell({ status, onToggle }: StatusCellProps) {
  return (
    <div className="flex justify-center" onClick={(e) => e.stopPropagation()}>
      <StatusPill status={status} onClick={onToggle} />
    </div>
  );
}
