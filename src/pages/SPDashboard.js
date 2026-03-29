import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import Shell from '../components/Shell';

const NAV = [{ path: '/sp', label: 'My Tasks' }];

const STATUS_COLOR = {
  pending:   '#3b82f6', accepted:  '#10b981',
  completed: '#d97706', rejected:  '#ef4444', incomplete: '#f59e0b',
};

export default function SPDashboard() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [tasks, setTasks]   = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    // Fetch ALL tasks, filter client-side by UID — avoids any index requirement
    return onSnapshot(query(collection(db, 'tasks')), snap => {
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const mine = all.filter(t => t.assignedTo === user.uid);
      setTasks(mine);
      setLoading(false);
    });
  }, [user]);

  const counts = {
    new:       tasks.filter(t => t.status === 'pending').length,
    active:    tasks.filter(t => t.status === 'accepted').length,
    completed: tasks.filter(t => t.status === 'completed').length,
  };

  const aiUpdates = tasks.filter(t =>
    t.pendingApprovals?.some(a => a.status === 'accepted')
  );

  return (
    <Shell nav={NAV}>
      <div style={s.wrap}>
        <div style={s.header}>
          <div>
            <h1 style={s.h1}>Welcome, {profile?.name?.split(' ')[0]}</h1>
            <p style={s.sub}>{profile?.territory} · {profile?.experience} experience</p>
          </div>
          <div style={s.scorePill}>
            <div style={s.scoreNum}>{profile?.performanceScore || 0}</div>
            <div style={s.scoreLbl}>Score</div>
          </div>
        </div>

        {/* Stats */}
        <div style={s.stats}>
          {[['New', counts.new, '#3b82f6'], ['Active', counts.active, '#10b981'], ['Done', counts.completed, '#d97706']].map(([l, v, c]) => (
            <div key={l} style={s.stat}>
              <div style={{ ...s.statVal, color: c }}>{v}</div>
              <div style={s.statLbl}>{l}</div>
            </div>
          ))}
        </div>

        {/* AI update banner */}
        {aiUpdates.length > 0 && (
          <div style={s.banner}>
            ✦ {aiUpdates.length} task(s) have manager-approved AI actions — check task details
          </div>
        )}

        {/* Task list */}
        <div style={s.sectionTitle}>Your Tasks</div>
        {loading && <div style={s.empty}>Loading tasks...</div>}
        {!loading && tasks.length === 0 && (
          <div style={s.empty}>No tasks assigned yet. Your manager will assign tasks here.</div>
        )}
        {tasks.map(t => (
          <div key={t.id} style={s.taskRow} onClick={() => navigate(`/sp/task/${t.id}`)}>
            <div>
              <div style={s.taskName}>{t.clientName}</div>
              <div style={s.taskMeta}>{t.productName} · {t.location} · Due {t.deadline}</div>
              {t.meetingReport && <div style={s.reportTag}>✦ AI report ready</div>}
            </div>
            <span style={{ ...s.badge, background: STATUS_COLOR[t.status] + '22', color: STATUS_COLOR[t.status] }}>
              {t.status}
            </span>
          </div>
        ))}
      </div>
    </Shell>
  );
}

const s = {
  wrap:        { maxWidth: 760, margin: '0 auto' },
  header:      { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 },
  h1:          { fontSize: 24, fontWeight: 600, color: '#f1f5f9' },
  sub:         { fontSize: 13, color: '#64748b', marginTop: 4 },
  scorePill:   { background: '#1e293b', border: '1px solid rgba(217,119,6,0.3)', borderRadius: 10, padding: '12px 18px', textAlign: 'center' },
  scoreNum:    { fontSize: 26, fontWeight: 700, color: '#d97706' },
  scoreLbl:    { fontSize: 11, color: '#64748b', marginTop: 2 },
  stats:       { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 20 },
  stat:        { background: '#1e293b', border: '1px solid #334155', borderRadius: 10, padding: '14px 12px' },
  statVal:     { fontSize: 24, fontWeight: 700 },
  statLbl:     { fontSize: 11, color: '#64748b', marginTop: 3 },
  banner:      { background: 'rgba(217,119,6,0.08)', border: '1px solid rgba(217,119,6,0.2)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#d97706', marginBottom: 20 },
  sectionTitle:{ fontSize: 12, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 },
  empty:       { color: '#475569', textAlign: 'center', padding: '40px 0', fontSize: 14 },
  taskRow:     { background: '#1e293b', border: '1px solid #334155', borderRadius: 10, padding: '14px 16px', marginBottom: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  taskName:    { fontSize: 15, fontWeight: 500, color: '#f1f5f9', marginBottom: 4 },
  taskMeta:    { fontSize: 12, color: '#64748b' },
  reportTag:   { fontSize: 11, color: '#d97706', marginTop: 4 },
  badge:       { fontSize: 11, fontWeight: 500, padding: '3px 10px', borderRadius: 100, flexShrink: 0, textTransform: 'capitalize' },
};
