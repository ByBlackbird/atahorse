import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { trpc, trpcClient, queryClient } from './lib/trpc';
import { RouterProvider, Routes, type RouteDef } from './lib/router';
import { I18nProvider } from './i18n/index';
import { SessionSync, ThemeProvider, ToastProvider } from './ui/providers';
import { PageLoader } from './ui/kit';
import { applyTheme, storedTheme } from './lib/theme';
import { RequireAuth, Shell } from './app/Shell';
import Landing from './pages/Landing';
import { Login, Register } from './pages/Auth';
import NotFound from './pages/NotFound';

applyTheme(storedTheme());

// Kod bölme: ağır sayfalar (stüdyo + three.js) yalnızca gerektiğinde yüklenir.
const Dashboard = lazy(() => import('./pages/Dashboard'));
const ProfileTest = lazy(() => import('./pages/ProfileTest'));
const CourseNew = lazy(() => import('./pages/CourseNew'));
const Studio = lazy(() => import('./studio/Studio'));
const Final = lazy(() => import('./pages/Final'));
const Review = lazy(() => import('./pages/Review'));
const Profile = lazy(() => import('./pages/Profile'));
const Certificate = lazy(() => import('./pages/Certificate'));
const Verify = lazy(() => import('./pages/Verify'));
const Shared = lazy(() => import('./pages/Shared'));
const Upgrade = lazy(() => import('./pages/Upgrade'));
const Admin = lazy(() => import('./pages/Admin'));

const authed = (node: React.ReactNode, opts?: { admin?: boolean }) => <RequireAuth admin={opts?.admin}>{node}</RequireAuth>;

const routes: RouteDef[] = [
  { path: '/', render: () => <Landing /> },
  { path: '/giris', render: () => <Login /> },
  { path: '/kayit', render: () => <Register /> },
  { path: '/profil-testi', render: () => authed(<ProfileTest />) },
  { path: '/panel', render: () => authed(<Dashboard />) },
  { path: '/kurs-olustur', render: () => authed(<CourseNew />) },
  { path: '/kurs/:id', render: (p) => authed(<Studio courseId={Number(p.id)} />) },
  { path: '/kurs/:id/final', render: (p) => authed(<Final courseId={Number(p.id)} />) },
  { path: '/tekrar', render: () => authed(<Review />) },
  { path: '/profil', render: () => authed(<Profile />) },
  { path: '/premium', render: () => authed(<Upgrade />) },
  { path: '/yonetim', render: () => authed(<Admin />, { admin: true }) },
  { path: '/sertifika/:code', render: (p) => <Certificate code={p.code} /> },
  { path: '/dogrula', render: () => <Verify /> },
  { path: '/p/:slug', render: (p) => <Shared slug={p.slug} /> },
];

function App() {
  return (
    <Suspense fallback={<Shell><PageLoader /></Shell>}>
      <SessionSync />
      <Routes routes={routes} fallback={<NotFound />} />
    </Suspense>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <I18nProvider>
          <ThemeProvider>
            <ToastProvider>
              <RouterProvider>
                <App />
              </RouterProvider>
            </ToastProvider>
          </ThemeProvider>
        </I18nProvider>
      </QueryClientProvider>
    </trpc.Provider>
  </StrictMode>,
);
