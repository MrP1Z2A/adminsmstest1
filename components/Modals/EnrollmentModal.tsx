import React from 'react';
import { Student } from '../../types';

const COUNTRY_CODES = [
  '+1 (US/CA)',
  '+7 (RU)',
  '+20 (EG)',
  '+27 (ZA)',
  '+30 (GR)',
  '+31 (NL)',
  '+32 (BE)',
  '+33 (FR)',
  '+34 (ES)',
  '+39 (IT)',
  '+44 (UK)',
  '+49 (DE)',
  '+52 (MX)',
  '+55 (BR)',
  '+60 (MY)',
  '+61 (AU)',
  '+62 (ID)',
  '+63 (PH)',
  '+64 (NZ)',
  '+65 (SG)',
  '+66 (TH)',
  '+81 (JP)',
  '+82 (KR)',
  '+84 (VN)',
  '+86 (CN)',
  '+91 (IN)',
  '+92 (PK)',
  '+93 (AF)',
  '+94 (LK)',
  '+95 (MM)',
  '+98 (IR)',
  '+211 (SS)',
  '+212 (MA)',
  '+213 (DZ)',
  '+216 (TN)',
  '+218 (LY)',
  '+220 (GM)',
  '+221 (SN)',
  '+222 (MR)',
  '+223 (ML)',
  '+224 (GN)',
  '+225 (CI)',
  '+226 (BF)',
  '+227 (NE)',
  '+228 (TG)',
  '+229 (BJ)',
  '+230 (MU)',
  '+231 (LR)',
  '+232 (SL)',
  '+233 (GH)',
  '+234 (NG)',
  '+235 (TD)',
  '+236 (CF)',
  '+237 (CM)',
  '+238 (CV)',
  '+239 (ST)',
  '+240 (GQ)',
  '+241 (GA)',
  '+242 (CG)',
  '+243 (CD)',
  '+244 (AO)',
  '+251 (ET)',
  '+252 (SO)',
  '+253 (DJ)',
  '+254 (KE)',
  '+255 (TZ)',
  '+256 (UG)',
  '+257 (BI)',
  '+258 (MZ)',
  '+260 (ZM)',
  '+261 (MG)',
  '+262 (RE)',
  '+263 (ZW)',
  '+264 (NA)',
  '+265 (MW)',
  '+266 (LS)',
  '+267 (BW)',
  '+268 (SZ)',
  '+269 (KM)',
  '+351 (PT)',
  '+353 (IE)',
  '+354 (IS)',
  '+356 (MT)',
  '+357 (CY)',
  '+358 (FI)',
  '+359 (BG)',
  '+370 (LT)',
  '+371 (LV)',
  '+372 (EE)',
  '+373 (MD)',
  '+374 (AM)',
  '+375 (BY)',
  '+376 (AD)',
  '+377 (MC)',
  '+378 (SM)',
  '+380 (UA)',
  '+381 (RS)',
  '+382 (ME)',
  '+383 (XK)',
  '+385 (HR)',
  '+386 (SI)',
  '+387 (BA)',
  '+389 (MK)',
  '+420 (CZ)',
  '+421 (SK)',
  '+423 (LI)',
  '+852 (HK)',
  '+853 (MO)',
  '+855 (KH)',
  '+856 (LA)',
  '+880 (BD)',
  '+886 (TW)',
  '+960 (MV)',
  '+961 (LB)',
  '+962 (JO)',
  '+963 (SY)',
  '+964 (IQ)',
  '+965 (KW)',
  '+966 (SA)',
  '+967 (YE)',
  '+968 (OM)',
  '+970 (PS)',
  '+971 (AE)',
  '+972 (IL)',
  '+973 (BH)',
  '+974 (QA)',
  '+975 (BT)',
  '+976 (MN)',
  '+977 (NP)',
  '+992 (TJ)',
  '+993 (TM)',
  '+994 (AZ)',
  '+995 (GE)',
  '+996 (KG)',
  '+998 (UZ)',
];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * EnrollmentModal Component
 * 
 * This modal handles the initial onboarding of a new student node.
 * It captures the student's name and email, and provides feedback about the verification process.
 */

