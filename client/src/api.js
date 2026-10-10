const API_URL = import.meta.env.VITE_API_URL;
export const DEMO_MODE = import.meta.env.VITE_DEMO_MODE !== 'false' && !API_URL;
const DEMO_USER = { id: 'demo-user', name: 'Alex Morgan', email: 'demo@pulse.fit' };
const today = new Date();
const dateKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const shiftDate = (days) => { const d = new Date(); d.setDate(d.getDate() + days); return dateKey(d); };

const starterWorkouts = [
  [-1, 'Morning run', 'Cardio', 32, 286], [-2, 'Strength session', 'Strength', 48, 312],
  [-3, 'Evening ride', 'Cardio', 40, 354], [-5, 'Yoga flow', 'Flexibility', 28, 126],
  [-6, 'Tempo run', 'Cardio', 36, 328], [-8, 'Upper body', 'Strength', 45, 295],
  [-9, 'Recovery walk', 'Cardio', 25, 112], [-11, 'Mobility', 'Flexibility', 22, 84],
  [-12, 'Interval training', 'Cardio', 30, 341], [-14, 'Full body strength', 'Strength', 52, 388],
  [-16, 'Weekend hike', 'Sports', 65, 472], [-18, 'Easy cycle', 'Cardio', 38, 276]
].map(([offset, exercise, type, duration, calories], i) => ({
  _id: `starter-${i + 1}`, exercise, type, duration, calories, date: `${shiftDate(offset)}T12:00:00.000Z`, notes: ''
}));

