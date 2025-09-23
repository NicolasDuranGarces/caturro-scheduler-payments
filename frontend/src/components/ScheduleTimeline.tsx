import { addDays, differenceInMinutes, endOfWeek, format, parseISO, startOfWeek } from 'date-fns';
import { es } from 'date-fns/locale';
import './ScheduleTimeline.css';

export interface TimelineEntry {
  id: number;
  title: string;
  start: string;
  end: string;
  user: {
    firstName: string;
    lastName: string;
  };
  color?: string | null;
}

interface Props {
  entries: TimelineEntry[];
}

const HOUR_HEIGHT = 54;
const START_HOUR = 6;
const END_HOUR = 23;

const ScheduleTimeline = ({ entries }: Props) => {
  const today = new Date();
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }).map((_, index) => addDays(weekStart, index));
  const hours = Array.from({ length: END_HOUR - START_HOUR + 1 }).map((_, index) => START_HOUR + index);

  const entriesByDay = days.map((day) => {
    const startDay = day.getDate();
    return entries.filter((entry) => {
      const start = parseISO(entry.start);
      return start.getDate() === startDay && start.getMonth() === day.getMonth();
    });
  });

  const trackStyle = {
    gridTemplateColumns: `80px repeat(${days.length}, minmax(0, 1fr))`,
  } as const;

  const height = (END_HOUR - START_HOUR + 1) * HOUR_HEIGHT;

  return (
    <div className="timeline" style={{ height }}>
      <div className="timeline-grid" style={trackStyle}>
        <div className="timeline-header empty" />
        {days.map((day) => (
          <div key={day.toISOString()} className="timeline-header">
            <strong>{format(day, 'EEE', { locale: es }).toUpperCase()}</strong>
            <span>{format(day, 'd MMM', { locale: es })}</span>
          </div>
        ))}

        {hours.map((hour) => (
          <div key={`label-${hour}`} className="timeline-label">
            <span>{`${hour.toString().padStart(2, '0')}:00`}</span>
          </div>
        ))}

        {days.map((day, columnIndex) => (
          <div key={day.toISOString()} className="timeline-day" style={{ height }}>
            {entriesByDay[columnIndex].map((entry) => {
              const start = parseISO(entry.start);
              const end = parseISO(entry.end);
              const topMinutes = (start.getHours() - START_HOUR) * 60 + start.getMinutes();
              const shiftMinutes = Math.max(differenceInMinutes(end, start), 30);
              const top = (topMinutes / 60) * HOUR_HEIGHT;
              const entryHeight = (shiftMinutes / 60) * HOUR_HEIGHT;
              return (
                <div
                  className="timeline-event"
                  key={entry.id}
                  style={{
                    top,
                    height: entryHeight,
                    background: entry.color ?? 'rgba(168, 85, 247, 0.35)',
                    borderColor: entry.color ?? 'rgba(168, 85, 247, 0.65)',
                  }}
                >
                  <strong>{entry.title}</strong>
                  <span>{`${format(start, 'HH:mm')} — ${format(end, 'HH:mm')}`}</span>
                  <small>{`${entry.user.firstName} ${entry.user.lastName}`}</small>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ScheduleTimeline;
