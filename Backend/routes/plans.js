import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { authorizeRoles } from '../middleware/role.js';
import pool from '../db/index.js';

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
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT id, name, price, duration_months, project_limit
      FROM plans
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
