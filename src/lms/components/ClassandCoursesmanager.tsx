import React from 'react';
import { supabase } from '../src/supabaseClient';
import { getCurrentTenantContext, withSchoolId } from '../services/tenantService';
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
  onOpenClassPage?: (classItem: { id: string; name: string }) => void;
  schoolId?: string;
  userRole?: string;
  assignedClassIds?: string[];
  assignedCourseIds?: string[];
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

const ClassAndCoursesManager: React.FC<ClassAndCoursesManagerProps> = ({ 
  students: initialStudents = [], 
  allStudents: initialAllStudents, 
  subjects: initialSubjects = [], 
  notify, 
  onOpenCoursePage,
  onOpenClassPage,
  schoolId: propSchoolId,
  userRole,
  assignedClassIds: propAssignedClassIds = [],
  assignedCourseIds: propAssignedCourseIds = []
}) => {
  const [classes, setClasses] = React.useState<ClassRow[]>([]);
  const [filteredClasses, setFilteredClasses] = React.useState<ClassRow[]>([]);
  const [classSearchQuery, setClassSearchQuery] = React.useState('');
  const [selectedClassId, setSelectedClassId] = React.useState<string | null>(null);

  const [className, setClassName] = React.useState('');
  const [classImage, setClassImage] = React.useState<File | null>(null);
  const [classOuterColor, setClassOuterColor] = React.useState('#4ea59d');
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

  // Self-Fetching Logic for Students and Subjects (Courses)
  const [internalStudents, setInternalStudents] = React.useState<Student[]>(initialStudents);
  const [internalSubjects, setInternalSubjects] = React.useState<LightweightSubject[]>(initialSubjects);

  const safeNotify = React.useCallback((message: string) => {
    if (notify) notify(message);
  }, [notify]);

  const loadBaseData = React.useCallback(async () => {
    if (!supabase || !propSchoolId) return;
    try {
      const schoolId = propSchoolId;
      
      // Load Students if not provided
      if (initialStudents.length === 0) {
        const { data: sData } = await supabase.from('students').select('*').eq('school_id', schoolId);
        if (sData) setInternalStudents(sData as Student[]);
      }

      // Load Subjects (Catalog Courses) if not provided
      if (initialSubjects.length === 0) {
        const { data: cData } = await supabase.from('class_courses').select('id, name').eq('school_id', schoolId).limit(50);
        if (cData) setInternalSubjects(cData as LightweightSubject[]);
      }
    } catch (e) {
      console.error('Failed to load base data', e);
    }
  }, [initialStudents, initialSubjects, propSchoolId]);

  React.useEffect(() => {
    void loadBaseData();
  }, [loadBaseData]);

  const uploadImage = React.useCallback(async (bucket: string, file: File, prefix: string) => {
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${prefix}-${Date.now()}-${sanitizedName}`;

    if (!supabase) throw new Error('Supabase client not initialized.');
    
    const uploadResult = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
    if (uploadResult.error) throw uploadResult.error;

    const publicResult = supabase.storage.from(bucket).getPublicUrl(path);
    if (!publicResult?.data?.publicUrl) {
      throw new Error('Failed to resolve uploaded image URL.');
    }

    return publicResult.data.publicUrl;
  }, []);

  const loadClasses = React.useCallback(async () => {
    if (!supabase || !propSchoolId) return;
    
    let query = supabase
      .from('classes')
      .select('*, class_course_students(student_id)')
      .eq('school_id', propSchoolId);

    if (propAssignedClassIds && propAssignedClassIds.length > 0) {
      query = query.in('id', propAssignedClassIds);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      safeNotify(`Failed to load classes: ${error.message}`);
      return;
    }

    const next = (data || []).map((row: any) => ({
      ...row,
      student_count: Array.from(new Set((row.class_course_students || []).map((relation: any) => String(relation.student_id)))).length,
      student_ids: Array.from(new Set((row.class_course_students || []).map((relation: any) => String(relation.student_id)))),
      outer_color: row.outer_color || row.color || '#134e4a',
    }));

    setClasses(next);
  }, [safeNotify, propSchoolId, propAssignedClassIds]);

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
    setClassOuterColor('#4ea59d');
    setEditingClassId(null);
    if (classImageInputRef.current) classImageInputRef.current.value = '';
  };

  const createOrUpdateClass = async () => {
    if (!className.trim()) {
      safeNotify('Please enter class name.');
      return;
    }

    try {
      const { schoolId } = await getCurrentTenantContext();
      let imageUrl: string | null = null;
      if (classImage) {
        imageUrl = await uploadImage(CLASS_IMAGE_BUCKET, classImage, 'class');
      }

      const payload: any = withSchoolId({
        name: className.trim(),
        outer_color: classOuterColor,
        color: classOuterColor,
      }, schoolId);
      if (imageUrl) payload.image_url = imageUrl;

      if (editingClassId) {
        if (!supabase) throw new Error('Supabase client not initialized.');
        const { error } = await supabase.from('classes').update(payload).eq('id', editingClassId);
        if (error) throw error;
        safeNotify('Class updated.');
      } else {
        if (!supabase) throw new Error('Supabase client not initialized.');
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
    setClassOuterColor(String(classItem.outer_color || classItem.color || '#134e4a'));
    setClassImage(null);
    if (classImageInputRef.current) classImageInputRef.current.value = '';
    setIsClassFormOpen(true);
  };

  const deleteClass = async (classId: string) => {
    if (!supabase) return;
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
    if (!supabase) {
      setIsClassCoursesLoading(false);
      return;
    }

    const { schoolId } = await getCurrentTenantContext();
    const { data, error } = await supabase
      .from('class_courses')
      .select('*')
      .eq('class_id', classId)
      .eq('school_id', schoolId)
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

    if (!supabase) {
      setIsLinkedAttendanceStudentsLoading(false);
      return;
    }

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
      const { schoolId } = await getCurrentTenantContext();
      let imageUrl: string | null = null;
      if (newCourseImage) {
        imageUrl = await uploadImage(COURSE_PROFILE_BUCKET, newCourseImage, 'course');
      }

      const payload: any = withSchoolId({
        class_id: selectedClassId,
        name: newCourseName.trim(),
      }, schoolId);
      if (imageUrl) payload.image_url = imageUrl;

      if (!supabase) throw new Error('Supabase client not initialized.');
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

      if (!supabase) throw new Error('Supabase client not initialized.');
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
    if (!supabase) return;
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
      : internalSubjects),
    [contextType, classes, internalSubjects]
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
      const sourceStudents = initialAllStudents && initialAllStudents.length > 0 ? initialAllStudents : internalStudents;
      return sourceStudents.filter(student => classStudentIds.includes(String(student.id)));
    }

    return internalStudents;
  }, [selectedAttendanceContextId, contextType, classes, initialAllStudents, internalStudents]);

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

    if (!supabase) {
      setIsAttendanceLoading(false);
      return;
    }

    const { schoolId } = await getCurrentTenantContext();
    const primaryResult = await supabase
      .from('attendance_records')
      .select('student_id, status, context_type')
      .in('context_type', contextTypeCandidates)
      .eq('context_id', selectedAttendanceContextId)
      .eq('attendance_date', attendanceDate)
      .eq('school_id', schoolId);

    let data: any[] | null = (primaryResult.data as any[] | null);
    let error = primaryResult.error;

    if (!error && (!data || data.length === 0)) {
       if (!supabase) {
        setIsAttendanceLoading(false);
        return;
      }
      const { schoolId } = await getCurrentTenantContext();
      const fallbackResult = await supabase
        .from('attendance_records')
        .select('student_id, status')
        .eq('context_id', selectedAttendanceContextId)
        .eq('attendance_date', attendanceDate)
        .eq('school_id', schoolId);

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
    try {
      const { schoolId } = await getCurrentTenantContext();

      const payload = withSchoolId({
        context_type: contextType,
        context_id: selectedAttendanceContextId,
        attendance_date: attendanceDate,
        student_id: String(studentId),
        status,
      }, schoolId);

      if (!supabase) throw new Error('Supabase client not initialized.');
      const upsertResult = await supabase
        .from('attendance_records')
        .upsert([payload], { onConflict: 'context_type,context_id,attendance_date,student_id' });

      if (upsertResult.error) {
        safeNotify(`Failed to save attendance: ${upsertResult.error.message}`);
        return;
      }

      setAttendanceMap(prev => ({ ...prev, [String(studentId)]: status }));
    } catch (e: any) {
      safeNotify(`Save failed: ${e.message}`);
    } finally {
      setIsAttendanceSaving(false);
    }
  };

  const markAllPresent = async () => {
    if (!selectedAttendanceContextId || !attendanceDate || activeAttendanceStudents.length === 0) {
      safeNotify('No students available to mark.');
      return;
    }

    setIsAttendanceSaving(true);
    try {
      const { schoolId } = await getCurrentTenantContext();

      const payload = activeAttendanceStudents.map(student => withSchoolId({
        context_type: contextType,
        context_id: selectedAttendanceContextId,
        attendance_date: attendanceDate,
        student_id: String(student.id),
        status: 'P' as const,
      }, schoolId));

      if (!supabase) throw new Error('Supabase client not initialized.');
      const upsertResult = await supabase
        .from('attendance_records')
        .upsert(payload, { onConflict: 'context_type,context_id,attendance_date,student_id' });

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
    } catch (e: any) {
      safeNotify(`Bulk save failed: ${e.message}`);
    } finally {
      setIsAttendanceSaving(false);
    }
  };

  const removeAttendanceStudent = async (studentId: string) => {
    if (!selectedAttendanceContextId) {
      safeNotify('No attendance context selected.');
      return;
    }

    setDeletingAttendanceStudentId(studentId);

    try {
      if (!supabase) throw new Error('Supabase client not initialized.');
      if (contextType === 'class') {
        const { schoolId } = await getCurrentTenantContext();
        const enrollmentDelete = await supabase
          .from('class_course_students')
          .delete()
          .eq('class_id', selectedAttendanceContextId)
          .eq('student_id', studentId)
          .eq('school_id', schoolId);

        if (enrollmentDelete.error) throw enrollmentDelete.error;
      } else {
        const { schoolId } = await getCurrentTenantContext();
        const enrollmentDelete = await supabase
          .from('class_course_students')
          .delete()
          .eq('class_course_id', selectedAttendanceContextId)
          .eq('student_id', studentId)
          .eq('school_id', schoolId);

        if (enrollmentDelete.error) throw enrollmentDelete.error;
      }

      const contextTypeCandidates = contextType === 'class'
        ? ['class', 'batch']
        : ['subject', 'course', 'class_course'];

      const { schoolId } = await getCurrentTenantContext();
      const attendanceDelete = await supabase
        .from('attendance_records')
        .delete()
        .eq('context_id', selectedAttendanceContextId)
        .eq('student_id', studentId)
        .in('context_type', contextTypeCandidates)
        .eq('school_id', schoolId);

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
    <div className="space-y-12 animate-fadeIn text-slate-100">
      {/* HEADER SECTION */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-[#1f4e4a] pb-8">
        <div className="space-y-4 flex-1">
          <h2 className="text-5xl font-black text-white uppercase tracking-tight leading-none">Campus Formations</h2>
          <p className="text-[#4ea59d]/60 font-black text-[10px] uppercase tracking-[0.4em]">Integrated Class & Curriculum Control</p>
        </div>
        {userRole === 'teacher' && (
          <button
            onClick={() => { setEditingClassId(null); setClassName(''); setIsClassFormOpen(true); }}
            className="group relative px-10 py-5 rounded-[24px] bg-[#4ea59d] text-white font-black text-[12px] uppercase tracking-[0.2em] shadow-2xl shadow-[#4ea59d]/20 hover:scale-105 active:scale-95 transition-all flex items-center gap-3"
          >
            <i className="fa-solid fa-plus-circle text-white/50 group-hover:text-white transition-colors"></i> 
            Form Hub
          </button>
        )}
      </header>

      {/* CREATE CLASS SECTION */}
      {isClassFormOpen && (
        <div className="bg-white/10 backdrop-blur-2xl shadow-premium p-10 rounded-[40px] border border-white/20 animate-slideIn">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            <div className="space-y-6">
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-widest text-[#4ea59d]">Class Identity</label>
                <input
                  type="text"
                  placeholder="e.g. Grade 10-A, Computer Science 2024"
                  value={className}
                  onChange={(e) => setClassName(e.target.value)}
                  className="w-full bg-[#0a1a19] border border-white/10 p-5 rounded-[24px] outline-none font-bold text-white focus:border-[#4ea59d] transition-all"
                />
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-widest text-[#4ea59d]">Visual Identity (Optional)</label>
                <div className="bg-[#0a1a19] rounded-[24px] border border-white/10 p-5 flex items-center gap-4">
                  <div 
                     className="w-14 h-14 rounded-2xl flex items-center justify-center cursor-pointer border border-white/10"
                     style={{ backgroundColor: classOuterColor }}
                     onClick={() => document.getElementById('colorPicker')?.click()}
                  >
                    <i className="fas fa-palette text-white/50"></i>
                    <input
                      id="colorPicker"
                      type="color"
                      value={classOuterColor}
                      onChange={(e) => setClassOuterColor(e.target.value)}
                      className="hidden"
                    />
                  </div>
                  <div className="flex-1">
                    <button
                      type="button"
                      onClick={() => classImageInputRef.current?.click()}
                      className="w-full py-4 rounded-xl bg-white/5 border border-white/10 text-white text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all"
                    >
                      {classImage ? 'Change Image' : 'Add Cover Image'}
                    </button>
                    <input
                      ref={classImageInputRef}
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        if (e.target.files?.[0]) setClassImage(e.target.files[0]);
                      }}
                      className="hidden"
                    />
                    {classImage && <p className="mt-2 text-[9px] text-[#4ea59d] font-bold uppercase truncate">Selected: {classImage.name}</p>}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-8 bg-[#0a1a19]/50 rounded-[32px] border border-white/5 flex flex-col justify-between">
              <div>
                <h4 className="text-sm font-black text-white uppercase mb-4">Creation Preview</h4>
                <div className="p-6 rounded-3xl border border-white/10" style={{ backgroundColor: '#0a1a19' }}>
                   <div 
                      className="w-full aspect-video rounded-2xl mb-4 border border-white/5 flex items-center justify-center overflow-hidden" 
                      style={{ backgroundColor: classOuterColor }}
                    >
                      {classImage ? (
                        <img src={URL.createObjectURL(classImage)} className="w-full h-full object-cover" alt="preview" />
                      ) : (
                        <i className="fas fa-graduation-cap text-3xl text-white/20"></i>
                      )}
                   </div>
                   <p className="font-black text-lg">{className || 'Your Class Name'}</p>
                   <p className="text-[10px] font-black text-[#4ea59d] uppercase tracking-widest mt-1">Ready for registration</p>
                </div>
              </div>

              <div className="flex gap-4 mt-8">
                 <button
                    onClick={resetClassForm}
                    className="flex-1 py-4 rounded-[20px] bg-white/5 text-slate-400 text-[10px] font-black uppercase tracking-widest hover:text-white transition-all"
                  >
                    Discard
                  </button>
                  <button
                    onClick={() => void createOrUpdateClass()}
                    className="flex-[2] py-4 rounded-[20px] bg-[#4ea59d] text-white text-[10px] font-black uppercase tracking-widest shadow-xl shadow-[#4ea59d]/20 active:scale-95 transition-all"
                  >
                    {editingClassId ? 'Save Changes' : 'Confirm Registration'}
                  </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SEARCH AND GRID SECTION */}
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
           <p className="text-[10px] font-black uppercase tracking-[0.4em] text-[#4ea59d]/60">Active Formations ({classes.length})</p>
           <div className="relative w-full md:w-80">
              <i className="fas fa-search absolute left-5 top-1/2 -translate-y-1/2 text-[#4ea59d]/40 text-xs"></i>
              <input
                type="text"
                value={classSearchQuery}
                onChange={(e) => setClassSearchQuery(e.target.value)}
                placeholder="Lookup classes..."
                className="w-full bg-white/5 border border-white/10 p-4 pl-12 rounded-[20px] outline-none font-bold text-white focus:border-[#4ea59d] transition-all text-sm"
              />
           </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredClasses.map((classItem) => {
            const isActive = selectedClassId === String(classItem.id);
            return (
              <div
                key={classItem.id}
                onClick={() => {
                  setSelectedClassId(String(classItem.id));
                  if (onOpenClassPage) {
                    onOpenClassPage(classItem);
                  }
                }}
                className={`group relative rounded-[32px] border transition-all cursor-pointer overflow-hidden ${isActive ? 'border-[#4ea59d] bg-[#4ea59d]/10' : 'border-white/10 bg-white/5 hover:border-[#4ea59d]/50 shadow-none hover:shadow-2xl hover:shadow-[#000]/20'}`}
              >
                {/* ACTIONS OVERLAY */}
                {userRole === 'teacher' && (
                  <div className="absolute top-4 right-4 z-10 flex gap-2 opacity-0 group-hover:opacity-100 transition-all scale-90 group-hover:scale-100">
                    <button
                      onClick={(e) => { e.stopPropagation(); startEditClass(classItem); }}
                      className="w-8 h-8 rounded-xl bg-white/10 backdrop-blur-md text-white border border-white/20 hover:bg-[#4ea59d] flex items-center justify-center transition-all"
                    >
                      <i className="fas fa-pen text-[10px]"></i>
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); void deleteClass(String(classItem.id)); }}
                      className="w-8 h-8 rounded-xl bg-white/10 backdrop-blur-md text-white border border-white/20 hover:bg-rose-500 flex items-center justify-center transition-all"
                    >
                      <i className="fas fa-trash text-[10px]"></i>
                    </button>
                  </div>
                )}

                <div 
                   className="w-full aspect-[4/3] relative overflow-hidden flex items-center justify-center"
                   style={{ backgroundColor: classItem.outer_color || classItem.color || '#134e4a' }}
                >
                  {classItem.image_url ? (
                    <img src={classItem.image_url} alt={classItem.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                  ) : (
                    <div className="text-white/20 text-4xl"><i className="fas fa-building-columns"></i></div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60 group-hover:opacity-80 transition-opacity"></div>
                </div>

                <div className="p-6 space-y-3 relative">
                  <h4 className="font-black text-white text-lg tracking-tight truncate">{classItem.name}</h4>
                  <div className="flex flex-wrap gap-2">
                    <span className="px-3 py-1 rounded-lg bg-black/20 border border-white/5 text-[8px] font-black uppercase text-slate-400 tracking-widest">{classItem.class_code || 'CLASS-ID'}</span>
                    <span className="px-3 py-1 rounded-lg bg-[#4ea59d]/20 border border-[#4ea59d]/20 text-[8px] font-black uppercase text-[#4ea59d] tracking-widest">{classItem.student_count || 0} Students</span>
                  </div>
                </div>
                
                {isActive && <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#4ea59d]"></div>}
              </div>
            );
          })}
        </div>
      </div>

      {/* COURSES (SUBJECTS) SECTION */}
      {selectedClass && (
        <div className="space-y-8 p-10 bg-white/5 backdrop-blur-3xl rounded-[48px] border border-white/10 animate-fadeIn">
          <header className="flex justify-between items-center">
             <div>
                <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Academic Curricula</h3>
                <p className="text-slate-400 text-[9px] font-bold uppercase tracking-[0.3em] mt-1">Managed Courses for {selectedClass.name}</p>
             </div>
             {userRole === 'teacher' && (
               <button
                  onClick={() => setIsCreateCourseModalOpen(true)}
                  className="w-12 h-12 rounded-2xl bg-[#4ea59d] text-white shadow-lg shadow-[#4ea59d]/20 hover:scale-105 active:scale-95 transition-all flex items-center justify-center"
                >
                  <i className="fas fa-plus"></i>
                </button>
             )}
          </header>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-12">
             {isClassCoursesLoading ? (
               <div className="col-span-full p-20 flex flex-col items-center justify-center text-slate-500 gap-4">
                  <i className="fas fa-circle-notch fa-spin text-3xl text-[#4ea59d]"></i>
                  <p className="text-[10px] font-black uppercase tracking-widest">Building Catalog...</p>
               </div>
             ) : classCourses.length === 0 ? (
                <div className="col-span-full p-20 border-2 border-dashed border-white/5 rounded-[40px] text-center space-y-4">
                   <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">No courses found in this formation</p>
                   <button onClick={() => setIsCreateCourseModalOpen(true)} className="text-[#4ea59d] text-[9px] font-black uppercase underline decoration-2 underline-offset-4">Initialize Curriculum</button>
                </div>
             ) : classCourses.map(course => (
              <div
                key={course.id}
                className="group p-10 rounded-[56px] bg-[#0a1a19] border border-white/5 hover:border-[#4ea59d]/40 transition-all relative overflow-hidden shadow-3xl scale-[1.02] hover:scale-[1.06]"
              >
                {userRole === 'teacher' && (
                  <div className="absolute top-8 right-8 z-10 flex gap-4 opacity-0 group-hover:opacity-100 transition-all">
                     <button onClick={() => openEditCourseModal(course)} className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md text-white border border-white/20 hover:bg-[#4ea59d] flex items-center justify-center transition-all shadow-xl">
                        <i className="fas fa-pen text-[14px]"></i>
                     </button>
                  </div>
                )}

                <div 
                  onClick={() => {
                    if (onOpenCoursePage) {
                      onOpenCoursePage({ id: course.id, name: course.name, classId: course.class_id, className: selectedClass.name });
                    } else {
                      safeNotify('Course selector is not bound.');
                    }
                  }}
                  className="cursor-pointer space-y-10"
                >
                  <div className="w-full aspect-video rounded-[40px] bg-white/5 border border-white/5 overflow-hidden flex items-center justify-center relative">
                    {course.image_url ? (
                      <img src={course.image_url} alt={course.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000" />
                    ) : (
                      <i className="fas fa-book-open text-white/10 text-6xl"></i>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0a1a19] via-[#0a1a19]/10 to-transparent"></div>
                  </div>
                  <div>
                    <p className="text-[#4ea59d] text-[10px] font-black uppercase tracking-[0.5em] mb-4">Core Curriculum</p>
                    <p className="text-4xl font-black text-white leading-none group-hover:text-[#4ea59d] transition-colors line-clamp-2 uppercase tracking-tighter">{course.name}</p>
                    <div className="flex items-center justify-between pt-8 border-t border-white/5 mt-8">
                       <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest group-hover:text-white transition-colors">Curriculum Portal</span>
                       <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-[#4ea59d] group-hover:bg-[#4ea59d] group-hover:text-white transition-all shadow-xl">
                          <i className="fas fa-arrow-right text-[12px]"></i>
                       </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODALS (Simplified Aesthetics for Speed) */}
      {isCreateCourseModalOpen && (
        <div className="fixed inset-0 z-[1000] glass-panel bg-black/60 backdrop-blur-xl flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-[#0a1a19] rounded-[40px] border border-white/10 p-10 space-y-8 animate-fadeIn">
             <header className="flex justify-between items-center">
                <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Add Course</h3>
                <button onClick={() => setIsCreateCourseModalOpen(false)} className="text-slate-500 hover:text-white transition-colors"><i className="fas fa-times"></i></button>
             </header>
             <div className="space-y-6">
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#4ea59d]">Curriculum Title</label>
                  <input
                    type="text"
                    value={newCourseName}
                    onChange={(e) => { setNewCourseName(e.target.value); if (newCourseError) setNewCourseError(null); }}
                    placeholder="Enter course name"
                    className="w-full bg-white/5 border border-white/10 p-5 rounded-[24px] outline-none font-bold text-white focus:border-[#4ea59d] transition-all"
                  />
                  {newCourseError && <p className="text-[10px] font-bold text-rose-500 px-2">{newCourseError}</p>}
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#4ea59d]">Course Illustration</label>
                  <div className="bg-white/5 rounded-[24px] border border-white/10 p-5">
                    <button
                      type="button"
                      onClick={() => newCourseImageInputRef.current?.click()}
                      className="w-full py-4 rounded-xl bg-white/5 text-white text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all"
                    >
                      {newCourseImage ? 'Change Image' : 'Select Graphic'}
                    </button>
                    <input
                      ref={newCourseImageInputRef}
                      type="file"
                      accept="image/*"
                      onChange={(e) => { if (e.target.files?.[0]) setNewCourseImage(e.target.files[0]); }}
                      className="hidden"
                    />
                    {newCourseImage && <p className="mt-2 text-[9px] text-[#4ea59d] font-bold uppercase truncate">Selected: {newCourseImage.name}</p>}
                  </div>
                </div>
             </div>
             <button
                onClick={() => void createClassCourse()}
                disabled={isClassCourseCreating}
                className="w-full py-5 rounded-[24px] bg-[#4ea59d] text-white font-black text-[12px] uppercase tracking-[0.2em] shadow-2xl shadow-[#4ea59d]/20 transition-all active:scale-95 disabled:opacity-50"
              >
                {isClassCourseCreating ? 'Registering...' : 'Add to Catalog'}
              </button>
          </div>
        </div>
      )}

      {/* ATTENDANCE SECTION REMOVED FROM MAIN MANAGER AS REQUESTED */}
    </div>
  );
};

export default ClassAndCoursesManager;
