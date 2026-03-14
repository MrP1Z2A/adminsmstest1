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

const NOTICE_FILES_BUCKET = 'notice_files';

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

interface NoticeDetailPageProps {
  noticeId: string | null;
  onBack: () => void;
}

export default function NoticeDetailPage({ noticeId, onBack }: NoticeDetailPageProps) {
  const [notice, setNotice] = useState<NoticeItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const canRenderNotice = useMemo(() => !!noticeId && !!notice, [noticeId, notice]);

  useEffect(() => {
    const loadNotice = async () => {
      if (!noticeId) {
        setNotice(null);
        setIsLoading(false);
        setError('No notice selected.');
        return;
      }

      setIsLoading(true);
      setError(null);
      setStatus(null);

      const { data, error: loadError } = await supabase
        .from('notice_board')
        .select('id, title, message, notice_date, priority, file_path, file_name, created_at')
        .eq('id', noticeId)
        .single();

      if (loadError || !data) {
        setNotice(null);
        setError(loadError?.message || 'Notice not found.');
        setIsLoading(false);
        return;
      }

      setNotice({
        id: String(data.id),
        title: String(data.title || ''),
        message: String(data.message || ''),
        notice_date: String(data.notice_date || ''),
        priority: (['low', 'medium', 'high', 'urgent'].includes(String(data.priority))
          ? data.priority
          : 'medium') as NoticeItem['priority'],
        file_path: data.file_path ? String(data.file_path) : null,
        file_name: data.file_name ? String(data.file_name) : null,
        created_at: String(data.created_at || ''),
      });
      setIsLoading(false);
    };

    void loadNotice();
  }, [noticeId]);

  const downloadAttachment = async () => {
    if (!notice?.file_path) return;

    setIsDownloading(true);
    setError(null);

    const path = extractStoragePath(notice.file_path);
    if (!path) {
      setIsDownloading(false);
      setError('Invalid notice file path.');
      return;
    }

    const { data, error: downloadError } = await supabase.storage
      .from(NOTICE_FILES_BUCKET)
      .download(path);

    setIsDownloading(false);

    if (downloadError || !data) {
      setError(downloadError?.message || 'Failed to download attachment.');
      return;
    }

    const objectUrl = URL.createObjectURL(data);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = notice.file_name || 'notice-attachment';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(objectUrl);
  };

  const deleteNotice = async () => {
    if (!notice) return;
    if (!window.confirm('Delete this notice?')) return;

    setIsDeleting(true);
    setError(null);
    setStatus(null);

    const { error: deleteError } = await supabase
      .from('notice_board')
      .delete()
      .eq('id', notice.id);

    if (deleteError) {
      setIsDeleting(false);
      setError(deleteError.message || 'Failed to delete notice.');
      return;
    }

    if (notice.file_path) {
      const path = extractStoragePath(notice.file_path);
      if (path) {
        await supabase.storage.from(NOTICE_FILES_BUCKET).remove([path]);
      }
    }

    setIsDeleting(false);
    setStatus('Notice deleted.');
    onBack();
  };

  return (
    <div className="space-y-8 pb-20 animate-in fade-in duration-500">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-brand-500 text-white text-xs font-black uppercase tracking-[0.2em] shadow-lg shadow-brand-500/30 ring-2 ring-brand-500/20 hover:bg-brand-600 transition-all"
        >
          <i className="fas fa-arrow-left text-[11px]"></i>
          Back to Notice Board
        </button>
        {canRenderNotice && (
          <button
            type="button"
            onClick={() => void deleteNotice()}
            disabled={isDeleting}
            className="px-3 py-2 rounded-xl bg-rose-50 text-rose-700 text-xs font-black uppercase tracking-widest disabled:opacity-60"
          >
            {isDeleting ? 'Deleting...' : 'Delete Notice'}
          </button>
        )}
      </div>

      {(error || status) && (
        <div className="space-y-2">
          {error && <p className="text-sm font-semibold text-rose-600 bg-rose-50 rounded-2xl px-4 py-3">{error}</p>}
          {status && <p className="text-sm font-semibold text-emerald-700 bg-emerald-50 rounded-2xl px-4 py-3">{status}</p>}
        </div>
      )}

      {isLoading ? (
        <div className="rounded-[32px] border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-8 text-center text-sm font-semibold text-slate-500">
          Loading notice details...
        </div>
      ) : notice ? (
        <article className="rounded-[32px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 sm:p-8 shadow-premium space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest bg-slate-100 text-slate-700">
              {notice.notice_date}
            </span>
            <span className={`inline-flex px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${priorityBadgeClassMap[notice.priority]}`}>
              {notice.priority}
            </span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
            {notice.title}
          </h2>

          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
            {notice.message}
          </p>

          {notice.file_path && (
            <div className="pt-2">
              <button
                type="button"
                onClick={() => void downloadAttachment()}
                disabled={isDownloading}
                className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-black uppercase tracking-widest text-slate-700 dark:text-slate-200 disabled:opacity-60"
              >
                {isDownloading ? 'Downloading...' : `Download ${notice.file_name || 'Attachment'}`}
              </button>
            </div>
          )}
        </article>
      ) : (
        <div className="rounded-[32px] border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-8 text-center text-sm font-semibold text-slate-500">
          Notice not found.
        </div>
      )}
    </div>
  );
}
