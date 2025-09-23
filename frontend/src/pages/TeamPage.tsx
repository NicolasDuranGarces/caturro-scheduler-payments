import { FormEvent, useEffect, useState } from 'react';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../hooks/useAuth';
import './TeamPage.css';

interface User {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: 'ADMIN' | 'BARISTA';
  hourlyRate: number | string;
  status: 'ACTIVE' | 'INACTIVE';
  notes?: string | null;
}

const TeamPage = () => {
  const { user } = useAuth();
  const api = useApi();
  const [team, setTeam] = useState<User[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    hourlyRate: '',
    role: 'BARISTA',
    password: '',
  });

  const loadTeam = async () => {
    const response = await api.get<User[]>('/users');
    setTeam(response.data);
  };

  useEffect(() => {
    if (user?.role === 'ADMIN') {
      loadTeam().catch((err) => setError(err.message));
    }
  }, [api, user?.role]);

  if (user?.role !== 'ADMIN') {
    return <p>No tienes permisos para ver esta sección.</p>;
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    try {
      await api.post('/users', {
        ...form,
        hourlyRate: Number(form.hourlyRate),
      });
      setForm({ firstName: '', lastName: '', email: '', hourlyRate: '', role: 'BARISTA', password: '' });
      await loadTeam();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div className="team-page">
      <header>
        <div>
          <h1>Equipo Caturro</h1>
          <p>Administra baristas, tarifas y notas internas.</p>
        </div>
        <form onSubmit={handleSubmit} className="new-user">
          <input
            type="text"
            placeholder="Nombre"
            value={form.firstName}
            onChange={(event) => setForm({ ...form, firstName: event.target.value })}
            required
          />
          <input
            type="text"
            placeholder="Apellido"
            value={form.lastName}
            onChange={(event) => setForm({ ...form, lastName: event.target.value })}
            required
          />
          <input
            type="email"
            placeholder="Correo"
            value={form.email}
            onChange={(event) => setForm({ ...form, email: event.target.value })}
            required
          />
          <input
            type="number"
            placeholder="Tarifa hora"
            value={form.hourlyRate}
            onChange={(event) => setForm({ ...form, hourlyRate: event.target.value })}
            required
          />
          <select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}>
            <option value="BARISTA">Barista</option>
            <option value="ADMIN">Administrador</option>
          </select>
          <input
            type="password"
            placeholder="Contraseña inicial"
            value={form.password}
            onChange={(event) => setForm({ ...form, password: event.target.value })}
            required
          />
          <button type="submit">Crear usuario</button>
        </form>
      </header>

      {error && <p className="error">{error}</p>}

      <section className="team-grid">
        {team.map((member) => (
          <article key={member.id}>
            <header>
              <h3>
                {member.firstName} {member.lastName}
              </h3>
              <span>{member.role === 'ADMIN' ? 'Admin' : 'Barista'}</span>
            </header>
            <p>{member.email}</p>
            <p>Tarifa: ${Number(member.hourlyRate).toLocaleString('es-CO')} / hora</p>
            <footer>
              <span className={member.status === 'ACTIVE' ? 'status-active' : 'status-inactive'}>
                {member.status === 'ACTIVE' ? 'Activo' : 'Inactivo'}
              </span>
            </footer>
          </article>
        ))}
      </section>
    </div>
  );
};

export default TeamPage;
