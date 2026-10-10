import mongoose from 'mongoose';

const workoutSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  exercise: { type: String, required: true, trim: true, maxlength: 100 },
  type: { type: String, enum: ['Cardio', 'Strength', 'Flexibility', 'Sports', 'Other'], default: 'Cardio' },
  duration: { type: Number, required: true, min: 1, max: 1440 },
  date: { type: Date, required: true },
  calories: { type: Number, required: true, min: 0, max: 20000 },
  notes: { type: String, trim: true, maxlength: 1000, default: '' }
}, { timestamps: true });

export default mongoose.model('Workout', workoutSchema);
