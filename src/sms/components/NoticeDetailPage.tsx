import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient';
import PdfViewer from './Modals/PdfViewer';

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
  medium: 'bg-brand-100 text-brand-700',
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
  const [confirmDialog, setConfirmDialog] = useState<{
    message: string;
    onConfirm: () => void;
  } | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

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
        .maybeSingle();

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

  const openAttachment = async () => {
    if (!notice?.file_path) return;

    setIsDownloading(true);
    setError(null);

    const path = extractStoragePath(notice.file_path);
    if (!path) {
      setIsDownloading(false);
      setError('Invalid notice file path.');
      return;
    }

    const { data: urlData } = supabase.storage
      .from(NOTICE_FILES_BUCKET)
      .getPublicUrl(path);

    setIsDownloading(false);

    if (urlData?.publicUrl) {
      setPreviewUrl(urlData.publicUrl);
    } else {
      setError('Failed to generate preview URL.');
    }
  };

  const deleteNotice = () => {
    if (!notice) return;
    setConfirmDialog({
      message: 'Delete this notice? This action is irreversible.',
      onConfirm: async () => {
        setConfirmDialog(null);
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
      }
    });
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
          {status && <p className="text-sm font-semibold text-brand-700 bg-brand-50 rounded-2xl px-4 py-3">{status}</p>}
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
                onClick={() => void openAttachment()}
                disabled={isDownloading}
                className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-black uppercase tracking-widest text-slate-700 dark:text-slate-200 disabled:opacity-60"
              >
                {isDownloading ? 'Opening...' : `View ${notice.file_name || 'Attachment'}`}
              </button>
            </div>
          )}
        </article>
      ) : (
        <div className="rounded-[32px] border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-8 text-center text-sm font-semibold text-slate-500">
          Notice not found.
        </div>
      )}
      {confirmDialog && (
        <div className="fixed inset-0 z-[120] bg-slate-950/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-[32px] border border-slate-200 dark:border-slate-700 shadow-2xl p-8 space-y-6 text-center">
            <div className="w-16 h-16 bg-rose-500/10 text-rose-500 rounded-2xl flex items-center justify-center text-2xl mx-auto">
              <i className="fas fa-trash-can animate-bounce"></i>
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-black tracking-tight text-slate-900 dark:text-white">Confirm Deletion</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed max-w-[280px] mx-auto">{confirmDialog.message}</p>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setConfirmDialog(null)}
                className="flex-1 px-4 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDialog.onConfirm}
                className="flex-1 px-4 py-3 rounded-2xl bg-rose-500 text-white font-bold text-xs uppercase tracking-widest shadow-lg shadow-rose-500/20 hover:bg-rose-600 active:scale-95 transition-all"
              >
                Delete Notice
              </button>
            </div>
          </div>
        </div>
      )}

      {previewUrl && (
        <PdfViewer
          url={previewUrl}
          title={notice?.title || 'Notice Attachment'}
          onClose={() => setPreviewUrl(null)}
        />
      )}
    </div>
  );
}
