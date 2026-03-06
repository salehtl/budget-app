export const DEFAULT_CATEGORIES = [
  // Expense categories
  { id: "cat-housing", name: "Housing", color: "#6366f1", icon: "home", sort_order: 1, is_income: 0 },
  { id: "cat-housing-rent", name: "Rent", color: "#6366f1", icon: "home", sort_order: 1, is_income: 0, parent_id: "cat-housing" },
  { id: "cat-housing-utilities", name: "Utilities", color: "#6366f1", icon: "zap", sort_order: 2, is_income: 0, parent_id: "cat-housing" },
  { id: "cat-housing-maintenance", name: "Maintenance", color: "#6366f1", icon: "wrench", sort_order: 3, is_income: 0, parent_id: "cat-housing" },

  { id: "cat-transport", name: "Transportation", color: "#f59e0b", icon: "car", sort_order: 2, is_income: 0 },
  { id: "cat-transport-fuel", name: "Fuel", color: "#f59e0b", icon: "fuel", sort_order: 1, is_income: 0, parent_id: "cat-transport" },
  { id: "cat-transport-public", name: "Public Transport", color: "#f59e0b", icon: "bus", sort_order: 2, is_income: 0, parent_id: "cat-transport" },

  { id: "cat-food", name: "Food", color: "#ef4444", icon: "utensils", sort_order: 3, is_income: 0 },
  { id: "cat-food-groceries", name: "Groceries", color: "#ef4444", icon: "shopping-cart", sort_order: 1, is_income: 0, parent_id: "cat-food" },
  { id: "cat-food-dining", name: "Dining Out", color: "#ef4444", icon: "utensils", sort_order: 2, is_income: 0, parent_id: "cat-food" },
  { id: "cat-food-coffee", name: "Coffee", color: "#ef4444", icon: "coffee", sort_order: 3, is_income: 0, parent_id: "cat-food" },

  { id: "cat-health", name: "Healthcare", color: "#ec4899", icon: "heart", sort_order: 4, is_income: 0 },
  { id: "cat-health-medical", name: "Medical", color: "#ec4899", icon: "stethoscope", sort_order: 1, is_income: 0, parent_id: "cat-health" },
  { id: "cat-health-pharmacy", name: "Pharmacy", color: "#ec4899", icon: "pill", sort_order: 2, is_income: 0, parent_id: "cat-health" },

  { id: "cat-entertainment", name: "Entertainment", color: "#8b5cf6", icon: "film", sort_order: 5, is_income: 0 },
  { id: "cat-entertainment-subs", name: "Subscriptions", color: "#8b5cf6", icon: "tv", sort_order: 1, is_income: 0, parent_id: "cat-entertainment" },
  { id: "cat-entertainment-hobbies", name: "Hobbies", color: "#8b5cf6", icon: "gamepad", sort_order: 2, is_income: 0, parent_id: "cat-entertainment" },

  { id: "cat-shopping", name: "Shopping", color: "#14b8a6", icon: "bag", sort_order: 6, is_income: 0 },
  { id: "cat-shopping-clothing", name: "Clothing", color: "#14b8a6", icon: "shirt", sort_order: 1, is_income: 0, parent_id: "cat-shopping" },
  { id: "cat-shopping-electronics", name: "Electronics", color: "#14b8a6", icon: "laptop", sort_order: 2, is_income: 0, parent_id: "cat-shopping" },

  { id: "cat-education", name: "Education", color: "#0ea5e9", icon: "book", sort_order: 7, is_income: 0 },

  { id: "cat-personal", name: "Personal", color: "#f97316", icon: "user", sort_order: 8, is_income: 0 },
  { id: "cat-personal-gifts", name: "Gifts", color: "#f97316", icon: "gift", sort_order: 1, is_income: 0, parent_id: "cat-personal" },
  { id: "cat-personal-selfcare", name: "Self-Care", color: "#f97316", icon: "spa", sort_order: 2, is_income: 0, parent_id: "cat-personal" },

  { id: "cat-financial", name: "Financial", color: "#64748b", icon: "landmark", sort_order: 9, is_income: 0 },
  { id: "cat-financial-fees", name: "Bank Fees", color: "#64748b", icon: "credit-card", sort_order: 1, is_income: 0, parent_id: "cat-financial" },
  { id: "cat-financial-insurance", name: "Insurance", color: "#64748b", icon: "shield", sort_order: 2, is_income: 0, parent_id: "cat-financial" },

  { id: "cat-other", name: "Other", color: "#94a3b8", icon: "more-horizontal", sort_order: 10, is_income: 0 },

  // Income categories
  { id: "cat-income-salary", name: "Salary", color: "#16a34a", icon: "briefcase", sort_order: 1, is_income: 1 },
  { id: "cat-income-freelance", name: "Freelance", color: "#16a34a", icon: "laptop", sort_order: 2, is_income: 1 },
  { id: "cat-income-investments", name: "Investments", color: "#16a34a", icon: "trending-up", sort_order: 3, is_income: 1 },
  { id: "cat-income-other", name: "Other Income", color: "#16a34a", icon: "plus-circle", sort_order: 4, is_income: 1 },
];

export function getSeedSQL(): string {
  const statements = DEFAULT_CATEGORIES.map((cat) => {
    const parentId = (cat as { parent_id?: string }).parent_id ?? null;
    return `INSERT OR IGNORE INTO categories (id, name, parent_id, color, icon, sort_order, is_income, is_system)
      VALUES ('${cat.id}', '${cat.name}', ${parentId ? `'${parentId}'` : "NULL"}, '${cat.color}', '${cat.icon}', ${cat.sort_order}, ${cat.is_income}, 1);`;
  });
  return statements.join("\n");
}
