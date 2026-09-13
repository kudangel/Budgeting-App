import { ConnectedSheetInfo, MobileTransaction } from '../types';
import { getAccessToken } from './firebaseAuth';

const SHEETS_API_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

export class SheetsApiError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.status = status;
    this.name = 'SheetsApiError';
  }
}

async function getAuthHeaders(): Promise<HeadersInit> {
  const token = getAccessToken();
  if (!token) {
    throw new SheetsApiError('Google authorization required. Please sign in.', 401);
  }
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

/**
 * Creates a new Google Sheet formatted for Budget Weeks in Philippine Peso (₱).
 */
export async function createBudgetWeeksSpreadsheet(
  title: string = 'My Simple Budget (₱)',
  startingBalance: number = 10000
): Promise<ConnectedSheetInfo> {
  const headers = await getAuthHeaders();

  const newSheetPayload = {
    properties: {
      title,
      locale: 'en_PH',
      autoRecalc: 'ON_CHANGE',
    },
    sheets: [
      {
        properties: {
          title: 'Dashboard',
          gridProperties: { rowCount: 30, columnCount: 5, frozenRowCount: 1 },
          tabColor: { red: 0.05, green: 0.6, blue: 0.35 },
        },
      },
      {
        properties: {
          title: 'Budget Weeks',
          gridProperties: { rowCount: 100, columnCount: 6, frozenRowCount: 1 },
          tabColor: { red: 0.2, green: 0.5, blue: 0.9 },
        },
      },
      {
        properties: {
          title: 'Transactions',
          gridProperties: { rowCount: 500, columnCount: 10, frozenRowCount: 1 },
          tabColor: { red: 0.9, green: 0.25, blue: 0.25 },
        },
      },
    ],
  };

  const createRes = await fetch(SHEETS_API_BASE, {
    method: 'POST',
    headers,
    body: JSON.stringify(newSheetPayload),
  });

  if (!createRes.ok) {
    const errorText = await createRes.text();
    throw new SheetsApiError(`Failed to create Google Sheet: ${errorText}`, createRes.status);
  }

  const created = await createRes.json();
  const spreadsheetId = created.spreadsheetId;
  const spreadsheetUrl = created.spreadsheetUrl;

  // Initialize values
  const dashboardValues = [
    ['Metric', 'Amount (PHP ₱)', 'Formula / Notes'],
    ['Starting Balance', startingBalance, 'Initial cash / bank savings'],
    ['Total Income', '=SUMIF(Transactions!D:D, "income", Transactions!F:F)', 'Total cash inflow'],
    ['Total Expenses', '=SUMIF(Transactions!D:D, "expense", Transactions!F:F)', 'Total cash outflow'],
    ['Available Balance', '=B2+B3-B4', 'Instant live available balance'],
  ];

  const weeksHeaders = [
    ['Budget Week', 'Starting (₱)', 'Total Inflow (₱)', 'Total Spent (₱)', 'Net Balance (₱)'],
  ];

  const transactionHeaders = [
    ['ID', 'Date', 'Time', 'Type', 'Category', 'Amount (₱)', 'Balance After (₱)', 'Budget Week', 'Note', 'Logged At'],
  ];

  await fetch(`${SHEETS_API_BASE}/${spreadsheetId}/values:batchUpdate`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      valueInputOption: 'USER_ENTERED',
      data: [
        {
          range: "'Dashboard'!A1:C5",
          values: dashboardValues,
        },
        {
          range: "'Budget Weeks'!A1:E1",
          values: weeksHeaders,
        },
        {
          range: "'Transactions'!A1:J1",
          values: transactionHeaders,
        },
      ],
    }),
  });

  return {
    spreadsheetId,
    spreadsheetUrl,
    title,
    lastSyncedAt: new Date().toISOString(),
    weeksCreated: true,
  };
}

/**
 * Appends an Income or Expense transaction into the Transactions sheet.
 */
