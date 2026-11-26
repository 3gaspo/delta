import { appStorage, guestUser, isGuestSession } from '@3gaspo/app-ui/guestSession';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, firebaseReady } from '../lib/firebase';
import { 
  onAuthStateChanged, 
  User as FirebaseUser,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendPasswordResetEmail
} from 'firebase/auth';
import { User } from '../types';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  isFirebase: boolean;
  loadError: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  resetPassword?: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    try {
      if (isGuestSession) {
        setUser(guestUser);
        setLoading(false);
        return;
      }
      if (firebaseReady && auth) {
        return onAuthStateChanged(auth, (firebaseUser: FirebaseUser | null) => {
          if (firebaseUser) {
            setUser({ uid: firebaseUser.uid, email: firebaseUser.email });
          } else {
            setUser(null);
          }
          setLoading(false);
        }, () => { setLoadError(true); setLoading(false); });
      } else {
        // Local dev mode fallback
        const localUser = appStorage.getItem('delta_local_user');
        const wasSignedOut = appStorage.getItem('delta_local_user_signed_out') === 'true';
        if (localUser) {
          setUser(JSON.parse(localUser));
        } else if (!wasSignedOut) {
          // Auto-login in dev mode before ever signing out!
          const newUser = { uid: 'dev-user-001', email: 'dev@delta.local' };
          appStorage.setItem('delta_local_user', JSON.stringify(newUser));
          setUser(newUser);
        } else {
          setUser(null);
        }
        setLoading(false);
      }
    } catch (error) {
      console.error("Could not load session:", error);
      setLoadError(true); setLoading(false);
    }
  }, []);

  const signIn = async (email: string, password: string) => {
    if (firebaseReady && auth) {
      await signInWithEmailAndPassword(auth, email, password);
    } else {
      const mockUser = { uid: 'mock-user-' + Date.now(), email };
      appStorage.removeItem('delta_local_user_signed_out');
      appStorage.setItem('delta_local_user', JSON.stringify(mockUser));
      setUser(mockUser);
    }
  };

  const signUp = async (email: string, password: string) => {
    if (firebaseReady && auth) {
      await createUserWithEmailAndPassword(auth, email, password);
    } else {
      const mockUser = { uid: 'mock-user-' + Date.now(), email };
      appStorage.removeItem('delta_local_user_signed_out');
      appStorage.setItem('delta_local_user', JSON.stringify(mockUser));
      setUser(mockUser);
    }
  };

  const handleSignOut = async () => {
    if (firebaseReady && auth) {
      await firebaseSignOut(auth);
    } else {
      appStorage.removeItem('delta_local_user');
      appStorage.setItem('delta_local_user_signed_out', 'true');
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      loading, 
      isFirebase: firebaseReady,
      loadError,
      signIn, 
      signUp, 
      resetPassword: auth ? email => sendPasswordResetEmail(auth, email) : undefined,
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
