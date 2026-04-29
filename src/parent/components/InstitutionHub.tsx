import React, { useEffect, useState } from 'react';
import { School, MapPin, Phone, Globe, MessageSquare, Share2, Send, Mail, CheckCircle, AlertCircle, Loader } from 'lucide-react';
import { supabase } from '../../sms/supabaseClient';
import { isUnicornSchoolLogo } from '../../shared/branding/unicornSchoolLogo';

interface InstitutionHubProps {
  schoolId?: string;
  parentEmail?: string;
}

const DEPARTMENTS = ['Academic Affairs', 'Finance/Billing', 'Sports & Activities', 'Admissions', 'Technical Support'];
const URGENCY_LEVELS = ['Normal Inquiry', 'Action Required', 'Urgent Attention'];

const InstitutionHub: React.FC<InstitutionHubProps> = ({ schoolId, parentEmail }) => {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Inquiry form state
  const [department, setDepartment] = useState(DEPARTMENTS[0]);
  const [urgency, setUrgency] = useState(URGENCY_LEVELS[0]);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendSuccess, setSendSuccess] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  useEffect(() => {
    const fetchInfo = async () => {
      if (!schoolId) {
        setIsLoading(false);
        return;
      }
      try {
        const { data: school } = await supabase
          .from('schools')
          .select('*')
          .eq('id', schoolId)
          .single();
        if (school) setData(school);
      } catch (err) {
        console.error('Error fetching school info:', err);
      } finally {
        setIsLoading(false);
      }
    };
    void fetchInfo();
  }, [schoolId]);

  const handleInquirySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) {
      setSendError('Please fill in both the subject and message fields.');
      return;
    }
    if (!schoolId) {
      setSendError('School information is missing. Please log out and log back in.');
      return;
    }

    setIsSending(true);
    setSendError(null);
    setSendSuccess(false);

    try {
      const { error } = await supabase
        .from('parent_inquiries')
        .insert({
          school_id: schoolId,
          parent_email: parentEmail || 'unknown',
          department,
          urgency,
          subject: subject.trim(),
          message: message.trim(),
        });

      if (error) throw error;

      setSendSuccess(true);
      setSubject('');
      setMessage('');
      setDepartment(DEPARTMENTS[0]);
      setUrgency(URGENCY_LEVELS[0]);
    } catch (err: any) {
      console.error('Inquiry send error:', err);
      setSendError(err.message || 'Failed to send inquiry. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  const school = data || {
    name: 'Institution Profile',
    about: 'Information about your institution will appear here.',
    phone: 'Not provided',
    email: 'Not provided',
    address: 'Not provided'
  };
  const isUnicornLogo = isUnicornSchoolLogo(school.logo_url);

  return (
    <div className="space-y-6 animate-fadeIn pb-20">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* School Profile */}
        <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden">
          {school.banner_url ? (
            <img src={school.banner_url} className="w-full h-48 object-cover opacity-90 transition-opacity hover:opacity-100" alt="School Campus" />
          ) : (
            <div className="w-full h-48 bg-slate-100 flex items-center justify-center text-slate-300">
               <School className="w-12 h-12" />
            </div>
          )}
          <div className="p-8">
            <div className="flex items-center gap-5 mb-8">
              {school.logo_url ? (
                <div className={`${isUnicornLogo ? 'w-28 h-16 rounded-[1.35rem] bg-[#121A33] p-2.5' : 'w-16 h-16 rounded-2xl'} overflow-hidden border-2 border-emerald-600 shadow-md flex-shrink-0`}>
                   <img src={school.logo_url} alt="Logo" className={`w-full h-full ${isUnicornLogo ? 'object-contain' : 'object-cover'}`} />
                </div>
              ) : (
                <div className="bg-emerald-600 p-4 rounded-3xl text-white shadow-lg shadow-emerald-200">
                  <School className="w-8 h-8" />
                </div>
              )}
              <div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tighter uppercase">{school.name}</h2>
                <p className="text-slate-500 flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest mt-1">
                  <MapPin className="w-4 h-4 text-emerald-600" /> {school.address || 'Campus Location'}
                </p>
              </div>
            </div>
            
            <p className="text-slate-600 leading-relaxed mb-8 font-medium">
              {school.about || "Your school has not yet provided a description. Please contact the administration for more information."}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-center gap-4 p-5 bg-emerald-50/50 border border-emerald-100 rounded-2xl group hover:bg-emerald-50 transition-colors">
                <div className="p-2 bg-white rounded-lg shadow-sm text-emerald-600">
                  <Phone className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] text-emerald-800 font-bold uppercase tracking-widest">Contact Number</p>
                  <p className="text-sm font-black text-slate-900">{school.phone || 'N/A'}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 p-5 bg-emerald-50/50 border border-emerald-100 rounded-2xl group hover:bg-emerald-50 transition-colors">
                <div className="p-2 bg-white rounded-lg shadow-sm text-emerald-600">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] text-emerald-800 font-bold uppercase tracking-widest">Email Address</p>
                  <p className="text-sm font-black text-slate-900">{school.email || 'N/A'}</p>
                </div>
              </div>
            </div>

            <div className="mt-10">
              <h3 className="font-bold text-slate-900 mb-6 flex items-center gap-2 uppercase tracking-tight">
                <Share2 className="w-5 h-5 text-emerald-600" /> Digital Community
              </h3>
              <div className="flex gap-4">
                <button className="p-4 bg-slate-50 text-slate-400 rounded-2xl hover:bg-emerald-600 hover:text-white transition-all hover:scale-110 active:scale-95 shadow-sm"><Share2 className="w-5 h-5" /></button>
                <button className="p-4 bg-slate-50 text-slate-400 rounded-2xl hover:bg-emerald-600 hover:text-white transition-all hover:scale-110 active:scale-95 shadow-sm"><Globe className="w-5 h-5" /></button>
                <button className="p-4 bg-slate-50 text-slate-400 rounded-2xl hover:bg-emerald-600 hover:text-white transition-all hover:scale-110 active:scale-95 shadow-sm"><MessageSquare className="w-5 h-5" /></button>
                <button className="p-4 bg-slate-50 text-slate-400 rounded-2xl hover:bg-emerald-600 hover:text-white transition-all hover:scale-110 active:scale-95 shadow-sm"><Send className="w-5 h-5" /></button>
              </div>
            </div>
          </div>
        </div>

        {/* Contact School */}
        <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 p-8">
          <div className="mb-8">
            <h2 className="text-2xl font-black text-slate-900 flex items-center gap-3 uppercase tracking-tighter">
              <MessageSquare className="w-8 h-8 text-emerald-600" />
              Parent Inquiry
            </h2>
            <p className="text-slate-500 mt-2 font-medium">Have questions? Send a direct message to the administration.</p>
          </div>

          {/* Success Banner */}
          {sendSuccess && (
            <div className="flex items-start gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl animate-fadeIn">
              <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-black text-emerald-800">Inquiry Dispatched!</p>
                <p className="text-xs text-emerald-700 mt-0.5">Your message has been sent to the school administration. They will follow up with you shortly.</p>
              </div>
            </div>
          )}

          {/* Error Banner */}
          {sendError && (
            <div className="flex items-start gap-3 p-4 bg-rose-50 border border-rose-200 rounded-2xl animate-fadeIn">
              <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
              <p className="text-sm font-bold text-rose-700">{sendError}</p>
            </div>
          )}

          <form onSubmit={handleInquirySubmit} className="space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Department</label>
                <select
                  value={department}
                  onChange={e => setDepartment(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 focus:bg-white transition-all appearance-none cursor-pointer"
                >
                  {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Urgency</label>
                <select
                  value={urgency}
                  onChange={e => setUrgency(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 focus:bg-white transition-all appearance-none cursor-pointer"
                >
                  {URGENCY_LEVELS.map(u => <option key={u}>{u}</option>)}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Subject Header</label>
              <input
                type="text"
                value={subject}
                onChange={e => { setSubject(e.target.value); setSendSuccess(false); setSendError(null); }}
                placeholder="Brief summary of your request"
                className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 focus:bg-white transition-all"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Your Message</label>
              <textarea
                rows={6}
                value={message}
                onChange={e => { setMessage(e.target.value); setSendSuccess(false); setSendError(null); }}
                placeholder="Detailed notes or questions for the staff..."
                className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 focus:bg-white transition-all resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={isSending}
              className="w-full bg-emerald-600 text-white font-black py-5 rounded-2xl flex items-center justify-center gap-3 hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-600/20 group active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isSending ? (
                <><Loader className="w-5 h-5 animate-spin" /> Dispatching...</>
              ) : (
                <><Send className="w-5 h-5 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" /> Dispatch Message</>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default InstitutionHub;
