import React, { useState, useEffect } from 'react';
import { X, Check, ArrowDown, ArrowUp } from 'lucide-react';
import { NumberPad } from './NumberPad';
import { TransactionType } from '../types';

interface AddTransactionModalProps {
  isOpen: boolean;
  type: TransactionType;
  currentBalance: number;
  onClose: () => void;
  onSave: (data: {
    type: TransactionType;
    amount: number;
    category: string;
    categoryIcon: string;
    note?: string;
  }) => Promise<void>;
}

const EXPENSE_CATEGORIES = [
  { id: 'Food', label: 'Food', sublabel: 'Pagkain', icon: '🍚', color: 'bg-amber-100 border-amber-300 text-amber-900' },
  { id: 'Transpo', label: 'Transpo', sublabel: 'Pamasahe', icon: '🚗', color: 'bg-blue-100 border-blue-300 text-blue-900' },
  { id: 'Bills', label: 'Bills', sublabel: 'Kuryente/Net', icon: '💡', color: 'bg-rose-100 border-rose-300 text-rose-900' },
  { id: 'Shopping', label: 'Shopping', sublabel: 'Gamit', icon: '🛍️', color: 'bg-purple-100 border-purple-300 text-purple-900' },
  { id: 'Health', label: 'Health', sublabel: 'Gamot', icon: '💊', color: 'bg-emerald-100 border-emerald-300 text-emerald-900' },
  { id: 'Other', label: 'Other', sublabel: 'Iba pa', icon: '📦', color: 'bg-slate-100 border-slate-300 text-slate-900' },
];

const INCOME_CATEGORIES = [
  { id: 'Salary', label: 'Salary', sublabel: 'Sweldo', icon: '💼', color: 'bg-emerald-100 border-emerald-300 text-emerald-900' },
  { id: 'Allowance', label: 'Allowance', sublabel: 'Padala', icon: '🎁', color: 'bg-pink-100 border-pink-300 text-pink-900' },
  { id: 'Side Gig', label: 'Side Gig', sublabel: 'Extra kita', icon: '💰', color: 'bg-amber-100 border-amber-300 text-amber-900' },
  { id: 'Other', label: 'Other', sublabel: 'Iba pa', icon: '📦', color: 'bg-slate-100 border-slate-300 text-slate-900' },
];

const QUICK_NOTES_EXPENSE: Record<string, string[]> = {
  Food: ['Jollibee / Fastfood', 'Palengke / Grocery', 'Kape / Milk Tea', 'Karenderya'],
  Transpo: ['Jeep / Bus', 'Grab / Taxi', 'Gasolina', 'Tricycle / Angkas'],
  Bills: ['Meralco (Kuryente)', 'Maynilad / Manila Water', 'Internet / Wifi', 'Load / Phone'],
  Shopping: ['Shopee / Lazada', 'Damit / Personal', 'Groceries'],
  Health: ['Gamot / Mercury', 'Checkup / Clinic'],
  Other: ['Miscellaneous'],
};

