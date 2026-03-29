import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import Shell from '../components/Shell';

const NAV = [
  { path: '/manager',           label: 'Dashboard' },
  { path: '/manager/approvals', label: 'Approvals' },
];

export default function ManagerApprovals() {
  const [tasks, setTasks] = useState([]);

  useEffect(() => {
    return onSnapshot(query(collection(db, 'tasks')), snap =>
      setTasks(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, []);

  const tasksWithApprovals = tasks.filter(t =>
    t.pendingApprovals?.some(a => a.status === 'pending')
  );

  const decide = async (taskId, approvalId, accepted) => {
    const task = tasks.find(t => t.id === taskId);
    const updated = task.pendingApprovals.map(a =>
      a.id === approvalId
        ? { ...a, status: accepted ? 'accepted' : 'rejected', decidedAt: new Date().toISOString() }
        : a
    );
    await updateDoc(doc(db, 'tasks', taskId), { pendingApprovals: updated });
  };

  return (
    <Shell nav={NAV}>
      <div style={s.wrap}>
        <h1 style={s.h1}>Approvals needed</h1>
        <p style={s.sub}>AI-recommended actions waiting for your decision</p>

        {tasksWithApprovals.length === 0 ? (
          <div style={s.empty}>No pending approvals. All clear!</div>
        ) : (
          tasksWithApprovals.map(task =>
            task.pendingApprovals
              .filter(a => a.status === 'pending')
              .map(approval => (
                <div key={approval.id} style={s.card}>
                  <div style={s.cardTop}>
                    <div style={s.taskRef}>
                      {task.clientName} — {task.productName}
                      <span style={s.spRef}> · {task.assignedToName}</span>
                    </div>
                    <div style={s.actionType}>{approval.type}</div>
                  </div>
                  <div style={s.actionTitle}>{approval.title}</div>
                  <p style={s.actionDesc}>{approval.description}</p>
                  {approval.value && <div style={s.valuePill}>{approval.value}</div>}
                  {approval.aiReasoning && (
                    <div style={s.reasoning}>
                      <div style={s.reasoningLbl}>AI reasoning</div>
                      <p style={s.reasoningText}>{approval.aiReasoning}</p>
                    </div>
                  )}
                  <div style={s.btns}>
                    <button style={s.rejectBtn} onClick={() => decide(task.id, approval.id, false)}>
                      Reject
                    </button>
                    <button style={s.acceptBtn} onClick={() => decide(task.id, approval.id, true)}>
                      Accept
                    </button>
                  </div>
                </div>
              ))
          )
        )}
      </div>
    </Shell>
  );
}

const s = {
  wrap:         { maxWidth: 760, margin: '0 auto' },
  h1:           { fontSize: 22, fontWeight: 600, color: '#f1f5f9', marginBottom: 4 },
  sub:          { fontSize: 13, color: '#64748b', marginBottom: 24 },
  empty:        { color: '#475569', textAlign: 'center', padding: '60px 0', fontSize: 14 },
  card:         { background: '#1e293b', border: '1px solid #f59e0b44', borderRadius: 12, padding: '20px', marginBottom: 14 },
  cardTop:      { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 6 },
  taskRef:      { fontSize: 12, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' },
  spRef:        { color: '#94a3b8' },
  actionType:   { fontSize: 11, color: '#f59e0b', background: 'rgba(245,158,11,0.1)', padding: '2px 8px', borderRadius: 100, textTransform: 'capitalize' },
  actionTitle:  { fontSize: 16, fontWeight: 600, color: '#f1f5f9', marginBottom: 6 },
  actionDesc:   { fontSize: 13, color: '#94a3b8', lineHeight: 1.6, marginBottom: 10 },
  valuePill:    { display: 'inline-block', background: 'rgba(16,185,129,0.1)', color: '#10b981', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 100, padding: '3px 12px', fontSize: 13, fontWeight: 500, marginBottom: 10 },
  reasoning:    { background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '10px 12px', marginBottom: 14 },
  reasoningLbl: { fontSize: 10, color: '#d97706', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 },
  reasoningText:{ fontSize: 12, color: '#64748b', lineHeight: 1.6 },
  btns:         { display: 'flex', gap: 10, justifyContent: 'flex-end' },
  rejectBtn:    { background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '8px 20px', color: '#f87171', cursor: 'pointer', fontSize: 13, fontFamily: 'Inter,sans-serif' },
  acceptBtn:    { background: '#d97706', border: 'none', borderRadius: 8, padding: '8px 24px', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'Inter,sans-serif' },
};
