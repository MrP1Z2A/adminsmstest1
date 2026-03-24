import React from 'react';
import { supabase } from '../supabaseClient';

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

interface LiveCalendarProps {
  classes: any[];
  notify: (msg: string) => void;
  schoolId: string | undefined;
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

const LiveCalendar: React.FC<LiveCalendarProps> = ({ classes, notify, schoolId }) => {
  const [monthCursor, setMonthCursor] = React.useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = React.useState(() => getLocalIsoDate());
  const [events, setEvents] = React.useState<LiveCalendarEvent[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [classCourses, setClassCourses] = React.useState<Array<{ id: string; name: string; class_id: string }>>([]);
  const [isCoursesLoading, setIsCoursesLoading] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [editingEventId, setEditingEventId] = React.useState<string | null>(null);
  const [pendingDeleteEvent, setPendingDeleteEvent] = React.useState<LiveCalendarEvent | null>(null);

  const [formData, setFormData] = React.useState({
    title: '',
    event_date: getLocalIsoDate(),
    class_id: '',
    course_id: '',
    start_time: '08:00',
    end_time: '09:00',
    notes: '',
  });

  const monthLabel = monthCursor.toLocaleString('en-US', { month: 'long', year: 'numeric' });

  const loadMonthEvents = React.useCallback(async (targetMonth: Date) => {
    if (!schoolId) return;
    const { start, end } = toMonthRange(targetMonth);
    setIsLoading(true);
    try {
      const { data, error } = await supabase
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
      notify(`Failed to load calendar events: ${error?.message || 'Unknown error'}`);
      setEvents([]);
    } finally {
      setIsLoading(false);
    }
  }, [notify, schoolId]);

  React.useEffect(() => {
    void loadMonthEvents(monthCursor);
  }, [monthCursor, loadMonthEvents]);

  React.useEffect(() => {
    const channel = supabase
      .channel('live-calendar-events-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_calendar_events' }, () => {
        void loadMonthEvents(monthCursor);
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [monthCursor, loadMonthEvents]);

  React.useEffect(() => {
    const loadClassCourses = async () => {
      if (!formData.class_id || !schoolId) {
        setClassCourses([]);
        return;
      }

      setIsCoursesLoading(true);
      try {
        const { data, error } = await supabase
          .from('class_courses')
          .select('id, name, class_id')
          .eq('class_id', formData.class_id)
          .eq('school_id', schoolId)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setClassCourses((data || []).map((course: any) => ({
          id: String(course.id),
          name: String(course.name || ''),
          class_id: String(course.class_id || ''),
        })));
      } catch (error: any) {
        console.error('Failed to load class courses:', error);
        notify(`Failed to load class courses: ${error?.message || 'Unknown error'}`);
        setClassCourses([]);
      } finally {
        setIsCoursesLoading(false);
      }
    };

    void loadClassCourses();
  }, [formData.class_id, notify, schoolId]);

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

  const resetForm = () => {
    setFormData({
      title: '',
      event_date: selectedDate,
      class_id: '',
      course_id: '',
      start_time: '08:00',
      end_time: '09:00',
      notes: '',
    });
    setEditingEventId(null);
  };

  const handleSubmit = async () => {
    if (!formData.title.trim()) {
      notify('Please enter a timetable title.');
      return;
    }
    if (!formData.class_id) {
      notify('Please choose a class.');
      return;
    }
    if (!formData.event_date) {
      notify('Please choose a date.');
      return;
    }
    if (!formData.start_time || !formData.end_time || formData.end_time <= formData.start_time) {
      notify('End time must be later than start time.');
      return;
    }

    const selectedClass = classes.find(classItem => String(classItem.id) === formData.class_id);
    const selectedCourse = classCourses.find(course => String(course.id) === formData.course_id);

    const payload = {
      title: formData.title.trim(),
      event_date: formData.event_date,
      start_time: formData.start_time,
      end_time: formData.end_time,
      class_id: formData.class_id,
      class_name: selectedClass?.name ? String(selectedClass.name) : 'Unknown Class',
      course_id: formData.course_id || null,
      course_name: selectedCourse?.name || null,
      notes: formData.notes.trim() ? formData.notes.trim() : null,
      school_id: schoolId
    };

    setIsSubmitting(true);
    try {
      if (editingEventId) {
        const { error } = await supabase
          .from('live_calendar_events')
          .update(payload)
          .eq('id', editingEventId);
        if (error) throw error;
        notify('Timetable event updated.');
      } else {
        const { error } = await supabase
          .from('live_calendar_events')
          .insert([payload]);
        if (error) throw error;
        notify('Timetable event created.');
      }

      await loadMonthEvents(monthCursor);
      resetForm();
    } catch (error: any) {
      console.error('Failed to save timetable event:', error);
      notify(`Failed to save timetable event: ${error?.message || 'Unknown error'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const startEditEvent = (event: LiveCalendarEvent) => {
    setEditingEventId(event.id);
    setSelectedDate(event.event_date);
    setFormData({
      title: event.title,
      event_date: event.event_date,
      class_id: event.class_id,
      course_id: event.course_id || '',
      start_time: toTimeInputValue(event.start_time),
      end_time: toTimeInputValue(event.end_time),
      notes: event.notes || '',
    });
  };

  const deleteEvent = async (eventId: string) => {
    try {
      const { error } = await supabase
        .from('live_calendar_events')
        .delete()
        .eq('id', eventId);

      if (error) throw error;
      notify('Timetable event deleted.');
      await loadMonthEvents(monthCursor);
      if (editingEventId === eventId) {
        resetForm();
      }
    } catch (error: any) {
      console.error('Failed to delete timetable event:', error);
      notify(`Failed to delete timetable event: ${error?.message || 'Unknown error'}`);
    }
  };

  const requestDeleteEvent = (event: LiveCalendarEvent) => {
    setPendingDeleteEvent(event);
  };

  const confirmDeleteEvent = async () => {
    if (!pendingDeleteEvent) return;
    const targetId = pendingDeleteEvent.id;
    setPendingDeleteEvent(null);
    await deleteEvent(targetId);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="bg-white dark:bg-slate-900 rounded-[32px] sm:rounded-[48px] lg:rounded-[56px] p-6 sm:p-8 lg:p-10 border border-slate-100 dark:border-slate-800 shadow-premium">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight">Live Timetable Calendar</h2>
            <p className="text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] text-slate-400 mt-2">Admin schedule control for class and course timeline</p>
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

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-white dark:bg-slate-900 rounded-[28px] p-4 sm:p-6 border border-slate-100 dark:border-slate-800 shadow-premium">
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
                      setFormData(prev => ({ ...prev, event_date: day.iso }));
                    }}
                    className={`min-h-24 rounded-xl border p-2 text-left transition-all ${isSelected ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20' : 'border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800'} ${!day.inMonth ? 'opacity-45' : ''}`}
                  >
                    <p className="text-xs font-black text-slate-500">{day.date.getDate()}</p>
                    <div className="mt-1 space-y-1">
                      {dayEvents.slice(0, 2).map(event => (
                        <div key={event.id} className="px-1.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[10px] font-bold text-slate-600 truncate">
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

        <div className="bg-white dark:bg-slate-900 rounded-[28px] p-4 sm:p-6 border border-slate-100 dark:border-slate-800 shadow-premium space-y-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{editingEventId ? 'Edit Timetable Event' : 'Create Timetable Event'}</p>

          <input
            type="text"
            value={formData.title}
            onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
            placeholder="Timetable title"
            className="w-full bg-slate-50 dark:bg-slate-800 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 outline-none font-semibold text-sm"
          />

          <input
            type="date"
            value={formData.event_date}
            onChange={(e) => {
              setFormData(prev => ({ ...prev, event_date: e.target.value }));
              setSelectedDate(e.target.value);
            }}
            className="w-full bg-slate-50 dark:bg-slate-800 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 outline-none font-semibold text-sm"
          />

          <select
            value={formData.class_id}
            onChange={(e) => setFormData(prev => ({ ...prev, class_id: e.target.value, course_id: '' }))}
            className="w-full bg-slate-50 dark:bg-slate-800 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 outline-none font-semibold text-sm"
          >
            <option value="">Choose class</option>
            {classes.map(classItem => (
              <option key={classItem.id} value={classItem.id}>
                {classItem.name} ({classItem.class_code || classItem.id})
              </option>
            ))}
          </select>

          <select
            value={formData.course_id}
            onChange={(e) => setFormData(prev => ({ ...prev, course_id: e.target.value }))}
            disabled={!formData.class_id || isCoursesLoading}
            className="w-full bg-slate-50 dark:bg-slate-800 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 outline-none font-semibold text-sm disabled:opacity-60"
          >
            <option value="">{!formData.class_id ? 'Choose class first' : isCoursesLoading ? 'Loading courses...' : 'Choose course (optional)'}</option>
            {classCourses.map(course => (
              <option key={course.id} value={course.id}>{course.name}</option>
            ))}
          </select>

          <div className="grid grid-cols-2 gap-3">
            <input
              type="time"
              value={formData.start_time}
              onChange={(e) => setFormData(prev => ({ ...prev, start_time: e.target.value }))}
              className="w-full bg-slate-50 dark:bg-slate-800 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 outline-none font-semibold text-sm"
            />
            <input
              type="time"
              value={formData.end_time}
              onChange={(e) => setFormData(prev => ({ ...prev, end_time: e.target.value }))}
              className="w-full bg-slate-50 dark:bg-slate-800 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 outline-none font-semibold text-sm"
            />
          </div>

          <textarea
            value={formData.notes}
            onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
            placeholder="Notes (optional)"
            rows={3}
            className="w-full bg-slate-50 dark:bg-slate-800 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 outline-none font-semibold text-sm resize-none"
          />

          <div className="flex gap-2">
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest text-white ${isSubmitting ? 'bg-brand-300 cursor-not-allowed' : 'bg-brand-500'}`}
            >
              {isSubmitting ? 'Saving...' : editingEventId ? 'Update Event' : 'Create Event'}
            </button>
            {editingEventId && (
              <button
                onClick={resetForm}
                className="px-4 py-3 rounded-xl bg-slate-200 dark:bg-slate-700 text-xs font-black uppercase tracking-widest text-slate-700 dark:text-slate-200"
              >
                Cancel
              </button>
            )}
          </div>
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
                  <p className="text-sm font-black truncate">{event.title}</p>
                  <p className="text-[11px] font-semibold text-slate-500 truncate">
                    {toTimeInputValue(event.start_time)} - {toTimeInputValue(event.end_time)} • {event.class_name}{event.course_name ? ` • ${event.course_name}` : ''}
                  </p>
                  {event.notes && <p className="text-[11px] text-slate-500 mt-1 truncate">{event.notes}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => startEditEvent(event)}
                    className="w-9 h-9 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-brand-500"
                    title="Edit event"
                  >
                    <i className="fas fa-pen"></i>
                  </button>
                  <button
                    onClick={() => requestDeleteEvent(event)}
                    className="w-9 h-9 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-rose-500"
                    title="Delete event"
                  >
                    <i className="fas fa-trash"></i>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {pendingDeleteEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-premium">
            <p className="text-sm font-black text-slate-900 dark:text-slate-100">Delete timetable event?</p>
            <p className="mt-2 text-xs font-semibold text-slate-500">
              Are you sure you want to delete "{pendingDeleteEvent.title}" on {pendingDeleteEvent.event_date}?
            </p>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                onClick={() => setPendingDeleteEvent(null)}
                className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-[11px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-200"
              >
                Cancel
              </button>
              <button
                onClick={() => void confirmDeleteEvent()}
                className="px-4 py-2 rounded-xl bg-rose-500 text-[11px] font-black uppercase tracking-widest text-white"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LiveCalendar;
