import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import './Layout.css';

const Layout = () => {
  const { user, logout } = useAuth();

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">
          <img src="/panther.svg" alt="Pantera Caturro" />
          <div>
            <strong>Caturro Café</strong>
            <span>Shift Control</span>
          </div>
        </div>
        <nav>
          <NavLink to="/dashboard" className={({ isActive }) => (isActive ? 'active' : '')}>
            Tablero
          </NavLink>
          <NavLink to="/schedule" className={({ isActive }) => (isActive ? 'active' : '')}>
            Calendario
          </NavLink>
          <NavLink to="/shifts" className={({ isActive }) => (isActive ? 'active' : '')}>
            Mis turnos
          </NavLink>
          {user?.role === 'ADMIN' && (
            <NavLink to="/team" className={({ isActive }) => (isActive ? 'active' : '')}>
              Equipo
            </NavLink>
          )}
        </nav>
        <div className="user-card">
          <div className="user-info">
            <span className="user-name">{user?.firstName} {user?.lastName}</span>
            <small>{user?.role === 'ADMIN' ? 'Administración' : 'Barista'}</small>
          </div>
          <button type="button" onClick={logout}>
            Salir
          </button>
        </div>
      </aside>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
