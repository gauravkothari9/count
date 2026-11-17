import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';

const Record =
  mongoose.models.Record ||
  mongoose.model(
    'Record',
    new mongoose.Schema({
      value: { type: Number, required: true },
      date: { type: Date, default: Date.now },
    })
  );

// Reuse one connection across serverless invocations
let connecting;
export function connectDB() {
  if (mongoose.connection.readyState === 1) return Promise.resolve();
  // Tolerate copy/paste slips: surrounding spaces or quotes
  let uri = (process.env.MONGODB_URI || '').trim().replace(/^["']|["']$/g, '');
  if (!uri) return Promise.reject(new Error('MONGODB_URI is not set'));
  // The database user lives in "admin": add ?authSource=admin if it was left off
  if (!/[?&]authSource=/i.test(uri)) uri += (uri.includes('?') ? '&' : '?') + 'authSource=admin';
  connecting ??= mongoose
    .connect(uri, { serverSelectionTimeoutMS: 10000 })
    .catch((err) => { connecting = undefined; throw err; });
  return connecting;
}

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api', async (_req, res, next) => {
  try { await connectDB(); next(); }
  catch (err) {
    console.error(err);
    res.status(503).json({ error: `Database unavailable: ${err.message}` });
  }
});

// List all records + total
app.get('/api/records', async (_req, res) => {
  const records = await Record.find().sort({ date: 1 });
  const total = records.reduce((sum, r) => sum + r.value, 0);
  res.json({ records, total });
});

// Add a record (date is set to now)
app.post('/api/records', async (req, res) => {
  const value = Number(req.body?.value);
  if (req.body?.value === '' || req.body?.value == null || Number.isNaN(value)) {
    return res.status(400).json({ error: 'value must be a number' });
  }
  const record = await Record.create({ value });
  res.status(201).json(record);
});

// Permanently delete a record (hard delete — it is removed from the database right away)
app.delete('/api/records/:id', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'bad id' });
  await Record.findByIdAndDelete(req.params.id);
  res.status(204).end();
});

// Undo a delete: put the same record back with its original id, value and date
app.post('/api/records/restore', async (req, res) => {
  const { _id, date } = req.body || {};
  const value = Number(req.body?.value);
  if (!mongoose.isValidObjectId(_id) || Number.isNaN(value) || Number.isNaN(Date.parse(date))) {
    return res.status(400).json({ error: 'invalid record' });
  }
  const record = await Record.findOneAndUpdate(
    { _id },
    { $setOnInsert: { value, date: new Date(date) } },
    { upsert: true, new: true }
  );
  res.status(201).json(record);
});

export default app;
