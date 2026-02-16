import express from 'express';
import pool from '../db/index.js';
import bcrypt from 'bcrypt';
import { authMiddleware } from '../middleware/auth.js';
import { authorizeRoles } from '../middleware/role.js';

const router = express.Router();

// Get all users (protected)
router.get('/', authMiddleware, authorizeRoles(1), async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT id, name, email, role_id FROM users;');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
export default router;

//Get particular user details
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    //Get user Info
    const { rows: userRows } = await pool.query(
      'SELECt id,name,email,role_id FROM users WHERE id=$1', [userId]
    );
    if (!userRows.length) {
      return res.status(404).json({ error: "User not found" });
    }
    const user = userRows[0];
    //Get subscription +plan
    const { rows: subRows } = await pool.query(
      `SELECT s.*,p.name AS plan_name,p.project_limit
        FROM subscriptions s
        JOIN plans p ON s.plan_id=p.id
        ORDER BY s.id DESC
        LIMIT 1`,
      [userId]
    );
    let subscription = null;
    let usage = null;
    if (subscription.length > 0) {
      const sub = subRows[0];
      let graceWarning = false;
      if (sub.status == 'past_due' && sub.grace_period_end) {
        graceWarning = true
      }
    }
    const { rows: usageRows } = await pool.query(
      `SELECT COUNT(*) AS count FROM projects WHERE user_id=$1`,
      [userId]
    );
    subscription = {
      status: sub.status,
      plan: sub.plan_name,
      currentPeriodEnd: sub.end_date,
      graceWarning
    }
    usage = {
      projectUsed: usageRows[0].count,
      projectLimit: sub.project_limit
    }
    res.json({ user, subscription, usage });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to retrieve user information' });
  }
});
