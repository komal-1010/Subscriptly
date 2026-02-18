import express from 'express';
import pool from '../db/index.js';
import { authMiddleware } from '../middleware/auth.js';
import { checkSubscription } from '../middleware/auth.js';

const router = express.Router();

/**
 * Create Project (Enforce Plan Limit)
 */
router.post('/', authMiddleware, checkSubscription, async (req, res) => {
  try {
    const userId = req.user.id;
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Project name required' });
    }

    // 1️⃣ Get user subscription + plan limit
    const { rows: subRows } = await pool.query(
      `SELECT s.*, p.project_limit
       FROM subscriptions s
       JOIN plans p ON s.plan_id = p.id
       WHERE s.user_id = $1
       ORDER BY s.id DESC
       LIMIT 1`,
      [userId]
    );

    if (!subRows.length) {
      return res.status(403).json({ error: 'No active subscription' });
    }

    const projectLimit = subRows[0].project_limit;

    // 2️⃣ Count active projects
    const { rows: countRows } = await pool.query(
      `SELECT COUNT(*) FROM projects
       WHERE user_id = $1 AND is_active = TRUE`,
      [userId]
    );

    const activeCount = Number(countRows[0].count);

    if (activeCount >= projectLimit) {
      return res.status(403).json({
        error: `Project limit reached (${projectLimit}). Upgrade your plan.`
      });
    }

    // 3️⃣ Create project
    const { rows } = await pool.query(
      `INSERT INTO projects (user_id, name)
       VALUES ($1, $2)
       RETURNING *`,
      [userId, name]
    );

    res.json(rows[0]);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

/**
 * Get User Projects
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const { rows } = await pool.query(
      `SELECT * FROM projects
       WHERE user_id = $1
       ORDER BY created_at ASC`,
      [userId]
    );

    res.json(rows);

  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

/**
 * Delete Project
 */
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const projectId = req.params.id;

    await pool.query(
      `DELETE FROM projects
       WHERE id = $1 AND user_id = $2`,
      [projectId, userId]
    );

    res.json({ message: 'Project deleted' });

  } catch (err) {
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

export default router;
