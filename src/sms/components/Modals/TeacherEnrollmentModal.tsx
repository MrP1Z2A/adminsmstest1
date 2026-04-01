import React from 'react';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface TeacherEnrollmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  enrollData: {
    name: string;
    email: string;
    phone: string;
    address: string;
    avatarFile?: File | null;
  };
  setEnrollData: (data: any) => void;
  onSubmit: () => void;
}

const TeacherEnrollmentModal: React.FC<TeacherEnrollmentModalProps> = ({
  isOpen,
  onClose,
  enrollData,
  setEnrollData,
  onSubmit,
}) => {
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (enrollData.avatarFile) {
      const url = URL.createObjectURL(enrollData.avatarFile);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setPreviewUrl(null);
    }
  }, [enrollData.avatarFile]);

  if (!isOpen) return null;

  const isTeacherEmailValid = !enrollData.email || EMAIL_PATTERN.test(enrollData.email.trim());

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-xl animate-in fade-in duration-300">
      <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[28px] sm:rounded-[40px] lg:rounded-[56px] shadow-2xl overflow-y-auto border border-slate-100 dark:border-slate-800 animate-in zoom-in-95 duration-300">
        <div className="p-6 sm:p-8 lg:p-12 border-b border-slate-50 dark:border-slate-800 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-2xl sm:text-3xl font-black tracking-tighter">Initialize Teacher Node</h3>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-2">Faculty Identity Registration</p>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-400 flex items-center justify-center"
            title="Close"
          >
            <i className="fas fa-times"></i>
          </button>
        </div>

        <div className="p-6 sm:p-8 lg:p-12 space-y-6 sm:space-y-8">
          {/* Profile Photo Upload */}
          <div className="flex flex-col items-center gap-6 pb-6 border-b border-slate-50 dark:border-slate-800">
            <div className="relative group">
              <div className="w-32 h-32 rounded-[40px] bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden border-2 border-dashed border-slate-200 dark:border-slate-700 group-hover:border-brand-500 transition-all">
                {previewUrl ? (
                  <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <i className="fas fa-camera text-3xl text-slate-300"></i>
                )}
              </div>
              <input
                type="file"
                id="staff-avatar"
                className="hidden"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) setEnrollData({ ...enrollData, avatarFile: file });
                }}
              />
              <label
                htmlFor="staff-avatar"
                className="absolute -bottom-2 -right-2 w-10 h-10 bg-brand-500 text-white rounded-2xl flex items-center justify-center shadow-lg cursor-pointer hover:bg-brand-600 active:scale-95 transition-all"
              >
                <i className="fas fa-plus text-xs"></i>
              </label>
            </div>
            <div className="text-center">
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Profile Identity</p>
              <p className="text-[9px] font-bold text-slate-500 mt-1 uppercase">Recommended: Square 512x512</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-3">Full Legal Name</label>
              <input
                type="text"
                placeholder="Enter name..."
                className="w-full bg-slate-50 dark:bg-slate-800 p-5 rounded-2xl outline-none border-2 border-transparent focus:border-brand-500 font-bold transition-all text-sm"
                value={enrollData.name}
                onChange={(e) => setEnrollData({ ...enrollData, name: e.target.value })}
              />
            </div>

            <div>
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-3">Network Email</label>
              <input
                type="email"
                placeholder="staff@iem.io"
                className={`w-full bg-slate-50 dark:bg-slate-800 p-5 rounded-2xl outline-none border-2 font-bold transition-all text-sm ${isTeacherEmailValid ? 'border-transparent focus:border-brand-500' : 'border-rose-400 focus:border-rose-500'}`}
                value={enrollData.email}
                onChange={(e) => setEnrollData({ ...enrollData, email: e.target.value })}
              />
            </div>

            <div>
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-3">Phone Line</label>
              <input
                type="tel"
                placeholder="+1 234 567 890"
                className="w-full bg-slate-50 dark:bg-slate-800 p-5 rounded-2xl outline-none border-2 border-transparent focus:border-brand-500 font-bold transition-all text-sm"
                value={enrollData.phone}
                onChange={(e) => setEnrollData({ ...enrollData, phone: e.target.value })}
              />
            </div>

            <div>
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-3">Residential Address</label>
              <input
                type="text"
                placeholder="City, Country"
                className="w-full bg-slate-50 dark:bg-slate-800 p-5 rounded-2xl outline-none border-2 border-transparent focus:border-brand-500 font-bold transition-all text-sm"
                value={enrollData.address}
                onChange={(e) => setEnrollData({ ...enrollData, address: e.target.value })}
              />
            </div>
          </div>

          <div className="p-6 bg-brand-50 dark:bg-brand-500/10 rounded-3xl border border-brand-100 dark:border-brand-500/20">
            <p className="text-[10px] text-brand-600 dark:text-brand-400 font-bold leading-relaxed">
              <i className="fas fa-info-circle mr-2"></i>
              A secure node will be generated. Identity credentials will be issued upon successful initialization.
            </p>
          </div>
        </div>

        <div className="p-6 sm:p-8 lg:p-12 bg-slate-50 dark:bg-slate-900/50 flex flex-col-reverse sm:flex-row gap-3 sm:gap-4">
          <button
            onClick={onSubmit}
            className="flex-1 py-6 bg-brand-500 text-white font-black rounded-[32px] text-sm uppercase tracking-widest shadow-xl shadow-brand-500/20 active:scale-95 transition-all"
          >
            Initialize Node
          </button>
        </div>
      </div>
    </div>
  );
};

export default TeacherEnrollmentModal;
