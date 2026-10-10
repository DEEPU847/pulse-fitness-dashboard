import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity, ArrowDownRight, ArrowUpRight, BarChart3, Bell, CalendarDays, Check,
  ChevronDown, CircleHelp, Clock3, Dumbbell, Flame, LayoutDashboard, LogOut,
  Menu, MoreHorizontal, Plus, Search, Settings, Sparkles, Target, TrendingUp, Download,
  Trophy, X, Pencil, Trash2, Footprints, Bike, Waves, HeartPulse, Zap, Sun, Moon
} from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api, getToken } from './api.js';
import { GoogleLogin } from '@react-oauth/google';

const today = () => new Date().toISOString().slice(0, 10);
const localDayKey = (date) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
const localMonthKey = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; };
const initialForm = (defaultType = 'Cardio') => ({ exercise: '', type: defaultType, duration: 30, date: today(), calories: 220, notes: '' });
const prettyDate = (date) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const formatNumber = (n) => Number(n || 0).toLocaleString('en-US');
const iconFor = (type) => type === 'Strength' ? Dumbbell : type === 'Flexibility' ? Waves : type === 'Sports' ? Trophy : type === 'Other' ? HeartPulse : Footprints;
const avatarColors = ['#e3f4cf', '#d9eeeb', '#fce8d7', '#e9e2fb'];
const accentPalettes = {
  green: { name: 'Meadow', value: '#6eae40', strong: '#477d26', soft: '#edf6e7' },
  blue: { name: 'Ocean', value: '#4387d4', strong: '#2863a5', soft: '#e8f2fc' },
  violet: { name: 'Iris', value: '#8a6bd1', strong: '#6546aa', soft: '#f0ebfb' },
  coral: { name: 'Coral', value: '#df705e', strong: '#ad4d3e', soft: '#fff0ec' },
  rose: { name: 'Berry', value: '#cf5d91', strong: '#9f3d6b', soft: '#fbeaf2' }
};

