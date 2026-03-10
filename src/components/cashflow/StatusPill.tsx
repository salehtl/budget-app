export function StatusPill({ status, onClick, disabled }: { status: "planned" | "confirmed"; onClick: () => void; disabled?: boolean }) {
  const isPlanned = status === "planned";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold transition-colors cursor-pointer leading-tight ${
        isPlanned
          ? "border border-dashed border-border-dark text-text-light hover:border-accent hover:text-accent"
          : "bg-success/10 text-success hover:bg-success/20"
      }`}
      title={isPlanned ? "Mark as confirmed" : "Mark as planned"}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${isPlanned ? "bg-text-light/50" : "bg-success"}`} />
      {isPlanned ? "Plan" : "Conf"}
    </button>
  );
}