export async function appendMobileTransactionToSheet(
  spreadsheetId: string,
  tx: MobileTransaction
): Promise<number | undefined> {
  const headers = await getAuthHeaders();

  const row = [
    tx.id,
    tx.date,
    tx.time,
    tx.type,
    tx.category,
    tx.amount,
    tx.balanceAfter,
    tx.weekLabel,
    tx.note || '',
    new Date().toISOString(),
  ];

  const res = await fetch(
    `${SHEETS_API_BASE}/${spreadsheetId}/values/'Transactions'!A:J:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        values: [row],
      }),
    }
  );

  if (!res.ok) {
    const errorText = await res.text();
    throw new SheetsApiError(`Could not save transaction to sheet: ${errorText}`, res.status);
  }

  const result = await res.json();
  const updatedRange = result.updates?.updatedRange;
  if (updatedRange) {
    const match = updatedRange.match(/([0-9]+)$/);
    if (match) return parseInt(match[1], 10);
  }
  return undefined;
}

/**
 * Reads all transactions from the connected Google Sheet.
 */
export async function fetchMobileTransactionsFromSheet(spreadsheetId: string): Promise<MobileTransaction[]> {
  const headers = await getAuthHeaders();

  const res = await fetch(
    `${SHEETS_API_BASE}/${spreadsheetId}/values/'Transactions'!A2:J500`,
    { headers }
  );

  if (!res.ok) {
    throw new SheetsApiError(`Could not read transactions from sheet`, res.status);
  }

  const data = await res.json();
  const rows: any[][] = data.values || [];

  return rows
    .filter(row => row && row[0] && row[5])
    .map((row, idx) => {
      const amount = parseFloat(String(row[5]).replace(/[^0-9.-]+/g, '')) || 0;
      const balanceAfter = parseFloat(String(row[6]).replace(/[^0-9.-]+/g, '')) || 0;

      return {
        id: String(row[0]),
        date: String(row[1] || new Date().toISOString().split('T')[0]),
        time: String(row[2] || '12:00'),
        type: String(row[3]).toLowerCase() === 'income' ? 'income' : 'expense',
        category: String(row[4] || 'Other'),
        categoryIcon: getCategoryEmoji(String(row[4])),
        amount,
        balanceAfter,
        weekLabel: String(row[7] || ''),
        note: String(row[8] || ''),
        syncStatus: 'synced',
        sheetRowIndex: idx + 2,
      };
    });
}

function getCategoryEmoji(category: string): string {
  const cat = (category || '').toLowerCase();
  if (cat.includes('food') || cat.includes('pagkain') || cat.includes('grocery')) return '🍚';
  if (cat.includes('transpo') || cat.includes('pamasahe') || cat.includes('gas')) return '🚗';
  if (cat.includes('bill') || cat.includes('kuryente') || cat.includes('tubig') || cat.includes('wifi')) return '💡';
  if (cat.includes('shop') || cat.includes('gamit')) return '🛍️';
  if (cat.includes('health') || cat.includes('gamot')) return '💊';
  if (cat.includes('salary') || cat.includes('sweldo')) return '💼';
  if (cat.includes('allowance') || cat.includes('padala')) return '🎁';
  if (cat.includes('gig') || cat.includes('extra') || cat.includes('sideline')) return '💰';
  return '📦';
}

/**
 * Deletes a row from the Transactions sheet (requires explicit confirmation).
 */
export async function deleteMobileTransactionRow(
  spreadsheetId: string,
  rowIndex: number
): Promise<void> {
  const headers = await getAuthHeaders();

  const metaRes = await fetch(`${SHEETS_API_BASE}/${spreadsheetId}?fields=sheets(properties(sheetId,title))`, { headers });
  if (!metaRes.ok) throw new SheetsApiError('Failed to fetch spreadsheet metadata');
  const metaData = await metaRes.json();
  const txSheet = metaData.sheets?.find((s: any) => s.properties.title === 'Transactions');
  const sheetId = txSheet ? txSheet.properties.sheetId : 0;

  const deleteRequest = {
    requests: [
      {
        deleteDimension: {
          range: {
            sheetId,
            dimension: 'ROWS',
            startIndex: rowIndex - 1,
            endIndex: rowIndex,
          },
        },
      },
    ],
  };

  const res = await fetch(`${SHEETS_API_BASE}/${spreadsheetId}:batchUpdate`, {
    method: 'POST',
    headers,
    body: JSON.stringify(deleteRequest),
  });

  if (!res.ok) {
    throw new SheetsApiError(`Failed to delete transaction row from sheet`, res.status);
  }
}
