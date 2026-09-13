export type TransactionType = 'income' | 'expense';

export type ExpenseCategory = 'Food' | 'Transpo' | 'Bills' | 'Shopping' | 'Health' | 'Other';
export type IncomeCategory = 'Salary' | 'Allowance' | 'Side Gig' | 'Other';

export interface MobileTransaction {
  id: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  weekLabel: string; // e.g., "Week 37 (Sep 8-14)"
  type: TransactionType;
  category: string;
  categoryIcon: string;
  amount: number; // in Philippine Peso (₱)
  note?: string;
  balanceAfter: number; // in Philippine Peso (₱)
  syncStatus: 'synced' | 'pending' | 'syncing' | 'failed';
  sheetRowIndex?: number;
}

export interface BudgetWeekSummary {
  weekKey: string;
  weekLabel: string;
  startingBalance: number;
  totalIncome: number;
  totalExpense: number;
  endingBalance: number;
}

export interface MobileBudgetConfig {
  availableBalance: number; // ₱
  startingBalance: number; // ₱
  currencySymbol: string; // '₱'
  activeWeek: string;
  autoSync: boolean;
}

export interface ConnectedSheetInfo {
  spreadsheetId: string;
  spreadsheetUrl: string;
  title: string;
  lastSyncedAt: string | null;
  weeksCreated: boolean;
}
