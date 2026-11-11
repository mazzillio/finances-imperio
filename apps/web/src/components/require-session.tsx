import { Navigate, Outlet } from 'react-router';
import { useSession } from '../lib/session';

export function RequireSession() {
  const { token } = useSession();
  if (!token) return <Navigate to="/login" replace />;
  return <Outlet />;
}
