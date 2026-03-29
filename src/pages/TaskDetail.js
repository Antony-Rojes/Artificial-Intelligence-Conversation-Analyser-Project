import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, onSnapshot, updateDoc, serverTimestamp, arrayUnion } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { groqChat, groqTranscribe } from '../ai';
import Shell from '../components/Shell';

const MGR_NAV = [
  { path: '/manager',            label: 'Dashboard' },
  { path: '/manager/approvals',  label: 'Approvals' },
];
const SP_NAV = [{ path: '/sp', label: 'My Tasks' }];

// Company policy — decision engine rules
const POLICY = {
  maxTrialUnits:          100,
  maxDiscountPercent:     18,
  managerApprovalAbove:   12,
  safeDiscountPercent:    10,
};

// The 8 points SP must cover in their audio
const CHECKLIST = [
  { id: 1, point: 'Doctor name, specialty & location' },
  { id: 2, point: "Doctor's current prescription (what drug they use now)" },
  { id: 3, point: 'How the meeting went — engaged, rushed, or dismissive' },
  { id: 4, point: "Doctor's reaction when you presented the product" },
  { id: 5, point: 'Any objections raised — price, competitor, evidence, or none' },
  { id: 6, point: 'Samples or pricing discussed — quantity if asked' },
  { id: 7, point: 'What was agreed for next steps or follow-up' },
  { id: 8, point: 'Your honest read on the outcome' },
];

// Decision engine — applies company rules on top of AI output
function applyDecisionEngine(aiReport) {
  const actions = aiReport.recommendedActions || [];
  const decisions = [];

  for (const action of actions) {
    let decision = { ...action };

    if (action.type === 'trial') {
      const requested = action.unitsRequested || 0;
      if (requested > POLICY.maxTrialUnits) {
        decision.value        = `${POLICY.maxTrialUnits} units (capped from ${requested} — company maximum)`;
        decision.decisionNote = `Doctor requested ${requested} units. Approved at company maximum of ${POLICY.maxTrialUnits}. Inform doctor remaining units available after initial prescription commitment.`;
        decision.status       = 'auto_approved_capped';
        decision.requiresManagerApproval = false;
      } else {
        decision.status       = 'auto_approved';
        decision.requiresManagerApproval = false;
      }
    }

    if (action.type === 'discount') {
      const pct = action.discountPercent || 0;
      if (pct > POLICY.maxDiscountPercent) {
        decision.decisionNote        = `Requested ${pct}% exceeds company maximum of ${POLICY.maxDiscountPercent}%. Hard reject — do not proceed.`;
        decision.status              = 'rejected_exceeds_maximum';
        decision.requiresManagerApproval = true;
        decision.title               = `Discount request REJECTED — ${pct}% exceeds policy`;
      } else if (pct > POLICY.managerApprovalAbove) {
        decision.decisionNote        = `${pct}% requires manager approval (above ${POLICY.managerApprovalAbove}% auto-limit).`;
        decision.status              = 'pending_manager';
        decision.requiresManagerApproval = true;
      } else if (pct > 0) {
        decision.decisionNote        = `${pct}% is within safe range. SP can proceed without escalation.`;
        decision.status              = 'auto_approved';
        decision.requiresManagerApproval = false;
      }
    }

    if (action.type === 'escalate') {
      decision.requiresManagerApproval = true;
      decision.status = 'pending_manager';
    }

    decisions.push(decision);
  }

  return { ...aiReport, recommendedActions: decisions };
}

