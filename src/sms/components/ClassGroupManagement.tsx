import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../src/supabaseClient';

interface ClassGroupManagementProps {
  schoolId: string;
}

interface ClassRow {
  id: string;
  name: string;
  class_code?: string;
  image_url?: string;
  color?: string;
  school_id: string;
}

interface CourseRow {
  id: string;
  name: string;
  class_id: string;
  school_id: string;
  image_url?: string;
  teacher_count?: number;
  student_count?: number;
}

interface TeacherRow {
  id: string;
  name: string;
  email?: string;
  avatar?: string;
}

interface StudentRow {
  id: string;
  name: string;
  email?: string;
  avatar?: string;
}

type Tab = 'overview' | 'teachers' | 'students';

const COLOR_OPTIONS = [
  '#f8fafc','#e0f2fe','#dcfce7','#fef3c7','#ede9fe','#fce7f3','#ffedd5','#fee2e2',
];

const notify = (msg: string) => {
  // Flash a simple console notification — can integrate with SMS toast system
  console.info('[ClassGroupMgmt]', msg);
};

// ─────────────────────────────────────────────────────
const ClassGroupManagement: React.FC<ClassGroupManagementProps> = ({ schoolId }) => {
  // ── Data ───────────────────────────────────────────
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [teachers, setTeachers] = useState<TeacherRow[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);

  // Assignment data
  const [assignedTeachers, setAssignedTeachers] = useState<any[]>([]); // class_course_teachers rows
  const [assignedStudents, setAssignedStudents] = useState<any[]>([]); // class_course_students rows

  // ── UI State ───────────────────────────────────────
  const [isLoading, setIsLoading] = useState(true);
  const [selectedClass, setSelectedClass] = useState<ClassRow | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<CourseRow | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [searchClasses, setSearchClasses] = useState('');
  const [searchCourses, setSearchCourses] = useState('');
  const [searchPeople, setSearchPeople] = useState('');
  const [notification, setNotification] = useState<{ msg: string; type: 'success' | 'error' | 'info' } | null>(null);

  // ── Edit / Create Class Modal ──────────────────────
  const [isClassModalOpen, setIsClassModalOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassRow | null>(null);
  const [classFormName, setClassFormName] = useState('');
  const [classFormColor, setClassFormColor] = useState('#f8fafc');
  const [classFormImage, setClassFormImage] = useState<File | null>(null);
  const [classFormImagePreview, setClassFormImagePreview] = useState<string | null>(null);
  const [isSavingClass, setIsSavingClass] = useState(false);

  // ── Edit / Create Course Modal ─────────────────────
  const [isCourseModalOpen, setIsCourseModalOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<CourseRow | null>(null);
  const [courseFormName, setCourseFormName] = useState('');
  const [courseFormImage, setCourseFormImage] = useState<File | null>(null);
  const [courseFormImagePreview, setCourseFormImagePreview] = useState<string | null>(null);
  const [isSavingCourse, setIsSavingCourse] = useState(false);

  // ── Assign Modal ───────────────────────────────────
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [assignMode, setAssignMode] = useState<'teacher' | 'student'>('teacher');
  const [selectedAssignIds, setSelectedAssignIds] = useState<Set<string>>(new Set());
  const [isAssigning, setIsAssigning] = useState(false);

  // ── Delete Confirmation ────────────────────────────
  const [deleteConfirm, setDeleteConfirm] = useState<{ label: string; onConfirm: () => void } | null>(null);

  // ── Toast ──────────────────────────────────────────
  const showNotification = useCallback((msg: string, type: 'success' | 'error' | 'info' = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3500);
  }, []);

  // ── Load All ───────────────────────────────────────
  useEffect(() => { void loadAll(); }, [schoolId]);

  const loadAll = async () => {
    if (!supabase) return;
    setIsLoading(true);
    try {
      const [classRes, courseRes, teacherRes, studentRes, atRes, asRes] = await Promise.all([
        supabase.from('classes').select('*').eq('school_id', schoolId).order('created_at', { ascending: false }),
        supabase.from('class_courses').select('*').eq('school_id', schoolId).order('created_at', { ascending: false }),
        supabase.from('teachers').select('id, name, email, avatar').eq('school_id', schoolId).order('name'),
        supabase.from('students').select('id, name, email, avatar').eq('school_id', schoolId).order('name'),
        supabase.from('class_course_teachers').select('*').eq('school_id', schoolId),
        supabase.from('class_course_students').select('*').eq('school_id', schoolId),
      ]);

      setClasses(classRes.data || []);
      setCourses(courseRes.data || []);
      setTeachers(teacherRes.data || []);
      setStudents(studentRes.data || []);
      setAssignedTeachers(atRes.data || []);
      setAssignedStudents(asRes.data || []);
    } catch (err) {
      console.error('ClassGroupManagement loadAll:', err);
      showNotification('Failed to load data.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // ── Derived: courses for selected class ───────────
  const coursesForClass = useMemo(() =>
    selectedClass ? courses.filter(c => c.class_id === selectedClass.id) : [],
    [courses, selectedClass]
  );

  // ── Teachers/Students for selected course ─────────
  const teachersForCourse = useMemo(() => {
    if (!selectedCourse) return [];
    const ids = assignedTeachers
      .filter(a => a.class_course_id === selectedCourse.id)
      .map((a: any) => String(a.teacher_id));
    return teachers.filter(t => ids.includes(String(t.id)));
  }, [assignedTeachers, teachers, selectedCourse]);

  const studentsForCourse = useMemo(() => {
    if (!selectedCourse) return [];
    const ids = assignedStudents
      .filter(a => a.class_course_id === selectedCourse.id)
      .map((a: any) => String(a.student_id));
    return students.filter(s => ids.includes(String(s.id)));
  }, [assignedStudents, students, selectedCourse]);

  // ── Filter helpers ─────────────────────────────────
  const filteredClasses = useMemo(() =>
    classes.filter(c => c.name.toLowerCase().includes(searchClasses.toLowerCase())),
    [classes, searchClasses]
  );

  const filteredCourses = useMemo(() =>
    coursesForClass.filter(c => c.name.toLowerCase().includes(searchCourses.toLowerCase())),
    [coursesForClass, searchCourses]
  );

  // ── Image Upload Helper ────────────────────────────
  const uploadProfileImage = async (file: File, prefix: string): Promise<string> => {
    if (!supabase) throw new Error('No supabase');
    const sanitized = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${prefix}-${Date.now()}-${sanitized}`;
    const { error } = await supabase.storage.from('class_image').upload(path, file, { upsert: true });
    if (error) throw error;
    const { data } = supabase.storage.from('class_image').getPublicUrl(path);
    return data.publicUrl;
  };

  const handleClassImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setClassFormImage(file);
    setClassFormImagePreview(URL.createObjectURL(file));
  };

  const handleCourseImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCourseFormImage(file);
    setCourseFormImagePreview(URL.createObjectURL(file));
  };

  // ── Class CRUD ─────────────────────────────────────
  const openNewClass = () => {
    setEditingClass(null); setClassFormName(''); setClassFormColor('#f8fafc');
    setClassFormImage(null); setClassFormImagePreview(null);
    setIsClassModalOpen(true);
  };

  const openEditClass = (cls: ClassRow) => {
    setEditingClass(cls); setClassFormName(cls.name); setClassFormColor(cls.color || '#f8fafc');
    setClassFormImage(null); setClassFormImagePreview(cls.image_url || null);
    setIsClassModalOpen(true);
  };

  const saveClass = async () => {
    if (!classFormName.trim()) return;
    if (!supabase) return;
    setIsSavingClass(true);
    try {
      let imageUrl = editingClass?.image_url || '';
      if (classFormImage) imageUrl = await uploadProfileImage(classFormImage, 'class');

      if (editingClass) {
        const { error } = await supabase.from('classes').update({ name: classFormName.trim(), color: classFormColor, image_url: imageUrl }).eq('id', editingClass.id);
        if (error) throw error;
        setClasses(prev => prev.map(c => c.id === editingClass.id ? { ...c, name: classFormName.trim(), color: classFormColor, image_url: imageUrl } : c));
        if (selectedClass?.id === editingClass.id) setSelectedClass(c => c ? { ...c, name: classFormName.trim(), color: classFormColor, image_url: imageUrl } : c);
        showNotification('Class updated successfully.');
      } else {
        const { data, error } = await supabase.from('classes').insert([{ name: classFormName.trim(), color: classFormColor, image_url: imageUrl, school_id: schoolId }]).select().single();
        if (error) throw error;
        setClasses(prev => [data, ...prev]);
        showNotification('Class created successfully.');
      }
      setIsClassModalOpen(false);
    } catch (err: any) {
      showNotification(err.message || 'Failed to save class.', 'error');
    } finally { setIsSavingClass(false); }
  };

  const deleteClass = (cls: ClassRow) => {
    setDeleteConfirm({
      label: `Delete class "${cls.name}" and all its courses?`,
      onConfirm: async () => {
        if (!supabase) return;
        try {
          // Delete related courses, assignments, then class
          const courseIds = courses.filter(c => c.class_id === cls.id).map(c => c.id);
          if (courseIds.length > 0) {
            await supabase.from('class_course_teachers').delete().in('class_course_id', courseIds);
            await supabase.from('class_course_students').delete().in('class_course_id', courseIds);
            await supabase.from('class_courses').delete().in('id', courseIds);
          }
          await supabase.from('classes').delete().eq('id', cls.id);
          setClasses(prev => prev.filter(c => c.id !== cls.id));
          setCourses(prev => prev.filter(c => c.class_id !== cls.id));
          if (selectedClass?.id === cls.id) { setSelectedClass(null); setSelectedCourse(null); }
          showNotification('Class deleted.');
        } catch (err: any) {
          showNotification(err.message || 'Failed to delete class.', 'error');
        }
        setDeleteConfirm(null);
      },
    });
  };

  // ── Course CRUD ────────────────────────────────────
  const openNewCourse = () => {
    if (!selectedClass) return;
    setEditingCourse(null); setCourseFormName('');
    setCourseFormImage(null); setCourseFormImagePreview(null);
    setIsCourseModalOpen(true);
  };

  const openEditCourse = (course: CourseRow) => {
    setEditingCourse(course); setCourseFormName(course.name);
    setCourseFormImage(null); setCourseFormImagePreview(course.image_url || null);
    setIsCourseModalOpen(true);
  };

  const saveCourse = async () => {
    if (!courseFormName.trim() || !selectedClass || !supabase) return;
    setIsSavingCourse(true);
    try {
      let imageUrl = editingCourse?.image_url || '';
      if (courseFormImage) imageUrl = await uploadProfileImage(courseFormImage, 'course');

      if (editingCourse) {
        const { error } = await supabase.from('class_courses').update({ name: courseFormName.trim(), image_url: imageUrl }).eq('id', editingCourse.id);
        if (error) throw error;
        setCourses(prev => prev.map(c => c.id === editingCourse.id ? { ...c, name: courseFormName.trim(), image_url: imageUrl } : c));
        if (selectedCourse?.id === editingCourse.id) setSelectedCourse(c => c ? { ...c, name: courseFormName.trim(), image_url: imageUrl } : c);
        showNotification('Course updated.');
      } else {
        const { data, error } = await supabase.from('class_courses').insert([{ name: courseFormName.trim(), image_url: imageUrl, class_id: selectedClass.id, school_id: schoolId }]).select().single();
        if (error) throw error;
        setCourses(prev => [data, ...prev]);
        showNotification('Course created.');
      }
      setIsCourseModalOpen(false);
    } catch (err: any) {
      showNotification(err.message || 'Failed to save course.', 'error');
    } finally { setIsSavingCourse(false); }
  };

  const deleteCourse = (course: CourseRow) => {
    setDeleteConfirm({
      label: `Delete course "${course.name}"? All teacher/student assignments will be removed.`,
      onConfirm: async () => {
        if (!supabase) return;
        try {
          await supabase.from('class_course_teachers').delete().eq('class_course_id', course.id);
          await supabase.from('class_course_students').delete().eq('class_course_id', course.id);
          await supabase.from('class_courses').delete().eq('id', course.id);
          setCourses(prev => prev.filter(c => c.id !== course.id));
          if (selectedCourse?.id === course.id) setSelectedCourse(null);
          showNotification('Course deleted.');
        } catch (err: any) {
          showNotification(err.message || 'Failed to delete course.', 'error');
        }
        setDeleteConfirm(null);
      },
    });
  };

  // ── Assign / Remove ────────────────────────────────
  const openAssign = (mode: 'teacher' | 'student') => {
    setAssignMode(mode);
    setSelectedAssignIds(new Set());
    setIsAssignModalOpen(true);
  };

  const handleAssign = async () => {
    if (!selectedCourse || !supabase || selectedAssignIds.size === 0) return;
    setIsAssigning(true);
    try {
      const rows = Array.from(selectedAssignIds).map(id => ({
        school_id: schoolId,
        class_id: selectedClass!.id,
        class_course_id: selectedCourse.id,
        [assignMode === 'teacher' ? 'teacher_id' : 'student_id']: id,
      }));
      const table = assignMode === 'teacher' ? 'class_course_teachers' : 'class_course_students';
      const { error } = await supabase.from(table).insert(rows);
      if (error && !/duplicate/i.test(error.message)) throw error;
      // Refresh assignments
      const { data: updated } = await supabase.from(table).select('*').eq('school_id', schoolId);
      if (assignMode === 'teacher') setAssignedTeachers(updated || []);
      else setAssignedStudents(updated || []);
      showNotification(`${selectedAssignIds.size} ${assignMode}(s) assigned.`);
      setIsAssignModalOpen(false);
    } catch (err: any) {
      showNotification(err.message || 'Failed to assign.', 'error');
    } finally { setIsAssigning(false); }
  };

  const removeTeacher = async (teacherId: string) => {
    if (!selectedCourse || !supabase) return;
    const { error } = await supabase.from('class_course_teachers').delete().eq('class_course_id', selectedCourse.id).eq('teacher_id', teacherId);
    if (error) { showNotification(error.message, 'error'); return; }
    setAssignedTeachers(prev => prev.filter(a => !(a.class_course_id === selectedCourse.id && String(a.teacher_id) === teacherId)));
    showNotification('Teacher removed.');
  };

  const removeStudent = (studentId: string) => {
    const student = students.find(s => String(s.id) === studentId);
    setDeleteConfirm({
      label: `Remove "${student?.name ?? 'this student'}" from ${selectedCourse?.name}?`,
      onConfirm: async () => {
        if (!selectedCourse || !supabase) return;
        const { error } = await supabase.from('class_course_students').delete().eq('class_course_id', selectedCourse.id).eq('student_id', studentId);
        if (error) { showNotification(error.message, 'error'); setDeleteConfirm(null); return; }
        setAssignedStudents(prev => prev.filter(a => !(a.class_course_id === selectedCourse.id && String(a.student_id) === studentId)));
        showNotification('Student removed.');
        setDeleteConfirm(null);
      },
    });
  };

  // ── People search filter ────────────────────────────
  const filteredTeachersForCourse = useMemo(() =>
    teachersForCourse.filter(t => t.name.toLowerCase().includes(searchPeople.toLowerCase())),
    [teachersForCourse, searchPeople]
  );
  const filteredStudentsForCourse = useMemo(() =>
    studentsForCourse.filter(s => s.name.toLowerCase().includes(searchPeople.toLowerCase())),
    [studentsForCourse, searchPeople]
  );

  const unassignedTeachers = useMemo(() => {
    const assigned = new Set(assignedTeachers.filter(a => a.class_course_id === selectedCourse?.id).map((a: any) => String(a.teacher_id)));
    return teachers.filter(t => !assigned.has(String(t.id)));
  }, [assignedTeachers, teachers, selectedCourse]);

  const unassignedStudents = useMemo(() => {
    const assigned = new Set(assignedStudents.filter(a => a.class_course_id === selectedCourse?.id).map((a: any) => String(a.student_id)));
    return students.filter(s => !assigned.has(String(s.id)));
  }, [assignedStudents, students, selectedCourse]);

  const Avatar = ({ name, src, size = 8 }: { name: string; src?: string; size?: number }) => (
    src
      ? <img src={src} alt={name} className={`w-${size} h-${size} rounded-lg object-cover shrink-0`} />
      : <div className={`w-${size} h-${size} rounded-lg bg-brand-500/20 flex items-center justify-center text-brand-500 font-black text-sm shrink-0`}>{name.charAt(0).toUpperCase()}</div>
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10">
      {/* ── Toast ── */}
      {notification && (
        <div className={`fixed top-6 right-6 z-[999] px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 text-white font-black text-sm animate-in slide-in-from-top-2 duration-300 ${
          notification.type === 'error' ? 'bg-rose-500' : notification.type === 'info' ? 'bg-blue-500' : 'bg-emerald-500'
        }`}>
          <i className={`fas ${notification.type === 'error' ? 'fa-circle-xmark' : notification.type === 'info' ? 'fa-circle-info' : 'fa-circle-check'}`}></i>
          {notification.msg}
        </div>
      )}

      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black tracking-tighter text-slate-800 dark:text-white flex items-center gap-3">
            <i className="fas fa-layer-group text-brand-500"></i> Class Group Management
          </h2>
          <p className="text-slate-400 text-sm mt-1">Assign teachers and students to classes and courses</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => void loadAll()} className="flex items-center gap-2 px-4 py-2.5 bg-brand-500/10 border border-brand-500/20 text-brand-500 hover:bg-brand-500 hover:text-white rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all">
            <i className="fas fa-rotate-right"></i> Refresh
          </button>
          <button onClick={openNewClass} className="flex items-center gap-2 px-4 py-2.5 bg-brand-500 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-brand-600 transition-all shadow-lg shadow-brand-500/25">
            <i className="fas fa-plus"></i> New Class
          </button>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Classes', value: classes.length, icon: 'fa-layer-group', color: 'text-brand-500 bg-brand-500/10' },
          { label: 'Courses', value: courses.length, icon: 'fa-book-open', color: 'text-indigo-500 bg-indigo-500/10' },
          { label: 'Teachers', value: teachers.length, icon: 'fa-chalkboard-teacher', color: 'text-amber-500 bg-amber-500/10' },
          { label: 'Students', value: students.length, icon: 'fa-user-graduate', color: 'text-emerald-500 bg-emerald-500/10' },
        ].map(s => (
          <div key={s.label} className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${s.color}`}>
              <i className={`fas ${s.icon} text-sm`}></i>
            </div>
            <div>
              <p className="text-2xl font-black text-slate-800 dark:text-white">{isLoading ? '…' : s.value}</p>
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Main 3-Column Layout ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4" style={{ minHeight: '560px' }}>

        {/* ─ Col 1: Classes ─ */}
        <div className="lg:col-span-3 bg-white dark:bg-slate-900 rounded-[24px] border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-black text-slate-700 dark:text-white uppercase tracking-widest flex items-center gap-2">
                <i className="fas fa-layer-group text-brand-500 text-xs"></i> Classes
              </h3>
              <button onClick={openNewClass} className="w-7 h-7 rounded-lg bg-brand-500/10 hover:bg-brand-500 text-brand-500 hover:text-white flex items-center justify-center transition-all" title="New Class">
                <i className="fas fa-plus text-xs"></i>
              </button>
            </div>
            <div className="relative">
              <i className="fas fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none"></i>
              <input type="text" value={searchClasses} onChange={e => setSearchClasses(e.target.value)}
                placeholder="Search classes..." className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2 pl-8 pr-3 text-xs font-semibold text-slate-700 dark:text-white focus:outline-none focus:border-brand-500 transition-all placeholder:text-slate-400" />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {isLoading ? (
              <div className="flex items-center justify-center h-32 opacity-40">
                <div className="w-7 h-7 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : filteredClasses.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 opacity-30 text-center">
                <i className="fas fa-layer-group text-2xl mb-2 text-slate-400"></i>
                <p className="text-xs font-black text-slate-400">No classes</p>
              </div>
            ) : filteredClasses.map(cls => {
              const isActive = selectedClass?.id === cls.id;
              const courseCount = courses.filter(c => c.class_id === cls.id).length;
              return (
                <div key={cls.id}
                  onClick={() => { setSelectedClass(cls); setSelectedCourse(null); setSearchCourses(''); setActiveTab('overview'); }}
                  className={`flex items-center gap-3 p-3 rounded-2xl cursor-pointer transition-all group ${isActive ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/20' : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-white'}`}>
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 font-black text-base overflow-hidden"
                    style={{ backgroundColor: isActive ? 'rgba(255,255,255,0.2)' : (cls.color || '#f1f5f9') }}>
                    {cls.image_url
                      ? <img src={cls.image_url} alt={cls.name} className="w-full h-full object-cover" />
                      : (cls.name || 'C').charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-black truncate">{cls.name}</p>
                    <p className={`text-[9px] font-bold ${isActive ? 'text-white/70' : 'text-slate-400'}`}>{courseCount} course{courseCount !== 1 ? 's' : ''}</p>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all" onClick={e => e.stopPropagation()}>
                    <button onClick={() => openEditClass(cls)} className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all ${isActive ? 'hover:bg-white/20 text-white' : 'hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500'}`} title="Edit">
                      <i className="fas fa-pencil text-[9px]"></i>
                    </button>
                    <button onClick={() => deleteClass(cls)} className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all ${isActive ? 'hover:bg-rose-500/20 text-white' : 'hover:bg-rose-50 text-rose-400'}`} title="Delete">
                      <i className="fas fa-trash text-[9px]"></i>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ─ Col 2: Courses ─ */}
        <div className="lg:col-span-3 bg-white dark:bg-slate-900 rounded-[24px] border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-black text-slate-700 dark:text-white uppercase tracking-widest flex items-center gap-2">
                <i className="fas fa-book-open text-indigo-500 text-xs"></i>
                {selectedClass ? <span className="truncate max-w-[120px]">{selectedClass.name}</span> : 'Courses'}
              </h3>
              {selectedClass && (
                <button onClick={openNewCourse} className="w-7 h-7 rounded-lg bg-indigo-500/10 hover:bg-indigo-500 text-indigo-500 hover:text-white flex items-center justify-center transition-all" title="New Course">
                  <i className="fas fa-plus text-xs"></i>
                </button>
              )}
            </div>
            <div className="relative">
              <i className="fas fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none"></i>
              <input type="text" value={searchCourses} onChange={e => setSearchCourses(e.target.value)}
                placeholder="Search courses..." className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2 pl-8 pr-3 text-xs font-semibold text-slate-700 dark:text-white focus:outline-none focus:border-indigo-500 transition-all placeholder:text-slate-400" />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {!selectedClass ? (
              <div className="flex flex-col items-center justify-center h-full opacity-30 text-center px-4">
                <i className="fas fa-arrow-left text-2xl mb-2 text-slate-400"></i>
                <p className="text-xs font-black text-slate-400">Select a class first</p>
              </div>
            ) : filteredCourses.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full opacity-30 text-center">
                <i className="fas fa-book-open text-2xl mb-2 text-slate-400"></i>
                <p className="text-xs font-black text-slate-400">No courses yet</p>
              </div>
            ) : filteredCourses.map(course => {
              const isActive = selectedCourse?.id === course.id;
              const tCount = assignedTeachers.filter(a => a.class_course_id === course.id).length;
              const sCount = assignedStudents.filter(a => a.class_course_id === course.id).length;
              return (
                <div key={course.id}
                  onClick={() => { setSelectedCourse(course); setActiveTab('overview'); setSearchPeople(''); }}
                  className={`flex items-center gap-3 p-3 rounded-2xl cursor-pointer transition-all group ${isActive ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-white'}`}>
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 overflow-hidden ${isActive ? 'bg-white/20' : 'bg-indigo-500/10'}`}>
                    {course.image_url
                      ? <img src={course.image_url} alt={course.name} className="w-full h-full object-cover" />
                      : <i className={`fas fa-book text-xs ${isActive ? 'text-white' : 'text-indigo-500'}`}></i>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-black truncate">{course.name}</p>
                    <p className={`text-[9px] font-bold ${isActive ? 'text-white/70' : 'text-slate-400'}`}>{tCount}T · {sCount}S</p>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all" onClick={e => e.stopPropagation()}>
                    <button onClick={() => openEditCourse(course)} className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all ${isActive ? 'hover:bg-white/20 text-white' : 'hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500'}`} title="Edit">
                      <i className="fas fa-pencil text-[9px]"></i>
                    </button>
                    <button onClick={() => deleteCourse(course)} className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all ${isActive ? 'hover:bg-rose-500/30 text-white' : 'hover:bg-rose-50 text-rose-400'}`} title="Delete">
                      <i className="fas fa-trash text-[9px]"></i>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ─ Col 3: Detail Panel ─ */}
        <div className="lg:col-span-6 bg-white dark:bg-slate-900 rounded-[24px] border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col overflow-hidden">
          {!selectedCourse ? (
            <div className="flex-1 flex flex-col items-center justify-center opacity-30 text-center px-8">
              <div className="w-20 h-20 rounded-[28px] bg-brand-500/10 flex items-center justify-center text-4xl text-brand-500 mb-5">
                <i className="fas fa-users-gear"></i>
              </div>
              <h3 className="text-lg font-black text-slate-700 dark:text-white uppercase tracking-wide">Select a Course</h3>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-2">to manage teachers and students</p>
            </div>
          ) : (
            <>
              {/* Detail Header */}
              <div className="p-5 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-black text-slate-800 dark:text-white">{selectedCourse.name}</h3>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-0.5">
                      {selectedClass?.name} &rsaquo; {selectedCourse.name}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => openAssign('teacher')}
                      className="flex items-center gap-1.5 px-3 py-2 bg-amber-500/10 border border-amber-500/20 text-amber-600 hover:bg-amber-500 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">
                      <i className="fas fa-user-plus text-xs"></i> Teacher
                    </button>
                    <button onClick={() => openAssign('student')}
                      className="flex items-center gap-1.5 px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 hover:bg-emerald-500 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">
                      <i className="fas fa-user-plus text-xs"></i> Student
                    </button>
                  </div>
                </div>
                {/* Tabs */}
                <div className="flex gap-1 mt-4">
                  {(['overview', 'teachers', 'students'] as Tab[]).map(tab => (
                    <button key={tab} onClick={() => setActiveTab(tab)}
                      className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/20' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                      {tab === 'overview' ? 'Overview' : tab === 'teachers' ? `Teachers (${teachersForCourse.length})` : `Students (${studentsForCourse.length})`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Search */}
              {activeTab !== 'overview' && (
                <div className="px-5 pt-4">
                  <div className="relative">
                    <i className="fas fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none"></i>
                    <input type="text" value={searchPeople} onChange={e => setSearchPeople(e.target.value)}
                      placeholder={`Search ${activeTab}...`}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2 pl-8 pr-3 text-xs font-semibold text-slate-700 dark:text-white focus:outline-none focus:border-brand-500 transition-all placeholder:text-slate-400" />
                  </div>
                </div>
              )}

              {/* Tab Content */}
              <div className="flex-1 overflow-y-auto p-5" style={{ maxHeight: '380px' }}>
                {activeTab === 'overview' && (
                  <div className="space-y-5">
                    <div className="grid grid-cols-2 gap-4">
                      {[
                        { label: 'Teachers', count: teachersForCourse.length, icon: 'fa-chalkboard-teacher', color: 'text-amber-500 bg-amber-500/10', tab: 'teachers' as Tab },
                        { label: 'Students', count: studentsForCourse.length, icon: 'fa-user-graduate', color: 'text-emerald-500 bg-emerald-500/10', tab: 'students' as Tab },
                      ].map(card => (
                        <button key={card.label} onClick={() => setActiveTab(card.tab)}
                          className="p-5 rounded-2xl border border-slate-100 dark:border-slate-800 hover:border-brand-500/30 hover:shadow-lg transition-all text-left">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${card.color}`}>
                            <i className={`fas ${card.icon}`}></i>
                          </div>
                          <p className="text-2xl font-black text-slate-800 dark:text-white">{card.count}</p>
                          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{card.label} Assigned</p>
                        </button>
                      ))}
                    </div>

                    {/* Teacher mini list */}
                    {teachersForCourse.length > 0 && (
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">Assigned Teachers</p>
                        <div className="flex flex-wrap gap-2">
                          {teachersForCourse.slice(0, 6).map(t => (
                            <div key={t.id} className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 dark:bg-amber-500/10 rounded-xl border border-amber-200 dark:border-amber-500/20">
                              <Avatar name={t.name} src={t.avatar} size={5} />
                              <span className="text-[10px] font-black text-amber-700 dark:text-amber-400">{t.name.split(' ')[0]}</span>
                            </div>
                          ))}
                          {teachersForCourse.length > 6 && <span className="text-[10px] font-bold text-slate-400 self-center">+{teachersForCourse.length - 6} more</span>}
                        </div>
                      </div>
                    )}

                    {/* Student mini list */}
                    {studentsForCourse.length > 0 && (
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">Assigned Students</p>
                        <div className="flex flex-wrap gap-2">
                          {studentsForCourse.slice(0, 8).map(s => (
                            <div key={s.id} className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl border border-emerald-200 dark:border-emerald-500/20">
                              <Avatar name={s.name} src={s.avatar} size={5} />
                              <span className="text-[10px] font-black text-emerald-700 dark:text-emerald-400">{s.name.split(' ')[0]}</span>
                            </div>
                          ))}
                          {studentsForCourse.length > 8 && <span className="text-[10px] font-bold text-slate-400 self-center">+{studentsForCourse.length - 8} more</span>}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'teachers' && (
                  <div className="space-y-2">
                    {filteredTeachersForCourse.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-40 opacity-30 text-center">
                        <i className="fas fa-chalkboard-teacher text-3xl mb-2 text-slate-400"></i>
                        <p className="text-xs font-black text-slate-400">No teachers assigned</p>
                      </div>
                    ) : filteredTeachersForCourse.map(t => (
                      <div key={t.id} className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 group">
                        <Avatar name={t.name} src={t.avatar} size={9} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-black text-slate-700 dark:text-white truncate">{t.name}</p>
                          <p className="text-[9px] font-bold text-amber-500 uppercase tracking-widest">Teacher</p>
                          {t.email && <p className="text-[9px] text-slate-400 truncate">{t.email}</p>}
                        </div>
                        <button onClick={() => removeTeacher(String(t.id))}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 opacity-0 group-hover:opacity-100 transition-all" title="Remove">
                          <i className="fas fa-xmark text-xs"></i>
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {activeTab === 'students' && (
                  <div className="space-y-2">
                    {filteredStudentsForCourse.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-40 opacity-30 text-center">
                        <i className="fas fa-user-graduate text-3xl mb-2 text-slate-400"></i>
                        <p className="text-xs font-black text-slate-400">No students assigned</p>
                      </div>
                    ) : filteredStudentsForCourse.map(s => (
                      <div key={s.id} className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 group">
                        <Avatar name={s.name} src={s.avatar} size={9} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-black text-slate-700 dark:text-white truncate">{s.name}</p>
                          <p className="text-[9px] font-bold text-emerald-500 uppercase tracking-widest">Student</p>
                          {s.email && <p className="text-[9px] text-slate-400 truncate">{s.email}</p>}
                        </div>
                        <button onClick={() => removeStudent(String(s.id))}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 opacity-0 group-hover:opacity-100 transition-all" title="Remove">
                          <i className="fas fa-xmark text-xs"></i>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ══════════════ CLASS MODAL ══════════════ */}
      {isClassModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-[28px] shadow-2xl w-full max-w-sm">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-base font-black text-slate-800 dark:text-white">{editingClass ? 'Edit Class' : 'New Class'}</h3>
              <button onClick={() => setIsClassModalOpen(false)} className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-all">
                <i className="fas fa-xmark"></i>
              </button>
            </div>
            <div className="p-5 space-y-4">
              {/* Image Upload */}
              <div>
                <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Class Profile Image</label>
                <label className="cursor-pointer flex items-center gap-3 p-3 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-brand-500 transition-all group">
                  <input type="file" accept="image/*" onChange={handleClassImageChange} className="hidden" />
                  {classFormImagePreview
                    ? <img src={classFormImagePreview} alt="preview" className="w-14 h-14 rounded-xl object-cover shrink-0" />
                    : <div className="w-14 h-14 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 group-hover:bg-brand-500/10 transition-all">
                        <i className="fas fa-image text-slate-400 group-hover:text-brand-500 text-xl transition-all"></i>
                      </div>}
                  <div>
                    <p className="text-xs font-black text-slate-600 dark:text-slate-300">{classFormImagePreview ? 'Change image' : 'Upload image'}</p>
                    <p className="text-[9px] text-slate-400">JPG, PNG, WEBP · max 5MB</p>
                  </div>
                </label>
              </div>
              <div>
                <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1 block">Class Name</label>
                <input type="text" value={classFormName} onChange={e => setClassFormName(e.target.value)} placeholder="e.g. Grade 5"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2.5 px-4 text-sm font-semibold text-slate-800 dark:text-white focus:outline-none focus:border-brand-500 transition-all" />
              </div>
              <div>
                <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Accent Color</label>
                <div className="flex flex-wrap gap-2">
                  {COLOR_OPTIONS.map(c => (
                    <button key={c} onClick={() => setClassFormColor(c)}
                      className={`w-8 h-8 rounded-xl border-2 transition-all ${classFormColor === c ? 'border-brand-500 scale-110 shadow-lg' : 'border-transparent hover:scale-105'}`}
                      style={{ backgroundColor: c }} />
                  ))}
                </div>
              </div>
              <button onClick={() => void saveClass()} disabled={isSavingClass || !classFormName.trim()}
                className="w-full py-3 bg-brand-500 text-white rounded-2xl text-sm font-black uppercase tracking-widest hover:bg-brand-600 transition-all disabled:opacity-40 shadow-lg shadow-brand-500/25">
                {isSavingClass ? 'Uploading & Saving…' : editingClass ? 'Update Class' : 'Create Class'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════ COURSE MODAL ══════════════ */}
      {isCourseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-[28px] shadow-2xl w-full max-w-sm">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-base font-black text-slate-800 dark:text-white">{editingCourse ? 'Edit Course' : 'New Course'}</h3>
              <button onClick={() => setIsCourseModalOpen(false)} className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-all">
                <i className="fas fa-xmark"></i>
              </button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-[10px] font-bold text-slate-400">Adding course to: <span className="text-indigo-500 font-black">{selectedClass?.name}</span></p>
              {/* Image Upload */}
              <div>
                <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Course Profile Image</label>
                <label className="cursor-pointer flex items-center gap-3 p-3 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-indigo-500 transition-all group">
                  <input type="file" accept="image/*" onChange={handleCourseImageChange} className="hidden" />
                  {courseFormImagePreview
                    ? <img src={courseFormImagePreview} alt="preview" className="w-14 h-14 rounded-xl object-cover shrink-0" />
                    : <div className="w-14 h-14 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 group-hover:bg-indigo-500/10 transition-all">
                        <i className="fas fa-image text-slate-400 group-hover:text-indigo-500 text-xl transition-all"></i>
                      </div>}
                  <div>
                    <p className="text-xs font-black text-slate-600 dark:text-slate-300">{courseFormImagePreview ? 'Change image' : 'Upload image'}</p>
                    <p className="text-[9px] text-slate-400">JPG, PNG, WEBP · max 5MB</p>
                  </div>
                </label>
              </div>
              <div>
                <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1 block">Course Name</label>
                <input type="text" value={courseFormName} onChange={e => setCourseFormName(e.target.value)} placeholder="e.g. Mathematics"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2.5 px-4 text-sm font-semibold text-slate-800 dark:text-white focus:outline-none focus:border-indigo-500 transition-all" />
              </div>
              <button onClick={() => void saveCourse()} disabled={isSavingCourse || !courseFormName.trim()}
                className="w-full py-3 bg-indigo-500 text-white rounded-2xl text-sm font-black uppercase tracking-widest hover:bg-indigo-600 transition-all disabled:opacity-40 shadow-lg shadow-indigo-500/25">
                {isSavingCourse ? 'Uploading & Saving…' : editingCourse ? 'Update Course' : 'Create Course'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════ ASSIGN MODAL ══════════════ */}
      {isAssignModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-[28px] shadow-2xl w-full max-w-md">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-base font-black text-slate-800 dark:text-white">
                Assign {assignMode === 'teacher' ? 'Teachers' : 'Students'}
                <span className="ml-2 text-[10px] font-bold text-slate-400">to {selectedCourse?.name}</span>
              </h3>
              <button onClick={() => setIsAssignModalOpen(false)} className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-all">
                <i className="fas fa-xmark"></i>
              </button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                {selectedAssignIds.size} selected
              </p>
              <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1">
                {(assignMode === 'teacher' ? unassignedTeachers : unassignedStudents).length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-6">All {assignMode}s are already assigned.</p>
                ) : (assignMode === 'teacher' ? unassignedTeachers : unassignedStudents).map(p => {
                  const selected = selectedAssignIds.has(String(p.id));
                  return (
                    <button key={p.id} type="button"
                      onClick={() => setSelectedAssignIds(prev => { const s = new Set(prev); selected ? s.delete(String(p.id)) : s.add(String(p.id)); return s; })}
                      className={`w-full flex items-center gap-3 p-3 rounded-2xl transition-all border ${selected ? (assignMode === 'teacher' ? 'bg-amber-50 border-amber-300 dark:bg-amber-500/10 dark:border-amber-500/40' : 'bg-emerald-50 border-emerald-300 dark:bg-emerald-500/10 dark:border-emerald-500/40') : 'hover:bg-slate-50 dark:hover:bg-slate-800 border-transparent'}`}
                    >
                      <Avatar name={p.name} src={p.avatar} size={9} />
                      <div className="flex-1 text-left">
                        <p className="text-xs font-black text-slate-700 dark:text-white">{p.name}</p>
                        {p.email && <p className="text-[9px] text-slate-400 truncate">{p.email}</p>}
                      </div>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${selected ? (assignMode === 'teacher' ? 'bg-amber-500 border-amber-500' : 'bg-emerald-500 border-emerald-500') : 'border-slate-300 dark:border-slate-600'}`}>
                        {selected && <i className="fas fa-check text-[8px] text-white"></i>}
                      </div>
                    </button>
                  );
                })}
              </div>
              <button onClick={() => void handleAssign()} disabled={isAssigning || selectedAssignIds.size === 0}
                className={`w-full py-3 text-white rounded-2xl text-sm font-black uppercase tracking-widest transition-all disabled:opacity-40 shadow-lg ${assignMode === 'teacher' ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/25' : 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/25'}`}>
                {isAssigning ? 'Assigning…' : `Assign ${selectedAssignIds.size || ''} ${assignMode}${selectedAssignIds.size !== 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════ DELETE CONFIRM ══════════════ */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-[28px] shadow-2xl w-full max-w-sm p-6 space-y-5">
            <div className="w-14 h-14 bg-rose-100 dark:bg-rose-500/10 rounded-2xl flex items-center justify-center mx-auto">
              <i className="fas fa-triangle-exclamation text-rose-500 text-2xl"></i>
            </div>
            <p className="text-sm font-bold text-slate-700 dark:text-slate-300 text-center">{deleteConfirm.label}</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-white rounded-2xl text-sm font-black uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-slate-700 transition-all">
                Cancel
              </button>
              <button onClick={deleteConfirm.onConfirm} className="flex-1 py-3 bg-rose-500 text-white rounded-2xl text-sm font-black uppercase tracking-widest hover:bg-rose-600 transition-all shadow-lg shadow-rose-500/25">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClassGroupManagement;
