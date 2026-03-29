import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/config';

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      if (u) {
        const snap = await getDoc(doc(db, 'users', u.uid));
        setProfile(snap.exists() ? snap.data() : null);
        setUser(u);
      } else {
        setUser(null);
        setProfile(null);
      }
      setLoading(false);
    });
  }, []);

  const login = async (email, password) => {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const snap = await getDoc(doc(db, 'users', cred.user.uid));
    const p = snap.data();
    setProfile(p);
    return p;
  };

  const logout = () => signOut(auth);

  return (
    <Ctx.Provider value={{ user, profile, role: profile?.role, loading, login, logout }}>
      {children}
    </Ctx.Provider>
  );
}
