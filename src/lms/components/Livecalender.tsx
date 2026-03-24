import React from 'react';
import { supabase } from '../src/supabaseClient';

const getLocalIsoDate = (date: Date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

interface LiveCalendarEvent {
  id: string;
  title: string;
  event_date: string;
  start_time: string;
  end_time: string;
  class_id: string;
  class_name: string;
  course_id: string | null;
  course_name: string | null;
  notes: string | null;
}

const toMonthRange = (cursor: Date) => {
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);
  return {
    start: getLocalIsoDate(start),
    end: getLocalIsoDate(end),
  };
};

const toTimeInputValue = (value: string) => (value || '').slice(0, 5);

interface LiveCalendarProps {
  schoolId?: string;
}

const LiveCalendar: React.FC<LiveCalendarProps> = ({ schoolId }) => {
  const db = supabase;
  const [monthCursor, setMonthCursor] = React.useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = React.useState(() => getLocalIsoDate());
  const [events, setEvents] = React.useState<LiveCalendarEvent[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);

  const monthLabel = monthCursor.toLocaleString('en-US', { month: 'long', year: 'numeric' });

  const loadMonthEvents = React.useCallback(async (targetMonth: Date) => {
    if (!db) {
      setEvents([]);
      return;
    }

    const { start, end } = toMonthRange(targetMonth);
    setIsLoading(true);
    try {
      const { data, error } = await db
        .from('live_calendar_events')
        .select('id, title, event_date, start_time, end_time, class_id, class_name, course_id, course_name, notes')
        .eq('school_id', schoolId)
        .gte('event_date', start)
        .lte('event_date', end)
        .order('event_date', { ascending: true })
        .order('start_time', { ascending: true });

      if (error) throw error;
      setEvents((data || []).map((event: any) => ({
        id: String(event.id),
        title: String(event.title || ''),
        event_date: String(event.event_date),
        start_time: String(event.start_time || ''),
        end_time: String(event.end_time || ''),
        class_id: String(event.class_id || ''),
        class_name: String(event.class_name || ''),
        course_id: event.course_id ? String(event.course_id) : null,
        course_name: event.course_name ? String(event.course_name) : null,
        notes: event.notes ? String(event.notes) : null,
      })));
    } catch (error: any) {
      console.error('Failed to load live calendar events:', error);
      setEvents([]);
    } finally {
      setIsLoading(false);
    }
  }, [db]);

  React.useEffect(() => {
    void loadMonthEvents(monthCursor);
  }, [monthCursor, loadMonthEvents]);

  React.useEffect(() => {
    if (!db) return;

    const channel = db
      .channel('live-calendar-events-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_calendar_events' }, () => {
        void loadMonthEvents(monthCursor);
      })
      .subscribe();

    return () => {
      void db.removeChannel(channel);
    };
  }, [monthCursor, loadMonthEvents, db]);

  const eventsByDate = React.useMemo(() => {
    return events.reduce<Record<string, LiveCalendarEvent[]>>((acc, event) => {
      if (!acc[event.event_date]) {
        acc[event.event_date] = [];
      }
      acc[event.event_date].push(event);
      return acc;
    }, {});
  }, [events]);

  const selectedDayEvents = React.useMemo(() => {
    return (eventsByDate[selectedDate] || []).slice().sort((a, b) => a.start_time.localeCompare(b.start_time));
  }, [eventsByDate, selectedDate]);

  const calendarDays = React.useMemo(() => {
    const startOfMonth = new Date(monthCursor.getFullYear(), monthCursor.getMonth(), 1);
    const endOfMonth = new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 0);
    const startDay = startOfMonth.getDay();

    const days: Array<{ date: Date; iso: string; inMonth: boolean }> = [];

    for (let i = startDay; i > 0; i -= 1) {
      const date = new Date(startOfMonth);
      date.setDate(date.getDate() - i);
      days.push({ date, iso: getLocalIsoDate(date), inMonth: false });
    }

    for (let day = 1; day <= endOfMonth.getDate(); day += 1) {
      const date = new Date(monthCursor.getFullYear(), monthCursor.getMonth(), day);
      days.push({ date, iso: getLocalIsoDate(date), inMonth: true });
    }

    while (days.length % 7 !== 0) {
      const date = new Date(endOfMonth);
      date.setDate(date.getDate() + (days.length % 7));
      days.push({ date, iso: getLocalIsoDate(date), inMonth: false });
    }

    return days;
  }, [monthCursor]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="bg-white dark:bg-slate-900 rounded-[32px] sm:rounded-[48px] lg:rounded-[56px] p-6 sm:p-8 lg:p-10 border border-slate-100 dark:border-slate-800 shadow-premium">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight">Live Timetable Calendar</h2>
            <p className="text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] text-slate-400 mt-2">View-only class and course timeline</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMonthCursor(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
              className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-brand-500"
              title="Previous month"
            >
              <i className="fas fa-chevron-left"></i>
            </button>
            <div className="px-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-black uppercase tracking-widest text-slate-500 min-w-[180px] text-center">
              {monthLabel}
            </div>
            <button
              onClick={() => setMonthCursor(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
              className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-brand-500"
              title="Next month"
            >
              <i className="fas fa-chevron-right"></i>
            </button>
          </div>
        </div>
      </div>

      <div className="w-full">
        <div className="bg-white dark:bg-slate-900 rounded-[28px] p-4 sm:p-6 border border-slate-100 dark:border-slate-800 shadow-premium">
          <div className="grid grid-cols-7 gap-2 mb-3">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="text-center text-[10px] font-black uppercase tracking-widest text-slate-400 py-1">{day}</div>
            ))}
          </div>

          {isLoading ? (
            <div className="h-64 flex items-center justify-center text-sm font-semibold text-slate-500">Loading calendar...</div>
          ) : (
            <div className="grid grid-cols-7 gap-2">
              {calendarDays.map(day => {
                const dayEvents = eventsByDate[day.iso] || [];
                const isSelected = day.iso === selectedDate;
                return (
                  <button
                    key={`${day.iso}-${day.inMonth ? 'in' : 'out'}`}
                    onClick={() => {
                      setSelectedDate(day.iso);
                    }}
                    className={`min-h-24 rounded-xl border p-2 text-left transition-all ${isSelected ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20' : 'border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800'} ${!day.inMonth ? 'opacity-45' : ''}`}
                  >
                    <p className="text-xs font-black text-slate-500">{day.date.getDate()}</p>
                    <div className="mt-1 space-y-1">
                      {dayEvents.slice(0, 2).map(event => (
                        <div key={event.id} className="px-1.5 py-1 rounded-lg bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-700 text-[10px] font-black text-brand-700 dark:text-brand-300 truncate">
                          {toTimeInputValue(event.start_time)} {event.title}
                        </div>
                      ))}
                      {dayEvents.length > 2 && (
                        <p className="text-[10px] font-black text-brand-500">+{dayEvents.length - 2} more</p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-[28px] p-4 sm:p-6 border border-slate-100 dark:border-slate-800 shadow-premium space-y-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Events on {selectedDate}</p>
          <span className="text-[10px] font-black uppercase tracking-widest text-brand-500">{selectedDayEvents.length} Entries</span>
        </div>

        {selectedDayEvents.length === 0 ? (
          <p className="text-sm font-semibold text-slate-500">No timetable entries for this date.</p>
        ) : (
          <div className="space-y-2">
            {selectedDayEvents.map(event => (
              <div key={event.id} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-black text-brand-700 dark:text-brand-300 truncate">{event.title}</p>
                  <p className="text-[11px] font-semibold text-brand-600 dark:text-brand-400 truncate">
                    {toTimeInputValue(event.start_time)} - {toTimeInputValue(event.end_time)} • {event.class_name}{event.course_name ? ` • ${event.course_name}` : ''}
                  </p>
                  {event.notes && <p className="text-[11px] text-slate-500 mt-1 truncate">{event.notes}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default LiveCalendar;
