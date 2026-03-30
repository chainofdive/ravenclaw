import { useState } from 'react';
import { getApiKey, setApiKey } from '../lib/api';

export function Header() {
  const [showSettings, setShowSettings] = useState(false);
  const [apiKey, setApiKeyState] = useState(getApiKey);

  const handleSave = () => {
    setApiKey(apiKey);
    setShowSettings(false);
    window.location.reload();
  };

  return (
    <>
      <header className="h-12 bg-white border-b border-gray-100 flex items-center justify-between px-4 shrink-0">
        <div />
        <button
          onClick={() => setShowSettings(true)}
          className="text-slate-500 hover:text-slate-700 text-sm flex items-center gap-1.5 transition-colors"
        >
          <span>&#9881;</span> Settings
        </button>
      </header>

      {showSettings && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white border border-gray-200 rounded-xl p-6 w-96 shadow-lg">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">Settings</h2>
            <label className="block text-sm text-slate-500 mb-1">API Key</label>
            <input
              type="text"
              value={apiKey}
              onChange={(e) => setApiKeyState(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/20 transition-colors"
            />
            <div className="flex gap-2 mt-4 justify-end">
              <button
                onClick={() => setShowSettings(false)}
                className="px-3 py-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-3 py-1.5 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-500 transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
