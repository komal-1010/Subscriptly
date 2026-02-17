import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import pool from '../db/index.js';

dotenv.config();

/**
 * Auth middleware (JWT)
 */
export function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, role_id }
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

/**
 * Middleware to check user's subscription
 */
export async function checkSubscription(req, res, next) {
  try {
    const userId = req.user.id;

    const { rows } = await pool.query(
      `SELECT * FROM subscriptions
       WHERE user_id = $1
       ORDER BY id DESC
       LIMIT 1`,
      [userId]
    );

    if (rows.length === 0) {
      return res.status(403).json({ error: 'No subscription found' });
    }

    const sub = rows[0];
    if (sub.status === 'past_due') {
      if (sub.grace_period_end && new Date() < new Date(sub.grace_period_end)) {
        req.subscription = { ...sub, graceWarning: true };
        return next();
      }
      return res.status(403).json({ error: 'Grace period expired' });
    }

    if (!['active', 'trialing'].includes(sub.status)) {
      return res.status(403).json({ error: 'Subscription inactive' });
    }


    req.subscription = sub;
    next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to check subscription' });
  }
}