function App() {
  const [user, setUser] = useState(null);
  const [authMode, setAuthMode] = useState('login');
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '' });
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState('');
  const [workouts, setWorkouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeNav, setActiveNav] = useState('Overview');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All types');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [theme, setTheme] = useState(() => localStorage.getItem('pulse_theme') || 'light');
  const [accent, setAccent] = useState(() => localStorage.getItem('pulse_accent') || 'green');
  const [defaultWorkoutType, setDefaultWorkoutType] = useState(() => localStorage.getItem('pulse_default_workout') || 'Cardio');
  const [reminder, setReminder] = useState(() => JSON.parse(localStorage.getItem('pulse_reminder') || '{"enabled":false,"time":"18:00"}'));
  const [sessionTime, setSessionTime] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setSessionTime(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('pulse_theme', theme);
  }, [theme]);

  useEffect(() => {
    const colors = accentPalettes[accent] || accentPalettes.green;
    const root = document.documentElement;
    root.style.setProperty('--accent', colors.value);
    root.style.setProperty('--accent-strong', colors.strong);
    root.style.setProperty('--accent-soft', colors.soft);
    localStorage.setItem('pulse_accent', accentPalettes[accent] ? accent : 'green');
  }, [accent]);

  useEffect(() => { localStorage.setItem('pulse_default_workout', defaultWorkoutType); }, [defaultWorkoutType]);
  useEffect(() => { localStorage.setItem('pulse_reminder', JSON.stringify(reminder)); }, [reminder]);

  useEffect(() => {
    if (!user || !reminder.enabled || !('Notification' in window) || Notification.permission !== 'granted') return undefined;
    const checkReminder = () => {
      const now = new Date();
      const day = localDayKey(now);
      const lastSent = localStorage.getItem('pulse_reminder_last_sent');
      if (now.toTimeString().slice(0, 5) >= reminder.time && lastSent !== day) {
        new Notification('Pulse workout reminder', { body: 'A little movement today can keep your momentum going.' });
        localStorage.setItem('pulse_reminder_last_sent', day);
      }
    };
    const timer = window.setInterval(checkReminder, 30_000);
    checkReminder();
    return () => window.clearInterval(timer);
  }, [user, reminder]);

  const loadWorkouts = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const query = new URLSearchParams();
      if (search.trim()) query.set('search', search.trim());
      if (filter !== 'All types') query.set('type', filter);
      const data = await api(`/workouts${query.size ? `?${query}` : ''}`);
      setWorkouts(data.workouts || []);
    } catch (e) {
      setError(e.message);
      if (e.message.toLowerCase().includes('session') || e.message.toLowerCase().includes('authentication')) logout();
    } finally { setLoading(false); }
  }, [search, filter]);

  const logout = () => {
    localStorage.removeItem('pulse_token');
    setUser(null); setWorkouts([]); setLoading(false);
  };

  useEffect(() => {
    if (!getToken()) { setLoading(false); return; }
    api('/auth/me').then(data => setUser(data.user)).catch(() => logout());
  }, []);
  useEffect(() => { if (user) loadWorkouts(); }, [user, loadWorkouts]);

  const totals = useMemo(() => workouts.reduce((acc, w) => ({
    workouts: acc.workouts + 1, minutes: acc.minutes + Number(w.duration || 0), calories: acc.calories + Number(w.calories || 0)
  }), { workouts: 0, minutes: 0, calories: 0 }), [workouts]);

  const todayWorkouts = useMemo(() => workouts.filter(w => localDayKey(new Date(w.date)) === localDayKey(sessionTime)), [workouts, sessionTime]);
  const todayTotals = useMemo(() => todayWorkouts.reduce((acc, w) => ({
    minutes: acc.minutes + Number(w.duration || 0), calories: acc.calories + Number(w.calories || 0)
  }), { minutes: 0, calories: 0 }), [todayWorkouts]);
  const greeting = sessionTime.getHours() < 12 ? 'Good morning' : sessionTime.getHours() < 17 ? 'Good afternoon' : sessionTime.getHours() < 22 ? 'Good evening' : 'Good night';

  const weekData = useMemo(() => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate() - i);
      const key = d.toLocaleDateString('en-CA');
      const calories = workouts.filter(w => new Date(w.date).toLocaleDateString('en-CA') === key)
        .reduce((sum, w) => sum + Number(w.calories || 0), 0);
      days.push({ day: d.toLocaleDateString('en-US', { weekday: 'short' }), calories });
    }
    return days;
  }, [workouts]);

  const thisWeekCount = useMemo(() => {
    const start = new Date(); start.setHours(0,0,0,0); start.setDate(start.getDate() - 6);
    return workouts.filter(w => new Date(w.date) >= start).length;
  }, [workouts]);

  const progressReport = useMemo(() => {
    const end = new Date(sessionTime); end.setHours(24, 0, 0, 0);
    const currentStart = new Date(end); currentStart.setDate(currentStart.getDate() - 7);
    const previousStart = new Date(currentStart); previousStart.setDate(previousStart.getDate() - 7);
    const sumRange = (start, finish) => workouts.filter(w => { const d = new Date(w.date); return d >= start && d < finish; }).reduce((a, w) => ({
      workouts: a.workouts + 1, minutes: a.minutes + Number(w.duration || 0), calories: a.calories + Number(w.calories || 0)
    }), { workouts: 0, minutes: 0, calories: 0 });
    const weeks = Array.from({ length: 4 }, (_, index) => {
      const start = new Date(currentStart); start.setDate(start.getDate() - (3 - index) * 7);
      const finish = new Date(start); finish.setDate(finish.getDate() + 7);
      return { week: index === 3 ? 'This week' : `${3 - index} wk${3 - index === 1 ? '' : 's'} ago`, ...sumRange(start, finish) };
    });
    return { current: sumRange(currentStart, end), previous: sumRange(previousStart, currentStart), weeks };
  }, [workouts, sessionTime]);

  async function handleGoogleSuccess(response) {
    setAuthBusy(true); setAuthError('');
    try {
      if (!response.credential) throw new Error('Google did not return a sign-in credential.');
      const data = await api('/auth/google', { method: 'POST', body: JSON.stringify({ credential: response.credential }) });
      localStorage.setItem('pulse_token', data.token);
      setUser(data.user); setAuthForm({ name: '', email: '', password: '' });
    } catch (e) { setAuthError(e.message || 'Google sign-in failed. Please try again.'); }
    finally { setAuthBusy(false); }
  }

  async function handleAuth(e) {
    e.preventDefault(); setAuthBusy(true); setAuthError('');
    try {
      const data = await api(`/auth/${authMode}`, { method: 'POST', body: JSON.stringify(authForm) });
      localStorage.setItem('pulse_token', data.token);
      setUser(data.user); setAuthForm({ name: '', email: '', password: '' });
    } catch (e) { setAuthError(e.message); }
    finally { setAuthBusy(false); }
  }

  function openAdd() { setEditing(null); setForm(initialForm(defaultWorkoutType)); setModalOpen(true); }
  function openEdit(workout) {
    setEditing(workout._id);
    setForm({ exercise: workout.exercise, type: workout.type, duration: workout.duration,
      date: new Date(workout.date).toISOString().slice(0,10), calories: workout.calories, notes: workout.notes || '' });
    setModalOpen(true);
  }
  async function saveWorkout(e) {
    e.preventDefault(); setSaving(true); setNotice('');
    try {
      const payload = { ...form, duration: Number(form.duration), calories: Number(form.calories) };
      await api(editing ? `/workouts/${editing}` : '/workouts', { method: editing ? 'PUT' : 'POST', body: JSON.stringify(payload) });
      setModalOpen(false); setNotice(editing ? 'Workout updated successfully.' : 'Workout added successfully.');
      await loadWorkouts();
    } catch (e) { setNotice(e.message); }
    finally { setSaving(false); }
  }
  async function deleteWorkout(id) {
    if (!window.confirm('Delete this workout? This cannot be undone.')) return;
    try { await api(`/workouts/${id}`, { method: 'DELETE' }); setNotice('Workout deleted.'); await loadWorkouts(); }
    catch (e) { setNotice(e.message); }
  }

  function exportWorkouts() {
    if (!workouts.length) { setNotice('There are no workouts to export yet.'); return; }
    const columns = ['Date', 'Exercise', 'Type', 'Duration (minutes)', 'Calories', 'Notes'];
    const safeCell = value => {
      let text = String(value ?? '');
      if (/^[=+@\-\t\r]/.test(text)) text = `'${text}`;
      return `"${text.replace(/"/g, '""')}"`;
    };
    const rows = workouts.map(w => [new Date(w.date).toLocaleDateString('en-CA'), w.exercise, w.type, w.duration, w.calories, w.notes]);
    const csv = [columns, ...rows].map(row => row.map(safeCell).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url; link.download = `pulse-workouts-${localDayKey(new Date())}.csv`;
    document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
    setNotice(`Exported ${workouts.length} workout${workouts.length === 1 ? '' : 's'} to CSV.`);
  }

  if (!user) return <AuthScreen mode={authMode} setMode={setAuthMode} form={authForm} setForm={setAuthForm}
    onSubmit={handleAuth} onGoogleSuccess={handleGoogleSuccess} onGoogleError={() => setAuthError('Google sign-in was cancelled or could not start. Please try again.')} busy={authBusy} error={authError} />;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#" onClick={e => { e.preventDefault(); setActiveNav('Overview'); }}>
          <span className="brand-mark"><Activity size={23} strokeWidth={2.8}/></span><span>pulse<span className="brand-dot">.</span></span>
        </a>
        <div className="workspace-label">WORKSPACE</div>
        <nav className="main-nav">
          <button className={`nav-item ${activeNav === 'Overview' ? 'active' : ''}`} onClick={() => setActiveNav('Overview')}><LayoutDashboard size={18}/> Overview</button>
          <button className={`nav-item ${activeNav === 'My workouts' ? 'active' : ''}`} onClick={() => setActiveNav('My workouts')}><Dumbbell size={18}/> My workouts <span className="nav-count">{workouts.length}</span></button>
          <button className={`nav-item ${activeNav === 'Progress' ? 'active' : ''}`} onClick={() => setActiveNav('Progress')}><BarChart3 size={18}/> Progress</button>
          <button className={`nav-item ${activeNav === 'Goals' ? 'active' : ''}`} onClick={() => setActiveNav('Goals')}><Target size={18}/> Goals</button>
          <button className={`nav-item ${activeNav === 'Activity calendar' ? 'active' : ''}`} onClick={() => setActiveNav('Activity calendar')}><CalendarDays size={18}/> Activity calendar</button>
          <button className={`nav-item ${activeNav === 'Achievements' ? 'active' : ''}`} onClick={() => setActiveNav('Achievements')}><Trophy size={18}/> Achievements</button>
          <button className={`nav-item ${activeNav === 'Settings' ? 'active' : ''}`} onClick={() => setActiveNav('Settings')}><Settings size={18}/> Settings</button>
        </nav>
        <div className="sidebar-spacer"/>
        <div className="upgrade-card">
          <div className="upgrade-icon"><Sparkles size={18}/></div>
          <strong>Small steps.<br/>Big results.</strong>
          <p>Consistency is the secret to progress. Keep showing up!</p>
          <div className="upgrade-progress"><span/></div>
          <div className="upgrade-foot"><span>Your journey</span><b>in motion</b></div>
        </div>
        <div className="sidebar-bottom">
          <button className="nav-item" onClick={() => setNotice('Need help? Keep tracking your workouts to see your progress here.')}><CircleHelp size={18}/> Help & support</button>
          <div className="profile-mini">
            <div className="user-avatar">{user.name?.slice(0,1).toUpperCase() || 'U'}</div>
            <div className="profile-info"><strong>{user.name}</strong><span>Personal account</span></div>
            <button className="icon-button logout-button" title="Log out" onClick={logout}><LogOut size={17}/></button>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumb"><span>Workspace</span><span className="crumb-slash">/</span><b>{activeNav}</b></div>
          <div className="topbar-right"><span className="today-pill"><span className="status-dot"/>{new Date().toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})}</span><button className="icon-button theme-toggle" title={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`} aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`} onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>{theme === 'light' ? <Moon size={18}/> : <Sun size={18}/>}</button><button className="icon-button notification" title="Notifications" onClick={() => setNotice('You’re all caught up!')}><Bell size={19}/><i/></button></div>
        </header>

        <div className="page-wrap">
          <section className="welcome-row">
            <div><div className="eyebrow"><span className="eyebrow-line"/> YOUR FITNESS, IN FOCUS</div>
              <h1>{activeNav === 'My workouts' ? 'Your workout log' : activeNav === 'Progress' ? 'Your progress' : activeNav === 'Settings' ? 'Your settings' : <>{greeting}, {user.name.split(' ')[0]} <span className="wave">✳</span></>}</h1>
              <p className="subtitle">{activeNav === 'My workouts' ? 'Every rep, every run, every little win.' : activeNav === 'Progress' ? 'Compare your last four weeks and see how your routine is building.' : activeNav === 'Settings' ? 'Personalize how Pulse works for you.' : 'Ready to make today count? Here’s your activity at a glance.'}</p>
              {activeNav === 'Overview' && <p className="daily-summary">{todayWorkouts.length ? `Today so far: ${todayWorkouts.length} workout${todayWorkouts.length === 1 ? '' : 's'} · ${formatNumber(todayTotals.minutes)} active minutes · ${formatNumber(todayTotals.calories)} calories. Great work!` : 'No workouts logged today yet. Even a short session counts.'}</p>}
            </div>
            <button className="primary-button" onClick={openAdd}><Plus size={18} strokeWidth={2.5}/> Log a workout</button>
          </section>

          {notice && <div className="notice"><Check size={17}/><span>{notice}</span><button onClick={() => setNotice('')}><X size={16}/></button></div>}
          {error && <div className="alert"><strong>Couldn’t load workouts:</strong> {error} <button onClick={loadWorkouts}>Retry</button></div>}

          {['Goals','Activity calendar','Achievements'].includes(activeNav) ? <FeaturePage page={activeNav} onNotice={setNotice}/> : activeNav === 'Settings' ? <SettingsPage theme={theme} setTheme={setTheme} accent={accent} setAccent={setAccent} defaultWorkoutType={defaultWorkoutType} setDefaultWorkoutType={setDefaultWorkoutType} reminder={reminder} setReminder={setReminder} onNotice={setNotice} user={user}/> : activeNav === 'Progress' ? <ProgressReports report={progressReport} workouts={workouts}/> : <>
          <section className="stats-grid">
            <StatCard label="Total workouts" value={formatNumber(totals.workouts)} icon={Dumbbell} tone="green" change={`${thisWeekCount} in the last 7 days`} trend="up"/>
            <StatCard label="Time active" value={`${formatNumber(totals.minutes)} min`} icon={Clock3} tone="blue" change="Total time recorded" />
            <StatCard label="Calories burned" value={formatNumber(totals.calories)} icon={Flame} tone="orange" change="Across all workouts" />
            <StatCard label="Weekly goal" value={`${Math.min(thisWeekCount, 5)}/5`} icon={Target} tone="purple" change={thisWeekCount >= 5 ? 'Goal reached — amazing!' : `${5-thisWeekCount} workouts to your goal`} progress={Math.min(thisWeekCount/5,1)}/>
          </section>

          <section className="analytics-grid">
            <div className="panel chart-panel">
              <div className="panel-header"><div><div className="panel-kicker">YOUR ACTIVITY</div><h2>Calories burned</h2><p>Daily activity over the last 7 days</p></div><span className="period-pill"><CalendarDays size={14}/> Last 7 days <ChevronDown size={14}/></span></div>
              <div className="chart-summary"><strong>{formatNumber(weekData.reduce((s,d)=>s+d.calories,0))}</strong><span>kcal this week</span><span className="chart-trend"><TrendingUp size={14}/> Stay consistent</span></div>
              <div className="chart-wrap">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={weekData} margin={{top:12,right:8,left:-18,bottom:0}}>
                    <defs><linearGradient id="caloriesFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#85c94b" stopOpacity={0.28}/><stop offset="95%" stopColor="#85c94b" stopOpacity={0.01}/></linearGradient></defs>
                    <CartesianGrid stroke="#edf0eb" strokeDasharray="4 5" vertical={false}/>
                    <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fill:'#929a91',fontSize:12}} dy={12}/>
                    <YAxis axisLine={false} tickLine={false} tick={{fill:'#929a91',fontSize:11}}/>
                    <Tooltip contentStyle={{border:'1px solid #e6ebe2',borderRadius:12,fontSize:12,boxShadow:'0 8px 24px #1c2d1210'}} formatter={v=>[`${v} kcal`,'Calories']}/>
                    <Area type="monotone" dataKey="calories" stroke="#70b83b" strokeWidth={2.5} fill="url(#caloriesFill)" activeDot={{r:5,strokeWidth:0,fill:'#4b9225'}}/>
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="panel goal-panel">
              <div className="panel-header"><div><div className="panel-kicker">KEEP IT UP</div><h2>Weekly activity</h2><p>Your consistency matters</p></div><span className="tiny-icon"><Zap size={17}/></span></div>
              <div className="goal-ring-wrap"><div className="goal-ring" style={{'--progress':`${Math.min(thisWeekCount/5,1)*100}%`}}><div className="goal-ring-inner"><strong>{Math.min(thisWeekCount,5)}<span>/5</span></strong><small>workouts</small></div></div></div>
              <div className="goal-copy"><strong>{thisWeekCount >= 5 ? 'You hit your weekly goal!' : thisWeekCount === 0 ? 'Your week starts here' : 'You’re building a habit!'}</strong><span>{thisWeekCount >= 5 ? 'Fantastic consistency. Keep it going.' : `Log ${5-thisWeekCount} more ${5-thisWeekCount===1?'workout':'workouts'} to reach your weekly goal.`}</span></div>
              <div className="goal-days">{['M','T','W','T','F','S','S'].map((d,i)=><div key={i} className={`goal-day ${i < Math.min(thisWeekCount,7) ? 'done' : ''}`}><span>{d}</span><i>{i < Math.min(thisWeekCount,7) ? <Check size={12}/> : ''}</i></div>)}</div>
            </div>
          </section>

          <section className="panel workouts-panel">
            <div className="workouts-header"><div><div className="panel-kicker">THE WORK YOU PUT IN</div><h2>{activeNav === 'Progress' ? 'Recent progress' : 'Recent workouts'} <span className="count-badge">{workouts.length}</span></h2><p>Your effort adds up. Here’s your latest activity.</p></div>
              <div className="workout-actions"><button className="secondary-button export-button" onClick={exportWorkouts}><Download size={15}/> Export CSV</button><label className="search-box"><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search workouts..."/></label>
                <select className="filter-select" value={filter} onChange={e=>setFilter(e.target.value)}><option>All types</option>{['Cardio','Strength','Flexibility','Sports','Other'].map(t=><option key={t}>{t}</option>)}</select>
              </div>
            </div>
            <div className="table-wrap">
              <table><thead><tr><th>WORKOUT</th><th>DATE</th><th>DURATION</th><th>CALORIES</th><th>TYPE</th><th><span className="sr-only">Actions</span></th></tr></thead>
                <tbody>
                  {loading ? <tr><td colSpan="6" className="empty-cell">Loading your workouts…</td></tr> :
                  workouts.length === 0 ? <tr><td colSpan="6" className="empty-cell"><div className="empty-state"><div className="empty-icon"><Dumbbell size={22}/></div><strong>No workouts found</strong><span>Log your first workout to start tracking your progress.</span><button className="text-button" onClick={openAdd}><Plus size={15}/> Add a workout</button></div></td></tr> :
                  workouts.slice(0,8).map((w,i)=>{ const TypeIcon=iconFor(w.type); return <tr key={w._id}><td><div className="workout-name"><span className={`exercise-icon exercise-${w.type.toLowerCase()}`}><TypeIcon size={17}/></span><span><strong>{w.exercise}</strong><small>{w.notes || w.type}</small></span></div></td><td className="date-cell">{prettyDate(w.date)}</td><td><strong className="table-strong">{w.duration}</strong><span className="unit"> min</span></td><td><strong className="table-strong">{formatNumber(w.calories)}</strong><span className="unit"> kcal</span></td><td><span className={`type-pill type-${w.type.toLowerCase()}`}>{w.type}</span></td><td><div className="row-actions"><button className="icon-button" title="Edit workout" onClick={()=>openEdit(w)}><Pencil size={15}/></button><button className="icon-button delete-action" title="Delete workout" onClick={()=>deleteWorkout(w._id)}><Trash2 size={15}/></button></div></td></tr>; })}
                </tbody>
              </table>
            </div>
            {workouts.length > 8 && <div className="table-footer"><span>Showing 8 of {workouts.length} workouts</span><button className="text-button" onClick={()=>setActiveNav('My workouts')}>View all workouts <ArrowUpRight size={15}/></button></div>}
          </section>
          </>}
          <footer className="footer"><span>© {new Date().getFullYear()} Pulse Fitness</span><span>One day at a time <span className="footer-heart">♥</span></span></footer>
        </div>
      </main>
      {modalOpen && <WorkoutModal form={form} setForm={setForm} editing={Boolean(editing)} saving={saving} onClose={()=>setModalOpen(false)} onSubmit={saveWorkout}/>}
    </div>
  );
}

