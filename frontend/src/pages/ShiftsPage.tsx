import { FormEvent, useEffect, useMemo, useState } from 'react';
import { differenceInMinutes, format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
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
  const [expectedEnd, setExpectedEnd] = useState('');
  const [notes, setNotes] = useState('');
  const [closingNotes, setClosingNotes] = useState('');

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
        expectedEnd: expectedEnd ? new Date(expectedEnd).toISOString() : undefined,
        notes: notes || undefined,
      });
      setExpectedEnd('');
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
              Abierto a las {format(parseISO(activeShift.openedAt), 'HH:mm', { locale: es })}. Tiempo en barra:{' '}
              {differenceInMinutes(new Date(), parseISO(activeShift.openedAt))} minutos.
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
            <input
              type="datetime-local"
              value={expectedEnd}
              onChange={(event) => setExpectedEnd(event.target.value)}
              placeholder="Hora estimada de cierre"
            />
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
                <span>{format(parseISO(shift.openedAt), 'd MMM', { locale: es })}</span>
                <strong>
                  {format(parseISO(shift.openedAt), 'HH:mm')} · {shift.closedAt ? format(parseISO(shift.closedAt), 'HH:mm') : '—'}
                </strong>
              </header>
              <p>
                Pago: ${Number(shift.payout ?? 0).toLocaleString('es-CO', { minimumFractionDigits: 0 })} ·{' '}
                {Math.round((shift.minutesWorked ?? 0) / 60)} h
              </p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
};

export default ShiftsPage;
