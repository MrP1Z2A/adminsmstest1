
import React from 'react';
import { ArrowLeft, Calendar, Bell, Share2, Printer } from 'lucide-react';

interface NoticeDetailProps {
  notice: {
    title: string;
    content: string;
    date: string;
  };
  onBack: () => void;
}

const NoticeDetail: React.FC<NoticeDetailProps> = ({ notice, onBack }) => {
  return (
    <div className="animate-fadeIn max-w-4xl mx-auto space-y-8 pb-20">
      {/* Navigation & Actions */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="group flex items-center gap-2 text-slate-500 hover:text-brand-600 font-bold transition-all active:scale-95"
        >
          <div className="p-2 bg-white rounded-xl border border-slate-100 group-hover:border-emerald-100 group-hover:bg-emerald-50 transition-all">
            <ArrowLeft className="w-5 h-5" />
          </div>
          <span className="text-sm uppercase tracking-widest">Back to Dashboard</span>
        </button>

        <div className="flex gap-2">
          <button className="p-3 bg-white border border-slate-100 rounded-2xl text-slate-400 hover:text-emerald-600 transition-all shadow-sm">
            <Printer className="w-5 h-5" />
          </button>
          <button className="p-3 bg-white border border-slate-100 rounded-2xl text-slate-400 hover:text-emerald-600 transition-all shadow-sm">
            <Share2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Content Card */}
      <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 overflow-hidden">
        <div className="h-32 bg-gradient-to-r from-emerald-900 to-emerald-700 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-20 -mt-20 blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-full p-8 flex items-center gap-4">
            <div className="p-4 bg-white/10 backdrop-blur-md rounded-2xl border border-white/10 text-white">
              <Bell className="w-8 h-8" />
            </div>
            <div>
              <p className="text-emerald-300 text-[10px] font-black uppercase tracking-[0.3em]">Official Announcement</p>
              <h1 className="text-white text-3xl font-black tracking-tight uppercase leading-none mt-1">Institutional Bulletin</h1>
            </div>
          </div>
        </div>

        <div className="p-10 md:p-14 space-y-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-slate-50 pb-10">
            <h2 className="text-3xl font-black text-slate-900 tracking-tight leading-tight flex-1">
              {notice.title}
            </h2>
            <div className="flex items-center gap-3 shrink-0">
              <div className="p-3 bg-brand-50 rounded-2xl text-brand-600 border border-brand-100">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Issued Date</p>
                <p className="text-sm font-black text-slate-800">{notice.date}</p>
              </div>
            </div>
          </div>

          <div className="prose prose-slate max-w-none">
            <div className="text-slate-600 text-lg leading-relaxed font-medium whitespace-pre-wrap">
              {notice.content}
            </div>
          </div>

          {/* Verification Badge */}
          <div className="pt-10 border-t border-slate-50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center text-brand-600 border-2 border-white shadow-sm">
                <span className="font-black text-xs">A</span>
              </div>
              <div>
                <p className="text-xs font-black text-slate-900 leading-none">Administration Office</p>
                <p className="text-[10px] text-brand-600 font-bold uppercase tracking-widest mt-1">Verified Bulletin</p>
              </div>
            </div>
            <div className="bg-slate-50 px-5 py-2.5 rounded-xl border border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Ref: {Math.random().toString(36).substr(2, 9).toUpperCase()}
            </div>
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="flex flex-col md:flex-row md:items-center justify-center gap-4 text-center">
        <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em]">EduParent Portal © 2024</p>
        <span className="hidden md:block w-1.5 h-1.5 bg-slate-200 rounded-full"></span>
        <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em]">Institutional Integrity System</p>
      </div>
    </div>
  );
};

export default NoticeDetail;
