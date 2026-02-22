import express from 'express';
import Stripe from 'stripe';
import dotenv from 'dotenv';
import pool from '../db/index.js';
import { authMiddleware } from '../middleware/auth.js';

dotenv.config();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const router = express.Router();

/**
 * 1️⃣ Create Stripe Checkout Session
 */
router.post('/create-checkout-session', authMiddleware, async (req, res) => {
  try {
    const { plan_id } = req.body;
    const user_id = req.user.id;

    // Fetch plan info
    const { rows: planRows } = await pool.query('SELECT * FROM plans WHERE id=$1', [plan_id]);
    if (!planRows[0]) return res.status(404).json({ error: 'Plan not found' });
    const plan = planRows[0];

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [
        {
          price: plan.stripe_price_id,
          quantity: 1
        }
      ],

      success_url: `${process.env.FRONTEND_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/cancel`,
      metadata: { user_id: user_id, plan_id: plan_id },
    });


    res.json({ url: session.url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

export const stripeWebhookHandler = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('❌ Signature verification failed:', err.message);
    return res.status(400).send('Webhook Error');
  }

  try {
    // 🛑 Idempotency Check
    const existing = await pool.query(
      'SELECT 1 FROM webhook_events WHERE id = $1',
      [event.id]
    );

    if (existing.rowCount > 0) {
      return res.status(200).json({ received: true });
    }

    switch (event.type) {

      // ===============================
      // 1️⃣ Checkout Completed
      // ===============================
      case 'checkout.session.completed': {
        const session = event.data.object;

        const userId = session.metadata.user_id;
        const planId = session.metadata.plan_id;

        const stripeCustomerId = session.customer;
        const stripeSubscriptionId = session.subscription;

        if (!stripeSubscriptionId) {
          console.error("❌ Subscription ID missing");
          break;
        }

        await pool.query(
          'UPDATE users SET stripe_customer_id = $1 WHERE id = $2',
          [stripeCustomerId, userId]
        );

        const stripeSub = await stripe.subscriptions.retrieve(stripeSubscriptionId);

        let currentPeriodEnd = null;

        if (stripeSub.current_period_end) {
          currentPeriodEnd = new Date(
            stripeSub.current_period_end * 1000
          );
        }

        await pool.query(
          `INSERT INTO subscriptions
     (user_id, plan_id, stripe_subscription_id, status,
      current_period_end, grace_period_days_snapshot)
     VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            userId,
            planId,
            stripeSubscriptionId,
            stripeSub.status,
            currentPeriodEnd,
            0
          ]
        );

        break;
      }

      // ===============================
      // 2️⃣ Payment Failed
      // ===============================
      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        const stripeSubId = invoice.subscription;

        const { rows } = await pool.query(
          'SELECT * FROM subscriptions WHERE stripe_subscription_id = $1 ORDER BY id DESC LIMIT 1',
          [stripeSubId]
        );

        if (rows.length > 0) {
          const sub = rows[0];

          const graceEnd = new Date();
          graceEnd.setDate(
            graceEnd.getDate() + (sub.grace_period_days_snapshot || 0)
          );

          await pool.query(
            `UPDATE subscriptions
               SET status = 'past_due',
                   grace_period_end = $1
               WHERE id = $2`,
            [graceEnd, sub.id]
          );
        }

        break;
      }

      // ===============================
      // 3️⃣ Payment Recovered
      // ===============================
      case 'invoice.paid': {
        const invoice = event.data.object;
        const stripeSubId = invoice.subscription;

        await pool.query(
          `UPDATE subscriptions
             SET status = 'active',
                 grace_period_end = NULL
             WHERE stripe_subscription_id = $1`,
          [stripeSubId]
        );

        break;
      }

      case 'customer.subscription.updated': {
        const subEvent = event.data.object;

        const freshSub = await stripe.subscriptions.retrieve(subEvent.id);

        let currentPeriodEnd = null;

        if (freshSub.current_period_end) {
          currentPeriodEnd = new Date(
            freshSub.current_period_end * 1000
          );
        }

        await pool.query(
          `UPDATE subscriptions
            SET cancel_at_period_end = $1,
                status = $2,
                current_period_end = $3
            WHERE stripe_subscription_id = $4`,
          [
            freshSub.cancel_at_period_end,
            freshSub.status,
            currentPeriodEnd,
            freshSub.id
          ]
        );

        break;
      }
      // ===============================
      // 4️⃣ Subscription Canceled
      // ===============================
      case 'customer.subscription.deleted': {
        const subscription = event.data.object;

        await pool.query(
          `UPDATE subscriptions
             SET status = 'canceled'
             WHERE stripe_subscription_id = $1`,
          [subscription.id]
        );

        break;
      }

      default:
        break;
    }

    // ✅ Store webhook event
    await pool.query(
      'INSERT INTO webhook_events (id) VALUES ($1)',
      [event.id]
    );

    res.status(200).json({ received: true });

  } catch (err) {
    console.error('🔥 Webhook Processing Error:', err);
    res.status(500).send('Server Error');
  }
}




/**
 * 3️⃣ Get current subscription
 */
router.get('/current', authMiddleware, async (req, res) => {
  try {
    const user_id = req.user.id;
    const { rows } = await pool.query(
      `SELECT * FROM subscriptions WHERE user_id=$1 ORDER BY id DESC LIMIT 1`,
      [user_id]
    );

    if (rows.length === 0) return res.status(404).json({ error: 'No subscription found' });

    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

//cancel subscription
router.post('/cancel', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    // 1️⃣ Get latest subscription
    const { rows } = await pool.query(
      `SELECT stripe_subscription_id
       FROM subscriptions
       WHERE user_id = $1
       ORDER BY id DESC
       LIMIT 1`,
      [userId]
    );

    if (!rows.length) {
      return res.status(404).json({ error: 'No subscription found' });
    }

    const stripeSubId = rows[0].stripe_subscription_id;

    if (!stripeSubId) {
      return res.status(400).json({ error: 'Stripe subscription missing' });
    }

    // 2️⃣ Tell Stripe to cancel at period end
    await stripe.subscriptions.update(stripeSubId, {
      cancel_at_period_end: true
    });

    res.json({
      message: 'Subscription will cancel at period end'
    });

  } catch (err) {
    console.error('🔥 Cancel error:', err);
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
});

export default router;
