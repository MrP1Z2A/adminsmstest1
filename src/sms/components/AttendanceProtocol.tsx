import React from 'react';
import { Student } from '../types';
import { supabase } from '../supabaseClient';

/**
 * AttendanceProtocol Component
 * 
 * Manages subject-specific attendance tracking.
 * Includes subject selection, date picking, and bulk marking capabilities.
 */

interface AttendanceProtocolProps {
  students: Student[];
  subjects: any[];
  attendanceDate: string;
  setAttendanceDate: (date: string) => void;
  classes: any[];
  schoolId: string | undefined;
  allStudents: any[];
  className: string;
  setClassName: (name: string) => void;
  classImage: File | null;
  setClassImage: (file: File | null) => void;
  classOuterColor: string;
  setClassOuterColor: (color: string) => void;
  createClassWithStudents: () => void;
  editingClassId: string | null;
  startEditClass: (classItem: any) => void;
  cancelEditClass: () => void;
  saveClassEdits: () => void;
  deleteClass: (classId: string, onDeleted?: () => void) => void;
  removeStudentFromClass: (classId: string, studentId: string, classCourseId?: string) => void;
  selectedAttendanceSubject: string | null;
  setSelectedAttendanceSubject: (id: string | null) => void;
  subjectAttendanceStore: Record<string, Record<string, Record<string, 'P' | 'A' | 'L'>>>;
  updateSubjectAttendance: (contextType: 'class' | 'subject', contextId: string, date: string, studentId: string, status: 'P' | 'A' | 'L', contextName?: string) => Promise<void>;
  bulkMarkSubjectPresent: (contextType: 'class' | 'subject', contextId: string, date: string, studentIds: string[], contextName?: string) => Promise<void>;
  loadAttendanceForContext: (contextType: 'class' | 'subject', contextId: string, date: string) => Promise<void>;
  exportMonthlyAttendancePdf: (
    contextType: 'class' | 'subject',
    contextId: string,
    month: string,
    studentList: Array<{ id: string; name: string }>,
    contextLabel?: string
  ) => Promise<void>;
  notify: (msg: string) => void;
  openClassCoursePage?: (course: { id: string; name: string; classId: string; className?: string }) => void;
  classAttendancePage?: boolean;
  courseAttendanceOnly?: boolean;
  focusClassId?: string | null;
  focusCourse?: { id: string; name: string; classId: string; className?: string } | null;
  openClassAttendancePage?: (classId: string) => void;
  onExitClassAttendancePage?: () => void;
}

