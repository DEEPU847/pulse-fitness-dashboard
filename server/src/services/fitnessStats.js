import Workout from '../models/Workout.js';
import UserAchievement from '../models/UserAchievement.js';

export const achievementCatalog = [
  { id: 'first-step', title: 'First Step', description: 'Complete your first workout.', icon: '🌱', kind: 'workouts', target: 1 },
  { id: 'getting-started', title: 'Getting Started', description: 'Complete 5 workouts.', icon: '👟', kind: 'workouts', target: 5 },
  { id: 'fitness-enthusiast', title: 'Fitness Enthusiast', description: 'Complete 25 workouts.', icon: '💪', kind: 'workouts', target: 25 },
  { id: 'fitness-champion', title: 'Fitness Champion', description: 'Complete 100 workouts.', icon: '🏆', kind: 'workouts', target: 100 },
  { id: 'three-day-streak', title: 'Three-Day Streak', description: 'Work out on 3 consecutive days.', icon: '🔥', kind: 'streak', target: 3 },
  { id: 'week-warrior', title: 'Week Warrior', description: 'Work out on 7 consecutive days.', icon: '⚡', kind: 'streak', target: 7 },
  { id: 'consistency-king', title: 'Consistency King', description: 'Work out on 30 consecutive days.', icon: '👑', kind: 'streak', target: 30 },
  { id: 'calorie-burner', title: 'Calorie Burner', description: 'Burn 1,000 total calories.', icon: '❤️‍🔥', kind: 'calories', target: 1000 },
  { id: 'calorie-crusher', title: 'Calorie Crusher', description: 'Burn 5,000 total calories.', icon: '🌟', kind: 'calories', target: 5000 },
  { id: 'time-investor', title: 'Time Investor', description: 'Complete 600 workout minutes.', icon: '⏱️', kind: 'duration', target: 600 }
];
const dateKey = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
export function summarize(workouts) {
  const days = [...new Set(workouts.map(w => dateKey(new Date(w.date))))].sort();
  let longest = 0, run = 0, previous = null;
  for (const key of days) { const current = new Date(`${key}T12:00:00`); const prev = previous ? new Date(`${previous}T12:00:00`) : null; run = prev && (current-prev) === 86400000 ? run+1 : 1; longest = Math.max(longest,run); previous = key; }
  const now = new Date(); const today = dateKey(now); const yesterdayDate = new Date(now); yesterdayDate.setDate(yesterdayDate.getDate()-1); const yesterday = dateKey(yesterdayDate);
  let currentStreak = 0; let cursor = days.includes(today) ? today : days.includes(yesterday) ? yesterday : null;
  while (cursor && days.includes(cursor)) { currentStreak++; const d = new Date(`${cursor}T12:00:00`); d.setDate(d.getDate()-1); cursor = dateKey(d); }
  return { workouts: workouts.length, minutes: workouts.reduce((s,w)=>s+Number(w.duration||0),0), calories: workouts.reduce((s,w)=>s+Number(w.calories||0),0), activeDays: days.length, currentStreak, longestStreak: longest, days };
}
export async function evaluateAchievements(userId, workouts) {
  const stats = summarize(workouts);
  const values = { workouts: stats.workouts, calories: stats.calories, duration: stats.minutes, streak: stats.longestStreak };
  const eligible = achievementCatalog.filter(a => values[a.kind] >= a.target);
  if (eligible.length) await UserAchievement.bulkWrite(eligible.map(a => ({ updateOne: { filter: { user: userId, achievementId: a.id }, update: { $setOnInsert: { user: userId, achievementId: a.id, unlockedAt: new Date() } }, upsert: true } })), { ordered: false });
  const earned = await UserAchievement.find({ user: userId }).lean();
  return achievementCatalog.map(a => ({ ...a, progress: Math.min(values[a.kind] || 0, a.target), unlockedAt: earned.find(e => e.achievementId === a.id)?.unlockedAt || null }));
}
export { dateKey };
