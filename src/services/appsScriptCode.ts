export const BUDGET_WEEKS_APPS_SCRIPT_CODE = `/**
 * =========================================================================
 * SIMPLIFIED MOBILE BUDGET APP - GOOGLE APPS SCRIPT (BUDGET WEEKS ENGINE)
 * =========================================================================
 * Currency: Philippine Peso (₱)
 *
 * HOW TO INSTALL IN 3 STEPS:
 * 1. Open your Google Sheet, click "Extensions" > "Apps Script".
 * 2. Delete existing code in Code.gs and paste this entire script.
 * 3. Click Save (Disk icon). From the function dropdown, select
 *    "setupBudgetWeeksSheet" and click "Run". Grant permissions when asked.
 * 
 * (Optional for Webhook sync):
 * Click "Deploy" > "New deployment" > "Web app" > set Access to "Anyone"
 * and copy the Web App URL into the mobile app settings.
 */

const SHEET_NAMES = {
  DASHBOARD: "Dashboard",
  BUDGET_WEEKS: "Budget Weeks",
  TRANSACTIONS: "Transactions"
};

/**
 * 1-Click Initializer: Sets up the 3 tabs and all automated formulas in Philippine Peso (₱).
 */
function setupBudgetWeeksSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 1. Dashboard Tab
  let dashSheet = ss.getSheetByName(SHEET_NAMES.DASHBOARD);
  if (!dashSheet) {
    dashSheet = ss.insertSheet(SHEET_NAMES.DASHBOARD, 0);
  }
  dashSheet.clear();
  dashSheet.setTabColor("#10B981");
  
  dashSheet.getRange("A1:C1").merge().setValue("📱 SIMPLE MOBILE BUDGET TRACKER");
  dashSheet.getRange("A1").setFontSize(14).setFontWeight("bold").setBackground("#064E3B").setFontColor("#FFFFFF");
  
  const dashData = [
    ["Metric", "Amount (PHP ₱)", "Formula / Notes"],
    ["Starting Balance", 10000.00, "Your initial cash in bank or on hand"],
    ["Total Income", '=SUMIF(Transactions!D:D, "income", Transactions!F:F)', "All money added"],
    ["Total Expenses", '=SUMIF(Transactions!D:D, "expense", Transactions!F:F)', "All money spent"],
    ["Available Balance", '=B2+B3-B4', "Current live balance (₱)"]
  ];
  dashSheet.getRange(2, 1, dashData.length, 3).setValues(dashData);
  dashSheet.getRange("A2:C2").setFontWeight("bold").setBackground("#E2E8F0");
  dashSheet.getRange("B2:B6").setNumberFormat('"₱"#,##0.00');
  dashSheet.getRange("A6:C6").setFontSize(13).setFontWeight("bold").setBackground("#DCFCE7");
  dashSheet.autoResizeColumns(1, 3);
  
  // 2. Budget Weeks Tab
  let weeksSheet = ss.getSheetByName(SHEET_NAMES.BUDGET_WEEKS);
  if (!weeksSheet) {
    weeksSheet = ss.insertSheet(SHEET_NAMES.BUDGET_WEEKS, 1);
  }
  weeksSheet.clear();
  weeksSheet.setTabColor("#3B82F6");
  
  const weekHeaders = ["Budget Week", "Starting (₱)", "Total Inflow (₱)", "Total Spent (₱)", "Net Balance (₱)"];
  weeksSheet.getRange(1, 1, 1, 5).setValues([weekHeaders]);
  weeksSheet.getRange("A1:E1").setFontWeight("bold").setBackground("#1E3A8A").setFontColor("#FFFFFF");
  weeksSheet.setFrozenRows(1);
  weeksSheet.autoResizeColumns(1, 5);
  
  // 3. Transactions Tab
  let txSheet = ss.getSheetByName(SHEET_NAMES.TRANSACTIONS);
  if (!txSheet) {
    txSheet = ss.insertSheet(SHEET_NAMES.TRANSACTIONS, 2);
  }
  txSheet.clear();
  txSheet.setTabColor("#EF4444");
  
  const txHeaders = ["ID", "Date", "Time", "Type", "Category", "Amount (₱)", "Balance After (₱)", "Budget Week", "Note", "Logged At"];
  txSheet.getRange(1, 1, 1, 10).setValues([txHeaders]);
  txSheet.getRange("A1:J1").setFontWeight("bold").setBackground("#7F1D1D").setFontColor("#FFFFFF");
  txSheet.setFrozenRows(1);
  txSheet.getRange("F:G").setNumberFormat('"₱"#,##0.00');
  txSheet.autoResizeColumns(1, 10);
  
  // Setup installable onEdit trigger
  setupTriggers();
  
  SpreadsheetApp.flush();
  Logger.log("Budget Weeks Sheet setup complete!");
}

/**
 * Ensures onEdit trigger runs whenever sheet cells change.
 */
function setupTriggers() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const triggers = ScriptApp.getUserTriggers(ss);
  for (let i = 0; i < triggers.length; i++) {
    ScriptApp.deleteTrigger(triggers[i]);
  }
  ScriptApp.newTrigger("onEditRecalculate")
    .forSpreadsheet(ss)
    .onEdit()
    .create();
}

/**
 * Automatically re-evaluates running balances when transactions are added or modified.
 */
function onEditRecalculate(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const txSheet = ss.getSheetByName(SHEET_NAMES.TRANSACTIONS);
  const dashSheet = ss.getSheetByName(SHEET_NAMES.DASHBOARD);
  
  if (!txSheet || !dashSheet) return;
  
  const startBal = Number(dashSheet.getRange("B2").getValue()) || 0;
  const lastRow = txSheet.getLastRow();
  if (lastRow < 2) return;
  
  const data = txSheet.getRange(2, 1, lastRow - 1, 8).getValues();
  let bal = startBal;
  const newBalances = [];
  
  for (let i = 0; i < data.length; i++) {
    const type = String(data[i][3]).toLowerCase();
    const amount = Number(data[i][5]) || 0;
    if (type === "expense") {
      bal -= amount;
    } else if (type === "income") {
      bal += amount;
    }
    newBalances.push([bal]);
  }
  
  // Update Column G (Balance After) in batch
  txSheet.getRange(2, 7, newBalances.length, 1).setValues(newBalances);
}

/**
 * Webhook API for the mobile app (POST request).
 * Allows logging an income or expense directly into the Google Sheet.
 */
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const txSheet = ss.getSheetByName(SHEET_NAMES.TRANSACTIONS);
    const dashSheet = ss.getSheetByName(SHEET_NAMES.DASHBOARD);
    
    if (!txSheet || !dashSheet) {
      setupBudgetWeeksSheet();
    }
    
    const id = data.id || "tx_" + Utilities.getUuid().slice(0, 8);
    const date = data.date || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");
    const time = data.time || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "HH:mm");
    const type = data.type === "income" ? "income" : "expense";
    const category = data.category || (type === "income" ? "Salary" : "Food");
    const amount = Number(data.amount) || 0;
    const balanceAfter = Number(data.balanceAfter) || 0;
    const weekLabel = data.weekLabel || "Current Week";
    const note = data.note || "";
    
    // Append to Transactions tab
    txSheet.appendRow([id, date, time, type, category, amount, balanceAfter, weekLabel, note, new Date()]);
    
    // Update Budget Weeks tab
    updateBudgetWeeksSummary(ss, weekLabel);
    
    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      id: id,
      newBalance: balanceAfter
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: err.message
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Updates the Budget Weeks summary tab with aggregated inflow/outflow for the given week.
 */
function updateBudgetWeeksSummary(ss, weekLabel) {
  const weeksSheet = ss.getSheetByName(SHEET_NAMES.BUDGET_WEEKS);
  const txSheet = ss.getSheetByName(SHEET_NAMES.TRANSACTIONS);
  if (!weeksSheet || !txSheet) return;
  
  const lastRow = weeksSheet.getLastRow();
  let weekRowIndex = -1;
  
  if (lastRow > 1) {
    const weeksList = weeksSheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (let i = 0; i < weeksList.length; i++) {
      if (weeksList[i][0] === weekLabel) {
        weekRowIndex = i + 2;
        break;
      }
    }
  }
  
  if (weekRowIndex === -1) {
    // Append new week row
    const newRow = weeksSheet.getLastRow() + 1;
    const formulaInflow = '=SUMIFS(Transactions!F:F, Transactions!H:H, A' + newRow + ', Transactions!D:D, "income")';
    const formulaOutflow = '=SUMIFS(Transactions!F:F, Transactions!H:H, A' + newRow + ', Transactions!D:D, "expense")';
    const formulaNet = '=B' + newRow + '+C' + newRow + '-D' + newRow;
    
    // Previous week's ending balance as starting balance
    const prevStart = newRow > 2 ? '=E' + (newRow - 1) : '=Dashboard!B2';
    
    weeksSheet.appendRow([weekLabel, prevStart, formulaInflow, formulaOutflow, formulaNet]);
    weeksSheet.getRange(newRow, 2, 1, 4).setNumberFormat('"₱"#,##0.00');
  }
}

/**
 * Webhook API for the mobile app (GET request).
 * Returns live Available Balance and recent entries.
 */
function doGet(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const dashSheet = ss.getSheetByName(SHEET_NAMES.DASHBOARD);
    const currentBalance = dashSheet ? Number(dashSheet.getRange("B5").getValue()) || 0 : 0;
    
    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      availableBalance: currentBalance,
      currency: "PHP (₱)"
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: err.message
    })).setMimeType(ContentService.MimeType.JSON);
  }
}
`;
