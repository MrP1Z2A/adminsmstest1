import React from 'react';
import { jsPDF } from 'jspdf';
import { Student } from '../types';
import { supabase } from '../supabaseClient';

/**
 * StudentDirectory Component
 * 
 * Displays a searchable/filterable list of all students in the system.
 * Includes administrative controls for editing, deleting, and managing permissions.
 */

interface StudentDirectoryProps {
  students: Student[];
  classes: any[];
  title?: string;
  selectLabel?: string;
  namePrefix?: string;
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  bulkAssignStudentsToClass: (studentIds: string[], classId: string, classCourseId?: string) => Promise<void>;
  bulkDeleteStudents: (studentIds: string[]) => Promise<void>;
  openPermissions: (student: Student) => void;
  openEditModal: (type: string, data: any) => void;
  requestStudentEditWithPassword: (student: Student) => void;
  verifyAdminPassword: (password: string) => Promise<boolean>;
  updateStudentProfilePhoto: (studentId: string, file: File) => Promise<Student>;
  deleteEntity: (id: string, type: string) => void;
}

const StudentDirectory: React.FC<StudentDirectoryProps> = ({
  students,
  classes,
  title = 'Student Directory',
  selectLabel = 'Student Select',
  namePrefix = '',
  selectedDate,
  setSelectedDate,
  bulkAssignStudentsToClass,
  bulkDeleteStudents,
  openPermissions,
  openEditModal,
  requestStudentEditWithPassword,
  verifyAdminPassword,
  updateStudentProfilePhoto,
  deleteEntity
}) => {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [genderFilter, setGenderFilter] = React.useState<'all' | 'Male' | 'Female'>('all');
  const [isSelectMode, setIsSelectMode] = React.useState(false);
  const [selectedStudentIds, setSelectedStudentIds] = React.useState<string[]>([]);
  const [bulkClassId, setBulkClassId] = React.useState('');
  const [bulkCourseId, setBulkCourseId] = React.useState('');
  const [bulkCourses, setBulkCourses] = React.useState<Array<{ id: string; name: string; class_id: string }>>([]);
  const [isBulkCoursesLoading, setIsBulkCoursesLoading] = React.useState(false);
  const [isBulkAssigning, setIsBulkAssigning] = React.useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = React.useState(false);
  const [selectedStudent, setSelectedStudent] = React.useState<Student | null>(null);
  const [pendingInfoStudent, setPendingInfoStudent] = React.useState<Student | null>(null);
  const [infoAuthDialogOpen, setInfoAuthDialogOpen] = React.useState(false);
  const [infoAuthInput, setInfoAuthInput] = React.useState('');
  const [infoAuthError, setInfoAuthError] = React.useState<string | null>(null);
  const [isInfoAuthSubmitting, setIsInfoAuthSubmitting] = React.useState(false);
  const [isTempPasswordVisible, setIsTempPasswordVisible] = React.useState(false);
  const [tempPasswordAuthDialogOpen, setTempPasswordAuthDialogOpen] = React.useState(false);
  const [tempPasswordAuthInput, setTempPasswordAuthInput] = React.useState('');
  const [tempPasswordAuthError, setTempPasswordAuthError] = React.useState<string | null>(null);
  const [isTempPasswordAuthSubmitting, setIsTempPasswordAuthSubmitting] = React.useState(false);
  const [isPhotoUploading, setIsPhotoUploading] = React.useState(false);
  const [photoUploadError, setPhotoUploadError] = React.useState<string | null>(null);
  const profilePhotoInputRef = React.useRef<HTMLInputElement | null>(null);
  const [showIdFormatPanel, setShowIdFormatPanel] = React.useState(false);
  const [idPrefix, setIdPrefix] = React.useState<string>(() => {
    try { return localStorage.getItem('dir_idPrefix') || ''; } catch { return ''; }
  });
  const [idPadLength, setIdPadLength] = React.useState<number>(() => {
    try { return Number(localStorage.getItem('dir_idPadLength') || '0'); } catch { return 0; }
  });
  const [stripNodePrefix, setStripNodePrefix] = React.useState<boolean>(() => {
    try { const v = localStorage.getItem('dir_stripNodePrefix'); return v === null ? true : v === 'true'; } catch { return true; }
  });
  const [showSavePasswordPrompt, setShowSavePasswordPrompt] = React.useState(false);
  const [savePasswordInput, setSavePasswordInput] = React.useState('');
  const [savePasswordError, setSavePasswordError] = React.useState<string | null>(null);
  const [isSavingFormat, setIsSavingFormat] = React.useState(false);
  const [saveFormatSuccess, setSaveFormatSuccess] = React.useState(false);
  const MAX_PROFILE_PHOTO_BYTES = 5 * 1024 * 1024;
  const ALLOWED_PROFILE_PHOTO_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

  const hiddenStudentInfoKeys = new Set([
    'temp_password',
    'temp_password_created_at',
    'avatar',
    'avatar_url',
    'profile_image_url',
    'image_url',
    'auth_user_id',
    'permissions',
    'courseAttendance',
    'attendanceRate',
    'securityStatus',
    'type',
  ]);

  const filteredStudents = students.filter(student => {
    const q = searchQuery.trim().toLowerCase();
    const matchesQuery = !q || (
      student.name.toLowerCase().includes(q) ||
      String(student.id).toLowerCase().includes(q) ||
      student.email.toLowerCase().includes(q)
    );

    const matchesGender = genderFilter === 'all' || String(student.gender || '').toLowerCase() === genderFilter.toLowerCase();

    const studentDate = String((student as any).created_at || '').slice(0, 10);
    const matchesDate = !selectedDate || studentDate === selectedDate;

    return matchesQuery && matchesGender && matchesDate;
  });

  const formatId = (id: any): string => {
    let raw = String(id);
    if (stripNodePrefix && raw.startsWith('NODE-')) raw = raw.slice(5);
    const padded = idPadLength > 0 ? raw.padStart(idPadLength, '0') : raw;
    return `${idPrefix}${padded}`;
  };

  const resolveDirectoryTable = (): 'students' | 'teachers' | 'student_services' => {
    const normalizedTitle = String(title || '').toLowerCase();
    if (normalizedTitle.includes('teacher')) return 'teachers';
    if (normalizedTitle.includes('service')) return 'student_services';
    return 'students';
  };

  const syncFormattedIdsToSupabase = async () => {
    const allFormattedIds = students.map(student => formatId(student.id));
    if (new Set(allFormattedIds).size !== allFormattedIds.length) {
      return {
        ok: false,
        message: 'Formatted IDs are not unique. Please adjust prefix or zero-padding.',
        updatedCount: 0,
      };
    }

    const updates = students
      .map(student => {
        const oldId = String(student.id);
        const newId = formatId(student.id);
        return { oldId, newId };
      })
      .filter(item => item.oldId !== item.newId);

    if (updates.length === 0) {
      return { ok: true, message: '', updatedCount: 0 };
    }

    const targetTable = resolveDirectoryTable();

    for (const updateItem of updates) {
      const { oldId, newId } = updateItem;

      if (targetTable === 'students') {
        const studentReferenceTables: Array<{ table: string; column: string }> = [
          { table: 'parents', column: 'student_id' },
          { table: 'class_course_students', column: 'student_id' },
          { table: 'student_courses', column: 'student_id' },
          { table: 'attendance_records', column: 'student_id' },
          { table: 'exam_grades', column: 'student_id' },
          { table: 'report_cards', column: 'student_id' },
          { table: 'student_payments', column: 'student_id' },
        ];

        for (const ref of studentReferenceTables) {
          const { error: refError } = await supabase
            .schema('public')
            .from(ref.table)
            .update({ [ref.column]: newId })
            .eq(ref.column, oldId);

          if (refError && !/column .* does not exist|relation .* does not exist/i.test(refError.message || '')) {
            return {
              ok: false,
              message: `Failed to sync ${ref.table}.${ref.column}: ${refError.message}`,
              updatedCount: 0,
            };
          }
        }
      }

      const { error: idUpdateError } = await supabase
        .schema('public')
        .from(targetTable)
        .update({ id: newId })
        .eq('id', oldId);

      if (idUpdateError) {
        return {
          ok: false,
          message: `Failed to update ${targetTable}.id: ${idUpdateError.message}`,
          updatedCount: 0,
        };
      }
    }

    return { ok: true, message: '', updatedCount: updates.length };
  };

  const confirmSaveIdFormat = async () => {
    if (!savePasswordInput.trim()) return;

    setIsSavingFormat(true);
    setSavePasswordError(null);

    try {
      const ok = await verifyAdminPassword(savePasswordInput);
      if (!ok) {
        setSavePasswordError('Incorrect admin password.');
        return;
      }

      try {
        localStorage.setItem('dir_idPrefix', idPrefix);
        localStorage.setItem('dir_idPadLength', String(idPadLength));
        localStorage.setItem('dir_stripNodePrefix', String(stripNodePrefix));
      } catch {
        // Ignore localStorage errors and still continue with DB sync.
      }

      const syncResult = await syncFormattedIdsToSupabase();
      if (!syncResult.ok) {
        setSavePasswordError(syncResult.message || 'Failed to sync IDs to Supabase.');
        return;
      }

      setSaveFormatSuccess(true);
      setShowSavePasswordPrompt(false);
      setSavePasswordInput('');

      if (syncResult.updatedCount > 0) {
        // Reload to reflect updated IDs from backend and linked pages.
        setTimeout(() => {
          window.location.reload();
        }, 300);
      }
    } finally {
      setIsSavingFormat(false);
    }
  };

  const getStudentClassName = (studentId: string) => {
    const matchedClass = classes.find(classItem =>
      (classItem?.student_ids || []).map((id: any) => String(id)).includes(String(studentId))
    );

    return matchedClass?.name ? String(matchedClass.name) : 'No Class';
  };

  React.useEffect(() => {
    const loadBulkCourses = async () => {
      if (!bulkClassId) {
        setBulkCourses([]);
        setIsBulkCoursesLoading(false);
        return;
      }

      setIsBulkCoursesLoading(true);
      try {
        const { data, error } = await supabase
          .from('class_courses')
          .select('id, name, class_id')
          .eq('class_id', bulkClassId)
          .order('created_at', { ascending: false });

        if (error) throw error;

        setBulkCourses((data || []).map((course: any) => ({
          id: String(course.id),
          name: String(course.name || ''),
          class_id: String(course.class_id || ''),
        })));
      } catch (error) {
        console.error('Failed to load bulk courses:', error);
        setBulkCourses([]);
      } finally {
        setIsBulkCoursesLoading(false);
      }
    };

    void loadBulkCourses();
  }, [bulkClassId]);

  const renderDetailValue = (value: unknown) => {
    if (value === null || value === undefined || value === '') {
      return '—';
    }

    if (typeof value === 'object') {
      return JSON.stringify(value);
    }

    return String(value);
  };

  const resolveProfileImageUrl = (student: Student) => {
    const candidate = [
      (student as any).avatar,
      (student as any).avatar_url,
      (student as any).profile_image_url,
      (student as any).image_url,
    ].find(value => typeof value === 'string' && value.trim().length > 0) as string | undefined;

    if (!candidate) return '';
    if (/^(https?:|data:|blob:)/i.test(candidate)) return candidate;

    const cleanedPath = candidate.replace(/^\/+/, '');
    const { data } = supabase.storage.from('student_profile').getPublicUrl(cleanedPath);
    return data?.publicUrl || '';
  };

  React.useEffect(() => {
    setIsTempPasswordVisible(false);
    setTempPasswordAuthDialogOpen(false);
    setTempPasswordAuthInput('');
    setTempPasswordAuthError(null);
    setIsTempPasswordAuthSubmitting(false);
    setIsPhotoUploading(false);
    setPhotoUploadError(null);
  }, [selectedStudent?.id]);

  React.useEffect(() => {
    if (!selectedStudent) return;
    const latest = students.find(student => String(student.id) === String(selectedStudent.id));
    if (!latest) return;
    setSelectedStudent(prev => {
      if (!prev) return prev;
      if (prev === latest) return prev;
      return { ...latest };
    });
  }, [students, selectedStudent?.id]);

  const requestOpenStudentInfo = (student: Student) => {
    setPendingInfoStudent(student);
    setInfoAuthDialogOpen(true);
    setInfoAuthInput('');
    setInfoAuthError(null);
    setIsInfoAuthSubmitting(false);
  };

  const confirmOpenStudentInfo = async () => {
    if (!pendingInfoStudent) return;
    if (!infoAuthInput.trim()) {
      setInfoAuthError('Admin password is required.');
      return;
    }

    setIsInfoAuthSubmitting(true);
    setInfoAuthError(null);

    try {
      const ok = await verifyAdminPassword(infoAuthInput);
      if (!ok) {
        setInfoAuthError('Invalid admin password.');
        return;
      }

      setSelectedStudent(pendingInfoStudent);
      setInfoAuthDialogOpen(false);
      setInfoAuthInput('');
      setInfoAuthError(null);
    } finally {
      setIsInfoAuthSubmitting(false);
    }
  };

  const handleChangeProfilePhoto = () => {
    if (isPhotoUploading) return;
    profilePhotoInputRef.current?.click();
  };

  const handleProfilePhotoSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedStudent) {
      return;
    }

    if (!ALLOWED_PROFILE_PHOTO_TYPES.has(file.type)) {
      setPhotoUploadError('Only JPG, PNG, or WEBP images are allowed.');
      event.target.value = '';
      return;
    }

    if (file.size > MAX_PROFILE_PHOTO_BYTES) {
      setPhotoUploadError('Image size must be 5MB or less.');
      event.target.value = '';
      return;
    }

    setIsPhotoUploading(true);
    setPhotoUploadError(null);

    try {
      const updatedStudent = await updateStudentProfilePhoto(selectedStudent.id, file);
      setSelectedStudent(updatedStudent);
    } catch (error: any) {
      console.error('Profile photo update failed:', error);
      setPhotoUploadError(error?.message || 'Failed to upload profile photo.');
    } finally {
      setIsPhotoUploading(false);
      event.target.value = '';
    }
  };

  const unlockTempPassword = async () => {
    if (!tempPasswordAuthInput.trim()) {
      setTempPasswordAuthError('Admin password is required.');
      return;
    }

    setIsTempPasswordAuthSubmitting(true);
    setTempPasswordAuthError(null);

    try {
      const ok = await verifyAdminPassword(tempPasswordAuthInput);
      if (!ok) {
        setTempPasswordAuthError('Invalid admin password.');
        return;
      }

      setIsTempPasswordVisible(true);
      setTempPasswordAuthDialogOpen(false);
      setTempPasswordAuthInput('');
      setTempPasswordAuthError(null);
    } finally {
      setIsTempPasswordAuthSubmitting(false);
    }
  };

  const handleRequestStudentEdit = (student: Student) => {
    setSelectedStudent(null);
    requestStudentEditWithPassword(student);
  };

  const toggleStudentSelection = (studentId: string, checked: boolean) => {
    setSelectedStudentIds(prev => {
      if (checked) {
        if (prev.includes(studentId)) return prev;
        return [...prev, studentId];
      }
      return prev.filter(id => id !== studentId);
    });
  };

  const handleBulkAssign = async () => {
    if (!selectedStudentIds.length) return;
    if (!bulkClassId) return;

    setIsBulkAssigning(true);
    try {
      await bulkAssignStudentsToClass(selectedStudentIds, bulkClassId, bulkCourseId || undefined);
      setSelectedStudentIds([]);
      setBulkClassId('');
      setBulkCourseId('');
      setIsSelectMode(false);
    } finally {
      setIsBulkAssigning(false);
    }
  };

  const filteredStudentIds = React.useMemo(
    () => filteredStudents.map(student => String(student.id)),
    [filteredStudents]
  );

  const areAllFilteredSelected = filteredStudentIds.length > 0
    && filteredStudentIds.every(studentId => selectedStudentIds.includes(studentId));

  const toggleSelectAllFiltered = () => {
    if (!filteredStudentIds.length) return;

    setSelectedStudentIds(prev => {
      if (areAllFilteredSelected) {
        return prev.filter(id => !filteredStudentIds.includes(id));
      }

      return Array.from(new Set([...prev, ...filteredStudentIds]));
    });
  };

  const handleBulkDelete = async () => {
    if (!selectedStudentIds.length) return;

    setIsBulkDeleting(true);
    try {
      await bulkDeleteStudents(selectedStudentIds);
      setSelectedStudentIds([]);
      setBulkClassId('');
      setBulkCourseId('');
      setIsSelectMode(false);
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const downloadDirectoryPdf = () => {
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const marginX = 40;
    let y = 44;
    const lineHeight = 16;
    const pageHeight = doc.internal.pageSize.height;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text(`${title} PDF`, marginX, y);

    y += 20;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString()}`, marginX, y);

    y += 20;
    doc.text(`Records: ${filteredStudents.length}`, marginX, y);

    y += 24;
    doc.setFont('helvetica', 'bold');
    doc.text('Name | ID | Email | Class', marginX, y);

    y += 12;
    doc.setDrawColor(220);
    doc.line(marginX, y, 555, y);
    y += 12;

    doc.setFont('helvetica', 'normal');

    filteredStudents.forEach((student) => {
      const rowText = `${namePrefix}${student.name} | ${formatId(student.id)} | ${student.email || '-'} | ${getStudentClassName(String(student.id))}`;
      const wrapped = doc.splitTextToSize(rowText, 515);

      if (y + (wrapped.length * lineHeight) > pageHeight - 36) {
        doc.addPage();
        y = 44;
      }

      doc.text(wrapped, marginX, y);
      y += wrapped.length * lineHeight + 6;
    });

    if (filteredStudents.length === 0) {
      doc.text('No records found for current filters.', marginX, y);
    }

    const fileBase = String(title || 'directory').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    doc.save(`${fileBase}-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  return (
    <div className="space-y-12 animate-in fade-in duration-700 pb-20">
      {/* Header Section with Title and Filters */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-10">
        <div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tighter">{title}</h2>
          <p className="text-sm text-slate-400 font-bold uppercase tracking-[0.3em] mt-3">Identity Management Protocol</p>
        </div>
        
        {/* Filter Pills */}
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
          <div className="bg-white dark:bg-slate-900 p-2 rounded-[24px] sm:rounded-[32px] shadow-premium border border-slate-100 dark:border-slate-800 flex items-center gap-2">
            <i className="fas fa-search text-slate-400 px-2"></i>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search name, id, email"
              autoComplete="off"
              name="directory-search"
              spellCheck={false}
              className="bg-transparent text-sm font-semibold px-2 py-2 outline-none min-w-[220px]"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="px-3 py-2 rounded-[14px] text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                Clear
              </button>
            )}
          </div>
          <div className="bg-white dark:bg-slate-900 p-2 rounded-[24px] sm:rounded-[32px] shadow-premium border border-slate-100 dark:border-slate-800 flex items-center gap-2">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="border p-2 rounded"
              title="Filter by created date"
            />
            {selectedDate && (
              <button
                onClick={() => setSelectedDate('')}
                className="px-3 py-2 rounded-[14px] text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                Clear
              </button>
            )}
          </div>
          <div className="bg-white dark:bg-slate-900 p-2 rounded-[24px] sm:rounded-[32px] shadow-premium border border-slate-100 dark:border-slate-800 flex items-center gap-2">
            <select
              value={genderFilter}
              onChange={(e) => setGenderFilter(e.target.value as 'all' | 'Male' | 'Female')}
              className="bg-transparent text-sm font-semibold px-2 py-2 outline-none"
              title="Filter by gender"
            >
              <option value="all">All Gender</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
            </select>
          </div>
          <button
            onClick={() => {
              setIsSelectMode(prev => {
                const next = !prev;
                if (!next) {
                  setSelectedStudentIds([]);
                  setBulkClassId('');
                  setBulkCourseId('');
                }
                return next;
              });
            }}
            className={`px-4 py-3 rounded-[18px] text-xs font-black uppercase tracking-widest ${isSelectMode ? 'bg-rose-500 text-white' : 'bg-brand-500 text-white'}`}
          >
            {isSelectMode ? 'Cancel Select' : selectLabel}
          </button>
          <button
            onClick={downloadDirectoryPdf}
            className="px-4 py-3 rounded-[18px] text-xs font-black uppercase tracking-widest bg-slate-900 text-white"
          >
            Download PDF
          </button>
          <button
            onClick={() => setShowIdFormatPanel(p => !p)}
            className={`px-4 py-3 rounded-[18px] text-xs font-black uppercase tracking-widest transition-all ${
              showIdFormatPanel ? 'bg-brand-500 text-white' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shadow-premium'
            }`}
          >
            <i className="fas fa-hashtag mr-1.5"></i> ID Format
          </button>

        </div>
      </div>

      {showIdFormatPanel && (
        <div className="bg-white dark:bg-slate-900 rounded-[24px] p-5 shadow-premium border border-slate-100 dark:border-slate-800 space-y-5">
          <div className="flex items-center justify-between gap-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">ID Format Configuration</p>
            {saveFormatSuccess && (
              <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500">
                <i className="fas fa-check mr-1"></i> Saved
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-end gap-5">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Strip NODE- Prefix</p>
              <button
                onClick={() => setStripNodePrefix(p => !p)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all border ${
                  stripNodePrefix
                    ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 border-emerald-200 dark:border-emerald-700'
                    : 'bg-slate-50 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700'
                }`}
              >
                <i className={`fas ${stripNodePrefix ? 'fa-toggle-on' : 'fa-toggle-off'} text-base`}></i>
                {stripNodePrefix ? 'On' : 'Off'}
              </button>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Display Prefix</p>
              <input
                type="text"
                value={idPrefix}
                onChange={(e) => setIdPrefix(e.target.value)}
                placeholder="e.g. STU-"
                className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm font-semibold outline-none w-36"
              />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Zero Padding</p>
              <select
                value={idPadLength}
                onChange={(e) => setIdPadLength(Number(e.target.value))}
                className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm font-semibold outline-none"
              >
                <option value={0}>None</option>
                <option value={3}>3 digits — 001</option>
                <option value={4}>4 digits — 0001</option>
                <option value={5}>5 digits — 00001</option>
                <option value={6}>6 digits — 000001</option>
              </select>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Preview</p>
              <div className="bg-slate-100 dark:bg-slate-800 rounded-xl px-4 py-2 text-sm font-black text-brand-500 font-mono min-w-[120px]">
                {formatId(students.length > 0 ? students[0].id : 'NODE-A1B2C3D4E5')}
              </div>
            </div>
          </div>

          {!showSavePasswordPrompt ? (
            <div className="flex items-center gap-3 pt-1 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => { setShowSavePasswordPrompt(true); setSavePasswordInput(''); setSavePasswordError(null); setSaveFormatSuccess(false); }}
                className="px-5 py-2.5 rounded-xl bg-brand-500 text-white text-xs font-black uppercase tracking-widest shadow transition-all hover:opacity-90"
              >
                <i className="fas fa-floppy-disk mr-1.5"></i> Save Format
              </button>
              <button
                onClick={() => { setIdPrefix(''); setIdPadLength(0); setStripNodePrefix(true); }}
                className="px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest text-slate-400 hover:text-rose-500 border border-slate-200 dark:border-slate-700 transition-all"
              >
                Reset
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-end gap-3 pt-1 border-t border-slate-100 dark:border-slate-800">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Admin Password</p>
                <input
                  type="password"
                  value={savePasswordInput}
                  onChange={(e) => { setSavePasswordInput(e.target.value); setSavePasswordError(null); }}
                  onKeyDown={async (e) => {
                    if (e.key !== 'Enter') return;
                    e.preventDefault();
                    await confirmSaveIdFormat();
                  }}
                  placeholder="Enter admin password"
                  autoFocus
                  className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm font-semibold outline-none w-52"
                />
                {savePasswordError && <p className="mt-1 text-[10px] font-bold text-rose-500">{savePasswordError}</p>}
              </div>
              <button
                disabled={isSavingFormat || !savePasswordInput.trim()}
                onClick={() => void confirmSaveIdFormat()}
                className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest text-white transition-all ${
                  isSavingFormat || !savePasswordInput.trim() ? 'bg-slate-300 cursor-not-allowed' : 'bg-brand-500 hover:opacity-90'
                }`}
              >
                {isSavingFormat ? 'Saving...' : 'Confirm Save'}
              </button>
              <button
                onClick={() => { setShowSavePasswordPrompt(false); setSavePasswordInput(''); setSavePasswordError(null); }}
                className="px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 border border-slate-200 dark:border-slate-700 transition-all"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}

      {isSelectMode && (
        <div className="bg-white dark:bg-slate-900 rounded-[24px] p-4 sm:p-5 shadow-premium border border-slate-100 dark:border-slate-800">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-xs font-black uppercase tracking-widest text-slate-500">{selectedStudentIds.length} selected</p>
            <button
              onClick={toggleSelectAllFiltered}
              disabled={!filteredStudentIds.length || isBulkDeleting || isBulkAssigning}
              className={`w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest text-white ${!filteredStudentIds.length || isBulkDeleting || isBulkAssigning ? 'bg-slate-300 cursor-not-allowed' : 'bg-slate-700 dark:bg-slate-600'}`}
            >
              {areAllFilteredSelected ? 'Unselect All' : 'Select All'}
            </button>
            <select
              value={bulkClassId}
              onChange={(e) => {
                setBulkClassId(e.target.value);
                setBulkCourseId('');
              }}
              className="w-full sm:w-auto bg-slate-50 dark:bg-slate-800 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold"
            >
              <option value="">Choose Class</option>
              {classes.map(classItem => (
                <option key={classItem.id} value={classItem.id}>{classItem.name} ({classItem.class_code || classItem.id})</option>
              ))}
            </select>
            <select
              value={bulkCourseId}
              onChange={(e) => setBulkCourseId(e.target.value)}
              disabled={!bulkClassId || isBulkCoursesLoading}
              className="w-full sm:w-auto bg-slate-50 dark:bg-slate-800 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold disabled:opacity-60"
            >
              <option value="">{!bulkClassId ? 'Choose Course' : isBulkCoursesLoading ? 'Loading Courses...' : 'Choose Course'}</option>
              {bulkCourses.map(course => (
                <option key={course.id} value={course.id}>{course.name}</option>
              ))}
            </select>
            <button
              onClick={() => void handleBulkAssign()}
              disabled={!selectedStudentIds.length || !bulkClassId || isBulkAssigning || isBulkDeleting}
              className={`w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest text-white ${!selectedStudentIds.length || !bulkClassId || isBulkAssigning || isBulkDeleting ? 'bg-brand-300 cursor-not-allowed' : 'bg-brand-500'}`}
            >
              {isBulkAssigning ? 'Assigning...' : 'Add To Class/Course'}
            </button>
            <button
              onClick={() => void handleBulkDelete()}
              disabled={!selectedStudentIds.length || isBulkDeleting || isBulkAssigning}
              className={`w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest text-white ${!selectedStudentIds.length || isBulkDeleting || isBulkAssigning ? 'bg-rose-300 cursor-not-allowed' : 'bg-rose-500'}`}
            >
              {isBulkDeleting ? 'Deleting...' : 'Delete Selected'}
            </button>
          </div>
        </div>
      )}

      {/* Grid View */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filteredStudents.map(s => (
            <div key={s.id} className="bg-white dark:bg-slate-900 rounded-[28px] border border-slate-100 dark:border-slate-800 shadow-premium p-5 flex flex-col gap-4 hover:shadow-lg transition-all">
              <div className="flex items-center gap-3">
                {isSelectMode && (
                  <input
                    type="checkbox"
                    checked={selectedStudentIds.includes(String(s.id))}
                    onChange={(e) => toggleStudentSelection(String(s.id), e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-brand-500 focus:ring-brand-500"
                  />
                )}
                {resolveProfileImageUrl(s) ? (
                  <img
                    src={resolveProfileImageUrl(s)}
                    alt={`${s.name} profile`}
                    className="w-14 h-14 rounded-2xl object-cover border border-slate-200 dark:border-slate-700 shadow-inner"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-black text-xl text-brand-500 shadow-inner">
                    {s.name.charAt(0)}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-black tracking-tight truncate">{namePrefix}{s.name}</p>
                  <p className="text-[10px] text-slate-400 truncate">{String(s.email || '').toLowerCase()}</p>
                </div>
              </div>
              <div className="space-y-1.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                <div className="flex items-center gap-2">
                  <i className="fas fa-id-card w-3 text-slate-300"></i>
                  <span className="truncate">{formatId(s.id)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <i className="fas fa-school w-3 text-slate-300"></i>
                  <span>{getStudentClassName(String(s.id))}</span>
                </div>
                <div className="flex items-center gap-2">
                  <i className="fas fa-venus-mars w-3 text-slate-300"></i>
                  <span>{s.gender || '—'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <i className="fas fa-circle-dot w-3 text-slate-300"></i>
                  <span className={s.status === 'Active' ? 'text-emerald-500' : s.status === 'Inactive' ? 'text-rose-400' : 'text-amber-500'}>{s.status}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                <button
                  onClick={() => requestOpenStudentInfo(s)}
                  disabled={isSelectMode}
                  className="flex-1 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-500 hover:text-brand-500 text-xs font-black uppercase tracking-widest transition-all"
                >
                  <i className="fas fa-circle-info mr-1"></i> Info
                </button>
                <button
                  onClick={() => deleteEntity(s.id, 'student')}
                  disabled={isSelectMode}
                  className="w-9 h-9 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-rose-500 flex items-center justify-center transition-all"
                  title="Delete"
                >
                  <i className="fas fa-trash text-xs"></i>
                </button>
              </div>
            </div>
          ))}
          {filteredStudents.length === 0 && (
            <div className="col-span-full text-center py-16 text-slate-400">
              <i className="fas fa-users text-5xl mb-4 opacity-20"></i>
              <p className="font-bold">No records match your filters.</p>
            </div>
          )}
        </div>



      {selectedStudent && (
        <div className="fixed inset-0 z-[220] bg-slate-950/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-2xl p-6 space-y-5 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between gap-4">
              <h3 className="text-xl font-black tracking-tight">Student Information</h3>
              <button
                onClick={() => setSelectedStudent(null)}
                className="w-10 h-10 rounded-full hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-400"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>

            <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-800 rounded-2xl p-4 border border-slate-100 dark:border-slate-700">
              {resolveProfileImageUrl(selectedStudent) ? (
                <img
                  src={resolveProfileImageUrl(selectedStudent)}
                  alt={`${selectedStudent.name} profile`}
                  className="w-20 h-20 rounded-2xl object-cover border border-slate-200 dark:border-slate-700"
                />
              ) : (
                <div className="w-20 h-20 rounded-2xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center font-black text-2xl text-brand-500">
                  {selectedStudent.name.charAt(0)}
                </div>
              )}
              <div className="min-w-0">
                <p className="text-lg font-black tracking-tight truncate">{namePrefix}{selectedStudent.name}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{selectedStudent.email}</p>
                <p className="text-[10px] text-slate-400 uppercase tracking-widest mt-1">ID: {formatId(selectedStudent.id)}</p>
                <button
                  onClick={handleChangeProfilePhoto}
                  disabled={isPhotoUploading}
                  className="mt-3 px-3 py-1.5 rounded-lg bg-brand-500 text-white text-[10px] font-black uppercase tracking-widest"
                >
                  {isPhotoUploading ? 'Uploading...' : 'Change Profile Photo'}
                </button>
                <input
                  ref={profilePhotoInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleProfilePhotoSelected}
                  className="hidden"
                />
                {photoUploadError && (
                  <p className="mt-2 text-xs font-bold text-rose-500">{photoUploadError}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(selectedStudent)
                .filter(([key]) => !hiddenStudentInfoKeys.has(key))
                .map(([key, value]) => (
                <div key={key} className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-4 border border-slate-100 dark:border-slate-700">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">{key}</p>
                  <p className="text-sm font-semibold break-words">{renderDetailValue(value)}</p>
                </div>
              ))}
            </div>

            {'temp_password' in selectedStudent && (
              <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-4 border border-slate-100 dark:border-slate-700">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">temp_password</p>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold break-words">
                    {isTempPasswordVisible ? String((selectedStudent as any).temp_password || '—') : '••••••••••'}
                  </p>
                  {!isTempPasswordVisible && (
                    <button
                      onClick={() => setTempPasswordAuthDialogOpen(true)}
                      className="px-3 py-1.5 rounded-lg bg-brand-500 text-white text-[10px] font-black uppercase tracking-widest"
                    >
                      View
                    </button>
                  )}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3">
              <button
                onClick={() => handleRequestStudentEdit(selectedStudent)}
                className="px-4 py-2.5 rounded-xl bg-brand-500 text-white font-bold text-xs uppercase tracking-widest"
              >
                Edit (Admin Password)
              </button>
              <button
                onClick={() => setSelectedStudent(null)}
                className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs uppercase tracking-widest"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {tempPasswordAuthDialogOpen && (
        <div className="fixed inset-0 z-[225] bg-slate-950/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-2xl p-6 space-y-5">
            <h3 className="text-lg font-black tracking-tight">Admin Verification</h3>
            <p className="text-sm text-slate-600 dark:text-slate-300">Enter admin password to view temp password.</p>

            <input
              type="password"
              value={tempPasswordAuthInput}
              onChange={(e) => setTempPasswordAuthInput(e.target.value)}
              autoComplete="new-password"
              name="temp-password-auth"
              className="w-full bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 outline-none"
              placeholder="Admin password"
            />

            {tempPasswordAuthError && (
              <p className="text-xs font-bold text-rose-500">{tempPasswordAuthError}</p>
            )}

            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  if (isTempPasswordAuthSubmitting) return;
                  setTempPasswordAuthDialogOpen(false);
                  setTempPasswordAuthInput('');
                  setTempPasswordAuthError(null);
                }}
                className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs uppercase tracking-widest"
              >
                Cancel
              </button>
              <button
                onClick={unlockTempPassword}
                disabled={isTempPasswordAuthSubmitting}
                className={`px-4 py-2.5 rounded-xl text-white font-bold text-xs uppercase tracking-widest ${isTempPasswordAuthSubmitting ? 'bg-brand-300 cursor-not-allowed' : 'bg-brand-500'}`}
              >
                {isTempPasswordAuthSubmitting ? 'Verifying...' : 'Unlock'}
              </button>
            </div>
          </div>
        </div>
      )}

      {infoAuthDialogOpen && (
        <div className="fixed inset-0 z-[226] bg-slate-950/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-2xl p-6 space-y-5">
            <h3 className="text-lg font-black tracking-tight">Admin Verification</h3>
            <p className="text-sm text-slate-600 dark:text-slate-300">Enter admin password to view student information.</p>

            <input
              type="password"
              value={infoAuthInput}
              onChange={(e) => setInfoAuthInput(e.target.value)}
              autoComplete="new-password"
              name="info-auth-password"
              className="w-full bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 outline-none"
              placeholder="Admin password"
            />

            {infoAuthError && (
              <p className="text-xs font-bold text-rose-500">{infoAuthError}</p>
            )}

            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  if (isInfoAuthSubmitting) return;
                  setInfoAuthDialogOpen(false);
                  setPendingInfoStudent(null);
                  setInfoAuthInput('');
                  setInfoAuthError(null);
                }}
                className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs uppercase tracking-widest"
              >
                Cancel
              </button>
              <button
                onClick={confirmOpenStudentInfo}
                disabled={isInfoAuthSubmitting}
                className={`px-4 py-2.5 rounded-xl text-white font-bold text-xs uppercase tracking-widest ${isInfoAuthSubmitting ? 'bg-brand-300 cursor-not-allowed' : 'bg-brand-500'}`}
              >
                {isInfoAuthSubmitting ? 'Verifying...' : 'Open'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentDirectory;
