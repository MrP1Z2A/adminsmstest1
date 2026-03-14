import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient';

type NoticeItem = {
  id: string;
  title: string;
  message: string;
  notice_date: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  file_path: string | null;
  file_name: string | null;
  created_at: string;
};

const getTodayIso = () => new Date().toISOString().slice(0, 10);
const NOTICE_FILES_BUCKET = 'notice_files';
const MAX_NOTICE_FILE_SIZE = 20 * 1024 * 1024;
const priorityOptions: Array<NoticeItem['priority']> = ['low', 'medium', 'high', 'urgent'];

const priorityBadgeClassMap: Record<NoticeItem['priority'], string> = {
  low: 'bg-slate-100 text-slate-700',
  medium: 'bg-sky-100 text-sky-700',
  high: 'bg-amber-100 text-amber-700',
  urgent: 'bg-rose-100 text-rose-700',
};

const extractStoragePath = (rawValue: string | null): string | null => {
  if (!rawValue) return null;
  const candidate = rawValue.trim();
  if (!candidate) return null;

  if (/^https?:\/\//i.test(candidate)) {
    const marker = `/object/public/${NOTICE_FILES_BUCKET}/`;
    const markerIndex = candidate.indexOf(marker);
    if (markerIndex >= 0) {
      const remainder = candidate.slice(markerIndex + marker.length).split('?')[0];
      return decodeURIComponent(remainder);
    }
    return null;
  }

  return candidate.replace(/^\/+/, '') || null;
};

const sanitizeFileName = (value: string) => value.replace(/[^a-zA-Z0-9._-]/g, '_');

interface NoticeBoardProps {
  onOpenNotice: (noticeId: string) => void;
}

