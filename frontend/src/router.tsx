import { lazy, Suspense } from 'react';
import { Navigate, useRoutes } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { ProtectedRoute } from '@/components/common/ProtectedRoute';
import { PageTransition } from '@/components/common/PageTransition';
import { Skeleton } from '@/components/ui';
import { LoginPage, RegisterPage, NotFoundPage, PlaceholderPage } from '@/pages';

// Lazy-loaded route pages
const DashboardPage = lazy(() => import('@/pages').then((m) => ({ default: m.DashboardPage })));
const DocumentsPage = lazy(() => import('@/pages').then((m) => ({ default: m.DocumentsPage })));
const DocumentDetailPage = lazy(() => import('@/pages').then((m) => ({ default: m.DocumentDetailPage })));
const UploadPage = lazy(() => import('@/pages').then((m) => ({ default: m.UploadPage })));
const ChatPage = lazy(() => import('@/pages').then((m) => ({ default: m.ChatPage })));
const AnalyticsPage = lazy(() => import('@/pages').then((m) => ({ default: m.AnalyticsPage })));
const CollectionsPage = lazy(() => import('@/pages').then((m) => ({ default: m.CollectionsPage })));
const CollectionDetailPage = lazy(() => import('@/pages').then((m) => ({ default: m.CollectionDetailPage })));
const ComparePage = lazy(() => import('@/pages').then((m) => ({ default: m.ComparePage })));
const CrossAnalysisPage = lazy(() => import('@/pages').then((m) => ({ default: m.CrossAnalysisPage })));
const SettingsPage = lazy(() => import('@/pages').then((m) => ({ default: m.SettingsPage })));

function SuspenseFallback() {
  return (
    <div className="flex items-center justify-center h-full min-h-[400px]">
      <div className="flex flex-col items-center gap-4">
        <Skeleton variant="circular" width={32} height={32} />
        <Skeleton variant="text" width={160} />
      </div>
    </div>
  );
}

function PageSuspense({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<SuspenseFallback />}>
      <PageTransition>{children}</PageTransition>
    </Suspense>
  );
}

export function AppRoutes() {
  return useRoutes([
    {
      path: '/login',
      element: (
        <PageTransition>
          <LoginPage />
        </PageTransition>
      ),
    },
    {
      path: '/register',
      element: (
        <PageTransition>
          <RegisterPage />
        </PageTransition>
      ),
    },
    {
      path: '/',
      element: (
        <ProtectedRoute>
          <AppLayout />
        </ProtectedRoute>
      ),
      children: [
        {
          index: true,
          element: <Navigate to="/dashboard" replace />,
        },
        {
          path: 'dashboard',
          element: (
            <PageSuspense>
              <DashboardPage />
            </PageSuspense>
          ),
        },
        {
          path: 'documents',
          element: (
            <PageSuspense>
              <DocumentsPage />
            </PageSuspense>
          ),
        },
        {
          path: 'documents/:docId',
          element: (
            <PageSuspense>
              <DocumentDetailPage />
            </PageSuspense>
          ),
        },
        {
          path: 'upload',
          element: (
            <PageSuspense>
              <UploadPage />
            </PageSuspense>
          ),
        },
        {
          path: 'chat',
          element: (
            <PageSuspense>
              <ChatPage />
            </PageSuspense>
          ),
        },
        {
          path: 'collections',
          element: (
            <PageSuspense>
              <CollectionsPage />
            </PageSuspense>
          ),
        },
        {
          path: 'collections/:collectionId',
          element: (
            <PageSuspense>
              <CollectionDetailPage />
            </PageSuspense>
          ),
        },
        {
          path: 'compare',
          element: (
            <PageSuspense>
              <ComparePage />
            </PageSuspense>
          ),
        },
        {
          path: 'cross-analysis',
          element: (
            <PageSuspense>
              <CrossAnalysisPage />
            </PageSuspense>
          ),
        },
        {
          path: 'analytics',
          element: (
            <PageSuspense>
              <AnalyticsPage />
            </PageSuspense>
          ),
        },
        {
          path: 'settings',
          element: (
            <PageSuspense>
              <SettingsPage />
            </PageSuspense>
          ),
        },
        {
          path: 'health',
          element: (
            <PageTransition>
              <PlaceholderPage title="System Health" description="Backend status and system information." />
            </PageTransition>
          ),
        },
      ],
    },
    {
      path: '*',
      element: (
        <PageTransition>
          <NotFoundPage />
        </PageTransition>
      ),
    },
  ]);
}