function ProgressReports({ report, workouts }) {
  const changeLabel = (current, previous, unit) => {
    if (!previous) return current ? `Started this week · +${current} ${unit}` : 'No activity in either period';
    const change = Math.round(((current - previous) / previous) * 100);
    return `${change > 0 ? '+' : ''}${change}% vs previous 7 days`;
  };
  const maxWorkouts = Math.max(1, ...report.weeks.map(week => week.workouts));
  const records = useMemo(() => {
    const longest = workouts.reduce((best, workout) => Number(workout.duration) > Number(best?.duration || 0) ? workout : best, null);
    const mostCalories = workouts.reduce((best, workout) => Number(workout.calories) > Number(best?.calories || 0) ? workout : best, null);
    const byDay = workouts.reduce((days, workout) => {
      const key = localDayKey(new Date(workout.date));
      days[key] = (days[key] || 0) + 1;
      return days;
    }, {});
    const activeDay = Object.entries(byDay).sort((a, b) => b[1] - a[1])[0];
    return { longest, mostCalories, activeDay };
  }, [workouts]);
  return <section className="progress-report">
    <div className="report-grid">
      <StatCard label="Workouts · last 7 days" value={report.current.workouts} icon={Dumbbell} tone="green" change={changeLabel(report.current.workouts, report.previous.workouts, 'workouts')} trend={report.current.workouts >= report.previous.workouts}/>
      <StatCard label="Active minutes · last 7 days" value={formatNumber(report.current.minutes)} icon={Clock3} tone="blue" change={changeLabel(report.current.minutes, report.previous.minutes, 'minutes')} trend={report.current.minutes >= report.previous.minutes}/>
      <StatCard label="Calories · last 7 days" value={formatNumber(report.current.calories)} icon={Flame} tone="orange" change={changeLabel(report.current.calories, report.previous.calories, 'calories')} trend={report.current.calories >= report.previous.calories}/>
    </div>
    <div className="panel report-chart">
      <div className="panel-header"><div><div className="panel-kicker">FOUR WEEK OVERVIEW</div><h2>Workout consistency</h2><p>Compare the number of workouts you logged each week.</p></div><span className="tiny-icon"><TrendingUp size={17}/></span></div>
      <div className="week-bars" role="img" aria-label="Workout count for each of the last four weeks">
        {report.weeks.map(week => <div className="week-bar-column" key={week.week}><strong>{week.workouts}</strong><div className="week-bar-track"><span className="week-bar-fill" style={{height:`${Math.max(6, week.workouts / maxWorkouts * 100)}%`}}/></div><span>{week.week}</span></div>)}
      </div>
      <p className="report-footnote">This week is compared with the previous seven days. Keep logging workouts to build a clearer trend.</p>
    </div>
    <div className="panel personal-records"><div className="panel-kicker">YOUR PERSONAL RECORDS</div><h2>Milestones from your workout history</h2>
      {workouts.length ? <div className="record-grid">
        <div className="record-card"><span>Longest workout</span><strong>{formatNumber(records.longest?.duration)} min</strong><small>{records.longest?.exercise} · {prettyDate(records.longest?.date)}</small></div>
        <div className="record-card"><span>Most calories in one workout</span><strong>{formatNumber(records.mostCalories?.calories)} kcal</strong><small>{records.mostCalories?.exercise} · {prettyDate(records.mostCalories?.date)}</small></div>
        <div className="record-card"><span>Most workouts in one day</span><strong>{records.activeDay?.[1]} workouts</strong><small>{prettyDate(records.activeDay?.[0])}</small></div>
      </div> : <p className="report-footnote">Log a workout to start building your personal records.</p>}
    </div>
  </section>;
}

