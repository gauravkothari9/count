import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AnimatePresence,
  MotionConfig,
  motion,
  useAnimationControls,
  useSpring,
  useTransform,
} from 'framer-motion';
import { AlertCircle, Check, Hash, Plus, RotateCw, Trash2, Undo2, X } from 'lucide-react';

/* ---------- helpers ---------- */

const EASE_OUT = [0.22, 1, 0.36, 1];
const SPRING = { type: 'spring', stiffness: 420, damping: 34, mass: 0.9 };

const fmt = (n) => n.toLocaleString(undefined, { maximumFractionDigits: 2 });
const fmtTime = (iso) => new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
const dayKey = (iso) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};
function dayLabel(iso) {
  const d = new Date(iso);
  const today = new Date();
  const yest = new Date();
  yest.setDate(today.getDate() - 1);
  if (dayKey(d) === dayKey(today)) return 'Today';
  if (dayKey(d) === dayKey(yest)) return 'Yesterday';
  return d.toLocaleDateString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric',
    year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric',
  });
}
const byDate = (a, b) => new Date(a.date) - new Date(b.date);
const haptic = () => { try { navigator.vibrate?.(8); } catch { /* unsupported */ } };

async function api(path, options) {
  const res = await fetch(`/api${path}`, options);
  if (res.status === 204) return null;
  const text = await res.text();
  let data = null;
  try { data = JSON.parse(text); } catch { /* not JSON */ }
  if (!res.ok) throw new Error(data?.error || `Server error ${res.status}`);
  return data;
}

/* ---------- small components ---------- */

function AnimatedNumber({ value, className }) {
  const mv = useSpring(0, { stiffness: 160, damping: 28, mass: 0.7 });
  // Show only as many decimals as the final value has (no "5.01 entries" mid-animation)
  const decimals = useRef(0);
  decimals.current = Math.min(2, (String(Math.round(value * 100) / 100).split('.')[1] || '').length);
  useEffect(() => { mv.set(value); }, [value, mv]);
  const text = useTransform(mv, (v) =>
    v.toLocaleString(undefined, {
      minimumFractionDigits: decimals.current,
      maximumFractionDigits: decimals.current,
    })
  );
  return <motion.span className={className}>{text}</motion.span>;
}

function Sparkline({ records }) {
  const points = useMemo(() => {
    let sum = 0;
    return [...records].sort(byDate).map((r) => (sum += r.value));
  }, [records]);
  if (points.length < 2) return null;

  const W = 320, H = 72;
  const min = Math.min(0, ...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const xy = points.map((v, i) => [
    (i / (points.length - 1)) * W,
    H - 6 - ((v - min) / range) * (H - 12),
  ]);
  const line = 'M' + xy.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' L');
  const area = `${line} L${W},${H} L0,${H} Z`;

  return (
    <svg className="spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: 'var(--accent)', stopOpacity: 0.28 }} />
          <stop offset="1" style={{ stopColor: 'var(--accent)', stopOpacity: 0 }} />
        </linearGradient>
        {/* Left-to-right reveal (works with the stretched viewBox, unlike pathLength) */}
        <clipPath id="sparkReveal">
          <motion.rect
            x="0" y="0" height={H}
            initial={{ width: 0 }}
            animate={{ width: W }}
            transition={{ duration: 1.1, ease: EASE_OUT, delay: 0.15 }}
          />
        </clipPath>
      </defs>
      <g clipPath="url(#sparkReveal)">
        <path d={area} fill="url(#sparkFill)" />
        <path
          d={line}
          fill="none"
          style={{ stroke: 'var(--accent)' }}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </g>
    </svg>
  );
}

