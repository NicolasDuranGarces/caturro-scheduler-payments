import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import './LoginPage.css';

const LoginPage = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('admin@caturro.cafe');
  const [password, setPassword] = useState('PanteraCafe2024!');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-shell">
        <section className="login-hero">
          <div className="hero-card">
            <img src="/panther.svg" alt="Logo Caturro" />
            <h1>Coordina el rugido del equipo</h1>
            <p>
              Controla turnos, aperturas y cierres con total visibilidad. Diseñado para el pulso creativo del Caturro
              Café.
            </p>
            <ul>
              <li>Calendario semanal interactivo</li>
              <li>Pagos calculados al minuto</li>
              <li>Roles claros para administradores y baristas</li>
            </ul>
          </div>
        </section>

        <section className="login-card">
          <header>
            <div className="badge">Caturro Café</div>
            <div>
              <h2>Caturro Scheduler</h2>
              <p>Controla turnos, equipo y pagos desde un solo lugar.</p>
            </div>
          </header>

          <form onSubmit={handleSubmit}>
            <label>
              Correo
              <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
            </label>
            <label>
              Contraseña
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </label>
            {error && <p className="error">{error}</p>}
            <button type="submit" disabled={loading}>
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
          <footer>
            <small>Turnos precisos · Pagos claros · Equipo sincronizado</small>
          </footer>
        </section>
      </div>
    </div>
  );
};

export default LoginPage;
