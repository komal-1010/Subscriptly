import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();
import { pool } from '../db/pool.js';

/**
 * Middleware to check user's subscription
 * Blocks access if subscription is not valid
 */
export async function checkSubscription(req, res, next) {
  try {
    const user_id = req.user.id;

    // Get the latest subscription
    const { rows } = await pool.query(
      `SELECT * FROM subscriptions WHERE user_id=$1 ORDER BY id DESC LIMIT 1`,
      [user_id]
    );

    if (rows.length === 0) {
      return res.status(403).json({ error: 'No subscription found' });
    }

    const sub = rows[0];
    const now = new Date();

    // Check subscription end date
    if (new Date(sub.end_date) < now && sub.status !== 'canceled') {
      // Mark expired
      await pool.query(
        `UPDATE subscriptions SET status=$1 WHERE id=$2`,
        ['expired', sub.id]
      );
      return res.status(403).json({ error: 'Subscription expired' });
    }

    // Allowed states
    const allowedStates = ['trialing', 'active'];
    if (!allowedStates.includes(sub.status)) {
      return res.status(403).json({ error: `Access blocked: subscription is ${sub.status}` });
    }

    // Attach subscription to request
    req.subscription = sub;
    next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to check subscription' });
  }
}

// After inserting user and generating JWT
// Create a trial subscription automatically
const now = new Date();
const trialEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7-day trial

await pool.query(
  `INSERT INTO subscriptions (user_id, plan_id, start_date, end_date, status)
   VALUES ($1, $2, $3, $4, $5)`,
  [rows[0].id, 1, now, trialEnd, 'trialing'] // plan_id = 1 as default plan
);

export function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'No token provided' });

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, role_id }
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
}
