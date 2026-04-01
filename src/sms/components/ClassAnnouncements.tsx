import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient';

type AnnouncementItem = {
  id: string;
  title: string;
  message: string;
  notice_date: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  attachment_url: string | null;
  class_id: string | null;
  class_course_id: string | null;
  created_at: string;
};

type ClassItem = {
  id: string;
  name: string;
};

type CourseItem = {
  id: string;
  name: string;
  class_id: string;
};

const getTodayIso = () => new Date().toISOString().slice(0, 10);
const priorityOptions: Array<AnnouncementItem['priority']> = ['low', 'medium', 'high', 'urgent'];

export default function ClassAnnouncements({ schoolId }: { schoolId: string | undefined }) {
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [noticeDate, setNoticeDate] = useState(getTodayIso());
  const [priority, setPriority] = useState<AnnouncementItem['priority']>('medium');
  const [targetClassId, setTargetClassId] = useState<string>('');
  const [targetCourseId, setTargetCourseId] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Filter state
  const [filterClassId, setFilterClassId] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<'all' | AnnouncementItem['priority']>('all');

  const filteredAnnouncements = useMemo(() => {
    return announcements.filter(ann => {
      const classPass = filterClassId === 'all' || ann.class_id === filterClassId;
      const priorityPass = filterPriority === 'all' || ann.priority === filterPriority;
      return classPass && priorityPass;
    });
  }, [announcements, filterClassId, filterPriority]);

  const loadData = async () => {
    if (!schoolId) return;
    setIsLoading(true);
    try {
      // Fetch classes
      const { data: classData } = await supabase.from('classes').select('id, name').eq('school_id', schoolId).order('name');
      setClasses(classData || []);

      // Fetch courses
      const { data: courseData } = await supabase.from('class_courses').select('id, name, class_id').eq('school_id', schoolId).order('name');
      setCourses(courseData || []);

      // Fetch announcements
      const { data: annData } = await supabase
        .from('class_announcements')
        .select('*')
        .eq('school_id', schoolId)
        .order('notice_date', { ascending: false });
      
      setAnnouncements(annData || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [schoolId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !message || !schoolId) return;
    setIsSaving(true);
    setError(null);

    try {
      let attachment_url = null;
      if (selectedFile) {
        const fileName = `announcements/${Date.now()}_${selectedFile.name}`;
        const { error: uploadError } = await supabase.storage.from('notice_files').upload(fileName, selectedFile);
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage.from('notice_files').getPublicUrl(fileName);
        attachment_url = publicUrl;
      }

      const { error: saveError } = await supabase.from('class_announcements').insert([{
        school_id: schoolId,
        title,
        message,
        notice_date: noticeDate,
        priority,
        class_id: targetClassId || null,
        class_course_id: targetCourseId || null,
        attachment_url
      }]);

      if (saveError) throw saveError;

      setStatus('Announcement published successfully.');
      setTitle('');
      setMessage('');
      setTargetClassId('');
      setTargetCourseId('');
      setSelectedFile(null);
      void loadData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this announcement?')) return;
    setDeletingId(id);
    try {
      const { error: delError } = await supabase.from('class_announcements').delete().eq('id', id);
      if (delError) throw delError;
      setAnnouncements(prev => prev.filter(a => a.id !== id));
      setStatus('Announcement deleted.');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setDeletingId(null);
    }
  };

  const filteredCourses = useMemo(() => {
    if (!targetClassId) return courses;
    return courses.filter(c => c.class_id === targetClassId);
  }, [courses, targetClassId]);

  const stats = useMemo(() => {
    const total = announcements.length;
    const urgent = announcements.filter(a => a.priority === 'urgent').length;
    const high = announcements.filter(a => a.priority === 'high').length;
    const targeted = announcements.filter(a => a.class_id || a.class_course_id).length;
    return { total, urgent, high, targeted };
  }, [announcements]);

  return (
    <div className="space-y-8 pb-20 animate-in fade-in duration-700">
      <div className="bg-gradient-to-r from-indigo-900 via-blue-800 to-cyan-700 rounded-[40px] p-6 sm:p-8 lg:p-10 text-white shadow-premium relative overflow-hidden group">
        <div className="absolute -right-20 -top-20 w-64 h-64 bg-white/5 rounded-full blur-3xl group-hover:bg-white/10 transition-all duration-700"></div>
        <div className="relative z-10">
          <p className="text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] text-cyan-200">Targeted Notification</p>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tighter mt-2">Class Announcements</h2>
          <p className="text-slate-200 mt-3 text-sm sm:text-base max-w-2xl">Publish and manage notices specifically targeted at certain classes or courses. Reach your students with precision.</p>
        </div>
      </div>

      {/* QUICK STATS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Internal', value: stats.total, icon: 'fa-bullhorn', color: 'bg-brand-500' },
          { label: 'Urgent Alert', value: stats.urgent, icon: 'fa-bolt', color: 'bg-rose-500' },
          { label: 'High Priority', value: stats.high, icon: 'fa-triangle-exclamation', color: 'bg-amber-500' },
          { label: 'Targeted Scopes', value: stats.targeted, icon: 'fa-crosshairs', color: 'bg-sky-500' },
        ].map((s, i) => (
          <div key={i} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-5 rounded-[32px] shadow-sm flex items-center gap-4 group hover:border-brand-500/30 transition-all">
            <div className={`w-12 h-12 rounded-2xl ${s.color} text-white flex items-center justify-center text-lg shadow-lg shadow-${s.color.split('-')[1]}-500/20 group-hover:scale-110 transition-transform`}>
              <i className={`fas ${s.icon}`}></i>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{s.label}</p>
              <p className="text-xl font-black">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {(error || status) && (
        <div className="space-y-2">
          {error && <div className="text-sm font-semibold text-rose-600 bg-rose-50 border border-rose-100 rounded-2xl px-4 py-3 flex items-center gap-3"><i className="fas fa-circle-exclamation"></i>{error}</div>}
          {status && <div className="text-sm font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-2xl px-4 py-3 flex items-center gap-3"><i className="fas fa-check-circle"></i>{status}</div>}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <form onSubmit={handleCreate} className="lg:col-span-1 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[32px] p-6 sm:p-8 shadow-premium space-y-5 h-fit sticky top-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg bg-brand-500/10 text-brand-500 flex items-center justify-center text-sm"><i className="fas fa-plus"></i></div>
            <h3 className="text-lg font-black tracking-tight">Create New</h3>
          </div>

          <label className="space-y-2 block">
            <span className="text-[11px] font-black uppercase tracking-widest text-slate-400 ml-1">Title</span>
            <input
              value={title}
              required
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Physics Lab Session"
              className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-4 py-3 text-sm font-semibold focus:border-brand-500 focus:ring-4 focus:ring-brand-500/5 transition-all outline-none"
            />
          </label>

          <div className="grid grid-cols-2 gap-4">
            <label className="space-y-2 block">
              <span className="text-[11px] font-black uppercase tracking-widest text-slate-400 ml-1">Date</span>
              <input
                type="date"
                value={noticeDate}
                onChange={(e) => setNoticeDate(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-4 py-3 text-sm font-semibold focus:border-brand-500 focus:ring-4 focus:ring-brand-500/5 transition-all outline-none"
              />
            </label>
            <label className="space-y-2 block">
              <span className="text-[11px] font-black uppercase tracking-widest text-slate-400 ml-1">Priority</span>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-4 py-3 text-sm font-semibold focus:border-brand-500 transition-all outline-none"
              >
                {priorityOptions.map(p => <option key={p} value={p}>{p.toUpperCase()}</option>)}
              </select>
            </label>
          </div>

          <label className="space-y-2 block">
            <span className="text-[11px] font-black uppercase tracking-widest text-slate-400 ml-1">Target Class</span>
            <select
              value={targetClassId}
              onChange={(e) => {
                setTargetClassId(e.target.value);
                setTargetCourseId('');
              }}
              className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-4 py-3 text-sm font-semibold focus:border-brand-500 transition-all outline-none"
            >
              <option value="">Global (All Classes)</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>

          <label className="space-y-2 block">
            <span className="text-[11px] font-black uppercase tracking-widest text-slate-400 ml-1">Target Course</span>
            <select
              value={targetCourseId}
              onChange={(e) => setTargetCourseId(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-4 py-3 text-sm font-semibold focus:border-brand-500 transition-all outline-none"
            >
              <option value="">Global (All Courses)</option>
              {filteredCourses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>

          <label className="space-y-2 block">
            <span className="text-[11px] font-black uppercase tracking-widest text-slate-400 ml-1">Attachment</span>
            <div className="relative">
               <input
                type="file"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                className="w-full opacity-0 absolute inset-0 cursor-pointer z-10"
              />
              <div className="w-full rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 px-4 py-4 text-center group-hover:border-brand-500 transition-all">
                <p className="text-xs font-bold text-slate-400">{selectedFile ? selectedFile.name : 'Click to upload files'}</p>
              </div>
            </div>
          </label>

          <label className="space-y-2 block">
            <span className="text-[11px] font-black uppercase tracking-widest text-slate-400 ml-1">Message</span>
            <textarea
              value={message}
              required
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Write announcement details here..."
              className="w-full h-32 resize-none rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-4 py-3 text-sm font-semibold focus:border-brand-500 outline-none transition-all"
            />
          </label>

          <button
            type="submit"
            disabled={isSaving}
            className="w-full rounded-2xl bg-brand-500 hover:bg-brand-600 text-white py-4 text-xs font-black uppercase tracking-widest disabled:opacity-60 transition-all shadow-lg shadow-brand-500/20 active:scale-[0.98]"
          >
            {isSaving ? 'Publishing...' : 'Publish Announcement'}
          </button>
        </form>

        <div className="lg:col-span-2 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 px-6 py-4 rounded-3xl shadow-sm">
            <h3 className="text-lg font-black tracking-tight">Recent History</h3>
            <div className="flex gap-2">
               <select
                  value={filterClassId}
                  onChange={(e) => setFilterClassId(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-widest"
               >
                  <option value="all">ALL CLASSES</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
               </select>
               <select
                  value={filterPriority}
                  onChange={(e) => setFilterPriority(e.target.value as any)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-widest"
               >
                  <option value="all">ALL PRIORITY</option>
                  {priorityOptions.map(p => <option key={p} value={p}>{p.toUpperCase()}</option>)}
               </select>
            </div>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 gap-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="bg-slate-50 dark:bg-slate-950 animate-pulse h-40 rounded-[32px]"></div>
              ))}
            </div>
          ) : filteredAnnouncements.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-[40px] p-16 text-center border border-slate-100 dark:border-slate-800 shadow-premium group">
              <div className="w-24 h-24 bg-brand-500/10 text-brand-500 rounded-full flex items-center justify-center mx-auto mb-8 text-4xl group-hover:scale-110 transition-transform"><i className="fas fa-satellite-dish"></i></div>
              <h4 className="text-2xl font-black tracking-tight mb-2">No active broadcasts</h4>
              <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px] max-w-xs mx-auto">Create your first targeted announcement using the panel on the left.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {filteredAnnouncements.map(ann => (
                <div key={ann.id} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[32px] p-6 lg:p-8 shadow-premium hover:border-brand-500/50 transition-all group relative overflow-hidden">
                  {ann.priority === 'urgent' && <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/5 blur-3xl -mr-16 -mt-16"></div>}
                  
                  <div className="flex justify-between items-start gap-4 relative z-10">
                    <div className="space-y-3 flex-1">
                      <div className="flex items-center flex-wrap gap-2">
                         <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-slate-50 dark:bg-slate-800 text-[9px] font-black uppercase tracking-widest text-slate-500"><i className="fas fa-calendar-day"></i>{ann.notice_date}</div>
                         <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                           ann.priority === 'urgent' ? 'bg-rose-100 text-rose-600' :
                           ann.priority === 'high' ? 'bg-amber-100 text-amber-600' :
                           ann.priority === 'medium' ? 'bg-sky-100 text-sky-600' : 'bg-slate-100 text-slate-600'
                         }`}>{ann.priority}</span>
                         {(ann.class_id || ann.class_course_id) && (
                           <span className="px-3 py-1 rounded-full bg-indigo-50 text-indigo-600 text-[9px] font-black uppercase tracking-widest"><i className="fas fa-crosshairs mr-1"></i>Targeted</span>
                         )}
                      </div>
                      <h4 className="text-2xl font-black text-slate-900 dark:text-white leading-tight tracking-tight">{ann.title}</h4>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                          <div className="flex items-center gap-2 text-[10px] text-slate-400 font-black uppercase tracking-widest">
                            <span className="text-brand-500">CLASS:</span>
                            {classes.find(c => c.id === ann.class_id)?.name || 'ALL INSTITUTION'}
                          </div>
                          {ann.class_course_id && (
                            <>
                              <div className="w-1 h-1 rounded-full bg-slate-200"></div>
                              <div className="flex items-center gap-2 text-[10px] text-slate-400 font-black uppercase tracking-widest">
                                <span className="text-brand-500">SUBJECT:</span>
                                {courses.find(c => c.id === ann.class_course_id)?.name || 'N/A'}
                              </div>
                            </>
                          )}
                      </div>
                      <p className="mt-4 text-sm text-slate-600 dark:text-slate-400 leading-relaxed max-w-2xl font-medium">{ann.message}</p>
                      
                      {ann.attachment_url && (
                        <div className="pt-4">
                          <a href={ann.attachment_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 bg-slate-50 dark:bg-slate-800 px-5 py-3 rounded-2xl text-[10px] font-black text-brand-500 uppercase tracking-widest hover:bg-brand-500 hover:text-white transition-all">
                            <i className="fas fa-paperclip"></i> View Attached Resource
                          </a>
                        </div>
                      )}
                    </div>
                    
                    <button 
                      onClick={() => handleDelete(ann.id)}
                      disabled={deletingId === ann.id}
                      className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-500 hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center text-sm shadow-sm group-hover:scale-100 scale-90 opacity-0 group-hover:opacity-100"
                    >
                      <i className="fas fa-trash-can"></i>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