export const AddTransactionModal: React.FC<AddTransactionModalProps> = ({
  isOpen,
  type,
  currentBalance,
  onClose,
  onSave,
}) => {
  const [amountStr, setAmountStr] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>(
    type === 'income' ? 'Salary' : 'Food'
  );
  const [note, setNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setAmountStr('');
      setSelectedCategory(type === 'income' ? 'Salary' : 'Food');
      setNote('');
      setIsSaving(false);
    }
  }, [isOpen, type]);

  if (!isOpen) return null;

  const categories = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const currentCatObj = categories.find(c => c.id === selectedCategory) || categories[0];

  const parsedAmount = parseFloat(amountStr) || 0;
  const newBalance = type === 'income' ? currentBalance + parsedAmount : currentBalance - parsedAmount;

  const handleQuickAdd = (val: number) => {
    const cur = parseFloat(amountStr) || 0;
    setAmountStr((cur + val).toString());
  };

  const handleSubmit = async () => {
    if (parsedAmount <= 0 || isSaving) return;

    setIsSaving(true);
    try {
      await onSave({
        type,
        amount: parsedAmount,
        category: currentCatObj.label,
        categoryIcon: currentCatObj.icon,
        note: note.trim() || undefined,
      });
      onClose();
    } catch (err) {
      console.error('Save failed:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const isIncome = type === 'income';

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150 sm:items-center sm:justify-center p-0 sm:p-4">
      <div
        id="add-transaction-modal-sheet"
        className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[95vh]"
      >
        {/* Top Bar */}
        <div
          className={`px-5 py-4 flex items-center justify-between text-white ${
            isIncome ? 'bg-emerald-600' : 'bg-rose-600'
          }`}
        >
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center font-bold">
              {isIncome ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
            </div>
            <div>
              <h3 className="font-extrabold text-base tracking-tight">
                {isIncome ? '➕ Add Income (Pera Pumasok)' : '➖ Add Expense (Gastos)'}
              </h3>
            </div>
          </div>
          <button
            id="close-add-modal-btn"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content Area */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {/* Amount Display */}
          <div className="text-center py-2 bg-slate-50 rounded-2xl border border-slate-200/90">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Enter Amount
            </span>
            <div className="flex items-baseline justify-center font-mono font-extrabold text-slate-900 tracking-tight">
              <span className="text-2xl text-slate-400 mr-1">₱</span>
              <span className="text-4xl sm:text-5xl">
                {amountStr ? Number(amountStr).toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : '0'}
              </span>
            </div>

            {/* Silent Auto-Deduction Balance Preview */}
            <div className="mt-2 text-xs font-medium text-slate-500 flex items-center justify-center gap-1.5">
              <span>New Balance:</span>
              <span className="font-mono font-bold text-slate-800">
                ₱{newBalance.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              {parsedAmount > 0 && (
                <span className={`text-[11px] font-bold ${isIncome ? 'text-emerald-600' : 'text-rose-600'}`}>
                  ({isIncome ? '+' : '-'}₱{parsedAmount.toLocaleString('en-PH')})
                </span>
              )}
            </div>
          </div>

          {/* Big Category Icons Picker */}
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-2">
              Select Category:
            </span>
            <div className={`grid ${isIncome ? 'grid-cols-2' : 'grid-cols-3'} gap-2`}>
              {categories.map(cat => {
                const isSelected = selectedCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`p-2.5 rounded-2xl border-2 flex flex-col items-center justify-center gap-1 transition-all active:scale-95 text-center ${
                      isSelected
                        ? isIncome
                          ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-400/40 shadow-xs'
                          : 'bg-rose-50 border-rose-500 ring-2 ring-rose-400/40 shadow-xs'
                        : 'bg-slate-50 border-slate-200/80 hover:bg-slate-100'
                    }`}
                  >
                    <span className="text-2xl">{cat.icon}</span>
                    <span className="text-xs font-bold text-slate-900 leading-tight block">
                      {cat.label}
                    </span>
                    <span className="text-[10px] text-slate-400 block leading-none">
                      {cat.sublabel}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick Note Suggestions */}
          {!isIncome && QUICK_NOTES_EXPENSE[selectedCategory] && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-semibold text-slate-400">Quick Note (Optional):</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_NOTES_EXPENSE[selectedCategory].map(qn => (
                  <button
                    key={qn}
                    type="button"
                    onClick={() => setNote(note === qn ? '' : qn)}
                    className={`px-2.5 py-1 rounded-lg text-xs transition-colors ${
                      note === qn
                        ? 'bg-slate-800 text-white font-medium'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {qn}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Tactile On-Screen Number Pad */}
          <NumberPad
            value={amountStr}
            onChange={setAmountStr}
            onQuickAdd={handleQuickAdd}
          />
        </div>

        {/* Huge Friendly Save Button */}
        <div className="p-4 bg-white border-t border-slate-100 shrink-0">
          <button
            id="huge-save-transaction-btn"
            type="button"
            onClick={handleSubmit}
            disabled={parsedAmount <= 0 || isSaving}
            className={`w-full py-4 rounded-2xl text-white text-lg font-black tracking-tight shadow-md flex items-center justify-center gap-2 transition-all active:scale-98 disabled:opacity-40 disabled:cursor-not-allowed ${
              isIncome
                ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/30'
                : 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/30'
            }`}
          >
            {isSaving ? (
              <>
                <span className="w-5 h-5 border-3 border-white/40 border-t-white rounded-full animate-spin" />
                <span>Saving to Budget...</span>
              </>
            ) : (
              <>
                <Check className="w-6 h-6 stroke-[3]" />
                <span>
                  {parsedAmount > 0
                    ? `Save ₱${parsedAmount.toLocaleString('en-PH')}`
                    : 'Enter Amount Above'}
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
