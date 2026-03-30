import { useEffect, useState } from 'react';
import { api, type LockStatus } from '../lib/api';

interface LockBadgeProps {
  epicId: string;
  onForceRelease?: () => void;
}

export function LockBadge({ epicId, onForceRelease }: LockBadgeProps) {
  const [status, setStatus] = useState<LockStatus | null>(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    api.checkLock(epicId).then(setStatus).catch(() => setStatus(null));
  }, [epicId]);

  if (!status || !status.locked || !status.lock) return null;

  const expiresAt = new Date(status.lock.expiresAt);
  const now = new Date();
  const remainingMin = Math.max(0, Math.round((expiresAt.getTime() - now.getTime()) / 60000));

  const handleForceRelease = async () => {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    try {
      await api.forceReleaseLock(epicId);
      setStatus({ locked: false });
      setConfirming(false);
      onForceRelease?.();
    } catch {
      setConfirming(false);
    }
  };

  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700 border border-orange-200">
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
        </svg>
        {status.lock.agentName} ({remainingMin}m)
      </span>
      <button
        onClick={(e) => { e.stopPropagation(); handleForceRelease(); }}
        className={`text-xs px-1.5 py-0.5 rounded transition-colors ${
          confirming
            ? 'bg-red-100 text-red-700 hover:bg-red-200'
            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
        }`}
        title={confirming ? 'Click again to confirm' : 'Force release lock'}
      >
        {confirming ? 'Confirm?' : 'Release'}
      </button>
    </span>
  );
}
