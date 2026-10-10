import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import authRoutes from './routes/auth.js';
import workoutRoutes from './routes/workouts.js';
import fitnessRoutes from './routes/fitness.js';

const app = express();
const allowedClientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
app.use(cors({
  origin(origin, callback) {
    const localDevOrigin = /^http:\/\/(localhost|127\.0\.0\.1):517\d+$/.test(origin || '');
    callback(null, !origin || origin === allowedClientOrigin || localDevOrigin);
  }
}));
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => res.json({ status: 'ok', service: 'fitness-dashboard-api' }));
app.use('/api/auth', authRoutes);
app.use('/api/workouts', workoutRoutes);
app.use('/api', fitnessRoutes);

app.use((req, res) => res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` }));
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ message: err.message || 'Internal server error' });
});

const port = process.env.PORT || 5000;
try {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is missing. Set it in server/.env');
  await mongoose.connect(process.env.MONGO_URI);
  console.log('MongoDB connected');
  app.listen(port, () => console.log(`API running at http://localhost:${port}`));
} catch (error) {
  console.error('Server startup failed:', error.message);
  process.exit(1);
}
