import { Router } from 'express';
import mongoose from 'mongoose';
import Workout from '../models/Workout.js';
import requireAuth from '../middleware/auth.js';
import { evaluateAchievements } from '../services/fitnessStats.js';

const router = Router();
router.use(requireAuth);

function validateBody(body) {
  const exercise = String(body.exercise || '').trim();
  const type = body.type || 'Cardio';
  const duration = Number(body.duration);
  const calories = Number(body.calories);
  const date = body.date ? new Date(body.date) : null;
  const notes = String(body.notes || '').trim();
  const types = ['Cardio', 'Strength', 'Flexibility', 'Sports', 'Other'];
  if (!exercise || exercise.length > 100) return { error: 'Exercise name is required (max 100 characters).' };
  if (!types.includes(type)) return { error: 'Choose a valid workout type.' };
  if (!Number.isFinite(duration) || duration < 1 || duration > 1440) return { error: 'Duration must be between 1 and 1440 minutes.' };
  if (!Number.isFinite(calories) || calories < 0 || calories > 20000) return { error: 'Calories must be between 0 and 20000.' };
  if (!date || Number.isNaN(date.getTime())) return { error: 'Enter a valid workout date.' };
  if (notes.length > 1000) return { error: 'Notes must be 1000 characters or fewer.' };
  return { value: { exercise, type, duration, calories, date, notes } };
}

router.get('/', async (req, res, next) => {
  try {
    const filter = { user: req.userId };
    if (req.query.type && ['Cardio', 'Strength', 'Flexibility', 'Sports', 'Other'].includes(req.query.type)) filter.type = req.query.type;
    if (req.query.search) filter.exercise = { $regex: String(req.query.search).slice(0, 80).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
    const workouts = await Workout.find(filter).sort({ date: -1, createdAt: -1 });
    res.json({ workouts });
  } catch (error) { next(error); }
});

router.post('/', async (req, res, next) => {
  try {
    const parsed = validateBody(req.body);
    if (parsed.error) return res.status(400).json({ message: parsed.error });
    const workout = await Workout.create({ ...parsed.value, user: req.userId });
    const history = await Workout.find({ user: req.userId }).lean();
    await evaluateAchievements(req.userId, history);
    res.status(201).json({ workout });
  } catch (error) { next(error); }
});

router.get('/:id', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid workout ID.' });
    const workout = await Workout.findOne({ _id: req.params.id, user: req.userId });
    if (!workout) return res.status(404).json({ message: 'Workout not found.' });
    res.json({ workout });
  } catch (error) { next(error); }
});

router.put('/:id', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid workout ID.' });
    const parsed = validateBody(req.body);
    if (parsed.error) return res.status(400).json({ message: parsed.error });
    const workout = await Workout.findOneAndUpdate(
      { _id: req.params.id, user: req.userId },
      { $set: parsed.value },
      { new: true, runValidators: true }
    );
    if (!workout) return res.status(404).json({ message: 'Workout not found.' });
    const history = await Workout.find({ user: req.userId }).lean();
    await evaluateAchievements(req.userId, history);
    res.json({ workout });
  } catch (error) { next(error); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid workout ID.' });
    const workout = await Workout.findOneAndDelete({ _id: req.params.id, user: req.userId });
    if (!workout) return res.status(404).json({ message: 'Workout not found.' });
    const history = await Workout.find({ user: req.userId }).lean();
    await evaluateAchievements(req.userId, history);
    res.json({ message: 'Workout deleted.' });
  } catch (error) { next(error); }
});

export default router;
