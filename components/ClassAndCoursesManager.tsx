import React from 'react';
import { supabase } from '../supabaseClient';
import { Student } from '../types';

type AttendanceContextType = 'class' | 'subject';
type AttendanceStatus = 'P' | 'A' | 'L';

type AttendanceStudent = {
  id: string;
  name: string;
  email?: string;
};

type LightweightSubject = {
  id: string;
  name: string;
};

type ClassRow = {
  id: string;
  name: string;
  student_ids?: string[];
  image_url?: string | null;
  color?: string | null;
  outer_color?: string | null;
  class_code?: string | null;
  student_count?: number;
};

type CourseRow = {
  id: string;
  name: string;
  class_id: string;
  image_url?: string | null;
};

interface ClassAndCoursesManagerProps {
  students?: Student[];
  allStudents?: Student[];
  subjects?: LightweightSubject[];
  notify?: (message: string) => void;
  onOpenCoursePage?: (course: { id: string; name: string; classId: string; className?: string }) => void;
}

const CLASS_IMAGE_BUCKET = 'class_image';
const COURSE_PROFILE_BUCKET = 'course_profile';
const normalizeAttendanceStatus = (value: unknown): AttendanceStatus | null => {
  const normalized = String(value || '').trim().toUpperCase();
  if (!normalized) return null;
  if (normalized === 'P' || normalized === 'PRESENT') return 'P';
  if (normalized === 'A' || normalized === 'ABSENT') return 'A';
  if (normalized === 'L' || normalized === 'LATE' || normalized === 'LEAVE') return 'L';
  return null;
};
const getTodayIsoDate = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const ClassAndCoursesManager: React.FC<ClassAndCoursesManagerProps> = ({ students = [], allStudents, subjects = [], notify, onOpenCoursePage }) => {
  const [classes, setClasses] = React.useState<ClassRow[]>([]);
  const [filteredClasses, setFilteredClasses] = React.useState<ClassRow[]>([]);
  const [classSearchQuery, setClassSearchQuery] = React.useState('');
  const [selectedClassId, setSelectedClassId] = React.useState<string | null>(null);

  const [className, setClassName] = React.useState('');
  const [classImage, setClassImage] = React.useState<File | null>(null);
  const [classOuterColor, setClassOuterColor] = React.useState('#f8fafc');
  const [isClassFormOpen, setIsClassFormOpen] = React.useState(false);
  const [editingClassId, setEditingClassId] = React.useState<string | null>(null);
  const classImageInputRef = React.useRef<HTMLInputElement | null>(null);

  const [classCourses, setClassCourses] = React.useState<CourseRow[]>([]);
  const [isClassCoursesLoading, setIsClassCoursesLoading] = React.useState(false);
  const [isCreateCourseModalOpen, setIsCreateCourseModalOpen] = React.useState(false);
  const [isEditCourseModalOpen, setIsEditCourseModalOpen] = React.useState(false);
  const [isClassCourseCreating, setIsClassCourseCreating] = React.useState(false);
  const [isClassCourseUpdating, setIsClassCourseUpdating] = React.useState(false);
  const [deletingCourseId, setDeletingCourseId] = React.useState<string | null>(null);

  const [newCourseName, setNewCourseName] = React.useState('');
  const [newCourseImage, setNewCourseImage] = React.useState<File | null>(null);
  const [newCourseError, setNewCourseError] = React.useState<string | null>(null);
  const newCourseImageInputRef = React.useRef<HTMLInputElement | null>(null);

  const [editCourseId, setEditCourseId] = React.useState<string | null>(null);
  const [editCourseName, setEditCourseName] = React.useState('');
  const [editCourseCurrentImageUrl, setEditCourseCurrentImageUrl] = React.useState<string | null>(null);
  const [editCourseImage, setEditCourseImage] = React.useState<File | null>(null);
  const [editCourseError, setEditCourseError] = React.useState<string | null>(null);
  const editCourseImageInputRef = React.useRef<HTMLInputElement | null>(null);

  const [contextType, setContextType] = React.useState<AttendanceContextType>('class');
  const [selectedAttendanceContextId, setSelectedAttendanceContextId] = React.useState<string>('');
  const [attendanceDate, setAttendanceDate] = React.useState(getTodayIsoDate());
  const [attendanceMap, setAttendanceMap] = React.useState<Record<string, AttendanceStatus>>({});
  const [isAttendanceLoading, setIsAttendanceLoading] = React.useState(false);
  const [isAttendanceSaving, setIsAttendanceSaving] = React.useState(false);
  const [deletingAttendanceStudentId, setDeletingAttendanceStudentId] = React.useState<string | null>(null);
  const [linkedAttendanceStudents, setLinkedAttendanceStudents] = React.useState<AttendanceStudent[]>([]);
  const [isLinkedAttendanceStudentsLoading, setIsLinkedAttendanceStudentsLoading] = React.useState(false);

  const safeNotify = React.useCallback((message: string) => {
    if (notify) notify(message);
  }, [notify]);

  const uploadImage = React.useCallback(async (bucket: string, file: File, prefix: string) => {
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${prefix}-${Date.now()}-${sanitizedName}`;

    const uploadResult = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
    if (uploadResult.error) throw uploadResult.error;

    const publicResult = supabase.storage.from(bucket).getPublicUrl(path);
    if (!publicResult?.data?.publicUrl) {
      throw new Error('Failed to resolve uploaded image URL.');
    }

    return publicResult.data.publicUrl;
  }, []);

  const loadClasses = React.useCallback(async () => {
    const { data, error } = await supabase
      .from('classes')
      .select('*, class_students(student_id)')
      .order('created_at', { ascending: false });

    if (error) {
      safeNotify(`Failed to load classes: ${error.message}`);
      return;
    }

    const next = (data || []).map((row: any) => ({
      ...row,
      student_count: (row.class_students || []).length,
      student_ids: (row.class_students || []).map((relation: any) => String(relation.student_id)),
      outer_color: row.outer_color || row.color || '#f8fafc',
    }));

    setClasses(next);
  }, [safeNotify]);

  React.useEffect(() => {
    void loadClasses();
  }, [loadClasses]);

  React.useEffect(() => {
    const q = classSearchQuery.trim().toLowerCase();
    if (!q) {
      setFilteredClasses(classes);
      return;
    }

    setFilteredClasses(
      classes.filter(c => {
        const name = String(c.name || '').toLowerCase();
        const code = String(c.class_code || '').toLowerCase();
        return name.includes(q) || code.includes(q);
      })
    );
  }, [classes, classSearchQuery]);

  const selectedClass = React.useMemo(
    () => classes.find(c => String(c.id) === String(selectedClassId)) || null,
    [classes, selectedClassId]
  );

  const resetClassForm = () => {
    setClassName('');
    setClassImage(null);
    setClassOuterColor('#f8fafc');
    setEditingClassId(null);
    if (classImageInputRef.current) classImageInputRef.current.value = '';
  };

  const createOrUpdateClass = async () => {
    if (!className.trim()) {
      safeNotify('Please enter class name.');
      return;
    }

    try {
      let imageUrl: string | null = null;
      if (classImage) {
        imageUrl = await uploadImage(CLASS_IMAGE_BUCKET, classImage, 'class');
      }

      if (editingClassId) {
        const payload: any = {
          name: className.trim(),
          outer_color: classOuterColor,
          color: classOuterColor,
        };
        if (imageUrl) payload.image_url = imageUrl;

        const { error } = await supabase.from('classes').update(payload).eq('id', editingClassId);
        if (error) throw error;

        safeNotify('Class updated.');
      } else {
        const payload: any = {
          name: className.trim(),
          outer_color: classOuterColor,
          color: classOuterColor,
        };
        if (imageUrl) payload.image_url = imageUrl;

        const { error } = await supabase.from('classes').insert([payload]);
        if (error) throw error;

        safeNotify('Class created.');
      }

      resetClassForm();
      setIsClassFormOpen(false);
      await loadClasses();
    } catch (error: any) {
      safeNotify(`Class save failed: ${error?.message || 'Unknown error'}`);
    }
  };

  const startEditClass = (classItem: ClassRow) => {
    setEditingClassId(String(classItem.id));
    setClassName(String(classItem.name || ''));
    setClassOuterColor(String(classItem.outer_color || classItem.color || '#f8fafc'));
    setClassImage(null);
    if (classImageInputRef.current) classImageInputRef.current.value = '';
    setIsClassFormOpen(true);
  };

  const deleteClass = async (classId: string) => {
    const { error } = await supabase.from('classes').delete().eq('id', classId);
    if (error) {
      safeNotify(`Delete failed: ${error.message}`);
      return;
    }

    safeNotify('Class deleted.');
    if (selectedClassId === classId) {
      setSelectedClassId(null);
      setClassCourses([]);
    }
    await loadClasses();
  };

  const loadClassCourses = React.useCallback(async (classId: string) => {
    if (!classId) {
      setClassCourses([]);
      return;
    }

    setIsClassCoursesLoading(true);
    const { data, error } = await supabase
      .from('class_courses')
      .select('*')
      .eq('class_id', classId)
      .order('created_at', { ascending: false });

    setIsClassCoursesLoading(false);

    if (error) {
      safeNotify(`Failed to load courses: ${error.message}`);
      setClassCourses([]);
      return;
    }

    setClassCourses((data || []).map((row: any) => ({
      id: String(row.id),
      name: String(row.name || ''),
      class_id: String(row.class_id),
      image_url: row.image_url || null,
    })));
  }, [safeNotify]);

  React.useEffect(() => {
    if (!selectedClassId) {
      setClassCourses([]);
      return;
    }
    void loadClassCourses(selectedClassId);
  }, [selectedClassId, loadClassCourses]);

  React.useEffect(() => {
    if (contextType === 'class' && selectedClassId) {
      setSelectedAttendanceContextId(String(selectedClassId));
    }
  }, [contextType, selectedClassId]);

  const loadLinkedAttendanceStudents = React.useCallback(async () => {
    if (!selectedAttendanceContextId) {
      setLinkedAttendanceStudents([]);
      return;
    }

    const filterColumn = contextType === 'class' ? 'class_id' : 'class_course_id';
    setIsLinkedAttendanceStudentsLoading(true);

    const { data, error } = await supabase
      .from('class_course_students')
      .select('student_id, student_name, created_at')
      .eq(filterColumn, selectedAttendanceContextId)
      .order('created_at', { ascending: true });

    setIsLinkedAttendanceStudentsLoading(false);

    if (error) {
      console.error('Failed to load linked attendance students:', error);
      setLinkedAttendanceStudents([]);
      return;
    }

    const seen = new Set<string>();
    const mapped: AttendanceStudent[] = [];

    (data || []).forEach((row: any) => {
      const id = String(row?.student_id || '').trim();
      if (!id || seen.has(id)) return;
      seen.add(id);
      mapped.push({
        id,
        name: String(row?.student_name || '').trim() || id,
      });
    });

    setLinkedAttendanceStudents(mapped);
  }, [contextType, selectedAttendanceContextId]);

  React.useEffect(() => {
    void loadLinkedAttendanceStudents();
  }, [loadLinkedAttendanceStudents]);

  const createClassCourse = async () => {
    if (!selectedClassId) {
      setNewCourseError('Select class first.');
      return;
    }

    if (!newCourseName.trim()) {
      setNewCourseError('Course name is required.');
      return;
    }

    setIsClassCourseCreating(true);
    try {
      let imageUrl: string | null = null;
      if (newCourseImage) {
        imageUrl = await uploadImage(COURSE_PROFILE_BUCKET, newCourseImage, 'course');
      }

      const payload: any = {
        class_id: selectedClassId,
        name: newCourseName.trim(),
      };
      if (imageUrl) payload.image_url = imageUrl;

      const { error } = await supabase.from('class_courses').insert([payload]);
      if (error) throw error;

      setIsCreateCourseModalOpen(false);
      setNewCourseName('');
      setNewCourseImage(null);
      setNewCourseError(null);
      if (newCourseImageInputRef.current) newCourseImageInputRef.current.value = '';
      safeNotify('Course created.');
      await loadClassCourses(selectedClassId);
    } catch (error: any) {
      setNewCourseError(error?.message || 'Course create failed.');
    } finally {
      setIsClassCourseCreating(false);
    }
  };

  const openEditCourseModal = (course: CourseRow) => {
    setEditCourseId(course.id);
    setEditCourseName(course.name);
    setEditCourseCurrentImageUrl(course.image_url || null);
    setEditCourseImage(null);
    setEditCourseError(null);
    if (editCourseImageInputRef.current) editCourseImageInputRef.current.value = '';
    setIsEditCourseModalOpen(true);
  };

  const closeEditCourseModal = () => {
    setEditCourseId(null);
    setEditCourseName('');
    setEditCourseCurrentImageUrl(null);
    setEditCourseImage(null);
    setEditCourseError(null);
    if (editCourseImageInputRef.current) editCourseImageInputRef.current.value = '';
    setIsEditCourseModalOpen(false);
  };

  const saveCourseEdits = async () => {
    if (!editCourseId) return;
    if (!editCourseName.trim()) {
      setEditCourseError('Course name is required.');
      return;
    }

    setIsClassCourseUpdating(true);
    try {
      let imageUrl = editCourseCurrentImageUrl;
      if (editCourseImage) {
        imageUrl = await uploadImage(COURSE_PROFILE_BUCKET, editCourseImage, 'course');
      }

      const { error } = await supabase
        .from('class_courses')
        .update({ name: editCourseName.trim(), image_url: imageUrl })
        .eq('id', editCourseId);

      if (error) throw error;

      safeNotify('Course updated.');
      closeEditCourseModal();
      if (selectedClassId) await loadClassCourses(selectedClassId);
    } catch (error: any) {
      setEditCourseError(error?.message || 'Course update failed.');
    } finally {
      setIsClassCourseUpdating(false);
    }
  };

  const deleteClassCourse = async (course: CourseRow) => {
    setDeletingCourseId(course.id);
    const { error } = await supabase.from('class_courses').delete().eq('id', course.id);
    setDeletingCourseId(null);

    if (error) {
      safeNotify(`Delete failed: ${error.message}`);
      return;
    }

    safeNotify('Course deleted.');
    if (selectedClassId) await loadClassCourses(selectedClassId);
  };

  const activeContextList = React.useMemo(
    () => (contextType === 'class'
      ? classes.map(classItem => ({ id: String(classItem.id), name: String(classItem.name || '') }))
      : subjects),
    [contextType, classes, subjects]
  );

  React.useEffect(() => {
    if (!activeContextList.length) {
      setSelectedAttendanceContextId('');
      return;
    }

    const exists = activeContextList.some(item => String(item.id) === String(selectedAttendanceContextId));
    if (!exists) {
      setSelectedAttendanceContextId(String(activeContextList[0].id));
    }
  }, [activeContextList, selectedAttendanceContextId]);

  const fallbackAttendanceStudents = React.useMemo(() => {
    if (!selectedAttendanceContextId) return [] as Student[];

    if (contextType === 'class') {
      const selectedClassForAttendance = classes.find(classItem => String(classItem.id) === String(selectedAttendanceContextId));
      const classStudentIds = (selectedClassForAttendance?.student_ids || []).map(id => String(id));
      const sourceStudents = allStudents && allStudents.length > 0 ? allStudents : students;
      return sourceStudents.filter(student => classStudentIds.includes(String(student.id)));
    }

    return students;
  }, [selectedAttendanceContextId, contextType, classes, allStudents, students]);

  const activeAttendanceStudents = React.useMemo(() => {
    if (linkedAttendanceStudents.length > 0) {
      return linkedAttendanceStudents;
    }

    return fallbackAttendanceStudents.map(student => ({
      id: String(student.id),
      name: String(student.name || ''),
      email: String(student.email || ''),
    }));
  }, [linkedAttendanceStudents, fallbackAttendanceStudents]);

  const loadAttendance = React.useCallback(async () => {
    if (!selectedAttendanceContextId || !attendanceDate) return;

    setIsAttendanceLoading(true);

    const contextTypeCandidates = contextType === 'class'
      ? ['class', 'batch']
      : ['subject', 'course', 'class_course'];

    const primaryResult = await supabase
      .from('attendance_records')
      .select('student_id, status, context_type')
      .in('context_type', contextTypeCandidates)
      .eq('context_id', selectedAttendanceContextId)
      .eq('attendance_date', attendanceDate);

    let data: any[] | null = (primaryResult.data as any[] | null);
    let error = primaryResult.error;

    if (!error && (!data || data.length === 0)) {
      const fallbackResult = await supabase
        .from('attendance_records')
        .select('student_id, status')
        .eq('context_id', selectedAttendanceContextId)
        .eq('attendance_date', attendanceDate);

      data = (fallbackResult.data as any[] | null);
      error = fallbackResult.error;
    }

    setIsAttendanceLoading(false);

    if (error) {
      safeNotify(`Failed to load attendance: ${error.message}`);
      return;
    }

    const nextMap: Record<string, AttendanceStatus> = {};
    (data || []).forEach((row: any) => {
      const normalizedStatus = normalizeAttendanceStatus(row.status);
      if (!normalizedStatus) return;
      nextMap[String(row.student_id)] = normalizedStatus;
    });

    setAttendanceMap(nextMap);
  }, [selectedAttendanceContextId, attendanceDate, contextType, safeNotify]);

  React.useEffect(() => {
    void loadAttendance();
  }, [loadAttendance]);

  const saveSingleAttendance = async (studentId: string, status: AttendanceStatus) => {
    if (!selectedAttendanceContextId || !attendanceDate) return;

    setIsAttendanceSaving(true);

    const payload = {
      context_type: contextType,
      context_id: selectedAttendanceContextId,
      attendance_date: attendanceDate,
      student_id: String(studentId),
      status,
    };

    const upsertResult = await supabase
      .from('attendance_records')
      .upsert([payload], { onConflict: 'context_type,context_id,attendance_date,student_id' });

    setIsAttendanceSaving(false);

    if (upsertResult.error) {
      safeNotify(`Failed to save attendance: ${upsertResult.error.message}`);
      return;
    }

    setAttendanceMap(prev => ({ ...prev, [String(studentId)]: status }));
  };

  const markAllPresent = async () => {
    if (!selectedAttendanceContextId || !attendanceDate || activeAttendanceStudents.length === 0) {
      safeNotify('No students available to mark.');
      return;
    }

    setIsAttendanceSaving(true);

    const payload = activeAttendanceStudents.map(student => ({
      context_type: contextType,
      context_id: selectedAttendanceContextId,
      attendance_date: attendanceDate,
      student_id: String(student.id),
      status: 'P' as const,
    }));

    const upsertResult = await supabase
      .from('attendance_records')
      .upsert(payload, { onConflict: 'context_type,context_id,attendance_date,student_id' });

    setIsAttendanceSaving(false);

    if (upsertResult.error) {
      safeNotify(`Failed to bulk save attendance: ${upsertResult.error.message}`);
      return;
    }

    const nextMap: Record<string, AttendanceStatus> = {};
    activeAttendanceStudents.forEach(student => {
      nextMap[String(student.id)] = 'P';
    });

    setAttendanceMap(nextMap);
    safeNotify('All students marked Present.');
  };

  const removeAttendanceStudent = async (studentId: string) => {
    if (!selectedAttendanceContextId) {
      safeNotify('No attendance context selected.');
      return;
    }

    setDeletingAttendanceStudentId(studentId);

    try {
      if (contextType === 'class') {
        const enrollmentDelete = await supabase
          .from('class_course_students')
          .delete()
          .eq('class_id', selectedAttendanceContextId)
          .eq('student_id', studentId);

        if (enrollmentDelete.error) throw enrollmentDelete.error;

        const classRelationDelete = await supabase
          .from('class_students')
          .delete()
          .eq('class_id', selectedAttendanceContextId)
          .eq('student_id', studentId);

        if (classRelationDelete.error) {
          console.error('Failed to delete class_students relation:', classRelationDelete.error);
        }
      } else {
        const enrollmentDelete = await supabase
          .from('class_course_students')
          .delete()
          .eq('class_course_id', selectedAttendanceContextId)
          .eq('student_id', studentId);

        if (enrollmentDelete.error) throw enrollmentDelete.error;
      }

      const contextTypeCandidates = contextType === 'class'
        ? ['class', 'batch']
        : ['subject', 'course', 'class_course'];

      const attendanceDelete = await supabase
        .from('attendance_records')
        .delete()
        .eq('context_id', selectedAttendanceContextId)
        .eq('student_id', studentId)
        .in('context_type', contextTypeCandidates);

      if (attendanceDelete.error) {
        console.error('Failed to delete attendance records:', attendanceDelete.error);
      }

      setAttendanceMap(prev => {
        const next = { ...prev };
        delete next[studentId];
        return next;
      });

      await loadLinkedAttendanceStudents();
      safeNotify('Student removed from Supabase successfully.');
    } catch (error: any) {
      safeNotify(`Delete failed: ${error?.message || 'Unknown error'}`);
    } finally {
      setDeletingAttendanceStudentId(null);
    }
  };

  return (
    <div className="space-y-8">
      <div className="bg-white dark:bg-slate-900 rounded-[32px] p-6 sm:p-8 border border-slate-100 dark:border-slate-800 shadow-premium space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight">{editingClassId ? 'Edit Class' : 'Create Class'}</h2>
            <p className="text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] text-slate-400 mt-2">
              {editingClassId ? 'Update class appearance and details' : 'Build a class profile'}
            </p>
          </div>
          <button
            onClick={() => setIsClassFormOpen(prev => !prev)}
            className="px-4 py-2 rounded-xl bg-brand-50 text-brand-500 border border-brand-100 text-[10px] font-black uppercase tracking-widest flex items-center gap-2"
          >
            <i className={`fas ${isClassFormOpen ? 'fa-chevron-up' : 'fa-chevron-down'}`}></i>
            {isClassFormOpen ? 'Hide Form' : 'Create Class'}
          </button>
        </div>

        {isClassFormOpen && (
          <>
            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Class Name</label>
              <input
                type="text"
                placeholder="Enter class name"
                value={className}
                onChange={(e) => setClassName(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border-2 border-transparent focus:border-brand-500 outline-none font-bold"
              />
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Class Image</label>
              <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-4">
                <input
                  ref={classImageInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    if (e.target.files?.[0]) setClassImage(e.target.files[0]);
                  }}
                  className="w-full text-xs font-semibold text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-brand-500 file:text-white"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Image Area Color</label>
              <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-3 flex items-center gap-3">
                <input
                  type="color"
                  value={classOuterColor}
                  onChange={(e) => setClassOuterColor(e.target.value)}
                  className="w-12 h-10 rounded-lg cursor-pointer"
                />
                <span className="text-xs font-black uppercase tracking-widest text-slate-500">{classOuterColor}</span>
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              {editingClassId && (
                <button
                  onClick={resetClassForm}
                  className="px-6 py-3 rounded-2xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-100 text-xs font-black uppercase tracking-widest"
                >
                  Cancel
                </button>
              )}
              <button
                onClick={() => void createOrUpdateClass()}
                className="px-8 py-3 rounded-2xl bg-brand-500 text-white text-xs font-black uppercase tracking-widest"
              >
                {editingClassId ? 'Update Class' : 'Create Class'}
              </button>
            </div>
          </>
        )}
      </div>

      {classes.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-[32px] p-6 sm:p-8 border border-slate-100 dark:border-slate-800 shadow-premium space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Created Classes</p>
            <input
              type="text"
              value={classSearchQuery}
              onChange={(e) => setClassSearchQuery(e.target.value)}
              placeholder="Search classes"
              className="w-full sm:w-72 bg-slate-50 dark:bg-slate-800 p-3 rounded-2xl border border-slate-100 dark:border-slate-700 outline-none font-semibold text-sm"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredClasses.map((classItem) => (
              <div
                key={classItem.id}
                onClick={() => setSelectedClassId(String(classItem.id))}
                className={`rounded-2xl border overflow-hidden cursor-pointer hover:-translate-y-1 transition-all ${selectedClassId === String(classItem.id) ? 'border-brand-400' : 'border-slate-100 dark:border-slate-700'}`}
                style={{ backgroundColor: '#f8fafc' }}
              >
                <div className="flex justify-end p-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      startEditClass(classItem);
                    }}
                    className="w-8 h-8 mr-2 rounded-lg bg-white dark:bg-slate-900 text-slate-400 hover:text-brand-500 border border-slate-100 dark:border-slate-700 flex items-center justify-center"
                    title="Edit class"
                  >
                    <i className="fas fa-pen"></i>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      void deleteClass(String(classItem.id));
                    }}
                    className="w-8 h-8 rounded-lg bg-white dark:bg-slate-900 text-slate-400 hover:text-rose-500 border border-slate-100 dark:border-slate-700 flex items-center justify-center"
                    title="Delete class"
                  >
                    <i className="fas fa-trash"></i>
                  </button>
                </div>

                <div className="w-full aspect-square" style={{ backgroundColor: classItem.color || classItem.outer_color || '#f8fafc' }}>
                  {classItem.image_url ? (
                    <img src={classItem.image_url} alt={classItem.name} className="w-full h-full object-contain" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs font-black uppercase tracking-widest">
                      No Image
                    </div>
                  )}
                </div>

                <div className="p-3 space-y-1 bg-white dark:bg-slate-900">
                  <p className="font-black text-sm truncate">{classItem.name}</p>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{classItem.class_code || 'class-code'}</p>
                  <p className="text-[10px] font-black uppercase tracking-widest text-brand-500">{classItem.student_count || 0} Students</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedClass && (
        <div className="bg-white dark:bg-slate-900 rounded-[24px] sm:rounded-[32px] p-4 sm:p-6 border border-slate-100 dark:border-slate-800 shadow-premium">
          <div className="flex items-center justify-between gap-3 mb-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Courses</p>
            <span className="text-[10px] font-black uppercase tracking-widest text-brand-500">{classCourses.length} Course Blocks</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            <button
              onClick={() => {
                if (isClassCourseCreating) return;
                setIsCreateCourseModalOpen(true);
                setNewCourseName('');
                setNewCourseImage(null);
                setNewCourseError(null);
              }}
              disabled={isClassCourseCreating}
              className={`aspect-square rounded-2xl border-2 border-dashed border-brand-300 flex items-center justify-center text-4xl font-black ${isClassCourseCreating ? 'bg-brand-100 text-brand-300 cursor-not-allowed' : 'bg-slate-50 dark:bg-slate-800 text-brand-500 hover:-translate-y-0.5'} transition-all`}
              title="Create course"
            >
              +
            </button>

            {isClassCoursesLoading && (
              <div className="col-span-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-500">
                Loading courses...
              </div>
            )}

            {!isClassCoursesLoading && classCourses.map(course => (
              <div
                key={course.id}
                className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-left hover:-translate-y-0.5 transition-all relative"
              >
                <div className="absolute top-2 right-2 flex gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openEditCourseModal(course);
                    }}
                    className="w-8 h-8 rounded-lg bg-white dark:bg-slate-900 text-slate-400 hover:text-brand-500 border border-slate-100 dark:border-slate-700 flex items-center justify-center"
                    title="Edit course"
                  >
                    <i className="fas fa-pen text-xs"></i>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      void deleteClassCourse(course);
                    }}
                    disabled={deletingCourseId === course.id}
                    className={`w-8 h-8 rounded-lg bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-700 flex items-center justify-center ${deletingCourseId === course.id ? 'text-slate-300 cursor-not-allowed' : 'text-slate-400 hover:text-rose-500'}`}
                    title="Delete course"
                  >
                    <i className="fas fa-trash text-xs"></i>
                  </button>
                </div>

                <button
                  onClick={() => {
                    if (onOpenCoursePage) {
                      onOpenCoursePage({
                        id: course.id,
                        name: course.name,
                        classId: course.class_id,
                        className: selectedClass?.name,
                      });
                      return;
                    }
                    safeNotify('Course page navigation is not configured.');
                  }}
                  className="w-full text-left"
                  title="Open course page"
                >
                  {course.image_url ? (
                    <div className="w-full aspect-square rounded-xl overflow-hidden mb-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
                      <img src={course.image_url} alt={course.name} className="w-full h-full object-cover" />
                    </div>
                  ) : null}
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Course</p>
                  <p className="text-sm font-black text-brand-500 mt-1 line-clamp-3">{course.name}</p>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {isCreateCourseModalOpen && (
        <div className="fixed inset-0 z-[230] bg-slate-950/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between gap-4">
              <h3 className="text-xl font-black tracking-tight">Create Course</h3>
              <button
                onClick={() => {
                  if (isClassCourseCreating) return;
                  setIsCreateCourseModalOpen(false);
                  setNewCourseName('');
                  setNewCourseImage(null);
                  setNewCourseError(null);
                }}
                className="w-10 h-10 rounded-full hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-400"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Course Name</label>
              <input
                type="text"
                value={newCourseName}
                onChange={(e) => {
                  setNewCourseName(e.target.value);
                  if (newCourseError) setNewCourseError(null);
                }}
                placeholder="Enter course name"
                className="w-full bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border-2 border-transparent focus:border-brand-500 outline-none font-bold"
              />
              {newCourseError && <p className="text-xs font-bold text-rose-500">{newCourseError}</p>}
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Course Profile Image</label>
              <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-3">
                <button
                  type="button"
                  onClick={() => newCourseImageInputRef.current?.click()}
                  className="px-4 py-2 rounded-xl bg-brand-500 text-white text-[10px] font-black uppercase tracking-widest"
                >
                  Add Image
                </button>
                <input
                  ref={newCourseImageInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    if (e.target.files?.[0]) setNewCourseImage(e.target.files[0]);
                  }}
                  className="hidden"
                />
                {newCourseImage && (
                  <p className="mt-2 text-[11px] text-slate-500 truncate">Selected: {newCourseImage.name}</p>
                )}
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
              <button
                onClick={() => {
                  if (isClassCourseCreating) return;
                  setIsCreateCourseModalOpen(false);
                  setNewCourseName('');
                  setNewCourseImage(null);
                  setNewCourseError(null);
                }}
                className="px-6 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-black uppercase tracking-widest"
              >
                Cancel
              </button>
              <button
                onClick={() => void createClassCourse()}
                disabled={isClassCourseCreating}
                className={`px-6 py-3 rounded-2xl text-white text-xs font-black uppercase tracking-widest ${isClassCourseCreating ? 'bg-brand-300 cursor-not-allowed' : 'bg-brand-500'}`}
              >
                {isClassCourseCreating ? 'Creating...' : 'Create Course'}
              </button>
            </div>
          </div>
        </div>
      )}

      {isEditCourseModalOpen && (
        <div className="fixed inset-0 z-[230] bg-slate-950/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between gap-4">
              <h3 className="text-xl font-black tracking-tight">Edit Course</h3>
              <button onClick={closeEditCourseModal} className="w-10 h-10 rounded-full hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-400">
                <i className="fas fa-times"></i>
              </button>
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Course Name</label>
              <input
                type="text"
                value={editCourseName}
                onChange={(e) => {
                  setEditCourseName(e.target.value);
                  if (editCourseError) setEditCourseError(null);
                }}
                placeholder="Enter course name"
                className="w-full bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border-2 border-transparent focus:border-brand-500 outline-none font-bold"
              />
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Course Profile Image</label>
              <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-3 space-y-3">
                {(editCourseImage || editCourseCurrentImageUrl) && (
                  <div className="w-full aspect-square rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
                    <img src={editCourseImage ? URL.createObjectURL(editCourseImage) : String(editCourseCurrentImageUrl)} alt="Course preview" className="w-full h-full object-cover" />
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => editCourseImageInputRef.current?.click()}
                    className="px-4 py-2 rounded-xl bg-brand-500 text-white text-[10px] font-black uppercase tracking-widest"
                  >
                    Change Image
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditCourseImage(null);
                      setEditCourseCurrentImageUrl(null);
                      if (editCourseImageInputRef.current) editCourseImageInputRef.current.value = '';
                    }}
                    className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-[10px] font-black uppercase tracking-widest"
                  >
                    Remove Image
                  </button>
                </div>

                <input
                  ref={editCourseImageInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    if (e.target.files?.[0]) setEditCourseImage(e.target.files[0]);
                  }}
                  className="hidden"
                />
              </div>
            </div>

            {editCourseError && <p className="text-xs font-bold text-rose-500">{editCourseError}</p>}

            <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
              <button onClick={closeEditCourseModal} className="px-6 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-black uppercase tracking-widest">
                Cancel
              </button>
              <button
                onClick={() => void saveCourseEdits()}
                disabled={isClassCourseUpdating}
                className={`px-6 py-3 rounded-2xl text-white text-xs font-black uppercase tracking-widest ${isClassCourseUpdating ? 'bg-brand-300 cursor-not-allowed' : 'bg-brand-500'}`}
              >
                {isClassCourseUpdating ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      <section className="space-y-6">
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 p-5 sm:p-6">
          <h2 className="text-xl sm:text-2xl font-black tracking-tight">Daily Attendance</h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">Integrated attendance section (class/subject).</p>

          <div className="mt-5 grid grid-cols-1 md:grid-cols-4 gap-3">
            <select
              value={contextType}
              onChange={(e) => setContextType(e.target.value as AttendanceContextType)}
              className="w-full bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 outline-none"
            >
              <option value="class">Class Attendance</option>
              <option value="subject">Subject Attendance</option>
            </select>

            <select
              value={selectedAttendanceContextId}
              onChange={(e) => setSelectedAttendanceContextId(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 outline-none md:col-span-2"
            >
              {!activeContextList.length && <option value="">No options available</option>}
              {activeContextList.map(item => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>

            <input
              type="date"
              value={attendanceDate}
              onChange={(e) => setAttendanceDate(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 outline-none"
            />
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void loadAttendance()}
              disabled={isAttendanceLoading || isAttendanceSaving || !selectedAttendanceContextId}
              className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest ${isAttendanceLoading || isAttendanceSaving || !selectedAttendanceContextId ? 'bg-slate-300 text-slate-600 cursor-not-allowed' : 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'}`}
            >
              {isAttendanceLoading ? 'Loading...' : 'Reload'}
            </button>
            <button
              type="button"
              onClick={() => void markAllPresent()}
              disabled={isAttendanceLoading || isAttendanceSaving || activeAttendanceStudents.length === 0}
              className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest ${isAttendanceLoading || isAttendanceSaving || activeAttendanceStudents.length === 0 ? 'bg-emerald-200 text-emerald-700 cursor-not-allowed' : 'bg-emerald-500 text-white'}`}
            >
              {isAttendanceSaving ? 'Saving...' : 'Mark All Present'}
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="px-5 sm:px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <h3 className="text-sm sm:text-base font-black">Students ({activeAttendanceStudents.length})</h3>
            <span className="text-[11px] font-bold text-slate-500">P = Present, A = Absent, L = Leave</span>
          </div>

          {isLinkedAttendanceStudentsLoading ? (
            <p className="p-6 text-sm text-slate-500">Loading students from class_course_students...</p>
          ) : activeAttendanceStudents.length === 0 ? (
            <p className="p-6 text-sm text-slate-500">No students available for this context.</p>
          ) : (
            <ul className="divide-y divide-slate-200 dark:divide-slate-700">
              {activeAttendanceStudents.map(student => {
                const currentStatus = attendanceMap[String(student.id)] || '-';
                return (
                  <li key={student.id} className="px-5 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <p className="font-bold text-slate-900 dark:text-slate-100">{student.name}</p>
                      <p className="text-xs text-slate-500">{student.email || student.id}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-500 mr-1">Current: {currentStatus}</span>
                      {(['P', 'A', 'L'] as AttendanceStatus[]).map(status => {
                        const active = currentStatus === status;
                        return (
                          <button
                            key={status}
                            type="button"
                            onClick={() => void saveSingleAttendance(String(student.id), status)}
                            disabled={isAttendanceSaving || isAttendanceLoading}
                            className={`w-9 h-9 rounded-lg text-xs font-black ${active ? 'bg-brand-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200'}`}
                          >
                            {status}
                          </button>
                        );
                      })}
                      <button
                        type="button"
                        onClick={() => void removeAttendanceStudent(String(student.id))}
                        disabled={deletingAttendanceStudentId === String(student.id) || isAttendanceSaving || isAttendanceLoading}
                        className={`w-9 h-9 rounded-lg border flex items-center justify-center ${deletingAttendanceStudentId === String(student.id) ? 'text-slate-300 border-slate-200 cursor-not-allowed' : 'text-slate-400 border-slate-300 hover:text-rose-500 hover:border-rose-300'}`}
                        title="Delete from Supabase"
                      >
                        <i className="fas fa-trash text-xs"></i>
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
};

export default ClassAndCoursesManager;