function SkeletonRows() {
  return (
    <div className="group" aria-busy="true" aria-label="Loading entries">
      <div className="skeleton skeleton-label" />
      <div className="card list">
        {[0, 1, 2, 3].map((i) => (
          <div className="row" key={i}>
            <div className="skeleton skeleton-dot" />
            <div className="row-main">
              <div className="skeleton skeleton-line" style={{ width: `${40 + i * 9}%` }} />
              <div className="skeleton skeleton-line sm" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <motion.div
      className="empty card"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: EASE_OUT }}
    >
      <div className="empty-icon"><Hash size={22} strokeWidth={2.2} /></div>
      <p className="empty-title">No entries yet</p>
      <p className="empty-sub">Tap <strong>Record</strong> to add your first number.</p>
    </motion.div>
  );
}

function Toast({ toast, onAction, onClose }) {
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(onClose, toast.duration ?? 3500);
    return () => clearTimeout(t);
  }, [toast, onClose]);

  return (
    <div className="toast-region" aria-live="polite">
      <AnimatePresence mode="popLayout">
        {toast && (
          <motion.div
            key={toast.id}
            className={`toast ${toast.kind}`}
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98, transition: { duration: 0.16 } }}
            transition={SPRING}
          >
            <span className="toast-icon">
              {toast.kind === 'error' ? <AlertCircle size={18} /> :
               toast.kind === 'undo' ? <Trash2 size={17} /> : <Check size={18} strokeWidth={2.6} />}
            </span>
            <span className="toast-text">{toast.text}</span>
            {toast.action && (
              <button className="toast-action" onClick={onAction}>
                <Undo2 size={16} /> {toast.action}
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function RecordDialog({ open, onClose, onSubmit }) {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef(null);
  const shake = useAnimationControls();

  useEffect(() => {
    if (!open) return;
    setValue('');
    setError('');
    const t = setTimeout(() => inputRef.current?.focus(), 60);
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      clearTimeout(t);
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  function submit(e) {
    e.preventDefault();
    const n = Number(value);
    if (value.trim() === '' || Number.isNaN(n)) {
      setError('Enter a valid number');
      shake.start({ x: [0, -9, 9, -6, 6, -2, 0], transition: { duration: 0.42 } });
      inputRef.current?.focus();
      return;
    }
    onSubmit(n);
  }

  const now = new Date().toLocaleString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.15 } }}
          transition={{ duration: 0.2 }}
          onMouseDown={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.form
            className="dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="dialog-title"
            onSubmit={submit}
            initial={{ opacity: 0, scale: 0.92, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8, transition: { duration: 0.14, ease: 'easeIn' } }}
            transition={SPRING}
          >
            <div className="dialog-head">
              <div>
                <h2 id="dialog-title">New entry</h2>
                <p className="dialog-sub">{now}</p>
              </div>
              <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
                <X size={18} />
              </button>
            </div>

            <motion.div animate={shake}>
              <label htmlFor="amount" className="field-label">Number</label>
              <div className={`field ${error ? 'invalid' : ''}`}>
                <input
                  id="amount"
                  ref={inputRef}
                  type="number"
                  step="any"
                  inputMode="decimal"
                  enterKeyHint="done"
                  autoComplete="off"
                  placeholder="0"
                  value={value}
                  aria-invalid={!!error}
                  aria-describedby="amount-help"
                  onChange={(e) => { setValue(e.target.value); setError(''); }}
                />
              </div>
              <p id="amount-help" className={`field-help ${error ? 'error' : ''}`}>
                {error || 'Saved with the current date and time.'}
              </p>
            </motion.div>

            <div className="dialog-actions">
              <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
              <motion.button type="submit" className="btn primary" whileTap={{ scale: 0.97 }}>
                <Check size={18} strokeWidth={2.6} /> Record
              </motion.button>
            </div>
          </motion.form>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ---------- app ---------- */

export default function App() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [flashId, setFlashId] = useState(null);
  const lastDeleted = useRef(null); // record that Undo can restore
  const recordBtnRef = useRef(null);
  const firstPaint = useRef(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api('/records');
      setRecords(data.records);
      setLoadError('');
    } catch (err) {
      setLoadError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (!loading) firstPaint.current = false; }, [loading]);

  const showToast = useCallback((t) => setToast({ id: Date.now(), ...t }), []);
  const closeToast = useCallback(() => setToast(null), []);
  const closeDialog = useCallback(() => {
    setOpen(false);
    setTimeout(() => recordBtnRef.current?.focus(), 0);
  }, []);

  async function addRecord(value) {
    haptic();
    closeDialog();
    const temp = { _id: `tmp-${Date.now()}`, value, date: new Date().toISOString(), pending: true };
    setRecords((rs) => [...rs, temp]);
    setFlashId(temp._id);
    try {
      const saved = await api('/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value }),
      });
      setRecords((rs) => rs.map((r) => (r._id === temp._id ? saved : r)));
      setFlashId(saved._id);
      showToast({ kind: 'success', text: `Recorded ${fmt(value)}` });
    } catch (err) {
      setRecords((rs) => rs.filter((r) => r._id !== temp._id));
      showToast({ kind: 'error', text: err.message || 'Could not save' });
    }
  }

  // Deletes from the database immediately (permanent). Undo re-inserts the same record.
  async function deleteRecord(record) {
    haptic();
    setRecords((rs) => rs.filter((r) => r._id !== record._id));
    try {
      await api(`/records/${record._id}`, { method: 'DELETE' });
      lastDeleted.current = record;
      showToast({ kind: 'undo', text: `Deleted ${fmt(record.value)}`, action: 'Undo', duration: 5000 });
    } catch (err) {
      // Not deleted on the server: put it back so the screen matches the database
      setRecords((rs) => (rs.some((r) => r._id === record._id) ? rs : [...rs, record].sort(byDate)));
      showToast({ kind: 'error', text: `Couldn't delete: ${err.message}` });
    }
  }

  async function undoDelete() {
    const record = lastDeleted.current;
    if (!record) return;
    lastDeleted.current = null;
    setToast(null);
    setRecords((rs) => [...rs, record].sort(byDate));
    setFlashId(record._id);
    try {
      await api('/records/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ _id: record._id, value: record.value, date: record.date }),
      });
    } catch (err) {
      setRecords((rs) => rs.filter((r) => r._id !== record._id));
      showToast({ kind: 'error', text: `Couldn't undo: ${err.message}` });
    }
  }

  /* derived */
  const total = useMemo(() => records.reduce((s, r) => s + r.value, 0), [records]);
  const todayKey = dayKey(new Date());
  const todaySum = useMemo(
    () => records.filter((r) => dayKey(r.date) === todayKey).reduce((s, r) => s + r.value, 0),
    [records, todayKey]
  );
  const average = records.length ? total / records.length : 0;
  const groups = useMemo(() => {
    const map = new Map();
    [...records].sort(byDate).reverse().forEach((r) => {
      const k = dayKey(r.date);
      if (!map.has(k)) map.set(k, { key: k, label: dayLabel(r.date), items: [], sum: 0 });
      const g = map.get(k);
      g.items.push(r);
      g.sum += r.value;
    });
    return [...map.values()];
  }, [records]);

  let rowIndex = 0;

  return (
    <MotionConfig reducedMotion="user">
      <div className="bg-glow" aria-hidden="true" />
      <div className="shell">
        <motion.header
          className="topbar"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: EASE_OUT }}
        >
          <div className="brand">
            <span className="brand-mark"><Hash size={16} strokeWidth={2.6} /></span>
            <span className="brand-name">Counter</span>
          </div>
          <span className="today">
            {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
          </span>
        </motion.header>

        <motion.section
          className="hero card"
          initial={{ opacity: 0, y: 14, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.55, ease: EASE_OUT, delay: 0.05 }}
          aria-label="Total"
        >
          <span className="eyebrow">Total</span>
          <AnimatedNumber value={total} className="total" />
          <Sparkline records={records} />
          <div className="stats">
            <div className="stat">
              <span className="stat-label">Today</span>
              <AnimatedNumber value={todaySum} className="stat-value" />
            </div>
            <div className="stat">
              <span className="stat-label">Entries</span>
              <AnimatedNumber value={records.length} className="stat-value" />
            </div>
            <div className="stat">
              <span className="stat-label">Average</span>
              <AnimatedNumber value={average} className="stat-value" />
            </div>
          </div>
        </motion.section>

        <section className="entries" aria-label="Entries">
          {loading && records.length === 0 ? (
            <SkeletonRows />
          ) : loadError ? (
            <motion.div className="card error-card" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <AlertCircle size={20} />
              <div className="error-text">
                <strong>Couldn't load entries</strong>
                <span>{loadError}</span>
              </div>
              <button className="btn ghost sm" onClick={load}><RotateCw size={15} /> Retry</button>
            </motion.div>
          ) : records.length === 0 ? (
            <EmptyState />
          ) : (
            <AnimatePresence initial={true} mode="popLayout">
              {groups.map((g) => (
                <motion.div
                  className="group"
                  key={g.key}
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, transition: { duration: 0.15 } }}
                >
                  <motion.div layout="position" className="group-head">
                    <span>{g.label}</span>
                    <span className="group-sum">{fmt(g.sum)}</span>
                  </motion.div>
                  <motion.ul layout className="card list">
                    <AnimatePresence initial={true} mode="popLayout">
                      {g.items.map((r) => {
                        const i = rowIndex++;
                        return (
                          <motion.li
                            key={r._id}
                            layout
                            className={`row ${flashId === r._id ? 'flash' : ''} ${r.pending ? 'pending' : ''}`}
                            initial={{ opacity: 0, y: 10, scale: 0.98 }}
                            animate={{
                              opacity: 1, y: 0, scale: 1,
                              transition: { ...SPRING, delay: firstPaint.current ? Math.min(i, 12) * 0.04 : 0 },
                            }}
                            exit={{ opacity: 0, x: -28, transition: { duration: 0.18, ease: 'easeIn' } }}
                            onAnimationComplete={() => flashId === r._id && setTimeout(() => setFlashId(null), 900)}
                          >
                            <span className={`dot ${r.value < 0 ? 'neg' : ''}`} aria-hidden="true" />
                            <div className="row-main">
                              <span className={`amount ${r.value < 0 ? 'neg' : ''}`}>{fmt(r.value)}</span>
                              <span className="time">{fmtTime(r.date)}</span>
                            </div>
                            <motion.button
                              className="icon-btn delete"
                              onClick={() => deleteRecord(r)}
                              disabled={r.pending}
                              aria-label={`Delete ${fmt(r.value)} recorded at ${fmtTime(r.date)}`}
                              whileTap={{ scale: 0.88 }}
                            >
                              <Trash2 size={17} />
                            </motion.button>
                          </motion.li>
                        );
                      })}
                    </AnimatePresence>
                  </motion.ul>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </section>
      </div>

      <div className="dock">
        <motion.button
          ref={recordBtnRef}
          className="btn primary record"
          onClick={() => { haptic(); setOpen(true); }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...SPRING, delay: 0.2 }}
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.97 }}
        >
          <Plus size={20} strokeWidth={2.6} /> Record
        </motion.button>
      </div>

      <RecordDialog open={open} onClose={closeDialog} onSubmit={addRecord} />
      <Toast toast={toast} onAction={undoDelete} onClose={closeToast} />
    </MotionConfig>
  );
}
