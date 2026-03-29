import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Shell({ children, nav }) {
  const { profile, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const initials = profile?.name?.split(' ').map(n => n[0]).join('') || '?';

  return (
    <div style={s.root}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0f172a; font-family: 'Inter', sans-serif; color: #f1f5f9; }
        @media(max-width:768px) {
          .sidebar { transform: translateX(-100%) !important; position: fixed !important; z-index: 50 !important; }
          .sidebar.open { transform: translateX(0) !important; }
          .topbar { display: flex !important; }
          .content { padding: 16px !important; }
        }
        @media(min-width:769px) {
          .topbar { display: none !important; }
        }
      `}</style>

      {/* Mobile overlay */}
      {open && <div style={s.overlay} onClick={() => setOpen(false)} />}

      {/* Sidebar */}
      <aside className={`sidebar${open ? ' open' : ''}`} style={s.sidebar}>
        <div style={s.sideTop}>
          <div style={s.logo}>P</div>
          <div>
            <div style={s.appName}>PharmaFlow</div>
            <div style={s.sub}>MedNova</div>
          </div>
        </div>
        <div style={{ ...s.rolePill, color: profile?.role === 'manager' ? '#d97706' : '#10b981' }}>
          {profile?.role === 'manager' ? 'Manager' : 'Sales Person'}
        </div>
        <nav style={s.nav}>
          {nav.map(n => (
            <button key={n.path} onClick={() => { navigate(n.path); setOpen(false); }}
              style={{ ...s.navBtn, background: location.pathname === n.path ? 'rgba(217,119,6,0.15)' : 'transparent', color: location.pathname === n.path ? '#d97706' : '#94a3b8', borderLeft: location.pathname === n.path ? '2px solid #d97706' : '2px solid transparent' }}>
              {n.label}
            </button>
          ))}
        </nav>
        <div style={{ flex: 1 }} />
        <div style={s.user}>
          <div style={s.avatar}>{initials}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={s.userName}>{profile?.name}</div>
            <div style={s.userSub}>{profile?.territory || profile?.role}</div>
          </div>
          <button onClick={logout} style={s.logoutBtn} title="Sign out">↩</button>
        </div>
      </aside>

      {/* Main */}
      <div style={s.main}>
        <div className="topbar" style={{ ...s.topbar, display: 'none' }}>
          <button onClick={() => setOpen(true)} style={s.menuBtn}>☰</button>
          <span style={s.appName}>PharmaFlow</span>
          <div style={s.avatar}>{initials}</div>
        </div>
        <div className="content" style={s.content}>{children}</div>
      </div>
    </div>
  );
}

const s = {
  root:     { display: 'flex', minHeight: '100vh', background: '#0f172a' },
  overlay:  { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 49 },
  sidebar:  { width: 220, background: '#1e293b', borderRight: '1px solid #334155', display: 'flex', flexDirection: 'column', padding: '20px 12px', transition: 'transform 0.25s' },
  sideTop:  { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 },
  logo:     { width: 34, height: 34, borderRadius: 8, background: '#d97706', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, flexShrink: 0 },
  appName:  { fontSize: 15, fontWeight: 600, color: '#f1f5f9' },
  sub:      { fontSize: 10, color: '#d97706', letterSpacing: '0.08em' },
  rolePill: { fontSize: 11, fontWeight: 500, padding: '5px 10px', background: 'rgba(217,119,6,0.1)', borderRadius: 6, marginBottom: 20, display: 'inline-block' },
  nav:      { display: 'flex', flexDirection: 'column', gap: 2 },
  navBtn:   { display: 'block', width: '100%', padding: '9px 12px', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 13, fontWeight: 500, textAlign: 'left', fontFamily: 'Inter, sans-serif', transition: 'all 0.15s' },
  user:     { display: 'flex', alignItems: 'center', gap: 8, borderTop: '1px solid #334155', paddingTop: 12 },
  avatar:   { width: 32, height: 32, borderRadius: 7, background: 'rgba(217,119,6,0.2)', color: '#d97706', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  userName: { fontSize: 13, color: '#f1f5f9', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  userSub:  { fontSize: 11, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  logoutBtn:{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 16 },
  main:     { flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 },
  topbar:   { alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#1e293b', borderBottom: '1px solid #334155' },
  menuBtn:  { background: 'none', border: 'none', color: '#94a3b8', fontSize: 20, cursor: 'pointer' },
  content:  { padding: '28px 24px', flex: 1, overflowY: 'auto' },
};
