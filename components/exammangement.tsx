import React, { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../supabaseClient';
import GradingModal from './Modals/Grading';

type AppClass = {
  id: string;
  name: string;
};

type AppCourse = {
  id: string;
  class_id: string;
  name: string;
};

type ExamItem = {
  id: string;
  class_id: string;
  class_course_id: string;
  title: string;
  description: string;
  file_url: string | null;
  created_at: string;
};

type GradingStudent = {
  id: string;
  name: string;
};

type UserRole = 'teacher' | 'student';
const EXAM_FILES_BUCKET = 'exam_files';
const MAX_PDF_SIZE_BYTES = 20 * 1024 * 1024;

const getTodayDisplay = (value: string) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
};

const guessFileNameFromUrl = (url: string, fallback = 'exam-question.pdf') => {
  try {
    const parsed = new URL(url);
    const lastSegment = parsed.pathname.split('/').filter(Boolean).pop() || fallback;
    return decodeURIComponent(lastSegment);
  } catch {
    return fallback;
  }
};

const isSchemaMissingError = (message?: string | null) => {
  const text = String(message || '').toLowerCase();
  return (
    text.includes('does not exist')
    || text.includes('schema cache')
    || text.includes('column')
    || text.includes('relation')
  );
};

export default function ExamManagementPage() {
  const [role, setRole] = useState<UserRole>('teacher');
  const [classes, setClasses] = useState<AppClass[]>([]);
  const [courses, setCourses] = useState<AppCourse[]>([]);
  const [exams, setExams] = useState<ExamItem[]>([]);

  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const [isLoadingAcademic, setIsLoadingAcademic] = useState(true);
  const [isLoadingExams, setIsLoadingExams] = useState(false);
  const [isSavingExam, setIsSavingExam] = useState(false);
  const [deletingExamId, setDeletingExamId] = useState<string | null>(null);

  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingExamId, setEditingExamId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [fileUrl, setFileUrl] = useState('');
  const [selectedPdfFile, setSelectedPdfFile] = useState<File | null>(null);
  const [originalFileUrl, setOriginalFileUrl] = useState<string | null>(null);
  const [shouldRemoveExistingFile, setShouldRemoveExistingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [selectedExamForGrading, setSelectedExamForGrading] = useState<ExamItem | null>(null);
  const [gradingStudents, setGradingStudents] = useState<GradingStudent[]>([]);
  const [grades, setGrades] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [savingNoteStudentId, setSavingNoteStudentId] = useState<string | null>(null);
  const [isLoadingGrading, setIsLoadingGrading] = useState(false);

  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const classCourses = useMemo(
    () => courses.filter(item => item.class_id === selectedClassId),
    [courses, selectedClassId]
  );

  const selectedClassName = useMemo(
    () => classes.find(item => item.id === selectedClassId)?.name || '',
    [classes, selectedClassId]
  );

  const selectedCourseName = useMemo(
    () => classCourses.find(item => item.id === selectedCourseId)?.name || '',
    [classCourses, selectedCourseId]
  );

  const classNameMap = useMemo(() => {
    const map = new Map<string, string>();
    classes.forEach(item => map.set(item.id, item.name));
    return map;
  }, [classes]);

  const courseNameMap = useMemo(() => {
    const map = new Map<string, string>();
    courses.forEach(item => map.set(item.id, item.name));
    return map;
  }, [courses]);

  const filteredExams = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return exams;

    return exams.filter(exam => {
      const className = classNameMap.get(exam.class_id) || '';
      const courseName = courseNameMap.get(exam.class_course_id) || '';
      const blob = [exam.title, exam.description, className, courseName]
        .map(value => String(value || '').toLowerCase())
        .join(' ');
      return blob.includes(q);
    });
  }, [searchQuery, exams, classNameMap, courseNameMap]);

  const loadAcademicData = async () => {
    setIsLoadingAcademic(true);
    setError(null);

    try {
      const [classesRes, coursesRes] = await Promise.all([
        supabase.from('classes').select('id, name').order('created_at', { ascending: false }),
        supabase.from('class_courses').select('id, class_id, name').order('created_at', { ascending: false }),
      ]);

      if (classesRes.error) throw classesRes.error;
      if (coursesRes.error) throw coursesRes.error;

      setClasses(
        (classesRes.data || []).map((row: any) => ({
          id: String(row.id),
          name: String(row.name || `Class ${row.id}`),
        }))
      );

      setCourses(
        (coursesRes.data || []).map((row: any) => ({
          id: String(row.id),
          class_id: String(row.class_id || ''),
          name: String(row.name || `Course ${row.id}`),
        }))
      );
    } catch (loadError: any) {
      setError(loadError?.message || 'Failed to load classes and courses.');
    } finally {
      setIsLoadingAcademic(false);
    }
  };

  const loadExams = async (classId?: string, courseId?: string) => {
    setIsLoadingExams(true);
    setError(null);

    try {
      let query = supabase
        .from('exams')
        .select('*')
        .order('created_at', { ascending: false });

      if (classId) {
        query = query.eq('class_id', classId);
      }

      if (courseId) {
        query = query.eq('class_course_id', courseId);
      }

      const result = await query;

      if (result.error) throw result.error;

      const mapped = (result.data || []).map((row: any) => ({
        id: String(row.id),
        class_id: String(row.class_id || ''),
        class_course_id: String(row.class_course_id || ''),
        title: String(row.title || ''),
        description: String(row.description || ''),
        file_url: row.file_url ? String(row.file_url) : null,
        created_at: String(row.created_at || new Date().toISOString()),
      }));

      setExams(mapped);
    } catch (loadError: any) {
      setError(loadError?.message || 'Failed to load exams for this course.');
      setExams([]);
    } finally {
      setIsLoadingExams(false);
    }
  };

  useEffect(() => {
    void loadAcademicData();
    void loadExams();
  }, []);

  useEffect(() => {
    setSelectedCourseId('');
    setExams([]);
  }, [selectedClassId]);

  useEffect(() => {
    void loadExams(selectedClassId || undefined, selectedCourseId || undefined);
  }, [selectedClassId, selectedCourseId]);

  const sanitizeFileName = (value: string) => value.replace(/[^a-zA-Z0-9._-]/g, '_');

  const extractStoragePathFromUrl = (rawValue: string | null) => {
    if (!rawValue) return null;
    const candidate = String(rawValue).trim();
    if (!candidate) return null;
    const marker = `/object/public/${EXAM_FILES_BUCKET}/`;
    const markerIndex = candidate.indexOf(marker);
    if (markerIndex >= 0) {
      const remainder = candidate.slice(markerIndex + marker.length).split('?')[0];
      return decodeURIComponent(remainder);
    }

    if (!/^https?:\/\//i.test(candidate)) {
      return candidate.replace(/^\/+/, '').replace(`${EXAM_FILES_BUCKET}/`, '');
    }

    return null;
  };

  const uploadPdfToStorage = async (classId: string, courseId: string, file: File) => {
    const sanitizedName = sanitizeFileName(file.name || 'exam-question.pdf');
    const path = `${classId}/${courseId}/${Date.now()}-${sanitizedName}`;

    const uploadResult = await supabase.storage
      .from(EXAM_FILES_BUCKET)
      .upload(path, file, { upsert: true, contentType: 'application/pdf' });

    if (uploadResult.error) throw uploadResult.error;

    const { data } = supabase.storage.from(EXAM_FILES_BUCKET).getPublicUrl(path);
    if (!data?.publicUrl) {
      throw new Error('Failed to resolve uploaded PDF URL.');
    }

    return data.publicUrl;
  };

  const deleteStoredPdfByUrl = async (urlOrPath: string | null) => {
    const path = extractStoragePathFromUrl(urlOrPath);
    if (!path) return;
    await supabase.storage.from(EXAM_FILES_BUCKET).remove([path]);
  };

  const downloadFileDirectly = async (url: string) => {
    if (!url) return;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Download failed with status ${response.status}`);
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = guessFileNameFromUrl(url);
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (downloadError: any) {
      setError(downloadError?.message || 'Failed to download exam file.');
    }
  };

  const loadStudentsForGrading = async (exam: ExamItem) => {
    setIsLoadingGrading(true);

    try {
      let studentIds: string[] = [];

      const classCourseStudentsRes = await supabase
        .from('class_course_students')
        .select('student_id')
        .eq('class_course_id', exam.class_course_id)
        .eq('class_id', exam.class_id);

      if (!classCourseStudentsRes.error) {
        studentIds = (classCourseStudentsRes.data || []).map((row: any) => String(row.student_id));
      } else if (isSchemaMissingError(classCourseStudentsRes.error.message)) {
        const fallbackRes = await supabase
          .from('student_courses')
          .select('student_id')
          .eq('course_id', exam.class_course_id);

        if (!fallbackRes.error) {
          studentIds = (fallbackRes.data || []).map((row: any) => String(row.student_id));
        }
      } else {
        throw classCourseStudentsRes.error;
      }

      studentIds = [...new Set(studentIds.filter(Boolean))];

      if (studentIds.length > 0) {
        const studentsRes = await supabase
          .from('students')
          .select('id, name')
          .in('id', studentIds);

        if (studentsRes.error) throw studentsRes.error;

        setGradingStudents(
          (studentsRes.data || []).map((row: any) => ({
            id: String(row.id),
            name: String(row.name || 'Student'),
          }))
        );
      } else {
        setGradingStudents([]);
      }
    } catch (loadStudentsError: any) {
      setError(loadStudentsError?.message || 'Failed to load students for grading.');
      setGradingStudents([]);
    } finally {
      setIsLoadingGrading(false);
    }
  };

  const loadGradesForExam = async (examId: string) => {
    try {
      let result: any = await supabase
        .from('exam_grades')
        .select('student_id, grade, note')
        .eq('exam_id', examId);

      if (result.error && isSchemaMissingError(result.error.message)) {
        result = await supabase
          .from('exam_grades')
          .select('student_id, grade')
          .eq('exam_id', examId);
      }

      if (result.error) {
        if (isSchemaMissingError(result.error.message)) {
          setGrades({});
          return;
        }
        throw result.error;
      }

      const nextGrades: Record<string, string> = {};
      const nextNotes: Record<string, string> = {};
      (result.data || []).forEach((row: any) => {
        const studentId = String(row.student_id || '');
        if (!studentId) return;
        nextGrades[studentId] = String(row.grade || '');
        if (typeof row.note === 'string') {
          nextNotes[studentId] = row.note;
        }
      });

      setGrades(nextGrades);
      setNotes(nextNotes);
    } catch (loadGradesError: any) {
      setError(loadGradesError?.message || 'Failed to load grades.');
      setGrades({});
      setNotes({});
    }
  };

  const openCreateEditor = () => {
    setEditingExamId(null);
    setTitle('');
    setDescription('');
    setFileUrl('');
    setOriginalFileUrl(null);
    setShouldRemoveExistingFile(false);
    setSelectedPdfFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setIsEditorOpen(true);
    setError(null);
  };

  const openEditEditor = (exam: ExamItem) => {
    setEditingExamId(exam.id);
    setTitle(exam.title);
    setDescription(exam.description || '');
    setFileUrl(exam.file_url || '');
    setOriginalFileUrl(exam.file_url || null);
    setShouldRemoveExistingFile(false);
    setSelectedPdfFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setIsEditorOpen(true);
    setError(null);
  };

  const openGradingPage = (exam: ExamItem) => {
    setSelectedExamForGrading(exam);
    setGrades({});
    setNotes({});
    setGradingStudents([]);
    void loadStudentsForGrading(exam);
    void loadGradesForExam(exam.id);
  };

  const closeGradingPage = () => {
    setSelectedExamForGrading(null);
    setGradingStudents([]);
    setGrades({});
    setNotes({});
  };

  const handleGrade = async (studentId: string, grade: string) => {
    if (!selectedExamForGrading) return;

    setGrades(prev => ({ ...prev, [studentId]: grade }));

    let result = await supabase
      .from('exam_grades')
      .upsert(
        [{
          exam_id: selectedExamForGrading.id,
          student_id: studentId,
          grade,
          note: notes[studentId] || null,
        }],
        { onConflict: 'exam_id,student_id' }
      );

    if (result.error && isSchemaMissingError(result.error.message)) {
      result = await supabase
        .from('exam_grades')
        .upsert(
          [{ exam_id: selectedExamForGrading.id, student_id: studentId, grade }],
          { onConflict: 'exam_id,student_id' }
        );
    }

    if (result.error && !isSchemaMissingError(result.error.message)) {
      setError(result.error.message || 'Failed to save grade.');
    }
  };

  const handleNoteChange = (studentId: string, note: string) => {
    setNotes(prev => ({ ...prev, [studentId]: note }));
  };

  const saveStudentNote = async (studentId: string) => {
    if (!selectedExamForGrading) return;

    const note = (notes[studentId] || '').trim();
    const grade = grades[studentId];
    if (!grade) {
      setStatus('Select a grade before saving note.');
      return;
    }

    setSavingNoteStudentId(studentId);

    try {
      let result = await supabase
        .from('exam_grades')
        .upsert(
          [{
            exam_id: selectedExamForGrading.id,
            student_id: studentId,
            grade,
            note,
          }],
          { onConflict: 'exam_id,student_id' }
        );

      if (result.error && isSchemaMissingError(result.error.message)) {
        result = await supabase
          .from('exam_grades')
          .upsert(
            [{ exam_id: selectedExamForGrading.id, student_id: studentId, grade }],
            { onConflict: 'exam_id,student_id' }
          );
      }

      if (result.error) throw result.error;
      setStatus('Comment saved successfully.');
    } catch (saveNoteError: any) {
      setError(saveNoteError?.message || 'Failed to save comment.');
    } finally {
      setSavingNoteStudentId(null);
    }
  };

  const closeEditor = () => {
    setIsEditorOpen(false);
    setEditingExamId(null);
    setTitle('');
    setDescription('');
    setFileUrl('');
    setOriginalFileUrl(null);
    setShouldRemoveExistingFile(false);
    setSelectedPdfFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handlePickPdfFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    if (!file) {
      setSelectedPdfFile(null);
      return;
    }

    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    if (!isPdf) {
      setError('Only PDF files are allowed.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    if (file.size > MAX_PDF_SIZE_BYTES) {
      setError('PDF is too large. Max size is 20MB.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setError(null);
    setSelectedPdfFile(file);
    setShouldRemoveExistingFile(false);
  };

  const removePendingPdfSelection = () => {
    setSelectedPdfFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeExistingUploadedFile = () => {
    setShouldRemoveExistingFile(true);
    setFileUrl('');
    setError(null);
  };

  const saveExam = async () => {
    if (!selectedClassId || !selectedCourseId) {
      setError('Select both class and course first.');
      return;
    }
    if (!title.trim()) {
      setError('Exam title is required.');
      return;
    }

    setIsSavingExam(true);
    setError(null);

    try {
      const previousFileUrl = editingExamId ? originalFileUrl : null;
      let nextFileUrl = fileUrl.trim() || null;

      if (selectedPdfFile) {
        nextFileUrl = await uploadPdfToStorage(selectedClassId, selectedCourseId, selectedPdfFile);
      } else if (shouldRemoveExistingFile) {
        nextFileUrl = null;
      }

      const payload = {
        class_id: selectedClassId,
        class_course_id: selectedCourseId,
        title: title.trim(),
        description: description.trim(),
        file_url: nextFileUrl,
      };

      if (editingExamId) {
        const updateResult = await supabase.from('exams').update(payload).eq('id', editingExamId);
        if (updateResult.error) throw updateResult.error;
        setStatus('Exam updated successfully.');
      } else {
        const insertResult = await supabase.from('exams').insert([payload]);
        if (insertResult.error) throw insertResult.error;
        setStatus('Exam created successfully.');
      }

      const hasReplacedFile = Boolean(selectedPdfFile && previousFileUrl && previousFileUrl !== nextFileUrl);
      const hasRemovedFile = Boolean(shouldRemoveExistingFile && previousFileUrl);
      if (hasReplacedFile || hasRemovedFile) {
        await deleteStoredPdfByUrl(previousFileUrl);
      }

      closeEditor();
      await loadExams(selectedClassId, selectedCourseId);
    } catch (saveError: any) {
      setError(saveError?.message || 'Failed to save exam.');
    } finally {
      setIsSavingExam(false);
    }
  };

  const deleteExam = async (exam: ExamItem) => {
    if (!window.confirm(`Delete exam "${exam.title}"?`)) return;

    setDeletingExamId(exam.id);
    setError(null);

    try {
      const deleteResult = await supabase.from('exams').delete().eq('id', exam.id);
      if (deleteResult.error) throw deleteResult.error;
      setStatus('Exam deleted.');
      await loadExams(selectedClassId, selectedCourseId);
    } catch (deleteError: any) {
      setError(deleteError?.message || 'Failed to delete exam.');
    } finally {
      setDeletingExamId(null);
    }
  };

  return (
    <div className="space-y-8 pb-20 animate-in fade-in duration-700">
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-brand-700 rounded-[40px] p-6 sm:p-8 lg:p-10 text-white shadow-premium">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] text-brand-200">Evaluation Workspace</p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tighter mt-2">Exam Management</h2>
            <p className="text-slate-200 mt-3 text-sm sm:text-base">Select class and course from Supabase, then create, grade, and manage exams.</p>
          </div>
          <button
            onClick={() => setRole(role === 'teacher' ? 'student' : 'teacher')}
            className="px-5 py-3 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 text-sm font-black uppercase tracking-wider"
          >
            Role: {role} (switch)
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[36px] p-5 sm:p-6 lg:p-8 shadow-premium space-y-5">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="space-y-2">
            <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Class</label>
            <select
              value={selectedClassId}
              onChange={(event) => setSelectedClassId(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-4 py-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-brand-400"
            >
              <option value="">Select class</option>
              {classes.map(item => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Course</label>
            <select
              value={selectedCourseId}
              onChange={(event) => setSelectedCourseId(event.target.value)}
              disabled={!selectedClassId}
              className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-4 py-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-brand-400 disabled:opacity-60"
            >
              <option value="">Select course</option>
              {classCourses.map(item => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Actions</label>
            <button
              onClick={openCreateEditor}
              disabled={!selectedClassId || !selectedCourseId || role !== 'teacher'}
              className="w-full rounded-2xl px-4 py-3 bg-brand-500 hover:bg-brand-600 text-white text-sm font-black uppercase tracking-widest disabled:opacity-60"
            >
              Add Exam
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Search Exam</label>
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search by title, description, class, or course"
            className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-4 py-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-brand-400"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs font-black uppercase tracking-widest text-slate-500">
          <span className="px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800">Class: {selectedClassName || 'All'}</span>
          <span className="px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800">Course: {selectedCourseName || 'All'}</span>
          <span className="px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800">{filteredExams.length} / {exams.length} Exams</span>
          {isLoadingAcademic && <span className="text-brand-500">Loading classes/courses...</span>}
        </div>
      </div>

      {(error || status) && (
        <div className="space-y-2">
          {error && <p className="text-sm font-semibold text-rose-600 bg-rose-50 rounded-2xl px-4 py-3">{error}</p>}
          {status && <p className="text-sm font-semibold text-emerald-700 bg-emerald-50 rounded-2xl px-4 py-3">{status}</p>}
        </div>
      )}

      {selectedExamForGrading ? (
        <GradingModal
          exam={{ id: selectedExamForGrading.id, title: selectedExamForGrading.title }}
          className={classNameMap.get(selectedExamForGrading.class_id) || ''}
          students={gradingStudents}
          grades={grades}
          notes={notes}
          onBack={closeGradingPage}
          onGrade={(studentId, grade) => {
            void handleGrade(studentId, grade);
          }}
          onNoteChange={handleNoteChange}
          onSaveNote={(studentId) => {
            void saveStudentNote(studentId);
          }}
          savingNoteStudentId={savingNoteStudentId}
          isLoading={isLoadingGrading}
        />
      ) : (
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {isLoadingExams ? (
          <div className="rounded-[32px] border border-slate-200 bg-white dark:bg-slate-900 px-6 py-8 text-sm font-semibold text-slate-500">
            Loading exams...
          </div>
        ) : filteredExams.length === 0 ? (
          <div className="rounded-[32px] border border-slate-200 bg-white dark:bg-slate-900 px-6 py-8 text-sm font-semibold text-slate-500">
            No exams found for the current filter.
          </div>
        ) : (
          filteredExams.map(exam => (
            <article key={exam.id} className="rounded-[32px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-premium">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-xl font-black tracking-tight text-slate-900 dark:text-white">{exam.title}</h3>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{exam.description || 'No description added.'}</p>
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{getTodayDisplay(exam.created_at)}</span>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-[10px] font-black uppercase tracking-widest text-slate-500">
                  {classNameMap.get(exam.class_id) || exam.class_id || 'Class'}
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-[10px] font-black uppercase tracking-widest text-slate-500">
                  {courseNameMap.get(exam.class_course_id) || exam.class_course_id || 'Course'}
                </span>
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                {exam.file_url && (
                  <button
                    type="button"
                    onClick={() => void downloadFileDirectly(exam.file_url || '')}
                    className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-black uppercase tracking-widest text-slate-600 dark:text-slate-200"
                  >
                    Download File
                  </button>
                )}

                {role === 'teacher' ? (
                  <>
                    <button
                      onClick={() => openGradingPage(exam)}
                      className="px-3 py-2 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-black uppercase tracking-widest"
                    >
                      Grade
                    </button>
                    <button
                      onClick={() => openEditEditor(exam)}
                      className="px-3 py-2 rounded-xl bg-brand-50 text-brand-700 text-xs font-black uppercase tracking-widest"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteExam(exam)}
                      disabled={deletingExamId === exam.id}
                      className="px-3 py-2 rounded-xl bg-rose-50 text-rose-700 text-xs font-black uppercase tracking-widest disabled:opacity-60"
                    >
                      {deletingExamId === exam.id ? 'Deleting...' : 'Delete'}
                    </button>
                  </>
                ) : (
                  <button className="px-3 py-2 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-black uppercase tracking-widest">
                    Start Exam
                  </button>
                )}
              </div>
            </article>
          ))
        )}
      </div>
      )}

      {isEditorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          <button className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={closeEditor} aria-label="Close modal" />
          <div className="relative w-full max-w-2xl rounded-[32px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 sm:p-8 shadow-2xl space-y-5">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-2xl font-black tracking-tight">{editingExamId ? 'Edit Exam' : 'Create Exam'}</h3>
              <button onClick={closeEditor} className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white">
                <i className="fas fa-xmark"></i>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-black uppercase tracking-widest text-slate-400 mb-2">Exam Title</label>
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-4 py-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-brand-400"
                  placeholder="e.g. Final Mathematics"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black uppercase tracking-widest text-slate-400 mb-2">Description</label>
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  className="w-full h-32 resize-none rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-4 py-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-brand-400"
                  placeholder="Scope, chapters, duration..."
                />
              </div>

              <div>
                <label className="block text-[11px] font-black uppercase tracking-widest text-slate-400 mb-2">Question File (PDF)</label>
                <div className="space-y-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,application/pdf"
                    onChange={handlePickPdfFile}
                    className="block w-full text-sm font-semibold file:mr-3 file:px-4 file:py-2.5 file:rounded-xl file:border-0 file:bg-brand-500 file:text-white hover:file:bg-brand-600"
                  />

                  {selectedPdfFile && (
                    <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2">
                      <p className="text-xs font-black text-emerald-700 truncate">Selected: {selectedPdfFile.name}</p>
                      <button
                        type="button"
                        onClick={removePendingPdfSelection}
                        className="px-2.5 py-1.5 rounded-lg bg-white text-[11px] font-black uppercase tracking-widest text-rose-600"
                      >
                        Remove
                      </button>
                    </div>
                  )}

                  {!selectedPdfFile && fileUrl && (
                    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2">
                      <button
                        type="button"
                        onClick={() => void downloadFileDirectly(fileUrl)}
                        className="text-xs font-black uppercase tracking-widest text-brand-600"
                      >
                        Download Uploaded PDF
                      </button>
                      <button
                        type="button"
                        onClick={removeExistingUploadedFile}
                        className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 text-[11px] font-black uppercase tracking-widest text-rose-600"
                      >
                        Remove Uploaded File
                      </button>
                    </div>
                  )}

                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Or paste file URL (optional)</label>
                    <input
                      value={fileUrl}
                      onChange={(event) => {
                        setFileUrl(event.target.value);
                        setShouldRemoveExistingFile(false);
                      }}
                      className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-4 py-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-brand-400"
                      placeholder="https://..."
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3">
              <button onClick={closeEditor} className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-black uppercase tracking-widest text-slate-600 dark:text-slate-200">
                Cancel
              </button>
              <button
                onClick={saveExam}
                disabled={isSavingExam}
                className="px-4 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-black uppercase tracking-widest disabled:opacity-60"
              >
                {isSavingExam ? 'Saving...' : editingExamId ? 'Save Changes' : 'Create Exam'}
              </button>
            </div>
          </div>
        </div>
      )}

      
    </div>
  );
}
