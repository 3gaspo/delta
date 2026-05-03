import { useState } from 'react';
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
  const { user, signOut, isFirebase } = useAuth();
  const { 
    categories, tags, settings, updateSettings, 
    addCategory, updateCategory, deleteCategory,
    addTag, updateTag, deleteTag,
    resetData, transactions, accounts
  } = useData();
  const { isDark, toggleTheme } = useTheme();

  const [isResetModal, setIsResetModal] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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
            <div className="w-12 h-12 rounded-full bg-black dark:bg-white flex items-center justify-center text-white dark:text-black">
              <User size={24} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest opacity-40">User Profile</p>
              <p className="font-bold truncate max-w-[200px]">{user.email || 'Local User'}</p>
            </div>
          </div>
        ) : (
          <div className="p-6 space-y-4">
            <p className="font-bold text-center">Sign in to sync your data</p>
            <div className="space-y-2">
              <Input icon={Mail} placeholder="E-mail" />
              <div className="relative">
                <Input icon={Lock} placeholder="Password" type={showPassword ? 'text' : 'password'} />
                <button 
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 opacity-30"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <Button className="w-full">Sign In</Button>
            <button className="w-full text-[10px] font-bold uppercase tracking-widest opacity-40">Create an account</button>
          </div>
        )}
      </Card>

      {/* Actions */}
      <div className="space-y-2 mt-8">
        <button onClick={signOut} className="w-full p-6 bg-black/5 dark:bg-white/5 rounded-[24px] flex items-center justify-between hover:bg-black/10 transition-colors text-left group">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-white dark:bg-black/20 flex items-center justify-center">
              <LogOut size={18} />
            </div>
            <span className="font-bold">Sign Out</span>
          </div>
          <ChevronRight size={18} className="opacity-0 group-hover:opacity-40 transition-opacity" />
        </button>

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
