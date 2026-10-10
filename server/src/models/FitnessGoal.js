import mongoose from 'mongoose';
const fitnessGoalSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: { type: String, enum: ['workouts', 'duration', 'calories'], required: true },
  target: { type: Number, required: true, min: 1, max: 1000000 },
  period: { type: String, enum: ['daily', 'weekly'], required: true },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });
fitnessGoalSchema.index({ user: 1, type: 1, period: 1, isActive: 1 });
export default mongoose.model('FitnessGoal', fitnessGoalSchema);
