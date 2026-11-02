import { ScreenBoundary, ScreenError } from './components/ScreenBoundary';
import { lazy, Suspense } from 'react';
import { useLocation } from 'react-router-dom';
import { PageContainer } from './components/layout/PageContainer';
import { StateFeedback } from './components/StateFeedback';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './providers/AuthProvider';
import { DataProvider } from './providers/DataProvider';
import { ThemeProvider } from './providers/ThemeProvider';
import Home from './pages/Home';
const Accounts = lazy(() => import('./pages/Accounts'));
const Stats = lazy(() => import('./pages/Stats'));
const Settings = lazy(() => import('./pages/Settings'));
const AuthPage = lazy(() => import('./pages/Auth'));
const BankImport = lazy(() => import('./pages/BankImport'));

function AppRoutes() {
  const { user, loading } = useAuth();
  const { pathname } = useLocation();
  const titles: Record<string, string> = { "/accounts": "Accounts", "/stats": "Statistics", "/settings": "Settings", "/import": "Import" };

  if (loading) return <div className="min-h-screen bg-ui-page flex items-center justify-center"><StateFeedback kind="loading" /></div>;

  if (!user) {
    return <ScreenBoundary><Suspense fallback={<StateFeedback kind="loading" />}><AuthPage /></Suspense></ScreenBoundary>;
  }

  return (
    <ScreenBoundary fallback={<PageContainer title={titles[pathname] || "Delta"}><ScreenError /></PageContainer>}><Suspense fallback={<PageContainer title={titles[pathname] || "Delta"}><StateFeedback kind="loading" /></PageContainer>}>
    <Routes>
      <Route path="/" element={<Navigate to="/home" replace />} />
      <Route path="/home" element={<Home />} />
      <Route path="/import" element={<BankImport key={user.uid} />} />
      <Route path="/accounts" element={<Accounts />} />
      <Route path="/stats" element={<Stats />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="*" element={<Navigate to="/home" replace />} />
    </Routes>
    </Suspense></ScreenBoundary>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <DataProvider>
          <ThemeProvider>
            <AppRoutes />
          </ThemeProvider>
        </DataProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
