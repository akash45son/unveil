import { useLocation, useNavigate, NavLink } from 'react-router-dom';

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();

  if (location.pathname === '/login' || location.pathname === '/register') {
    return null;
  }

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  const linkClass = ({ isActive }) =>
    [
      'rounded-full px-4 py-2 text-sm font-medium transition-all duration-200',
      isActive ? 'bg-white/10 text-white shadow-lg shadow-purple-950/20' : 'text-gray-300 hover:text-white hover:bg-white/5',
    ].join(' ');

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0a0a0f]/80 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <NavLink to="/dashboard" className="text-2xl font-extrabold tracking-tight">
          <span className="gradient-text">Unveil</span>
        </NavLink>

        <nav className="flex items-center gap-2 sm:gap-3">
          <NavLink to="/dashboard" className={linkClass}>
            Dashboard
          </NavLink>
          <NavLink to="/detect" className={linkClass}>
            Detect
          </NavLink>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-full border border-purple-500/30 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:border-purple-400/60 hover:bg-white/10"
          >
            Logout
          </button>
        </nav>
      </div>
    </header>
  );
}
