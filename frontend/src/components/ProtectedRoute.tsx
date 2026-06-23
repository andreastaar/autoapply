import { Navigate } from 'react-router-dom';
import { getToken } from '../store/auth';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  return getToken() ? <>{children}</> : <Navigate to="/login" replace />;
}
