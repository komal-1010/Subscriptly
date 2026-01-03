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
    const now = new Date();

    // Expire active subscriptions past end date
    if (sub.status === 'active' && new Date(sub.end_date) < now) {
      await pool.query(
        `UPDATE subscriptions SET status = 'expired' WHERE id = $1`,
        [sub.id]
      );
      return res.status(403).json({ error: 'Subscription expired' });
    }

    // Allowed states
    if (!['trialing', 'active'].includes(sub.status)) {
      return res
        .status(403)
        .json({ error: `Access blocked: subscription is ${sub.status}` });
    }

    req.subscription = sub;
    next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to check subscription' });
  }
}
