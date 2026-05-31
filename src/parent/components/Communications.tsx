import React, { useEffect, useState } from 'react';
import { fetchEvents, fetchStudentActivities, fetchParentAnnouncements, fetchLiveIntel } from '../services/smsService';
import { Calendar, Tag, ExternalLink, ChevronRight, Bell, Loader2 } from 'lucide-react';

interface CommunicationsProps {
  schoolId?: string;
}

const Communications: React.FC<CommunicationsProps> = ({ schoolId }) => {
  const [events, setEvents] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [intel, setIntel] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      if (!schoolId) return;
      setIsLoading(true);
      try {
        const [evs, acts, anns, intels] = await Promise.all([
          fetchEvents(schoolId),
          fetchStudentActivities(schoolId),
          fetchParentAnnouncements(schoolId),
          fetchLiveIntel(schoolId)
        ]);
        setEvents(evs);
        setActivities(acts);
        setAnnouncements(anns);
        setIntel(intels);
      } catch (err) {
        console.error('Failed to load communications data:', err);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, [schoolId]);

  if (isLoading) {
    return (
      <div className="h-96 flex flex-col items-center justify-center gap-4 text-brand-600">
        <Loader2 className="w-12 h-12 animate-spin" />
        <p className="text-xs font-black uppercase tracking-[0.2em]">Synchronizing Communications...</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 animate-fadeIn pb-20">
      {/* Left Column: Activities & Announcements */}
      <div className="lg:col-span-2 space-y-12">
        {/* Student Activities & Programs */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-black text-slate-900 flex items-center gap-3 uppercase tracking-tighter">
              <Tag className="w-6 h-6 text-brand-600" /> Student Activities & Clubs
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {activities.length > 0 ? activities.map(act => (
              <div key={act.id} className="group relative rounded-[2.5rem] overflow-hidden aspect-[16/9] shadow-xl border-4 border-white bg-slate-900">
                {act.attachment_url ? (
                  <img src={act.attachment_url} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 opacity-70" alt={act.name} />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-emerald-900 to-slate-900 flex items-center justify-center">
                    <Tag className="w-20 h-20 text-brand-800/30" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-emerald-950/90 via-emerald-900/20 to-transparent flex flex-col justify-end p-8">
                  <span className="text-brand-400 font-black uppercase tracking-[0.2em] mb-3 text-[10px] bg-brand-900/40 w-fit px-3 py-1 rounded-lg backdrop-blur-md">{act.activity_type}</span>
                  <h3 className="text-white text-2xl font-black mb-4 leading-tight max-w-xs">{act.name}</h3>
                  <p className="text-brand-100/60 text-xs font-medium mb-6 line-clamp-2">{act.description}</p>
                  {act.attachment_url && (
                    <a href={act.attachment_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-white font-black text-xs uppercase tracking-widest hover:text-brand-400 transition-colors w-fit group/link">
                      Detailed Dossier <ExternalLink className="w-4 h-4 group-hover/link:translate-x-1 group-hover/link:-translate-y-1 transition-transform" />
                    </a>
                  )}
                </div>
              </div>
            )) : (
              <div className="col-span-2 py-12 text-center bg-white rounded-[2.5rem] border border-dashed border-slate-200">
                <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">No active programs recorded</p>
              </div>
            )}
          </div>
        </section>

        {/* Announcements Timeline */}
        <section className="space-y-4">
          <h2 className="text-xl font-black text-slate-900 flex items-center gap-3 mb-8 uppercase tracking-tighter">
            <Calendar className="w-6 h-6 text-brand-600" /> Announcements For Parent
          </h2>
          <div className="space-y-4">
            {announcements.length > 0 ? announcements.map(ann => (
              <div key={ann.id} className="bg-white p-6 rounded-3xl border border-slate-100 flex gap-6 hover:shadow-xl hover:border-emerald-100 transition-all group cursor-pointer">
                <div className="flex flex-col items-center justify-center bg-brand-50 border border-brand-100 rounded-2xl px-5 py-4 h-fit shrink-0 group-hover:bg-brand-600 group-hover:border-brand-600 transition-colors">
                  <span className="text-brand-800 text-[10px] font-black uppercase tracking-widest group-hover:text-brand-100">{new Date(ann.created_at).toLocaleString('default', { month: 'short' })}</span>
                  <span className="text-brand-600 text-3xl font-black group-hover:text-white">{new Date(ann.created_at).getDate()}</span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className={`text-[10px] font-black px-3 py-1 rounded-lg uppercase tracking-widest ${
                      ann.importance === 'Urgent' ? 'bg-rose-100 text-rose-700' :
                        ann.importance === 'High' ? 'bg-amber-100 text-amber-700' :
                          'bg-brand-100 text-brand-700'
                    }`}>
                      {ann.importance}
                    </span>
                    <span className="text-slate-200">/</span>
                    <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">{new Date(ann.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <h3 className="text-lg font-black text-slate-900 group-hover:text-emerald-800 transition-colors tracking-tight">{ann.title}</h3>
                  <p className="text-slate-500 text-sm mt-2 font-medium leading-relaxed">{ann.message}</p>
                  {ann.attachment_url && (
                    <a href={ann.attachment_url} target="_blank" rel="noopener noreferrer" className="mt-4 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-brand-600 hover:underline">
                      <ExternalLink className="w-3 h-3" /> View Attachment
                    </a>
                  )}
                </div>
              </div>
            )) : (
              <div className="py-20 text-center bg-white rounded-3xl border border-dashed border-slate-200">
                <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">No notifications dispatch recorded</p>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Right Column: Active Intel Sidebar */}
      <div className="lg:col-span-1">
        <div className="bg-emerald-950 rounded-[2.5rem] p-8 text-white sticky top-24 shadow-2xl shadow-emerald-900/20 relative overflow-hidden min-h-[500px]">
          <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500/20"></div>
          <div className="flex items-center gap-4 mb-10">
            <div className="bg-emerald-500 p-3 rounded-2xl shadow-lg shadow-emerald-500/20">
              <Bell className="w-6 h-6 text-white animate-ring" />
            </div>
            <div>
              <h2 className="text-lg font-black uppercase tracking-tight">Active Intel</h2>
              <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Live Updates</p>
            </div>
          </div>

          <div className="space-y-8 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
            {intel.length > 0 ? intel.map(item => (
              <div key={item.id} className="space-y-3 pb-8 border-b border-white/5 relative group/item last:border-0">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] text-emerald-400 font-black uppercase tracking-widest bg-emerald-900/50 px-2 py-0.5 rounded-md w-fit">
                    {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                  <div className={`w-1.5 h-1.5 rounded-full animate-pulse shadow-sm ${
                    item.severity === 'Critical' ? 'bg-rose-500 shadow-rose-500' :
                      item.severity === 'Warning' ? 'bg-amber-500 shadow-amber-500' :
                        'bg-emerald-500 shadow-emerald-500'
                  }`}></div>
                </div>
                <h4 className="font-black text-base tracking-tight group-hover/item:text-emerald-400 transition-colors uppercase text-xs">{item.event_type}</h4>
                <p className="text-emerald-100/60 text-xs font-medium leading-relaxed">{item.details?.log || 'Log recorded'}</p>
                {item.attachment_url && (
                  <div className="space-y-3">
                    {/\.(jpg|jpeg|png|gif|webp|svg)$/i.test(item.attachment_url) && (
                      <div className="rounded-2xl overflow-hidden border border-white/5 shadow-lg group-hover/item:border-emerald-500/30 transition-colors">
                        <img
                          src={item.attachment_url}
                          className="w-full h-auto object-cover opacity-80 group-hover/item:opacity-100 transition-opacity duration-500"
                          alt="Intel Preview"
                        />
                      </div>
                    )}
                    <a href={item.attachment_url} target="_blank" rel="noopener noreferrer" className="text-[9px] font-black uppercase tracking-widest text-emerald-500 hover:text-white transition-colors flex items-center gap-2">
                      <i className={`fas ${/\.(jpg|jpeg|png|gif|webp|svg)$/i.test(item.attachment_url) ? 'fa-file-image' : 'fa-link'}`}></i> Secondary Intel View
                    </a>
                  </div>
                )}
              </div>
            )) : (
              <div className="py-20 text-center opacity-30">
                <p className="text-[10px] font-bold uppercase tracking-widest">Awaiting dispatch...</p>
              </div>
            )}
          </div>

          {intel.length > 0 && (
            <button className="mt-10 w-full py-4 bg-emerald-900/50 text-emerald-100 font-black rounded-2xl text-[10px] uppercase tracking-[0.2em] border border-white/5 hover:bg-emerald-900 transition-all hover:border-emerald-500/30 active:scale-95 shadow-lg">
              Historical Log
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Communications;
