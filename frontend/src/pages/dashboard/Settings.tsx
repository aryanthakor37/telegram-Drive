import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { Settings as SettingsIcon, CheckCircle2 } from 'lucide-react';

const Settings: React.FC = () => {
  const { user, logout } = useAuth();

  return (
    <div className="max-w-lg mx-auto py-10 px-4">
      <div className="bg-white dark:bg-dark-850/30 border border-slate-200 dark:border-slate-800/80 rounded-3xl p-6 md:p-8 shadow-sm space-y-6">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <SettingsIcon className="w-5 h-5 text-brand-500" />
          <span>Integration Connection</span>
        </h3>

        <div className="p-5 rounded-2xl bg-slate-50 dark:bg-dark-950/50 border border-slate-200 dark:border-slate-800 space-y-4">
          <div className="flex items-center gap-2.5 text-emerald-600 dark:text-emerald-450 text-sm font-semibold">
            <CheckCircle2 className="w-4.5 h-4.5" />
            <span>Linked Telegram Session</span>
          </div>

          <div className="space-y-2 text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-semibold">
            <p><strong>Connected Phone:</strong> <span className="text-slate-900 dark:text-white">{user?.telegramPhone}</span></p>
            <p><strong>Telegram Username:</strong> <span className="text-slate-900 dark:text-white">@{user?.username || 'N/A'}</span></p>
            <p><strong>Session Storage Target:</strong> <span className="text-brand-600 dark:text-brand-400 font-bold">Telegram "Saved Messages"</span></p>
          </div>

          <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-relaxed">
            Files uploaded to this drive dashboard are securely dispatched to your personal Telegram "Saved Messages" channel. Deleting files here removes them from Telegram.
          </p>

          <button
            onClick={logout}
            className="w-full py-2.5 px-4 bg-red-50 hover:bg-red-100 dark:bg-red-500/10 dark:hover:bg-red-500/20 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 rounded-xl text-xs font-bold transition-all cursor-pointer text-center mt-4"
          >
            Disconnect Telegram Account
          </button>
        </div>
      </div>
    </div>
  );
};

export default Settings;