// ── Transcribe and analyse
async function transcribeAndAnalyse(audioFile, task) {
  // Step 1: Transcribe real audio
  const transcript = await groqTranscribe(audioFile);
  if (!transcript || transcript.trim().length < 20) {
    throw new Error('Could not transcribe audio. Ensure the recording has clear speech and try again.');
  }

  // Step 2: Build 8-point pharma prompt
  const today = new Date().toISOString().split('T')[0];
  const prompt = `You are a senior pharmaceutical sales intelligence analyst for MedNova Pharmaceuticals.

VISIT CONTEXT:
- Doctor / Client: ${task.clientName}
- Location: ${task.location}
- Product pitched: ${task.productName} (${task.productCategory})
- Sales Representative: ${task.assignedToName}
- Visit date: ${today}
- Task notes from manager: ${task.notes || 'None'}

COMPANY POLICY (apply these rules strictly):
- Max trial units allowed: ${POLICY.maxTrialUnits}
- Max discount allowed: ${POLICY.maxDiscountPercent}%
- Manager approval required above: ${POLICY.managerApprovalAbove}%
- Safe discount (SP can approve alone): up to ${POLICY.safeDiscountPercent}%

ACTUAL MEETING TRANSCRIPT (transcribed from SP's audio recording):
---
${transcript}
---

Analyse ONLY what is in the transcript. Do NOT invent anything not mentioned.
Extract these 8 specific points from the transcript:

1. DOCTOR INTRODUCTION — name, specialty, location, current prescription, visit number
2. MEETING QUALITY — how much time given, doctor's availability, engagement level
3. PRODUCT PITCH RESPONSE — exact reaction, clinical questions asked, specific interests
4. OBJECTIONS RAISED — price/competitor/evidence/loyalty/timing/none — exact words if mentioned
5. SAMPLES OR PRICING — quantity of samples requested, pricing discussion, volume intent
6. NEXT STEPS AGREED — follow-up date/call agreed, what doctor committed to
7. SP GUT FEELING — SP's honest read if mentioned
8. COMPETITOR SIGNALS — any competitor drug mentioned by name

Then apply the company policy rules and generate the report.

Reply ONLY with a valid JSON object, no extra text:
{
  "visitSummary": "3-4 sentences of exactly what happened based on the transcript",
  "extractedPoints": {
    "doctorIntroduction": "what was said about doctor name, specialty, current prescription",
    "meetingQuality": "engaged/rushed/dismissive — evidence from transcript",
    "pitchResponse": "exactly how doctor reacted to the product",
    "objectionRaised": "price/competitor/evidence/loyalty/timing/none — exact objection",
    "objectionDetail": "what exactly was said about the objection",
    "samplesRequested": true,
    "samplesQuantity": 80,
    "pricingDiscussed": true,
    "bulkVolumeIntent": "monthly volume if mentioned e.g. 500 strips/month or null",
    "followUpAgreed": true,
    "followUpDetail": "what was agreed e.g. call Thursday morning",
    "spGutFeeling": "SP's honest read if mentioned in recording",
    "competitorMentioned": "Amlosafe/none — exact name if said"
  },
  "doctorSignals": {
    "interestLevel": "high/medium/low/none",
    "mainObjection": "price/competitor/evidence/loyalty/timing/none",
    "competitorMentioned": "drug name or null",
    "samplesRequested": true,
    "unitsRequested": 80,
    "pricingAsked": true,
    "followUpAgreed": true,
    "meetingEngagement": "engaged/rushed/dismissive"
  },
  "prescriptionProbability": 68,
  "visitOutcome": "positive/neutral/cold",
  "recommendedActions": [
    {
      "id": "a1",
      "type": "trial",
      "title": "Dispatch trial samples",
      "description": "Doctor requested samples to test on patients",
      "unitsRequested": 80,
      "value": "80 trial units",
      "requiresManagerApproval": false,
      "aiReasoning": "Direct quote or reference from transcript supporting this action",
      "discountPercent": 0
    }
  ],
  "nextMeetingHandover": "Full brief for next person visiting this doctor — what was discussed, exact concern, what to bring, what NOT to say",
  "followUpDate": "YYYY-MM-DD or null",
  "followUpUrgency": "within 3 days/within 1 week/within 1 month/deprioritise",
  "managerFlag": true,
  "managerFlagReason": "reason if flag is true, else null",
  "managerRecommendation": "specific action for manager if flag is true, else null",
  "estimatedMonthlyVolume": 500,
  "estimatedDealValue": 18000
}`;

  const raw    = await groqChat(prompt, 2000);
  const parsed = JSON.parse(raw);

  // Step 3: Apply decision engine on top of AI output
  return { report: applyDecisionEngine(parsed), transcript };
}

