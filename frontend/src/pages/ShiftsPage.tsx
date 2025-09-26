import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useApi } from '../hooks/useApi';
import './ShiftsPage.css';

interface Shift {
  id: number;
  openedAt: string;
  closedAt?: string | null;
  expectedEnd?: string | null;
  status: 'OPEN' | 'CLOSED';
  payout?: string | number | null;
  minutesWorked?: number | null;
}

const ShiftsPage = () => {
  const api = useApi();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [closingNotes, setClosingNotes] = useState('');

  const getBogotaDate = useCallback(() => {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Bogota',
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    const parts = formatter.formatToParts(now);
    const get = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
    return new Date(Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second')));
  }, []);

  const formatBogotaDate = useCallback((isoDate: string, options: Intl.DateTimeFormatOptions = {}) => {
    return new Intl.DateTimeFormat('es-CO', {
      dateStyle: undefined,
      timeStyle: 'short',
      timeZone: 'America/Bogota',
      ...options,
    }).format(new Date(isoDate));
  }, []);

  const formatBogotaDay = useCallback((isoDate: string) => {
    return new Intl.DateTimeFormat('es-CO', {
      day: 'numeric',
      month: 'short',
      timeZone: 'America/Bogota',
    }).format(new Date(isoDate));
  }, []);

  const loadShifts = async () => {
    const response = await api.get<Shift[]>('/shifts/mine');
    setShifts(response.data);
  };

  useEffect(() => {
    loadShifts().catch((err) => setError(err.message));
  }, [api]);

  const activeShift = useMemo(() => shifts.find((shift) => shift.status === 'OPEN'), [shifts]);

  const history = useMemo(() => shifts.filter((shift) => shift.status === 'CLOSED'), [shifts]);

  const handleOpenShift = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    try {
      await api.post('/shifts/open', {
        openedAt: getBogotaDate().toISOString(),
        notes: notes || undefined,
      });
      setNotes('');
      await loadShifts();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleCloseShift = async () => {
    if (!activeShift) return;
    setError(null);
    try {
      await api.post(`/shifts/${activeShift.id}/close`, {
        notes: closingNotes || undefined,
      });
      setClosingNotes('');
      await loadShifts();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div className="shifts-page">
      <header>
        <h1>Turnos</h1>
        <p>Abre turno cuando llegues y ciérralo al terminar para registrar el pago del día.</p>
      </header>

      {error && <p className="error">{error}</p>}

      <section className="shift-actions">
        {activeShift ? (
          <div className="shift-card active">
            <h2>Turno activo</h2>
            <p>
              Turno iniciado a las {formatBogotaDate(activeShift.openedAt)} (hora Bogotá). Recuerda cerrar cuando
              finalices.
            </p>
            <textarea
              placeholder="Notas para el cierre (opcional)"
              value={closingNotes}
              onChange={(event) => setClosingNotes(event.target.value)}
            />
            <button type="button" onClick={handleCloseShift}>
              Cerrar turno
            </button>
          </div>
        ) : (
          <form onSubmit={handleOpenShift} className="shift-card">
            <h2>Iniciar turno</h2>
            <textarea
              placeholder="Notas (opcional)"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
            <button type="submit">Abrir turno</button>
          </form>
        )}
      </section>

      <section>
        <h2>Historial reciente</h2>
        <div className="shift-history">
          {history.length === 0 && <p className="empty">Aún no has registrado turnos.</p>}
          {history.map((shift) => (
            <article key={shift.id}>
              <header>
                <span>{formatBogotaDay(shift.openedAt)}</span>
                <strong>
                  {formatBogotaDate(shift.openedAt)} ·{' '}
                  {shift.closedAt ? formatBogotaDate(shift.closedAt) : '—'}
                </strong>
              </header>
              <p>
                Pago: ${Number(shift.payout ?? 0).toLocaleString('es-CO', {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                })}{' '}
                · {Math.round((shift.minutesWorked ?? 0) / 60)} h
              </p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
};

export default ShiftsPage;