function read(key, fallback) {
  try { const value = localStorage.getItem(key); return value ? JSON.parse(value) : fallback; }
  catch { return fallback; }
}
function write(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
function demoWorkouts() { return read('pulse_demo_workouts', starterWorkouts); }
function demoGoals() { return read('pulse_demo_goals', [{ _id: 'goal-weekly', type: 'workouts', target: 5, period: 'weekly', isActive: true }]); }
function jsonBody(options) { try { return options.body ? JSON.parse(options.body) : {}; } catch { return {}; } }
function response(status, data) {
  if (status >= 400) throw new Error(data.message || 'Something went wrong.');
  return data;
}
function dateRange(period) {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  if (period === 'weekly') { const day = (start.getDay() + 6) % 7; start.setDate(start.getDate() - day); }
  const end = new Date(start); end.setDate(end.getDate() + (period === 'weekly' ? 7 : 1));
  return [start, end];
}
function summarize(workouts) {
  const days = [...new Set(workouts.map(w => dateKey(new Date(w.date))))].sort();
  let longestStreak = 0, run = 0, previous = null;
  for (const key of days) {
    const current = new Date(`${key}T12:00:00`);
    const prior = previous ? new Date(`${previous}T12:00:00`) : null;
    run = prior && current - prior === 86400000 ? run + 1 : 1;
    longestStreak = Math.max(longestStreak, run); previous = key;
  }
  const todayKey = dateKey(new Date()); const yesterday = shiftDate(-1);
  let currentStreak = 0; let cursor = days.includes(todayKey) ? todayKey : days.includes(yesterday) ? yesterday : null;
  while (cursor && days.includes(cursor)) { currentStreak++; const d = new Date(`${cursor}T12:00:00`); d.setDate(d.getDate() - 1); cursor = dateKey(d); }
  return { workouts: workouts.length, minutes: workouts.reduce((s, w) => s + Number(w.duration || 0), 0), calories: workouts.reduce((s, w) => s + Number(w.calories || 0), 0), activeDays: days.length, currentStreak, longestStreak, days };
}
const achievementCatalog = [
  ['first-step', 'First Step', 'Complete your first workout.', '🌱', 'workouts', 1],
  ['getting-started', 'Getting Started', 'Complete 5 workouts.', '👟', 'workouts', 5],
  ['fitness-enthusiast', 'Fitness Enthusiast', 'Complete 25 workouts.', '💪', 'workouts', 25],
  ['fitness-champion', 'Fitness Champion', 'Complete 100 workouts.', '🏆', 'workouts', 100],
  ['three-day-streak', 'Three-Day Streak', 'Work out on 3 consecutive days.', '🔥', 'streak', 3],
  ['week-warrior', 'Week Warrior', 'Work out on 7 consecutive days.', '⚡', 'streak', 7],
  ['consistency-king', 'Consistency King', 'Work out on 30 consecutive days.', '👑', 'streak', 30],
  ['calorie-burner', 'Calorie Burner', 'Burn 1,000 total calories.', '❤️‍🔥', 'calories', 1000],
  ['calorie-crusher', 'Calorie Crusher', 'Burn 5,000 total calories.', '🌟', 'calories', 5000],
  ['time-investor', 'Time Investor', 'Complete 600 workout minutes.', '⏱️', 'duration', 600]
];

async function demoApi(path, options) {
  const method = (options.method || 'GET').toUpperCase(); const body = jsonBody(options);
  if (path === '/auth/me') return response(200, { user: read('pulse_demo_user', DEMO_USER) });
  if (path === '/auth/register' || path === '/auth/login') {
    if (method === 'POST') {
      if (path.endsWith('register') && (!body.name || String(body.password || '').length < 8)) return response(400, { message: 'Name and password of at least 8 characters are required.' });
      if (!body.email || !body.password) return response(400, { message: 'Enter your email and password.' });
      const user = { ...DEMO_USER, name: path.endsWith('register') ? String(body.name).trim() : (body.email === DEMO_USER.email ? DEMO_USER.name : String(body.name || body.email.split('@')[0])) , email: String(body.email).trim().toLowerCase() };
      write('pulse_demo_user', user); localStorage.setItem('pulse_token', 'pulse-local-demo');
      return response(200, { token: 'pulse-local-demo', user });
    }
  }
  if (path.startsWith('/auth/google')) return response(503, { message: 'Google sign-in requires the backend configuration. Use email and password in demo mode.' });
  if (path.startsWith('/workouts')) {
    let workouts = demoWorkouts(); const [route, id] = path.split('?')[0].split('/').slice(1);
    if (route === 'workouts' && !id && method === 'GET') {
      const query = new URLSearchParams(path.split('?')[1] || '');
      if (query.has('search')) workouts = workouts.filter(w => w.exercise.toLowerCase().includes(query.get('search').toLowerCase()));
      if (query.has('type')) workouts = workouts.filter(w => w.type === query.get('type'));
      return response(200, { workouts: workouts.sort((a, b) => new Date(b.date) - new Date(a.date)) });
    }
    if (route === 'workouts' && method === 'POST') {
      const workout = { ...body, _id: `workout-${Date.now()}`, date: new Date(`${body.date}T12:00:00`).toISOString() };
      write('pulse_demo_workouts', [workout, ...workouts]); return response(201, { workout });
    }
    if (route === 'workouts' && id) {
      const index = workouts.findIndex(w => w._id === id);
      if (index < 0) return response(404, { message: 'Workout not found.' });
      if (method === 'GET') return response(200, { workout: workouts[index] });
      if (method === 'PUT') { workouts[index] = { ...workouts[index], ...body, date: new Date(`${body.date}T12:00:00`).toISOString() }; write('pulse_demo_workouts', workouts); return response(200, { workout: workouts[index] }); }
      if (method === 'DELETE') { write('pulse_demo_workouts', workouts.filter(w => w._id !== id)); return response(200, { message: 'Workout deleted.' }); }
    }
  }
  if (path === '/goals' && method === 'GET') {
    const workouts = demoWorkouts(); const goals = demoGoals().map(g => {
      const [start, end] = dateRange(g.period); const list = workouts.filter(w => { const d = new Date(w.date); return d >= start && d < end; });
      const current = g.type === 'workouts' ? list.length : list.reduce((sum, w) => sum + Number(w[g.type === 'duration' ? 'duration' : 'calories'] || 0), 0);
      return { ...g, current, percent: Math.min(100, Math.round(current / g.target * 100)), remaining: Math.max(0, g.target - current) };
    });
    return response(200, { goals });
  }
  if (path === '/goals' && method === 'POST') {
    const goals = demoGoals();
    if (goals.some(g => g.type === body.type && g.period === body.period)) return response(409, { message: 'You already have an active goal of this type and period.' });
    const goal = { ...body, _id: `goal-${Date.now()}`, target: Number(body.target), isActive: true }; write('pulse_demo_goals', [...goals, goal]); return response(201, { goal });
  }
  if (path.startsWith('/goals/') && method === 'DELETE') { write('pulse_demo_goals', demoGoals().filter(g => g._id !== path.split('/')[2])); return response(200, { message: 'Goal deleted.' }); }
  if (path.startsWith('/stats/calendar')) {
    const month = new URLSearchParams(path.split('?')[1] || '').get('month'); const days = {};
    demoWorkouts().filter(w => dateKey(new Date(w.date)).startsWith(`${month}-`)).forEach(w => { const key = dateKey(new Date(w.date)); days[key] ||= { count: 0, minutes: 0, calories: 0, workouts: [] }; days[key].count++; days[key].minutes += Number(w.duration); days[key].calories += Number(w.calories); days[key].workouts.push({ id: w._id, exercise: w.exercise, duration: w.duration, calories: w.calories, type: w.type }); });
    return response(200, { month, days });
  }
  if (path === '/stats/streaks') return response(200, { stats: summarize(demoWorkouts()) });
  if (path === '/achievements') {
    const stats = summarize(demoWorkouts()); const values = { workouts: stats.workouts, calories: stats.calories, duration: stats.minutes, streak: stats.longestStreak };
    return response(200, { achievements: achievementCatalog.map(([id, title, description, icon, kind, target]) => ({ id, title, description, icon, kind, target, progress: Math.min(values[kind] || 0, target), unlockedAt: values[kind] >= target ? new Date().toISOString() : null })) });
  }
  return response(404, { message: `Demo API route not found: ${method} ${path}` });
}

export function getToken() { return localStorage.getItem('pulse_token'); }
export async function api(path, options = {}) {
  if (DEMO_MODE) return demoApi(path, options);
  const token = getToken();
  let response;
  try {
    response = await fetch(`${API_URL.replace(/\/$/, '')}${path}`, {
      ...options,
      headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers }
    });
  } catch {
    throw new Error(`Cannot reach the Pulse API at ${API_URL}. Start the backend or switch to demo mode.`);
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Something went wrong.');
  return data;
}
