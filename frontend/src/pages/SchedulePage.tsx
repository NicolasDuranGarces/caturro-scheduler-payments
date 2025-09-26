import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { addDays, format, parseISO, startOfWeek } from 'date-fns';
import { es } from 'date-fns/locale';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../hooks/useAuth';
import './SchedulePage.css';

const DAYS_OF_WEEK = [
  { label: 'Lunes', value: 0 },
  { label: 'Martes', value: 1 },
  { label: 'Miércoles', value: 2 },
  { label: 'Jueves', value: 3 },
  { label: 'Viernes', value: 4 },
  { label: 'Sábado', value: 5 },
  { label: 'Domingo', value: 6 },
] as const;

interface UserOption {
  id: number;
  firstName: string;
  lastName: string;
  role: 'ADMIN' | 'BARISTA';
}

interface ScheduleEntry {
  id: number;
  title: string;
  start: string;
  end: string;
  user: {
    id: number;
    firstName: string;
    lastName: string;
  };
  color?: string | null;
}

interface ShiftSummary {
  userId: number;
  user: {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
    hourlyRate: string | number;
  } | null;
  shifts: number;
  minutesWorked: number;
  hoursWorked: number;
  payout: number;
  paid: number;
  pending: number;
}

interface PaymentHistoryItem {
  id: number;
  uuid: string;
  userId: number;
  user: {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
    hourlyRate: string | number;
  } | null;
  periodStart: string;
  periodEnd: string;
  amount: string;
  notes?: string | null;
  createdAt: string;
  paidAt: string | null;
}

type PaymentDraftState = {
  summary: ShiftSummary;
  amount: string;
  paidAt: string;
  notes: string;
};

type ScheduleFormState = {
  userId: string;
  day: number;
  startTime: string;
  endTime: string;
  title: string;
};

