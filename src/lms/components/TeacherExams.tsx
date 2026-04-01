import React, { useEffect, useMemo, useRef, useState } from 'react';
import GradingModal from './GradingModal';

type ExamItem = {
  id: string;
  class_id: string;
  class_course_id: string;
  title: string;
  description: string;
  exam_date: string | null;
  exam_time: string | null;
  file_url: string | null;
  location: string | null;
  created_at: string;
};

type GradingStudent = {
  id: string;
  name: string;
};

const EXAM_FILES_BUCKET = 'exam_files';
const MAX_PDF_SIZE_BYTES = 20 * 1024 * 1024;

interface TeacherExamsProps {
  supabase: any;
  schoolId: string;
  assignedCourses: Array<{
    id: string;
    classId: string;
    className: string;
    name: string;
  }>;
}

export default function TeacherExams({ supabase, schoolId, assignedCourses }: TeacherExamsProps) {
  const [exams, setExams] = useState<ExamItem[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const [isLoadingExams, setIsLoadingExams] = useState(false);
  const [isSavingExam, setIsSavingExam] = useState(false);
  const [deletingExamId, setDeletingExamId] = useState<string | null>(null);

  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingExamId, setEditingExamId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [examDate, setExamDate] = useState('');
  const [examTime, setExamTime] = useState('');
  const [fileUrl, setFileUrl] = useState('');
  const [location, setLocation] = useState('');
  const [selectedPdfFile, setSelectedPdfFile] = useState<File | null>(null);
  const [originalFileUrl, setOriginalFileUrl] = useState<string | null>(null);
  const [shouldRemoveExistingFile, setShouldRemoveExistingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [selectedExamForGrading, setSelectedExamForGrading] = useState<ExamItem | null>(null);
  const [gradingStudents, setGradingStudents] = useState<GradingStudent[]>([]);
  const [grades, setGrades] = useState<Record<string, string>>({});
  const [percentages, setPercentages] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [savingNoteStudentId, setSavingNoteStudentId] = useState<string | null>(null);
  const [isLoadingGrading, setIsLoadingGrading] = useState(false);

  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedCourse = useMemo(
    () => assignedCourses.find(c => c.id === selectedCourseId),
    [assignedCourses, selectedCourseId]
  );

  const filteredExams = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return exams;

    return exams.filter(exam => {
      const course = assignedCourses.find(c => c.id === exam.class_course_id);
      const blob = [exam.title, exam.description, course?.className, course?.name]
        .map(value => String(value || '').toLowerCase())
        .join(' ');
      return blob.includes(q);
    });
  }, [searchQuery, exams, assignedCourses]);

  const loadExams = async (courseId?: string) => {
    if (!schoolId || !supabase) return;
    setIsLoadingExams(true);
    setError(null);

    try {
      let query = supabase
        .from('exams')
        .select('*')
        .eq('school_id', schoolId)
        .order('created_at', { ascending: false });

      if (courseId) {
        query = query.eq('class_course_id', courseId);
      } else if (assignedCourses.length > 0) {
        // Only load exams for courses the teacher is assigned to
        query = query.in('class_course_id', assignedCourses.map(c => c.id));
      }

      const { data, error: loadError } = await query;
      if (loadError) throw loadError;

      setExams((data || []).map((row: any) => ({
        ...row,
        id: String(row.id)
      })));
    } catch (err: any) {
      setError(err.message || 'Failed to load exams.');
    } finally {
      setIsLoadingExams(false);
    }
  };

  useEffect(() => {
    void loadExams(selectedCourseId || undefined);
  }, [selectedCourseId, schoolId]);

  const handlePickPdfFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    if (!file) {
      setSelectedPdfFile(null);
      return;
    }
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setError('Only PDF files are allowed.');
      return;
    }
    if (file.size > MAX_PDF_SIZE_BYTES) {
      setError('PDF is too large. Max size is 20MB.');
      return;
    }
    setError(null);
    setSelectedPdfFile(file);
    setShouldRemoveExistingFile(false);
  };

  const uploadPdfToStorage = async (classId: string, courseId: string, file: File) => {
    const path = `${classId}/${courseId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const { error: uploadError } = await supabase.storage.from(EXAM_FILES_BUCKET).upload(path, file);
    if (uploadError) throw uploadError;
    const { data } = supabase.storage.from(EXAM_FILES_BUCKET).getPublicUrl(path);
    return data.publicUrl;
  };

  const saveExam = async () => {
    const finalCourse = selectedCourse || (editingExamId ? assignedCourses.find(c => c.id === exams.find(e => e.id === editingExamId)?.class_course_id) : null);
    if (!finalCourse) {
      setError('Please select a target course for this exam.');
      return;
    }
    if (!title.trim()) {
      setError('Exam title is required.');
      return;
    }

    setIsSavingExam(true);
    setError(null);

    try {
      let nextFileUrl = fileUrl || null;
      if (selectedPdfFile) {
        nextFileUrl = await uploadPdfToStorage(finalCourse.classId, finalCourse.id, selectedPdfFile);
      } else if (shouldRemoveExistingFile) {
        nextFileUrl = null;
      }

      const payload = {
        class_id: finalCourse.classId,
        class_course_id: finalCourse.id,
        title: title.trim(),
        description: description.trim(),
        exam_date: examDate || null,
        exam_time: examTime || null,
        file_url: nextFileUrl,
        location: location.trim() || null,
        school_id: schoolId
      };

      if (editingExamId) {
        const { error: updateError } = await supabase.from('exams').update(payload).eq('id', editingExamId);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase.from('exams').insert([payload]);
        if (insertError) throw insertError;
      }

      setStatus('Exam details synchronized successfully.');
      closeEditor();
      await loadExams(selectedCourseId || undefined);
    } catch (err: any) {
      setError(err.message || 'Critical error saving exam data.');
    } finally {
      setIsSavingExam(false);
    }
  };

  const deleteExam = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this exam? All student grades will be permanently removed.')) return;
    setDeletingExamId(id);
    try {
      const { error: deleteError } = await supabase.from('exams').delete().eq('id', id);
      if (deleteError) throw deleteError;
      await loadExams(selectedCourseId || undefined);
    } catch (err: any) {
      setError(err.message || 'Failed to delete exam.');
    } finally {
      setDeletingExamId(null);
    }
  };

  const closeEditor = () => {
    setIsEditorOpen(false);
    setEditingExamId(null);
    setTitle('');
    setDescription('');
    setExamDate('');
    setExamTime('');
    setFileUrl('');
    setLocation('');
    setSelectedPdfFile(null);
    setShouldRemoveExistingFile(false);
  };

  const openEditEditor = (exam: ExamItem) => {
    setEditingExamId(exam.id);
    setSelectedCourseId(exam.class_course_id);
    setTitle(exam.title);
    setDescription(exam.description || '');
    setExamDate(exam.exam_date || '');
    setExamTime(exam.exam_time || '');
    setFileUrl(exam.file_url || '');
    setLocation(exam.location || '');
    setOriginalFileUrl(exam.file_url || null);
    setIsEditorOpen(true);
  };

  const loadGradingData = async (exam: ExamItem) => {
    setIsLoadingGrading(true);
    try {
      // 1. Fetch Students
      const { data: enrollmentData } = await supabase
        .from('class_course_students')
        .select('student_id, students(id, name)')
        .eq('class_course_id', exam.class_course_id);

      const studentsList = (enrollmentData || []).map((row: any) => ({
        id: String(row.student_id),
        name: String(row.students?.name || 'Student')
      }));
      setGradingStudents(studentsList);

      // 2. Fetch Grades
      const { data: gradesData } = await supabase
        .from('exam_grades')
        .select('*')
        .eq('exam_id', exam.id);

      const nextGrades: Record<string, string> = {};
      const nextPercentages: Record<string, string> = {};
      const nextNotes: Record<string, string> = {};
      (gradesData || []).forEach((row: any) => {
        const sId = String(row.student_id);
        nextGrades[sId] = String(row.grade || '');
        nextPercentages[sId] = String(row.percentage || '');
        nextNotes[sId] = row.note || '';
      });
      setGrades(nextGrades);
      setPercentages(nextPercentages);
      setNotes(nextNotes);

      setSelectedExamForGrading(exam);
    } catch (err: any) {
      setError(err.message || 'Failed to initialize grading workspace.');
    } finally {
      setIsLoadingGrading(false);
    }
  };

  const handleSaveGrade = async (studentId: string, grade: string) => {
    if (!selectedExamForGrading) return;
    setGrades(prev => ({ ...prev, [studentId]: grade }));
    
    // Auto-save logic
    const { error: upsertError } = await supabase.from('exam_grades').upsert([{
      exam_id: selectedExamForGrading.id,
      student_id: studentId,
      grade,
      percentage: percentages[studentId] || null,
      note: notes[studentId] || null,
      school_id: schoolId,
      name: assignedCourses.find(c => c.id === selectedExamForGrading.class_course_id)?.className || '',
      course_name: assignedCourses.find(c => c.id === selectedExamForGrading.class_course_id)?.name || ''
    }], { onConflict: 'exam_id,student_id' });

    if (upsertError) setError(upsertError.message);
  };

  const saveStudentNote = async (studentId: string) => {
    if (!selectedExamForGrading) return;
    setSavingNoteStudentId(studentId);
    try {
      const { error: upsertError } = await supabase.from('exam_grades').upsert([{
        exam_id: selectedExamForGrading.id,
        student_id: studentId,
        grade: grades[studentId] || 'F',
        percentage: percentages[studentId] || null,
        note: notes[studentId] || null,
        school_id: schoolId,
        name: assignedCourses.find(c => c.id === selectedExamForGrading.class_course_id)?.className || '',
        course_name: assignedCourses.find(c => c.id === selectedExamForGrading.class_course_id)?.name || ''
      }], { onConflict: 'exam_id,student_id' });
      if (upsertError) throw upsertError;
      setStatus('Evaluation data synchronized for ' + gradingStudents.find(s => s.id === studentId)?.name);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSavingNoteStudentId(null);
    }
  };

  if (selectedExamForGrading) {
    return (
      <GradingModal
        exam={{ id: selectedExamForGrading.id, title: selectedExamForGrading.title }}
        className={assignedCourses.find(c => c.id === selectedExamForGrading.class_course_id)?.className}
        students={gradingStudents}
        grades={grades}
        percentages={percentages}
        notes={notes}
        isLoading={isLoadingGrading}
        savingNoteStudentId={savingNoteStudentId}
        onBack={() => setSelectedExamForGrading(null)}
        onGrade={handleSaveGrade}
        onPercentageChange={(sId, p) => setPercentages(prev => ({ ...prev, [sId]: p }))}
        onNoteChange={(sId, n) => setNotes(prev => ({ ...prev, [sId]: n }))}
        onSaveNote={saveStudentNote}
      />
    );
  }

  return (
    <div className="space-y-12 animate-fadeIn text-slate-100 pb-20">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-[#1f4e4a] pb-8">
        <div className="space-y-2">
          <h2 className="text-4xl font-black text-white uppercase tracking-tighter">Evaluation Center</h2>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#4ea59d] animate-pulse"></span>
            <p className="text-[#4ea59d]/60 font-black text-[10px] uppercase tracking-[0.4em]">Exam Management & Student Grading</p>
          </div>
        </div>
        <button
          onClick={() => { setIsEditorOpen(true); setEditingExamId(null); }}
          className="px-8 py-4 bg-[#4ea59d] text-white rounded-[24px] text-xs font-black uppercase tracking-[0.2em] shadow-xl shadow-[#4ea59d]/30 hover:scale-105 transition-all flex items-center gap-3"
        >
          <i className="fa-solid fa-plus"></i> Create New Exam
        </button>
      </header>

      <div className="bg-white/5 backdrop-blur-xl rounded-[40px] border border-white/10 p-8 shadow-2xl space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-[#4ea59d] uppercase tracking-[0.2em]">Filter by Course</label>
            <select
              value={selectedCourseId}
              onChange={(e) => setSelectedCourseId(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white font-bold focus:border-[#4ea59d] transition-all outline-none appearance-none"
            >
              <option value="" className="bg-[#0a1a19]">All Assigned Courses</option>
              {assignedCourses.map(c => (
                <option key={c.id} value={c.id} className="bg-[#0a1a19]">{c.className} - {c.name}</option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-2 space-y-2">
            <label className="text-[10px] font-black text-[#4ea59d] uppercase tracking-[0.2em]">Search Assessments</label>
            <div className="relative">
              <i className="fa-solid fa-magnifying-glass absolute left-6 top-1/2 -translate-y-1/2 text-slate-500"></i>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by title, description, or class..."
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-14 py-4 text-white font-medium focus:border-[#4ea59d] transition-all outline-none"
              />
            </div>
          </div>
        </div>

        {(error || status) && (
          <div className="animate-slideDown">
            {error && <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-400 text-xs font-bold leading-relaxed">{error}</div>}
            {status && <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-400 text-xs font-bold leading-relaxed">{status}</div>}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {isLoadingExams ? (
            <div className="col-span-full py-20 text-center text-slate-500 animate-pulse font-black uppercase tracking-[0.3em] text-xs">
              Synchronizing Exam Database...
            </div>
          ) : filteredExams.length === 0 ? (
            <div className="col-span-full py-20 text-center space-y-4 bg-white/5 rounded-[40px] border border-white/5">
              <i className="fa-solid fa-file-circle-exclamation text-slate-700 text-4xl"></i>
              <p className="text-slate-500 text-sm font-bold uppercase tracking-widest">No exams found matching your criteria</p>
            </div>
          ) : (
            filteredExams.map(exam => (
              <div key={exam.id} className="group bg-white/5 hover:bg-white/10 backdrop-blur-2xl rounded-[40px] border border-white/10 hover:border-[#4ea59d]/50 p-8 transition-all flex flex-col h-full relative overflow-hidden">
                <div className="absolute top-0 right-0 p-6 flex gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openEditEditor(exam)} className="w-8 h-8 rounded-lg bg-orange-500/20 text-orange-400 flex items-center justify-center hover:bg-orange-500/40 transition-all"><i className="fa-solid fa-pen-to-square"></i></button>
                  <button onClick={() => deleteExam(exam.id)} disabled={deletingExamId === exam.id} className="w-8 h-8 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center hover:bg-rose-500/40 transition-all">{deletingExamId === exam.id ? <i className="fa-solid fa-spinner animate-spin"></i> : <i className="fa-solid fa-trash"></i>}</button>
                </div>

                <div className="space-y-4 flex-1">
                  <div className="flex items-center gap-3">
                    <span className="px-3 py-1 bg-[#4ea59d]/10 text-[#4ea59d] text-[8px] font-black uppercase tracking-widest rounded-full">{assignedCourses.find(c => c.id === exam.class_course_id)?.className || 'Evaluation'}</span>
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest ">{new Date(exam.exam_date || exam.created_at).toLocaleDateString()}</span>
                  </div>
                  <h4 className="text-xl font-black text-white group-hover:text-[#4ea59d] transition-colors">{exam.title}</h4>
                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{exam.location || 'Intelligence Center'} • {exam.exam_time || '10:00 AM'}</p>
                </div>

                <div className="mt-8 pt-6 border-t border-white/5 grid grid-cols-2 gap-3">
                  <button
                    onClick={() => loadGradingData(exam)}
                    className="flex-1 py-3 bg-[#4ea59d] text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all hover:bg-[#3d8c85] shadow-lg shadow-[#4ea59d]/20"
                  >
                    Grade Students
                  </button>
                  {exam.file_url ? (
                    <button
                      onClick={() => window.open(exam.file_url!, '_blank')}
                      className="py-3 bg-white/5 border border-white/10 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all"
                    >
                      Question Paper
                    </button>
                  ) : (
                    <div className="py-3 bg-white/5 border border-white/10 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-widest text-center italic cursor-not-allowed">
                      No File
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Editor Modal */}
      {isEditorOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" onClick={closeEditor}></div>
          <div className="relative w-full max-w-2xl bg-[#0a1a19] border border-white/10 rounded-[48px] shadow-3xl overflow-hidden animate-zoomIn flex flex-col max-h-[90vh]">
            <div className="p-10 space-y-8 flex-1 overflow-y-auto custom-scrollbar">
              <div className="flex justify-between items-start">
                <div className="space-y-2">
                  <p className="text-[10px] font-black text-[#4ea59d] uppercase tracking-[0.4em]">{editingExamId ? 'Update Record' : 'Fresh Evaluation'}</p>
                  <h3 className="text-3xl font-black text-white uppercase tracking-tight">{editingExamId ? 'Modify Assessment' : 'New Exam Protocol'}</h3>
                </div>
                <button onClick={closeEditor} className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 text-white hover:bg-rose-500/20 hover:text-rose-400 hover:border-rose-500/30 transition-all"><i className="fa-solid fa-xmark"></i></button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2 md:col-span-2">
                  <label className="text-[10px] font-black text-[#4ea59d] uppercase tracking-[0.2em]">Assessment Title</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Mid-Term Physics Challenge"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white font-bold focus:border-[#4ea59d] transition-all outline-none"
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label className="text-[10px] font-black text-[#4ea59d] uppercase tracking-[0.2em]">Target Course</label>
                  <select
                    value={selectedCourseId}
                    onChange={(e) => setSelectedCourseId(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white font-bold focus:border-[#4ea59d] transition-all outline-none"
                  >
                    <option value="" className="bg-[#0a1a19]">Select Evaluation Target</option>
                    {assignedCourses.map(c => (
                      <option key={c.id} value={c.id} className="bg-[#0a1a19]">{c.className} - {c.name}</option>
                    ))}
                  </select>
                </div>

                {!editingExamId && (
                  <div className="space-y-2 md:col-span-2 flex flex-col gap-4">
                    <label className="text-[10px] font-black text-[#4ea59d] uppercase tracking-[0.2em]">Question Paper (PDF)</label>
                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="flex-1 py-4 bg-white/5 border-2 border-dashed border-white/10 hover:border-[#4ea59d]/50 rounded-2xl text-slate-400 text-xs font-bold uppercase flex items-center justify-center gap-3 transition-all"
                      >
                        {selectedPdfFile ? <i className="fa-solid fa-file-pdf text-[#4ea59d]"></i> : <i className="fa-solid fa-cloud-arrow-up"></i>}
                        {selectedPdfFile ? selectedPdfFile.name : 'Choose File'}
                      </button>
                    </div>
                    <input type="file" ref={fileInputRef} onChange={handlePickPdfFile} accept=".pdf" className="hidden" />
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-[#4ea59d] uppercase tracking-[0.2em]">Exam Date</label>
                  <input type="date" value={examDate} onChange={(e) => setExamDate(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white font-bold focus:border-[#4ea59d] transition-all outline-none" />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-[#4ea59d] uppercase tracking-[0.2em]">Starting Time</label>
                  <input type="time" value={examTime} onChange={(e) => setExamTime(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white font-bold focus:border-[#4ea59d] transition-all outline-none" />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label className="text-[10px] font-black text-[#4ea59d] uppercase tracking-[0.2em]">Instructions / Summary</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={4}
                    placeholder="Enter special instructions or curriculum coverage..."
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white font-medium focus:border-[#4ea59d] transition-all outline-none resize-none"
                  ></textarea>
                </div>
              </div>

              <div className="pt-6 border-t border-white/5">
                <button
                  onClick={saveExam}
                  disabled={isSavingExam}
                  className="w-full py-5 bg-[#4ea59d] text-white rounded-[24px] text-xs font-black uppercase tracking-[0.3em] shadow-xl shadow-[#4ea59d]/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:scale-100"
                >
                  {isSavingExam ? <span className="flex items-center justify-center gap-3"><i className="fa-solid fa-spinner animate-spin"></i> Finalizing Details...</span> : (editingExamId ? 'Update Assessment Protocol' : 'Deploy Assessment Protocol')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
