import { useEffect, useRef, useState } from 'react';

const fmtNum = (n) => n.toLocaleString(undefined, { maximumFractionDigits: 2 });
const fmtDate = (iso) =>
  new Date(iso).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });

export default function App() {
  const [records, setRecords] = useState([]);
  const [total, setTotal] = useState(0);
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  async function load() {
    try {
      const res = await fetch('/api/records');
      if (!res.ok) throw new Error();
      const data = await res.json();
      setRecords(data.records);
      setTotal(data.total);
      setError('');
    } catch {
      setError('Could not reach the server. Is it running?');
    }
  }

  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape') closePopup(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open]);

  function closePopup() {
    setOpen(false);
    setValue('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (value === '' || Number.isNaN(Number(value))) return;
    const res = await fetch('/api/records', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: Number(value) }),
    });
    if (!res.ok) return setError('Failed to save record');
    setValue('');
    setOpen(false);
    load();
  }

  async function handleDelete(id) {
    await fetch(`/api/records/${id}`, { method: 'DELETE' });
    load();
  }

  return (
    <main className="app">
      <header className="header">
        <h1>Counter</h1>
        <span className="count">{records.length} {records.length === 1 ? 'entry' : 'entries'}</span>
      </header>

      {open && (
        <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && closePopup()}>
          <form
            className="popup"
            role="dialog"
            aria-modal="true"
            aria-labelledby="popup-title"
            onSubmit={handleSubmit}
          >
            <h2 id="popup-title">Enter a number</h2>
            <input
              ref={inputRef}
              type="number"
              step="any"
              inputMode="decimal"
              enterKeyHint="done"
              placeholder="0"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              required
            />
            <div className="popup-actions">
              <button type="button" className="ghost" onClick={closePopup}>Cancel</button>
              <button type="submit">Record</button>
            </div>
          </form>
        </div>
      )}

      {error && <p className="error">{error}</p>}

      <ul className="list">
        {records.length === 0 ? (
          <li className="empty">No records yet</li>
        ) : (
          records.map((r) => (
            <li key={r._id}>
              <span className="date">{fmtDate(r.date)}</span>
              <span className="row-right">
                <span className="value">{fmtNum(r.value)}</span>
                <button className="delete" title="Delete" onClick={() => handleDelete(r._id)}>
                  &times;
                </button>
              </span>
            </li>
          ))
        )}
      </ul>

      <footer className="footer">
        <div className="total">
          <span>Total</span>
          <span>{fmtNum(total)}</span>
        </div>
        <button className="record-btn" onClick={() => setOpen(true)}>Record</button>
      </footer>
    </main>
  );
}
