// 全域狀態管理 (State Management)
export const state = {
  allRecords: [],
  monthlyExpensesData: {},
  monthlyIncomesData: {},
  currentChartType: "expense",
  currentDetailFilter: { type: "", value: "", month: "" },
  globalCategories: [],
  globalPayments: [],
};
