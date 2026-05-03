import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, firebaseReady } from '../lib/firebase';
import { 
  onAuthStateChanged, 
  User as FirebaseUser,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth';
import { User } from '../types';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  isFirebase: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
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
      }
      setLoading(false);
    }
  }, []);

  const signIn = async (email: string, password: string) => {
    if (firebaseReady && auth) {
      await signInWithEmailAndPassword(auth, email, password);
    } else {
      const mockUser = { uid: 'mock-user-' + Date.now(), email };
      localStorage.setItem('delta_local_user', JSON.stringify(mockUser));
      setUser(mockUser);
    }
  };

  const signUp = async (email: string, password: string) => {
    if (firebaseReady && auth) {
      await createUserWithEmailAndPassword(auth, email, password);
    } else {
      const mockUser = { uid: 'mock-user-' + Date.now(), email };
      localStorage.setItem('delta_local_user', JSON.stringify(mockUser));
      setUser(mockUser);
    }
  };

  const signInWithGoogle = async () => {
    if (firebaseReady && auth) {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } else {
      const mockUser = { uid: 'google-mock-' + Date.now(), email: 'google-user@dev.local' };
      localStorage.setItem('delta_local_user', JSON.stringify(mockUser));
      setUser(mockUser);
    }
  };

  const handleSignOut = async () => {
    if (firebaseReady && auth) {
      await firebaseSignOut(auth);
    } else {
      localStorage.removeItem('delta_local_user');
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      loading, 
      isFirebase: firebaseReady, 
      signIn, 
      signUp, 
      signOut: handleSignOut 
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
