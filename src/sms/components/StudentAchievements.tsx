import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Student } from '../types';

interface StudentAchievement {
  id: string;
  student_id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  achievement_date: string;
  created_at: string;
}

interface StudentAchievementsProps {
  schoolId: string | undefined;
  students: Student[];
  notify?: (message: string) => void;
  onConfirm?: (message: string, action: () => Promise<void> | void) => void;
}

const StudentAchievements: React.FC<StudentAchievementsProps> = ({ schoolId, students, notify, onConfirm }) => {
  const [achievements, setAchievements] = useState<StudentAchievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [formData, setFormData] = useState({
    student_id: '',
    title: '',
    description: '',
    icon: 'fa-trophy',
    color: 'emerald',
    achievement_date: new Date().toISOString().split('T')[0]
  });

  const fetchAchievements = async () => {
    if (!schoolId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('student_achievements')
      .select('*')
      .eq('school_id', schoolId)
      .order('achievement_date', { ascending: false });

    if (error) {
      console.error('Error fetching achievements:', error);
    } else {
      setAchievements(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchAchievements();
  }, [schoolId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!schoolId || !formData.student_id) return;

    setIsSubmitting(true);
    const { error } = await supabase
      .from('student_achievements')
      .insert([{ ...formData, school_id: schoolId }]);

    if (error) {
      if (notify) notify('Error adding achievement: ' + error.message);
      else alert('Error adding achievement: ' + error.message);
    } else {
      setIsModalOpen(false);
      setFormData({
        student_id: '',
        title: '',
        description: '',
        icon: 'fa-trophy',
        color: 'emerald',
        achievement_date: new Date().toISOString().split('T')[0]
      });
      fetchAchievements();
    }
    setIsSubmitting(false);
  };

  const handleDelete = async (id: string) => {
    const action = async () => {
      const { error } = await supabase
        .from('student_achievements')
        .delete()
        .eq('id', id);

      if (error) {
        if (notify) notify('Error deleting achievement: ' + error.message);
        else alert('Error deleting achievement: ' + error.message);
      } else {
        if (notify) notify('Achievement deleted successfully.');
        fetchAchievements();
      }
    };

    if (onConfirm) {
      onConfirm('Are you sure you want to delete this achievement?', action);
    } else if (window.confirm('Are you sure you want to delete this achievement?')) {
      action();
    }
  };

  const filteredAchievements = achievements.filter(ach => {
    const student = students.find(s => s.id === ach.student_id);
    const studentName = student?.name.toLowerCase() || '';
    const title = ach.title.toLowerCase();
    const query = searchQuery.toLowerCase();
    return studentName.includes(query) || title.includes(query);
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-700 p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black tracking-tighter text-slate-800">Student Achievements</h2>
          <p className="text-slate-500 font-medium">Recognize and celebrate student excellence</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-brand-500 hover:bg-brand-600 text-white font-black px-6 py-3 rounded-2xl shadow-lg shadow-brand-500/20 transition-all active:scale-95 flex items-center gap-2"
        >
          <i className="fas fa-plus"></i>
          Add Achievement
        </button>
      </div>

      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <i className="fas fa-search text-slate-400"></i>
        </div>
        <input
          type="text"
          placeholder="Search by student name or achievement title..."
          className="w-full bg-white border border-slate-200 pl-11 pr-4 py-4 rounded-2xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all font-medium"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-premium overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] border-b border-slate-100">
                <th className="px-8 py-5">Student</th>
                <th className="px-8 py-5">Achievement</th>
                <th className="px-8 py-5">Date</th>
                <th className="px-8 py-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-8 py-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-8 h-8 border-4 border-brand-500/20 border-t-brand-500 rounded-full animate-spin"></div>
                      <span className="text-slate-400 font-bold text-sm tracking-tight">Syncing achievements...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredAchievements.length > 0 ? (
                filteredAchievements.map((ach) => {
                  const student = students.find(s => s.id === ach.student_id);
                  return (
                    <tr key={ach.id} className="group hover:bg-slate-50/50 transition-all">
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center font-black text-slate-400 text-sm">
                            {student?.name?.charAt(0) || '?'}
                          </div>
                          <div>
                            <p className="font-black text-slate-900 text-sm tracking-tight">{student?.name || 'Unknown Student'}</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{ach.student_id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm shadow-sm
                            ${ach.color === 'emerald' ? 'bg-emerald-50 text-emerald-600' : 
                              ach.color === 'blue' ? 'bg-blue-50 text-blue-600' :
                              ach.color === 'amber' ? 'bg-amber-50 text-amber-600' :
                              ach.color === 'rose' ? 'bg-rose-50 text-rose-600' :
                              ach.color === 'indigo' ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-50 text-slate-600'}`}>
                            <i className={`fas ${ach.icon || 'fa-award'}`}></i>
                          </div>
                          <div>
                            <p className="font-bold text-slate-800 text-sm">{ach.title}</p>
                            <p className="text-xs text-slate-400 line-clamp-1">{ach.description}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <p className="text-sm font-bold text-slate-600">{new Date(ach.achievement_date).toLocaleDateString()}</p>
                      </td>
                      <td className="px-8 py-5 text-right">
                        <button
                          onClick={() => handleDelete(ach.id)}
                          className="p-2 text-slate-400 hover:text-rose-500 transition-colors"
                        >
                          <i className="fas fa-trash-alt"></i>
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={4} className="px-8 py-20 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-16 h-16 bg-slate-50 rounded-3xl flex items-center justify-center text-slate-200 text-2xl">
                        <i className="fas fa-trophy"></i>
                      </div>
                      <p className="text-slate-400 font-bold">No achievements found.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="px-8 pt-8 pb-4 flex items-center justify-between border-b border-slate-50">
              <h3 className="text-2xl font-black tracking-tighter text-slate-800">Add Achievement</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-50 rounded-xl text-slate-400 transition-all">
                <i className="fas fa-times"></i>
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-8 space-y-5">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Select Student</label>
                <select
                  required
                  className="w-full bg-slate-50 border border-slate-100 px-5 py-4 rounded-2xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all font-bold text-sm appearance-none"
                  value={formData.student_id}
                  onChange={(e) => setFormData(prev => ({ ...prev, student_id: e.target.value }))}
                >
                  <option value="">-- Select Student --</option>
                  {students.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.id})</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Achievement Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Science Fair Winner"
                  className="w-full bg-slate-50 border border-slate-100 px-5 py-4 rounded-2xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all font-bold text-sm"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Description</label>
                <textarea
                  placeholder="Tell us more about this achievement..."
                  className="w-full bg-slate-50 border border-slate-100 px-5 py-4 rounded-2xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all font-bold text-sm min-h-[100px] resize-none"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Icon</label>
                  <select
                    className="w-full bg-slate-50 border border-slate-100 px-5 py-4 rounded-2xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all font-bold text-sm"
                    value={formData.icon}
                    onChange={(e) => setFormData(prev => ({ ...prev, icon: e.target.value }))}
                  >
                    <option value="fa-trophy">Trophy</option>
                    <option value="fa-award">Award</option>
                    <option value="fa-medal">Medal</option>
                    <option value="fa-star">Star</option>
                    <option value="fa-graduation-cap">Graduation</option>
                    <option value="fa-lightbulb">Innovation</option>
                    <option value="fa-heart">Heart</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Color</label>
                  <select
                    className="w-full bg-slate-50 border border-slate-100 px-5 py-4 rounded-2xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all font-bold text-sm"
                    value={formData.color}
                    onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))}
                  >
                    <option value="emerald">Emerald</option>
                    <option value="blue">Blue</option>
                    <option value="amber">Amber</option>
                    <option value="rose">Rose</option>
                    <option value="indigo">Indigo</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Achievement Date</label>
                <input
                  type="date"
                  className="w-full bg-slate-50 border border-slate-100 px-5 py-4 rounded-2xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all font-bold text-sm"
                  value={formData.achievement_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, achievement_date: e.target.value }))}
                />
              </div>

              <div className="pt-4 flex gap-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-8 py-4 bg-slate-50 text-slate-500 font-black rounded-2xl hover:bg-slate-100 transition-all active:scale-95 text-xs uppercase tracking-widest"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 px-8 py-4 bg-brand-500 text-white font-black rounded-2xl hover:bg-brand-600 shadow-lg shadow-brand-500/20 transition-all active:scale-95 text-xs uppercase tracking-widest disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : 'Save Achievement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentAchievements;
