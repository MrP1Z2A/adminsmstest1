import React from 'react';
import { Student } from '../../types';

/**
 * EnrollmentModal Component
 * 
 * This modal handles the initial onboarding of a new student node.
 * It captures the student's name and email, and provides feedback about the verification process.
 */

interface EnrollmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  enrollData: { name: string; email: string; type: 'New' | 'Old'; selectedStudentId: string; grade: string };
  setEnrollData: (data: any) => void;
  students: Student[];
  onSubmit: () => void;
}

const EnrollmentModal: React.FC<EnrollmentModalProps> = ({
  isOpen,
  onClose,
  enrollData,
  setEnrollData,
  students,
  onSubmit
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-xl animate-in fade-in duration-300">
      <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[28px] sm:rounded-[40px] lg:rounded-[56px] shadow-2xl overflow-hidden border border-slate-100 dark:border-slate-800 animate-in zoom-in-95 duration-300">
        
        {/* Modal Header */}
        <div className="p-6 sm:p-8 lg:p-12 border-b border-slate-50 dark:border-slate-800">
          <h3 className="text-2xl sm:text-3xl font-black tracking-tighter">Initialize {enrollData.type} Node</h3>
          <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-2">Cognitive Identity Registration</p>
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
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-3">Change Grade</label>
                <select
                  className="w-full bg-slate-50 dark:bg-slate-800 p-6 rounded-3xl outline-none border-2 border-transparent focus:border-brand-500 font-bold transition-all"
                  value={enrollData.grade}
                  onChange={(e) => setEnrollData({ ...enrollData, grade: e.target.value })}
                >
                  {['6th Grade', '7th Grade', '8th Grade', '9th Grade', '10th Grade', '11th Grade', '12th Grade'].map(grade => (
                    <option key={grade} value={grade}>{grade}</option>
                  ))}
                </select>
              </div>
            </>
          ) : (
            <>
              {/* Name Input */}
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

              {/* Email Input */}
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-3">Network Email (Verification Hub)</label>
                <input 
                  type="email"
                  placeholder="student@iacademy.io"
                  className="w-full bg-slate-50 dark:bg-slate-800 p-6 rounded-3xl outline-none border-2 border-transparent focus:border-brand-500 font-bold transition-all"
                  value={enrollData.email}
                  onChange={(e) => setEnrollData({ ...enrollData, email: e.target.value })}
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-3">Grade</label>
                <select
                  className="w-full bg-slate-50 dark:bg-slate-800 p-6 rounded-3xl outline-none border-2 border-transparent focus:border-brand-500 font-bold transition-all"
                  value={enrollData.grade}
                  onChange={(e) => setEnrollData({ ...enrollData, grade: e.target.value })}
                >
                  {['6th Grade', '7th Grade', '8th Grade', '9th Grade', '10th Grade', '11th Grade', '12th Grade'].map(grade => (
                    <option key={grade} value={grade}>{grade}</option>
                  ))}
                </select>
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
          <button 
            onClick={onClose} 
            className="px-10 py-6 bg-white dark:bg-slate-800 font-black rounded-[32px] text-sm uppercase tracking-widest border border-slate-100 dark:border-slate-700 active:scale-95 transition-all"
          >
            Abort
          </button>
        </div>
      </div>
    </div>
  );
};

export default EnrollmentModal;
