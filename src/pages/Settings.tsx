import React, { useState } from 'react';
import { useAuth } from '../providers/AuthProvider';
import { useData } from '../providers/DataProvider';
import { useTheme } from '../providers/ThemeProvider';
import { PageContainer } from '../components/layout/PageContainer';
import { Card, Button, Input, Select } from '../components/ui/Base';
import { Modal } from '../components/ui/Modal';
import { 
  LogOut, Download, RotateCcw, Plus, Trash2, 
  Moon, Mail, Lock, Eye, EyeOff, User, Heart, ChevronRight
} from 'lucide-react';
import { generateCSV } from '../utils/financial';
import { cn } from '../lib/utils';
import packageJson from '../../package.json';

const SUPPORT_URL = "https://ko-fi.com/delta_app_project";

export default function Settings() {
  const { user, signOut, isFirebase, signIn, signUp, signInWithGoogle } = useAuth();
  const { 
    categories, tags, settings, updateSettings, 
    addCategory, updateCategory, deleteCategory,
    addTag, updateTag, deleteTag,
    resetData, transactions, accounts
  } = useData();
  const { isDark, toggleTheme } = useTheme();

  const [isResetModal, setIsResetModal] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
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
      setAuthError(err.message || 'Authentication failed');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      setAuthError(err.message || 'Google sign in failed');
    } finally {
      setAuthLoading(false);
    }
  };

  // Simple category/tag management
  const [newCat, setNewCat] = useState('');
  const [newTag, setNewTag] = useState('');

  const handleCSV = () => {
    const csv = generateCSV(transactions, accounts, categories, tags, settings.currency);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `delta_export_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <PageContainer title="Settings">
      {settings.initialized === false && !isFirebase && (
        <div className="mb-6 p-4 bg-emerald-500/10 text-emerald-500 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2">
          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
          Dev Mode Active
        </div>
      )}

      {/* App Specific Settings */}
      <Card label="Categories">
        <div className="p-4 space-y-6">
          <div className="flex gap-2">
            <Input 
              placeholder="New category..." 
              value={newCat} 
              onChange={e => setNewCat(e.target.value)} 
            />
            <Button size="icon" onClick={() => { if(newCat) { addCategory({ label: newCat }); setNewCat(''); } }}>
              <Plus size={18} />
            </Button>
          </div>
          <div className="space-y-3">
            {categories.map(c => (
              <div key={c.id} className="flex flex-col gap-2 p-4 bg-black/5 dark:bg-white/5 rounded-2xl">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider">{c.label}</span>
                  <button 
                    onClick={() => deleteCategory(c.id)}
                    className="p-1 hover:text-red-500 transition-colors opacity-30 hover:opacity-100"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <div className="relative flex-1 min-w-0">
                     <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[10px] font-black opacity-20">{settings.currency}</span>
                     <input 
                       type="number"
                       placeholder="Monthly limit"
                       className="w-full bg-background border border-black/5 dark:border-white/5 rounded-2xl px-4 py-4 pl-12 text-xs font-bold outline-none focus:ring-1 focus:ring-black/10 dark:focus:ring-white/10"
                       value={c.budgetLimit || ''}
                       onChange={e => updateCategory(c.id, { budgetLimit: parseFloat(e.target.value) || 0 })}
                     />
                  </div>
                  <div className="w-12 h-12 rounded-2xl shadow-inner border border-black/5 dark:border-white/5 flex-shrink-0" style={{ backgroundColor: c.color }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <Card label="Tags">
        <div className="p-4 space-y-4">
          <div className="flex gap-2">
            <Input 
              placeholder="New tag..." 
              value={newTag} 
              onChange={e => setNewTag(e.target.value)} 
            />
            <Button size="icon" onClick={() => { if(newTag) { addTag({ label: newTag }); setNewTag(''); } }}>
              <Plus size={18} />
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {tags.map(t => (
              <div key={t.id} className="flex items-center gap-2 bg-black/5 dark:bg-white/5 pl-4 pr-2 py-2 rounded-xl">
                <span className="text-xs font-bold">{t.label}</span>
                <button 
                  onClick={() => deleteTag(t.id)}
                  className="p-1 hover:text-red-500 transition-colors opacity-30 hover:opacity-100"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <Card label="Currency">
        <div className="p-4">
          <Select 
            value={settings.currency} 
            onChange={e => updateSettings({ currency: e.target.value })}
          >
            <option value="EUR">EUR (€)</option>
            <option value="USD">USD ($)</option>
            <option value="GBP">GBP (£)</option>
            <option value="JPY">JPY (¥)</option>
          </Select>
        </div>
      </Card>

      {/* Appearance */}
      <Card label="Appearance">
        <div className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-black/5 dark:bg-white/5 flex items-center justify-center">
              <Moon size={18} />
            </div>
            <span className="font-bold">Dark Mode</span>
          </div>
          <button 
            onClick={toggleTheme}
            className={cn(
              "w-12 h-6 rounded-full transition-colors relative",
              isDark ? "bg-white" : "bg-black/10"
            )}
          >
            <div className={cn(
              "w-4 h-4 rounded-full absolute top-1 transition-all",
              isDark ? "right-1 bg-black" : "left-1 bg-white"
            )} />
          </button>
        </div>
      </Card>

      {/* Account */}
      <Card label="Account">
        {user ? (
          <div className="p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-black dark:bg-white flex items-center justify-center text-white dark:text-black shrink-0">
              <User size={24} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-widest opacity-40">User Profile</p>
              <p className="font-bold truncate">{user.email || 'Local User'}</p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleAuth} className="p-6 space-y-4">
            <div className="space-y-1">
              <p className="font-bold text-center">{isSignUp ? 'Create an account' : 'Sign in to sync your data'}</p>
              <p className="text-[10px] text-center opacity-40 uppercase tracking-widest font-bold">Secure backup & sync</p>
            </div>
            
            <div className="space-y-2">
              <Input 
                icon={Mail} 
                placeholder="E-mail" 
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
              <div className="relative">
                <Input 
                  icon={Lock} 
                  placeholder="Password" 
                  type={showPassword ? 'text' : 'password'} 
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                />
                <button 
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 opacity-30"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {authError && <p className="text-red-500 text-[10px] font-bold uppercase text-center">{authError}</p>}

            <Button className="w-full" type="submit" disabled={authLoading}>
              {authLoading ? 'Please wait...' : (isSignUp ? 'Create Account' : 'Sign In')}
            </Button>

            <button 
              type="button"
              onClick={() => setIsSignUp(!isSignUp)}
              className="w-full text-[10px] font-bold uppercase tracking-widest opacity-40 hover:opacity-100 transition-opacity"
            >
              {isSignUp ? 'Already have an account? Sign In' : 'Create an account'}
            </button>

            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-black/5 dark:border-white/5" /></div>
              <div className="relative flex justify-center"><span className="bg-background px-2 text-[8px] font-black uppercase tracking-[0.2em] opacity-20">OR</span></div>
            </div>

            <Button 
              variant="secondary" 
              className="w-full bg-white dark:bg-zinc-800 text-black dark:text-white border border-black/5 dark:border-white/5 flex items-center justify-center gap-2"
              onClick={handleGoogleSignIn}
              type="button"
              disabled={authLoading}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Continue with Google
            </Button>
          </form>
        )}
      </Card>

      {/* Actions */}
      <div className="space-y-2 mt-8">
        {user && (
          <button onClick={signOut} className="w-full p-6 bg-black/5 dark:bg-white/5 rounded-[24px] flex items-center justify-between hover:bg-black/10 transition-colors text-left group">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-white dark:bg-black/20 flex items-center justify-center">
                <LogOut size={18} />
              </div>
              <span className="font-bold">Sign Out</span>
            </div>
            <ChevronRight size={18} className="opacity-0 group-hover:opacity-40 transition-opacity" />
          </button>
        )}

        <button onClick={handleCSV} className="w-full p-6 bg-black/5 dark:bg-white/5 rounded-[24px] flex items-center justify-between hover:bg-black/10 transition-colors text-left group">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-white dark:bg-black/20 flex items-center justify-center">
              <Download size={18} />
            </div>
            <span className="font-bold">Download CSV</span>
          </div>
          <ChevronRight size={18} className="opacity-0 group-hover:opacity-40 transition-opacity" />
        </button>

        <button onClick={() => setIsResetModal(true)} className="w-full p-6 bg-red-500/5 rounded-[24px] flex items-center justify-between hover:bg-red-500/10 transition-colors text-left group">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-white dark:bg-black/20 flex items-center justify-center text-red-500">
              <RotateCcw size={18} />
            </div>
            <span className="font-bold text-red-500">Reset Data</span>
          </div>
          <ChevronRight size={18} className="opacity-0 group-hover:opacity-40 transition-opacity" />
        </button>
      </div>

      {/* Footer */}
      <footer className="mt-16 text-center space-y-6 opacity-40 grayscale hover:grayscale-0 hover:opacity-100 transition-all">
        <div className="w-32 h-32 mx-auto flex items-center justify-center overflow-hidden">
           <img src="/gaspo_logo.svg" alt="Gaspo Logo" className="w-full h-full object-contain" />
        </div>
        <div className="space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.3em]">Delta — version {packageJson.version}</p>
          <p className="text-xl font-black">GASPARD BERTHELIER</p>
          <p className="text-[10px] font-medium">gberthelier.projet@gmail.com</p>
        </div>
        <a 
          href={SUPPORT_URL} 
          target="_blank" 
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 bg-black text-white dark:bg-white dark:text-black px-6 py-3 rounded-full text-xs font-bold uppercase tracking-wider scale-90 hover:scale-100 transition-all"
        >
          <Heart size={14} />
          Support the project
        </a>
      </footer>

      <Modal isOpen={isResetModal} onClose={() => setIsResetModal(false)} title="Reset Data">
        <div className="space-y-4">
          <p className="text-sm opacity-60">This action is dangerous and cannot be undone. Please choose carefully.</p>
          <div className="grid gap-3">
            <Button onClick={() => { resetData('history'); setIsResetModal(false); }} variant="secondary">
              Clear History
            </Button>
            <Button onClick={() => { resetData('all'); setIsResetModal(false); }} variant="destructive">
              Reset All Data
            </Button>
            <Button onClick={() => setIsResetModal(false)} ghost>
              Cancel
            </Button>
          </div>
        </div>
      </Modal>
    </PageContainer>
  );
}