interface EnrollmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  enrollData: {
    name: string;
    email: string;
    type: 'New' | 'Old';
    selectedStudentId: string;
    selectedClassId: string;
    selectedBatchCode: string;
    selectedClassCourseId: string;
    dateOfBirth: string;
    parentName: string;
    parentCountryCode: string;
    parentNumber: string;
    parentEmail: string;
    secondaryParentName: string;
    secondaryParentCountryCode: string;
    secondaryParentNumber: string;
    secondaryParentEmail: string;
  };
  setEnrollData: (data: any) => void;
  studentProfileImage: File | null;
  setStudentProfileImage: (file: File | null) => void;
  students: Student[];
  classes: any[];
  classCourses: Array<{ id: string; name: string; class_id: string }>;
  isClassCoursesLoading: boolean;
  onSubmit: () => void;
}

const EnrollmentModal: React.FC<EnrollmentModalProps> = ({
  isOpen,
  onClose,
  enrollData,
  setEnrollData,
  studentProfileImage,
  setStudentProfileImage,
  students,
  classes,
  classCourses,
  isClassCoursesLoading,
  onSubmit
}) => {
  if (!isOpen) return null;

  const isStudentEmailValid = !enrollData.email || EMAIL_PATTERN.test(enrollData.email.trim());
  const isParentEmailValid = !enrollData.parentEmail || EMAIL_PATTERN.test(enrollData.parentEmail.trim());
  const isSecondaryParentEmailValid = !enrollData.secondaryParentEmail || EMAIL_PATTERN.test(enrollData.secondaryParentEmail.trim());

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-xl animate-in fade-in duration-300">
      <div className="bg-white dark:bg-slate-900 w-full max-w-lg max-h-[90vh] rounded-[28px] sm:rounded-[40px] lg:rounded-[56px] shadow-2xl overflow-y-auto border border-slate-100 dark:border-slate-800 animate-in zoom-in-95 duration-300">
        
        {/* Modal Header */}
        <div className="p-6 sm:p-8 lg:p-12 border-b border-slate-50 dark:border-slate-800 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-2xl sm:text-3xl font-black tracking-tighter">Initialize {enrollData.type} Node</h3>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-2">Cognitive Identity Registration</p>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-400 flex items-center justify-center"
            title="Close"
          >
            <i className="fas fa-times"></i>
          </button>
        </div>

        {/* Form Content */}
        <div className="p-6 sm:p-8 lg:p-12 space-y-6 sm:space-y-8">
          {enrollData.type === 'Old' ? (
            <>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-3">Select Existing Student</label>
                <select
                  className="w-full bg-slate-50 dark:bg-slate-800 p-6 rounded-3xl outline-none border-2 border-transparent focus:border-brand-500 font-bold transition-all"
                  value={enrollData.selectedStudentId}
                  onChange={(e) => setEnrollData({ ...enrollData, selectedStudentId: e.target.value })}
                >
                  <option value="">Choose a student...</option>
                  {students.map(student => (
                    <option key={student.id} value={student.id}>{student.name} ({student.id})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-3">Class</label>
                <select
                  className="w-full bg-slate-50 dark:bg-slate-800 p-6 rounded-3xl outline-none border-2 border-transparent focus:border-brand-500 font-bold transition-all disabled:opacity-60"
                  value={enrollData.selectedBatchCode}
                  onChange={(e) => {
                    const nextClassId = e.target.value;
                    const matchedBatchClass = classes.find(classItem => String(classItem.id) === String(nextClassId));
                    setEnrollData({
                      ...enrollData,
                      selectedBatchCode: nextClassId,
                      selectedClassId: matchedBatchClass ? String(matchedBatchClass.id) : enrollData.selectedClassId,
                      selectedClassCourseId: '',
                    });
                  }}
                >
                  <option value="">Choose a class...</option>
                  {classes.map((classItem) => (
                    <option key={classItem.id} value={classItem.id}>
                      {classItem.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-3">Course</label>
                <select
                  className="w-full bg-slate-50 dark:bg-slate-800 p-6 rounded-3xl outline-none border-2 border-transparent focus:border-brand-500 font-bold transition-all disabled:opacity-60"
                  value={enrollData.selectedClassCourseId}
                  onChange={(e) => setEnrollData({ ...enrollData, selectedClassCourseId: e.target.value })}
                  disabled={!enrollData.selectedClassId || isClassCoursesLoading}
                >
                  <option value="">
                    {!enrollData.selectedBatchCode
                      ? 'Choose batch first...'
                      : isClassCoursesLoading
                        ? 'Loading courses...'
                        : 'Choose a course...'}
                  </option>
                  {classCourses.map((course) => (
                    <option key={course.id} value={course.id}>{course.name}</option>
                  ))}
                </select>
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-3">Full Legal Name</label>
                <input 
                  type="text"
                  placeholder="Enter student name..."
                  className="w-full bg-slate-50 dark:bg-slate-800 p-6 rounded-3xl outline-none border-2 border-transparent focus:border-brand-500 font-bold transition-all"
                  value={enrollData.name}
                  onChange={(e) => setEnrollData({ ...enrollData, name: e.target.value })}
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-3">Network Email (Verification Hub)</label>
                <input 
                  type="email"
                  placeholder="student@iem.io"
                  className={`w-full bg-slate-50 dark:bg-slate-800 p-6 rounded-3xl outline-none border-2 font-bold transition-all ${isStudentEmailValid ? 'border-transparent focus:border-brand-500' : 'border-rose-400 focus:border-rose-500'}`}
                  value={enrollData.email}
                  onChange={(e) => setEnrollData({ ...enrollData, email: e.target.value })}
                />
                {!isStudentEmailValid && <p className="mt-2 text-[11px] font-bold text-rose-500">Enter a valid email format (example@domain.com).</p>}
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-3">Class</label>
                <select
                  className="w-full bg-slate-50 dark:bg-slate-800 p-6 rounded-3xl outline-none border-2 border-transparent focus:border-brand-500 font-bold transition-all"
                  value={enrollData.selectedClassId}
                  onChange={(e) => setEnrollData({ ...enrollData, selectedClassId: e.target.value, selectedClassCourseId: '' })}
                >
                  <option value="">Choose a class...</option>
                  {classes.map((classItem) => (
                    <option key={classItem.id} value={classItem.id}>
                      {classItem.name} ({classItem.class_code || classItem.id})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-3">Class Course</label>
                <select
                  className="w-full bg-slate-50 dark:bg-slate-800 p-6 rounded-3xl outline-none border-2 border-transparent focus:border-brand-500 font-bold transition-all disabled:opacity-60"
                  value={enrollData.selectedClassCourseId}
                  onChange={(e) => setEnrollData({ ...enrollData, selectedClassCourseId: e.target.value })}
                  disabled={!enrollData.selectedClassId || isClassCoursesLoading}
                >
                  <option value="">
                    {!enrollData.selectedClassId
                      ? 'Choose class first...'
                      : isClassCoursesLoading
                        ? 'Loading class courses...'
                        : 'Choose a class course...'}
                  </option>
                  {classCourses.map((course) => (
                    <option key={course.id} value={course.id}>{course.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-3">Date of Birth</label>
                <input
                  type="date"
                  className="w-full bg-slate-50 dark:bg-slate-800 p-6 rounded-3xl outline-none border-2 border-transparent focus:border-brand-500 font-bold transition-all"
                  value={enrollData.dateOfBirth}
                  onChange={(e) => setEnrollData({ ...enrollData, dateOfBirth: e.target.value })}
                />
              </div>

              <div className="space-y-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Primary Parent</p>
                <input
                  type="text"
                  placeholder="Parent Name"
                  className="w-full bg-white dark:bg-slate-900 p-4 rounded-2xl outline-none border border-transparent focus:border-brand-500 font-bold transition-all"
                  value={enrollData.parentName}
                  onChange={(e) => setEnrollData({ ...enrollData, parentName: e.target.value })}
                />
                <div className="flex gap-3">
                  <select
                    className="w-40 bg-white dark:bg-slate-900 p-4 rounded-2xl outline-none border border-transparent focus:border-brand-500 font-bold transition-all"
                    value={enrollData.parentCountryCode}
                    onChange={(e) => setEnrollData({ ...enrollData, parentCountryCode: e.target.value })}
                  >
                    {COUNTRY_CODES.map((code) => (
                      <option key={code} value={code.split(' ')[0]}>{code}</option>
                    ))}
                  </select>
                  <input
                    type="tel"
                    inputMode="numeric"
                    placeholder="Parent Number"
                    className="flex-1 bg-white dark:bg-slate-900 p-4 rounded-2xl outline-none border border-transparent focus:border-brand-500 font-bold transition-all"
                    value={enrollData.parentNumber}
                    onChange={(e) => setEnrollData({ ...enrollData, parentNumber: e.target.value.replace(/\D/g, '') })}
                  />
                </div>
                <input
                  type="email"
                  placeholder="Parent Email"
                  className={`w-full bg-white dark:bg-slate-900 p-4 rounded-2xl outline-none border font-bold transition-all ${isParentEmailValid ? 'border-transparent focus:border-brand-500' : 'border-rose-400 focus:border-rose-500'}`}
                  value={enrollData.parentEmail}
                  onChange={(e) => setEnrollData({ ...enrollData, parentEmail: e.target.value })}
                />
                {!isParentEmailValid && <p className="text-[11px] font-bold text-rose-500 -mt-2">Enter a valid parent email format.</p>}
              </div>

              <div className="space-y-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Secondary Parent (Optional)</p>
                <input
                  type="text"
                  placeholder="Second Parent Name"
                  className="w-full bg-white dark:bg-slate-900 p-4 rounded-2xl outline-none border border-transparent focus:border-brand-500 font-bold transition-all"
                  value={enrollData.secondaryParentName}
                  onChange={(e) => setEnrollData({ ...enrollData, secondaryParentName: e.target.value })}
                />
                <div className="flex gap-3">
                  <select
                    className="w-40 bg-white dark:bg-slate-900 p-4 rounded-2xl outline-none border border-transparent focus:border-brand-500 font-bold transition-all"
                    value={enrollData.secondaryParentCountryCode}
                    onChange={(e) => setEnrollData({ ...enrollData, secondaryParentCountryCode: e.target.value })}
                  >
                    {COUNTRY_CODES.map((code) => (
                      <option key={code} value={code.split(' ')[0]}>{code}</option>
                    ))}
                  </select>
                  <input
                    type="tel"
                    inputMode="numeric"
                    placeholder="Second Parent Number"
                    className="flex-1 bg-white dark:bg-slate-900 p-4 rounded-2xl outline-none border border-transparent focus:border-brand-500 font-bold transition-all"
                    value={enrollData.secondaryParentNumber}
                    onChange={(e) => setEnrollData({ ...enrollData, secondaryParentNumber: e.target.value.replace(/\D/g, '') })}
                  />
                </div>
                <input
                  type="email"
                  placeholder="Second Parent Email"
                  className={`w-full bg-white dark:bg-slate-900 p-4 rounded-2xl outline-none border font-bold transition-all ${isSecondaryParentEmailValid ? 'border-transparent focus:border-brand-500' : 'border-rose-400 focus:border-rose-500'}`}
                  value={enrollData.secondaryParentEmail}
                  onChange={(e) => setEnrollData({ ...enrollData, secondaryParentEmail: e.target.value })}
                />
                {!isSecondaryParentEmailValid && <p className="text-[11px] font-bold text-rose-500 -mt-2">Enter a valid secondary parent email format.</p>}
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-3">Student Profile Image</label>
                <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-3xl border border-slate-200 dark:border-slate-700 space-y-3">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      if (e.target.files?.[0]) {
                        setStudentProfileImage(e.target.files[0]);
                      }
                    }}
                    className="w-full text-xs font-semibold text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-brand-500 file:text-white"
                  />
                  {studentProfileImage && (
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] text-slate-500">Selected: {studentProfileImage.name}</p>
                      <button
                        type="button"
                        onClick={() => setStudentProfileImage(null)}
                        className="px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-500 text-[10px] font-black uppercase tracking-widest"
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>
              </div>

            </>
          )}

          {/* Information Box */}
          <div className="p-6 bg-brand-50 dark:bg-brand-500/10 rounded-3xl border border-brand-100 dark:border-brand-500/20">
            <p className="text-[10px] text-brand-600 dark:text-brand-400 font-bold leading-relaxed">
              <i className="fas fa-info-circle mr-2"></i>
              Upon initialization, a verification link will be queued for the provided email. The student will be required to bind their cognitive password to activate the node.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
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

export default EnrollmentModal;
