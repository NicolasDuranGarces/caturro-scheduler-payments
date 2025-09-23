import { FormEvent, useEffect, useMemo, useState } from 'react';
import { addDays, startOfWeek } from 'date-fns';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../hooks/useAuth';
import ScheduleTimeline, { TimelineEntry } from '../components/ScheduleTimeline';
import './SchedulePage.css';

interface UserOption {
  id: number;
  firstName: string;
  lastName: string;
  role: 'ADMIN' | 'BARISTA';
}

const SchedulePage = () => {
  const api = useApi();
  const { user } = useAuth();
  const [entries, setEntries] = useState<TimelineEntry[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    userId: '',
    start: '',
    end: '',
    title: '',
  });
  const [error, setError] = useState<string | null>(null);

  const loadEntries = async () => {
    setLoading(true);
    try {
      const start = startOfWeek(new Date(), { weekStartsOn: 1 });
      const end = addDays(start, 6);
      const response = await api.get<TimelineEntry[]>('/schedule', {
        params: {
          start: start.toISOString(),
          end: end.toISOString(),
        },
      });
      setEntries(response.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEntries().catch((err) => setError(err.message));
    if (user?.role === 'ADMIN') {
      api.get<UserOption[]>('/users').then((response) => setUsers(response.data)).catch(console.error);
    }
  }, [api, user?.role]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    try {
      await api.post('/schedule', {
        userId: Number(form.userId),
        start: new Date(form.start).toISOString(),
        end: new Date(form.end).toISOString(),
        title: form.title,
      });
      setForm({ userId: '', start: '', end: '', title: '' });
      await loadEntries();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const upcoming = useMemo(
    () =>
      entries
        .filter((entry) => entry.user.id === user?.id)
        .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
        .slice(0, 4),
    [entries, user?.id],
  );

  return (
    <div className="schedule-page">
      <header>
        <div>
          <h1>Calendario semanal</h1>
          <p>Visualiza apertura, cierres y asignaciones del equipo.</p>
        </div>
        {user?.role === 'ADMIN' && (
          <form onSubmit={handleSubmit} className="new-entry">
            <select value={form.userId} onChange={(event) => setForm({ ...form, userId: event.target.value })} required>
              <option value="">Selecciona barista</option>
              {users.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.firstName} {option.lastName}
                </option>
              ))}
            </select>
            <input
              type="datetime-local"
              value={form.start}
              onChange={(event) => setForm({ ...form, start: event.target.value })}
              required
            />
            <input
              type="datetime-local"
              value={form.end}
              onChange={(event) => setForm({ ...form, end: event.target.value })}
              required
            />
            <input
              type="text"
              placeholder="Descripción"
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
              required
            />
            <button type="submit">Crear turno</button>
          </form>
        )}
      </header>

      {error && <p className="error">{error}</p>}
      {loading ? <p>Cargando...</p> : <ScheduleTimeline entries={entries} />}

      <section>
        <h2>Próximos turnos asignados</h2>
        <div className="upcoming">
          {upcoming.length === 0 && <p className="empty">No tienes turnos asignados en la semana.</p>}
          {upcoming.map((entry) => (
            <article key={entry.id}>
              <h3>{entry.title}</h3>
              <span>{new Date(entry.start).toLocaleString('es-CO', { dateStyle: 'full', timeStyle: 'short' })}</span>
              <p>
                {new Date(entry.end).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
};

export default SchedulePage;
