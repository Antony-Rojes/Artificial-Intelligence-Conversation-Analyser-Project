import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, addDoc, onSnapshot, query, getDocs, where, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { groqChat } from '../ai';
import Shell from '../components/Shell';

const NAV = [
  { path: '/manager',          label: 'Dashboard' },
  { path: '/manager/approvals', label: 'Approvals' },
];

const PRODUCTS = [
  { id: 'CP-01', name: 'CardioPlus Tablet',    category: 'Cardiology',   maxDiscount: 18 },
  { id: 'DB-02', name: 'DiabeShield Capsule',  category: 'Diabetology',  maxDiscount: 15 },
  { id: 'NV-03', name: 'NeuroCalm Syrup',      category: 'Neurology',    maxDiscount: 12 },
];

const STATUS_COLOR = {
  pending:   '#3b82f6', accepted:  '#10b981',
  completed: '#d97706', rejected:  '#ef4444', incomplete: '#f59e0b',
};

export default function ManagerDashboard() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [tasks, setTasks]       = useState([]);
  const [spList, setSpList]     = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState({ clientName: '', location: '', product: 'CP-01', notes: '', deadline: '' });
  const [aiRec, setAiRec]       = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [saving, setSaving]     = useState(false);

  // Load SP profiles
  useEffect(() => {
    getDocs(query(collection(db, 'users'), where('role', '==', 'sp')))
      .then(snap => setSpList(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, []);

  // Listen to all tasks
  useEffect(() => {
    return onSnapshot(query(collection(db, 'tasks')), snap =>
      setTasks(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, []);

  const getAIRec = async () => {
    if (!form.clientName || spList.length === 0) return;
    setAiLoading(true); setAiRec(null);
    try {
      const product = PRODUCTS.find(p => p.id === form.product);
      const spInfo = spList.map(sp => ({
        uid: sp.uid, name: sp.name, territory: sp.territory,
        experience: sp.experience, performanceScore: sp.performanceScore,
        closureRate: sp.closureRate, strengths: sp.strengths || [],
      }));
      const prompt = `You are an AI assistant for MedNova Pharmaceuticals.

SALES PERSONS (choose from these exact UIDs):
${JSON.stringify(spInfo, null, 2)}

TASK:
- Client: ${form.clientName}
- Location: ${form.location}
- Product: ${product?.name} (${product?.category})
- Notes: ${form.notes}

Choose the best SP for this task based on territory, strengths and performance.
Reply ONLY with valid JSON, no extra text:
{
  "recommendedSP": "<exact uid from list>",
  "recommendedSPName": "<exact name>",
  "confidenceScore": 85,
  "reasoning": "2 sentence explanation",
  "talkingPoints": ["point 1", "point 2", "point 3"],
  "estimatedClosure": 70
}`;
      const raw = await groqChat(prompt);
      const parsed = JSON.parse(raw);
      // Verify UID exists
      const match = spList.find(sp => sp.uid === parsed.recommendedSP);
      if (!match) {
        const byName = spList.find(sp => sp.name?.toLowerCase().includes(parsed.recommendedSPName?.split(' ')[0]?.toLowerCase()));
        if (byName) { parsed.recommendedSP = byName.uid; parsed.recommendedSPName = byName.name; }
      }
      setAiRec(parsed);
    } catch (e) {
      setAiRec({ error: e.message });
    }
    setAiLoading(false);
  };

  const createTask = async () => {
    if (!form.clientName || !form.location || !form.deadline) return;
    setSaving(true);
    const product = PRODUCTS.find(p => p.id === form.product);
    const sp = aiRec?.recommendedSP
      ? spList.find(s => s.uid === aiRec.recommendedSP)
      : spList[0];
    await addDoc(collection(db, 'tasks'), {
      clientName: form.clientName, location: form.location,
      product: form.product, productName: product?.name,
      productCategory: product?.category, notes: form.notes,
      deadline: form.deadline, status: 'pending',
      assignedTo: sp?.uid || null, assignedToName: sp?.name || null,
      aiRec: aiRec || null,
      pendingApprovals: [], meetingReport: null,
      createdAt: serverTimestamp(),
    });
    setShowForm(false);
    setForm({ clientName: '', location: '', product: 'CP-01', notes: '', deadline: '' });
    setAiRec(null);
    setSaving(false);
  };

  const pending   = tasks.filter(t => t.status === 'pending').length;
  const active    = tasks.filter(t => t.status === 'accepted').length;
  const done      = tasks.filter(t => t.status === 'completed').length;
  const approvals = tasks.filter(t => t.pendingApprovals?.some(a => a.status === 'pending')).length;

  return (
    <Shell nav={NAV}>
      <div style={s.wrap}>
        {/* Header */}
        <div style={s.header}>
          <div>
            <h1 style={s.h1}>Good day, {profile?.name?.split(' ')[0]}</h1>
            <p style={s.sub}>Manager · MedNova Pharmaceuticals</p>
          </div>
          <button style={s.newBtn} onClick={() => setShowForm(true)}>+ New Task</button>
        </div>

        {/* Stats */}
        <div style={s.stats}>
          {[['Total', tasks.length, '#94a3b8'], ['Pending', pending, '#3b82f6'],
            ['Active', active, '#10b981'], ['Completed', done, '#d97706'],
            ['Approvals', approvals, '#ef4444']].map(([l, v, c]) => (
            <div key={l} style={s.stat}>
              <div style={{ ...s.statVal, color: c }}>{v}</div>
              <div style={s.statLbl}>{l}</div>
            </div>
          ))}
        </div>

        {/* Tasks */}
        <div style={s.section}>
          <div style={s.sectionTitle}>All Tasks</div>
          {tasks.length === 0
            ? <div style={s.empty}>No tasks yet. Create one above.</div>
            : tasks.map(t => (
              <div key={t.id} style={s.taskRow} onClick={() => navigate(`/manager/task/${t.id}`)}>
                <div style={s.taskLeft}>
                  <div style={s.taskName}>{t.clientName}</div>
                  <div style={s.taskMeta}>{t.productName} · {t.assignedToName || 'Unassigned'} · Due {t.deadline}</div>
                </div>
                <span style={{ ...s.badge, background: STATUS_COLOR[t.status] + '22', color: STATUS_COLOR[t.status] }}>
                  {t.status}
                </span>
              </div>
            ))
          }
        </div>
      </div>

      {/* Create Task Modal */}
      {showForm && (
        <div style={s.overlay} onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div style={s.modal}>
            <div style={s.modalHead}>
              <span style={s.modalTitle}>Create Task</span>
              <button style={s.closeBtn} onClick={() => setShowForm(false)}>✕</button>
            </div>
            <div style={s.modalBody}>
              <div style={s.grid2}>
                <Field label="Client / Doctor *" value={form.clientName} onChange={v => setForm({...form, clientName: v})} placeholder="Dr. Rajesh Kumar" />
                <Field label="Location *" value={form.location} onChange={v => setForm({...form, location: v})} placeholder="Apollo Clinic, Chennai" />
              </div>
              <div style={s.grid2}>
                <div style={s.field}>
                  <label style={s.lbl}>Product *</label>
                  <select style={s.input} value={form.product} onChange={e => setForm({...form, product: e.target.value})}>
                    {PRODUCTS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <Field label="Deadline *" type="date" value={form.deadline} onChange={v => setForm({...form, deadline: v})} />
              </div>
              <div style={s.field}>
                <label style={s.lbl}>Notes / Context</label>
                <textarea style={{ ...s.input, minHeight: 72, resize: 'vertical' }}
                  value={form.notes} onChange={e => setForm({...form, notes: e.target.value})}
                  placeholder="Doctor's background, current prescriptions, visit goal..." />
              </div>

              {/* AI Rec Button */}
              <button style={s.aiBtn} onClick={getAIRec} disabled={aiLoading || !form.clientName}>
                {aiLoading ? '⏳ Getting recommendation...' : '✦ Get AI SP Recommendation'}
              </button>

              {/* AI Result */}
              {aiRec && !aiRec.error && (
                <div style={s.aiCard}>
                  <div style={s.aiHead}>
                    <span style={s.aiTitle}>✦ {aiRec.recommendedSPName} recommended</span>
                    <span style={s.conf}>{aiRec.confidenceScore}% confidence</span>
                  </div>
                  <p style={s.aiReason}>{aiRec.reasoning}</p>
                  <div style={s.aiPoints}>
                    <div style={s.aiPtsTitle}>Talking points</div>
                    {aiRec.talkingPoints?.map((p, i) => <div key={i} style={s.pt}>· {p}</div>)}
                  </div>
                  <div style={s.closureRow}>
                    Estimated closure: <strong style={{ color: '#10b981' }}>{aiRec.estimatedClosure}%</strong>
                  </div>
                </div>
              )}
              {aiRec?.error && <div style={s.errBox}>{aiRec.error}</div>}

              <div style={s.modalFoot}>
                <button style={s.cancelBtn} onClick={() => setShowForm(false)}>Cancel</button>
                <button style={s.saveBtn} onClick={createTask} disabled={saving || !form.clientName || !form.location || !form.deadline}>
                  {saving ? 'Creating...' : 'Create & Assign'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}

function Field({ label, value, onChange, placeholder, type = 'text' }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 12, color: '#94a3b8', fontWeight: 500 }}>{label}</label>
      <input style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, padding: '10px 12px', fontSize: 14, color: '#f1f5f9', outline: 'none', width: '100%', fontFamily: 'Inter,sans-serif' }}
        type={type} value={value} placeholder={placeholder}
        onChange={e => onChange(e.target.value)} />
    </div>
  );
}

const s = {
  wrap:        { maxWidth: 860, margin: '0 auto' },
  header:      { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 },
  h1:          { fontSize: 24, fontWeight: 600, color: '#f1f5f9' },
  sub:         { fontSize: 13, color: '#64748b', marginTop: 4 },
  newBtn:      { background: '#d97706', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 14, fontWeight: 600, color: '#fff', cursor: 'pointer' },
  stats:       { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px,1fr))', gap: 10, marginBottom: 28 },
  stat:        { background: '#1e293b', border: '1px solid #334155', borderRadius: 10, padding: '14px 12px' },
  statVal:     { fontSize: 24, fontWeight: 700 },
  statLbl:     { fontSize: 11, color: '#64748b', marginTop: 3 },
  section:     {},
  sectionTitle:{ fontSize: 12, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 },
  empty:       { color: '#475569', textAlign: 'center', padding: '40px 0', fontSize: 14 },
  taskRow:     { background: '#1e293b', border: '1px solid #334155', borderRadius: 10, padding: '14px 16px', marginBottom: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  taskLeft:    {},
  taskName:    { fontSize: 15, fontWeight: 500, color: '#f1f5f9', marginBottom: 4 },
  taskMeta:    { fontSize: 12, color: '#64748b' },
  badge:       { fontSize: 11, fontWeight: 500, padding: '3px 10px', borderRadius: 100, flexShrink: 0, textTransform: 'capitalize' },
  // Modal
  overlay:     { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 },
  modal:       { background: '#1e293b', border: '1px solid #334155', borderRadius: 14, width: '100%', maxWidth: 580, maxHeight: '92vh', overflowY: 'auto' },
  modalHead:   { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px 0' },
  modalTitle:  { fontSize: 18, fontWeight: 600, color: '#f1f5f9' },
  closeBtn:    { background: 'none', border: 'none', color: '#64748b', fontSize: 18, cursor: 'pointer' },
  modalBody:   { padding: '16px 24px 24px', display: 'flex', flexDirection: 'column', gap: 14 },
  grid2:       { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  field:       { display: 'flex', flexDirection: 'column', gap: 6 },
  lbl:         { fontSize: 12, color: '#94a3b8', fontWeight: 500 },
  input:       { background: '#0f172a', border: '1px solid #334155', borderRadius: 8, padding: '10px 12px', fontSize: 14, color: '#f1f5f9', outline: 'none', width: '100%', fontFamily: 'Inter,sans-serif' },
  aiBtn:       { background: 'rgba(217,119,6,0.1)', border: '1px solid rgba(217,119,6,0.3)', borderRadius: 8, padding: '11px', color: '#d97706', fontSize: 14, cursor: 'pointer', width: '100%', fontFamily: 'Inter,sans-serif' },
  aiCard:      { background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 10, padding: '16px' },
  aiHead:      { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 6 },
  aiTitle:     { fontSize: 15, fontWeight: 600, color: '#f1f5f9' },
  conf:        { fontSize: 12, color: '#10b981', background: 'rgba(16,185,129,0.1)', padding: '2px 8px', borderRadius: 100 },
  aiReason:    { fontSize: 13, color: '#94a3b8', lineHeight: 1.6, marginBottom: 10 },
  aiPoints:    { borderTop: '1px solid #334155', paddingTop: 10 },
  aiPtsTitle:  { fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 },
  pt:          { fontSize: 13, color: '#94a3b8', marginBottom: 3 },
  closureRow:  { fontSize: 13, color: '#64748b', marginTop: 10 },
  errBox:      { background: '#450a0a', border: '1px solid #7f1d1d', borderRadius: 8, padding: '10px 14px', color: '#fca5a5', fontSize: 13 },
  modalFoot:   { display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 4 },
  cancelBtn:   { background: 'none', border: '1px solid #334155', borderRadius: 8, padding: '9px 18px', color: '#94a3b8', cursor: 'pointer', fontSize: 13, fontFamily: 'Inter,sans-serif' },
  saveBtn:     { background: '#d97706', border: 'none', borderRadius: 8, padding: '9px 22px', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'Inter,sans-serif' },
};