function SettingsPage({ theme, setTheme, accent, setAccent, defaultWorkoutType, setDefaultWorkoutType, reminder, setReminder, onNotice, user }) {
  async function updateReminder(enabled) {
    if (enabled) {
      if (!('Notification' in window)) { onNotice('This browser does not support desktop notifications.'); return; }
      let permission = Notification.permission;
      if (permission === 'default') permission = await Notification.requestPermission();
      if (permission !== 'granted') { onNotice('Allow notifications in your browser to turn on workout reminders.'); return; }
    }
    setReminder(current => ({ ...current, enabled }));
  }
  function resetPreferences() {
    setTheme('light'); setAccent('green'); setDefaultWorkoutType('Cardio'); setReminder({ enabled: false, time: '18:00' });
    onNotice('Settings restored to their defaults.');
  }
  return <section className="settings-grid">
    <div className="panel settings-card"><div className="panel-kicker">PERSONAL PREFERENCES</div><h2>Appearance and workouts</h2>
      <label className="setting-row"><span><strong>Color theme</strong><small>Choose the look you prefer.</small></span><select className="filter-select" value={theme} onChange={e=>setTheme(e.target.value)}><option value="light">Light</option><option value="dark">Dark</option></select></label>
      <div className="setting-row"><span><strong>Accent color</strong><small>Changes highlights and controls across the website.</small></span><div className="accent-options" role="group" aria-label="Choose accent color">{Object.entries(accentPalettes).map(([key,color])=><button key={key} type="button" className={`accent-swatch ${accent===key?'selected':''}`} style={{'--swatch':color.value}} aria-label={`${color.name} accent`} aria-pressed={accent===key} title={color.name} onClick={()=>setAccent(key)}/>)}</div></div>
      <label className="setting-row"><span><strong>Default workout type</strong><small>Preselected when you log a workout.</small></span><select className="filter-select" value={defaultWorkoutType} onChange={e=>setDefaultWorkoutType(e.target.value)}>{['Cardio','Strength','Flexibility','Sports','Other'].map(type=><option key={type}>{type}</option>)}</select></label>
    </div>
    <div className="panel settings-card"><div className="panel-kicker">STAY CONSISTENT</div><h2>Workout reminder</h2><p className="settings-description">Get a browser notification at your chosen time. The dashboard must be open, and notifications must be allowed.</p>
      <label className="setting-row"><span><strong>Daily reminder</strong><small>{reminder.enabled ? 'Reminder is on.' : 'Reminder is off.'}</small></span><input aria-label="Enable daily workout reminder" type="checkbox" checked={reminder.enabled} onChange={e=>updateReminder(e.target.checked)}/></label>
      <label className="setting-row"><span><strong>Reminder time</strong><small>Uses your device’s local time.</small></span><input className="filter-select" type="time" value={reminder.time} onChange={e=>setReminder(current=>({...current,time:e.target.value}))}/></label>
    </div>
    <div className="panel settings-card account-settings"><div className="panel-kicker">ACCOUNT</div><h2>Your profile</h2><div className="account-details"><span>Name</span><strong>{user.name}</strong><span>Email</span><strong>{user.email}</strong></div><button className="secondary-button" onClick={resetPreferences}>Restore default preferences</button></div>
  </section>;
}

