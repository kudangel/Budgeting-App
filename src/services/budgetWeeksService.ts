import { MobileTransaction, BudgetWeekSummary } from '../types';

/**
 * Gets a friendly week label for a given date string (YYYY-MM-DD).
 * e.g., "Week of Sep 8, 2026"
 */
export function getBudgetWeekLabel(dateStr?: string): string {
  const date = dateStr ? new Date(dateStr) : new Date();
  
  // Find Monday of the current week
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(date.setDate(diff));
  
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = monthNames[monday.getMonth()];
  const startDay = monday.getDate();
  
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const endMonth = monthNames[sunday.getMonth()];
  const endDay = sunday.getDate();
  const year = sunday.getFullYear();

  if (month === endMonth) {
    return `${month} ${startDay} - ${endDay}, ${year}`;
  }
  return `${month} ${startDay} - ${endMonth} ${endDay}, ${year}`;
}

/**
 * Aggregates transactions into Budget Weeks summaries.
 */
export function calculateBudgetWeeks(
  initialBalance: number,
  transactions: MobileTransaction[]
): BudgetWeekSummary[] {
  // Sort oldest to newest
  const sorted = [...transactions].sort((a, b) => {
    return new Date(`${a.date} ${a.time}`).getTime() - new Date(`${b.date} ${b.time}`).getTime();
  });

  const weekGroups: Record<string, { weekLabel: string; income: number; expense: number }> = {};

  for (const tx of sorted) {
    const week = tx.weekLabel || getBudgetWeekLabel(tx.date);
    if (!weekGroups[week]) {
      weekGroups[week] = { weekLabel: week, income: 0, expense: 0 };
    }
    if (tx.type === 'income') {
      weekGroups[week].income += tx.amount;
    } else {
      weekGroups[week].expense += tx.amount;
    }
  }

  let running = initialBalance;
  const summaries: BudgetWeekSummary[] = [];

  for (const [key, val] of Object.entries(weekGroups)) {
    const start = running;
    running = running + val.income - val.expense;
    summaries.push({
      weekKey: key,
      weekLabel: val.weekLabel,
      startingBalance: start,
      totalIncome: val.income,
      totalExpense: val.expense,
      endingBalance: running,
    });
  }

  return summaries.reverse(); // Newest weeks first
}
