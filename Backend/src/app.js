import express from "express"
import authRoutes from '../routes/auth.js';
import { authMiddleware } from '../middleware/auth.js';
import { checkSubscription } from '../middleware/checkSubscription.js';

const router = express.Router();
const app = express();

app.use(express.json());
router.get('/dashboard', authMiddleware, checkSubscription, (req, res) => {
  res.json({ message: `Welcome! Your subscription status: ${req.subscription.status}` });
});
app.use('/api/auth', authRoutes);

app.get('/', (req, res) => {
  res.json({ status: 'OK' });
});

export default app
