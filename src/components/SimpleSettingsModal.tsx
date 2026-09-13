import React, { useState } from 'react';
import { User } from 'firebase/auth';
import {
  Settings,
  FileSpreadsheet,
  Code2,
  Copy,
  Check,
  ExternalLink,
  PlusCircle,
  LogOut,
  X,
  Sparkles,
} from 'lucide-react';
import { ConnectedSheetInfo, MobileBudgetConfig } from '../types';
import { BUDGET_WEEKS_APPS_SCRIPT_CODE } from '../services/appsScriptCode';
import { createBudgetWeeksSpreadsheet } from '../services/googleSheetsService';

interface SimpleSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: MobileBudgetConfig;
  sheet: ConnectedSheetInfo | null;
  user: User | null;
  onSignIn: () => void;
  onSignOut: () => void;
  onUpdateConfig: (newConfig: MobileBudgetConfig) => void;
  onSheetConnected: (sheet: ConnectedSheetInfo) => void;
}

export const SimpleSettingsModal: React.FC<SimpleSettingsModalProps> = ({
  isOpen,
  onClose,
  config,
  sheet,
  user,
  onSignIn,
  onSignOut,
  onUpdateConfig,
  onSheetConnected,
}) => {
  const [startingBalance, setStartingBalance] = useState(config.startingBalance.toString());
  const [copied, setCopied] = useState(false);
  const [isCreatingSheet, setIsCreatingSheet] = useState(false);
  const [activeTab, setActiveTab] = useState<'balance' | 'sheet' | 'script'>('balance');

  if (!isOpen) return null;

  const handleSaveBalance = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(startingBalance) || 0;
    onUpdateConfig({
      ...config,
      startingBalance: val,
    });
    onClose();
  };

  const handleCreateSheet = async () => {
    if (!user) {
      onSignIn();
      return;
    }

    setIsCreatingSheet(true);
    try {
      const newSheet = await createBudgetWeeksSpreadsheet(
        'My Simple Budget (₱) - Budget Weeks',
        parseFloat(startingBalance) || 10000
      );
      onSheetConnected(newSheet);
    } catch (err) {
      console.error('Failed to create sheet:', err);
    } finally {
      setIsCreatingSheet(false);
    }
  };

  const handleCopyScript = async () => {
    try {
      await navigator.clipboard.writeText(BUDGET_WEEKS_APPS_SCRIPT_CODE);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-150">
      <div
        id="simple-settings-modal"
        className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-6"
      >
        {/* Header */}
        <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-slate-800 text-emerald-400 flex items-center justify-center">
              <Settings className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-base text-white">App &amp; Sheet Settings</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switch */}
        <div className="flex border-b border-slate-100 bg-slate-50 px-3 pt-2">
          <button
            onClick={() => setActiveTab('balance')}
            className={`px-3 py-2 text-xs font-bold rounded-t-xl transition-colors ${
              activeTab === 'balance'
                ? 'bg-white text-slate-900 border-t border-x border-slate-200 shadow-2xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Starting Balance
          </button>
          <button
            onClick={() => setActiveTab('sheet')}
            className={`px-3 py-2 text-xs font-bold rounded-t-xl transition-colors ${
              activeTab === 'sheet'
                ? 'bg-white text-slate-900 border-t border-x border-slate-200 shadow-2xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Google Sheet
          </button>
          <button
            onClick={() => setActiveTab('script')}
            className={`px-3 py-2 text-xs font-bold rounded-t-xl transition-colors ${
              activeTab === 'script'
                ? 'bg-white text-slate-900 border-t border-x border-slate-200 shadow-2xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Apps Script Code
          </button>
        </div>

        <div className="p-5 space-y-4">
          {activeTab === 'balance' && (
            <form onSubmit={handleSaveBalance} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Initial Starting Cash / Bank Fund (₱)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-mono font-bold">
                    ₱
                  </span>
                  <input
                    type="number"
                    step="100"
                    min="0"
                    value={startingBalance}
                    onChange={e => setStartingBalance(e.target.value)}
                    className="w-full pl-8 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-lg font-mono font-bold text-slate-900 focus:outline-hidden focus:border-emerald-600 focus:bg-white"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Changing this will reset your starting baseline balance.
                </p>
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-bold rounded-xl text-sm shadow-xs transition-all"
              >
                Save Starting Balance
              </button>
            </form>
          )}

          {activeTab === 'sheet' && (
            <div className="space-y-4">
              {/* Google Account */}
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    {user?.photoURL ? (
                      <img
                        src={user.photoURL}
                        alt="User"
                        className="w-8 h-8 rounded-full border border-slate-200"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center text-xs font-bold">
                        {user?.email?.[0].toUpperCase() || 'G'}
                      </div>
                    )}
                    <div>
                      <span className="text-xs font-bold text-slate-900 block truncate max-w-[170px]">
                        {user ? user.email : 'Not Signed In'}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {user ? 'Google Drive & Sheets Authorized' : 'Connect your Google account'}
                      </span>
                    </div>
                  </div>

                  {user ? (
                    <button
                      onClick={onSignOut}
                      className="p-1.5 text-slate-400 hover:text-slate-700"
                      title="Sign Out"
                    >
                      <LogOut className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      onClick={onSignIn}
                      className="px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-700 shadow-2xs"
                    >
                      Sign In
                    </button>
                  )}
                </div>
              </div>

              {/* Connected Sheet */}
              {sheet ? (
                <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 space-y-2">
                  <div className="flex items-center gap-2 text-emerald-900 font-bold text-xs">
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                    <span className="truncate">{sheet.title}</span>
                  </div>
                  <p className="text-[11px] text-emerald-700">
                    Live auto-sync enabled with Budget Weeks structure.
                  </p>
                  <a
                    href={sheet.spreadsheetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-bold text-emerald-800 underline underline-offset-2 mt-1"
                  >
                    <span>Open in Google Sheets</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              ) : (
                <button
                  onClick={handleCreateSheet}
                  disabled={isCreatingSheet}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-bold rounded-xl text-sm shadow-xs transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isCreatingSheet ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      <span>Creating Budget Weeks Sheet...</span>
                    </>
                  ) : (
                    <>
                      <PlusCircle className="w-4 h-4" />
                      <span>Create New Budget Weeks Sheet</span>
                    </>
                  )}
                </button>
              )}
            </div>
          )}

          {activeTab === 'script' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800">
                  Google Apps Script (Code.gs)
                </span>
                <button
                  onClick={handleCopyScript}
                  className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all shadow-2xs"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-slate-300" />
                      <span>Copy Code</span>
                    </>
                  )}
                </button>
              </div>

              <div className="p-3 bg-blue-50 rounded-xl border border-blue-200 text-xs text-blue-900 font-medium leading-relaxed">
                1. Open Google Sheet &gt; <strong>Extensions</strong> &gt; <strong>Apps Script</strong>.
                <br />
                2. Paste this code into <code>Code.gs</code>.
                <br />
                3. Click Save &amp; Run <code>setupBudgetWeeksSheet</code> once!
              </div>

              <div className="rounded-xl bg-slate-950 p-3 max-h-40 overflow-y-auto font-mono text-[10px] text-emerald-400">
                <pre>{BUDGET_WEEKS_APPS_SCRIPT_CODE}</pre>
              </div>
            </div>
          )}

          <div className="pt-2 flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-800"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
