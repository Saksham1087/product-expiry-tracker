const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const db = new sqlite3.Database(path.join(__dirname, 'inventory.db'), (err) => {
  if (err) {
    console.error('Failed to connect to database:', err.message);
  } else {
    console.log('Connected to SQLite database.');
  }
});

db.run(`
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_name TEXT NOT NULL,
    batch_number TEXT NOT NULL,
    mfg_date TEXT NOT NULL,
    expiry_date TEXT NOT NULL
  )
`);

function monthsBetween(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  return (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
}

app.get('/api/products', (req, res) => {
  const today = new Date();
  db.all('SELECT * FROM products', [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    const products = rows.map(row => ({
      ...row,
      months_left: monthsBetween(today, row.expiry_date)
    }));
    res.json(products);
  });
});

app.post('/api/products', (req, res) => {
  const { product_name, batch_number, mfg_date, expiry_date } = req.body;

  if (!product_name || !product_name.trim()) {
    return res.status(400).json({ error: 'Product name is required.' });
  }
  if (!batch_number || !batch_number.trim()) {
    return res.status(400).json({ error: 'Batch number is required.' });
  }
  if (!mfg_date || !mfg_date.trim()) {
    return res.status(400).json({ error: 'Manufacturing date is required.' });
  }
  if (!expiry_date || !expiry_date.trim()) {
    return res.status(400).json({ error: 'Expiry date is required.' });
  }

  const mfgYear = new Date(mfg_date).getFullYear();
  const expYear = new Date(expiry_date).getFullYear();
  if (expYear <= mfgYear) {
    return res.status(400).json({ error: 'Expiry date must be at least in the calendar year following the manufacturing date.' });
  }

  db.run(
    'INSERT INTO products (product_name, batch_number, mfg_date, expiry_date) VALUES (?, ?, ?, ?)',
    [product_name.trim(), batch_number.trim(), mfg_date, expiry_date],
    function (err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.status(201).json({ id: this.lastID });
    }
  );
});

app.put('/api/products/:id', (req, res) => {
  const { id } = req.params;
  const { product_name, batch_number, mfg_date, expiry_date } = req.body;

  if (!product_name || !product_name.trim()) {
    return res.status(400).json({ error: 'Product name is required.' });
  }
  if (!batch_number || !batch_number.trim()) {
    return res.status(400).json({ error: 'Batch number is required.' });
  }
  if (!mfg_date || !mfg_date.trim()) {
    return res.status(400).json({ error: 'Manufacturing date is required.' });
  }
  if (!expiry_date || !expiry_date.trim()) {
    return res.status(400).json({ error: 'Expiry date is required.' });
  }

  const mfgYear = new Date(mfg_date).getFullYear();
  const expYear = new Date(expiry_date).getFullYear();
  if (expYear <= mfgYear) {
    return res.status(400).json({ error: 'Expiry date must be at least in the calendar year following the manufacturing date.' });
  }

  db.run(
    'UPDATE products SET product_name = ?, batch_number = ?, mfg_date = ?, expiry_date = ? WHERE id = ?',
    [product_name.trim(), batch_number.trim(), mfg_date, expiry_date, id],
    function (err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Product not found.' });
      }
      res.json({ updated: this.changes });
    }
  );
});

app.delete('/api/products/:id', (req, res) => {
  const { id } = req.params;
  db.run('DELETE FROM products WHERE id = ?', id, function (err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Product not found.' });
    }
    res.json({ deleted: this.changes });
  });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