const AttendanceProtocol: React.FC<AttendanceProtocolProps> = ({
  students,
  subjects,
  attendanceDate,
  setAttendanceDate,
  classes,
  allStudents,
  className,
  setClassName,
  classImage,
  setClassImage,
  classOuterColor,
  setClassOuterColor,
  createClassWithStudents,
  editingClassId,
  startEditClass,
  cancelEditClass,
  saveClassEdits,
  deleteClass,
  removeStudentFromClass,
  selectedAttendanceSubject,
  setSelectedAttendanceSubject,
  subjectAttendanceStore,
  updateSubjectAttendance,
  bulkMarkSubjectPresent,
  loadAttendanceForContext,
  exportMonthlyAttendancePdf,
  notify,
  openClassCoursePage,
  classAttendancePage = false,
  courseAttendanceOnly = false,
  focusClassId = null,
  focusCourse = null,
  openClassAttendancePage,
  onExitClassAttendancePage,
  schoolId,
}) => {
  const TIMETABLE_BUCKET = 'class_timetable';
  const COURSE_PROFILE_BUCKET = 'course_profile';
  const COURSE_RESOURCES_BUCKET = 'resources';
  const CLASS_COURSES_TABLE = 'class_courses';
  const [selectedClassId, setSelectedClassId] = React.useState<string | null>(null);
  const [isClassFormOpen, setIsClassFormOpen] = React.useState(false);
  const [isAttendanceViewOpen, setIsAttendanceViewOpen] = React.useState(true);
  const [isTimetableViewOpen, setIsTimetableViewOpen] = React.useState(false);
  const [isTimetableUploading, setIsTimetableUploading] = React.useState(false);
  const [isTimetableLoading, setIsTimetableLoading] = React.useState(false);
  const [timetableFiles, setTimetableFiles] = React.useState<Array<{ name: string; path: string; url: string }>>([]);
  const [classCourses, setClassCourses] = React.useState<Array<{ id: string; name: string; class_id: string; image_url?: string | null }>>([]);
  const [isClassCoursesLoading, setIsClassCoursesLoading] = React.useState(false);
  const [isClassCourseImageSupported, setIsClassCourseImageSupported] = React.useState(true);
  const [isClassCourseCreating, setIsClassCourseCreating] = React.useState(false);
  const [isCreateCourseModalOpen, setIsCreateCourseModalOpen] = React.useState(false);
  const [isEditCourseModalOpen, setIsEditCourseModalOpen] = React.useState(false);
  const [isClassCourseUpdating, setIsClassCourseUpdating] = React.useState(false);
  const [deletingCourseId, setDeletingCourseId] = React.useState<string | null>(null);
  const [courseDeleteDialog, setCourseDeleteDialog] = React.useState<{ id: string; classId: string; name: string } | null>(null);
  const [courseDeleteNameInput, setCourseDeleteNameInput] = React.useState('');
  const [courseDeleteAdminPassword, setCourseDeleteAdminPassword] = React.useState('');
  const [courseDeleteError, setCourseDeleteError] = React.useState<string | null>(null);
  const [isCourseDeleteSubmitting, setIsCourseDeleteSubmitting] = React.useState(false);
  const [newCourseName, setNewCourseName] = React.useState('');
  const [newCourseImage, setNewCourseImage] = React.useState<File | null>(null);
  const [newCourseError, setNewCourseError] = React.useState<string | null>(null);
  const [editCourseId, setEditCourseId] = React.useState<string | null>(null);
  const [editCourseName, setEditCourseName] = React.useState('');
  const [editCourseCurrentImageUrl, setEditCourseCurrentImageUrl] = React.useState<string | null>(null);

  const [confirmDialog, setConfirmDialog] = React.useState<{ message: string; onConfirm: () => Promise<void> } | null>(null);
  const [isConfirmActionSubmitting, setIsConfirmActionSubmitting] = React.useState(false);

  const openConfirmDialog = (message: string, onConfirm: () => Promise<void>) => {
    setConfirmDialog({ message, onConfirm });
  };

  const guessFileNameFromUrl = React.useCallback((url: string, fallback = 'downloaded-file') => {
    try {
      const parsedUrl = new URL(url);
      const segment = parsedUrl.pathname.split('/').filter(Boolean).pop() || fallback;
      return decodeURIComponent(segment);
    } catch {
      return fallback;
    }
  }, []);

  const downloadFileDirectly = React.useCallback(async (url: string, fallbackName?: string) => {
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
      anchor.download = fallbackName || guessFileNameFromUrl(url);
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (downloadError: any) {
      notify(downloadError?.message || 'Failed to download file.');
    }
  }, [guessFileNameFromUrl, notify]);
  const [editCourseImage, setEditCourseImage] = React.useState<File | null>(null);
  const [editCourseError, setEditCourseError] = React.useState<string | null>(null);
  const [classSearchQuery, setClassSearchQuery] = React.useState('');
  const [exportMonth, setExportMonth] = React.useState(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  });
  const [isCourseCalendarOpen, setIsCourseCalendarOpen] = React.useState(true);
  const [isCourseCalendarLoading, setIsCourseCalendarLoading] = React.useState(false);
  const [courseCalendarEvents, setCourseCalendarEvents] = React.useState<Array<{
    id: string;
    title: string;
    event_date: string;
    start_time: string;
    end_time: string;
    class_name: string;
    course_name: string | null;
    notes: string | null;
  }>>([]);
  const [courseStudentIds, setCourseStudentIds] = React.useState<string[]>([]);
  const [isCourseHomeworkLoading, setIsCourseHomeworkLoading] = React.useState(false);
  const [courseHomeworkItems, setCourseHomeworkItems] = React.useState<Array<{
    id: string;
    title: string;
    description: string;
    attachment_url: string | null;
    created_at: string | null;
  }>>([]);
  const [isCourseFoldersLoading, setIsCourseFoldersLoading] = React.useState(false);
  const [courseFolders, setCourseFolders] = React.useState<Array<{ name: string; filesCount: number }>>([]);
  const [openCourseFolders, setOpenCourseFolders] = React.useState<Record<string, boolean>>({});
  const [courseFolderFiles, setCourseFolderFiles] = React.useState<Record<string, Array<{ name: string; path: string; url: string; size: number }>>>({});
  const [newCourseFolderName, setNewCourseFolderName] = React.useState('');
  const [isCourseFolderCreating, setIsCourseFolderCreating] = React.useState(false);
  const [uploadingCourseFolderName, setUploadingCourseFolderName] = React.useState<string | null>(null);
  const classImageInputRef = React.useRef<HTMLInputElement | null>(null);
  const timetableInputRef = React.useRef<HTMLInputElement | null>(null);
  const newCourseImageInputRef = React.useRef<HTMLInputElement | null>(null);
  const editCourseImageInputRef = React.useRef<HTMLInputElement | null>(null);
  const courseFolderUploadRefs = React.useRef<Record<string, HTMLInputElement | null>>({});
  const didInitializeDailyDateRef = React.useRef(false);
  const FOLDER_FILE_ACCEPT = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.json,.xml,.jpg,.jpeg,.png,.gif,.webp,.svg,.mp3,.wav,.mp4,.mov,.zip,.rar,.7z,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain,text/csv,application/json,image/*,audio/*,video/*,application/zip,application/x-rar-compressed,application/x-7z-compressed';
  const FOLDER_MARKER_FILE = '__folder__.pdf';
  const isFolderMarker = (name: string) => name === '.keep' || name === FOLDER_MARKER_FILE;

  const getTodayIsoDate = React.useCallback(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);

  const handleGlobalDateChange = React.useCallback((date: string) => {
    setAttendanceDate(date);
  }, [setAttendanceDate]);

  const resolveHomeworkAttachmentUrl = React.useCallback((rawValue: unknown) => {
    if (typeof rawValue !== 'string') return '';
    const candidate = rawValue.trim();
    if (!candidate) return '';
    if (/^(https?:|data:|blob:)/i.test(candidate)) {
      return candidate;
    }

    const cleanedPath = candidate.replace(/^\/+/, '');
    const { data } = supabase.storage.from('homework_files').getPublicUrl(cleanedPath);
    return data?.publicUrl || '';
  }, []);

  const getAttachmentValueFromRow = React.useCallback((row: any): string | null => {
    const rawValue =
      row?.attachment_url
      ?? row?.attachmentUrl
      ?? row?.file_url
      ?? row?.fileUrl
      ?? row?.document_url
      ?? row?.documentUrl
      ?? row?.attachment
      ?? row?.file_path
      ?? row?.filePath
      ?? null;

    if (!rawValue) return null;
    const asString = String(rawValue);
    return resolveHomeworkAttachmentUrl(asString) || asString;
  }, [resolveHomeworkAttachmentUrl]);

  React.useEffect(() => {
    if (editingClassId) {
      setIsClassFormOpen(true);
    }
  }, [editingClassId]);

  React.useEffect(() => {
    if (didInitializeDailyDateRef.current) return;
    didInitializeDailyDateRef.current = true;

    const today = getTodayIsoDate();
    handleGlobalDateChange(today);
  }, [getTodayIsoDate, handleGlobalDateChange]);

  React.useEffect(() => {
    if (classAttendancePage) {
      setSelectedClassId(focusClassId || null);
    }
  }, [classAttendancePage, focusClassId]);

  const activeClassId = classAttendancePage ? (focusClassId || selectedClassId) : selectedClassId;

  const filteredClasses = React.useMemo(() => {
    const query = classSearchQuery.trim().toLowerCase();
    if (!query) return classes;

    return classes.filter(classItem => {
      const name = String(classItem.name || '').toLowerCase();
      const classCode = String(classItem.class_code || '').toLowerCase();
      return name.includes(query) || classCode.includes(query);
    });
  }, [classes, classSearchQuery]);

  const selectedClass = classes.find(c => String(c.id) === activeClassId);
  const selectedClassStudentIds: string[] = selectedClass?.student_ids || [];
  const selectedClassStudents = allStudents.filter(student => selectedClassStudentIds.includes(String(student.id)));

  React.useEffect(() => {
    const loadCourseStudents = async () => {
      if (!courseAttendanceOnly || !focusCourse?.id || !activeClassId || !schoolId) {
        setCourseStudentIds([]);
        return;
      }

      try {
        const primary = await supabase
          .from('class_course_students')
          .select('student_id')
          .eq('class_id', activeClassId)
          .eq('class_course_id', String(focusCourse.id))
          .eq('school_id', schoolId);

        if (!primary.error) {
          setCourseStudentIds(
            Array.from(new Set((primary.data || []).map((row: any) => String(row.student_id || '')).filter(Boolean)))
          );
          return;
        }

        if (!/relation|does not exist|column|schema cache/i.test(primary.error.message || '')) {
          throw primary.error;
        }

        const fallback = await supabase
          .from('student_courses')
          .select('student_id')
          .eq('course_id', String(focusCourse.id))
          .eq('school_id', schoolId);

        if (fallback.error && !/relation|does not exist|column|schema cache/i.test(fallback.error.message || '')) {
          throw fallback.error;
        }

        setCourseStudentIds(
          Array.from(new Set((fallback.data || []).map((row: any) => String(row.student_id || '')).filter(Boolean)))
        );
      } catch (error: any) {
        console.error('Failed to load course student membership:', error);
        notify(`Failed to load course students: ${error?.message || 'Unknown error'}`);
        setCourseStudentIds([]);
      }
    };

    void loadCourseStudents();
  }, [courseAttendanceOnly, focusCourse?.id, activeClassId, classes, notify]);

  const activeAttendanceId = activeClassId || selectedAttendanceSubject;
  const attendanceStoreKey = activeClassId ? `class:${activeClassId}` : selectedAttendanceSubject ? `subject:${selectedAttendanceSubject}` : null;
  const activeStudents = activeClassId
    ? (
      courseAttendanceOnly && focusCourse?.id
        ? selectedClassStudents.filter(student => courseStudentIds.includes(String(student.id)))
        : selectedClassStudents
    )
    : students;
  const courseFolderBasePath = React.useMemo(() => {
    if (!courseAttendanceOnly || !focusCourse?.id || !activeClassId) return '';
    return `course_folders/${activeClassId}/${String(focusCourse.id)}`;
  }, [courseAttendanceOnly, focusCourse?.id, activeClassId]);

  React.useEffect(() => {
    if (activeClassId) {
      void loadAttendanceForContext('class', activeClassId, attendanceDate);
      return;
    }

    if (selectedAttendanceSubject) {
      void loadAttendanceForContext('subject', selectedAttendanceSubject, attendanceDate);
    }
  }, [activeClassId, selectedAttendanceSubject, attendanceDate, loadAttendanceForContext]);

  React.useEffect(() => {
    if (attendanceDate?.length >= 7) {
      setExportMonth(attendanceDate.slice(0, 7));
    }
  }, [attendanceDate]);

  React.useEffect(() => {
    const loadCourseCalendarEvents = async () => {
      if (!courseAttendanceOnly || !focusCourse?.id || !activeClassId || !attendanceDate || !schoolId) {
        setCourseCalendarEvents([]);
        setIsCourseCalendarLoading(false);
        return;
      }

      setIsCourseCalendarLoading(true);
      try {
        const { data, error } = await supabase.from('live_calendar_events')
          .select('id, title, event_date, start_time, end_time, class_id, class_name, course_id, course_name, notes')
          .eq('class_id', activeClassId)
          .eq('event_date', attendanceDate)
          .eq('school_id', schoolId)
          .order('event_date', { ascending: true })
          .order('start_time', { ascending: true });

        if (error) throw error;

        const filtered = (data || [])
          .filter((event: any) => {
            const eventCourseId = event?.course_id ? String(event.course_id) : '';
            const eventCourseName = event?.course_name ? String(event.course_name).toLowerCase() : '';
            return eventCourseId === String(focusCourse.id) || eventCourseName === String(focusCourse.name || '').toLowerCase();
          })
          .map((event: any) => ({
            id: String(event.id),
            title: String(event.title || ''),
            event_date: String(event.event_date || ''),
            start_time: String(event.start_time || '').slice(0, 5),
            end_time: String(event.end_time || '').slice(0, 5),
            class_name: String(event.class_name || selectedClass?.name || ''),
            course_name: event.course_name ? String(event.course_name) : null,
            notes: event.notes ? String(event.notes) : null,
          }));

        setCourseCalendarEvents(filtered);
      } catch (error: any) {
        console.error('Failed to load course timetable events:', error);
        notify(`Failed to load course timetable: ${error?.message || 'Unknown error'}`);
        setCourseCalendarEvents([]);
      } finally {
        setIsCourseCalendarLoading(false);
      }
    };

    void loadCourseCalendarEvents();
  }, [courseAttendanceOnly, focusCourse?.id, focusCourse?.name, activeClassId, attendanceDate, notify, selectedClass?.name]);

  React.useEffect(() => {
    const loadCourseHomework = async () => {
      if (!courseAttendanceOnly || !focusCourse?.id || !activeClassId || !schoolId) {
        setCourseHomeworkItems([]);
        setIsCourseHomeworkLoading(false);
        return;
      }

      setIsCourseHomeworkLoading(true);
      try {
        let rows: any[] = [];
        let fetchError: any = null;
        let bucketFileUrls: string[] = [];

        {
          const result = await supabase
            .from('homework_assignments')
            .select('*')
            .eq('class_id', activeClassId)
            .eq('class_course_id', String(focusCourse.id))
            .eq('school_id', schoolId)
            .order('created_at', { ascending: false });

          rows = result.data || [];
          fetchError = result.error;
        }

        if (fetchError) throw fetchError;

        {
          const folder = `homework/${activeClassId}/${String(focusCourse.id)}`;
          const listResult = await supabase.storage
            .from('homework_files')
            .list(folder, {
              limit: 100,
              sortBy: { column: 'created_at', order: 'desc' },
            });

          if (!listResult.error) {
            bucketFileUrls = (listResult.data || [])
              .filter((file: any) => file?.name)
              .map((file: any) => {
                const path = `${folder}/${file.name}`;
                const { data } = supabase.storage.from('homework_files').getPublicUrl(path);
                return data?.publicUrl || '';
              })
              .filter((url: string) => Boolean(url));
          }
        }

        setCourseHomeworkItems(
          rows.map((row: any, index: number) => {
            const dbAttachment = getAttachmentValueFromRow(row);
            const bucketAttachment = bucketFileUrls[index] || null;

            return {
              id: String(row.id),
              title: String(row.title || ''),
              description: String(row.description || ''),
              attachment_url: dbAttachment || bucketAttachment,
              created_at: row.created_at ? String(row.created_at) : null,
            };
          })
        );
      } catch (error) {
        console.error('Failed to load course homework:', error);
        setCourseHomeworkItems([]);
      } finally {
        setIsCourseHomeworkLoading(false);
      }
    };

    void loadCourseHomework();
  }, [courseAttendanceOnly, focusCourse?.id, activeClassId, getAttachmentValueFromRow]);

  const loadFilesForCourseFolder = React.useCallback(async (folderName: string) => {
    if (!courseFolderBasePath) return;

    const folderPath = `${courseFolderBasePath}/${folderName}`;
    const { data, error } = await supabase.storage
      .from(COURSE_RESOURCES_BUCKET)
      .list(folderPath, {
        limit: 200,
        sortBy: { column: 'updated_at', order: 'desc' },
      });

    if (error) throw error;

    const files = (data || [])
      .filter((item: any) => item?.name && !isFolderMarker(String(item.name)) && !!item.id)
      .map((item: any) => {
        const fullPath = `${folderPath}/${item.name}`;
        const { data: urlData } = supabase.storage.from(COURSE_RESOURCES_BUCKET).getPublicUrl(fullPath);
        return {
          name: String(item.name),
          path: fullPath,
          url: urlData?.publicUrl || '',
          size: Number(item.metadata?.size || 0),
        };
      });

    setCourseFolderFiles(prev => ({ ...prev, [folderName]: files }));
  }, [courseFolderBasePath]);

  const loadCourseFolders = React.useCallback(async () => {
    if (!courseFolderBasePath || !schoolId) {
      setCourseFolders([]);
      setOpenCourseFolders({});
      setCourseFolderFiles({});
      setIsCourseFoldersLoading(false);
      return;
    }

    setIsCourseFoldersLoading(true);

    try {
      const { data, error } = await supabase.storage
        .from(COURSE_RESOURCES_BUCKET)
        .list(courseFolderBasePath, { limit: 200 });

      if (error) throw error;

      const folderNames = (data || [])
        .filter((entry: any) => !entry?.id && entry?.name)
        .map((entry: any) => String(entry.name));

      const nextFolders: Array<{ name: string; filesCount: number }> = [];

      for (const folderName of folderNames) {
        const folderPath = `${courseFolderBasePath}/${folderName}`;
        const listResult = await supabase.storage
          .from(COURSE_RESOURCES_BUCKET)
          .list(folderPath, { limit: 200 });

        const filesCount = (listResult.data || []).filter((item: any) => item?.name && !isFolderMarker(String(item.name)) && !!item.id).length;
        nextFolders.push({ name: folderName, filesCount });
      }

      nextFolders.sort((a, b) => a.name.localeCompare(b.name));
      setCourseFolders(nextFolders);
    } catch (error: any) {
      console.error('Failed to load course folders:', error);
      notify(`Failed to load course folders: ${error?.message || 'Unknown error'}`);
      setCourseFolders([]);
    } finally {
      setIsCourseFoldersLoading(false);
    }
  }, [courseFolderBasePath, notify]);

  const createCourseFolder = React.useCallback(async () => {
    if (!courseFolderBasePath) {
      notify('Select class and course first.');
      return;
    }

    const normalizedName = newCourseFolderName.trim().replace(/[\\/:*?"<>|]+/g, '_');
    if (!normalizedName) {
      notify('Enter a folder name.');
      return;
    }

    setIsCourseFolderCreating(true);
    try {
      const keepPath = `${courseFolderBasePath}/${normalizedName}/${FOLDER_MARKER_FILE}`;
      const marker = new Blob([new Uint8Array([37, 80, 68, 70])], { type: 'application/pdf' });
      const { error } = await supabase.storage
        .from(COURSE_RESOURCES_BUCKET)
        .upload(keepPath, marker, {
          upsert: true,
          contentType: 'application/pdf',
        });

      if (error) throw error;

      // Log folder creation to resources_buckets


      const { data: publicUrlData } = supabase.storage.from(COURSE_RESOURCES_BUCKET).getPublicUrl(keepPath);

      const { error: dbError } = await supabase.from('resources_buckets').insert([{
        school_id: schoolId,
        class_id: activeClassId,
        class_course_id: focusCourse?.id,
        name: normalizedName,
        metadata: { type: 'folder', size: 0 },
        image_url: publicUrlData?.publicUrl || null
      }]);
      if (dbError) {
        console.warn('Failed to log folder creation in resources_buckets:', dbError);
        throw dbError;
      }

      setNewCourseFolderName('');
      await loadCourseFolders();
    } catch (error: any) {
      console.error('Failed to create folder:', error);
      notify(`Failed to create folder: ${error?.message || 'Unknown error'}`);
    } finally {
      setIsCourseFolderCreating(false);
    }
  }, [courseFolderBasePath, newCourseFolderName, loadCourseFolders, notify, schoolId]);

  const toggleCourseFolderOpen = React.useCallback(async (folderName: string) => {
    const nextOpen = !openCourseFolders[folderName];
    setOpenCourseFolders(prev => ({ ...prev, [folderName]: nextOpen }));
    if (!nextOpen) return;

    try {
      await loadFilesForCourseFolder(folderName);
    } catch (error: any) {
      console.error('Failed to load folder files:', error);
      notify(`Failed to load folder files: ${error?.message || 'Unknown error'}`);
    }
  }, [openCourseFolders, loadFilesForCourseFolder, notify]);

  const uploadFilesToCourseFolder = React.useCallback(async (folderName: string, files: FileList | null) => {
    if (!courseFolderBasePath || !files?.length) return;

    const selectedFiles = Array.from(files);
    const oversized = selectedFiles.find(file => file.size > 200 * 1024 * 1024);
    if (oversized) {
      notify(`File too large: ${oversized.name}. Max size is 200MB.`);
      return;
    }

    setUploadingCourseFolderName(folderName);
    try {
      for (const file of selectedFiles) {
        const sanitized = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const path = `${courseFolderBasePath}/${folderName}/${Date.now()}-${sanitized}`;
        const { error } = await supabase.storage
          .from(COURSE_RESOURCES_BUCKET)
          .upload(path, file, {
            upsert: false,
            contentType: file.type || undefined,
          });
        if (error) throw error;

        // Log file upload to resources_buckets
        let schoolId = selectedClass?.school_id;
        if (!schoolId && activeClassId) {
          const { data } = await supabase.from('classes').select('school_id').eq('id', activeClassId).maybeSingle();
          schoolId = data?.school_id;
        }

        const { data: publicUrlData } = supabase.storage.from(COURSE_RESOURCES_BUCKET).getPublicUrl(path);

        const { error: dbError } = await supabase.from('resources_buckets').insert([{
          school_id: schoolId,
          class_id: activeClassId,
          class_course_id: focusCourse?.id,
          name: file.name,
          metadata: { type: 'file', size: file.size, mime_type: file.type, folder: folderName },
          image_url: publicUrlData?.publicUrl || null
        }]);
        if (dbError) {
          console.warn('Failed to log file upload in resources_buckets:', dbError);
          throw dbError;
        }
      }

      await loadFilesForCourseFolder(folderName);
      await loadCourseFolders();
    } catch (error: any) {
      console.error('Failed to upload files:', error);
      notify(`Failed to upload files: ${error?.message || 'Unknown error'}`);
    } finally {
      setUploadingCourseFolderName(null);
    }
  }, [courseFolderBasePath, loadFilesForCourseFolder, loadCourseFolders, notify, activeClassId, focusCourse, schoolId]);

  const deleteCourseFolder = async (folderName: string) => {
    openConfirmDialog(`Are you sure you want to delete folder "${folderName}" and all its contents?`, async () => {
      setIsConfirmActionSubmitting(true);
      try {
        const folderPath = `${courseFolderBasePath}/${folderName}`;
        const listResult = await supabase.storage.from(COURSE_RESOURCES_BUCKET).list(folderPath, { limit: 1000 });
        const filesToDelete = (listResult.data || []).map(f => `${folderPath}/${f.name}`);
        if (filesToDelete.length > 0) {
          const { error: storageError } = await supabase.storage.from(COURSE_RESOURCES_BUCKET).remove(filesToDelete);
          if (storageError) throw storageError;
        }

        if (activeClassId && focusCourse) {
          await supabase.from('resources_buckets').delete()
            .eq('class_id', activeClassId)
            .eq('class_course_id', focusCourse.id)
            .eq('name', folderName)
            .eq('metadata->>type', 'folder');

          await supabase.from('resources_buckets').delete()
            .eq('class_id', activeClassId)
            .eq('class_course_id', focusCourse.id)
            .eq('metadata->>folder', folderName);
        }

        await loadCourseFolders();
        notify(`Deleted folder "${folderName}"`);
      } catch (error: any) {
        console.error('Failed to delete folder:', error);
        notify(`Failed to delete folder: ${error?.message || 'Unknown error'}`);
      } finally {
        setIsConfirmActionSubmitting(false);
        setConfirmDialog(null);
      }
    });
  };

  const deleteCourseFile = async (folderName: string, file: any) => {
    openConfirmDialog(`Are you sure you want to delete file "${file.name}"?`, async () => {
      setIsConfirmActionSubmitting(true);
      try {
        const { error: storageError } = await supabase.storage.from(COURSE_RESOURCES_BUCKET).remove([file.path]);
        if (storageError) throw storageError;

        if (activeClassId && focusCourse) {
          await supabase.from('resources_buckets').delete()
            .eq('class_id', activeClassId)
            .eq('class_course_id', focusCourse.id)
            .eq('school_id', schoolId)
            .eq('name', file.name)
            .eq('metadata->>type', 'file')
            .eq('metadata->>folder', folderName);
        }

        await loadFilesForCourseFolder(folderName);
        await loadCourseFolders();
        notify(`Deleted file "${file.name}"`);
      } catch (error: any) {
        console.error('Failed to delete file:', error);
        notify(`Failed to delete file: ${error?.message || 'Unknown error'}`);
      } finally {
        setIsConfirmActionSubmitting(false);
        setConfirmDialog(null);
      }
    });
  };

  React.useEffect(() => {
    void loadCourseFolders();
  }, [loadCourseFolders]);

  React.useEffect(() => {
    if (activeAttendanceId) {
      setIsAttendanceViewOpen(true);
    }
  }, [activeAttendanceId]);

  const markAllPresentForClass = async () => {
    if (!activeClassId) return;
    await bulkMarkSubjectPresent(
      'class',
      activeClassId,
      attendanceDate,
      activeStudents.map(student => String(student.id)),
      selectedClass?.name || 'selected class'
    );
  };

  const loadTimetableFiles = React.useCallback(async (classId: string) => {
    setIsTimetableLoading(true);
    try {
      const folder = `class-${classId}`;
      const { data, error } = await supabase.storage
        .from(TIMETABLE_BUCKET)
        .list(folder, {
          limit: 100,
          sortBy: { column: 'created_at', order: 'desc' }
        });

      if (error) throw error;

      const mapped = (data || [])
        .filter((file: any) => file?.name && file.name.toLowerCase().endsWith('.pdf'))
        .map((file: any) => {
          const path = `${folder}/${file.name}`;
          const { data: publicData } = supabase.storage.from(TIMETABLE_BUCKET).getPublicUrl(path);
          return {
            name: file.name,
            path,
            url: publicData?.publicUrl || '',
          };
        })
        .filter(file => file.url);

      setTimetableFiles(mapped);
    } catch (error: any) {
      console.error('Failed to load timetable files:', error);
      notify(`Failed to load timetable files: ${error?.message || 'Unknown error'}`);
      setTimetableFiles([]);
    } finally {
      setIsTimetableLoading(false);
    }
  }, [TIMETABLE_BUCKET, notify]);

  React.useEffect(() => {
    if (!activeClassId) {
      setTimetableFiles([]);
      setIsTimetableViewOpen(false);
      setClassCourses([]);
      return;
    }

    void loadTimetableFiles(activeClassId);
  }, [activeClassId, loadTimetableFiles]);

  const loadClassCourses = React.useCallback(async (classId: string) => {
    setIsClassCoursesLoading(true);
    try {
      let data: any[] | null = null;
      let error: any = null;

      if (isClassCourseImageSupported) {
        const result = await supabase
          .from(CLASS_COURSES_TABLE)
          .select('id, name, class_id, image_url')
          .eq('class_id', classId)
          .order('created_at', { ascending: false });
        data = result.data;
        error = result.error;

        if (error && /image_url|column/i.test(error.message || '')) {
          setIsClassCourseImageSupported(false);
          const fallbackResult = await supabase
            .from(CLASS_COURSES_TABLE)
            .select('id, name, class_id')
            .eq('class_id', classId)
            .order('created_at', { ascending: false });
          data = fallbackResult.data;
          error = fallbackResult.error;
        }
      } else {
        const result = await supabase
          .from(CLASS_COURSES_TABLE)
          .select('id, name, class_id')
          .eq('class_id', classId)
          .order('created_at', { ascending: false });
        data = result.data;
        error = result.error;
      }

      if (error) throw error;

      setClassCourses((data || []).map((course: any) => ({
        id: String(course.id),
        name: String(course.name || ''),
        class_id: String(course.class_id),
        image_url: course.image_url || null,
      })));
    } catch (error: any) {
      console.error('Failed to load class courses:', error);
      notify(`Failed to load courses: ${error?.message || 'Unknown error'}`);
      setClassCourses([]);
    } finally {
      setIsClassCoursesLoading(false);
    }
  }, [CLASS_COURSES_TABLE, notify]);

  const uploadCourseImage = async (classId: string, file: File) => {
    const resizedFile = await new Promise<File>((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => {
        const image = new Image();

        image.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = 1080;
          canvas.height = 1080;

          const context = canvas.getContext('2d');
          if (!context) {
            reject(new Error('Failed to create image canvas context.'));
            return;
          }

          const sourceWidth = image.width;
          const sourceHeight = image.height;
          const sourceSize = Math.min(sourceWidth, sourceHeight);
          const sourceX = (sourceWidth - sourceSize) / 2;
          const sourceY = (sourceHeight - sourceSize) / 2;

          context.drawImage(
            image,
            sourceX,
            sourceY,
            sourceSize,
            sourceSize,
            0,
            0,
            1080,
            1080
          );

          canvas.toBlob((blob) => {
            if (!blob) {
              reject(new Error('Failed to generate resized image blob.'));
              return;
            }

            const baseName = file.name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9._-]/g, '_');
            resolve(new File([blob], `${baseName}-1080x1080.jpg`, { type: 'image/jpeg' }));
          }, 'image/jpeg', 0.92);
        };

        image.onerror = () => reject(new Error('Selected file is not a valid image.'));
        image.src = String(reader.result || '');
      };

      reader.onerror = () => reject(new Error('Failed to read selected image file.'));
      reader.readAsDataURL(file);
    });

    const safeName = resizedFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `class-${classId}/course-${Date.now()}-${safeName}`;

    const { error } = await supabase.storage
      .from(COURSE_PROFILE_BUCKET)
      .upload(path, resizedFile, {
        upsert: false,
        contentType: 'image/jpeg',
        cacheControl: '3600',
      });

    if (error) throw error;

    const { data } = supabase.storage.from(COURSE_PROFILE_BUCKET).getPublicUrl(path);
    if (!data?.publicUrl) {
      throw new Error('Failed to retrieve uploaded course image URL.');
    }

    return data.publicUrl;
  };

  React.useEffect(() => {
    if (!activeClassId) {
      setClassCourses([]);
      return;
    }

    void loadClassCourses(activeClassId);
  }, [activeClassId, loadClassCourses]);

  const uploadTimetablePdf = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !activeClassId) return;

    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    if (!isPdf) {
      notify('Only PDF files are allowed.');
      event.target.value = '';
      return;
    }

    setIsTimetableUploading(true);
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `class-${activeClassId}/${Date.now()}-${safeName}`;

      const { error } = await supabase.storage
        .from(TIMETABLE_BUCKET)
        .upload(path, file, {
          upsert: false,
          contentType: 'application/pdf',
          cacheControl: '3600',
        });

      if (error) throw error;

      notify('Timetable PDF uploaded successfully.');
      setIsTimetableViewOpen(true);
      await loadTimetableFiles(activeClassId);
    } catch (error: any) {
      console.error('Timetable PDF upload failed:', error);
      notify(`Upload failed: ${error?.message || 'Unknown error'}`);
    } finally {
      setIsTimetableUploading(false);
      event.target.value = '';
    }
  };

  const deleteTimetablePdf = async (filePath: string) => {
    if (!activeClassId) return;

    try {
      const { error } = await supabase.storage
        .from(TIMETABLE_BUCKET)
        .remove([filePath]);

      if (error) throw error;

      setTimetableFiles(prev => prev.filter(file => file.path !== filePath));
      notify('Timetable PDF deleted.');
    } catch (error: any) {
      console.error('Failed to delete timetable PDF:', error);
      notify(`Delete failed: ${error?.message || 'Unknown error'}`);
    }
  };

  const createClassCourse = async () => {
    if (!activeClassId || isClassCourseCreating) return;

    if (!newCourseName.trim()) {
      setNewCourseError('Course name is required.');
      return;
    }

    setIsClassCourseCreating(true);
    try {
      let imageUrl: string | null = null;
      if (newCourseImage) {
        imageUrl = await uploadCourseImage(activeClassId, newCourseImage);
      }

      let data: any = null;
      let error: any = null;

      if (isClassCourseImageSupported) {
        const result = await supabase
          .from(CLASS_COURSES_TABLE)
          .insert([
            {
              class_id: activeClassId,
              name: newCourseName.trim(),
              image_url: imageUrl,
            },
          ])
          .select('id, name, class_id, image_url')
          .maybeSingle();
        data = result.data;
        error = result.error;

        if (error && /image_url|column/i.test(error.message || '')) {
          setIsClassCourseImageSupported(false);
          const fallbackResult = await supabase
            .from(CLASS_COURSES_TABLE)
            .insert([
              {
                class_id: activeClassId,
                name: newCourseName.trim(),
              },
            ])
            .select('id, name, class_id')
            .maybeSingle();
          data = fallbackResult.data;
          error = fallbackResult.error;
        }
      } else {
        const result = await supabase
          .from(CLASS_COURSES_TABLE)
          .insert([
            {
              class_id: activeClassId,
              name: newCourseName.trim(),
            },
          ])
          .select('id, name, class_id')
          .maybeSingle();
        data = result.data;
        error = result.error;
      }

      if (error) throw error;

      const createdCourseData = data || { id: 'temp-' + Date.now(), name: newCourseName.trim(), class_id: activeClassId };
      const createdCourse = {
        id: String(createdCourseData.id),
        name: String(createdCourseData.name || ''),
        class_id: String(createdCourseData.class_id),
        image_url: createdCourseData.image_url || imageUrl || null,
      };

      setClassCourses(prev => [createdCourse, ...prev]);
      notify('Course created successfully.');
      setIsCreateCourseModalOpen(false);
      setNewCourseName('');
      setNewCourseImage(null);
      setNewCourseError(null);
    } catch (error: any) {
      console.error('Failed to create class course:', error);
      notify(`Course creation failed: ${error?.message || 'Unknown error'}`);
    } finally {
      setIsClassCourseCreating(false);
    }
  };

  const openEditCourseModal = (course: { id: string; name: string; image_url?: string | null }) => {
    setEditCourseId(course.id);
    setEditCourseName(course.name);
    setEditCourseCurrentImageUrl(course.image_url || null);
    setEditCourseImage(null);
    setEditCourseError(null);
    setIsEditCourseModalOpen(true);
  };

  const closeEditCourseModal = () => {
    if (isClassCourseUpdating) return;
    setIsEditCourseModalOpen(false);
    setEditCourseId(null);
    setEditCourseName('');
    setEditCourseCurrentImageUrl(null);
    setEditCourseImage(null);
    setEditCourseError(null);
    if (editCourseImageInputRef.current) {
      editCourseImageInputRef.current.value = '';
    }
  };

  const updateClassCourse = async () => {
    if (!activeClassId || !editCourseId || isClassCourseUpdating) return;

    if (!editCourseName.trim()) {
      setEditCourseError('Course name is required.');
      return;
    }

    setIsClassCourseUpdating(true);
    try {
      let imageUrl = editCourseCurrentImageUrl || null;
      if (editCourseImage) {
        imageUrl = await uploadCourseImage(activeClassId, editCourseImage);
      }

      let error: any = null;

      if (isClassCourseImageSupported) {
        const result = await supabase
          .from(CLASS_COURSES_TABLE)
          .update({
            name: editCourseName.trim(),
            image_url: imageUrl,
          })
          .eq('id', editCourseId)
          .eq('class_id', activeClassId);
        error = result.error;

        if (error && /image_url|column/i.test(error.message || '')) {
          setIsClassCourseImageSupported(false);
          const fallbackResult = await supabase
            .from(CLASS_COURSES_TABLE)
            .update({
              name: editCourseName.trim(),
            })
            .eq('id', editCourseId)
            .eq('class_id', activeClassId);
          error = fallbackResult.error;
        }
      } else {
        const result = await supabase
          .from(CLASS_COURSES_TABLE)
          .update({
            name: editCourseName.trim(),
          })
          .eq('id', editCourseId)
          .eq('class_id', activeClassId);
        error = result.error;
      }

      if (error) throw error;

      setClassCourses(prev => prev.map(course => {
        if (course.id !== editCourseId) return course;
        return {
          ...course,
          name: editCourseName.trim(),
          image_url: isClassCourseImageSupported ? imageUrl : (course.image_url || imageUrl),
        };
      }));

      notify('Course updated successfully.');
      closeEditCourseModal();
    } catch (error: any) {
      console.error('Failed to update class course:', error);
      notify(`Course update failed: ${error?.message || 'Unknown error'}`);
    } finally {
      setIsClassCourseUpdating(false);
    }
  };

  const deleteClassCourse = async (course: { id: string; class_id: string; image_url?: string | null; name?: string }) => {
    if (!activeClassId || deletingCourseId) return;

    setCourseDeleteDialog({
      id: course.id,
      classId: course.class_id,
      name: String(course.name || ''),
    });
    setCourseDeleteNameInput('');
    setCourseDeleteAdminPassword('');
    setCourseDeleteError(null);
  };

  const handleSecureCourseDelete = async () => {
    if (!activeClassId || !courseDeleteDialog || deletingCourseId) return;

    const expectedName = courseDeleteDialog.name.trim();
    const typedName = courseDeleteNameInput.trim();
    if (typedName !== expectedName) {
      setCourseDeleteError('Course name does not match.');
      return;
    }

    if (!courseDeleteAdminPassword.trim()) {
      setCourseDeleteError('Admin password is required.');
      return;
    }

    setCourseDeleteError(null);
    setIsCourseDeleteSubmitting(true);
    setDeletingCourseId(courseDeleteDialog.id);
    try {
      const { data: passwordOk, error: passwordError } = await supabase
        .rpc('verify_admin_delete_password', { input_password: courseDeleteAdminPassword });

      if (passwordError) {
        throw new Error('Failed to verify admin password.');
      }

      if (!passwordOk) {
        throw new Error('Invalid admin password.');
      }

      let deleted = false;

      const primaryResult = await supabase
        .from(CLASS_COURSES_TABLE)
        .delete()
        .eq('id', courseDeleteDialog.id)
        .eq('class_id', courseDeleteDialog.classId)
        .select('id');

      if (primaryResult.error && /class_id|column|relation|class_courses/i.test(primaryResult.error.message || '')) {
        const fallbackResult = await supabase
          .from('classes')
          .delete()
          .eq('id', courseDeleteDialog.id)
          .select('id');

        if (fallbackResult.error) throw fallbackResult.error;
        deleted = (fallbackResult.data || []).length > 0;
      } else {
        if (primaryResult.error) throw primaryResult.error;
        deleted = (primaryResult.data || []).length > 0;

        if (!deleted) {
          const fallbackResult = await supabase
            .from('classes')
            .delete()
            .eq('id', courseDeleteDialog.id)
            .select('id');

          if (fallbackResult.error) throw fallbackResult.error;
          deleted = (fallbackResult.data || []).length > 0;
        }
      }

      if (!deleted) {
        throw new Error('No matching course row found to delete in class_courses or classes table.');
      }

      let courseStillExists = false;

      const verifyPrimary = await supabase
        .from(CLASS_COURSES_TABLE)
        .select('id')
        .eq('id', courseDeleteDialog.id)
        .eq('class_id', courseDeleteDialog.classId)
        .limit(1);

      if (verifyPrimary.error && /class_id|column|relation|class_courses/i.test(verifyPrimary.error.message || '')) {
        const verifyFallback = await supabase
          .from('classes')
          .select('id')
          .eq('id', courseDeleteDialog.id)
          .limit(1);
        if (verifyFallback.error) throw verifyFallback.error;
        courseStillExists = (verifyFallback.data || []).length > 0;
      } else {
        if (verifyPrimary.error) throw verifyPrimary.error;
        courseStillExists = (verifyPrimary.data || []).length > 0;
      }

      if (courseStillExists) {
        throw new Error('Delete request succeeded but course still exists in database.');
      }

      await loadClassCourses(activeClassId);

      notify('Course deleted successfully.');
      setCourseDeleteDialog(null);
      setCourseDeleteNameInput('');
      setCourseDeleteAdminPassword('');
      setCourseDeleteError(null);
    } catch (error: any) {
      console.error('Failed to delete class course:', error);
      setCourseDeleteError(error?.message || 'Course delete failed.');
      notify(`Course delete failed: ${error?.message || 'Unknown error'}`);
    } finally {
      setIsCourseDeleteSubmitting(false);
      setDeletingCourseId(null);
    }
  };

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-5 duration-700 pb-20">
      <div className="bg-white dark:bg-slate-900 rounded-[24px] sm:rounded-[32px] p-4 sm:p-6 border border-slate-100 dark:border-slate-800 shadow-premium">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 rounded-2xl bg-slate-50 dark:bg-slate-800 px-4 py-3 border border-slate-100 dark:border-slate-700">
            <i className="fas fa-calendar-day text-slate-400"></i>
            <input
              type="date"
              value={attendanceDate}
              onChange={(e) => handleGlobalDateChange(e.target.value)}
              className="bg-transparent text-sm font-black uppercase tracking-widest text-slate-500 border-none focus:ring-0 cursor-pointer"
              title="Search day, month, and year"
            />
          </div>
          <button
            onClick={() => handleGlobalDateChange(getTodayIsoDate())}
            className="px-4 py-2 rounded-xl bg-brand-500 text-white text-[10px] font-black uppercase tracking-widest"
            title="Reset to today's date"
          >
            Today
          </button>
        </div>
      </div>

      {!courseAttendanceOnly && (
        <>
          {/* Header with Date Picker and Actions */}
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-10">
            <div className="flex items-start sm:items-center gap-4 sm:gap-8 lg:gap-10">
              {classAttendancePage ? (
                <button
                  onClick={() => onExitClassAttendancePage?.()}
                  className="w-16 h-16 sm:w-20 sm:h-20 lg:w-24 lg:h-24 rounded-[24px] sm:rounded-[32px] lg:rounded-[40px] bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 flex items-center justify-center text-slate-400 hover:text-brand-500 text-2xl sm:text-3xl lg:text-4xl shadow-premium flex-shrink-0"
                  title="Back"
                >
                  <i className="fas fa-arrow-left"></i>
                </button>
              ) : (
                <div className="w-16 h-16 sm:w-20 sm:h-20 lg:w-24 lg:h-24 rounded-[24px] sm:rounded-[32px] lg:rounded-[40px] bg-brand-500 flex items-center justify-center text-white text-2xl sm:text-3xl lg:text-4xl shadow-glow flex-shrink-0">
                  <i className="fas fa-calendar-check"></i>
                </div>
              )}
              <div className="min-w-0">
                <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tighter">CLASS DETAIL</h2>
                <div className="flex flex-wrap items-center gap-3 sm:gap-6 mt-3">
                  <input 
                    type="date" 
                    value={attendanceDate} 
                    onChange={(e) => handleGlobalDateChange(e.target.value)} 
                    className="bg-transparent text-sm font-black uppercase tracking-widest text-slate-500 border-none focus:ring-0 cursor-pointer" 
                  />
                  <div className="h-4 w-px bg-slate-200 dark:bg-slate-800"></div>
                  <span className="text-[10px] font-black uppercase text-brand-500 tracking-[0.2em]">Live Session Mapping</span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {!classAttendancePage && (
      <div className="bg-white dark:bg-slate-900 rounded-[32px] sm:rounded-[48px] lg:rounded-[56px] p-6 sm:p-8 lg:p-10 border border-slate-100 dark:border-slate-800 shadow-premium space-y-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight">{editingClassId ? 'Edit Class' : 'Create Class'}</h2>
            <p className="text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] text-slate-400 mt-2">{editingClassId ? 'Update class appearance and details' : 'Build a class profile'}</p>
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
                if (e.target.files) setClassImage(e.target.files[0]);
              }}
              className="w-full text-xs font-semibold text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-brand-500 file:text-white"
            />
            {classImage && (
              <div className="mt-2 flex items-center justify-between gap-3">
                <p className="text-[11px] text-slate-500">Selected: {classImage.name}</p>
                <button
                  type="button"
                  onClick={() => {
                    setClassImage(null);
                    if (classImageInputRef.current) {
                      classImageInputRef.current.value = '';
                    }
                  }}
                  className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-500 hover:text-rose-500 flex items-center justify-center"
                  title="Remove selected image"
                >
                  <i className="fas fa-xmark text-xs"></i>
                </button>
              </div>
            )}
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

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-2">
          {classes.length > 0 && (
            <p className="text-xs text-slate-500 font-semibold">Classes created: {classes.length}</p>
          )}
          <div className="flex w-full sm:w-auto gap-2">
            {editingClassId && (
              <button
                onClick={cancelEditClass}
                className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-100 text-xs font-black uppercase tracking-widest"
              >
                Cancel
              </button>
            )}
            <button
              onClick={editingClassId ? saveClassEdits : createClassWithStudents}
              className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-brand-500 text-white text-xs font-black uppercase tracking-widest shadow-xl shadow-brand-500/30 hover:brightness-105 active:scale-95 transition-all"
            >
              {editingClassId ? 'Update Class' : 'Create Class'}
            </button>
          </div>
        </div>
          </>
        )}

      </div>
      )}

      {!classAttendancePage && classes.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-[32px] sm:rounded-[48px] lg:rounded-[56px] p-6 sm:p-8 lg:p-10 border border-slate-100 dark:border-slate-800 shadow-premium space-y-3">
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
                onClick={() => {
                  if (openClassAttendancePage) {
                    openClassAttendancePage(String(classItem.id));
                  } else {
                    setSelectedClassId(String(classItem.id));
                    setSelectedAttendanceSubject(null);
                  }
                }}
                className="rounded-2xl border border-slate-100 dark:border-slate-700 overflow-hidden cursor-pointer hover:-translate-y-1 transition-all"
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
                      deleteClass(String(classItem.id), () => {
                        if (activeClassId === String(classItem.id)) {
                          setSelectedClassId(null);
                        }
                      });
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
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{classItem.class_code || `${classItem.name?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'class'}1`}</p>
                  <p className="text-[10px] font-black uppercase tracking-widest text-brand-500">
                    {(classItem.student_count ?? 0)} Students
                  </p>
                </div>
              </div>
            ))}
            {filteredClasses.length === 0 && (
              <div className="col-span-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-sm font-semibold text-slate-500">
                No classes found.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Subject Selection Grid or Student List */}
      {!activeAttendanceId ? (
        !classAttendancePage ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {subjects.map(sub => (
            <button 
              key={sub.id} 
              onClick={() => {
                setSelectedClassId(null);
                setSelectedAttendanceSubject(sub.id);
              }}
              className="bg-white dark:bg-slate-900 p-10 rounded-[56px] shadow-premium border border-slate-100 dark:border-slate-800 group hover:-translate-y-4 transition-all duration-500 text-left"
            >
              <div className={`w-16 h-16 ${sub.bg} ${sub.color} rounded-[24px] flex items-center justify-center text-3xl shadow-inner mb-8 group-hover:rotate-6 transition-transform`}>
                <i className={`fas ${sub.icon}`}></i>
              </div>
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2">{sub.code}</p>
              <h4 className="text-xl font-black mb-1 group-hover:text-brand-500 transition-colors">{sub.name}</h4>
              <p className="text-xs font-bold text-slate-500">{sub.teacher}</p>
            </button>
          ))}
        </div>
        ) : null
      ) : (
        <div className="space-y-10 animate-in slide-in-from-right-5 duration-500">
          {(!classAttendancePage || courseAttendanceOnly) && (
            <>
              {/* Back Button and Subject Info */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 p-5 sm:p-8 lg:p-10 bg-white dark:bg-slate-900 rounded-[32px] sm:rounded-[48px] lg:rounded-[56px] border border-slate-100 dark:border-slate-800 shadow-premium">
                <div className="flex items-center gap-4 sm:gap-6 lg:gap-8 min-w-0">
                  <button 
                    onClick={() => {
                      if (activeClassId) {
                        if (classAttendancePage) {
                          onExitClassAttendancePage?.();
                        } else {
                          setSelectedClassId(null);
                        }
                      } else {
                        setSelectedAttendanceSubject(null);
                      }
                    }} 
                    className="w-12 h-12 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-brand-500 transition-all"
                  >
                    <i className="fas fa-arrow-left"></i>
                  </button>
                  <div className="min-w-0">
                    <h4 className="text-xl sm:text-2xl font-black tracking-tight break-words">
                      Class: {activeClassId ? `${selectedClass?.name} (${selectedClass?.class_code || ''})` : subjects.find(s => s.id === selectedAttendanceSubject)?.name}
                    </h4>
                    <button
                      onClick={() => setIsAttendanceViewOpen(prev => !prev)}
                      title={isAttendanceViewOpen ? 'Click to collapse attendance view' : 'Click to expand attendance view'}
                      className="mt-2 inline-flex items-center gap-3 px-3 py-2 rounded-xl border border-brand-200 dark:border-brand-800 bg-brand-50/80 dark:bg-brand-900/20 text-xs sm:text-sm font-black uppercase tracking-[0.18em] text-slate-700 hover:text-brand-500 dark:text-slate-200 dark:hover:text-brand-300 cursor-pointer"
                    >
                      <span className={`w-8 h-8 rounded-full flex items-center justify-center border ${isAttendanceViewOpen ? 'bg-brand-500 border-brand-400 text-white shadow-lg shadow-brand-500/40' : 'bg-slate-200 dark:bg-slate-700 border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-200'}`}>
                        <i className={`fas ${isAttendanceViewOpen ? 'fa-chevron-down' : 'fa-chevron-right'} text-sm`}></i>
                      </span>
                      <span className={`${isAttendanceViewOpen ? 'text-brand-500 dark:text-brand-400' : ''}`}>
                        {activeClassId ? 'Class Attendance View' : `Course Terminal: ${subjects.find(s => s.id === selectedAttendanceSubject)?.code}`}
                      </span>
                      <span className="text-[10px] sm:text-xs font-bold tracking-normal normal-case text-brand-600 dark:text-brand-300">
                        {isAttendanceViewOpen ? 'Click arrow to collapse' : 'Click arrow to expand'}
                      </span>
                    </button>

                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-3 rounded-2xl bg-slate-50 dark:bg-slate-800 px-4 py-3 border border-slate-100 dark:border-slate-700">
                    <i className="fas fa-calendar text-slate-400"></i>
                    <input
                      type="date"
                      value={attendanceDate}
                      onChange={(e) => setAttendanceDate(e.target.value)}
                      className="bg-transparent text-sm font-black uppercase tracking-widest text-slate-500 border-none focus:ring-0 cursor-pointer"
                    />
                  </div>
                  <div className="flex items-center gap-2 rounded-2xl bg-slate-50 dark:bg-slate-800 px-3 py-3 border border-slate-100 dark:border-slate-700">
                    <input
                      type="month"
                      value={exportMonth}
                      onChange={(e) => setExportMonth(e.target.value)}
                      className="bg-transparent text-xs font-black uppercase tracking-widest text-slate-500 border-none focus:ring-0 cursor-pointer"
                      title="Select export month"
                    />
                    <button
                      onClick={() => {
                        if (activeClassId) {
                          void exportMonthlyAttendancePdf(
                            'class',
                            activeClassId,
                            exportMonth,
                            activeStudents.map(student => ({ id: String(student.id), name: student.name })),
                            selectedClass?.class_code || selectedClass?.name
                          );
                        } else if (selectedAttendanceSubject) {
                          const subjectName = subjects.find(s => s.id === selectedAttendanceSubject)?.name || selectedAttendanceSubject;
                          void exportMonthlyAttendancePdf(
                            'subject',
                            selectedAttendanceSubject,
                            exportMonth,
                            activeStudents.map(student => ({ id: String(student.id), name: student.name })),
                            subjectName
                          );
                        } else {
                          notify('Please select a class or subject before exporting.');
                        }
                      }}
                      className="px-4 py-2 rounded-xl bg-brand-500 text-white text-[10px] font-black uppercase tracking-widest"
                      title="Export selected month as PDF"
                    >
                      PDF
                    </button>
                  </div>
                </div>
              </div>

              {/* Student Attendance List */}
              {isAttendanceViewOpen && (
              <div className="bg-white dark:bg-slate-900 rounded-[32px] sm:rounded-[48px] lg:rounded-[64px] p-3 sm:p-6 shadow-premium border border-slate-100 dark:border-slate-800 overflow-hidden">
                <div className="divide-y divide-slate-50 dark:divide-slate-800">
                  {activeStudents.map(s => {
                    const currentStatus = (attendanceStoreKey ? subjectAttendanceStore[attendanceStoreKey]?.[attendanceDate] : undefined)?.[s.id];
                    return (
                      <div key={s.id} className="p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:bg-slate-50 dark:hover:bg-white/5 transition-all group first:rounded-t-[48px] last:rounded-b-[48px]">
                        <div className="flex items-center gap-8">
                          <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-black text-brand-500">
                            {s.name.charAt(0)}
                          </div>
                          <div>
                            <p className="text-lg font-black tracking-tight">{s.name} <span className="text-xs text-slate-400">({s.id})</span></p>
                          </div>
                          {activeClassId && (
                            <button
                              onClick={() => removeStudentFromClass(activeClassId, String(s.id), courseAttendanceOnly && focusCourse?.id ? String(focusCourse.id) : undefined)}
                              className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-rose-500 flex items-center justify-center"
                              title="Delete student"
                            >
                              <i className="fas fa-trash text-xs"></i>
                            </button>
                          )}
                        </div>
                        
                        {/* Attendance Status Toggle */}
                        <div className="flex flex-wrap bg-slate-100/50 dark:bg-slate-800/50 p-2 rounded-[20px] sm:rounded-[28px] border border-slate-50 dark:border-slate-700">
                          {['P', 'A', 'L'].map((btn) => (
                            <button 
                              key={btn} 
                              onClick={() => {
                                if (activeClassId) {
                                  void updateSubjectAttendance('class', activeClassId, attendanceDate, String(s.id), btn as 'P' | 'A' | 'L', selectedClass?.name);
                                } else if (selectedAttendanceSubject) {
                                  void updateSubjectAttendance(
                                    'subject',
                                    selectedAttendanceSubject,
                                    attendanceDate,
                                    String(s.id),
                                    btn as 'P' | 'A' | 'L',
                                    subjects.find(sub => sub.id === selectedAttendanceSubject)?.name
                                  );
                                }
                              }} 
                              className={`px-4 sm:px-6 py-2.5 sm:py-3 rounded-[14px] sm:rounded-[20px] text-[10px] font-black uppercase tracking-widest transition-all ${currentStatus === btn ? `bg-brand-500 text-white shadow-lg` : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}
                            >
                              {btn === 'P' ? 'Present' : btn === 'A' ? 'Absent' : 'Late'}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              )}

              {courseAttendanceOnly && focusCourse && (
                <>
                  <div className="bg-white dark:bg-slate-900 rounded-[24px] sm:rounded-[32px] p-4 sm:p-6 border border-slate-100 dark:border-slate-800 shadow-premium">
                    <button
                      onClick={() => setIsCourseCalendarOpen(prev => !prev)}
                      title={isCourseCalendarOpen ? 'Click to collapse course timetable calendar' : 'Click to expand course timetable calendar'}
                      className="inline-flex items-center gap-3 px-3 py-2 rounded-xl border border-brand-200 dark:border-brand-800 bg-white dark:bg-slate-900 text-xs sm:text-sm font-black uppercase tracking-[0.18em] text-slate-700 hover:text-brand-500 dark:text-slate-200 dark:hover:text-brand-300 cursor-pointer"
                    >
                      <span className={`w-8 h-8 rounded-full flex items-center justify-center border ${isCourseCalendarOpen ? 'bg-brand-500 border-brand-400 text-white shadow-lg shadow-brand-500/40' : 'bg-slate-200 dark:bg-slate-700 border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-200'}`}>
                        <i className={`fas ${isCourseCalendarOpen ? 'fa-chevron-down' : 'fa-chevron-right'} text-sm`}></i>
                      </span>
                      <span className={`${isCourseCalendarOpen ? 'text-brand-500 dark:text-brand-400' : ''}`}>Course Timetable Calendar</span>
                      <span className="text-[10px] sm:text-xs font-bold tracking-normal normal-case text-brand-600 dark:text-brand-300">
                        {focusCourse.name}
                      </span>
                    </button>

                    {isCourseCalendarOpen && (
                      <div className="mt-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Live Calendar Timetable</p>
                          <span className="bg-white dark:bg-slate-900 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-black uppercase tracking-widest text-slate-500">
                            {attendanceDate}
                          </span>
                        </div>

                        {isCourseCalendarLoading && (
                          <p className="text-xs font-semibold text-slate-500">Loading timetable entries...</p>
                        )}

                        {!isCourseCalendarLoading && courseCalendarEvents.length === 0 && (
                          <p className="text-xs font-semibold text-slate-500">No timetable entries found for this course on this date.</p>
                        )}

                        {!isCourseCalendarLoading && courseCalendarEvents.length > 0 && (
                          <div className="space-y-3">
                            {courseCalendarEvents.map((event, index) => (
                              <div
                                key={event.id}
                                className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3"
                              >
                                <p className="text-xs font-black text-brand-500 uppercase tracking-widest">Period {index + 1}</p>
                                <p className="text-sm font-black text-slate-700 dark:text-slate-200 mt-1">{event.title}</p>
                                <p className="text-[11px] font-semibold text-slate-500 mt-1">
                                  {event.start_time} - {event.end_time}
                                </p>
                                {event.notes && (
                                  <p className="text-[11px] text-slate-500 mt-1">{event.notes}</p>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="bg-white dark:bg-slate-900 rounded-[24px] sm:rounded-[32px] p-4 sm:p-6 border border-slate-100 dark:border-slate-800 shadow-premium">
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Created Homework</p>
                      <span className="text-[10px] font-black uppercase tracking-widest text-brand-500">{courseHomeworkItems.length} Items</span>
                    </div>

                    {isCourseHomeworkLoading && (
                      <p className="text-xs font-semibold text-slate-500">Loading created homework...</p>
                    )}

                    {!isCourseHomeworkLoading && courseHomeworkItems.length === 0 && (
                      <p className="text-xs font-semibold text-slate-500">No homework created yet for this course.</p>
                    )}

                    {!isCourseHomeworkLoading && courseHomeworkItems.length > 0 && (
                      <div className="space-y-3">
                        {courseHomeworkItems.map(item => (
                          <div
                            key={item.id}
                            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-sm font-black text-slate-700 dark:text-slate-200 truncate">{item.title}</p>
                                <p className="text-[11px] font-semibold text-slate-500 mt-1 whitespace-pre-wrap">{item.description}</p>
                              </div>
                              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 shrink-0">
                                {item.created_at ? new Date(item.created_at).toLocaleDateString() : '—'}
                              </span>
                            </div>
                            {item.attachment_url && (
                              <button
                                type="button"
                                onClick={() => void downloadFileDirectly(item.attachment_url || '', 'homework-attachment')}
                                className="mt-2 inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-brand-500"
                              >
                                <i className="fas fa-paperclip"></i>
                                Download Attachment
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="bg-white dark:bg-slate-900 rounded-[24px] sm:rounded-[32px] p-4 sm:p-6 border border-slate-100 dark:border-slate-800 shadow-premium">
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Course Folders</p>
                      <span className="text-[10px] font-black uppercase tracking-widest text-brand-500">{courseFolders.length} Folders</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 mb-4">
                      <input
                        value={newCourseFolderName}
                        onChange={event => setNewCourseFolderName(event.target.value)}
                        placeholder="Folder name"
                        className="flex-1 min-w-[200px] bg-slate-50 dark:bg-slate-800 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold"
                      />
                      <button
                        onClick={() => void createCourseFolder()}
                        disabled={isCourseFolderCreating}
                        className="px-3 py-2 rounded-xl bg-brand-500 text-white text-[10px] font-black uppercase tracking-widest disabled:opacity-60"
                      >
                        {isCourseFolderCreating ? 'Creating...' : 'Create Folder'}
                      </button>
                    </div>

                    {isCourseFoldersLoading ? (
                      <p className="text-xs font-semibold text-slate-500">Loading course folders...</p>
                    ) : courseFolders.length === 0 ? (
                      <p className="text-xs font-semibold text-slate-500">No folders created yet for this course.</p>
                    ) : (
                      <div className="space-y-2">
                        {courseFolders.map(folder => {
                          const isOpen = Boolean(openCourseFolders[folder.name]);
                          const files = courseFolderFiles[folder.name] || [];
                          const inputId = `course-folder-upload-${folder.name}`;

                          return (
                            <div key={folder.name} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 overflow-hidden">
                              <div className="flex items-center justify-between gap-2 p-3">
                                <button
                                  onClick={() => void toggleCourseFolderOpen(folder.name)}
                                  className="min-w-0 flex items-center gap-2 text-left"
                                >
                                  <i className={`fas fa-chevron-right text-[10px] transition-transform ${isOpen ? 'rotate-90 text-brand-500' : 'text-slate-400'}`}></i>
                                  <i className="fas fa-folder text-amber-500 text-xs"></i>
                                  <span className="text-xs font-black truncate">{folder.name}</span>
                                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{folder.filesCount}</span>
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); void deleteCourseFolder(folder.name); }}
                                  className="mx-2 px-2 py-1 rounded-md bg-rose-50 text-rose-500 hover:bg-rose-100 text-[10px] font-black uppercase tracking-widest transition-colors"
                                >
                                  Del
                                </button>

                                <button
                                  onClick={() => courseFolderUploadRefs.current[inputId]?.click()}
                                  disabled={uploadingCourseFolderName === folder.name}
                                  className="px-2.5 py-1.5 rounded-lg bg-brand-500 text-white text-[10px] font-black uppercase tracking-widest disabled:opacity-60"
                                >
                                  {uploadingCourseFolderName === folder.name ? 'Uploading...' : 'Add File'}
                                </button>

                                <input
                                  id={inputId}
                                  ref={node => {
                                    courseFolderUploadRefs.current[inputId] = node;
                                  }}
                                  type="file"
                                  accept={FOLDER_FILE_ACCEPT}
                                  multiple
                                  className="hidden"
                                  onChange={event => {
                                    void uploadFilesToCourseFolder(folder.name, event.target.files);
                                    event.target.value = '';
                                  }}
                                />
                              </div>

                              {isOpen && (
                                <div className="px-3 pb-3 border-t border-slate-200 dark:border-slate-700 pt-2 space-y-2">
                                  {files.length === 0 ? (
                                    <p className="text-[11px] font-semibold text-slate-500">No files yet.</p>
                                  ) : (
                                    files.map(file => (
                                      <div
                                        key={file.path}
                                        className="flex items-center justify-between gap-2 p-2 rounded-lg bg-white dark:bg-slate-900 group"
                                      >
                                        <button
                                          type="button"
                                          onClick={() => void downloadFileDirectly(file.url, file.name)}
                                          className="flex-1 text-left min-w-0 flex items-center gap-2"
                                        >
                                          <span className="text-[11px] font-black text-brand-500 truncate hover:underline">{file.name}</span>
                                        </button>
                                        <div className="flex items-center gap-2 shrink-0">
                                          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                            {file.size > 0 ? `${Math.max(1, Math.round(file.size / 1024))}KB` : 'File'}
                                          </span>
                                          <button
                                            onClick={(e) => { e.stopPropagation(); void deleteCourseFile(folder.name, file); }}
                                            className="px-2 py-1 rounded-md bg-rose-50 text-rose-500 hover:bg-rose-100 text-[10px] font-black uppercase transition-colors opacity-0 group-hover:opacity-100"
                                          >
                                            Del
                                          </button>
                                        </div>
                                      </div>
                                    ))
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </>
              )}
            </>
          )}

          {activeClassId && !courseAttendanceOnly && (
            <>
              <div className="bg-white dark:bg-slate-900 rounded-[24px] sm:rounded-[32px] p-4 sm:p-6 border border-slate-100 dark:border-slate-800 shadow-premium">
                <button
                  onClick={() => setIsTimetableViewOpen(prev => !prev)}
                  title={isTimetableViewOpen ? 'Click to collapse timetable folder' : 'Click to expand timetable folder'}
                  className="inline-flex items-center gap-3 px-3 py-2 rounded-xl border border-brand-200 dark:border-brand-800 bg-white dark:bg-slate-900 text-xs sm:text-sm font-black uppercase tracking-[0.18em] text-slate-700 hover:text-brand-500 dark:text-slate-200 dark:hover:text-brand-300 cursor-pointer"
                >
                  <span className={`w-8 h-8 rounded-full flex items-center justify-center border ${isTimetableViewOpen ? 'bg-brand-500 border-brand-400 text-white shadow-lg shadow-brand-500/40' : 'bg-slate-200 dark:bg-slate-700 border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-200'}`}>
                    <i className={`fas ${isTimetableViewOpen ? 'fa-chevron-down' : 'fa-chevron-right'} text-sm`}></i>
                  </span>
                  <span className={`${isTimetableViewOpen ? 'text-brand-500 dark:text-brand-400' : ''}`}>Timetable Folder</span>
                  <span className="text-[10px] sm:text-xs font-bold tracking-normal normal-case text-brand-600 dark:text-brand-300">
                    {isTimetableViewOpen ? 'Click arrow to collapse' : 'Click arrow to expand'}
                  </span>
                </button>

                {isTimetableViewOpen && (
                  <div className="mt-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3 space-y-3">
                    <button
                      onClick={() => timetableInputRef.current?.click()}
                      disabled={isTimetableUploading}
                      className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest text-white ${isTimetableUploading ? 'bg-brand-300 cursor-not-allowed' : 'bg-brand-500'}`}
                    >
                      {isTimetableUploading ? 'Uploading PDF...' : 'Upload PDF File'}
                    </button>
                    <input
                      ref={timetableInputRef}
                      type="file"
                      accept="application/pdf,.pdf"
                      onChange={uploadTimetablePdf}
                      className="hidden"
                    />

                    <div className="flex flex-wrap gap-2">
                      {isTimetableLoading && (
                        <span className="text-xs font-semibold text-slate-500">Loading timetable files...</span>
                      )}

                      {!isTimetableLoading && timetableFiles.length === 0 && (
                        <span className="text-xs font-semibold text-slate-500">No PDF uploaded yet.</span>
                      )}

                      {!isTimetableLoading && timetableFiles.map(file => (
                        <div
                          key={file.path}
                          className="flex items-center gap-2 px-2 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                        >
                          <button
                            type="button"
                            onClick={() => void downloadFileDirectly(file.url, file.name)}
                            className="text-xs font-black uppercase tracking-widest text-brand-500 hover:text-brand-600"
                            title={file.name}
                          >
                            {file.name.length > 24 ? `${file.name.slice(0, 24)}...` : file.name}
                          </button>
                          <button
                            onClick={() => void deleteTimetablePdf(file.path)}
                            className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-rose-500 flex items-center justify-center"
                            title="Delete PDF"
                          >
                            <i className="fas fa-trash text-xs"></i>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

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
                          if (openClassCoursePage) {
                            openClassCoursePage({
                              id: course.id,
                              name: course.name,
                              classId: course.class_id,
                              className: selectedClass?.name,
                            });
                            return;
                          }
                          notify('Course page navigation is not configured.');
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
            </>
          )}

          {!courseAttendanceOnly && isCreateCourseModalOpen && (
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
                  {newCourseError && (
                    <p className="text-xs font-bold text-rose-500">{newCourseError}</p>
                  )}
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
                        if (e.target.files?.[0]) {
                          setNewCourseImage(e.target.files[0]);
                        }
                      }}
                      className="hidden"
                    />
                    {newCourseImage && (
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <p className="text-[11px] text-slate-500 truncate">Selected: {newCourseImage.name}</p>
                        <button
                          type="button"
                          onClick={() => {
                            setNewCourseImage(null);
                            if (newCourseImageInputRef.current) {
                              newCourseImageInputRef.current.value = '';
                            }
                          }}
                          className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-500 hover:text-rose-500 flex items-center justify-center"
                          title="Remove selected image"
                        >
                          <i className="fas fa-xmark text-xs"></i>
                        </button>
                      </div>
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

          {!courseAttendanceOnly && isEditCourseModalOpen && (
            <div className="fixed inset-0 z-[230] bg-slate-950/50 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="w-full max-w-lg max-h-[85vh] overflow-y-auto bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-2xl p-6 space-y-5">
                <div className="flex items-center justify-between gap-4">
                  <h3 className="text-xl font-black tracking-tight">Edit Course</h3>
                  <button
                    onClick={closeEditCourseModal}
                    className="w-10 h-10 rounded-full hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-400"
                  >
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
                        <img
                          src={editCourseImage ? URL.createObjectURL(editCourseImage) : String(editCourseCurrentImageUrl)}
                          alt="Course preview"
                          className="w-full h-full object-cover"
                        />
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
                          if (editCourseImageInputRef.current) {
                            editCourseImageInputRef.current.value = '';
                          }
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
                        if (e.target.files?.[0]) {
                          setEditCourseImage(e.target.files[0]);
                        }
                      }}
                      className="hidden"
                    />
                  </div>
                </div>

                {editCourseError && (
                  <p className="text-xs font-bold text-rose-500">{editCourseError}</p>
                )}

                <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
                  <button
                    onClick={closeEditCourseModal}
                    className="px-6 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-black uppercase tracking-widest"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => void updateClassCourse()}
                    disabled={isClassCourseUpdating}
                    className={`px-6 py-3 rounded-2xl text-white text-xs font-black uppercase tracking-widest ${isClassCourseUpdating ? 'bg-brand-300 cursor-not-allowed' : 'bg-brand-500'}`}
                  >
                    {isClassCourseUpdating ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {!courseAttendanceOnly && courseDeleteDialog && (
            <div className="fixed inset-0 z-[230] bg-slate-950/50 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-2xl p-6 space-y-5">
                <h3 className="text-xl font-black tracking-tight">Secure Course Deletion</h3>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  Retype <span className="font-black">{courseDeleteDialog.name}</span> and enter admin password to continue.
                </p>

                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Retype Course Name</label>
                  <input
                    type="text"
                    value={courseDeleteNameInput}
                    onChange={(e) => setCourseDeleteNameInput(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 outline-none"
                    placeholder="Enter exact course name"
                  />
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Admin Password</label>
                  <input
                    type="password"
                    value={courseDeleteAdminPassword}
                    onChange={(e) => setCourseDeleteAdminPassword(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 outline-none"
                    placeholder="Enter admin password"
                  />
                </div>

                {courseDeleteError && (
                  <p className="text-xs font-bold text-rose-500">{courseDeleteError}</p>
                )}

                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => {
                      if (isCourseDeleteSubmitting) return;
                      setCourseDeleteDialog(null);
                      setCourseDeleteNameInput('');
                      setCourseDeleteAdminPassword('');
                      setCourseDeleteError(null);
                    }}
                    className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs uppercase tracking-widest"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => void handleSecureCourseDelete()}
                    disabled={isCourseDeleteSubmitting}
                    className={`px-4 py-2.5 rounded-xl text-white font-bold text-xs uppercase tracking-widest ${isCourseDeleteSubmitting ? 'bg-rose-300 cursor-not-allowed' : 'bg-rose-500'}`}
                  >
                    {isCourseDeleteSubmitting ? 'Verifying...' : 'Delete'}
                  </button>
                </div>
              </div>
            </div>
          )}
          {(process.env.NODE_ENV === 'development') && (
            <div className="absolute top-4 right-4 text-[10px] font-black uppercase text-brand-500 opacity-50">Attendance Protocol Mount OK</div>
          )}
        </div>
      )}

      {confirmDialog && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-premium">
            <h5 className="text-sm font-black uppercase tracking-widest text-slate-500">Confirm Action</h5>
            <p className="mt-3 text-sm font-semibold text-slate-600 dark:text-slate-300">{confirmDialog.message}</p>

            <div className="mt-5 flex items-center justify-end gap-3">
              <button
                onClick={() => setConfirmDialog(null)}
                disabled={isConfirmActionSubmitting}
                className="px-4 py-2.5 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-100 text-xs font-black uppercase tracking-widest disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                onClick={() => void confirmDialog.onConfirm()}
                disabled={isConfirmActionSubmitting}
                className="px-4 py-2.5 rounded-xl bg-rose-500 text-white text-xs font-black uppercase tracking-widest disabled:opacity-60 transition-colors hover:bg-rose-600"
              >
                {isConfirmActionSubmitting ? 'Deleting...' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default AttendanceProtocol;
