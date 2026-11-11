import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import './index.css';
import { DashboardPage } from './pages/dashboard-page';
import { BalanceHistoryPage } from './pages/balance-history-page';
import { CategoriesPage } from './pages/categories-page';
import { InvitePage } from './pages/invite-page';
import { LoginPage } from './pages/login-page';
import { UsersPage } from './pages/users-page';
import { RequireSession } from './components/require-session';

// O dono usa celular e notebook ao mesmo tempo: refaz as consultas ao voltar para a aba.
const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 10_000, refetchOnWindowFocus: true } },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/convite" element={<InvitePage />} />
          <Route element={<RequireSession />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/saldo" element={<BalanceHistoryPage />} />
            <Route path="/categorias" element={<CategoriesPage />} />
            <Route path="/usuarios" element={<UsersPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
