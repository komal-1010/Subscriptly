import express from "express"
import authRoutes from '../routes/auth.js';
import userRoutes from "../routes/users.js";
import planRoutes from "../routes/plans.js"
import { authMiddleware } from '../middleware/auth.js';
import { checkSubscription } from '../middleware/auth.js';
import subscriptionRoutes from '../routes/subscriptions.js';
const router = express.Router();
const app = express();

app.use(express.json());
router.get('/dashboard', authMiddleware, checkSubscription, (req, res) => {
  res.json({ message: `Welcome! Your subscription status: ${req.subscription.status}` });
});
app.use('/api/auth', authRoutes);
app.use('/api/users',userRoutes);
app.use('/api/plans',planRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.get('/', (req, res) => {
  res.json({ status: 'OK' });
});

export default app
