import React from 'react';
import { Delete } from 'lucide-react';

interface NumberPadProps {
  value: string;
  onChange: (val: string) => void;
  onQuickAdd?: (amount: number) => void;
}

export const NumberPad: React.FC<NumberPadProps> = ({ value, onChange, onQuickAdd }) => {
  const handleDigit = (digit: string) => {
    // If empty or "0", replace or append
    if (value === '0' && digit !== '.') {
      onChange(digit);
      return;
    }
    // Only one decimal point allowed
    if (digit === '.' && value.includes('.')) {
      return;
    }
    // Limit decimal to 2 places
    if (value.includes('.')) {
      const parts = value.split('.');
      if (parts[1].length >= 2) return;
    }
    // Max 8 digits
    if (value.replace(/[^0-9]/g, '').length >= 8) return;

    onChange(value + digit);
  };

  const handleBackspace = () => {
    if (value.length <= 1) {
      onChange('');
    } else {
      onChange(value.slice(0, -1));
    }
  };

  const handleClear = () => {
    onChange('');
  };

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0'];

  return (
    <div className="w-full select-none space-y-2.5">
      {/* Quick Add Pills */}
      {onQuickAdd && (
        <div className="grid grid-cols-4 gap-2">
          {[50, 100, 500, 1000].map(val => (
            <button
              key={val}
              type="button"
              onClick={() => onQuickAdd(val)}
              className="py-2 rounded-xl text-xs font-bold font-mono bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-800 transition-colors shadow-2xs active:scale-95"
            >
              +₱{val}
            </button>
          ))}
        </div>
      )}

      {/* Grid keypad */}
      <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
        {keys.map(k => (
          <button
            key={k}
            type="button"
            onClick={() => handleDigit(k)}
            className="h-14 sm:h-16 rounded-2xl bg-white active:bg-slate-200 border border-slate-200 text-2xl font-bold font-mono text-slate-900 flex items-center justify-center shadow-xs active:scale-95 transition-all"
          >
            {k}
          </button>
        ))}

        {/* Backspace Button */}
        <button
          type="button"
          onClick={handleBackspace}
          onDoubleClick={handleClear}
          className="h-14 sm:h-16 rounded-2xl bg-slate-100 active:bg-slate-200 border border-slate-200 text-slate-700 flex items-center justify-center shadow-xs active:scale-95 transition-all"
          title="Delete (Double tap to clear)"
        >
          <Delete className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
};
