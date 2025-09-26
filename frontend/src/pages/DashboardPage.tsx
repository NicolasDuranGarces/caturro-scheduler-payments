import { useEffect, useMemo, useState } from 'react';
import { format, isAfter, isBefore, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { useAuth } from '../hooks/useAuth';
import { useApi } from '../hooks/useApi';
import './DashboardPage.css';

interface Shift {
  id: number;
  openedAt: string;
  closedAt?: string | null;
  expectedEnd?: string | null;
  status: 'OPEN' | 'CLOSED';
  payout?: string | number | null;
  minutesWorked?: number | null;
}

interface ScheduleEntry {
  id: number;
  title: string;
  start: string;
  end: string;
  userId: number;
  user?: {
    firstName: string;
    lastName: string;
  };
}

const DashboardPage = () => {
  const { user } = useAuth();
  const api = useApi();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [scheduleEntries, setScheduleEntries] = useState<ScheduleEntry[]>([]);
  const [teamCount, setTeamCount] = useState<number | null>(null);

  useEffect(() => {
    const loadShifts = async () => {
      const response = await api.get<Shift[]>('/shifts/mine');
      setShifts(response.data);
    };

    const loadSchedule = async () => {
      const start = new Date();
      const end = new Date();
      end.setDate(start.getDate() + 7);
      const response = await api.get<ScheduleEntry[]>('/schedule', {
        params: {
          start: start.toISOString(),
          end: end.toISOString(),
        },
      });
      setScheduleEntries(response.data);
    };

    loadShifts().catch(console.error);
    loadSchedule().catch(console.error);

    if (user?.role === 'ADMIN') {
      api.get('/users')
        .then((response) => setTeamCount(response.data.length))
        .catch(console.error);
    }
  }, [api, user?.role]);

  const activeShift = useMemo(() => shifts.find((shift) => shift.status === 'OPEN'), [shifts]);

  const lastClosed = useMemo(() => {
    const closed = shifts.filter((shift) => shift.status === 'CLOSED' && shift.closedAt);
    return closed.length ? closed[0] : null;
  }, [shifts]);

  const upcomingOwnShift = useMemo(() => {
    const now = new Date();
    const mine = scheduleEntries.filter((entry) => entry.userId === user?.id);
    const future = mine.filter((entry) => isAfter(parseISO(entry.start), now));
    return future.sort((a, b) => parseISO(a.start).getTime() - parseISO(b.start).getTime())[0];
  }, [scheduleEntries, user?.id]);

  const scheduleToday = useMemo(() => {
    const today = new Date();
    return scheduleEntries.filter((entry) => {
      const start = parseISO(entry.start);
      return start.getDate() === today.getDate() && start.getMonth() === today.getMonth();
    });
  }, [scheduleEntries]);

  const payrollThisWeek = useMemo(() => {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    return shifts
      .filter((shift) => shift.closedAt)
      .filter((shift) => {
        const closed = parseISO(shift.closedAt as string);
        return isAfter(closed, startOfWeek) && isBefore(closed, now);
      })
      .reduce((acc, shift) => acc + Number(shift.payout ?? 0), 0);
  }, [shifts]);

  return (
    <div className="dashboard">
      <h1>Hola {user?.firstName}, buen turno.</h1>
      <p className="subtitle">Pantera pendiente. Revisa tu jornada y próximas órdenes.</p>

      <section className="metrics">
        <article>
          <span>Pago semanal estimado</span>
          <strong>
            ${payrollThisWeek.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </strong>
          <small>Suma de turnos cerrados desde lunes</small>
        </article>
        <article>
          <span>Turno activo</span>
          <strong>{activeShift ? format(parseISO(activeShift.openedAt), 'HH:mm', { locale: es }) : 'Sin turno'}</strong>
          <small>{activeShift ? 'Recuerda cerrar al finalizar' : 'Abre turno cuando llegues al bar'}</small>
        </article>
        <article>
          <span>Último cierre</span>
          <strong>
            {lastClosed?.closedAt
              ? format(parseISO(lastClosed.closedAt), "EEEE HH:mm", { locale: es })
              : 'Pendiente'}
          </strong>
          <small>
            {lastClosed?.payout
              ? `Pagado $${Number(lastClosed.payout).toLocaleString('es-CO', {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                })}`
              : 'Sin cierre reciente'}
          </small>
        </article>
        {user?.role === 'ADMIN' && (
          <article>
            <span>Equipo activo</span>
            <strong>{teamCount ?? '—'}</strong>
            <small>Usuarios registrados en la plataforma</small>
          </article>
        )}
      </section>

      <section className="panther-card">
        {activeShift ? (
          <div>
            <h2>Turno en curso</h2>
            <p>
              Iniciado a las {format(parseISO(activeShift.openedAt), 'HH:mm', { locale: es })}. Cuando cierres enviaremos
              el cálculo con tarifa de ${Number(user?.hourlyRate).toLocaleString('es-CO', {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              })} COP/h.
            </p>
          </div>
        ) : (
          <div>
            <h2>Sin turno abierto</h2>
            {upcomingOwnShift ? (
              <p>
                Próximo turno {format(parseISO(upcomingOwnShift.start), "EEEE d 'a las' HH:mm", { locale: es })}.{' '}
                {upcomingOwnShift.title}.
              </p>
            ) : (
              <p>No tienes turnos asignados para los próximos días. Revisa con coordinación.</p>
            )}
          </div>
        )}
        <img src="/panther.svg" alt="Panther icon" />
      </section>

      <section>
        <h2>Agenda del día</h2>
        <div className="schedule-list">
          {scheduleToday.length === 0 && <p className="empty">Hoy no hay turnos programados.</p>}
          {scheduleToday.map((entry) => (
            <article key={entry.id}>
              <header>
                <strong>{entry.title}</strong>
                <span>{entry.user ? `${entry.user.firstName} ${entry.user.lastName}` : 'Equipo'}</span>
              </header>
              <p>{format(parseISO(entry.start), 'HH:mm', { locale: es })} — {format(parseISO(entry.end), 'HH:mm', { locale: es })}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
};

export default DashboardPage;
