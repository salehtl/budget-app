import type { RecurringTransaction } from "../types/database.ts";

export function getNextOccurrence(
  current: string,
  frequency: RecurringTransaction["frequency"],
  customDays?: number | null
): string {
  const d = new Date(current + "T00:00:00");

  switch (frequency) {
    case "daily":
      d.setDate(d.getDate() + 1);
      break;
    case "weekly":
      d.setDate(d.getDate() + 7);
      break;
    case "biweekly":
      d.setDate(d.getDate() + 14);
      break;
    case "monthly":
      d.setMonth(d.getMonth() + 1);
      break;
    case "quarterly":
      d.setMonth(d.getMonth() + 3);
      break;
    case "yearly":
      d.setFullYear(d.getFullYear() + 1);
      break;
    case "custom":
      d.setDate(d.getDate() + (customDays ?? 1));
      break;
  }

  return d.toISOString().split("T")[0]!;
}

export function formatFrequency(
  frequency: RecurringTransaction["frequency"],
  customDays?: number | null
): string {
  switch (frequency) {
    case "daily":
      return "Daily";
    case "weekly":
      return "Weekly";
    case "biweekly":
      return "Every 2 weeks";
    case "monthly":
      return "Monthly";
    case "quarterly":
      return "Quarterly";
    case "yearly":
      return "Yearly";
    case "custom":
      return `Every ${customDays} days`;
  }
}
