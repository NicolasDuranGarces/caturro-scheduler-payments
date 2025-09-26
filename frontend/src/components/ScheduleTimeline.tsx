import { addDays, differenceInMinutes, format, parseISO, startOfWeek } from 'date-fns';
import { es } from 'date-fns/locale';
import { useCallback, useState } from 'react';
import './ScheduleTimeline.css';

export interface TimelineEntry {
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

interface Props {
  entries: TimelineEntry[];
  onRangeSelect?: (payload: { day: Date; start: Date; end: Date }) => void;
}

const HOUR_HEIGHT = 54;
const START_HOUR = 6;
const END_HOUR = 23;

const ScheduleTimeline = ({ entries, onRangeSelect }: Props) => {
  const today = new Date();
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }).map((_, index) => addDays(weekStart, index));
  const hours = Array.from({ length: END_HOUR - START_HOUR + 1 }).map((_, index) => START_HOUR + index);
  const totalMinutes = (END_HOUR - START_HOUR + 1) * 60;

  const [selection, setSelection] = useState<{
    dayIndex: number;
    startMinutes: number;
    endMinutes: number;
  } | null>(null);

  const minuteFromOffset = useCallback((offset: number, height: number) => {
    const ratio = Math.min(Math.max(offset / height, 0), 1);
    return ratio * totalMinutes;
  }, [totalMinutes]);

  const roundToStep = useCallback((minutes: number) => Math.round(minutes / 30) * 30, []);

  const handlePointerDown = useCallback((dayIndex: number, event: React.MouseEvent<HTMLDivElement>) => {
    if (!onRangeSelect) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const startMinutes = minuteFromOffset(event.clientY - rect.top, rect.height);
    const rounded = roundToStep(startMinutes);
    setSelection({ dayIndex, startMinutes: rounded, endMinutes: rounded + 30 });
  }, [minuteFromOffset, onRangeSelect, roundToStep]);

  const handlePointerMove = useCallback((dayIndex: number, event: React.MouseEvent<HTMLDivElement>) => {
    if (!selection || selection.dayIndex !== dayIndex || !onRangeSelect) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const currentMinutes = roundToStep(minuteFromOffset(event.clientY - rect.top, rect.height));
    setSelection((prev) => {
      if (!prev || prev.dayIndex !== dayIndex) return prev;
      const baseStart = Math.min(prev.startMinutes, currentMinutes);
      const baseEnd = Math.max(prev.startMinutes, currentMinutes);
      return {
        ...prev,
        endMinutes: Math.max(baseStart + 30, baseEnd),
      };
    });
  }, [minuteFromOffset, onRangeSelect, roundToStep, selection]);

  const resetSelection = useCallback(() => {
    setSelection(null);
  }, []);

  const handlePointerUp = useCallback((dayIndex: number) => {
    if (!selection || !onRangeSelect) return;
    if (selection.dayIndex !== dayIndex) {
      resetSelection();
      return;
    }

    const day = days[dayIndex];
    const start = new Date(day);
    start.setHours(START_HOUR, 0, 0, 0);
    start.setMinutes(start.getMinutes() + Math.min(selection.startMinutes, selection.endMinutes));
    const end = new Date(day);
    end.setHours(START_HOUR, 0, 0, 0);
    const endMinutes = Math.max(selection.startMinutes, selection.endMinutes);
    end.setMinutes(end.getMinutes() + endMinutes);

    if (end.getTime() - start.getTime() >= 15 * 60 * 1000) {
      onRangeSelect({ day, start, end });
    }
    resetSelection();
  }, [days, onRangeSelect, resetSelection, selection]);

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

        {days.map((day, columnIndex) => {
          const activeSelection = selection && selection.dayIndex === columnIndex ? selection : null;
          const selectionStartMinutes = activeSelection
            ? Math.min(activeSelection.startMinutes, activeSelection.endMinutes)
            : 0;
          const selectionEndMinutes = activeSelection
            ? Math.max(activeSelection.startMinutes, activeSelection.endMinutes)
            : 0;
          const selectionStartDate = activeSelection
            ? (() => {
                const startDate = new Date(day);
                startDate.setHours(START_HOUR, 0, 0, 0);
                startDate.setMinutes(startDate.getMinutes() + selectionStartMinutes);
                return startDate;
              })()
            : null;
          const selectionEndDate = activeSelection
            ? (() => {
                const endDate = new Date(day);
                endDate.setHours(START_HOUR, 0, 0, 0);
                endDate.setMinutes(endDate.getMinutes() + selectionEndMinutes);
                return endDate;
              })()
            : null;

          return (
            <div
              key={day.toISOString()}
              className="timeline-day"
              style={{ height }}
              onMouseDown={(event) => handlePointerDown(columnIndex, event)}
              onMouseMove={(event) => handlePointerMove(columnIndex, event)}
              onMouseLeave={resetSelection}
              onMouseUp={() => handlePointerUp(columnIndex)}
            >
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
                      ...(entry.color
                        ? {
                            background: entry.color,
                            borderColor: entry.color,
                          }
                        : {}),
                    }}
                  >
                    <strong>{entry.title}</strong>
                    <span>{`${format(start, 'HH:mm')} — ${format(end, 'HH:mm')}`}</span>
                    <small>{`${entry.user.firstName} ${entry.user.lastName}`}</small>
                  </div>
                );
              })}
              {activeSelection && selectionStartDate && selectionEndDate && (
                <div
                  className="timeline-selection"
                  style={{
                    top: (selectionStartMinutes / 60) * HOUR_HEIGHT,
                    height: (Math.max(30, selectionEndMinutes - selectionStartMinutes) / 60) * HOUR_HEIGHT,
                  }}
                >
                  <span>{`${format(selectionStartDate, 'HH:mm')} - ${format(selectionEndDate, 'HH:mm')}`}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ScheduleTimeline;
