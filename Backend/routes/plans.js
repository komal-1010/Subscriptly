import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { authorizeRoles } from '../middleware/role.js';
import { pool } from '../db/pool.js';

const router = express.Router();

// Admin-only: create new plan
router.post('/', authMiddleware, authorizeRoles(1), async (req, res) => {
  try {
    const { name, price, duration } = req.body;

    const { rows } = await pool.query(
      'INSERT INTO plans (name, price, duration) VALUES ($1, $2, $3) RETURNING *',
      [name, price, duration]
    );

    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Any authenticated user can view plans
router.get('/', authMiddleware, async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM plans;');
  res.json(rows);
});

export default router;
