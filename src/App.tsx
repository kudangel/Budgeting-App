import React, { useState, useEffect, useCallback } from 'react';
import { User } from 'firebase/auth';
import {
  Plus,
  Minus,
  Settings,
  RefreshCw,
  Trash2,
  Calendar,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

import {
  MobileBudgetConfig,
  MobileTransaction,
  ConnectedSheetInfo,
  TransactionType,
} from './types';
import { INITIAL_MOBILE_CONFIG, INITIAL_MOBILE_TRANSACTIONS } from './services/sampleData';
import { getBudgetWeekLabel } from './services/budgetWeeksService';
import {
  initAuth,
  googleSignIn,
  logout,
  setCachedAccessToken,
} from './services/firebaseAuth';
import {
  appendMobileTransactionToSheet,
  deleteMobileTransactionRow,
  fetchMobileTransactionsFromSheet,
} from './services/googleSheetsService';

import { AddTransactionModal } from './components/AddTransactionModal';
import { SimpleSettingsModal } from './components/SimpleSettingsModal';
import { ConfirmationModal } from './components/ConfirmationModal';

export default function App() {
  const [user, setUser] = useState<User | null>(null);

  const [config, setConfig] = useState<MobileBudgetConfig>(() => {
    const saved = localStorage.getItem('simple_budget_config');
    return saved ? JSON.parse(saved) : INITIAL_MOBILE_CONFIG;
  });

  const [transactions, setTransactions] = useState<MobileTransaction[]>(() => {
    const saved = localStorage.getItem('simple_budget_transactions');
    return saved ? JSON.parse(saved) : INITIAL_MOBILE_TRANSACTIONS;
  });

  const [sheet, setSheet] = useState<ConnectedSheetInfo | null>(() => {
    const saved = localStorage.getItem('simple_budget_sheet');
    return saved ? JSON.parse(saved) : null;
  });

  // Modal states
  const [activeModalType, setActiveModalType] = useState<TransactionType | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [pendingDeleteTx, setPendingDeleteTx] = useState<MobileTransaction | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Friendly toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  }, []);

  // Save to localStorage
  useEffect(() => {
    localStorage.setItem('simple_budget_config', JSON.stringify(config));
  }, [config]);

  useEffect(() => {
    localStorage.setItem('simple_budget_transactions', JSON.stringify(transactions));
  }, [transactions]);

  useEffect(() => {
    if (sheet) {
      localStorage.setItem('simple_budget_sheet', JSON.stringify(sheet));
    } else {
      localStorage.removeItem('simple_budget_sheet');
    }
  }, [sheet]);

  // Listen to Firebase Auth
  useEffect(() => {
    const unsubscribe = initAuth(
      (currentUser, token) => {
        setUser(currentUser);
        setCachedAccessToken(token);
      },
      () => {
        setUser(null);
        setCachedAccessToken(null);
      }
    );
    return () => unsubscribe();
  }, []);

  // Silent Auto-Deduction and Transaction Logger
  const handleSaveTransaction = async (data: {
    type: TransactionType;
    amount: number;
    category: string;
    categoryIcon: string;
    note?: string;
  }) => {
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toTimeString().slice(0, 5);
    const weekLabel = getBudgetWeekLabel(dateStr);

    // Instant math auto-deduction in background
    const isIncome = data.type === 'income';
    const newBalance = isIncome
      ? config.availableBalance + data.amount
      : config.availableBalance - data.amount;

    const newTx: MobileTransaction = {
      id: `tx_${Date.now()}`,
      date: dateStr,
      time: timeStr,
      weekLabel,
      type: data.type,
      category: data.category,
      categoryIcon: data.categoryIcon,
      amount: data.amount,
      note: data.note,
      balanceAfter: newBalance,
      syncStatus: sheet ? 'syncing' : 'synced',
    };

    // 1. Instantly update UI and Available Balance
    const updatedList = [newTx, ...transactions];
    setTransactions(updatedList);
    setConfig(prev => ({
      ...prev,
      availableBalance: newBalance,
      activeWeek: weekLabel,
    }));

    showToast(
      isIncome
        ? `Added ₱${data.amount.toLocaleString('en-PH')} to your balance`
        : `Deducted ₱${data.amount.toLocaleString('en-PH')} for ${data.category}`
    );

    // 2. Silent background sync to Google Sheet (Budget Weeks structure)
    if (sheet) {
      try {
        const rowIndex = await appendMobileTransactionToSheet(sheet.spreadsheetId, newTx);
        setTransactions(prev =>
          prev.map(t => (t.id === newTx.id ? { ...t, syncStatus: 'synced', sheetRowIndex: rowIndex } : t))
        );
      } catch (err: any) {
        console.error('Silent sync failed:', err);
        setTransactions(prev =>
          prev.map(t => (t.id === newTx.id ? { ...t, syncStatus: 'failed' } : t))
        );
      }
    }
  };

  // Safe delete transaction
  const executeDelete = async () => {
    if (!pendingDeleteTx) return;
    setIsDeleting(true);

    const target = pendingDeleteTx;
    try {
      if (sheet && target.sheetRowIndex) {
        await deleteMobileTransactionRow(sheet.spreadsheetId, target.sheetRowIndex);
      }

      // Re-evaluate list and available balance
      const remaining = transactions.filter(t => t.id !== target.id);
      
      // Calculate new available balance from starting balance
      let bal = config.startingBalance;
      const reversed = [...remaining].reverse();
      for (const t of reversed) {
        if (t.type === 'income') bal += t.amount;
        else bal -= t.amount;
      }

      setTransactions(remaining);
      setConfig(prev => ({ ...prev, availableBalance: bal }));
      showToast(`Removed entry. Balance updated.`);
    } catch (err) {
      console.error('Failed to delete:', err);
      showToast('Could not delete from Google Sheet.');
    } finally {
      setIsDeleting(false);
      setPendingDeleteTx(null);
    }
  };

  // Refresh from sheet
  const handleRefreshSheet = async () => {
    if (!sheet) {
      setIsSettingsOpen(true);
      return;
    }
    setIsSyncing(true);
    try {
      const sheetTxs = await fetchMobileTransactionsFromSheet(sheet.spreadsheetId);
      if (sheetTxs.length > 0) {
        setTransactions(sheetTxs.reverse());
        // Calculate new balance
        let bal = config.startingBalance;
        for (const t of sheetTxs) {
          if (t.type === 'income') bal += t.amount;
          else bal -= t.amount;
        }
        setConfig(prev => ({ ...prev, availableBalance: bal }));
        showToast('Synced with Google Sheet!');
      }
    } catch (err) {
      console.error('Refresh error:', err);
      showToast('Sync error with Google Sheet');
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex justify-center selection:bg-emerald-200">
      {/* Mobile Device Viewport Container (Native mobile feel) */}
      <div className="w-full max-w-md bg-slate-50 min-h-screen flex flex-col shadow-2xl relative pb-8">
        {/* Top Header Bar */}
        <header className="px-5 pt-4 pb-3 flex items-center justify-between bg-white border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-sm">
              ₱
            </div>
            <span className="font-extrabold text-base tracking-tight text-slate-900">
              Simple Budget
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Sync status indicator */}
            <button
              onClick={handleRefreshSheet}
              className="px-2 py-1 rounded-full text-[11px] font-medium flex items-center gap-1.5 transition-colors bg-slate-100 hover:bg-slate-200 text-slate-600"
              title="Click to sync with Google Sheet"
            >
              {sheet ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="font-semibold text-emerald-800">Sheet Synced</span>
                </>
              ) : (
                <>
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  <span className="text-slate-500">Offline</span>
                </>
              )}
              <RefreshCw className={`w-3 h-3 ml-0.5 ${isSyncing ? 'animate-spin' : ''}`} />
            </button>

            {/* Settings button */}
            <button
              id="open-settings-btn"
              onClick={() => setIsSettingsOpen(true)}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 transition-all"
              aria-label="Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Friendly Toast Notification */}
        {toastMessage && (
          <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top-2 duration-200">
            <div className="bg-slate-900 text-white px-4 py-2 rounded-full text-xs font-bold shadow-lg flex items-center gap-2 border border-slate-700">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>{toastMessage}</span>
            </div>
          </div>
        )}

        <main className="flex-1 px-4 sm:px-5 py-5 space-y-5">
          {/* ========================================================= */}
          {/* MASSIVE EASY-TO-READ "AVAILABLE BALANCE" AT THE TOP      */}
          {/* ========================================================= */}
          <div
            id="available-balance-card"
            className="p-6 bg-gradient-to-b from-white to-slate-50/80 rounded-3xl border border-slate-200/90 shadow-sm text-center relative overflow-hidden"
          >
            {/* Active Budget Week Badge */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold mb-3">
              <Calendar className="w-3 h-3 text-slate-400" />
              <span>{config.activeWeek || getBudgetWeekLabel()}</span>
            </div>

            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">
              Available Balance
            </h2>

            {/* The Massive ₱ Amount */}
            <div className="flex items-baseline justify-center font-mono font-black text-slate-900 tracking-tight my-1">
              <span className="text-2xl sm:text-3xl text-slate-400 mr-1.5 select-none">₱</span>
              <span className="text-4xl sm:text-5xl">
                {config.availableBalance.toLocaleString('en-PH', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            </div>

            <p className="text-[11px] text-slate-400 font-medium mt-1">
              Auto-deducted in real-time &bull; Philippine Peso
            </p>
          </div>

          {/* ========================================================= */}
          {/* TWO GIANT COLOR-CODED BUTTONS: ADD INCOME & ADD EXPENSE    */}
          {/* ========================================================= */}
          <div className="grid grid-cols-2 gap-3.5 pt-1">
            {/* Giant Green Button: Add Income */}
            <button
              id="giant-add-income-btn"
              type="button"
              onClick={() => setActiveModalType('income')}
              className="h-24 sm:h-28 rounded-3xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white flex flex-col items-center justify-center p-3 shadow-md shadow-emerald-600/25 transition-all border border-emerald-500"
            >
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center mb-1.5">
                <Plus className="w-6 h-6 stroke-[3]" />
              </div>
              <span className="text-base sm:text-lg font-black tracking-tight leading-none">
                Add Income
              </span>
              <span className="text-[11px] text-emerald-100 font-medium mt-1">
                Pera Pumasok
              </span>
            </button>

            {/* Giant Red Button: Add Expense */}
            <button
              id="giant-add-expense-btn"
              type="button"
              onClick={() => setActiveModalType('expense')}
              className="h-24 sm:h-28 rounded-3xl bg-rose-600 hover:bg-rose-700 active:scale-95 text-white flex flex-col items-center justify-center p-3 shadow-md shadow-rose-600/25 transition-all border border-rose-500"
            >
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center mb-1.5">
                <Minus className="w-6 h-6 stroke-[3]" />
              </div>
              <span className="text-base sm:text-lg font-black tracking-tight leading-none">
                Add Expense
              </span>
              <span className="text-[11px] text-rose-100 font-medium mt-1">
                Gastos
              </span>
            </button>
          </div>

          {/* ========================================================= */}
          {/* RECENT ACTIVITY LIST (FOOLPROOF, CLEAN, NO JARGON)         */}
          {/* ========================================================= */}
          <div className="pt-2">
            <div className="flex items-center justify-between mb-3 px-1">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Recent Activity ({transactions.length})
              </h3>
              <span className="text-[11px] text-slate-400 font-medium">
                Tap trash to delete
              </span>
            </div>

            {transactions.length === 0 ? (
              <div className="p-8 text-center bg-white rounded-3xl border border-dashed border-slate-200">
                <div className="text-3xl mb-2">💸</div>
                <p className="text-sm font-bold text-slate-700">No activity yet</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Tap the big green or red button above to log your first transaction!
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {transactions.slice(0, 10).map(t => {
                  const isIncome = t.type === 'income';

                  return (
                    <div
                      key={t.id}
                      className="p-3.5 bg-white rounded-2xl border border-slate-200/80 flex items-center justify-between gap-3 shadow-2xs hover:border-slate-300 transition-all"
                    >
                      {/* Left: Icon & Description */}
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-11 h-11 rounded-2xl flex items-center justify-center text-xl shrink-0 ${
                            isIncome ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                          }`}
                        >
                          {t.categoryIcon}
                        </div>

                        <div className="min-w-0">
                          <span className="font-bold text-sm text-slate-900 block truncate leading-tight">
                            {t.note || t.category}
                          </span>
                          <span className="text-[11px] text-slate-400 mt-0.5 block">
                            {t.date} &bull; {t.category}
                          </span>
                        </div>
                      </div>

                      {/* Right: Amount & Delete */}
                      <div className="flex items-center gap-2.5 shrink-0">
                        <div className="text-right">
                          <span
                            className={`font-mono font-extrabold text-sm block ${
                              isIncome ? 'text-emerald-600' : 'text-rose-600'
                            }`}
                          >
                            {isIncome ? '+' : '-'}₱{t.amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono block">
                            Bal: ₱{t.balanceAfter.toLocaleString('en-PH', { maximumFractionDigits: 0 })}
                          </span>
                        </div>

                        <button
                          onClick={() => setPendingDeleteTx(t)}
                          className="p-1.5 text-slate-300 hover:text-rose-600 rounded-lg transition-colors"
                          title="Delete entry"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </main>

        {/* Tap-and-Go Add Transaction Modal Sheet */}
        <AddTransactionModal
          isOpen={activeModalType !== null}
          type={activeModalType || 'expense'}
          currentBalance={config.availableBalance}
          onClose={() => setActiveModalType(null)}
          onSave={handleSaveTransaction}
        />

        {/* Simplified Settings Modal */}
        <SimpleSettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          config={config}
          sheet={sheet}
          user={user}
          onSignIn={async () => {
            try {
              const res = await googleSignIn();
              if (res) {
                setUser(res.user);
                setCachedAccessToken(res.accessToken);
                showToast('Google account connected.');
              }
            } catch (err: any) {
              showToast(err.message || 'Failed to sign in');
            }
          }}
          onSignOut={async () => {
            await logout();
            setUser(null);
            setCachedAccessToken(null);
            showToast('Signed out.');
          }}
          onUpdateConfig={newConf => {
            setConfig(newConf);
            showToast('Starting balance updated.');
          }}
          onSheetConnected={s => {
            setSheet(s);
            showToast(`Connected to "${s.title}"!`);
          }}
        />

        {/* Confirmation Modal for Destructive Delete */}
        <ConfirmationModal
          isOpen={Boolean(pendingDeleteTx)}
          title="Delete Transaction"
          message={
            pendingDeleteTx
              ? `Remove ${pendingDeleteTx.category} (${pendingDeleteTx.type === 'income' ? '+' : '-'}₱${pendingDeleteTx.amount.toLocaleString('en-PH')})? Your balance will be recalculated automatically.`
              : ''
          }
          confirmLabel="Yes, Remove"
          cancelLabel="Cancel"
          isDestructive={true}
          isLoading={isDeleting}
          onConfirm={executeDelete}
          onCancel={() => setPendingDeleteTx(null)}
        />
      </div>
    </div>
  );
}