export default function NoticeBoard({ onOpenNotice }: NoticeBoardProps) {
  const [notices, setNotices] = useState<NoticeItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [noticeDate, setNoticeDate] = useState(getTodayIso());
  const [priority, setPriority] = useState<NoticeItem['priority']>('medium');
  const [filterDate, setFilterDate] = useState('');
  const [filterPriority, setFilterPriority] = useState<'all' | NoticeItem['priority']>('all');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const sortedNotices = useMemo(
    () => [...notices].sort((a, b) => {
      if (a.notice_date === b.notice_date) {
        return b.created_at.localeCompare(a.created_at);
      }
      return b.notice_date.localeCompare(a.notice_date);
    }),
    [notices]
  );

  const filteredNotices = useMemo(() => {
    return sortedNotices.filter((item) => {
      const datePass = !filterDate || item.notice_date === filterDate;
      const priorityPass = filterPriority === 'all' || item.priority === filterPriority;
      return datePass && priorityPass;
    });
  }, [sortedNotices, filterDate, filterPriority]);

  const loadNotices = async () => {
    setIsLoading(true);
    setError(null);

    const { data, error: loadError } = await supabase
      .from('notice_board')
      .select('id, title, message, notice_date, priority, file_path, file_name, created_at')
      .order('notice_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (loadError) {
      setError(loadError.message || 'Failed to load notices.');
      setNotices([]);
      setIsLoading(false);
      return;
    }

    setNotices(
      (data || []).map((row: any) => ({
        id: String(row.id),
        title: String(row.title || ''),
        message: String(row.message || ''),
        notice_date: String(row.notice_date || getTodayIso()),
        priority: priorityOptions.includes(row.priority)
          ? row.priority
          : 'medium',
        file_path: row.file_path ? String(row.file_path) : null,
        file_name: row.file_name ? String(row.file_name) : null,
        created_at: String(row.created_at || new Date().toISOString()),
      }))
    );
    setIsLoading(false);
  };

  useEffect(() => {
    void loadNotices();
  }, []);

  const createNotice = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setStatus(null);

    if (!title.trim()) {
      setError('Title is required.');
      return;
    }

    if (!message.trim() && !selectedFile) {
      setError('Add announcement text or upload a file.');
      return;
    }

    if (!noticeDate) {
      setError('Announcement date is required.');
      return;
    }

    setIsSaving(true);

    let filePath: string | null = null;
    let fileName: string | null = null;

    if (selectedFile) {
      if (selectedFile.size > MAX_NOTICE_FILE_SIZE) {
        setIsSaving(false);
        setError('File is too large. Max size is 20MB.');
        return;
      }

      const sanitizedName = sanitizeFileName(selectedFile.name || 'notice-file');
      const uploadPath = `notices/${Date.now()}-${sanitizedName}`;

      const uploadResult = await supabase.storage
        .from(NOTICE_FILES_BUCKET)
        .upload(uploadPath, selectedFile, {
          upsert: false,
          contentType: selectedFile.type || undefined,
        });

      if (uploadResult.error) {
        setIsSaving(false);
        setError(uploadResult.error.message || 'Failed to upload file.');
        return;
      }

      filePath = uploadPath;
      fileName = selectedFile.name;
    }

    const payload = {
      title: title.trim(),
      message: message.trim(),
      notice_date: noticeDate,
      priority,
      file_path: filePath,
      file_name: fileName,
    };

    const { error: saveError } = await supabase
      .from('notice_board')
      .insert([payload]);

    setIsSaving(false);

    if (saveError) {
      if (filePath) {
        await supabase.storage.from(NOTICE_FILES_BUCKET).remove([filePath]);
      }
      setError(saveError.message || 'Failed to create notice.');
      return;
    }

    setStatus('Notice published.');
    setTitle('');
    setMessage('');
    setNoticeDate(getTodayIso());
    setPriority('medium');
    setSelectedFile(null);
    await loadNotices();
  };

  const deleteNotice = async (id: string) => {
    if (!window.confirm('Delete this notice?')) return;

    const targetNotice = notices.find((item) => item.id === id) || null;

    setDeletingId(id);
    setError(null);
    setStatus(null);

    const { error: deleteError } = await supabase
      .from('notice_board')
      .delete()
      .eq('id', id);

    setDeletingId(null);

    if (deleteError) {
      setError(deleteError.message || 'Failed to delete notice.');
      return;
    }

    if (targetNotice?.file_path) {
      const path = extractStoragePath(targetNotice.file_path);
      if (path) {
        await supabase.storage.from(NOTICE_FILES_BUCKET).remove([path]);
      }
    }

    setStatus('Notice deleted.');
    setNotices((prev) => prev.filter((item) => item.id !== id));
  };

  return (
    <div className="space-y-8 pb-20 animate-in fade-in duration-700">
      <div className="bg-gradient-to-r from-indigo-900 via-blue-800 to-cyan-700 rounded-[40px] p-6 sm:p-8 lg:p-10 text-white shadow-premium">
        <p className="text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] text-cyan-200">Campus Communication</p>
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tighter mt-2">Notice Board</h2>
        <p className="text-slate-200 mt-3 text-sm sm:text-base">Publish announcements with date so students and teachers can stay updated.</p>
      </div>

      {(error || status) && (
        <div className="space-y-2">
          {error && <p className="text-sm font-semibold text-rose-600 bg-rose-50 rounded-2xl px-4 py-3">{error}</p>}
          {status && <p className="text-sm font-semibold text-emerald-700 bg-emerald-50 rounded-2xl px-4 py-3">{status}</p>}
        </div>
      )}

      <form onSubmit={createNotice} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[32px] p-6 sm:p-8 shadow-premium space-y-5">
        <h3 className="text-lg font-black tracking-tight">Publish Notice</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="space-y-2">
            <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">Title</span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Holiday Announcement"
              className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-4 py-3 text-sm font-semibold"
              disabled={isSaving}
            />
          </label>

          <label className="space-y-2">
            <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">Date</span>
            <input
              type="date"
              value={noticeDate}
              onChange={(event) => setNoticeDate(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-4 py-3 text-sm font-semibold"
              disabled={isSaving}
            />
          </label>

          <label className="space-y-2">
            <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">Priority</span>
            <select
              value={priority}
              onChange={(event) => setPriority(event.target.value as NoticeItem['priority'])}
              className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-4 py-3 text-sm font-semibold"
              disabled={isSaving}
            >
              {priorityOptions.map((item) => (
                <option key={item} value={item}>{item.toUpperCase()}</option>
              ))}
            </select>
          </label>
        </div>

        <label className="space-y-2 block">
          <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">Announcement</span>
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Write announcement details here..."
            className="w-full h-32 resize-none rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-4 py-3 text-sm font-semibold"
            disabled={isSaving}
          />
        </label>

        <label className="space-y-2 block">
          <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">Attachment (Optional)</span>
          <input
            type="file"
            onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
            className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-4 py-3 text-sm font-semibold"
            disabled={isSaving}
          />
          {selectedFile && (
            <p className="text-xs font-semibold text-slate-500">Selected: {selectedFile.name}</p>
          )}
        </label>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSaving}
            className="rounded-2xl bg-brand-500 hover:bg-brand-600 text-white px-5 py-3 text-xs font-black uppercase tracking-widest disabled:opacity-60"
          >
            {isSaving ? 'Publishing...' : 'Publish Notice'}
          </button>
        </div>
      </form>

      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <h3 className="text-lg font-black tracking-tight">Latest Notices</h3>
          <div className="w-full sm:w-auto flex items-center gap-2">
            <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Filter Date</label>
            <input
              type="date"
              value={filterDate}
              onChange={(event) => setFilterDate(event.target.value)}
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm font-semibold"
            />
            {filterDate && (
              <button
                type="button"
                onClick={() => setFilterDate('')}
                className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-black uppercase tracking-widest text-slate-700 dark:text-slate-200"
              >
                Clear
              </button>
            )}
          </div>

          <div className="w-full sm:w-auto flex items-center gap-2">
            <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Priority</label>
            <select
              value={filterPriority}
              onChange={(event) => setFilterPriority(event.target.value as 'all' | NoticeItem['priority'])}
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm font-semibold"
            >
              <option value="all">ALL</option>
              {priorityOptions.map((item) => (
                <option key={item} value={item}>{item.toUpperCase()}</option>
              ))}
            </select>
          </div>
        </div>

        <p className="text-xs font-black uppercase tracking-widest text-slate-400">
          Showing {filteredNotices.length} of {sortedNotices.length} notices
        </p>

        {isLoading ? (
          <div className="rounded-[32px] border border-slate-200 bg-white dark:bg-slate-900 px-6 py-8 text-sm font-semibold text-slate-500">
            Loading notices...
          </div>
        ) : filteredNotices.length === 0 ? (
          <div className="rounded-[32px] border border-slate-200 bg-white dark:bg-slate-900 px-6 py-8 text-sm font-semibold text-slate-500">
            No notices found for the selected date.
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filteredNotices.map((notice) => (
              <article
                key={notice.id}
                onClick={() => onOpenNotice(notice.id)}
                className="rounded-[28px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-premium cursor-pointer hover:-translate-y-0.5 transition-all"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{notice.notice_date}</p>
                    <h4 className="mt-2 text-xl font-black tracking-tight text-slate-900 dark:text-white">{notice.title}</h4>
                    <span className={`mt-2 inline-flex px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${priorityBadgeClassMap[notice.priority]}`}>
                      {notice.priority}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      void deleteNotice(notice.id);
                    }}
                    disabled={deletingId === notice.id}
                    className="px-3 py-2 rounded-xl bg-rose-50 text-rose-700 text-xs font-black uppercase tracking-widest disabled:opacity-60"
                  >
                    {deletingId === notice.id ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
                <p className="mt-4 text-xs font-black uppercase tracking-widest text-brand-500">Click to view full announcement</p>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
