import React from 'react';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface TeacherEnrollmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  entityLabel?: string;
  enrollData: {
    name: string;
    email: string;
    phone: string;
    address: string;
    date_of_birth: string;
    age: string;
    gender: 'Male' | 'Female';
    nrc: string;
    marital_status: string;
    race: string;
    religion: string;
    salary: string;
    job_position: string;
    educational_background: string;
    avatarFile?: File | null;
    school_id?: string;
  };
  setEnrollData: (data: any) => void;
  onSubmit: () => void;
}

const TeacherEnrollmentModal: React.FC<TeacherEnrollmentModalProps> = ({
  isOpen,
  onClose,
  entityLabel = 'Teacher',
  enrollData,
  setEnrollData,
  onSubmit,
}) => {
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);

  const calculateAge = React.useCallback((value: string) => {
    if (!value) return '';
    const birthDate = new Date(value);
    if (Number.isNaN(birthDate.getTime())) return '';

    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    const dayDiff = today.getDate() - birthDate.getDate();

    if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
      age -= 1;
    }

    return age >= 0 ? String(age) : '';
  }, []);

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
      <div className="bg-white dark:bg-slate-900 w-full max-w-5xl rounded-[24px] sm:rounded-[32px] lg:rounded-[40px] shadow-2xl overflow-y-auto border border-slate-100 dark:border-slate-800 animate-in zoom-in-95 duration-300 max-h-[92vh]">
        <div className="p-5 sm:p-6 lg:p-10 border-b border-slate-50 dark:border-slate-800 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-xl sm:text-2xl font-black tracking-tighter">{entityLabel} Registration</h3>
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-1">{entityLabel} Identity Registration</p>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-400 flex items-center justify-center"
            title="Close"
          >
            <i className="fas fa-times"></i>
          </button>
        </div>

        <div className="p-5 sm:p-6 lg:p-10 space-y-4 sm:space-y-6">
          {/* Profile Photo Upload */}
          <div className="flex flex-col items-center gap-4 pb-4 border-b border-slate-50 dark:border-slate-800">
            <div className="relative group">
              <div className="w-24 h-24 rounded-[32px] bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden border-2 border-dashed border-slate-200 dark:border-slate-700 group-hover:border-brand-500 transition-all">
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

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            <div>
              <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest block mb-2">Full Legal Name</label>
              <input
                type="text"
                placeholder="Enter name..."
                className="w-full bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl outline-none border-2 border-transparent focus:border-brand-500 font-bold transition-all text-xs"
                value={enrollData.name}
                onChange={(e) => setEnrollData({ ...enrollData, name: e.target.value })}
              />
            </div>

            <div>
              <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest block mb-2">Network Email</label>
              <input
                type="email"
                placeholder="staff@iem.io"
                className={`w-full bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl outline-none border-2 font-bold transition-all text-xs ${isTeacherEmailValid ? 'border-transparent focus:border-brand-500' : 'border-rose-400 focus:border-rose-500'}`}
                value={enrollData.email}
                onChange={(e) => setEnrollData({ ...enrollData, email: e.target.value })}
              />
            </div>

            <div>
              <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest block mb-2">Phone Line</label>
              <input
                type="tel"
                placeholder="+1 234 567 890"
                className="w-full bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl outline-none border-2 border-transparent focus:border-brand-500 font-bold transition-all text-xs"
                value={enrollData.phone}
                onChange={(e) => setEnrollData({ ...enrollData, phone: e.target.value })}
              />
            </div>

            <div>
              <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest block mb-2">Birth Date</label>
              <input
                type="date"
                className="w-full bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl outline-none border-2 border-transparent focus:border-brand-500 font-bold transition-all text-xs"
                value={enrollData.date_of_birth}
                onChange={(e) => setEnrollData({
                  ...enrollData,
                  date_of_birth: e.target.value,
                  age: calculateAge(e.target.value),
                })}
              />
            </div>

            <div>
              <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest block mb-2">Age</label>
              <input
                type="number"
                min="0"
                placeholder="Age"
                className="w-full bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl outline-none border-2 border-transparent focus:border-brand-500 font-bold transition-all text-xs"
                value={enrollData.age}
                onChange={(e) => setEnrollData({ ...enrollData, age: e.target.value })}
              />
            </div>

            <div>
              <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest block mb-2">Gender</label>
              <select
                className="w-full bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl outline-none border-2 border-transparent focus:border-brand-500 font-bold transition-all text-xs"
                value={enrollData.gender}
                onChange={(e) => setEnrollData({ ...enrollData, gender: e.target.value })}
              >
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </div>

            <div>
              <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest block mb-2">NRC</label>
              <input
                type="text"
                placeholder="National registration card"
                className="w-full bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl outline-none border-2 border-transparent focus:border-brand-500 font-bold transition-all text-xs"
                value={enrollData.nrc}
                onChange={(e) => setEnrollData({ ...enrollData, nrc: e.target.value })}
              />
            </div>

            <div>
              <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest block mb-2">Marital Status</label>
              <select
                className="w-full bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl outline-none border-2 border-transparent focus:border-brand-500 font-bold transition-all text-xs"
                value={enrollData.marital_status}
                onChange={(e) => setEnrollData({ ...enrollData, marital_status: e.target.value })}
              >
                <option value="">Select status</option>
                <option value="Single">Single</option>
                <option value="Married">Married</option>
                <option value="Divorced">Divorced</option>
                <option value="Widowed">Widowed</option>
                <option value="Separated">Separated</option>
              </select>
            </div>

            <div>
              <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest block mb-2">Race</label>
              <input
                type="text"
                placeholder="Enter race"
                className="w-full bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl outline-none border-2 border-transparent focus:border-brand-500 font-bold transition-all text-xs"
                value={enrollData.race}
                onChange={(e) => setEnrollData({ ...enrollData, race: e.target.value })}
              />
            </div>

            <div>
              <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest block mb-2">Religion</label>
              <input
                type="text"
                placeholder="Enter religion"
                className="w-full bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl outline-none border-2 border-transparent focus:border-brand-500 font-bold transition-all text-xs"
                value={enrollData.religion}
                onChange={(e) => setEnrollData({ ...enrollData, religion: e.target.value })}
              />
            </div>

            <div>
              <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest block mb-2">Salary</label>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="Monthly salary"
                className="w-full bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl outline-none border-2 border-transparent focus:border-brand-500 font-bold transition-all text-xs"
                value={enrollData.salary}
                onChange={(e) => setEnrollData({ ...enrollData, salary: e.target.value })}
              />
            </div>

            <div>
              <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest block mb-2">Job Position</label>
              <input
                type="text"
                placeholder="Enter job position"
                className="w-full bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl outline-none border-2 border-transparent focus:border-brand-500 font-bold transition-all text-xs"
                value={enrollData.job_position}
                onChange={(e) => setEnrollData({ ...enrollData, job_position: e.target.value })}
              />
            </div>

            <div className="xl:col-span-3">
              <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest block mb-2">Educational Background</label>
              <textarea
                rows={3}
                placeholder="Degrees, certifications, majors, institutions..."
                className="w-full bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl outline-none border-2 border-transparent focus:border-brand-500 font-bold transition-all text-xs resize-none"
                value={enrollData.educational_background}
                onChange={(e) => setEnrollData({ ...enrollData, educational_background: e.target.value })}
              />
            </div>

            <div className="xl:col-span-3">
              <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest block mb-2">Address</label>
              <textarea
                rows={2}
                placeholder="Residential address"
                className="w-full bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl outline-none border-2 border-transparent focus:border-brand-500 font-bold transition-all text-xs resize-none"
                value={enrollData.address}
                onChange={(e) => setEnrollData({ ...enrollData, address: e.target.value })}
              />
            </div>

            <div className="sm:col-span-2 xl:col-span-3">
              <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest block mb-2">School Staff/Teacher ID (Optional)</label>
              <input
                type="text"
                placeholder="e.g. STAFF-2024-001"
                className="w-full bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl outline-none border-2 border-transparent focus:border-brand-500 font-bold transition-all text-[10px]"
                value={enrollData.school_id || ''}
                onChange={(e) => setEnrollData({ ...enrollData, school_id: e.target.value })}
              />
            </div>
          </div>

          <div className="p-3 bg-brand-50 dark:bg-brand-500/10 rounded-2xl border border-brand-100 dark:border-brand-500/20">
            <p className="text-[9px] text-brand-600 dark:text-brand-400 font-bold leading-relaxed">
              <i className="fas fa-info-circle mr-2"></i>
              A secure registration will be generated. Identity credentials will be issued upon successful registration.
            </p>
          </div>
        </div>

        <div className="p-5 sm:p-6 lg:p-10 bg-slate-50 dark:bg-slate-900/50 flex flex-col-reverse sm:flex-row gap-3 sm:gap-4">
          <button
            onClick={onSubmit}
            className="flex-1 py-4 bg-brand-500 text-white font-black rounded-[24px] text-xs uppercase tracking-widest shadow-xl shadow-brand-500/20 active:scale-95 transition-all"
          >
            Registeration
          </button>
        </div>
      </div>
    </div>
  );
};

export default TeacherEnrollmentModal;
