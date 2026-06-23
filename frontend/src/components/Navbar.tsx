import { Link, useNavigate } from 'react-router-dom';
import { clearAuth, getUser } from '../store/auth';

export default function Navbar() {
  const navigate = useNavigate();
  const user = getUser();

  const logout = () => {
    clearAuth();
    navigate('/login');
  };

  return (
    <nav className="bg-brand-600 text-white px-6 py-3 flex items-center justify-between shadow">
      <Link to="/dashboard" className="text-xl font-bold tracking-tight">
        AutoApply
      </Link>
      <div className="flex items-center gap-5 text-sm font-medium">
        <Link to="/opportunities" className="hover:text-indigo-200 transition">Opportunities</Link>
        <Link to="/linkedin" className="hover:text-indigo-200 transition">LinkedIn</Link>
        <Link to="/outreach" className="hover:text-indigo-200 transition">Outreach</Link>
        <Link to="/applications" className="hover:text-indigo-200 transition">Applications</Link>
        <Link to="/profile" className="hover:text-indigo-200 transition">Profile</Link>
        <button onClick={logout} className="bg-white text-brand-600 px-3 py-1 rounded hover:bg-indigo-100 transition">
          Logout
        </button>
      </div>
    </nav>
  );
}
