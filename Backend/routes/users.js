import express from 'express';
import { pool } from '../db/index.js';
import bcrypt from 'bcrypt';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

// Get all users (protected)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT id, name, email, role_id FROM users;');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