function FeaturePage({ page, onNotice }) {
  const [goals,setGoals] = useState([]); const [stats,setStats] = useState(null); const [calendar,setCalendar] = useState({}); const [achievements,setAchievements] = useState([]); const [month,setMonth] = useState(localMonthKey);
  const [goalForm,setGoalForm] = useState({type:'workouts',target:5,period:'weekly'}); const [busy,setBusy] = useState(false); const [err,setErr] = useState(''); const [selected,setSelected] = useState('');
  const refresh = useCallback(async()=>{ setErr(''); try { if(page==='Goals'){const d=await api('/goals');setGoals(d.goals||[]);} if(page==='Activity calendar'){const [c,s]=await Promise.all([api(`/stats/calendar?month=${month}`),api('/stats/streaks')]);setCalendar(c.days||{});setStats(s.stats);} if(page==='Achievements'){const d=await api('/achievements');setAchievements(d.achievements||[]);} }catch(e){setErr(e.message||'Could not load this section.');}},[page,month]);
  useEffect(()=>{refresh();},[refresh]);
  async function addGoal(e){e.preventDefault();setBusy(true);setErr('');try{await api('/goals',{method:'POST',body:JSON.stringify(goalForm)});setGoalForm({type:'workouts',target:5,period:'weekly'});await refresh();onNotice('Goal created successfully.');}catch(e){setErr(e.message);}finally{setBusy(false);}}
  async function deleteGoal(id){if(!window.confirm('Delete this goal?'))return;try{await api(`/goals/${id}`,{method:'DELETE'});await refresh();}catch(e){setErr(e.message);}}
  const titleMap={'Goals':'Your fitness goals','Activity calendar':'Your activity calendar','Achievements':'Your achievements'};
  const subMap={'Goals':'Set a target, then make a little progress every day.','Activity calendar':'Consistency is built one day at a time.','Achievements':'Every milestone is proof that your effort is adding up.'};
  const panelStyle={background:'var(--surface)',border:'1px solid var(--line)',borderRadius:14,padding:22,marginBottom:18};
  const keyFor=(d)=>`${month}-${String(d).padStart(2,'0')}`;
  const daysInMonth=new Date(Number(month.slice(0,4)),Number(month.slice(5,7)),0).getDate(); const firstDay=(new Date(`${month}-01T12:00:00`).getDay()+6)%7;
  const moveMonth=(delta)=>{const d=new Date(`${month}-01T12:00:00`);d.setMonth(d.getMonth()+delta);setMonth(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`);setSelected('');};
  return <section className="feature-page" style={{display:'grid',gap:16}}><div><div className="panel-kicker">YOUR NEXT PERSONAL BEST</div><h2 style={{fontSize:25,margin:'6px 0'}}>{titleMap[page]}</h2><p className="subtitle">{subMap[page]}</p></div>{err&&<div className="alert">{err}<button onClick={refresh}>Retry</button></div>}
  {page==='Goals'&&<><div className="feature-panel" style={panelStyle}><h3 style={{marginTop:0}}>Create a goal</h3><form onSubmit={addGoal} style={{display:'flex',gap:12,flexWrap:'wrap',alignItems:'end'}}><label style={{display:'grid',gap:6,fontSize:12}}>Measure<select className="filter-select" value={goalForm.type} onChange={e=>setGoalForm({...goalForm,type:e.target.value})}><option value="workouts">Workouts</option><option value="duration">Duration (minutes)</option><option value="calories">Calories</option></select></label><label style={{display:'grid',gap:6,fontSize:12}}>Target<input className="filter-select" type="number" min="1" max="1000000" required value={goalForm.target} onChange={e=>setGoalForm({...goalForm,target:e.target.value})}/></label><label style={{display:'grid',gap:6,fontSize:12}}>Period<select className="filter-select" value={goalForm.period} onChange={e=>setGoalForm({...goalForm,period:e.target.value})}><option value="daily">Daily</option><option value="weekly">Weekly</option></select></label><button className="primary-button" disabled={busy}>{busy?'Saving…':'Add goal'}</button></form></div><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))',gap:14}}>{goals.map(g=><div key={g._id} className="feature-panel" style={panelStyle}><div style={{display:'flex',justifyContent:'space-between',gap:10}}><div><span className="panel-kicker">{g.period.toUpperCase()} GOAL</span><h3>{({workouts:'Workouts',duration:'Active minutes',calories:'Calories burned'})[g.type]}</h3></div><button className="icon-button delete-action" onClick={()=>deleteGoal(g._id)} title="Delete goal"><Trash2 size={16}/></button></div><strong style={{fontSize:26,color:'#4f922f'}}>{g.current||0}<span style={{fontSize:14,color:'#9aa394'}}> / {g.target}</span></strong><div style={{height:8,background:'#edf3e8',borderRadius:9,margin:'12px 0',overflow:'hidden'}}><div style={{width:`${g.percent||0}%`,height:'100%',background:'#72b54b',borderRadius:9}}/></div><p style={{color:'#7e8a76',fontSize:12,margin:0}}>{g.percent||0}% complete · {g.remaining||0} remaining</p></div>)}{!goals.length&&<div className="feature-panel" style={panelStyle}>No goals yet. Create your first goal above.</div>}</div></>}
  {page==='Activity calendar'&&<div className="feature-panel" style={panelStyle}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,marginBottom:18}}><button className="secondary-button" onClick={()=>moveMonth(-1)}>← Previous</button><h3>{new Date(`${month}-01T12:00:00`).toLocaleDateString('en-US',{month:'long',year:'numeric'})}</h3><button className="secondary-button" onClick={()=>moveMonth(1)} disabled={month>=localMonthKey()}>Next →</button></div><div style={{display:'grid',gridTemplateColumns:'repeat(7,minmax(0,1fr))',gap:7}}>{['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d=><div key={d} style={{textAlign:'center',fontSize:11,color:'#879283',padding:5}}>{d}</div>)}{Array.from({length:firstDay},(_,i)=><div key={`blank${i}`}/>)}{Array.from({length:daysInMonth},(_,i)=>{const d=i+1,k=keyFor(d),v=calendar[k],active=selected===k;return <button key={k} title={v?`${v.count} workouts, ${v.minutes} minutes, ${v.calories} calories`:`${k}: no activity`} onClick={()=>setSelected(k)} style={{minHeight:58,borderRadius:9,border:active?'2px solid #3f842a':'1px solid #e5ebdf',background:v?(v.count>=3?'#5d9d3c':v.count===2?'#a8d58b':'#dcefd0'):'#f7f9f5',color:'#34432d',cursor:'pointer',fontWeight:700}}>{d}{v&&<small style={{display:'block',fontWeight:500,fontSize:10}}>{v.count} workout{v.count===1?'':'s'}</small>}</button>})}</div><p style={{fontSize:12,color:'#879283',marginTop:16}}>Green squares indicate workout activity. Select a date to view its summary.</p>{selected&&<div style={{marginTop:12,padding:15,background:'#f5f9f1',borderRadius:10}}><strong>{selected}</strong><p style={{fontSize:13}}>{calendar[selected]?`${calendar[selected].count} workouts · ${calendar[selected].minutes} minutes · ${calendar[selected].calories} calories`: 'No workouts recorded for this date.'}</p>{calendar[selected]?.workouts?.map(w=><div key={w.id} style={{fontSize:12,padding:'4px 0'}}>{w.exercise} · {w.duration} min · {w.calories} kcal</div>)}</div>}<div style={{display:'flex',gap:16,flexWrap:'wrap',marginTop:18,fontSize:12}}><span>Current streak: <b>{stats?.currentStreak||0} days</b></span><span>Longest streak: <b>{stats?.longestStreak||0} days</b></span><span>Active days: <b>{stats?.activeDays||0}</b></span></div></div>}
  {page==='Achievements'&&<div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:14}}>{achievements.map(a=><div key={a.id} style={{...panelStyle,opacity:a.unlockedAt?1:.72,marginBottom:0}}><div style={{fontSize:30}}>{a.icon}</div><h3 style={{margin:'10px 0 5px'}}>{a.title} {a.unlockedAt?'✓':''}</h3><p style={{fontSize:12,color:'#7f8a78',minHeight:34}}>{a.description}</p><div style={{height:7,background:'#edf3e8',borderRadius:9,overflow:'hidden'}}><div style={{width:`${Math.min(100,(a.progress/a.target)*100)}%`,height:'100%',background:a.unlockedAt?'#559638':'#a7c995'}}/></div><p style={{fontSize:11,color:'#879283'}}>{a.unlockedAt?`Unlocked ${new Date(a.unlockedAt).toLocaleDateString()}`:`Progress: ${a.progress} / ${a.target}`}</p></div>)}{!achievements.length&&<div className="feature-panel" style={panelStyle}>No achievements available yet. Log a workout to begin.</div>}</div>}
  </section>;
}

function StatCard({label,value,icon:Icon,tone,change,trend,progress}) {
  return <div className="stat-card"><div className="stat-top"><span>{label}</span><span className={`stat-icon ${tone}`}><Icon size={19}/></span></div><div className="stat-value">{value}</div><div className="stat-bottom">{progress !== undefined ? <div className="mini-progress"><span style={{width:`${progress*100}%`}}/></div> : trend ? <ArrowUpRight size={14} className="positive-arrow"/> : null}<span>{change}</span></div></div>;
}

function AuthScreen({mode,setMode,form,setForm,onSubmit,onGoogleSuccess,onGoogleError,busy,error}) {
  return <div className="auth-page"><div className="auth-art"><a className="brand auth-brand" href="#"><span className="brand-mark"><Activity size={23} strokeWidth={2.8}/></span><span>pulse<span className="brand-dot">.</span></span></a><div className="art-copy"><span className="art-tag"><Sparkles size={14}/> YOUR JOURNEY STARTS HERE</span><h1>Stronger every day.<br/><em>Better in every way.</em></h1><p>A little progress each day adds up to big results. Track your movement, celebrate your wins, and keep going.</p><div className="art-stats"><div><strong>01</strong><span>Show up</span></div><i/><div><strong>02</strong><span>Keep moving</span></div><i/><div><strong>03</strong><span>Feel stronger</span></div></div></div><div className="art-orbit orbit-one"/><div className="art-orbit orbit-two"/><div className="art-bottom"><span><Activity size={15}/> Your pace. Your progress.</span><span>Made for everyday wins.</span></div></div>
    <div className="auth-side"><div className="auth-mobile-brand"><span className="brand-mark"><Activity size={20}/></span> pulse.</div><div className="auth-box"><div className="auth-heading"><span className="auth-kicker">{mode==='login'?'WELCOME BACK':'GET STARTED'}</span><h2>{mode==='login'?'Good to see you again.':'Create your account.'}</h2><p>{mode==='login'?'Pick up where you left off. Your progress is waiting.':'Start your fitness journey with a plan that feels like you.'}</p></div>
      <form onSubmit={onSubmit} className="auth-form">{mode==='register'&&<label>Full name<div className="field-wrap"><input required maxLength="80" autoComplete="name" placeholder="Alex Morgan" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></div></label>}
        <label>Email address<div className="field-wrap"><input required type="email" autoComplete="email" placeholder="you@example.com" value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></div></label>
        <label>Password<div className="field-wrap"><input required minLength="8" type="password" autoComplete={mode==='login'?'current-password':'new-password'} placeholder="At least 8 characters" value={form.password} onChange={e=>setForm({...form,password:e.target.value})}/></div></label>
        {error&&<div className="auth-error">{error}</div>}
        <button className="primary-button auth-submit" disabled={busy}>{busy?'Please wait…':mode==='login'?'Sign in to Pulse':'Create account'} <ArrowUpRight size={17}/></button>
      </form><div className="auth-divider"><span>or continue with</span></div><div className="google-signin">{import.meta.env.VITE_GOOGLE_CLIENT_ID ? <GoogleLogin onSuccess={onGoogleSuccess} onError={onGoogleError} text="continue_with" shape="rectangular" theme="outline" size="large" width="320" /> : <div className="google-config-note">Google sign-in needs a Google OAuth Client ID. Add <code>VITE_GOOGLE_CLIENT_ID</code> to <code>client/.env</code>.</div>}</div><div className="auth-switch">{mode==='login'?"Don't have an account yet?":"Already have an account?"} <button type="button" onClick={()=>{setMode(mode==='login'?'register':'login')}}>{mode==='login'?'Create account':'Sign in'}</button></div><div className="auth-security"><span><Check size={13}/> Private by design</span><span><Check size={13}/> Your progress, your data</span></div></div><div className="auth-side-footer">© {new Date().getFullYear()} Pulse Fitness <span>Built for your next personal best.</span></div></div></div>;
}

function WorkoutModal({form,setForm,editing,saving,onClose,onSubmit}) {
  const set = (key,value) => setForm(old=>({...old,[key]:value}));
  return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-header"><div><span className="panel-kicker">{editing?'KEEP YOUR LOG CURRENT':'A LITTLE PROGRESS GOES A LONG WAY'}</span><h2 id="modal-title">{editing?'Edit workout':'Log a workout'}</h2><p>Capture the details. Celebrate the effort.</p></div><button className="icon-button modal-close" onClick={onClose} aria-label="Close"><X size={20}/></button></div>
    <form onSubmit={onSubmit} className="workout-form"><label className="full-field">Exercise name<input required maxLength="100" placeholder="e.g. Morning run, Leg day" value={form.exercise} onChange={e=>set('exercise',e.target.value)}/></label>
      <label>Workout type<select value={form.type} onChange={e=>set('type',e.target.value)}>{['Cardio','Strength','Flexibility','Sports','Other'].map(t=><option key={t}>{t}</option>)}</select></label>
      <label>Date<input required type="date" value={form.date} onChange={e=>set('date',e.target.value)}/></label>
      <label>Duration (minutes)<input required type="number" min="1" max="1440" value={form.duration} onChange={e=>set('duration',e.target.value)}/></label>
      <label>Calories burned<input required type="number" min="0" max="20000" value={form.calories} onChange={e=>set('calories',e.target.value)}/></label>
      <label className="full-field">Notes <span className="optional">(optional)</span><textarea maxLength="1000" rows="3" placeholder="How did it feel? Any personal bests?" value={form.notes} onChange={e=>set('notes',e.target.value)}/></label>
      <div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button" disabled={saving}>{saving?'Saving…':editing?'Save changes':<><Plus size={17}/> Save workout</>}</button></div>
    </form></div></div>;
}

export default App;