// ─────────────────────────────────────────────
export default function TaskDetail() {
  const { id } = useParams();
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const fileRef  = useRef();

  const [task, setTask]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [audioFile, setAudioFile] = useState(null);
  const [step, setStep]       = useState('');
  const [error, setError]     = useState('');
  const [checked, setChecked] = useState({});

  const nav     = role === 'manager' ? MGR_NAV : SP_NAV;
  const isSP    = role === 'sp';
  const isMyTask = isSP && task?.assignedTo === user?.uid;

  useEffect(() => {
    return onSnapshot(doc(db, 'tasks', id), snap => {
      if (snap.exists()) setTask({ id: snap.id, ...snap.data() });
      setLoading(false);
    });
  }, [id]);

  const updateStatus = async (status) =>
    updateDoc(doc(db, 'tasks', id), { status, updatedAt: serverTimestamp() });

  const handleAnalyse = async () => {
    if (!audioFile) return;
    setError('');
    try {
      setStep('uploading');
      const fd = new FormData();
      fd.append('file', audioFile);
      fd.append('upload_preset', 'pharmaflow_audio');
      fd.append('resource_type', 'video');
      const cRes = await fetch('https://api.cloudinary.com/v1_1/dagp1g7gg/video/upload', { method: 'POST', body: fd });
      if (!cRes.ok) throw new Error('Audio upload failed. Check Cloudinary preset settings.');
      const { secure_url: audioUrl } = await cRes.json();

      setStep('transcribing');
      const { report, transcript } = await transcribeAndAnalyse(audioFile, task);

      setStep('analysing');
      const approvals = (report.recommendedActions || [])
        .filter(a => a.requiresManagerApproval && a.status !== 'rejected_exceeds_maximum')
        .map(a => ({ ...a, status: 'pending', createdAt: new Date().toISOString() }));

      await updateDoc(doc(db, 'tasks', id), {
        status: 'completed',
        audioUrl,
        transcript,
        meetingReport: { ...report, generatedAt: new Date().toISOString() },
        pendingApprovals: arrayUnion(...(approvals.length ? approvals : [{ id: '_none', status: 'none' }])),
        updatedAt: serverTimestamp(),
      });

      setStep('done');
      setAudioFile(null);
    } catch (e) {
      console.error(e);
      setError(e.message);
      setStep('');
    }
  };

  if (loading) return <Shell nav={nav}><div style={s.loading}>Loading...</div></Shell>;
  if (!task)   return <Shell nav={nav}><div style={s.loading}>Task not found.</div></Shell>;

  const report = task.meetingReport;
  const busy   = ['uploading', 'transcribing', 'analysing'].includes(step);

  const STEP_LABEL = {
    uploading:   '⬆  Uploading audio to cloud...',
    transcribing:'🎙  Transcribing speech with Groq Whisper...',
    analysing:   '✦  AI analysing the 8 key points...',
    done:        '✅  Analysis complete!',
  };

  const C = {
    positive: '#10b981', neutral: '#d97706', negative: '#ef4444',
    high: '#10b981',     medium: '#d97706',  low: '#ef4444',
    none: '#64748b',
  };

  return (
    <Shell nav={nav}>
      <div style={s.wrap}>
        <button style={s.back} onClick={() => navigate(-1)}>← Back</button>

        {/* Header */}
        <div style={s.header}>
          <div style={s.avatar}>{task.clientName?.[0]}</div>
          <div style={{ flex: 1 }}>
            <h1 style={s.clientName}>{task.clientName}</h1>
            <p style={s.location}>{task.location}</p>
          </div>
          <span style={s.productBadge}>{task.productName}</span>
        </div>

        {/* Info grid */}
        <div style={s.infoGrid}>
          {[['Assigned to', task.assignedToName || '—'],
            ['Deadline',    task.deadline || '—'],
            ['Category',    task.productCategory],
            ['Status',      task.status]].map(([k, v]) => (
            <div key={k}>
              <div style={s.infoKey}>{k}</div>
              <div style={s.infoVal}>{v}</div>
            </div>
          ))}
        </div>

        {task.notes && (
          <div style={s.box}>
            <div style={s.boxLbl}>Manager notes</div>
            <p style={s.boxTxt}>{task.notes}</p>
          </div>
        )}

        {/* Pre-meeting AI briefing */}
        {task.aiRec && !report && (
          <div style={{ ...s.box, borderColor: '#d9770633' }}>
            <div style={{ ...s.boxLbl, color: '#d97706' }}>✦ AI pre-meeting briefing</div>
            <p style={s.boxTxt}>{task.aiRec.reasoning}</p>
            {task.aiRec.talkingPoints?.length > 0 && (
              <div style={{ marginTop: 10 }}>
                <div style={s.boxLbl}>Talking points</div>
                {task.aiRec.talkingPoints.map((p, i) => (
                  <div key={i} style={s.pt}>· {p}</div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* SP Actions */}
        {isMyTask && task.status === 'pending' && (
          <div style={s.row}>
            <button style={s.rejectBtn} onClick={() => updateStatus('rejected')}>Reject Task</button>
            <button style={s.acceptBtn} onClick={() => updateStatus('accepted')}>Accept Task</button>
          </div>
        )}

        {isMyTask && task.status === 'accepted' && !report && (
          <>
            <div style={s.row}>
              <button style={s.rejectBtn} onClick={() => updateStatus('incomplete')}>Mark Incomplete</button>
            </div>

            {/* ── Upload Section ── */}
            <div style={s.uploadCard}>
              <div style={s.uploadTitle}>Upload meeting recording</div>
              <p style={s.uploadDesc}>
                Record yourself speaking after the meeting. Cover the 8 points below — 
                3 to 4 minutes of natural speech is enough.
              </p>

              {/* 8-point checklist */}
              <div style={s.checklist}>
                <div style={s.checklistTitle}>Checklist — cover these 8 points in your recording</div>
                {CHECKLIST.map(item => (
                  <div key={item.id} style={s.checkItem}
                    onClick={() => setChecked(p => ({ ...p, [item.id]: !p[item.id] }))}>
                    <div style={{
                      ...s.checkbox,
                      background: checked[item.id] ? '#10b981' : 'transparent',
                      borderColor: checked[item.id] ? '#10b981' : '#475569',
                    }}>
                      {checked[item.id] && <span style={s.tick}>✓</span>}
                    </div>
                    <div style={s.checkContent}>
                      <span style={s.checkNum}>{item.id}</span>
                      <span style={{ ...s.checkPoint, color: checked[item.id] ? '#10b981' : '#cbd5e1' }}>
                        {item.point}
                      </span>
                    </div>
                  </div>
                ))}
                <div style={s.checklistNote}>
                  Tick each point once you have covered it in your recording.
                  More detail = better AI analysis.
                </div>
              </div>

              {/* Drop zone */}
              <div style={s.dropZone}
                onClick={() => !busy && fileRef.current?.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) setAudioFile(f); }}>
                <input ref={fileRef} type="file"
                  accept=".wav,.mp3,.m4a,.ogg,.webm,.flac"
                  style={{ display: 'none' }}
                  onChange={e => setAudioFile(e.target.files[0])} />
                <div style={s.dropIcon}>🎙</div>
                {audioFile
                  ? <div style={s.fileName}>✓ {audioFile.name} ({(audioFile.size / 1024).toFixed(0)} KB)</div>
                  : <p style={s.dropHint}>Click or drag & drop your recording<br />
                      <span style={s.formats}>WAV · MP3 · M4A · OGG · WEBM · FLAC</span>
                    </p>
                }
              </div>

              {/* Progress */}
              {step && (
                <div style={s.stepMsg}>
                  <div style={s.stepDot} />
                  {STEP_LABEL[step]}
                </div>
              )}

              {error && <div style={s.errBox}>{error}</div>}

              {audioFile && !busy && step !== 'done' && (
                <button style={s.analyseBtn} onClick={handleAnalyse}>
                  ✦ Transcribe & Analyse
                </button>
              )}
            </div>
          </>
        )}

        {/* ── AI Report ── */}
        {report && (
          <div style={s.report}>
            <div style={s.reportHeader}>
              <h2 style={s.reportTitle}>AI Meeting Intelligence Report</h2>
              <span style={s.reportDate}>{report.generatedAt ? new Date(report.generatedAt).toLocaleString('en-IN') : ''}</span>
            </div>

            {/* Top metrics */}
            <div style={s.metrics}>
              <div style={s.metric}>
                <div style={s.metricLbl}>Prescription probability</div>
                <div style={{ ...s.metricBig, color: report.prescriptionProbability >= 60 ? '#10b981' : report.prescriptionProbability >= 40 ? '#d97706' : '#ef4444' }}>
                  {report.prescriptionProbability}%
                </div>
                <div style={s.bar}>
                  <div style={{ ...s.barFill, width: `${report.prescriptionProbability}%`,
                    background: report.prescriptionProbability >= 60 ? '#10b981' : report.prescriptionProbability >= 40 ? '#d97706' : '#ef4444' }} />
                </div>
              </div>
              <div style={s.metric}>
                <div style={s.metricLbl}>Visit outcome</div>
                <div style={{ ...s.metricBig, color: C[report.visitOutcome], textTransform: 'capitalize' }}>{report.visitOutcome}</div>
              </div>
              <div style={s.metric}>
                <div style={s.metricLbl}>Interest level</div>
                <div style={{ ...s.metricBig, color: C[report.doctorSignals?.interestLevel], textTransform: 'capitalize' }}>{report.doctorSignals?.interestLevel}</div>
              </div>
              <div style={s.metric}>
                <div style={s.metricLbl}>Est. deal value</div>
                <div style={{ ...s.metricBig, color: '#d97706' }}>₹{(report.estimatedDealValue || 0).toLocaleString('en-IN')}</div>
              </div>
            </div>

            {/* Visit summary */}
            <div style={s.box}>
              <div style={s.boxLbl}>Visit summary</div>
              <p style={s.boxTxt}>{report.visitSummary}</p>
            </div>

            {/* Doctor signals */}
            {report.doctorSignals && (
              <div style={s.box}>
                <div style={s.boxLbl}>Doctor signals extracted from audio</div>
                <div style={s.signalGrid}>
                  {[
                    ['Main objection',   report.doctorSignals.mainObjection || 'None'],
                    ['Competitor',       report.doctorSignals.competitorMentioned || 'None mentioned'],
                    ['Samples requested', report.doctorSignals.samplesRequested ? `Yes — ${report.doctorSignals.unitsRequested} units` : 'No'],
                    ['Pricing discussed', report.doctorSignals.pricingAsked ? 'Yes' : 'No'],
                    ['Follow-up agreed',  report.doctorSignals.followUpAgreed ? 'Yes' : 'No'],
                    ['Meeting engagement', report.doctorSignals.meetingEngagement],
                  ].map(([k, v]) => (
                    <div key={k} style={s.signal}>
                      <div style={s.signalKey}>{k}</div>
                      <div style={s.signalVal}>{v}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recommended actions with decision engine output */}
            {report.recommendedActions?.length > 0 && (
              <div style={s.box}>
                <div style={s.boxLbl}>Recommended actions</div>
                {report.recommendedActions.map((a, i) => (
                  <div key={i} style={{
                    ...s.actionCard,
                    borderColor: a.status === 'rejected_exceeds_maximum' ? '#ef444455'
                      : a.status === 'auto_approved' || a.status === 'auto_approved_capped' ? '#10b98155'
                      : '#d9770655',
                  }}>
                    <div style={s.actionTop}>
                      <span style={s.actionTitle}>{a.title}</span>
                      <span style={{
                        ...s.actionStatus,
                        color: a.status === 'rejected_exceeds_maximum' ? '#ef4444'
                          : a.status?.includes('auto_approved') ? '#10b981' : '#d97706',
                        background: a.status === 'rejected_exceeds_maximum' ? 'rgba(239,68,68,0.1)'
                          : a.status?.includes('auto_approved') ? 'rgba(16,185,129,0.1)' : 'rgba(217,119,6,0.1)',
                      }}>
                        {a.status === 'rejected_exceeds_maximum' ? '✗ Rejected — exceeds policy'
                          : a.status === 'auto_approved_capped' ? '✓ Approved (capped)'
                          : a.status === 'auto_approved' ? '✓ Auto approved'
                          : '⏳ Awaiting manager'}
                      </span>
                    </div>
                    <p style={s.actionDesc}>{a.description}</p>
                    {a.value && <div style={s.valuePill}>{a.value}</div>}
                    {a.decisionNote && (
                      <div style={s.decisionNote}>
                        <span style={s.decisionLbl}>Decision: </span>{a.decisionNote}
                      </div>
                    )}
                    <div style={s.aiReason}>AI reasoning: {a.aiReasoning}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Next meeting handover */}
            {report.nextMeetingHandover && (
              <div style={{ ...s.box, borderColor: '#3b82f644' }}>
                <div style={{ ...s.boxLbl, color: '#3b82f6' }}>📋 Next meeting handover brief</div>
                <p style={s.boxTxt}>{report.nextMeetingHandover}</p>
                <div style={s.followupRow}>
                  <span>Follow-up: <strong style={{ color: '#d97706' }}>{report.followUpDate || 'Not specified'}</strong></span>
                  <span style={{ color: '#64748b' }}>Urgency: {report.followUpUrgency}</span>
                </div>
              </div>
            )}

            {/* Manager flag — only visible to manager */}
            {report.managerFlag && role === 'manager' && (
              <div style={{ ...s.box, borderColor: '#ef444444' }}>
                <div style={{ ...s.boxLbl, color: '#ef4444' }}>⚡ Manager action required</div>
                <p style={{ ...s.boxTxt, color: '#fca5a5', marginBottom: 8 }}>{report.managerFlagReason}</p>
                <p style={s.boxTxt}>{report.managerRecommendation}</p>
              </div>
            )}

            {/* Approval cards for manager */}
            {task.pendingApprovals?.filter(a => a.id !== '_none' && a.status !== 'none').length > 0 && (
              <div style={s.box}>
                <div style={s.boxLbl}>{role === 'manager' ? 'Pending your approval' : 'Manager approval status'}</div>
                {task.pendingApprovals
                  .filter(a => a.id !== '_none' && a.status !== 'none')
                  .map(a => (
                    <div key={a.id} style={{ ...s.approvalRow, borderColor: a.status === 'accepted' ? '#10b98144' : a.status === 'rejected' ? '#ef444444' : '#d9770644' }}>
                      <div style={{ flex: 1 }}>
                        <div style={s.approvalTitle}>{a.title}</div>
                        {a.value && <div style={s.valuePill}>{a.value}</div>}
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 600, flexShrink: 0,
                        color: a.status === 'accepted' ? '#10b981' : a.status === 'rejected' ? '#ef4444' : '#d97706' }}>
                        {a.status === 'pending' ? '⏳ Awaiting manager' : a.status === 'accepted' ? '✓ Approved' : '✗ Rejected'}
                      </span>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}
      </div>
    </Shell>
  );
}

const s = {
  wrap:         { maxWidth: 780, margin: '0 auto' },
  loading:      { textAlign: 'center', color: '#64748b', padding: '80px 0' },
  back:         { background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 13, marginBottom: 20, padding: 0, fontFamily: 'Inter,sans-serif' },
  header:       { display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20, flexWrap: 'wrap' },
  avatar:       { width: 46, height: 46, borderRadius: 11, background: 'rgba(217,119,6,0.15)', color: '#d97706', fontSize: 20, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  clientName:   { fontSize: 22, fontWeight: 600, color: '#f1f5f9', margin: 0 },
  location:     { fontSize: 13, color: '#64748b', marginTop: 3 },
  productBadge: { fontSize: 12, padding: '4px 12px', borderRadius: 100, background: 'rgba(59,130,246,0.1)', color: '#3b82f6', flexShrink: 0 },
  infoGrid:     { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 12, background: '#1e293b', border: '1px solid #334155', borderRadius: 10, padding: '14px 18px', marginBottom: 14 },
  infoKey:      { fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 },
  infoVal:      { fontSize: 13, color: '#cbd5e1', textTransform: 'capitalize' },
  box:          { background: '#1e293b', border: '1px solid #334155', borderRadius: 10, padding: '16px', marginBottom: 12 },
  boxLbl:       { fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 },
  boxTxt:       { fontSize: 13, color: '#94a3b8', lineHeight: 1.7 },
  pt:           { fontSize: 13, color: '#94a3b8', marginBottom: 4 },
  row:          { display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' },
  rejectBtn:    { background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '10px 20px', color: '#f87171', cursor: 'pointer', fontSize: 13, fontFamily: 'Inter,sans-serif' },
  acceptBtn:    { background: '#d97706', border: 'none', borderRadius: 8, padding: '10px 24px', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'Inter,sans-serif' },

  // Upload card
  uploadCard:   { background: '#1e293b', border: '1px solid #334155', borderRadius: 12, padding: '22px', marginBottom: 14 },
  uploadTitle:  { fontSize: 16, fontWeight: 600, color: '#f1f5f9', marginBottom: 6 },
  uploadDesc:   { fontSize: 13, color: '#64748b', lineHeight: 1.6, marginBottom: 18 },

  // Checklist
  checklist:    { background: '#0f172a', borderRadius: 10, padding: '16px', marginBottom: 18 },
  checklistTitle:{ fontSize: 11, color: '#d97706', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 },
  checkItem:    { display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid #1e293b', cursor: 'pointer' },
  checkbox:     { width: 20, height: 20, borderRadius: 5, border: '1.5px solid', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' },
  tick:         { fontSize: 12, color: '#fff', fontWeight: 700 },
  checkContent: { display: 'flex', alignItems: 'center', gap: 8 },
  checkNum:     { fontSize: 11, color: '#475569', fontWeight: 600, width: 16, flexShrink: 0 },
  checkPoint:   { fontSize: 13, lineHeight: 1.4, transition: 'color 0.15s' },
  checklistNote:{ fontSize: 11, color: '#475569', marginTop: 12, lineHeight: 1.5 },

  // Drop zone
  dropZone:     { border: '2px dashed #334155', borderRadius: 10, padding: '28px 20px', textAlign: 'center', cursor: 'pointer', marginBottom: 14 },
  dropIcon:     { fontSize: 28, marginBottom: 8 },
  dropHint:     { fontSize: 13, color: '#64748b', lineHeight: 1.6 },
  formats:      { fontSize: 11, color: '#475569' },
  fileName:     { fontSize: 13, color: '#d97706', fontWeight: 500 },
  stepMsg:      { display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(217,119,6,0.08)', border: '1px solid rgba(217,119,6,0.2)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#d97706', marginBottom: 12 },
  stepDot:      { width: 8, height: 8, borderRadius: '50%', background: '#d97706', flexShrink: 0, animation: 'pulse 1.5s infinite' },
  errBox:       { background: '#450a0a', border: '1px solid #7f1d1d', borderRadius: 8, padding: '10px 14px', color: '#fca5a5', fontSize: 13, marginBottom: 12 },
  analyseBtn:   { width: '100%', background: 'rgba(217,119,6,0.1)', border: '1px solid rgba(217,119,6,0.3)', borderRadius: 8, padding: '12px', color: '#d97706', fontSize: 14, cursor: 'pointer', fontFamily: 'Inter,sans-serif', fontWeight: 500 },

  // Report
  report:       { display: 'flex', flexDirection: 'column', gap: 12 },
  reportHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  reportTitle:  { fontSize: 20, fontWeight: 600, color: '#f1f5f9', margin: 0 },
  reportDate:   { fontSize: 11, color: '#475569' },
  metrics:      { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 10 },
  metric:       { background: '#1e293b', border: '1px solid #334155', borderRadius: 10, padding: '14px' },
  metricLbl:    { fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 },
  metricBig:    { fontSize: 22, fontWeight: 700 },
  bar:          { height: 4, background: '#334155', borderRadius: 4, marginTop: 8, overflow: 'hidden' },
  barFill:      { height: '100%', borderRadius: 4, transition: 'width 0.8s ease' },
  signalGrid:   { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 10, marginTop: 4 },
  signal:       { background: '#0f172a', borderRadius: 8, padding: '10px 12px' },
  signalKey:    { fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 },
  signalVal:    { fontSize: 13, color: '#cbd5e1', textTransform: 'capitalize' },
  actionCard:   { border: '1px solid', borderRadius: 8, padding: '14px', marginBottom: 10 },
  actionTop:    { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 6, flexWrap: 'wrap' },
  actionTitle:  { fontSize: 14, fontWeight: 600, color: '#f1f5f9' },
  actionStatus: { fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 100, flexShrink: 0 },
  actionDesc:   { fontSize: 13, color: '#94a3b8', lineHeight: 1.6, marginBottom: 8 },
  valuePill:    { display: 'inline-block', background: 'rgba(16,185,129,0.1)', color: '#10b981', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 100, padding: '2px 10px', fontSize: 12, marginBottom: 8 },
  decisionNote: { fontSize: 12, color: '#94a3b8', background: 'rgba(255,255,255,0.03)', borderRadius: 6, padding: '8px 10px', marginBottom: 6 },
  decisionLbl:  { color: '#d97706', fontWeight: 600 },
  aiReason:     { fontSize: 11, color: '#475569', fontStyle: 'italic' },
  followupRow:  { display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginTop: 10, fontSize: 13, color: '#94a3b8' },
  approvalRow:  { border: '1px solid', borderRadius: 8, padding: '12px 14px', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  approvalTitle:{ fontSize: 14, fontWeight: 500, color: '#f1f5f9', marginBottom: 4 },
};