const SchedulePage = () => {
  const api = useApi();
  const { user } = useAuth();
  const [entries, setEntries] = useState<ScheduleEntry[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [weekRange, setWeekRange] = useState<{ start: string; end: string } | null>(null);
  const [payouts, setPayouts] = useState<ShiftSummary[]>([]);
  const [payoutLoading, setPayoutLoading] = useState(false);
  const [history, setHistory] = useState<PaymentHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [scheduleForm, setScheduleForm] = useState<ScheduleFormState | null>(null);
  const [paymentDraft, setPaymentDraft] = useState<PaymentDraftState | null>(null);

  const formatCurrency = useCallback((value: number) => {
    const numeric = Number.isFinite(value) ? value : 0;
    return Math.round(numeric).toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }, []);

  const firstBaristaId = useMemo(() => {
    const baristas = users.filter((option) => option.role === 'BARISTA');
    return baristas.length ? String(baristas[0].id) : '';
  }, [users]);

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

  const buildDefaultScheduleForm = useCallback((): ScheduleFormState | null => {
    if (!firstBaristaId) return null;
    const now = getBogotaDate();
    const roundedStart = new Date(now);
    const minutes = roundedStart.getMinutes();
    const rounded = Math.floor(minutes / 30) * 30;
    roundedStart.setMinutes(rounded, 0, 0);
    const roundedEnd = new Date(roundedStart);
    roundedEnd.setHours(roundedEnd.getHours() + 4);

    const dayIndex = (roundedStart.getDay() + 6) % 7;

    return {
      userId: firstBaristaId,
      day: dayIndex,
      startTime: format(roundedStart, 'HH:mm'),
      endTime: format(roundedEnd, 'HH:mm'),
      title: `Turno ${format(roundedStart, 'HH:mm')} - ${format(roundedEnd, 'HH:mm')}`,
    };
  }, [firstBaristaId, getBogotaDate]);

  const ensureScheduleForm = useCallback(() => {
    setScheduleForm((prev) => {
      if (prev) return prev;
      const defaults = buildDefaultScheduleForm();
      return defaults ?? {
        userId: firstBaristaId,
        day: 0,
        startTime: '08:00',
        endTime: '12:00',
        title: 'Turno 08:00 - 12:00',
      };
    });
  }, [buildDefaultScheduleForm, firstBaristaId]);

  const loadEntries = async () => {
    setLoading(true);
    try {
      const start = startOfWeek(new Date(), { weekStartsOn: 1 });
      const end = addDays(start, 6);
      setWeekRange({ start: start.toISOString(), end: end.toISOString() });
      const response = await api.get<ScheduleEntry[]>('/schedule', {
        params: {
          start: start.toISOString(),
          end: end.toISOString(),
        },
      });
      setEntries(response.data);
      if (user?.role === 'ADMIN') {
        setPayoutLoading(true);
        setHistoryLoading(true);
        Promise.all([
          api.get<ShiftSummary[]>('/shifts/summary', {
            params: {
              start: start.toISOString(),
              end: end.toISOString(),
            },
          }),
          api.get<PaymentHistoryItem[]>('/shifts/payment-history', {
            params: {
              start: start.toISOString(),
              end: end.toISOString(),
            },
          }),
        ])
          .then(([summaryRes, historyRes]) => {
            setPayouts(summaryRes.data);
            setHistory(historyRes.data);
          })
          .catch(console.error)
          .finally(() => {
            setPayoutLoading(false);
            setHistoryLoading(false);
          });
      } else {
        setPayouts([]);
        setHistory([]);
        setHistoryLoading(false);
        setPayoutLoading(false);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEntries().catch((err) => setError(err.message));
    if (user?.role === 'ADMIN') {
      api
        .get<UserOption[]>('/users')
        .then((response) => setUsers(response.data))
        .catch(console.error)
        .finally(() => ensureScheduleForm());
    }
  }, [api, ensureScheduleForm, user?.role]);

  useEffect(() => {
    if (user?.role === 'ADMIN') {
      ensureScheduleForm();
    }
  }, [ensureScheduleForm, user?.role, firstBaristaId]);

  const handleScheduleField = useCallback(
    (field: keyof ScheduleFormState) => (event: ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
      const { value } = event.target;
      setScheduleForm((prev) => (prev ? { ...prev, [field]: field === 'day' ? Number(value) : value } : prev));
    },
  []);

  const handleScheduleTitleChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const { value } = event.target;
    setScheduleForm((prev) => (prev ? { ...prev, title: value } : prev));
  }, []);

  const applyCurrentTimeToForm = useCallback(() => {
    const defaults = buildDefaultScheduleForm();
    if (defaults) {
      setScheduleForm(defaults);
    }
  }, [buildDefaultScheduleForm]);

  const clearScheduleForm = useCallback(() => {
    setScheduleForm((prev) =>
      prev
        ? {
            ...prev,
            day: 0,
            startTime: '',
            endTime: '',
            title: '',
          }
        : prev,
    );
  }, []);

  const handleScheduleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!scheduleForm) return;
    setError(null);

    if (!scheduleForm.userId) {
      setError('Selecciona un barista.');
      return;
    }

    if (!scheduleForm.startTime || !scheduleForm.endTime) {
      setError('Ingresa hora de inicio y fin.');
      return;
    }

    const [startHour, startMinute] = scheduleForm.startTime.split(':').map(Number);
    const [endHour, endMinute] = scheduleForm.endTime.split(':').map(Number);

    const baseDate = startOfWeek(new Date(), { weekStartsOn: 1 });
    baseDate.setDate(baseDate.getDate() + scheduleForm.day);
    const startDate = new Date(baseDate);
    startDate.setHours(startHour, startMinute, 0, 0);

    const endDate = new Date(baseDate);
    endDate.setHours(endHour, endMinute, 0, 0);

    if (endDate.getTime() <= startDate.getTime()) {
      setError('La hora de fin debe ser mayor a la hora de inicio.');
      return;
    }

    try {
      await api.post('/schedule', {
        userId: Number(scheduleForm.userId),
        start: startDate.toISOString(),
        end: endDate.toISOString(),
        title: scheduleForm.title.trim()
          ? scheduleForm.title.trim()
          : `Turno ${scheduleForm.startTime} - ${scheduleForm.endTime}`,
      });
      applyCurrentTimeToForm();
      await loadEntries();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const closePaymentDraft = useCallback(() => {
    setPaymentDraft(null);
  }, []);

  const handleAmountChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const raw = event.target.value.replace(/[^0-9]/g, '');
    setPaymentDraft((prev) => (prev ? { ...prev, amount: raw } : prev));
  }, []);

  const refreshPaymentTimestamp = useCallback(() => {
    setPaymentDraft((prev) => (prev ? { ...prev, paidAt: getBogotaDate().toISOString() } : prev));
  }, [getBogotaDate]);

  const openPaymentDraft = useCallback(
    (summary: ShiftSummary) => {
      if (!weekRange) return;
      const now = getBogotaDate();
      const defaults = `Semana ${
        new Date(weekRange.start).toLocaleDateString('es-CO', { dateStyle: 'medium' })
      } - ${new Date(weekRange.end).toLocaleDateString('es-CO', { dateStyle: 'medium' })}`;
      setError(null);
      setPaymentDraft({
        summary,
        amount: String(Math.round(summary.pending > 0 ? summary.pending : summary.payout)),
        paidAt: now.toISOString(),
        notes: defaults,
      });
    },
    [getBogotaDate, weekRange],
  );

  const submitPaymentDraft = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!paymentDraft || !weekRange) return;
    setError(null);

    if (!paymentDraft.amount.trim()) {
      setError('Ingresa el monto pagado.');
      return;
    }

    const amountNumber = Number(paymentDraft.amount);
    if (Number.isNaN(amountNumber) || amountNumber < 0) {
      setError('El monto debe ser un número positivo.');
      return;
    }

    const paidAtDate = getBogotaDate();

    try {
      await api.post('/shifts/payment-history', {
        userId: paymentDraft.summary.userId,
        periodStart: weekRange.start,
        periodEnd: weekRange.end,
        amount: Math.round(amountNumber),
        notes: paymentDraft.notes.trim() ? paymentDraft.notes.trim() : undefined,
        paidAt: paidAtDate.toISOString(),
      });
      closePaymentDraft();
      await loadEntries();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const removePayment = async (id: number) => {
    const confirmed = window.confirm('¿Deseas deshacer este registro de pago?');
    if (!confirmed) return;
    try {
      await api.delete(`/shifts/payment-history/${id}`);
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

  const weeklySchedule = useMemo(() => {
    return DAYS_OF_WEEK.map((day, index) => {
      const items = entries
        .filter((entry) => {
          const start = parseISO(entry.start);
          const dayIndex = (start.getDay() + 6) % 7;
          return dayIndex === index;
        })
        .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
      return { day, items };
    });
  }, [entries]);

  return (
    <div className="schedule-page">
      {paymentDraft && (
        <div className="payment-modal-backdrop" role="dialog" aria-modal="true" onClick={closePaymentDraft}>
          <form className="payment-modal" onSubmit={submitPaymentDraft} onClick={(event) => event.stopPropagation()}>
            <header>
              <div>
                <h3>Registrar pago</h3>
                <p>
                  {paymentDraft.summary.user
                    ? `${paymentDraft.summary.user.firstName} ${paymentDraft.summary.user.lastName}`
                    : 'Barista sin nombre'}
                </p>
              </div>
              <button type="button" onClick={closePaymentDraft} aria-label="Cerrar">
                ×
              </button>
            </header>
            <div className="payment-modal-body">
              <p className="payment-meta">
                Pendiente calculado: ${formatCurrency(paymentDraft.summary.pending)} · Generado: $
                {formatCurrency(paymentDraft.summary.payout)}
              </p>
              <div className="payment-field">
                <span>Fecha y hora del pago</span>
                <strong>
                  {new Date(paymentDraft.paidAt).toLocaleString('es-CO', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                    timeZone: 'America/Bogota',
                  })}
                </strong>
                <button type="button" className="btn-tertiary" onClick={refreshPaymentTimestamp}>
                  Usar hora actual
                </button>
              </div>
              <label>
                Monto pagado (COP)
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={paymentDraft.amount}
                  onChange={handleAmountChange}
                  required
                />
              </label>
              <label>
                Notas
                <textarea
                  rows={3}
                  value={paymentDraft.notes}
                  onChange={(event) =>
                    setPaymentDraft((prev) => (prev ? { ...prev, notes: event.target.value } : prev))
                  }
                  placeholder="Ej. Pago adelantado en efectivo"
                />
              </label>
            </div>
            <footer>
              <button type="button" className="btn-secondary" onClick={closePaymentDraft}>
                Cancelar
              </button>
              <button type="submit" className="btn-primary">
                Guardar pago
              </button>
            </footer>
          </form>
        </div>
      )}
      <header>
        <div>
          <h1>Calendario semanal</h1>
          <p>Visualiza aperturas, cierres y asignaciones del equipo.</p>
        </div>
      </header>

      {error && <p className="error">{error}</p>}

      <div className={user?.role === 'ADMIN' ? 'schedule-grid admin' : 'schedule-grid'}>
        <div className="calendar-panel">
          {loading ? (
            <p>Cargando...</p>
          ) : (
            <div className="week-board">
              {weeklySchedule.map(({ day, items }) => {
                const baseDate = weekRange
                  ? format(addDays(parseISO(weekRange.start), day.value), 'd MMM', { locale: es })
                  : '';
                return (
                  <section key={day.value} className="week-day">
                    <header>
                      <strong>{day.label}</strong>
                      <span>{baseDate}</span>
                    </header>
                    <div className="week-day-list">
                      {items.length === 0 && <p className="empty">Sin asignaciones.</p>}
                      {items.map((entry) => {
                        const start = parseISO(entry.start);
                        const end = parseISO(entry.end);
                        return (
                          <article key={entry.id}>
                            <strong>{entry.title}</strong>
                            <span>
                              {format(start, 'HH:mm')} – {format(end, 'HH:mm')} ·{' '}
                              {`${entry.user.firstName} ${entry.user.lastName}`}
                            </span>
                          </article>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
          )}

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

        {user?.role === 'ADMIN' && (
          <aside className="planner-panel">
            <div className="planner-card">
              <h3>Crear asignación semanal</h3>
              {scheduleForm ? (
                <form onSubmit={handleScheduleSubmit}>
                  <label>
                    Barista
                    <select value={scheduleForm.userId} onChange={handleScheduleField('userId')} required>
                      <option value="">Selecciona barista</option>
                      {users
                        .filter((option) => option.role === 'BARISTA')
                        .map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.firstName} {option.lastName}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label>
                    Día de la semana
                    <select value={scheduleForm.day} onChange={handleScheduleField('day')} required>
                      {DAYS_OF_WEEK.map((day) => (
                        <option key={day.value} value={day.value}>
                          {day.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="planner-inline">
                    <label>
                      Hora de inicio
                      <input type="time" value={scheduleForm.startTime} onChange={handleScheduleField('startTime')} required />
                    </label>
                    <label>
                      Hora de fin
                      <input type="time" value={scheduleForm.endTime} onChange={handleScheduleField('endTime')} required />
                    </label>
                  </div>
                  <label>
                    Descripción
                    <input
                      type="text"
                      value={scheduleForm.title}
                      onChange={handleScheduleTitleChange}
                      placeholder="Ej. Apertura espresso"
                      required
                    />
                  </label>
                  <div className="planner-actions">
                    <button type="button" className="btn-tertiary" onClick={applyCurrentTimeToForm}>
                      Usar hora actual
                    </button>
                    <div className="action-group">
                      <button type="button" className="btn-secondary" onClick={clearScheduleForm}>
                        Limpiar
                      </button>
                      <button type="submit" className="btn-primary">
                        Guardar turno
                      </button>
                    </div>
                  </div>
                </form>
              ) : (
                <p className="planner-hint">Cargando formulario...</p>
              )}
            </div>

            <div className="planner-card">
              <h3>Resumen de pagos</h3>
              {payoutLoading && <p>Cargando totales...</p>}
              {!payoutLoading && payouts.length === 0 && <p>Aún no hay turnos cerrados en la semana.</p>}
              {!payoutLoading && payouts.length > 0 && (
                <div className="summary-grid">
                  {payouts.map((item) => (
                    <article key={item.userId}>
                      <header>
                        <strong>
                          {item.user ? `${item.user.firstName} ${item.user.lastName}` : 'Barista'}
                        </strong>
                        <span>{item.shifts} turnos</span>
                      </header>
                      <p>Horas: {item.hoursWorked.toFixed(1)} · Total generado: ${formatCurrency(item.payout)}</p>
                      <p>Pagado: ${formatCurrency(item.paid)} · Pendiente: ${formatCurrency(item.pending)}</p>
                      <button type="button" className="btn-primary" onClick={() => openPaymentDraft(item)}>
                        Registrar pago
                      </button>
                    </article>
                  ))}
                </div>
              )}
              {weekRange && (
                <small>
                  Semana del {new Date(weekRange.start).toLocaleDateString('es-CO', { dateStyle: 'medium' })} al{' '}
                  {new Date(weekRange.end).toLocaleDateString('es-CO', { dateStyle: 'medium' })}
                </small>
              )}
            </div>

            <div className="planner-card">
              <h3>Historial de pagos</h3>
              {(historyLoading || payoutLoading) && <p>Cargando historial...</p>}
              {!historyLoading && history.length === 0 && <p>No hay pagos registrados en esta semana.</p>}
              {!historyLoading && history.length > 0 && (
                <div className="history-list">
                  {history.map((item) => (
                    <article key={item.id}>
                      <header>
                        <strong>
                          {item.user ? `${item.user.firstName} ${item.user.lastName}` : 'Barista'}
                        </strong>
                        <button type="button" onClick={() => removePayment(item.id)} className="history-remove">
                          Resetear
                        </button>
                      </header>
                      <p>Pago: ${formatCurrency(Number(item.amount))}</p>
                      <p className="history-meta">
                        Pagado el:{' '}
                        {new Date(item.paidAt ?? item.createdAt).toLocaleString('es-CO', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                      </p>
                      <p className="history-meta">
                        Registrado:{' '}
                        {new Date(item.createdAt).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })}
                      </p>
                      <p className="history-meta">
                        Periodo: {new Date(item.periodStart).toLocaleDateString('es-CO')} –{' '}
                        {new Date(item.periodEnd).toLocaleDateString('es-CO')}
                      </p>
                      {item.notes && <small>Notas: {item.notes}</small>}
                    </article>
                  ))}
                </div>
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
};

export default SchedulePage;
