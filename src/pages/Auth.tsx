import React, { useState } from 'react';
import { useAuth } from '../providers/AuthProvider';
import { Card, Button, Input } from '../components/ui/Base';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { motion } from 'motion/react';

export default function AuthPage() {
  const { signIn, signUp } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError(null);
    try {
      if (isSignUp) {
        await signUp(email, password);
      } else {
        await signIn(email, password);
      }
    } catch (err: any) {
      setAuthError(err.message || 'Authentication failed. Please verify your credentials.');
    } finally {
      setAuthLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-center items-center px-6 py-12">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="w-full max-w-md space-y-8"
      >
        <div className="flex flex-col items-center text-center">
          <div className="w-20 h-20 bg-black dark:bg-white rounded-3xl flex items-center justify-center shadow-lg mb-6">
            <img src="/delta.svg" alt="Delta Logo" className="w-12 h-12 invert dark:invert-0" />
          </div>
          <h1 className="text-4xl font-black uppercase tracking-tight">Delta</h1>
          <p className="text-xs opacity-40 uppercase tracking-[0.2em] font-bold mt-2">Minimalist Financial Tracking</p>
        </div>

        <Card className="p-8 border border-black/5 dark:border-white/5 shadow-xl rounded-[32px]">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-1 text-center">
              <h2 className="text-lg font-bold">{isSignUp ? 'Create an account' : 'Sign in to your account'}</h2>
              <p className="text-[10px] opacity-40 uppercase tracking-widest font-black">Secure backup & sync</p>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[9px] font-black uppercase tracking-widest opacity-40 px-1">Email Address</label>
                <Input 
                  icon={Mail} 
                  placeholder="name@example.com" 
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] font-black uppercase tracking-widest opacity-40 px-1">Password</label>
                <div className="relative">
                  <Input 
                    icon={Lock} 
                    placeholder="Enter password" 
                    type={showPassword ? 'text' : 'password'} 
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                  />
                  <button 
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 opacity-30 hover:opacity-100 transition-opacity"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
            </div>

            {authError && (
              <p className="text-red-500 text-[10px] font-black uppercase text-center bg-red-500/5 py-2.5 px-4 rounded-xl border border-red-500/10">
                {authError}
              </p>
            )}

            <Button className="w-full py-4 rounded-2xl" type="submit" disabled={authLoading}>
              {authLoading ? 'Signing in...' : (isSignUp ? 'Create Account' : 'Sign In')}
            </Button>

            <div className="text-center pt-2">
              <button 
                type="button"
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  setAuthError(null);
                }}
                className="text-[10px] font-black uppercase tracking-widest opacity-40 hover:opacity-100 transition-opacity"
              >
                {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Create one"}
              </button>
            </div>
          </form>
        </Card>
      </motion.div>
    </div>
  );
}
