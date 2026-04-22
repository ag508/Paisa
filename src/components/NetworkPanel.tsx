import { useState } from 'react';
import { ChevronDown, Wifi } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  getNetworkProfile,
  setNetworkProfile,
  type NetworkProfile,
} from '../api/client';

/**
 * Tiny dev-style panel that exposes the fault-injection knobs of the mock
 * API. Lets a reviewer verify loading states + retry behaviour without
 * having to tweak browser devtools' network throttling.
 */
export function NetworkPanel() {
  const [open, setOpen] = useState(false);
  const [profile, setProfile] = useState<NetworkProfile>(getNetworkProfile());

  function update(next: Partial<NetworkProfile>) {
    const merged = { ...profile, ...next };
    setProfile(merged);
    setNetworkProfile(merged);
  }

  return (
    <div className="card overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center justify-between px-5 py-3 text-sm"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="flex items-center gap-2 font-medium text-ink-600">
          <Wifi size={14} /> Simulate network
        </span>
        <motion.span animate={{ rotate: open ? 180 : 0 }}>
          <ChevronDown size={16} />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            className="px-5 pb-4 space-y-3 text-xs text-ink-500"
          >
            <p>
              The app's "backend" runs in your browser. These knobs add
              artificial latency / failures so you can verify the loading,
              error, and retry paths work as expected.
            </p>
            <label className="block">
              <div className="flex justify-between">
                <span>Latency</span>
                <span className="tabular">{profile.latencyMs} ms</span>
              </div>
              <input
                type="range"
                min={0}
                max={3000}
                step={50}
                value={profile.latencyMs}
                onChange={(e) => update({ latencyMs: Number(e.target.value) })}
                className="w-full accent-ink-900"
              />
            </label>
            <label className="block">
              <div className="flex justify-between">
                <span>Failure rate</span>
                <span className="tabular">
                  {Math.round(profile.failureRate * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={Math.round(profile.failureRate * 100)}
                onChange={(e) =>
                  update({ failureRate: Number(e.target.value) / 100 })
                }
                className="w-full accent-ink-900"
              />
            </label>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
