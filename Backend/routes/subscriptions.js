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
                    price_data: {
                        currency: 'usd',
                        product_data: { name: plan.name },
                        unit_amount: plan.price * 100, // cents
                        recurring: { interval: 'month' }
                    },
                    quantity: 1,
                },
            ],
            success_url: `${process.env.FRONTEND_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${process.env.FRONTEND_URL}/cancel`,
            metadata: { user_id, plan_id },
        });


        res.json({ url: session.url });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * 2️⃣ Stripe Webhook to handle successful payment
 */
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);

        if (event.type === 'checkout.session.completed') {
            const session = event.data.object;
            const user_id = session.metadata.user_id;
            const plan_id = session.metadata.plan_id;

            const now = new Date();
            const end_date = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate()); // 1 month

            // Insert subscription into DB
            await pool.query(
                `INSERT INTO subscriptions (user_id, plan_id, start_date, end_date, status)
         VALUES ($1, $2, $3, $4, $5)`,
                [user_id, plan_id, now, end_date, 'active']
            );

            console.log(`Subscription created for user ${user_id}`);
        }

        res.json({ received: true });
    } catch (err) {
        console.error('Webhook error:', err.message);
        res.status(400).send(`Webhook Error: ${err.message}`);
    }
});

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

export default router;
