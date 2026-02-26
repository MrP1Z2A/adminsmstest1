import React from 'react';
import { Student, StudentPermissions } from '../../types';

/**
 * PermissionsModal Component
 * 
 * Manages the "Node Access Protocol" for individual students.
 * Allows toggling specific permissions like Neural Sync, Library Access, etc.
 */

interface PermissionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  permTarget: Student | null;
  togglePermission: (key: keyof StudentPermissions) => void;
}

const PermissionsModal: React.FC<PermissionsModalProps> = ({
  isOpen,
  onClose,
  permTarget,
  togglePermission
}) => {
  if (!isOpen || !permTarget) return null;

  // Configuration for permission toggles
  const permissionConfigs = [
    { key: 'neuralSync', label: 'Neural Sync Authorization', desc: 'Allow cognitive node binding' },
    { key: 'libraryAccess', label: 'Knowledge Matrix Access', desc: 'Permit library decryption' },
    { key: 'examEntry', label: 'Evaluation Entry', desc: 'Grant exam terminal login' },
    { key: 'apiAccess', label: 'Restricted API Access', desc: 'Developer console bypass' },
  ];

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-6 bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[24px] sm:rounded-[36px] lg:rounded-[48px] shadow-2xl overflow-hidden border border-slate-100 dark:border-slate-800 animate-in zoom-in-95 duration-300">
        
        {/* Modal Header */}
        <div className="p-5 sm:p-8 lg:p-10 border-b border-slate-50 dark:border-slate-800 flex justify-between items-center gap-4">
          <h3 className="text-xl sm:text-2xl font-black tracking-tight">Node Access Protocol</h3>
          <button 
            onClick={onClose} 
            className="w-10 h-10 rounded-full hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-400"
          >
            <i className="fas fa-times"></i>
          </button>
        </div>

        {/* Target Student Info */}
        <div className="p-5 sm:p-8 lg:p-10 space-y-6 sm:space-y-8">
          <div className="flex items-center gap-6 mb-4">
            <div className="w-16 h-16 rounded-2xl bg-brand-500/10 text-brand-500 flex items-center justify-center font-black text-xl shadow-inner">
              {permTarget.name.charAt(0)}
            </div>
            <div>
              <p className="font-black text-lg">{permTarget.name}</p>
              <p className="text-[10px] uppercase font-black text-slate-400 tracking-widest">{permTarget.id}</p>
            </div>
          </div>

          {/* Permission Toggles */}
          <div className="space-y-4">
            {permissionConfigs.map((p) => (
              <div 
                key={p.key} 
                className="flex items-center justify-between p-5 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-transparent hover:border-slate-100 dark:hover:border-slate-700 transition-all"
              >
                <div>
                  <p className="text-sm font-black">{p.label}</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">{p.desc}</p>
                </div>
                
                {/* Custom Toggle Switch */}
                <button 
                  onClick={() => togglePermission(p.key as keyof StudentPermissions)} 
                  className={`w-14 h-7 rounded-full transition-all flex items-center px-1 ${permTarget.permissions?.[p.key as keyof StudentPermissions] ? 'bg-brand-500 shadow-glow shadow-brand-500/30' : 'bg-slate-300 dark:bg-slate-700'}`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full transition-all ${permTarget.permissions?.[p.key as keyof StudentPermissions] ? 'translate-x-7' : 'translate-x-0'}`}></div>
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Footer Action */}
        <div className="p-5 sm:p-8 lg:p-10 bg-slate-50 dark:bg-slate-900/50">
          <button 
            onClick={onClose} 
            className="w-full py-6 bg-brand-500 text-white font-black rounded-3xl text-[12px] uppercase tracking-widest shadow-xl shadow-brand-500/20 active:scale-95 transition-all"
          >
            Finalize Node Protocol
          </button>
        </div>
      </div>
    </div>
  );
};

export default PermissionsModal;
