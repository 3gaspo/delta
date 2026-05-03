import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, firebaseReady } from '../lib/firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { User } from '../types';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  isFirebase: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (firebaseReady && auth) {
      return onAuthStateChanged(auth, (firebaseUser: FirebaseUser | null) => {
        if (firebaseUser) {
          setUser({ uid: firebaseUser.uid, email: firebaseUser.email });
        } else {
          setUser(null);
        }
        setLoading(false);
      });
    } else {
      // Local dev mode fallback
      const localUser = localStorage.getItem('delta_local_user');
      if (localUser) {
        setUser(JSON.parse(localUser));
      } else {
        const newUser = { uid: 'dev-user-001', email: 'dev@delta.local' };
        localStorage.setItem('delta_local_user', JSON.stringify(newUser));
        setUser(newUser);
      }
      setLoading(false);
    }
  }, []);

  const handleSignOut = async () => {
    if (firebaseReady && auth) {
      await auth.signOut();
    } else {
      localStorage.removeItem('delta_local_user');
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, isFirebase: firebaseReady, signOut: handleSignOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
