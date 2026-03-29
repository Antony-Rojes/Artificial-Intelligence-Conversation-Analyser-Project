import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login            from './pages/Login';
import ManagerDashboard from './pages/ManagerDashboard';
import ManagerApprovals from './pages/ManagerApprovals';
import SPDashboard      from './pages/SPDashboard';
import TaskDetail       from './pages/TaskDetail';

function Guard({ children, role: required }) {
  const { user, role, loading } = useAuth();
  if (loading) return <div style={{ minHeight:'100vh', background:'#0f172a', display:'flex', alignItems:'center', justifyContent:'center', color:'#64748b', fontFamily:'Inter,sans-serif' }}>Loading...</div>;
  if (!user) return <Navigate to="/" replace />;
  if (required && role !== required) return <Navigate to={role === 'manager' ? '/manager' : '/sp'} replace />;
  return children;
}
function Auto() {
  const { user, role, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/" replace />;
  return <Navigate to={role === 'manager' ? '/manager' : '/sp'} replace />;
}
export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/"    element={<Login />} />
          <Route path="/home" element={<Auto />} />
          <Route path="/manager"           element={<Guard role="manager"><ManagerDashboard /></Guard>} />
          <Route path="/manager/approvals" element={<Guard role="manager"><ManagerApprovals /></Guard>} />
          <Route path="/manager/task/:id"  element={<Guard role="manager"><TaskDetail /></Guard>} />
          <Route path="/sp"                element={<Guard role="sp"><SPDashboard /></Guard>} />
          <Route path="/sp/task/:id"       element={<Guard role="sp"><TaskDetail /></Guard>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
