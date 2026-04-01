
import React, { useState, useEffect, useCallback, useRef } from 'react';
import Sidebar from './components/Sidebar';
import Login from './components/Login';
import COURSES from './components/ClassandCoursesmanager';
import LiveCalendar from './components/Livecalender';
import SchoolInfo from './components/SchoolInfo';
import { Course, User, UserRole, View, Note, Quiz, ReportCard } from './types';
import { INITIAL_USER, INITIAL_COURSES, SCHOOL_EVENTS, SCHOOL_ACTIVITIES, DETAILED_GRADES, STUDENT_ACHIEVEMENTS, SCHOOL_HIVE_POSTS, SCHOOL_CONTACTS } from './constants';
import { summarizeNotes, generateQuizFromNotes } from './services/aiService';
import { supabase, isSupabaseConfigured } from './src/supabaseClient';
import Messaging from './components/Messaging';
import TeacherExams from './components/TeacherExams';
import DailyAttendancePage from './components/DailyAttendancePage';

type NoticeItem = {
  id: string;
  title: string;
  content: string;
  date: string;
  priority: 'Low' | 'Medium' | 'High' | 'Urgent';
  fileUrl?: string;
  fileName?: string;
  targetInfo?: string;
  createdBy?: string;
  classId?: string;
  courseId?: string;
};

type NoticeBoardRow = {
  id: string;
  title: string | null;
  message: string | null;
  notice_date: string | null;
  created_at: string | null;
  priority: string | null;
  file_path: string | null;
  file_name: string | null;
};

type DynamicReportCard = {
  id: string;
  title: string;
  reportDate: string;
  reportType: string | null;
  filePath: string | null;
  fileName: string | null;
  fileUrl?: string;
};

const NOTICE_FILE_BUCKET = import.meta.env.VITE_SUPABASE_NOTICE_BUCKET || 'notice_board';
const MAX_SUBMISSION_FILE_SIZE = 200 * 1024 * 1024; // 200 MB

const formatNoticeDate = (value?: string | null) => {
  if (!value) return 'N/A';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'N/A';
  return parsed.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
};

const normalizePriority = (value?: string | null): 'Low' | 'Medium' | 'High' | 'Urgent' => {
  const formatted = (value || '').trim().toLowerCase();
  if (formatted === 'urgent') return 'Urgent';
  if (formatted === 'high') return 'High';
  if (formatted === 'low') return 'Low';
  if (formatted === 'medium') return 'Medium';
  return 'Medium';
};

const getNoticeFileUrl = (filePath?: string | null) => {
  if (!filePath || !supabase) return undefined;
  if (/^https?:\/\//i.test(filePath)) return filePath;

  const normalizedPath = filePath.replace(/^\/+/, '');

  if (normalizedPath.startsWith(`${NOTICE_FILE_BUCKET}/`)) {
    const objectPath = normalizedPath.slice(NOTICE_FILE_BUCKET.length + 1);
    const { data } = supabase.storage.from(NOTICE_FILE_BUCKET).getPublicUrl(objectPath);
    return data.publicUrl;
  }

  const { data } = supabase.storage.from(NOTICE_FILE_BUCKET).getPublicUrl(normalizedPath);
  return data.publicUrl;
};

const fetchNoticeBoardData = async (
  schoolId: string | undefined,
  studentId?: string,
  classIds: string[] = [],
  courseIds: string[] = [],
  teacherId?: string
): Promise<NoticeItem[]> => {
  if (!supabase || !isSupabaseConfigured || !schoolId) return [];

  const allNotices: NoticeItem[] = [];

  // 1. Fetch from general notice_board
  const { data: generalData, error: generalError } = await supabase
    .from('notice_board')
    .select('id, title, message, notice_date, created_at, priority, file_path, file_name')
    .eq('school_id', schoolId)
    .order('notice_date', { ascending: false });

  if (generalError) console.error('[NoticeBoard] Error fetching general notices:', generalError);
  if (generalData) {
    allNotices.push(...generalData.map(row => ({
      id: row.id,
      title: (row.title || 'Untitled Notice').trim(),
      content: (row.message || '').trim() || 'No notice details provided.',
      date: formatNoticeDate(row.notice_date || row.created_at),
      priority: normalizePriority(row.priority),
      fileUrl: getNoticeFileUrl(row.file_path),
      fileName: row.file_name || undefined,
      targetInfo: 'General'
    })));
  }

  // 2. Fetch from targeted class_announcements
  let classAnnQuery = supabase
    .from('class_announcements')
    .select('*, classes(name), class_courses(name)')
    .eq('school_id', schoolId);

  // If studentId is provided, filter for their classes/courses or global (NULL class_id)
  if (studentId) {
    const filters = ['class_id.is.null'];
    if (classIds.length > 0) filters.push(`class_id.in.(${classIds.join(',')})`);
    if (courseIds.length > 0) filters.push(`class_course_id.in.(${courseIds.join(',')})`);
    classAnnQuery = classAnnQuery.or(filters.join(','));
  } else if (teacherId) {
    // For teachers, show everything they created, general ones, OR ones for their assigned classes/courses
    const filters = [`created_by.eq.${teacherId}`, 'class_id.is.null'];
    if (classIds.length > 0) filters.push(`class_id.in.(${classIds.join(',')})`);
    if (courseIds.length > 0) filters.push(`class_course_id.in.(${courseIds.join(',')})`);
    classAnnQuery = classAnnQuery.or(filters.join(','));
  }

  const { data: targetedData, error: targetedError } = await classAnnQuery.order('notice_date', { ascending: false });

  if (targetedError) console.error('[NoticeBoard] Error fetching targeted notices:', targetedError);
  if (targetedData) {
    allNotices.push(...targetedData.map(row => {
      let targetInfo = 'General';
      if (row.class_courses?.name) {
        targetInfo = `${row.classes?.name || ''} - ${row.class_courses.name}`;
      } else if (row.classes?.name) {
        targetInfo = row.classes.name;
      }

      return {
        id: row.id,
        title: (row.title || 'Untitled Announcement').trim(),
        content: (row.message || '').trim() || 'No details provided.',
        date: formatNoticeDate(row.notice_date || row.created_at),
        priority: normalizePriority(row.priority),
        fileUrl: row.attachment_url,
        fileName: row.attachment_url ? decodeURIComponent(row.attachment_url.split('/').pop()?.split('?')[0] || '') : undefined,
        targetInfo,
        createdBy: row.created_by,
        classId: row.class_id,
        courseId: row.class_course_id
      };
    }));
  }

  // Sort by date then created_at
  return allNotices.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
};

const getStudentAvatarUrl = (avatarValue?: string | null) => {
  if (!avatarValue || !supabase) return null;
  if (/^https?:\/\//i.test(avatarValue)) return avatarValue;
  const { data } = supabase.storage.from('student_profile').getPublicUrl(avatarValue);
  return data.publicUrl;
};

const formatAttendanceRate = (value?: string | number | null) => {
  if (value === null || value === undefined || value === '') return 'N/A';
  const stringValue = String(value).trim();
  if (stringValue.includes('%')) return stringValue;
  return `${stringValue}%`;
};

const LOGIN_STORAGE_KEY = 'iem_logged_in';
const USER_STORAGE_KEY = 'iem_user';
const VIEWED_NOTICES_STORAGE_KEY = 'iem_viewed_notice_ids';

const getStoredLoginState = () => {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(LOGIN_STORAGE_KEY) === 'true';
};

const getStoredUser = () => {
  if (typeof window === 'undefined') return INITIAL_USER;
  try {
    const rawUser = window.localStorage.getItem(USER_STORAGE_KEY);
    if (!rawUser) return INITIAL_USER;
    return { ...INITIAL_USER, ...JSON.parse(rawUser) } as User;
  } catch {
    return INITIAL_USER;
  }
};

const getStoredViewedNoticeIds = () => {
  if (typeof window === 'undefined') return [] as string[];
  try {
    const raw = window.localStorage.getItem(VIEWED_NOTICES_STORAGE_KEY);
    if (!raw) return [] as string[];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [] as string[];
    return parsed.filter((value) => typeof value === 'string');
  } catch {
    return [] as string[];
  }
};

interface AppProps {
  onSwitch?: () => void;
  schoolId?: string;
  schoolName?: string;
  onSchoolIdChange?: (newId: string | undefined, newName?: string) => void;
}

const App: React.FC<AppProps> = ({ onSwitch, schoolId, schoolName, onSchoolIdChange }) => {
  const [isLoggedIn, setIsLoggedIn] = useState(getStoredLoginState);
  const [user, setUser] = useState<User>(getStoredUser);
  const [courses, setCourses] = useState<Course[]>(INITIAL_COURSES);
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(null);
  const [selectedNotice, setSelectedNotice] = useState<NoticeItem | null>(null);
  const [noticeOriginView, setNoticeOriginView] = useState<'notice-board' | 'instruction'>('notice-board');
  const [viewedNoticeIds, setViewedNoticeIds] = useState<string[]>(getStoredViewedNoticeIds);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isResourcesSectionOpen, setIsResourcesSectionOpen] = useState(true);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [calendarDate, setCalendarDate] = useState(new Date(2025, 3, 1));
  const [calendarSubView, setCalendarSubView] = useState<'day' | 'week' | 'month'>('month');
  const [openFolders, setOpenFolders] = useState<Set<string>>(new Set());

  // Dynamic Data States (Linked to SMS)
  const [dynamicAnnouncements, setDynamicAnnouncements] = useState<NoticeItem[]>([]);
  const [dynamicExams, setDynamicExams] = useState<any[]>([]);
  const [dynamicAssignments, setDynamicAssignments] = useState<any[]>([]);
  const [isSubmissionModalOpen, setIsSubmissionModalOpen] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<any>(null);
  const [submissionFile, setSubmissionFile] = useState<File | null>(null);
  const [submissionComment, setSubmissionComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [examResultsData, setExamResultsData] = useState<any[]>([]);
  const [reportCard, setReportCard] = useState<ReportCard | null>(null);
  const [dynamicReportCards, setDynamicReportCards] = useState<DynamicReportCard[]>([]);
  const [dynamicSchoolEvents, setDynamicSchoolEvents] = useState<any[]>([]);
  const [dynamicAchievements, setDynamicAchievements] = useState<any[]>([]);
  const [dynamicStudentActivities, setDynamicStudentActivities] = useState<any[]>([]);
  const [dynamicLiveIntel, setDynamicLiveIntel] = useState<any[]>([]);
  const [selectedLiveIntel, setSelectedLiveIntel] = useState<any>(null);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [studentAttendanceRate, setStudentAttendanceRate] = useState<string>('98%');
  const [assignedCourseIds, setAssignedCourseIds] = useState<string[]>([]);
  const [assignedClassIds, setAssignedClassIds] = useState<string[]>([]);
  const [selectedClass, setSelectedClass] = useState<any>(null);
  const [selectedClassStudents, setSelectedClassStudents] = useState<any[]>([]);
  const [selectedCourseStudents, setSelectedCourseStudents] = useState<any[]>([]);
  const [selectedClassCourses, setSelectedClassCourses] = useState<any[]>([]);
  const [selectedClassTeachers, setSelectedClassTeachers] = useState<any[]>([]);
  const [isTeacherDataLoading, setIsTeacherDataLoading] = useState(false);
  const [courseTimetable, setCourseTimetable] = useState<any[]>([]);
  const [isLoadingCourseTimetable, setIsLoadingCourseTimetable] = useState(false);

  // New Submission Feedback States
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [submissionStatus, setSubmissionStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [submissionFileError, setSubmissionFileError] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
    type?: 'confirm' | 'info';
  } | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Teacher Creation States
  const [isHomeworkComposerOpen, setIsHomeworkComposerOpen] = useState(false);
  const [homeworkTitle, setHomeworkTitle] = useState('');
  const [homeworkDescription, setHomeworkDescription] = useState('');
  const [homeworkDueDate, setHomeworkDueDate] = useState('');
  const [homeworkFile, setHomeworkFile] = useState<File | null>(null);
  const [isNoticeComposerOpen, setIsNoticeComposerOpen] = useState(false);
  const [noticeTitle, setNoticeTitle] = useState('');
  const [noticeMessage, setNoticeMessage] = useState('');
  const [noticeDate, setNoticeDate] = useState(new Date().toISOString().split('T')[0]);
  const [noticePriority, setNoticePriority] = useState<'Low' | 'Medium' | 'High' | 'Urgent'>('Medium');
  const [noticeFile, setNoticeFile] = useState<File | null>(null);
  const [selectedNoticeTargets, setSelectedNoticeTargets] = useState<Array<{ classId: string, courseId: string, displayName: string }>>([]);
  const [isSavingTeacherData, setIsSavingTeacherData] = useState(false);
  const [assignedClassId, setAssignedClassId] = useState('');
  const [assignedCourseId, setAssignedCourseId] = useState('');
  const [assignedCoursesList, setAssignedCoursesList] = useState<any[]>([]);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);

  // Resource Management States
  const [isCreateFolderModalOpen, setIsCreateFolderModalOpen] = useState(false);
  const [isUploadResourceModalOpen, setIsUploadResourceModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [resourceTitle, setResourceTitle] = useState('');
  const [resourceContent, setResourceContent] = useState('');
  const [resourceFile, setResourceFile] = useState<File | null>(null);
  const [selectedUploadFolder, setSelectedUploadFolder] = useState<string>('');

  const hasNewNotices = dynamicAnnouncements.some(notice => !viewedNoticeIds.includes(notice.id));

  const performSmsSync = useCallback(async (isSilent = false) => {
    if (!isSilent) setIsLoading(true);
    // Reset data to prevent leakage from previous school session
    setDynamicAnnouncements([]);
    setDynamicExams([]);
    setDynamicAssignments([]);
    setExamResultsData([]);
    setDynamicReportCards([]);
    setDynamicSchoolEvents([]);
    setDynamicStudentActivities([]);
    setDynamicLiveIntel([]);

    try {
      // Debug log for schoolId
      console.log('[NoticeBoard] Fetching notices for schoolId:', schoolId);
      const notices = await fetchNoticeBoardData(schoolId, user.studentId, assignedClassIds, assignedCourseIds, user.id);

      console.log('[NoticeBoard] Notices fetched:', notices);
      setDynamicAnnouncements(notices);

      if (supabase && isSupabaseConfigured) {
        if (user.role === UserRole.TEACHER) {
          // TEACHER SCOPING
          const courseIds = assignedCourseIds;
          const classIds = assignedClassIds;

          if (courseIds.length > 0 || classIds.length > 0) {
            const client = supabase;
            if (!client) return;
            // 1. Fetch Students in these courses
            const { data: studentsEnrolled } = await supabase
              .from('class_course_students')
              .select('student_id')
              .in('class_course_id', courseIds)
              .eq('school_id', schoolId);

            const studentIds = Array.from(new Set((studentsEnrolled || []).map(s => s.student_id)));

            // 2. Fetch Grades for these students and courses
            let gradesQuery = supabase.from('exam_grades').select('*, exams:exam_id(title)').eq('school_id', schoolId);
            if (studentIds.length > 0) gradesQuery = gradesQuery.in('student_id', studentIds);
            if (courseIds.length > 0) gradesQuery = gradesQuery.in('class_course_id', courseIds);

            const { data: gradesData } = await gradesQuery;
            if (gradesData) {
              setExamResultsData(gradesData.map(g => ({
                assignment: (g.exams as any)?.title || 'Unknown Assessment',
                className: g.name || 'Unknown Class',
                courseName: g.course_name || 'Unknown Course',
                grade: g.grade ? String(g.grade) : 'Pending',
                percentage: g.percentage ? String(g.percentage) : null,
                feedback: g.note || 'No feedback provided'
              })));
            }

            // 3. Fetch Exams for these courses
            const { data: examsData } = await supabase
              .from('exams')
              .select('*')
              .in('class_course_id', courseIds)
              .eq('school_id', schoolId)
              .order('created_at', { ascending: false });

            if (examsData) {
              setDynamicExams(examsData.map(ex => ({
                id: ex.id,
                subject: ex.title,
                date: new Date(ex.exam_date || ex.created_at).toLocaleDateString(undefined, { month: 'long', day: '2-digit' }),
                time: ex.exam_time || '10:00 AM',
                venue: ex.location || 'TBA',
                originalDate: ex.exam_date || ex.created_at
              })));
            }

            // 4. Fetch Homework for these courses
            const { data: homeworkData } = await supabase
              .from('homework_assignments')
              .select('*')
              .in('class_course_id', courseIds)
              .eq('school_id', schoolId)
              .order('created_at', { ascending: false });

            if (homeworkData) {
              const assignmentIds = homeworkData.map(h => h.id);
              // Fetch all submissions for these assignments with student names
              const { data: rawSubmissions } = await supabase
                .from('homework_submissions')
                .select('*, student:student_id(name)')
                .in('assignment_id', assignmentIds)
                .eq('school_id', schoolId);

              setDynamicAssignments(homeworkData.map(hw => {
                const submissions = rawSubmissions?.filter(s => s.assignment_id === hw.id) || [];
                const rawUrl = hw.attachment_url || hw.file_url || '';
                const fileName = rawUrl ? decodeURIComponent(rawUrl.split('/').pop()?.split('?')[0] || '') : '';

                return {
                  id: hw.id,
                  title: hw.title,
                  description: hw.description || '',
                  dueDate: new Date(hw.due_date || hw.created_at).toLocaleDateString(undefined, { month: 'long', day: '2-digit' }),
                  status: submissions.length > 0 ? 'Submitted' : 'None',
                  course: hw.course_name || 'General',
                  location: hw.location || 'TBA',
                  fileUrl: rawUrl,
                  fileName,
                  originalDate: hw.due_date || hw.created_at,
                  submissions: submissions.map(s => ({
                    studentName: (s.student as any)?.name || 'Unknown Student',
                    url: s.submission_url,
                    id: s.id
                  }))
                };
              }));
            }

            // 5. Fetch Achievements for these students
            if (studentIds.length > 0) {
              const { data: achievementsData } = await supabase
                .from('student_achievements')
                .select('*')
                .in('student_id', studentIds)
                .eq('school_id', schoolId)
                .order('achievement_date', { ascending: false });

              if (achievementsData) {
                setDynamicAchievements(achievementsData.map(ach => ({
                  id: ach.id,
                  title: ach.title,
                  desc: ach.description || ach.title,
                  icon: ach.icon || 'fa-award',
                  color: ach.color ? (ach.color.startsWith('text-') ? ach.color : `text-${ach.color}-500`) : 'text-emerald-500',
                  date: ach.achievement_date ? new Date(ach.achievement_date).toLocaleDateString() : 'Recent'
                })));
              }
            }
          }
        } else if (user.role === UserRole.STUDENT) {
          // STUDENT SCOPING (Existing logic)
          // Fetch grades with assessment titles
          const { data: gradesData, error: gradesError } = await supabase
            .from('exam_grades')
            .select('*, exams:exam_id(title)')
            .eq('student_id', user.studentId)
            .eq('school_id', schoolId);

          if (!gradesError && gradesData) {
            const mappedGrades = gradesData.map(g => ({
              assignment: (g.exams as any)?.title || 'Unknown Assessment',
              className: g.name || 'Unknown Class',
              courseName: g.course_name || 'Unknown Course',
              grade: g.grade ? String(g.grade) : 'Pending',
              percentage: g.percentage ? String(g.percentage) : null,
              feedback: g.note || 'No feedback provided'
            }));
            setExamResultsData(mappedGrades);
          } else {
            console.error("Error fetching grades:", gradesError);
            setExamResultsData([]);
          }

          // Fetch student's enrolled courses to get exams and homework
          const { data: enrolledData, error: enrolledError } = await supabase
            .from('class_course_students')
            .select('class_course_id, class_id')
            .eq('student_id', user.studentId)
            .eq('school_id', schoolId);

          if (!enrolledError && enrolledData) {
            const courseIds = enrolledData.map(d => d.class_course_id);

            if (courseIds.length > 0) {
              // Fetch Exams
              const { data: examsData, error: examsError } = await supabase
                .from('exams')
                .select('*')
                .in('class_course_id', courseIds)
                .eq('school_id', schoolId)
                .order('created_at', { ascending: false });

              if (!examsError && examsData) {
                const mappedExams = examsData.map(ex => {
                  const dateSource = ex.exam_date || ex.created_at;
                  const date = new Date(dateSource);
                  const month = date.toLocaleString('default', { month: 'long' });
                  const dayStr = date.getDate().toString().padStart(2, '0');
                  return {
                    id: ex.id,
                    subject: ex.title,
                    date: `${month} ${dayStr}`,
                    time: ex.exam_time || '10:00 AM',
                    venue: ex.location || 'TBA',
                    originalDate: dateSource
                  };
                });
                setDynamicExams(mappedExams);
              }

              // Fetch Homework/Assignments
              const { data: homeworkData, error: homeworkError } = await supabase
                .from('homework_assignments')
                .select('*')
                .in('class_course_id', courseIds)
                .eq('school_id', schoolId)
                .order('created_at', { ascending: false });

              if (!homeworkError && homeworkData) {
                // Now fetch submissions for this student to show correct status
                const { data: submissionsData } = await supabase
                  .from('homework_submissions')
                  .select('assignment_id, status, submission_url')
                  .eq('student_id', user.studentId)
                  .eq('school_id', schoolId);

                const mappedAssignments = homeworkData.map(hw => {
                  const dateSource = hw.due_date || hw.created_at;
                  const date = new Date(dateSource);
                  const month = date.toLocaleString('default', { month: 'long' });
                  const dayStr = date.getDate().toString().padStart(2, '0');

                  const submission = submissionsData?.find(s => s.assignment_id === hw.id);

                  const rawUrl = hw.attachment_url || hw.file_url || '';
                  const fileName = rawUrl ? decodeURIComponent(rawUrl.split('/').pop()?.split('?')[0] || '') : '';
                  return {
                    id: hw.id,
                    title: hw.title,
                    description: hw.description || '',
                    dueDate: `${month} ${dayStr}`,
                    status: submission ? (submission.status || 'Active') : 'Pending',
                    course: hw.course_name ? `${hw.class_name || ''} - ${hw.course_name}` : 'General',
                    location: hw.location || 'TBA',
                    fileUrl: rawUrl,
                    fileName,
                    submissionUrl: submission?.submission_url,
                    originalDate: dateSource
                  };
                });
                setDynamicAssignments(mappedAssignments);
              }

              // Fetch Report Cards
              const client = supabase;
              if (!client) return;
              const { data: reportCardsData, error: reportCardsError } = await client
                .from('report_cards')
                .select('*')
                .eq('student_id', user.studentId)
                .eq('school_id', schoolId)
                .order('report_date', { ascending: false });

              if (!reportCardsError && reportCardsData) {
                const mappedReportCards = reportCardsData.map(rc => {
                  let fileUrl = '';
                  if (rc.file_path && supabase) {
                    const { data } = supabase.storage.from('report_cards').getPublicUrl(rc.file_path);
                    fileUrl = data.publicUrl;
                  }
                  return {
                    id: rc.id,
                    title: rc.file_name || rc.title || 'Official Report Card',
                    reportDate: rc.report_date ? new Date(rc.report_date).toLocaleDateString() : 'N/A',
                    reportType: rc.report_type,
                    filePath: rc.file_path,
                    fileName: rc.file_name,
                    fileUrl
                  };
                });
                setDynamicReportCards(mappedReportCards);
              } else {
                console.error("Error fetching report cards:", reportCardsError);
                setDynamicReportCards([]);
              }

              // Fetch Student Achievements
              const { data: achievementsData } = await supabase
                .from('student_achievements')
                .select('*')
                .eq('student_id', user.studentId)
                .eq('school_id', schoolId)
                .order('achievement_date', { ascending: false });

              if (achievementsData) {
                setDynamicAchievements(achievementsData.map(ach => ({
                  id: ach.id,
                  title: ach.title,
                  desc: ach.description || ach.title,
                  icon: ach.icon || 'fa-award',
                  color: ach.color ? (ach.color.startsWith('text-') ? ach.color : `text-${ach.color}-500`) : 'text-emerald-500',
                  date: ach.achievement_date ? new Date(ach.achievement_date).toLocaleDateString() : 'Recent'
                })));
              }
            }
          }
        }

        // --- SHARED DATA FETCHING (Institutional Overview) ---
        // Fetch School Events
        const { data: schoolEventsData } = await supabase
          .from('events')
          .select('*')
          .eq('school_id', schoolId)
          .order('event_date', { ascending: false });

        if (schoolEventsData) {
          setDynamicSchoolEvents(schoolEventsData.map(ev => ({
            id: ev.id,
            name: ev.title,
            type: ev.type,
            date: ev.event_date ? new Date(ev.event_date).toLocaleDateString() : 'TBA',
            image: ev.image_url || 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&w=800',
            location: ev.location
          })));
        }

        // Fetch Student Activities
        const { data: activitiesData } = await supabase
          .from('student_activities')
          .select('*')
          .eq('school_id', schoolId)
          .order('created_at', { ascending: false });

        if (activitiesData) {
          setDynamicStudentActivities(activitiesData.map(act => ({
            id: act.id,
            name: act.name,
            description: act.description,
            icon: act.activity_type === 'Sports' ? 'fa-volleyball' :
              act.activity_type === 'Arts' ? 'fa-palette' :
                act.activity_type === 'Science' ? 'fa-flask' : 'fa-users',
            activity_type: act.activity_type,
            attachment_url: act.attachment_url
          })));
        }

        // Fetch Live Intel (For Institutional Logs)
        const { data: liveIntelData } = await supabase
          .from('live_intel')
          .select('*')
          .eq('school_id', schoolId)
          .order('created_at', { ascending: false });

        if (liveIntelData) {
          setDynamicLiveIntel(liveIntelData.map(intel => ({
            id: intel.id,
            title: intel.event_type || 'Update',
            content: intel.details?.log || 'No details available.',
            attachment_url: intel.attachment_url,
            date: intel.created_at ? new Date(intel.created_at).toLocaleTimeString() : 'Recent'
          })));
        }
      }
      setLastSyncTime(new Date().toLocaleTimeString());
    } catch (err) {
      console.error("Sync error", err);
      setDynamicAnnouncements([]);
    } finally {
      if (!isSilent) setIsLoading(false);
    }
  }, [schoolId, user.studentId, user.role, assignedCourseIds, assignedClassIds]);

  useEffect(() => {
    if (isLoggedIn) {
      performSmsSync(true);
      if (user.role === UserRole.PARENT) {
        setCurrentView('parent-portal');
      }
    }
  }, [isLoggedIn, user.role, schoolId, performSmsSync, assignedCourseIds, assignedClassIds]);

  const loadUserProfile = useCallback(async () => {
    if (!isLoggedIn || !supabase || !isSupabaseConfigured) return;

    if (user.role === UserRole.TEACHER) {
      // Load Teacher Profile
      let teacherQuery = supabase
        .from('teachers')
        .select('*')
        .or(`email.eq.${user.email},name.eq.${user.email}`);

      if (schoolId) teacherQuery = teacherQuery.eq('school_id', schoolId);

      const { data: teacher, error } = await teacherQuery.maybeSingle();

      if (error || !teacher) {
        console.error('Failed to load teacher profile', error?.message);
        return;
      }

      // Fetch assigned class_courses via join table
      const { data: assignmentJoins } = await supabase
        .from('class_course_teachers')
        .select(`
          class_course_id,
          class_courses (
            id,
            name,
            class_id
          )
        `)
        .eq('teacher_id', teacher.id)
        .eq('school_id', schoolId);

      const assignments = (assignmentJoins || [])
        .map((aj: any) => aj.class_courses)
        .filter(Boolean);

      if (assignments && assignments.length > 0) {
        setAssignedCourseIds(assignments.map((a: any) => a.id));
        setAssignedClassIds(Array.from(new Set(assignments.map((a: any) => a.class_id))));

        // Fetch class names for better display
        const classIds = Array.from(new Set(assignments.map((a: any) => a.class_id)));
        const { data: classNames } = await supabase
          .from('classes')
          .select('id, name')
          .in('id', classIds);

        setAssignedCoursesList(assignments.map((a: any) => ({
          id: a.id,
          name: a.name,
          classId: a.class_id,
          className: classNames?.find((c: any) => c.id === a.class_id)?.name || 'Unknown Class'
        })));
      } else {
        // Clear if no assignments
        setAssignedCourseIds([]);
        setAssignedClassIds([]);
        setAssignedCoursesList([]);
      }


      setUser(prev => ({
        ...prev,
        name: teacher.name || prev.name,
        email: teacher.email || prev.email,
        teacherId: String(teacher.id),
        schoolId: teacher.school_id || prev.schoolId,
        avatar: getStudentAvatarUrl(teacher.avatar) || prev.avatar,
        phone: teacher.phone || undefined,
        address: teacher.address || undefined
      }));
      return;
    }

    // Load Student Profile (Existing logic)
    let studentQuery = supabase
      .from('students')
      .select('id, name, avatar, email, attendanceRate, school_id, date_of_birth, parent_name, parent_number, parent_email, phone, address')
      .or(`email.eq.${user.email},name.eq.${user.email}`);

    if (schoolId) {
      studentQuery = studentQuery.eq('school_id', schoolId);
    }

    const { data: student, error } = await studentQuery.maybeSingle();

    if (error) {
      console.error('Failed to load student profile', error.message);
      return;
    }

    if (!student) return;

    // Fetch Student Enrollments (Classes and Courses)
    const { data: enrollments } = await supabase
      .from('class_course_students')
      .select('class_id, class_course_id, classes(name)')
      .eq('student_id', student.id)
      .eq('school_id', schoolId);

    const firstEnrollment = enrollments?.[0];
    const grade = (firstEnrollment?.classes as any)?.name || 'N/A';

    if (enrollments && enrollments.length > 0) {
      setAssignedCourseIds(enrollments.map(e => e.class_course_id));
      setAssignedClassIds(Array.from(new Set(enrollments.map(e => e.class_id))));
    } else {
      setAssignedCourseIds([]);
      setAssignedClassIds([]);
    }

    // Sync schoolId back to root if it's different
    if (student.school_id && student.school_id !== schoolId && onSchoolIdChange) {
      onSchoolIdChange(student.school_id);
    }

    const avatarUrl = getStudentAvatarUrl(student.avatar);
    const attendanceRate = formatAttendanceRate(student.attendanceRate);

    setStudentAttendanceRate(attendanceRate);

    setUser(prev => ({
      ...prev,
      name: student.name || prev.name,
      email: student.email || prev.email,
      studentId: student.id ? String(student.id) : prev.studentId,
      schoolId: student.school_id || prev.schoolId,
      avatar: avatarUrl || prev.avatar,
      dob: student.date_of_birth || undefined,
      grade: grade,
      parentName: student.parent_name || undefined,
      parentPhone: student.parent_number || undefined,
      parentEmail: student.parent_email || undefined,
      phone: student.phone || undefined,
      address: student.address || undefined
    }));
  }, [isLoggedIn, user.email, schoolId]);

  useEffect(() => {
    const fetchCourseTimetable = async () => {
      if (!selectedCourse?.id || !supabase || !schoolId) {
        setCourseTimetable([]);
        return;
      }
      setIsLoadingCourseTimetable(true);
      try {
        const { data, error } = await supabase
          .from('live_calendar_events')
          .select('*')
          .eq('course_id', selectedCourse.id)
          .eq('school_id', schoolId)
          .order('event_date', { ascending: true })
          .order('start_time', { ascending: true });

        if (error) throw error;
        setCourseTimetable(data || []);
      } catch (err) {
        console.error('Failed to fetch course timetable:', err);
      } finally {
        setIsLoadingCourseTimetable(false);
      }
    };
    if (currentView === 'course-detail') {
      void fetchCourseTimetable();
    }
  }, [selectedCourse?.id, schoolId, currentView]);

  useEffect(() => {
    if (user.role === UserRole.TEACHER && currentView === 'studies') {
      setCurrentView('dashboard');
    }
  }, [user.role, currentView]);

  useEffect(() => {
    void loadUserProfile();
  }, [loadUserProfile]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!isLoggedIn) {
      window.localStorage.removeItem(LOGIN_STORAGE_KEY);
      window.localStorage.removeItem(USER_STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(LOGIN_STORAGE_KEY, 'true');
    window.localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  }, [isLoggedIn, user]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(VIEWED_NOTICES_STORAGE_KEY, JSON.stringify(viewedNoticeIds));
  }, [viewedNoticeIds]);

  useEffect(() => {
    if (currentView !== 'notice-board' || dynamicAnnouncements.length === 0) return;

    const idsToMark = dynamicAnnouncements.map(notice => notice.id);
    setViewedNoticeIds(prev => Array.from(new Set([...prev, ...idsToMark])));
  }, [currentView, dynamicAnnouncements]);

  useEffect(() => {
    if (!isLoggedIn) return;
    const refreshInterval = window.setInterval(() => {
      void performSmsSync(true);
      void loadUserProfile();
    }, 10000);

    return () => window.clearInterval(refreshInterval);
  }, [isLoggedIn, performSmsSync, loadUserProfile]);

  useEffect(() => {
    if (!isLoggedIn || !supabase || !user.id) return;

    const fetchUnreadCount = async () => {
      const { count, error } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('receiver_id', user.id)
        .is('read_at', null);
      
      if (!error && count !== null) {
        setUnreadMessagesCount(count);
      }
    };

    void fetchUnreadCount();

    const channel = supabase
      .channel('global-unread-messages')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `receiver_id=eq."${user.id}"`
        },
        () => {
          void fetchUnreadCount();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [isLoggedIn, user.id]);

  const handleLogin = (role: Exclude<UserRole, UserRole.PARENT>, email: string, loginSchoolId?: string, recordId?: string, authUserId?: string) => {
    const newUser = {
      ...INITIAL_USER,
      id: recordId || authUserId || INITIAL_USER.id,
      role,
      email,
      name: INITIAL_USER.name,
      schoolId: loginSchoolId,
      studentId: role === UserRole.STUDENT ? recordId : undefined,
      teacherId: role === UserRole.TEACHER ? recordId : undefined,
      childId: undefined
    };
    setUser(newUser);
    setIsLoggedIn(true);
    if (loginSchoolId && onSchoolIdChange) {
      onSchoolIdChange(loginSchoolId);
    }
  };

  const executeHomeworkSubmission = async () => {
    if (!selectedAssignment || !user.studentId) return;
    setIsSubmitting(true);
    setShowSubmitConfirm(false);
    try {
      let submissionUrl = '';
      if (submissionFile && supabase) {
        const fileExt = submissionFile.name.split('.').pop();
        const fileName = `${user.studentId}/${selectedAssignment.id}_${Date.now()}.${fileExt}`;
        const { data, error: uploadError } = await supabase.storage
          .from('resources')
          .upload(fileName, submissionFile);

        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage.from('resources').getPublicUrl(fileName);
        submissionUrl = publicUrl;
      }

      if (supabase) {
        const { error: submitError } = await supabase
          .from('homework_submissions')
          .upsert({
            assignment_id: selectedAssignment.id,
            student_id: user.studentId,
            submission_url: submissionUrl,
            comment: submissionComment,
            school_id: schoolId
          });

        if (submitError) throw submitError;
      }

      setSubmissionStatus('success');
      setStatusMessage('Homework submitted successfully!');
      setTimeout(() => {
        setIsSubmissionModalOpen(false);
        setSubmissionStatus('idle');
        setSubmissionFile(null);
        setSubmissionComment('');
      }, 2000);

      void performSmsSync();
    } catch (err: any) {
      console.error('Submission error:', err);
      setSubmissionStatus('error');
      setStatusMessage('Failed to submit homework: ' + err.message);
      setTimeout(() => setSubmissionStatus('idle'), 4000);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveHomework = async () => {
    if (!homeworkTitle || !assignedCourseId || !schoolId || !supabase) return;
    setIsSavingTeacherData(true);
    try {
      let fileUrl = '';
      if (homeworkFile) {
        const fileExt = homeworkFile.name.split('.').pop();
        const fileName = `homework/${Date.now()}_${homeworkFile.name}`;
        const { error: uploadError } = await supabase.storage
          .from('homework_files')
          .upload(fileName, homeworkFile);

        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage.from('homework_files').getPublicUrl(fileName);
        fileUrl = publicUrl;
      }

      const selectedCourse = assignedCoursesList.find(c => c.id === assignedCourseId);

      const { error: saveError } = await supabase
        .from('homework_assignments')
        .insert([{
          title: homeworkTitle,
          description: homeworkDescription,
          due_date: homeworkDueDate || null,
          class_course_id: assignedCourseId,
          class_id: selectedCourse?.classId,
          class_name: selectedCourse?.className,
          course_name: selectedCourse?.name,
          school_id: schoolId,
          attachment_url: fileUrl,
          file_url: fileUrl
        }]);

      if (saveError) throw saveError;

      setIsHomeworkComposerOpen(false);
      setConfirmDialog({
        title: 'Success',
        message: 'Homework assignment created successfully!',
        onConfirm: () => setConfirmDialog(null),
        type: 'info'
      });
      void performSmsSync(true);
    } catch (err: any) {
      console.error('Error saving homework:', err);
      alert('Failed to save homework: ' + err.message);
    } finally {
      setIsSavingTeacherData(false);
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName || !selectedCourse || !schoolId || !supabase) return;
    setIsSavingTeacherData(true);
    try {
      const { error } = await supabase
        .from('resources_buckets')
        .insert([{
          name: newFolderName,
          school_id: schoolId,
          class_id: selectedClass?.id || null,
          class_course_id: selectedCourse.id,
          metadata: {
            type: 'folder',
            content: 'Resource folder for ' + selectedCourse.title,
            folder: null
          }
        }]);

      if (error) throw error;

      setIsCreateFolderModalOpen(false);
      setNewFolderName('');
      setConfirmDialog({
        title: 'Folder Created',
        message: `"${newFolderName}" is now available for resources.`,
        onConfirm: () => setConfirmDialog(null),
        type: 'info'
      });

      // Refresh course resources
      const updatedNotes = await fetchCourseResources(schoolId, selectedClass?.id || '', selectedCourse.id);
      setSelectedCourse(prev => prev ? { ...prev, notes: updatedNotes } : null);
    } catch (err: any) {
      console.error('Error creating folder:', err);
      alert('Failed to create folder: ' + err.message);
    } finally {
      setIsSavingTeacherData(false);
    }
  };

  const handleUploadResource = async () => {
    if (!resourceTitle || !resourceFile || !selectedCourse || !schoolId || !supabase) {
      alert('Please provide a title and select a file to upload.');
      return;
    }
    setIsSavingTeacherData(true);
    try {
      const fileExt = resourceFile.name.split('.').pop();
      const fileName = `resources/${Date.now()}_${resourceFile.name}`;
      const { error: uploadError } = await supabase.storage
        .from('resources')
        .upload(fileName, resourceFile);

      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('resources').getPublicUrl(fileName);

      const { error: saveError } = await supabase
        .from('resources_buckets')
        .insert([{
          name: resourceTitle,
          school_id: schoolId,
          class_id: selectedClass?.id || null,
          class_course_id: selectedCourse.id,
          image_url: publicUrl,
          metadata: {
            type: 'file',
            content: resourceContent,
            file_url: publicUrl,
            folder: selectedUploadFolder || null,
            size: resourceFile.size
          }
        }]);

      if (saveError) throw saveError;

      setIsUploadResourceModalOpen(false);
      setResourceTitle('');
      setResourceContent('');
      setResourceFile(null);
      setSelectedUploadFolder('');
      setConfirmDialog({
        title: 'Resource Uploaded',
        message: `"${resourceTitle}" has been added to the course library.`,
        onConfirm: () => setConfirmDialog(null),
        type: 'info'
      });

      // Refresh course resources
      const updatedNotes = await fetchCourseResources(schoolId, selectedClass?.id || '', selectedCourse.id);
      setSelectedCourse(prev => prev ? { ...prev, notes: updatedNotes } : null);
    } catch (err: any) {
      console.error('Error uploading resource:', err);
      alert('Failed to upload resource: ' + err.message);
    } finally {
      setIsSavingTeacherData(false);
    }
  };

  const handleSaveNotice = async () => {
    if (!noticeTitle || !schoolId || !supabase) return;

    // VALIDATION: Teachers MUST pick at least one class/course
    if (user.role === UserRole.TEACHER && selectedNoticeTargets.length === 0) {
      alert('Please select at least one target Class and Course for this announcement.');
      return;
    }

    setIsSavingTeacherData(true);
    try {
      let fileUrl = '';
      if (noticeFile) {
        const fileName = `notices/${Date.now()}_${noticeFile.name}`;
        const { error: uploadError } = await supabase.storage
          .from('notice_files')
          .upload(fileName, noticeFile);

        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage.from('notice_files').getPublicUrl(fileName);
        fileUrl = publicUrl;
      }

      // Prepare bulk payload
      const insertPayload = selectedNoticeTargets.length > 0
        ? selectedNoticeTargets.map(t => ({
          title: noticeTitle,
          message: noticeMessage,
          notice_date: noticeDate,
          priority: noticePriority.toLowerCase(),
          school_id: schoolId,
          attachment_url: fileUrl,
          class_id: t.classId,
          class_course_id: t.courseId,
          created_by: user.id
        }))
        : [{
          title: noticeTitle,
          message: noticeMessage,
          notice_date: noticeDate,
          priority: noticePriority.toLowerCase(),
          school_id: schoolId,
          attachment_url: fileUrl,
          class_id: null,
          class_course_id: null,
          created_by: user.id
        }];

      const { error: saveError } = await supabase
        .from('class_announcements')
        .insert(insertPayload);

      if (saveError) throw saveError;

      setIsNoticeComposerOpen(false);
      setNoticeTitle('');
      setNoticeMessage('');
      setNoticeDate(new Date().toISOString().split('T')[0]);
      setNoticePriority('Medium');
      setNoticeFile(null);
      setSelectedNoticeTargets([]);

      setConfirmDialog({
        title: 'Success',
        message: 'Announcement published successfully!',
        onConfirm: () => setConfirmDialog(null),
        type: 'info'
      });
      void performSmsSync(true);
    } catch (err: any) {
      console.error('Error saving notice:', err);
      alert('Failed to save notice: ' + err.message);
    } finally {
      setIsSavingTeacherData(false);
    }
  };

  const handleDeleteNotice = async (noticeId: string) => {
    if (!supabase) return;

    setConfirmDialog({
      title: 'Delete Announcement?',
      message: 'This action cannot be undone.',
      onConfirm: async () => {
        setIsLoading(true);
        try {
          if (!supabase) throw new Error("Supabase client not initialized");
          const { error } = await supabase
            .from('class_announcements')
            .delete()
            .eq('id', noticeId);

          if (error) throw error;

          setConfirmDialog({
            title: 'Deleted',
            message: 'Announcement has been removed.',
            onConfirm: () => setConfirmDialog(null),
            type: 'info'
          });
          void performSmsSync(true);
        } catch (err: any) {
          console.error('Error deleting notice:', err);
          alert('Failed to delete notice: ' + err.message);
        } finally {
          setIsLoading(false);
        }
      },
      type: 'confirm'
    });
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user.studentId || !supabase) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file.');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('File size exceeds 5MB limit.');
      return;
    }

    setUploadingAvatar(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.studentId}_${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('student_profile')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { error: updateError } = await supabase
        .from('students')
        .update({ avatar: filePath })
        .eq('id', user.studentId);

      if (updateError) throw updateError;

      // Refresh user profile
      await loadUserProfile();
      alert('Profile picture updated successfully!');
    } catch (err: any) {
      console.error('Error uploading avatar:', err);
      alert('Failed to upload profile picture: ' + err.message);
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setUser(INITIAL_USER);
    setSelectedCourse(null);
    setSelectedNotice(null);
    setActiveQuiz(null);
    setCurrentView('dashboard');
    setIsSidebarOpen(false);
  };

  const fetchCourseResources = async (schoolId: string, classId: string, courseId: string): Promise<Note[]> => {
    if (!supabase || !isSupabaseConfigured) return [];
    try {
      const { data, error } = await supabase
        .from('resources_buckets')
        .select('*')
        .eq('school_id', schoolId)
        .eq('class_id', classId)
        .eq('class_course_id', courseId);

      if (error) {
        console.error('[Resources] Fetch error:', error);
        return [];
      }

      return (data || []).map(res => ({
        id: res.id,
        title: res.name || 'Untitled Resource',
        content: (res.metadata as any)?.content || ((res.metadata as any).type === 'folder' ? 'This is a resource folder containing learning materials.' : ''),
        ebookUrl: (res.metadata as any)?.file_url || res.image_url,
        createdAt: res.created_at || new Date().toISOString(),
        type: (res.metadata as any)?.type || 'file',
        folder: (res.metadata as any)?.folder || null,
        size: (res.metadata as any)?.size || 0
      } as any));
    } catch (err) {
      console.error('[Resources] unexpected error:', err);
      return [];
    }
  };

  const toggleFolder = (folderName: string) => {
    setOpenFolders(prev => {
      const next = new Set(prev);
      if (next.has(folderName)) next.delete(folderName);
      else next.add(folderName);
      return next;
    });
  };

  const handleCourseClick = async (course: Course) => {
    setSelectedCourse(course);
    setCurrentView('course-detail');

    if (schoolId && selectedClass?.id) {
      const liveResources = await fetchCourseResources(schoolId, selectedClass.id, course.id);
      if (liveResources.length > 0) {
        // Update both the courses list and the active selection to show live data
        setCourses(prev => prev.map(c => c.id === course.id ? { ...c, notes: liveResources } : c));
        setSelectedCourse(prev => prev?.id === course.id ? { ...prev, notes: liveResources } : prev);
      }
    }
  };

  const handleNoticeOpen = (notice: NoticeItem, origin: 'notice-board' | 'instruction') => {
    setSelectedNotice(notice);
    setNoticeOriginView(origin);
    setCurrentView('notice-detail');
  };

  const handleSummarize = async (note: Note) => {
    setIsLoading(true);
    const summary = await summarizeNotes(note.content);
    setCourses(prev => prev.map(c => {
      if (c.id === selectedCourse?.id) {
        return {
          ...c,
          notes: c.notes.map(n => n.id === note.id ? { ...n, summary } : n)
        };
      }
      return c;
    }));
    setIsLoading(false);
  };

  const handleGenerateQuiz = async (note: Note) => {
    if (!selectedCourse) return;
    setIsLoading(true);
    const questions = await generateQuizFromNotes(note.content);
    const newQuiz: Quiz = {
      id: `q-${Date.now()}`,
      title: `Quiz: ${note.title}`,
      questions,
      courseId: selectedCourse.id
    };
    setCourses(prev => prev.map(c => {
      if (c.id === selectedCourse.id) {
        return { ...c, quizzes: [...c.quizzes, newQuiz] };
      }
      return c;
    }));
    setActiveQuiz(newQuiz);
    setCurrentView('quiz-player');
    setIsLoading(false);
  };

  const renderParentPortal = () => {
    if (!reportCard) return null;
    return (
      <div className="space-y-12 animate-fadeIn text-slate-100 pb-20">
        <header className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 border-b border-[#1f4e4a] pb-8">
          <div className="space-y-2">
            <h2 className="text-4xl font-black text-white uppercase tracking-tighter">Parental Oversight</h2>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#4ea59d]/20 flex items-center justify-center text-[#4ea59d]">
                <i className="fa-solid fa-child-reaching"></i>
              </div>
              <div>
                <p className="text-[#4ea59d] font-black text-[10px] uppercase tracking-[0.2em]">Student Record: {user.name}</p>
                <p className="text-slate-400 text-[9px] font-bold uppercase tracking-widest">{reportCard.term} Academic Session</p>
              </div>
            </div>
          </div>
          <div className="flex gap-4">
            <button className="px-6 py-3 bg-[#4ea59d]/10 border border-[#4ea59d]/20 text-[#4ea59d] rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-[#4ea59d] hover:text-white transition-all">
              <i className="fa-solid fa-cloud-arrow-down mr-2"></i> Download Full Report
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white/10 backdrop-blur-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] p-8 rounded-[32px] border border-white/20 text-center">
            <p className="text-[10px] font-black text-[#4ea59d] uppercase tracking-widest mb-2">Overall Grade Percentage</p>
            <p className="text-4xl font-black text-white">{reportCard.gpa}</p>
          </div>
          <div className="bg-white/10 backdrop-blur-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] p-8 rounded-[32px] border border-white/20 text-center">
            <p className="text-[10px] font-black text-[#4ea59d] uppercase tracking-widest mb-2">Class Rank</p>
            <p className="text-4xl font-black text-white">{reportCard.rank}</p>
          </div>
          <div className="bg-white/10 backdrop-blur-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] p-8 rounded-[32px] border border-white/20 text-center">
            <p className="text-[10px] font-black text-[#4ea59d] uppercase tracking-widest mb-2">Attendance</p>
            <p className="text-4xl font-black text-white">{reportCard.attendance}</p>
          </div>
          <div className="bg-[#4ea59d] p-8 rounded-[32px] text-center shadow-xl shadow-[#4ea59d]/20">
            <p className="text-[10px] font-black text-white/70 uppercase tracking-widest mb-2">Standing</p>
            <p className="text-4xl font-black text-white uppercase">Elite</p>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-12">
          <div className="xl:col-span-2 bg-white/10 backdrop-blur-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] rounded-[40px] border border-white/20 overflow-hidden shadow-2xl">
            <div className="p-8 border-b border-[#1f4e4a] bg-[#0a1a19]">
              <h3 className="text-xl font-black text-white uppercase tracking-tight">Academic Performance breakdown</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-[#0a1a19]/50">
                  <tr>
                    <th className="px-8 py-5 text-[10px] font-black text-[#4ea59d] uppercase tracking-widest">Subject</th>
                    <th className="px-8 py-5 text-[10px] font-black text-[#4ea59d] uppercase tracking-widest">Grade</th>
                    <th className="px-8 py-5 text-[10px] font-black text-[#4ea59d] uppercase tracking-widest">Faculty Feedback</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1f4e4a]">
                  {reportCard.subjects.map((sub, i) => (
                    <tr key={i} className="hover:bg-[#0a1a19]/[0.02] transition-colors">
                      <td className="px-8 py-6">
                        <p className="font-bold text-white text-sm">{sub.name}</p>
                        <div className="w-32 h-1 bg-[#1f4e4a] rounded-full mt-2 overflow-hidden">
                          <div className="h-full bg-[#4ea59d]" style={{ width: `${sub.score}%` }}></div>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <span className="text-xl font-black text-[#4ea59d]">{sub.grade}</span>
                        <span className="ml-2 text-[9px] text-slate-400 font-bold uppercase">{sub.score}%</span>
                      </td>
                      <td className="px-8 py-6 text-xs text-slate-400 font-medium leading-relaxed max-w-sm">
                        "{sub.comment}"
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-8">
            <section className="bg-white/10 backdrop-blur-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] p-8 rounded-[40px] border border-white/20 shadow-xl">
              <h3 className="text-lg font-black text-white uppercase tracking-tight mb-8 flex items-center gap-3">
                <i className="fa-solid fa-wand-magic-sparkles text-[#4ea59d]"></i> AI Insight for Parents
              </h3>
              <div className="p-6 bg-[#4ea59d]/5 rounded-[32px] border border-[#4ea59d]/20 ">
                <p className="text-xs text-slate-300 leading-relaxed">
                  "Alex is demonstrating exceptional mastery in <strong>theoretical sciences</strong>. While their Data Structures performance is strong (88%), our AI analysis suggests focusing on <strong>recursion logic</strong> to reach the top percentile. Overall performance is in the <strong>top 4%</strong> of the cohort."
                </p>
              </div>
            </section>

            <section className="bg-white/10 backdrop-blur-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] p-8 rounded-[40px] border border-white/20 shadow-xl">
              <h3 className="text-lg font-black text-white uppercase tracking-tight mb-8">Contact Faculty</h3>
              <div className="space-y-4">
                <button className="w-full py-4 bg-[#0a1a19] border border-white/20 rounded-2xl flex items-center gap-4 px-6 group hover:border-[#4ea59d] transition-all">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center text-xs">
                    <i className="fa-solid fa-message"></i>
                  </div>
                  <span className="text-[10px] font-black text-white uppercase tracking-widest">Message Head Teacher</span>
                </button>
                <button className="w-full py-4 bg-[#0a1a19] border border-white/20 rounded-2xl flex items-center gap-4 px-6 group hover:border-[#4ea59d] transition-all">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center text-xs">
                    <i className="fa-solid fa-video"></i>
                  </div>
                  <span className="text-[10px] font-black text-white uppercase tracking-widest">Schedule PTM Meeting</span>
                </button>
              </div>
            </section>
          </div>
        </div>
      </div>
    );
  };

  const renderTimetable = () => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const monthName = calendarDate.toLocaleString('default', { month: 'long' });
    const year = calendarDate.getFullYear();

    const getEventsForDate = (date: Date) => {
      const d = date.getDate();
      const m = date.toLocaleString('default', { month: 'long' });
      const dateStr = `${m} ${d < 10 ? '0' + d : d}`;
      return {
        exams: dynamicExams.filter(ex => ex.date.includes(dateStr)),
        assignments: dynamicAssignments.filter(ass => ass.dueDate.includes(dateStr))
      };
    };

    const handlePrev = () => {
      const d = new Date(calendarDate);
      if (calendarSubView === 'month') d.setMonth(d.getMonth() - 1);
      else if (calendarSubView === 'week') d.setDate(d.getDate() - 7);
      else d.setDate(d.getDate() - 1);
      setCalendarDate(d);
    };

    const handleNext = () => {
      const d = new Date(calendarDate);
      if (calendarSubView === 'month') d.setMonth(d.getMonth() + 1);
      else if (calendarSubView === 'week') d.setDate(d.getDate() + 7);
      else d.setDate(d.getDate() + 1);
      setCalendarDate(d);
    };

    const renderMonthGrid = () => {
      const daysInMonth = new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 0).getDate();
      const firstDay = new Date(calendarDate.getFullYear(), calendarDate.getMonth(), 1).getDay();
      const grid = [];
      for (let i = 0; i < firstDay; i++) grid.push(null);
      for (let i = 1; i <= daysInMonth; i++) grid.push(new Date(calendarDate.getFullYear(), calendarDate.getMonth(), i));

      return (
        <div className="bg-white/10 backdrop-blur-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] rounded-[32px] border border-white/20 overflow-hidden shadow-2xl min-w-[700px]">
          <div className="grid grid-cols-7 border-b border-[#1f4e4a] bg-[#0a1a19]">
            {days.map(day => <div key={day} className="py-4 text-center text-[10px] font-black uppercase tracking-widest text-slate-400">{day}</div>)}
          </div>
          <div className="grid grid-cols-7">
            {grid.map((date, idx) => {
              if (!date) return <div key={`empty-${idx}`} className="h-32 border-b border-r border-[#1f4e4a] bg-[#0a1a19]/30"></div>;
              const { exams, assignments } = getEventsForDate(date);
              const isToday = date.getDate() === 26 && date.getMonth() === 3;
              return (
                <div key={idx} className={`h-32 border-b border-r border-[#1f4e4a] p-3 transition-colors hover:bg-[#4ea59d]/5 relative group ${isToday ? 'bg-[#4ea59d]/5' : ''}`}>
                  <span className={`text-[10px] font-black ${isToday ? 'bg-[#4ea59d] text-white w-6 h-6 flex items-center justify-center rounded-full' : 'text-slate-400'}`}>{date.getDate()}</span>
                  <div className="mt-2 space-y-1">
                    {exams.map((ex, i) => <div key={i} className="px-1.5 py-0.5 bg-orange-500/10 border border-orange-500/20 rounded text-[8px] font-black text-orange-500 truncate uppercase">{ex.subject}</div>)}
                    {assignments.map((as, i) => <div key={i} className="px-1.5 py-0.5 bg-purple-500/10 border border-purple-500/20 rounded text-[8px] font-black text-purple-500 truncate uppercase">{as.title}</div>)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    };

    const renderWeekGrid = () => {
      const startOfWeek = new Date(calendarDate);
      startOfWeek.setDate(calendarDate.getDate() - calendarDate.getDay());
      const weekDates = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(startOfWeek);
        d.setDate(startOfWeek.getDate() + i);
        return d;
      });
      const hours = Array.from({ length: 13 }, (_, i) => i + 8);

      return (
        <div className="bg-white/10 backdrop-blur-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] rounded-[32px] border border-white/20 overflow-hidden shadow-2xl min-w-[800px]">
          <div className="grid grid-cols-[80px_repeat(7,1fr)] border-b border-[#1f4e4a] bg-[#0a1a19]">
            <div className="p-4"></div>
            {weekDates.map((date, i) => (
              <div key={i} className="py-4 text-center border-l border-[#1f4e4a]">
                <div className="text-[10px] font-black uppercase text-slate-400">{days[i]}</div>
                <div className="text-sm font-black text-white">{date.getDate()}</div>
              </div>
            ))}
          </div>
          <div className="max-h-[500px] overflow-y-auto custom-scrollbar">
            {hours.map(hour => (
              <div key={hour} className="grid grid-cols-[80px_repeat(7,1fr)] border-b border-[#1f4e4a]/50">
                <div className="p-4 text-[10px] font-black text-slate-400 text-right uppercase">{hour > 12 ? hour - 12 : hour} {hour >= 12 ? 'PM' : 'AM'}</div>
                {weekDates.map((date, i) => {
                  const { exams } = getEventsForDate(date);
                  const isToday = date.getDate() === 26 && date.getMonth() === 3;
                  return (
                    <div key={i} className={`h-20 border-l border-[#1f4e4a] p-1 relative ${isToday ? 'bg-[#4ea59d]/5' : ''}`}>
                      {hour === 10 && exams.length > 0 && (
                        <div className="absolute inset-x-1 top-1 bottom-1 bg-orange-500/20 border-l-4 border-orange-500 p-1 rounded overflow-hidden">
                          <p className="text-[7px] font-black text-orange-500 uppercase leading-none">Exam</p>
                          <p className="text-[9px] font-bold text-white truncate mt-1">{exams[0].subject}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      );
    };

    const renderDayGrid = () => {
      const hours = Array.from({ length: 15 }, (_, i) => i + 7);
      const { exams, assignments } = getEventsForDate(calendarDate);
      return (
        <div className="bg-white/10 backdrop-blur-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] rounded-[32px] border border-white/20 overflow-hidden shadow-2xl max-w-3xl mx-auto">
          <div className="p-6 bg-[#0a1a19] border-b border-[#1f4e4a] flex justify-between items-center">
            <h3 className="text-xl font-black uppercase tracking-tighter text-white">{days[calendarDate.getDay()]}, {monthName} {calendarDate.getDate()}</h3>
            <span className="text-[10px] font-black text-[#4ea59d] uppercase tracking-widest">Today's Focus</span>
          </div>
          <div className="p-6 space-y-6">
            {hours.map(hour => {
              const hasExam = hour === 10 && exams.length > 0;
              const hasAssignment = hour === 18 && assignments.length > 0;
              return (
                <div key={hour} className="flex gap-6 group">
                  <div className="w-16 text-right shrink-0 py-1 text-[10px] font-black text-slate-400 uppercase">{hour > 12 ? hour - 12 : hour} {hour >= 12 ? 'PM' : 'AM'}</div>
                  <div className="flex-1 min-h-[60px] border-l-2 border-[#1f4e4a] pl-6 relative pb-6">
                    <div className="absolute -left-[5px] top-2 w-2 h-2 rounded-full bg-[#1f4e4a] group-hover:bg-[#4ea59d] transition-colors"></div>
                    {hasExam && (
                      <div className="bg-orange-500/10 border border-orange-500/20 p-4 rounded-2xl animate-slideIn">
                        <div className="flex justify-between items-start">
                          <h4 className="text-sm font-black text-orange-500 uppercase">Exam: {exams[0].subject}</h4>
                        </div>
                        <p className="text-xs text-slate-400 mt-1"><i className="fa-solid fa-location-dot mr-1"></i> {exams[0].venue}</p>
                      </div>
                    )}
                    {hasAssignment && (
                      <div className="bg-purple-500/10 border border-purple-500/20 p-4 rounded-2xl animate-slideIn">
                        <h4 className="text-sm font-black text-purple-500 uppercase">Assignment: {assignments[0].title}</h4>
                        <p className="text-xs text-slate-400 mt-1"><i className="fa-solid fa-clock mr-1"></i> Submission Deadline</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    };

    return (
      <div className="space-y-8 animate-fadeIn text-slate-100 pb-20">
        <header className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 border-b border-[#1f4e4a] pb-8">
          <div className="space-y-2">
            <h2 className="text-3xl md:text-4xl font-black text-white uppercase tracking-tighter ">Calendar Studio</h2>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#4ea59d] animate-pulse"></span>
              <p className="text-[#4ea59d]/60 font-black text-[10px] uppercase tracking-[0.4em]">Interactive Campus Timeline</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex bg-white/10 backdrop-blur-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] p-1 rounded-2xl border border-white/20">
              {(['day', 'week', 'month'] as const).map(v => (
                <button
                  key={v}
                  onClick={() => setCalendarSubView(v)}
                  className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${calendarSubView === v ? 'bg-[#4ea59d] text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                >
                  {v}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-4 bg-white/10 backdrop-blur-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] p-2 rounded-2xl border border-white/20">
              <button onClick={handlePrev} className="w-8 h-8 rounded-lg hover:bg-[#1f4e4a] flex items-center justify-center transition-all"><i className="fa-solid fa-chevron-left text-xs"></i></button>
              <span className="text-xs font-black uppercase tracking-widest px-2">{calendarSubView === 'day' ? `${monthName} ${calendarDate.getDate()}` : `${monthName} ${year}`}</span>
              <button onClick={handleNext} className="w-8 h-8 rounded-lg hover:bg-[#1f4e4a] flex items-center justify-center transition-all"><i className="fa-solid fa-chevron-right text-xs"></i></button>
            </div>
          </div>
        </header>

        <div className="overflow-x-auto pb-4 custom-scrollbar">
          {calendarSubView === 'month' && renderMonthGrid()}
          {calendarSubView === 'week' && renderWeekGrid()}
          {calendarSubView === 'day' && renderDayGrid()}
        </div>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white/10 backdrop-blur-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] p-8 rounded-[32px] border border-white/20 shadow-xl md:col-span-2">
            <h3 className="text-lg font-black text-white uppercase tracking-tight mb-8 flex items-center gap-4">
              <i className="fa-solid fa-calendar-check text-[#4ea59d]"></i> Summary of Events
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {dynamicExams.map((ex, i) => (
                <div key={i} className="p-5 bg-[#0a1a19] rounded-3xl border border-white/20 group hover:border-orange-500/50 transition-all">
                  <div className="flex justify-between items-start mb-3">
                    <span className="text-[8px] font-black px-2 py-1 bg-orange-500/10 text-orange-500 rounded uppercase tracking-widest">Exam</span>
                    <span className="text-[9px] font-black text-slate-300 uppercase">{ex.date}</span>
                  </div>
                  <h4 className="text-sm font-bold text-white group-hover:text-orange-500 transition-colors">{ex.subject}</h4>
                  <p className="text-[10px] text-slate-400 font-bold uppercase mt-2 "><i className="fa-solid fa-clock mr-1"></i> {ex.time}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-[#4ea59d]/5 border border-[#4ea59d]/20 p-8 rounded-[32px] flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-16 h-16 bg-[#4ea59d] rounded-full flex items-center justify-center text-white shadow-2xl shadow-[#4ea59d]/40">
              <i className="fa-solid fa-plus text-2xl"></i>
            </div>
            <h4 className="text-lg font-black text-white uppercase tracking-tight">Sync Schedules</h4>
            <p className="text-xs text-[#4ea59d] font-bold leading-relaxed">Connect your external calendar to auto-import course modules and assignment deadlines.</p>
            <button className="w-full py-4 bg-[#4ea59d] text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl">Link Account</button>
          </div>
        </section>
      </div>
    );
  };

  const renderDashboard = () => {
    let academicScore = 92;
    let standingText = 'Excellent';

    try {
      const attendanceNum = parseFloat(studentAttendanceRate.replace('%', '')) || 0;

      const parsedPercentages = examResultsData
        .map(g => g.percentage)
        .filter(p => p !== null && p !== undefined && p !== '')
        .map(p => parseFloat(String(p)))
        .filter(n => !isNaN(n));

      if (parsedPercentages.length > 0) {
        const avgGrade = parsedPercentages.reduce((a, b) => a + b, 0) / parsedPercentages.length;
        academicScore = Math.round((attendanceNum + avgGrade) / 2);
      } else {
        academicScore = Math.round(attendanceNum);
      }

      if (academicScore >= 90) standingText = 'Excellent';
      else if (academicScore >= 80) standingText = 'Good';
      else if (academicScore >= 70) standingText = 'Satisfactory';
      else if (academicScore >= 60) standingText = 'Pass';
      else standingText = 'Needs Improvement';
    } catch (e) {
      console.error('Error calculating academic standing', e);
    }

    return (
      <div className="space-y-8 animate-fadeIn text-slate-100 pb-10">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-3xl font-black text-white uppercase tracking-tight ">Dashboard Central</h2>
            <p className="text-[#4ea59d]/60 text-[10px] font-black uppercase tracking-[0.4em]">Academic Overview</p>
          </div>
          <div className="flex items-center gap-4">
            {lastSyncTime && (
              <div className="hidden sm:flex flex-col items-end">
                <span className="text-[8px] font-black uppercase text-[#4ea59d]">SMS System Linked</span>
                <span className="text-[8px] text-slate-400">Last Sync: {lastSyncTime}</span>
              </div>
            )}
          </div>
        </header>

        {/* Live Intel Ticker */}
        {dynamicLiveIntel.length > 0 && (
          <div
            onClick={() => {
              setSelectedLiveIntel(dynamicLiveIntel[0]);
              setCurrentView('live-intel-detail');
            }}
            className="bg-emerald-500/10 border-l-4 border-emerald-500 p-4 rounded-2xl flex items-center gap-4 animate-fadeIn cursor-pointer hover:bg-emerald-500/20 transition-all group"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-500 shrink-0 group-hover:scale-110 transition-transform">
              <i className="fa-solid fa-bolt-lightning animate-pulse"></i>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1">Live Intel Update • {dynamicLiveIntel[0].date}</p>
              <h4 className="text-sm font-bold text-white truncate flex items-center gap-2">
                {dynamicLiveIntel[0].title}
                <i className="fa-solid fa-chevron-right text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"></i>
              </h4>
            </div>
          </div>
        )}

        {/* Messaging Notification Ticker */}
        {unreadMessagesCount > 0 && (
          <div
            onClick={() => setCurrentView('contact')}
            className="bg-rose-500/10 border-l-4 border-rose-500 p-4 rounded-2xl flex items-center justify-between gap-4 animate-bounce hover:bg-rose-500/20 transition-all cursor-pointer group shadow-lg shadow-rose-500/5"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-rose-500/20 flex items-center justify-center text-rose-500 shrink-0 group-hover:rotate-12 transition-transform">
                <i className="fa-solid fa-envelope-open-text"></i>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest mb-1">Secured Communications</p>
                <h4 className="text-sm font-bold text-white truncate flex items-center gap-2">
                  You have {unreadMessagesCount} unread {unreadMessagesCount === 1 ? 'message' : 'messages'}
                </h4>
              </div>
            </div>
            <span className="px-4 py-1.5 bg-rose-500 text-white rounded-full text-[10px] font-black uppercase tracking-widest shadow-xl">
              Open Vault
            </span>
          </div>
        )}

        {/* Metric Row */}
        {user.role !== UserRole.TEACHER && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-[#4ea59d] p-8 rounded-[32px] text-white shadow-xl relative overflow-hidden md:col-span-2 group">
              <div className="relative z-10">
                <h3 className="text-[10px] font-black opacity-80 uppercase tracking-[0.2em] text-white">Academic Standing</h3>
                <p className="text-5xl font-black my-4 text-white uppercase ">{standingText}</p>
                <div className="mt-4 flex items-center gap-4">
                  <div className="h-2 flex-1 bg-[#0a1a19]/20 rounded-full overflow-hidden">
                    <div className="h-full bg-[#0a1a19]" style={{ width: `${academicScore}%` }}></div>
                  </div>
                  <span className="text-sm font-bold text-white">{academicScore}%</span>
                </div>
              </div>
              <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-[#0a1a19]/10 rounded-full blur-3xl group-hover:scale-110 transition-transform duration-700"></div>
            </div>

            <div className="bg-white/10 backdrop-blur-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] p-8 rounded-[32px] border border-white/20 flex flex-col justify-center">
              <h3 className="text-[10px] font-black text-[#4ea59d] uppercase tracking-[0.2em]">Attendance</h3>
              <p className="text-4xl font-black text-white my-2">{studentAttendanceRate}</p>
              <div className="flex items-center gap-2 text-[#4ea59d]/60 text-[10px] font-bold">
                <i className="fa-solid fa-arrow-up"></i>
                <span>2% Improvement</span>
              </div>
            </div>
          </div>
        )}

        <section className="bg-white/10 backdrop-blur-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] p-8 rounded-[40px] border border-white/20 shadow-2xl relative overflow-hidden">
          <div className="flex items-center justify-between mb-8 relative z-10">
            <h3 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-4">
              <div className="w-10 h-10 rounded-2xl bg-[#4ea59d]/10 flex items-center justify-center">
                <i className="fa-solid fa-bell text-[#4ea59d] animate-swing"></i>
              </div>
              Recent Notifications
            </h3>
            <button className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-[#4ea59d] transition-colors">
              Mark all as read
            </button>
          </div>

          <div className="space-y-4 relative z-10 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
            {[
              ...dynamicExams.slice(0, 1).map(ex => ({
                id: `ex-${ex.id}`,
                title: 'Exam Assigned',
                desc: `${ex.subject} exam on ${ex.date}.`,
                time: 'Recent',
                icon: 'fa-calendar-check',
                color: 'text-orange-500',
                bg: 'bg-orange-500/10'
              })),
              ...examResultsData.slice(0, 1).map(res => ({
                id: `res-${res.courseName}`,
                title: 'Grade Released',
                desc: `Your grade for ${res.courseName} is ${res.grade}.`,
                time: 'New',
                icon: 'fa-file-invoice',
                color: 'text-blue-500',
                bg: 'bg-blue-500/10'
              })),
              ...dynamicAssignments.slice(0, 1).map(ass => ({
                id: `ass-${ass.id}`,
                title: 'Homework Assigned',
                desc: `${ass.title} due ${ass.dueDate}.`,
                time: 'Pending',
                icon: 'fa-tasks',
                color: 'text-purple-500',
                bg: 'bg-purple-500/10'
              })),
              ...dynamicSchoolEvents.slice(0, 1).map(ev => ({
                id: `ev-${ev.id}`,
                title: 'Campus Event',
                desc: `${ev.name} happening on ${ev.date}.`,
                time: 'Upcoming',
                icon: 'fa-champagne-glasses',
                color: 'text-emerald-500',
                bg: 'bg-emerald-500/10'
              })),
              ...dynamicStudentActivities.slice(0, 1).map(act => ({
                id: `act-${act.id}`,
                title: 'New Activity',
                desc: `Join the ${act.name} ${act.activity_type}!`,
                time: 'Activity',
                icon: 'fa-masks-theater',
                color: 'text-purple-500',
                bg: 'bg-purple-500/10'
              })),
            ].map((notif) => (
              <div key={notif.id} className="p-5 bg-[#0a1a19] rounded-3xl border border-white/20 flex items-center gap-6 hover:border-[#4ea59d] transition-all cursor-pointer group">
                <div className={`w-12 h-12 rounded-2xl ${notif.bg} ${notif.color} flex items-center justify-center text-xl shrink-0 group-hover:scale-110 transition-transform`}>
                  <i className={`fa-solid ${notif.icon}`}></i>
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-start">
                    <h4 className="text-sm font-bold text-white mb-1">{notif.title}</h4>
                    <span className="text-[9px] font-black text-slate-300 uppercase">{notif.time}</span>
                  </div>
                  <p className="text-xs text-slate-400 font-medium">{notif.desc}</p>
                </div>
                <div className="w-2 h-2 rounded-full bg-[#4ea59d] opacity-0 group-hover:opacity-100 transition-opacity"></div>
              </div>
            ))}
            {dynamicExams.length === 0 && examResultsData.length === 0 && dynamicAssignments.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-10">No recent notifications.</p>
            )}
          </div>
          <div className="absolute top-0 right-0 w-64 h-64 bg-[#4ea59d]/5 blur-[100px] pointer-events-none"></div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <section className="bg-white/10 backdrop-blur-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] p-8 rounded-[40px] border border-white/20 shadow-xl">
            <h3 className="text-xl font-black text-white uppercase tracking-tight mb-8">Recent Grades</h3>
            <div className="space-y-4">
              {examResultsData.slice(0, 3).map((item, i) => (
                <div key={i} className="flex items-center justify-between p-6 bg-[#0a1a19] rounded-[32px] border border-white/20">
                  <div>
                    <h4 className="text-sm font-bold text-white">{item.assignment || item.courseName}</h4>
                    <p className="text-[9px] font-black text-slate-300 uppercase mt-1">Academic Session 2025</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-black text-[#4ea59d]">{item.grade}</p>
                    {item.percentage && <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{item.percentage}%</p>}
                  </div>
                </div>
              ))}
              {examResultsData.length === 0 && (
                <div className="p-6 bg-[#0a1a19] rounded-[32px] border border-white/20 text-center">
                  <p className="text-sm text-slate-400">No recent grades available.</p>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    );
  };

  const renderNoticeBoard = () => (
    <div className="space-y-8 animate-fadeIn text-slate-100 pb-20">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-[#1f4e4a] pb-6">
        <div>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white uppercase tracking-tight">Notice Board</h2>
          <p className="text-[#4ea59d]/60 text-[10px] sm:text-xs font-black uppercase tracking-[0.25em] sm:tracking-[0.35em]">School Broadcasts</p>
        </div>
        <div className="flex items-center gap-4 w-full md:w-auto">
          <button
            onClick={() => performSmsSync(false)}
            className="flex-1 md:flex-none px-4 sm:px-6 py-2.5 bg-[#1f4e4a] border border-[#4ea59d]/20 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-[#4ea59d] transition-all flex items-center justify-center gap-2"
          >
            <i className={`fa-solid fa-rotate ${isLoading ? 'animate-spin' : ''}`}></i> Refresh
          </button>
          {user.role === UserRole.TEACHER && (
            <button
              onClick={() => {
                setNoticeTitle('');
                setNoticeMessage('');
                setNoticeDate(new Date().toISOString().split('T')[0]);
                setNoticePriority('Medium');
                setNoticeFile(null);
                setIsNoticeComposerOpen(true);
              }}
              className="flex-1 md:flex-none px-4 sm:px-6 py-2.5 bg-[#4ea59d] text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#4ea59d]/20"
            >
              <i className="fa-solid fa-plus"></i> Create Notice
            </button>
          )}
        </div>
      </header>

      <section className="bg-white/10 backdrop-blur-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] p-4 sm:p-6 lg:p-8 rounded-[24px] sm:rounded-[32px] lg:rounded-[40px] border border-white/20 shadow-xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          {dynamicAnnouncements.length === 0 && (
            <div className="p-6 bg-[#0a1a19] rounded-3xl border border-white/20 text-center md:col-span-2">
              <p className="text-sm text-slate-300">No notices available right now.</p>
            </div>
          )}
          {dynamicAnnouncements.map(item => (
            <button
              key={item.id}
              onClick={() => handleNoticeOpen(item, 'notice-board')}
              className="w-full p-5 sm:p-6 lg:p-8 bg-[#0a1a19] rounded-[24px] sm:rounded-[28px] lg:rounded-[32px] border border-white/20 group hover:border-[#4ea59d] transition-all text-left min-h-[180px] sm:min-h-[210px] lg:min-h-[240px]"
            >
              <div className="h-full flex flex-col">
                <div className="flex items-start justify-between gap-3 mb-4 sm:mb-5">
                  <span className="text-[11px] sm:text-sm font-black text-slate-400 uppercase tracking-wider">{item.date}</span>
                  <span className={`text-[10px] sm:text-xs font-black px-2.5 sm:px-3 py-1 rounded-xl uppercase tracking-wider ${item.priority === 'Urgent'
                    ? 'bg-rose-500/15 text-rose-300'
                    : item.priority === 'High'
                      ? 'bg-red-500/10 text-red-400'
                      : item.priority === 'Low'
                        ? 'bg-blue-500/10 text-blue-400'
                        : 'bg-orange-500/10 text-orange-400'
                    }`}>
                    {item.priority}
                  </span>
                </div>

                <h4 className="text-xl sm:text-2xl lg:text-3xl xl:text-[34px] leading-tight font-black text-white line-clamp-4 mb-5 sm:mb-6">
                  {item.title}
                </h4>

                <div className="flex flex-wrap items-center gap-3 mb-6">
                  {item.targetInfo && (
                    <span className="px-3 py-1 rounded-lg bg-[#4ea59d]/10 text-[#4ea59d] text-[9px] font-black uppercase tracking-widest border border-[#4ea59d]/20">
                      <i className="fa-solid fa-crosshairs mr-1"></i> {item.targetInfo}
                    </span>
                  )}
                  {user.role === UserRole.TEACHER && item.createdBy === user.id && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteNotice(item.id);
                      }}
                      className="px-3 py-1 rounded-lg bg-rose-500/10 text-rose-400 text-[9px] font-black uppercase tracking-widest border border-rose-500/20 hover:bg-rose-500 hover:text-white transition-colors"
                    >
                      <i className="fa-solid fa-trash-can mr-1"></i> Delete
                    </button>
                  )}
                </div>

                <div className="mt-auto flex items-center justify-between gap-4">
                  <span className="text-[#4ea59d] text-[10px] sm:text-xs lg:text-sm font-black uppercase tracking-[0.08em] sm:tracking-[0.12em]">
                    Click to View Full Announcement
                  </span>
                  <i className="fa-solid fa-chevron-right text-[#4ea59d] text-xs sm:text-sm group-hover:translate-x-1 transition-transform shrink-0"></i>
                </div>
              </div>
            </button>
          ))}
        </div>
      </section>
    </div>
  );

  const renderNoticeDetail = () => {
    if (!selectedNotice) {
      return (
        <div className="space-y-8 animate-fadeIn text-slate-100 pb-20">
          <button
            onClick={() => setCurrentView(noticeOriginView)}
            className="text-[#4ea59d] font-black uppercase text-[10px] tracking-widest flex items-center gap-2"
          >
            <i className="fa-solid fa-arrow-left"></i> Back
          </button>
          <div className="p-8 bg-white/10 backdrop-blur-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] rounded-[32px] border border-white/20">
            <p className="text-sm text-slate-300">Notice not found.</p>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-8 animate-fadeIn text-slate-100 pb-20">
        <button
          onClick={() => setCurrentView(noticeOriginView)}
          className="text-[#4ea59d] font-black uppercase text-[10px] tracking-widest flex items-center gap-2 group"
        >
          <i className="fa-solid fa-arrow-left transition-transform group-hover:-translate-x-1"></i> Back to Notices
        </button>

        <section className="bg-white/10 backdrop-blur-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] p-8 rounded-[40px] border border-white/20 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
            <span className={`text-[10px] font-black px-3 py-1 rounded-lg uppercase tracking-wider ${selectedNotice.priority === 'Urgent'
              ? 'bg-rose-500/15 text-rose-300'
              : selectedNotice.priority === 'High'
                ? 'bg-red-500/10 text-red-400'
                : selectedNotice.priority === 'Low'
                  ? 'bg-blue-500/10 text-blue-400'
                  : 'bg-orange-500/10 text-orange-400'
              }`}>
              {selectedNotice.priority}
            </span>
            <span className="text-xs font-black text-slate-400 uppercase">{selectedNotice.date}</span>
          </div>

          <h2 className="text-3xl font-black text-white mb-4">{selectedNotice.title}</h2>
          <p className="text-base text-slate-300 leading-relaxed whitespace-pre-wrap">{selectedNotice.content}</p>

          {selectedNotice.fileUrl && (
            <a
              href={selectedNotice.fileUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 mt-6 text-xs font-black uppercase tracking-wider text-[#4ea59d] hover:underline"
            >
              <i className="fa-solid fa-paperclip"></i>
              {selectedNotice.fileName || 'Open Attachment'}
            </a>
          )}
        </section>
      </div>
    );
  };

  const renderInstruction = () => (
    <div className="space-y-12 animate-fadeIn text-slate-100 pb-20">
      <section className="relative h-72 rounded-[40px] overflow-hidden group">
        <img src="https://images.unsplash.com/photo-1541339907198-e08759dfc3f0?auto=format&fit=crop&w=1200" className="w-full h-full object-cover opacity-40 grayscale group-hover:grayscale-0 transition-all duration-1000" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a1a19] to-transparent"></div>
        <div className="absolute bottom-10 left-10">
          <p className="text-[#4ea59d] font-black uppercase tracking-[0.4em] mb-2">About School</p>
          <h2 className="text-5xl font-black text-white uppercase tracking-tighter">IEM Academy</h2>
          <p className="max-w-xl text-slate-400 text-sm mt-4 leading-relaxed font-medium">
            Pioneering the future of education through AI-integrated curricula and global mentorship. Our mission is to empower every learner to thrive in an era of rapid technological evolution.
          </p>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        <div className="lg:col-span-2 space-y-12">
          <section>
            <h3 className="text-2xl font-black text-white uppercase tracking-tight mb-8 flex items-center gap-4">
              <i className="fa-solid fa-bullhorn text-[#4ea59d]"></i> School Announcements
            </h3>
            <div className="max-h-96 overflow-y-auto pr-1 custom-scrollbar space-y-4">
              {dynamicAnnouncements.length === 0 && (
                <div className="p-6 bg-white/10 backdrop-blur-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] rounded-3xl border border-white/20 text-center">
                  <p className="text-sm text-slate-300">No school announcements published yet.</p>
                </div>
              )}
              {dynamicAnnouncements.map(ann => (
                <button
                  key={ann.id}
                  onClick={() => handleNoticeOpen(ann, 'instruction')}
                  className="w-full p-6 bg-white/10 backdrop-blur-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] rounded-3xl border border-white/20 hover:border-[#4ea59d] transition-all group text-left"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <h4 className="text-xl font-bold text-white truncate">{ann.title}</h4>
                      <span className="text-xs font-black text-slate-400 uppercase shrink-0">{ann.date}</span>
                    </div>
                    <i className="fa-solid fa-chevron-right text-[#4ea59d] text-xs group-hover:translate-x-1 transition-transform shrink-0"></i>
                  </div>
                </button>
              ))}
            </div>
          </section>

          <section>
            <h3 className="text-xl font-black text-white uppercase tracking-tight mb-8 flex items-center gap-4">
              <i className="fa-solid fa-masks-theater text-[#4ea59d]"></i> Student Activities
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {dynamicStudentActivities.length > 0 ? dynamicStudentActivities.map((act, i) => (
                <div key={i} className="p-8 bg-white/10 backdrop-blur-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] rounded-[40px] border border-white/20 group hover:bg-[#4ea59d]/5 transition-all">
                  <div className="w-14 h-14 bg-[#4ea59d]/10 rounded-2xl flex items-center justify-center text-[#4ea59d] text-2xl mb-6 group-hover:scale-110 transition-transform">
                    <i className={`fa-solid ${act.icon}`}></i>
                  </div>
                  <h4 className="text-lg font-bold text-white mb-2">{act.name}</h4>
                  <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1">{act.activity_type}</p>
                  <p className="text-xs text-slate-400 leading-relaxed">{act.description}</p>
                </div>
              )) : (
                <div className="col-span-2 p-10 bg-white/5 border border-white/10 rounded-[40px] text-center">
                  <p className="text-slate-400 text-sm italic">No extracurricular activities recorded at this time.</p>
                </div>
              )}
            </div>
          </section>
        </div>

        <section className="space-y-8">
          <h3 className="text-xl font-black text-white uppercase tracking-tight mb-8">Upcoming Events</h3>
          <div className="space-y-6 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
            {dynamicSchoolEvents.length > 0 ? dynamicSchoolEvents.map(ev => (
              <div key={ev.id} className="relative h-48 rounded-[32px] overflow-hidden group cursor-pointer shadow-xl shrink-0">
                <img src={ev.image} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
                <div className="absolute bottom-6 left-6">
                  <p className="text-[10px] font-black text-[#4ea59d] uppercase tracking-widest mb-1">{ev.type}</p>
                  <h4 className="text-sm font-bold text-white uppercase">{ev.name}</h4>
                  <p className="text-[10px] text-slate-400 font-bold uppercase mt-1 "><i className="fa-solid fa-calendar mr-2"></i> {ev.date}</p>
                  {ev.location && <p className="text-[9px] text-emerald-400/60 font-black uppercase mt-1"><i className="fa-solid fa-location-dot mr-2"></i> {ev.location}</p>}
                </div>
              </div>
            )) : (
              <div className="p-6 bg-white/5 border border-white/10 rounded-[32px] text-center">
                <p className="text-slate-400 text-xs italic">Awaiting upcoming institutional events.</p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );

  const renderHomework = () => (
    <div className="space-y-12 animate-fadeIn text-slate-100 pb-20">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-[#1f4e4a] pb-8">
        <div className="space-y-2">
          <h2 className="text-4xl font-black text-white uppercase tracking-tighter ">Homework Hub</h2>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#4ea59d] animate-pulse"></span>
            <p className="text-[#4ea59d]/60 font-black text-[10px] uppercase tracking-[0.4em]">Submission Portal & Assignment Tracking</p>
          </div>
        </div>
        {user.role === UserRole.TEACHER && (
          <button
            onClick={() => {
              setHomeworkTitle('');
              setHomeworkDescription('');
              setHomeworkDueDate('');
              setHomeworkFile(null);
              setAssignedClassId('');
              setAssignedCourseId('');
              setIsHomeworkComposerOpen(true);
            }}
            className="px-8 py-4 bg-[#4ea59d] text-white rounded-[24px] text-xs font-black uppercase tracking-[0.2em] shadow-xl shadow-[#4ea59d]/30 hover:scale-105 transition-all flex items-center gap-3"
          >
            <i className="fa-solid fa-plus"></i> Create Assignment
          </button>
        )}
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
        <div className="xl:col-span-3 space-y-10">
          <section>
            <h3 className="text-xl font-black text-white uppercase tracking-tight mb-8 flex items-center gap-4">
              <i className="fa-solid fa-list-check text-[#4ea59d]"></i> Assigned Homework
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-h-[800px] overflow-y-auto pr-2 custom-scrollbar">
              {dynamicAssignments.length === 0 ? (
                <div className="md:col-span-2 p-10 bg-white/5 border border-white/10 rounded-[40px] text-center">
                  <p className="text-slate-400 text-sm">No homework assigned yet. Keep up the good work!</p>
                </div>
              ) : (
                dynamicAssignments.map((ass) => (
                  <div key={ass.id} className="bg-white/10 backdrop-blur-2xl shadow-xl p-8 rounded-[40px] border border-white/20 group hover:border-[#4ea59d]/50 transition-all flex flex-col h-full min-h-[300px]">
                    <div className="flex justify-between items-start mb-6">
                      <div className={`px-3 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest ${ass.status === 'Active' || ass.status === 'Submitted' ? 'bg-green-500/10 text-green-400' : 'bg-orange-500/10 text-orange-400'}`}>
                        {ass.status}
                      </div>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ">{ass.dueDate}</span>
                    </div>

                    <h4 className="text-xl font-black text-white mb-2 group-hover:text-[#4ea59d] transition-colors line-clamp-2">{ass.title}</h4>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">{ass.course || 'Core Curriculum'}</p>
                    {ass.description && (
                      <p className="text-xs text-slate-400 leading-relaxed mb-4 line-clamp-3">{ass.description}</p>
                    )}
                    {ass.fileName && (
                      <div className="flex items-center gap-4 mb-4">
                        <div className="flex items-center gap-2">
                          <i className="fa-solid fa-paperclip text-[#4ea59d] text-[10px]"></i>
                          <span className="text-[10px] font-black text-[#4ea59d] uppercase tracking-widest truncate max-w-[120px]" title={ass.fileName}>{ass.fileName}</span>
                        </div>
                      </div>
                    )}

                    {/* Teacher-specific Submission Roster */}
                    {user.role === UserRole.TEACHER && ass.submissions && ass.submissions.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-white/5 space-y-3">
                        <p className="text-[9px] font-black text-[#4ea59d] uppercase tracking-widest ">Recent Submissions ({ass.submissions.length})</p>
                        <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto pr-2 custom-scrollbar">
                          {ass.submissions.map((sub: any, idx: number) => (
                            <button
                              key={sub.id || idx}
                              onClick={() => window.open(sub.url, '_blank')}
                              className="group flex items-center gap-2 px-3 py-1.5 bg-[#4ea59d]/10 hover:bg-[#4ea59d]/20 border border-[#4ea59d]/20 rounded-xl transition-all hover:scale-105 active:scale-95"
                              title={`View submission from ${sub.studentName}`}
                            >
                              <div className="w-1.5 h-1.5 rounded-full bg-[#4ea59d]"></div>
                              <span className="text-[10px] font-bold text-slate-200 group-hover:text-white">{sub.studentName}</span>
                              <i className="fa-solid fa-arrow-up-right-from-square text-[8px] text-[#4ea59d] ml-1 opacity-0 group-hover:opacity-100 transition-opacity"></i>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {user.role === UserRole.TEACHER && (!ass.submissions || ass.submissions.length === 0) && (
                      <div className="mt-4 pt-4 border-t border-white/5">
                        <p className="text-[9px] font-bold text-slate-500 uppercase italic">No submissions yet.</p>
                      </div>
                    )}

                    <div className="mt-auto pt-6 border-t border-white/10 flex items-center justify-between gap-4">
                      {user.role === UserRole.TEACHER ? (
                        <div className="flex-1 px-6 py-3 bg-white/5 border border-white/10 text-slate-400 rounded-2xl text-[10px] font-black uppercase tracking-widest text-center">
                          Assignment Published
                        </div>
                      ) : (ass.status === 'Active' || ass.status === 'Submitted' ? (
                        <div className="flex-1 px-6 py-3 bg-green-500/10 border border-green-500/20 text-green-400 rounded-2xl text-[10px] font-black uppercase tracking-widest text-center">
                          <i className="fa-solid fa-check mr-2"></i>Submitted
                        </div>
                      ) : (
                        <button
                          onClick={() => { setSelectedAssignment(ass); setIsSubmissionModalOpen(true); }}
                          className="flex-1 px-6 py-3 bg-[#4ea59d] hover:bg-[#3d8c85] text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-[#4ea59d]/20"
                        >
                          Submit Homework
                        </button>
                      ))}
                      <div className="flex gap-2">
                        {/* Standardized Download Buttons */}
                        {ass.submissionUrl ? (
                          <button
                            onClick={() => window.open(ass.submissionUrl, '_blank')}
                            className="w-10 h-10 rounded-xl bg-[#4ea59d]/20 flex items-center justify-center text-[#4ea59d] border border-[#4ea59d]/30 hover:bg-[#4ea59d]/30 transition-all hover:scale-105"
                            title="View Submission"
                          >
                            <i className="fa-solid fa-cloud-arrow-down shadow-sm"></i>
                          </button>
                        ) : ass.fileUrl ? (
                          <button
                            onClick={() => window.open(ass.fileUrl, '_blank')}
                            className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-slate-400 hover:text-[#4ea59d] border border-white/10 transition-all hover:scale-105"
                            title="Download Instructions"
                          >
                            <i className="fa-solid fa-download"></i>
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>


      </div>
    </div>
  );

  const renderActivity = () => (
    <div className="space-y-12 animate-fadeIn text-slate-100 pb-20">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-[#1f4e4a] pb-8">
        <div className="space-y-2">
          <h2 className="text-4xl font-black text-white uppercase tracking-tighter">Activity Portal</h2>
          <p className="text-[#4ea59d]/60 font-black text-[10px] uppercase tracking-[0.4em]">Personal Academic Tracking</p>
        </div>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-12">
        <div className="xl:col-span-2 space-y-12">
          <section>
            <h3 className="text-xl font-black text-white uppercase tracking-tight mb-8 flex items-center gap-4">
              <i className="fa-solid fa-clipboard-list text-[#4ea59d]"></i> Pending Assignments
            </h3>
            <div className="space-y-4 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
              {dynamicAssignments.map(ass => (
                <div key={ass.id} className="p-6 md:p-8 bg-white/10 backdrop-blur-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] rounded-[32px] border border-white/20 flex flex-col sm:flex-row justify-between items-center gap-6 group scale-[0.98] sm:scale-100 origin-center">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="text-lg font-bold text-white">{ass.title}</h4>
                      <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase ${ass.status === 'Active' ? 'bg-green-500/10 text-green-500' : 'bg-orange-500/10 text-orange-500'}`}>
                        {ass.status}
                      </span>
                    </div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{ass.course} • Due {ass.dueDate}</p>
                  </div>
                  {/* Teacher-specific Submission Roster */}
                  {user.role === UserRole.TEACHER && ass.submissions && ass.submissions.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-white/5 space-y-3">
                      <p className="text-[9px] font-black text-[#4ea59d] uppercase tracking-widest ">Recent Submissions ({ass.submissions.length})</p>
                      <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto pr-2 custom-scrollbar">
                        {ass.submissions.map((sub: any, idx: number) => (
                          <button
                            key={sub.id || idx}
                            onClick={() => window.open(sub.url, '_blank')}
                            className="group flex items-center gap-2 px-3 py-1.5 bg-[#4ea59d]/10 hover:bg-[#4ea59d]/20 border border-[#4ea59d]/20 rounded-xl transition-all hover:scale-105 active:scale-95"
                            title={`View submission from ${sub.studentName}`}
                          >
                            <div className="w-1.5 h-1.5 rounded-full bg-[#4ea59d]"></div>
                            <span className="text-[10px] font-bold text-slate-200 group-hover:text-white">{sub.studentName}</span>
                            <i className="fa-solid fa-arrow-up-right-from-square text-[8px] text-[#4ea59d] ml-1 opacity-0 group-hover:opacity-100 transition-opacity"></i>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {user.role === UserRole.TEACHER && (!ass.submissions || ass.submissions.length === 0) && (
                    <div className="mt-4 pt-4 border-t border-white/5">
                      <p className="text-[9px] font-bold text-slate-500 uppercase italic">No submissions yet.</p>
                    </div>
                  )}

                  <div className="flex items-center gap-3">
                    {user.role === UserRole.TEACHER ? (
                      <div className="px-6 py-3 bg-white/5 border border-white/10 text-slate-400 rounded-2xl text-[10px] font-black uppercase tracking-widest text-center">
                        Assignment Published
                      </div>
                    ) : (ass.status === 'Active' || ass.status === 'Submitted' ? (
                      <div className="px-6 py-3 bg-green-500/10 border border-green-500/20 text-green-400 rounded-2xl text-[10px] font-black uppercase tracking-widest text-center flex items-center gap-2">
                        <i className="fa-solid fa-check"></i> Submitted
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setSelectedAssignment(ass);
                          setIsSubmissionModalOpen(true);
                        }}
                        className="px-6 py-3 bg-[#1f4e4a] hover:bg-[#4ea59d] text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all"
                      >
                        Submit Task
                      </button>
                    ))}

                    {/* Standardized Download Buttons */}
                    {ass.submissionUrl ? (
                      <button
                        onClick={() => window.open(ass.submissionUrl, '_blank')}
                        className="w-10 h-10 rounded-xl bg-[#4ea59d]/20 flex items-center justify-center text-[#4ea59d] border border-[#4ea59d]/30 hover:bg-[#4ea59d]/30 transition-all hover:scale-105"
                        title="View Submission"
                      >
                        <i className="fa-solid fa-cloud-arrow-down shadow-sm"></i>
                      </button>
                    ) : ass.fileUrl ? (
                      <button
                        onClick={() => window.open(ass.fileUrl, '_blank')}
                        className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-slate-400 hover:text-[#4ea59d] border border-white/10 transition-all hover:scale-105"
                        title="Download Instructions"
                      >
                        <i className="fa-solid fa-download"></i>
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h3 className="text-xl font-black text-white uppercase tracking-tight mb-8">Grades & Feedback</h3>
            <div className="overflow-hidden rounded-[32px] border border-white/20 shadow-2xl">
              <div className="max-h-96 overflow-y-auto custom-scrollbar">
                <table className="w-full text-left bg-white/10 backdrop-blur-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.37)]">
                  <thead className="bg-[#0a1a19] sticky top-0 z-10 shadow-sm">
                    <tr>
                      <th className="px-8 py-5 text-[10px] font-black text-[#4ea59d] uppercase tracking-widest">Assessment</th>
                      <th className="px-8 py-5 text-[10px] font-black text-[#4ea59d] uppercase tracking-widest">Mark</th>
                      <th className="px-8 py-5 text-[10px] font-black text-[#4ea59d] uppercase tracking-widest">Faculty Insight</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1f4e4a]">
                    {examResultsData.map((g, i) => (
                      <tr key={i} className="hover:bg-[#0a1a19]/[0.02] transition-colors">
                        <td className="px-8 py-6 font-bold text-sm text-white">{g.assignment}</td>
                        <td className="px-8 py-6 text-xl font-black text-[#4ea59d]">{g.grade}</td>
                        <td className="px-8 py-6 text-xs text-slate-400 font-medium leading-relaxed max-w-sm">{g.feedback}</td>
                      </tr>
                    ))}
                    {examResultsData.length === 0 && (
                      <tr>
                        <td colSpan={3} className="px-8 py-10 text-center text-sm text-slate-400">
                          No official grades available yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </div>

        <section className="bg-white/10 backdrop-blur-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] p-10 rounded-[40px] border border-white/20 shadow-xl h-fit sticky top-10">
          <h3 className="text-xl font-black text-white uppercase tracking-tight mb-8">Exam Schedule</h3>
          <div className="space-y-6 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
            {dynamicExams.map((ex, i) => (
              <div key={i} className="relative pl-6 border-l-2 border-[#1f4e4a] group">
                <div className="absolute left-[-5px] top-0 w-2 h-2 rounded-full bg-[#4ea59d] shadow-[0_0_10px_#4ea59d] group-hover:scale-150 transition-transform"></div>
                <p className="text-[10px] font-black text-[#4ea59d] uppercase tracking-widest">{ex.date} @ {ex.time}</p>
                <h4 className="text-sm font-bold text-white my-1">{ex.subject}</h4>
                <p className="text-[10px] text-slate-400 font-bold uppercase"><i className="fa-solid fa-location-dot mr-2"></i> {ex.venue}</p>
              </div>
            ))}
          </div>
          <button className="w-full mt-10 py-4 bg-[#4ea59d]/5 border border-[#4ea59d]/20 text-[#4ea59d] rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-[#4ea59d] hover:text-white transition-all flex items-center justify-center gap-2">
            <i className="fa-solid fa-cloud-arrow-down"></i> Download Full Schedule
          </button>
        </section>
      </div>
    </div>
  );

  const renderCourses = () => (
    <COURSES
      schoolId={schoolId}
      userRole={user.role}
      assignedClassIds={assignedClassIds}
      assignedCourseIds={assignedCourseIds}
      notify={(message) => console.log(message)}
      onOpenClassPage={async (classItem) => {
        setSelectedClass(classItem);
        setCurrentView('class-detail');
        if (supabase && isSupabaseConfigured) {
          setIsLoading(true);
          try {
            // 1. Fetch students for this class
            const { data: stdData, error: stdError } = await supabase
              .from('students')
              .select('id, name, email')
              .eq('school_id', schoolId)
              .contains('assigned_class_ids', [classItem.id]);

            if (!stdError && stdData) {
              setSelectedClassStudents(stdData);
            }

            // 2. Fetch courses for this class
            const { data: crsData, error: crsError } = await supabase
              .from('class_courses')
              .select('*')
              .eq('class_id', classItem.id)
              .eq('school_id', schoolId);

            if (!crsError && crsData) {
              setSelectedClassCourses(crsData);
              // 3. Fetch teachers for all these class courses
              const courseIdsInClass = crsData.map((c: any) => c.id);
              if (courseIdsInClass.length > 0) {
                const { data: teacherData } = await supabase
                  .from('class_course_teachers')
                  .select('teacher:teacher_id(*)')
                  .in('class_course_id', courseIdsInClass)
                  .eq('school_id', schoolId);

                if (teacherData) {
                  const tMap = new Map();
                  teacherData.forEach((td: any) => {
                    if (td.teacher) tMap.set(td.teacher.id, td.teacher);
                  });
                  setSelectedClassTeachers(Array.from(tMap.values()));
                }
              } else {
                setSelectedClassTeachers([]);
              }
            }
          } catch (err) {
            console.error('Error fetching class details:', err);
          }
          setIsLoading(false);
        }
      }}
      onOpenCoursePage={async ({ id, name, className }) => {
        setIsLoading(true);
        // 1. Try to find in existing courses state
        let matchedCourse = courses.find(course => String(course.id) === String(id));

        // 2. Fallback: Fetch from Supabase if not in INITIAL_COURSES
        if (!matchedCourse && supabase && isSupabaseConfigured) {
          try {
            const { data, error } = await supabase
              .from('class_courses')
              .select('*')
              .eq('id', id)
              .maybeSingle();

            if (!error && data) {
              matchedCourse = {
                id: String(data.id),
                title: data.name || name || 'Unnamed Course',
                description: data.description || `Dynamic course in ${className || 'Unknown Class'}.`,
                moduleIntro: data.module_intro || 'Welcome to this specialized learning module.',
                topics: data.topics || ['General Introduction', 'Core Concepts', 'Advanced Applications'],
                teacherId: data.teacher_id || user.id,
                subTeacherName: data.teacher_name || user.name,
                onlineClassUrl: data.online_url || undefined,
                scheduleDescription: data.schedule || 'TBA',
                thumbnail: data.image_url || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=800',
                category: className || 'Academic',
                notes: [],
                quizzes: []
              };

              // Optionally fetch resources for this dynamic course
              const { data: notesData } = await supabase
                .from('resources_buckets')
                .select('*')
                .eq('course_id', id)
                .eq('is_folder', false)
                .eq('school_id', schoolId);

              if (notesData) {
                matchedCourse.notes = notesData.map((n: any) => ({
                  id: n.id,
                  title: n.title,
                  content: n.content || 'Dossier detail pending.',
                  summary: n.summary || '',
                  ebookUrl: n.file_url,
                  createdAt: n.created_at
                }));
              }
            }
          } catch (err) {
            console.error('Error fetching dynamic course:', err);
          }
        }

        setIsLoading(false);
        if (!matchedCourse) {
          console.log('Course details page is only available for catalog courses.');
          return;
        }
        handleCourseClick(matchedCourse);
      }}
    />
  );

  const renderClassDetail = () => {
    if (!selectedClass) return null;
    const isTeacher = user.role === UserRole.TEACHER;

    return (
      <div className="space-y-12 animate-fadeIn text-slate-100 pb-20">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-[#1f4e4a] pb-8">
          <div className="space-y-4 flex-1">
            <button onClick={() => setCurrentView('courses')} className="text-[#4ea59d] font-black uppercase text-[10px] tracking-widest flex items-center gap-2 group">
              <i className="fa-solid fa-arrow-left transition-transform group-hover:-translate-x-1"></i> Back to Campus Manager
            </button>
            <h2 className="text-5xl font-black text-white uppercase tracking-tight leading-none">{selectedClass.name}</h2>
            <div className="flex flex-wrap gap-4 pt-2">
              <span className="bg-[#4ea59d]/10 text-[#4ea59d] px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border border-[#4ea59d]/20">
                School ID: {schoolId}
              </span>
              <span className="bg-blue-500/10 text-blue-500 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border border-blue-500/20 flex items-center gap-2">
                <i className="fa-solid fa-users"></i> {selectedClassStudents.length} Enrolled Students
              </span>
            </div>
          </div>
        </header>

        <div className="space-y-16">


          <section className="space-y-12">
            <div className="flex items-center justify-between">
              <h3 className="text-4xl font-black text-white uppercase tracking-tighter flex items-center gap-5">
                <div className="w-14 h-14 rounded-[24px] bg-[#4ea59d]/10 flex items-center justify-center text-[#4ea59d] shadow-lg border border-[#4ea59d]/10">
                  <i className="fas fa-layer-group"></i>
                </div>
                Curriculum Catalog
              </h3>
            </div>

            {selectedClassCourses.length === 0 ? (
              <div className="p-24 border-2 border-dashed border-white/5 rounded-[64px] text-center space-y-6">
                <i className="fas fa-box-open text-5xl text-white/5"></i>
                <p className="text-slate-500 text-[12px] font-black uppercase tracking-[0.4em]">Curriculum Modules Pending Dispatch</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
                {selectedClassCourses.map(crs => (
                  <div
                    key={crs.id}
                    onClick={() => {
                      const matched = courses.find(c => String(c.id) === String(crs.id));
                      if (matched) {
                        handleCourseClick(matched);
                      } else {
                        handleCourseClick({
                          id: String(crs.id),
                          title: crs.name,
                          description: crs.description || 'Module detail restricted.',
                          moduleIntro: crs.module_intro || 'Welcome to this session.',
                          topics: crs.topics || [],
                          teacherId: crs.teacher_id || '',
                          onlineClassUrl: crs.online_url,
                          scheduleDescription: crs.schedule,
                          thumbnail: crs.image_url || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=800',
                          category: selectedClass.name,
                          notes: [],
                          quizzes: []
                        });
                      }
                    }}
                    className="group relative aspect-video rounded-[64px] overflow-hidden cursor-pointer shadow-4xl border border-white/10 hover:border-[#4ea59d]/60 transition-all scale-[1.02] hover:scale-[1.07]"
                  >
                    <img
                      src={crs.image_url || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=800'}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/30 to-transparent"></div>
                    <div className="absolute bottom-12 left-12 right-12">
                      <div className="flex items-center gap-4 mb-6">
                        <span className="px-6 py-2.5 rounded-2xl bg-[#4ea59d]/30 text-[#4ea59d] text-[10px] font-black uppercase tracking-[0.4em] border border-[#4ea59d]/30 shadow-lg">
                          {crs.code || 'Academic'}
                        </span>
                        <span className="w-12 h-px bg-white/20"></span>
                      </div>
                      <h4 className="text-5xl font-black text-white uppercase tracking-tighter leading-none group-hover:text-[#4ea59d] transition-colors">{crs.name}</h4>
                      <div className="mt-8 flex items-center justify-between pt-8 border-t border-white/10">
                        <span className="text-[14px] font-black text-slate-400 uppercase tracking-[0.5em] group-hover:text-white transition-colors">Access Portal</span>
                        <div className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center text-[#4ea59d] group-hover:bg-[#4ea59d] group-hover:text-white transition-all shadow-2xl scale-110">
                          <i className="fas fa-arrow-right text-[14px]"></i>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>


        </div>
      </div>
    );
  };

  const renderStudies = () => (
    <div className="space-y-12 animate-fadeIn text-slate-100 pb-20">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-[#1f4e4a] pb-8">
        <div className="space-y-2">
          <h2 className="text-4xl font-black text-white uppercase tracking-tighter">Academic Records</h2>
          <p className="text-[#4ea59d]/60 font-black text-[10px] uppercase tracking-[0.4em]">Results & Achievements</p>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        <section className="bg-white/10 backdrop-blur-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] p-10 rounded-[40px] border border-white/20 shadow-xl">
          <h3 className="text-xl font-black text-white uppercase tracking-tight mb-8">Exam Results</h3>
          <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
            {examResultsData.map((ex, i) => (
              <div key={i} className="p-6 bg-[#0a1a19] rounded-3xl border border-white/20 flex justify-between items-center">
                <div>
                  <h4 className="text-sm font-bold text-white">{ex.assignment || ex.courseName}</h4>
                  <p className="text-[9px] font-black text-slate-400 uppercase">{ex.className} • {ex.courseName}</p>
                </div>
                <div className="text-right">
                  <span className={`text-lg font-black block ${ex.grade === 'Pending' ? 'text-orange-500' : 'text-[#4ea59d]'}`}>{ex.grade}</span>
                  {ex.percentage && <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{ex.percentage}%</span>}
                </div>
              </div>
            ))}
            {examResultsData.length === 0 && (
              <p className="text-sm text-slate-400">No exam results available.</p>
            )}
          </div>
        </section>

        <section className="bg-white/10 backdrop-blur-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] p-10 rounded-[40px] border border-white/20 shadow-xl">
          <h3 className="text-xl font-black text-white uppercase tracking-tight mb-8">Assignment Results</h3>
          <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
            {examResultsData.length > 0 ? (
              examResultsData.map((g, i) => (
                <div key={i} className="p-6 bg-[#0a1a19] rounded-3xl border border-white/20 flex justify-between items-center group relative overflow-hidden">
                  <div className="flex-1">
                    <h4 className="text-sm font-bold text-white">{g.assignment}</h4>
                    <p className="text-[9px] text-[#4ea59d] font-black uppercase mt-1">Feedback: {g.feedback}</p>
                  </div>
                  <span className="text-lg font-black text-[#4ea59d] ml-4">{g.grade}</span>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-400 text-center py-10">No assignment results available.</p>
            )}
          </div>
        </section>

        <section className="lg:col-span-2 bg-white/10 backdrop-blur-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] p-10 rounded-[40px] border border-white/20 shadow-xl">
          <h3 className="text-xl font-black text-white uppercase tracking-tight mb-8 flex items-center gap-4">
            <i className="fa-solid fa-file-pdf text-[#4ea59d]"></i> Official Report Cards
          </h3>
          <div className="max-h-[400px] overflow-y-auto pr-2 custom-scrollbar space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-4">
              {dynamicReportCards.length === 0 ? (
                <div className="md:col-span-2 p-10 bg-[#0a1a19] rounded-[32px] border border-dashed border-[#1f4e4a] text-center">
                  <p className="text-sm text-slate-400">No official report cards available for download.</p>
                </div>
              ) : (
                dynamicReportCards.map((rc) => (
                  <div key={rc.id} className="p-8 bg-[#0a1a19] rounded-[32px] border border-white/20 group hover:border-[#4ea59d] transition-all flex flex-col justify-between">
                    <div className="flex items-start justify-between gap-4 mb-6">
                      <div className="w-12 h-12 bg-[#4ea59d]/10 rounded-2xl flex items-center justify-center text-[#4ea59d] shrink-0">
                        <i className="fa-solid fa-file-invoice text-2xl"></i>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-lg font-bold text-white truncate" title={rc.title}>{rc.title}</h4>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Released on {rc.reportDate}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-[10px] font-black text-[#4ea59d]/60 uppercase tracking-widest bg-[#4ea59d]/5 px-3 py-1 rounded-lg">
                        {rc.reportType}
                      </span>
                      {rc.fileUrl && (
                        <button
                          onClick={() => window.open(rc.fileUrl, '_blank')}
                          className="px-6 py-3 bg-[#4ea59d] text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-[#3d8c85] transition-all shadow-lg shadow-[#4ea59d]/20 flex items-center gap-2"
                        >
                          <i className="fa-solid fa-cloud-arrow-down"></i> Download
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        <section className="lg:col-span-2 bg-white/10 backdrop-blur-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] p-10 rounded-[40px] border border-white/20 shadow-xl">
          <h3 className="text-xl font-black text-white uppercase tracking-tight mb-8">Achievements & Badges</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {dynamicAchievements.length > 0 ? (
              dynamicAchievements.map(ach => (
                <div key={ach.id} className="p-8 bg-[#0a1a19] rounded-[40px] border border-white/20 text-center space-y-4 group hover:bg-[#4ea59d]/5 transition-all">
                  <div className={`w-20 h-20 mx-auto rounded-[28px] bg-[#0a1a19]/5 flex items-center justify-center text-4xl ${ach.color} group-hover:scale-110 transition-transform`}>
                    <i className={`fa-solid ${ach.icon}`}></i>
                  </div>
                  <div>
                    <h4 className="text-base font-black text-white uppercase">{ach.title}</h4>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{ach.desc}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="sm:col-span-3 p-10 bg-[#0a1a19] rounded-[40px] border border-dashed border-[#1f4e4a] text-center">
                <p className="text-sm text-slate-400">No achievements recorded yet. Keep pushing for excellence!</p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );

  const renderContact = () => (
    <div className="space-y-12 animate-fadeIn text-slate-100 pb-20">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-[#1f4e4a] pb-8">
        <div className="space-y-2">
          <h2 className="text-4xl font-black text-white uppercase tracking-tighter">Communications</h2>
          <p className="text-[#4ea59d]/60 font-black text-[10px] uppercase tracking-[0.4em]">Connect with your community</p>
        </div>
      </header>

      <Messaging currentUser={user} schoolId={schoolId || ''} />
    </div>
  );

  const renderAboutSchool = () => (
    <div className="space-y-12 animate-fadeIn text-slate-100 pb-20">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-[#1f4e4a] pb-8">
        <div className="space-y-2">
          <h2 className="text-4xl font-black text-white uppercase tracking-tighter">About School</h2>
          <p className="text-[#4ea59d]/60 font-black text-[10px] uppercase tracking-[0.4em]">Institutional Profile & Vision</p>
        </div>
      </header>
      <SchoolInfo schoolId={schoolId || ''} />
    </div>
  );

  const renderCourseDetail = () => {
    if (!selectedCourse) return null;
    return (
      <>
        <div className="space-y-12 animate-fadeIn text-slate-100 pb-20">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-[#1f4e4a] pb-8">
          <div className="space-y-4 flex-1">
            <button onClick={() => setCurrentView('courses')} className="text-[#4ea59d] font-black uppercase text-[10px] tracking-widest flex items-center gap-2 group">
              <i className="fa-solid fa-arrow-left transition-transform group-hover:-translate-x-1"></i> Back to Courses
            </button>
            <h2 className="text-5xl font-black text-white uppercase tracking-tight leading-none">{selectedCourse.title}</h2>
            <div className="flex flex-wrap gap-4 pt-2">
              <span className="bg-[#4ea59d]/10 text-[#4ea59d] px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border border-[#4ea59d]/20">
                {selectedCourse.category}
              </span>
              <span className="bg-blue-500/10 text-blue-500 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border border-blue-500/20 flex items-center gap-2">
                <i className="fa-solid fa-clock"></i> {selectedCourse.scheduleDescription}
              </span>
            </div>
          </div>
          {selectedCourse.onlineClassUrl && (
            <a href={selectedCourse.onlineClassUrl} target="_blank" rel="noopener noreferrer" className="px-8 py-4 bg-[#4ea59d] text-white rounded-[24px] text-xs font-black uppercase tracking-[0.2em] shadow-xl shadow-[#4ea59d]/30 hover:scale-105 transition-all flex items-center gap-3">
              <i className="fa-solid fa-video animate-pulse"></i> Join Online Class
            </a>
          )}
        </header>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-12">
          <div className="xl:col-span-2 space-y-12">
            {user.role === UserRole.TEACHER && (
              <section className="bg-white/10 backdrop-blur-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] p-10 rounded-[40px] border border-white/20 shadow-xl">
                <h3 className="text-2xl font-black text-white uppercase tracking-tight mb-8">Course Attendance</h3>
                <DailyAttendancePage
                  schoolId={schoolId || ''}
                  students={selectedCourseStudents}
                  allStudents={selectedCourseStudents}
                  classes={[]} 
                  subjects={[{ id: selectedCourse.id, name: selectedCourse.title }]}
                  notify={(message) => console.log(message)}
                />
              </section>
            )}

            <section className="bg-white/10 backdrop-blur-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] p-10 rounded-[40px] border border-white/20 shadow-xl">
              <h3 className="text-2xl font-black text-white uppercase tracking-tight mb-6 flex items-center gap-4">
                <i className="fa-solid fa-compass text-[#4ea59d]"></i> Module Introduction
              </h3>
              <p className="text-slate-200 text-lg leading-relaxed ">{selectedCourse.moduleIntro}</p>
              <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-4">
                {selectedCourse.topics.map((t, i) => (
                  <div key={i} className="flex items-center gap-4 p-4 bg-[#0a1a19] rounded-2xl border border-white/20">
                    <div className="w-8 h-8 rounded-full bg-[#4ea59d]/10 text-[#4ea59d] flex items-center justify-center text-xs font-black">
                      {i + 1}
                    </div>
                    <span className="text-sm font-bold text-white">{t}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="bg-white/10 backdrop-blur-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] p-10 rounded-[40px] border border-white/20 shadow-xl">
              <div 
                className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-8 cursor-pointer group"
                onClick={() => setIsResourcesSectionOpen(!isResourcesSectionOpen)}
              >
                <h3 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-4">
                  <i className={`fa-solid fa-chevron-right text-[#4ea59d] text-sm transition-transform duration-300 ${isResourcesSectionOpen ? 'rotate-90 shadow-lg' : ''}`}></i>
                  <i className="fa-solid fa-book-open text-[#4ea59d]"></i> Learning Resources
                </h3>
                <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                  {user.role === UserRole.TEACHER && (
                    <>
                      <button
                        onClick={() => setIsCreateFolderModalOpen(true)}
                        className="px-5 py-2.5 bg-white/5 border border-white/10 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:border-[#4ea59d] hover:text-[#4ea59d] transition-all flex items-center gap-2 group/btn"
                      >
                        <i className="fa-solid fa-folder-plus transition-transform group-hover/btn:scale-110"></i> Add Folder
                      </button>
                      <button
                        onClick={() => {
                          setResourceTitle('');
                          setResourceContent('');
                          setResourceFile(null);
                          setSelectedUploadFolder('');
                          setIsUploadResourceModalOpen(true);
                        }}
                        className="px-5 py-2.5 bg-[#4ea59d] text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all flex items-center gap-2 shadow-lg shadow-[#4ea59d]/20"
                      >
                        <i className="fa-solid fa-cloud-arrow-up"></i> Upload File
                      </button>
                    </>
                  )}
                  <div className={`w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-[#4ea59d] transition-all duration-300 ${!isResourcesSectionOpen ? 'animate-pulse bg-[#4ea59d]/10' : ''}`}>
                    <i className={`fa-solid ${isResourcesSectionOpen ? 'fa-eye' : 'fa-eye-slash'} text-[10px]`}></i>
                  </div>
                </div>
              </div>

              {isResourcesSectionOpen && (
                <div className="space-y-8 animate-fadeIn">
                  {(() => {
                    const items = (selectedCourse.notes as any[]) || [];
                    const folders = items.filter(i => i.type === 'folder');
                    const rootFiles = items.filter(i => i.type === 'file' && !i.folder);

                    return (
                      <div className="space-y-8">
                        {/* 1. Folders Section */}
                        {folders.map(folder => {
                          const folderFiles = items.filter(i => i.type === 'file' && i.folder === folder.title);
                          const isExpanded = openFolders.has(folder.title);

                          return (
                            <div key={folder.id} className="space-y-6">
                              <div
                                onClick={() => toggleFolder(folder.title)}
                                className="p-8 bg-[#4ea59d]/5 backdrop-blur-md rounded-[40px] border border-[#4ea59d]/20 hover:border-[#4ea59d]/40 transition-all cursor-pointer group flex items-center justify-between"
                              >
                                <div className="flex items-center gap-6">
                                  <div className={`w-14 h-14 rounded-2xl ${isExpanded ? 'bg-[#4ea59d] text-white' : 'bg-[#4ea59d]/10 text-[#4ea59d]'} flex items-center justify-center text-2xl transition-all group-hover:scale-110`}>
                                    <i className={`fa-solid ${isExpanded ? 'fa-folder-open' : 'fa-folder'}`}></i>
                                  </div>
                                  <div>
                                    <h4 className="text-xl font-black text-white uppercase tracking-tight">{folder.title}</h4>
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{folderFiles.length} Resource Items</p>
                                  </div>
                                </div>
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center border border-white/10 text-[#4ea59d] transition-transform duration-500 ${isExpanded ? 'rotate-180 bg-white/10' : ''}`}>
                                  <i className="fa-solid fa-chevron-down text-xs"></i>
                                </div>
                              </div>

                              {isExpanded && (
                                <div className="ml-10 space-y-6 border-l-2 border-[#1f4e4a] pl-10 animate-slideDown">
                                  {folderFiles.length === 0 ? (
                                    <p className="text-xs font-black text-slate-500 uppercase tracking-widest py-4">No files in this folder.</p>
                                  ) : folderFiles.map(note => (
                                    <div key={note.id} className="p-8 bg-[#0a1a19] rounded-[40px] border border-white/20 space-y-4 transition-all hover:border-[#4ea59d]/30">
                                      <div className="flex justify-between items-start flex-col sm:flex-row gap-4">
                                        <h4 className="text-xl font-black text-white">{note.title}</h4>
                                        {note.ebookUrl && (
                                          <a href={note.ebookUrl} target="_blank" rel="noopener noreferrer" className="px-5 py-2.5 bg-[#4ea59d]/10 border border-[#4ea59d]/20 text-[#4ea59d] rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-[#4ea59d] hover:text-white transition-all flex items-center gap-2">
                                            <i className="fa-solid fa-download"></i> Download Asset
                                          </a>
                                        )}
                                      </div>
                                      <p className="text-base text-slate-300 leading-relaxed">{note.content}</p>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}

                        {/* 2. Root Files Section */}
                        {rootFiles.map(note => (
                          <div key={note.id} className="p-8 bg-[#0a1a19] rounded-[40px] border border-white/20 space-y-4 transition-all hover:border-[#4ea59d]/30 shadow-xl">
                            <div className="flex justify-between items-start flex-col sm:flex-row gap-4">
                              <h4 className="text-xl font-black text-white">{note.title}</h4>
                              {note.ebookUrl && (
                                <a href={note.ebookUrl} target="_blank" rel="noopener noreferrer" className="px-5 py-2.5 bg-[#4ea59d]/10 border border-[#4ea59d]/20 text-[#4ea59d] rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-[#4ea59d] hover:text-white transition-all flex items-center gap-2">
                                  <i className="fa-solid fa-download"></i> Download Resource
                                </a>
                              )}
                            </div>
                            <p className="text-base text-slate-300 leading-relaxed">{note.content}</p>
                          </div>
                        ))}

                        {items.length === 0 && (
                          <div className="p-12 text-center bg-[#0a1a19] rounded-[40px] border border-dashed border-[#1f4e4a] text-slate-300 font-black uppercase tracking-widest animate-pulse">
                            No learning materials available yet.
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}
            </section>


          </div>

          <div className="space-y-8">
            <section className="bg-white/10 backdrop-blur-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] p-8 rounded-[40px] border border-white/20 shadow-xl">
              <h3 className="text-lg font-black text-white uppercase tracking-tight mb-8">Faculty Details</h3>
              <div className="space-y-6 max-h-[440px] overflow-y-auto pr-2 custom-scrollbar">
                {selectedClassTeachers.length > 0 ? (
                  selectedClassTeachers.map((teacher, idx) => (
                    <div key={teacher.id || idx} className="p-6 bg-[#0a1a19] rounded-3xl border border-white/20 flex items-center gap-4 group hover:border-[#4ea59d] transition-all cursor-default">
                      <div className="w-14 h-14 rounded-2xl bg-purple-500/10 text-purple-500 flex items-center justify-center text-xl shrink-0 group-hover:scale-105 transition-transform">
                        {teacher.avatar ? <img src={getStudentAvatarUrl(teacher.avatar) || ''} alt="" className="w-full h-full object-cover rounded-2xl shadow-lg" /> : <i className="fa-solid fa-user-tie"></i>}
                      </div>
                      <div>
                        <p className="text-[9px] font-black text-[#4ea59d] uppercase tracking-widest">Teacher</p>
                        <p className="text-base font-bold text-white group-hover:text-[#4ea59d] transition-colors">{teacher.name}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-6 bg-[#0a1a19] rounded-3xl border border-white/20 flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-purple-500/10 text-purple-500 flex items-center justify-center text-xl shrink-0">
                      <i className="fa-solid fa-user-tie"></i>
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Lead Professor</p>
                      <p className="text-base font-bold text-white">{selectedCourse.subTeacherName || "Lead Professor"}</p>
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* Dynamic Course Schedule */}
            <section className="bg-white/10 backdrop-blur-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] p-8 rounded-[40px] border border-white/20 shadow-xl">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-black text-white uppercase tracking-tight">Live Course Schedule</h3>
                <span className="px-3 py-1 bg-[#4ea59d]/10 text-[#4ea59d] text-[8px] font-black uppercase tracking-widest rounded-full border border-[#4ea59d]/20">
                  {courseTimetable.length} Sessions
                </span>
              </div>

              <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                {isLoadingCourseTimetable ? (
                  <div className="py-10 text-center space-y-3 animate-pulse">
                    <i className="fa-solid fa-spinner animate-spin text-[#4ea59d] text-2xl"></i>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest ">Synchronizing Intel...</p>
                  </div>
                ) : courseTimetable.length > 0 ? (
                  courseTimetable.map((event, idx) => (
                    <div key={event.id || idx} className="p-5 bg-[#0a1a19] rounded-2xl border border-white/10 hover:border-[#4ea59d]/50 transition-all group">
                      <div className="flex justify-between items-start mb-2">
                        <p className="text-[10px] font-black text-[#4ea59d] uppercase tracking-widest group-hover:translate-x-1 transition-transform">
                          {new Date(event.event_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                        </p>
                        <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400">
                          <i className="fa-solid fa-clock"></i>
                          {event.start_time.slice(0, 5)} - {event.end_time.slice(0, 5)}
                        </div>
                      </div>
                      <h4 className="text-sm font-black text-white group-hover:text-[#4ea59d] transition-colors">{event.title}</h4>
                      {event.notes && <p className="mt-2 text-[10px] text-slate-500 italic leading-relaxed">{event.notes}</p>}
                    </div>
                  ))
                ) : (
                  <div className="py-10 text-center border-2 border-dashed border-white/5 rounded-3xl">
                    <i className="fa-solid fa-calendar-xmark text-slate-700 text-2xl mb-3"></i>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">No active sessions found</p>
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>
      </div>

        {/* --- TEACHER RESOURCE MODALS --- */}
        {isCreateFolderModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md animate-fadeIn">
            <div className="w-full max-w-lg bg-[#0a1a19] border border-white/20 rounded-[48px] overflow-hidden shadow-4xl p-10 space-y-8 text-slate-100">
              <div className="space-y-2">
                <h3 className="text-3xl font-black text-white uppercase tracking-tighter">Create Folder</h3>
                <p className="text-[10px] font-black text-[#4ea59d] uppercase tracking-[0.4em]">Organize your library</p>
              </div>

              <div className="space-y-6">
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Folder Name</label>
                  <input
                    type="text"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    placeholder="e.g., Unit 1: Fundamentals"
                    className="w-full px-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-white focus:border-[#4ea59d] transition-all outline-none"
                  />
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  onClick={() => setIsCreateFolderModalOpen(false)}
                  className="flex-1 py-4 bg-white/5 border border-white/10 text-slate-400 rounded-2xl text-xs font-black uppercase tracking-widest hover:text-white transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateFolder}
                  disabled={isSavingTeacherData || !newFolderName}
                  className="flex-1 py-4 bg-[#4ea59d] text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:scale-105 transition-all shadow-xl shadow-[#4ea59d]/20 disabled:opacity-50 disabled:scale-100"
                >
                  {isSavingTeacherData ? <i className="fas fa-spinner fa-spin mr-2"></i> : <i className="fa-solid fa-check mr-2"></i>}
                  Create Folder
                </button>
              </div>
            </div>
          </div>
        )}

        {isUploadResourceModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md animate-fadeIn">
            <div className="w-full max-w-2xl bg-[#0a1a19] border border-white/20 rounded-[48px] overflow-hidden shadow-4xl p-10 space-y-8 text-slate-100">
              <div className="space-y-2">
                <h3 className="text-3xl font-black text-white uppercase tracking-tighter">Upload Resource</h3>
                <p className="text-[10px] font-black text-[#4ea59d] uppercase tracking-[0.4em]">Broadcast New Materials</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Asset Title</label>
                    <input
                      type="text"
                      value={resourceTitle}
                      onChange={(e) => setResourceTitle(e.target.value)}
                      placeholder="e.g., Lesson 1 Overview"
                      className="w-full px-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-white focus:border-[#4ea59d] transition-all outline-none"
                    />
                  </div>

                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Target Folder (Optional)</label>
                    <div className="relative">
                      <select
                        value={selectedUploadFolder}
                        onChange={(e) => setSelectedUploadFolder(e.target.value)}
                        className="w-full px-6 py-4 bg-[#0a1a19] border border-white/10 rounded-2xl text-white focus:border-[#4ea59d] transition-all outline-none appearance-none cursor-pointer"
                      >
                        <option value="" className="bg-[#0a1a19] text-white">Root Library</option>
                        {((selectedCourse.notes as any[]) || [])
                          .filter(i => i.type === 'folder')
                          .map(f => (
                            <option key={f.id} value={f.title} className="bg-[#0a1a19] text-white">{f.title}</option>
                          ))
                        }
                      </select>
                      <i className="fa-solid fa-chevron-down absolute right-6 top-1/2 -translate-y-1/2 text-[10px] text-slate-500 pointer-events-none"></i>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">File Attachment</label>
                    <div className="relative group">
                      <input
                        type="file"
                        onChange={(e) => setResourceFile(e.target.files?.[0] || null)}
                        className="absolute inset-0 opacity-0 cursor-pointer z-10"
                      />
                      <div className="w-full px-6 py-8 bg-white/5 border-2 border-dashed border-white/10 rounded-2xl group-hover:border-[#4ea59d]/50 transition-all text-center space-y-3">
                        <i className={`fa-solid ${resourceFile ? 'fa-file-circle-check text-[#4ea59d]' : 'fa-cloud-arrow-up text-slate-500'} text-3xl`}></i>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest truncate">
                          {resourceFile ? resourceFile.name : 'Select or Drag Dossier'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Description</label>
                    <textarea
                      value={resourceContent}
                      onChange={(e) => setResourceContent(e.target.value)}
                      placeholder="Contextual details for students..."
                      rows={2}
                      className="w-full px-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-white focus:border-[#4ea59d] transition-all outline-none resize-none"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  onClick={() => setIsUploadResourceModalOpen(false)}
                  className="flex-1 py-4 bg-white/5 border border-white/10 text-slate-400 rounded-2xl text-xs font-black uppercase tracking-widest hover:text-white transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUploadResource}
                  disabled={isSavingTeacherData || !resourceTitle || !resourceFile}
                  className="flex-1 py-4 bg-[#4ea59d] text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:scale-105 transition-all shadow-xl shadow-[#4ea59d]/20 disabled:opacity-50 disabled:scale-100"
                >
                  {isSavingTeacherData ? <i className="fas fa-spinner fa-spin mr-2"></i> : <i className="fa-solid fa-upload mr-2"></i>}
                  Execute Upload
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  };

  const renderQuizPlayer = () => {
    if (!activeQuiz) return null;
    return (
      <div className="space-y-8 animate-fadeIn text-slate-100 pb-20">
        <header className="flex justify-between items-center">
          <h2 className="text-3xl font-black text-white uppercase tracking-tight">{activeQuiz.title}</h2>
          <button onClick={() => setCurrentView('course-detail')} className="px-6 py-3 bg-[#1f4e4a] hover:bg-[#4ea59d] text-white rounded-2xl text-xs font-bold transition-all">Exit Quiz</button>
        </header>
        <div className="max-w-3xl mx-auto space-y-6">
          {activeQuiz.questions.map((q, qIdx) => (
            <div key={qIdx} className="bg-white/10 backdrop-blur-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] p-8 rounded-[32px] border border-white/20 shadow-xl">
              <h4 className="text-lg font-bold text-white mb-6 flex gap-4"><span className="text-[#4ea59d]">Q{qIdx + 1}.</span>{q.question}</h4>
              <div className="grid grid-cols-1 gap-3">
                {q.options.map((opt, oIdx) => (
                  <button key={oIdx} className="p-5 text-left bg-[#0a1a19] border border-white/20 rounded-2xl hover:border-[#4ea59d] transition-all text-sm">{opt}</button>
                ))}
              </div>
            </div>
          ))}
          <button
            onClick={() => {
              setConfirmDialog({
                title: 'Quiz Submitted',
                message: 'Your answers have been securely transmitted to the faculty board. Evaluation is now in progress.',
                type: 'info',
                onConfirm: () => {
                  setConfirmDialog(null);
                  setCurrentView('course-detail');
                }
              });
            }}
            className="w-full py-5 bg-[#4ea59d] text-white rounded-[24px] font-black uppercase tracking-[0.2em] shadow-xl"
          >
            Submit Answers
          </button>
        </div>
      </div>
    );
  };

  const renderLiveIntelDetail = () => {
    if (!selectedLiveIntel) return null;
    return (
      <div className="space-y-12 animate-fadeIn text-slate-100 pb-20">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-[#1f4e4a] pb-8">
          <div className="space-y-4 flex-1">
            <button onClick={() => setCurrentView('dashboard')} className="text-[#4ea59d] font-black uppercase text-[10px] tracking-widest flex items-center gap-2 group">
              <i className="fa-solid fa-arrow-left transition-transform group-hover:-translate-x-1"></i> Back to Dashboard
            </button>
            <h2 className="text-5xl font-black text-white uppercase tracking-tight leading-none">{selectedLiveIntel.title}</h2>
            <div className="flex flex-wrap gap-4 pt-2">
              <span className="bg-emerald-500/10 text-emerald-500 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border border-emerald-500/20 flex items-center gap-2">
                <i className="fa-solid fa-clock"></i> {selectedLiveIntel.date}
              </span>
            </div>
          </div>
        </header>

        <section className="bg-white/10 backdrop-blur-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] p-10 rounded-[40px] border border-white/20 shadow-xl max-w-4xl">
          <h3 className="text-2xl font-black text-white uppercase tracking-tight mb-6 flex items-center gap-4">
            <i className="fa-solid fa-circle-info text-[#4ea59d]"></i> Live Intel
          </h3>
          <p className="text-lg text-slate-200 leading-relaxed font-medium whitespace-pre-wrap">
            {selectedLiveIntel.content}
          </p>

          {selectedLiveIntel.attachment_url && (
            <div className="mt-10 pt-8 border-t border-white/10">
              <h4 className="text-xs font-black text-[#4ea59d] uppercase tracking-[0.2em] mb-4">Attached Intel Dossier</h4>

              {/* Image Preview */}
              {/\.(jpg|jpeg|png|gif|webp|svg)$/i.test(selectedLiveIntel.attachment_url) && (
                <div className="mb-6 rounded-3xl overflow-hidden border border-white/10 shadow-2xl max-w-2xl">
                  <img
                    src={selectedLiveIntel.attachment_url}
                    alt="Intel Attachment Preview"
                    className="w-full h-auto object-cover hover:scale-105 transition-transform duration-700"
                  />
                </div>
              )}

              <a
                href={selectedLiveIntel.attachment_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-4 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 px-6 py-4 rounded-2xl transition-all border border-emerald-500/30 group/file"
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center group-hover/file:scale-110 transition-transform">
                  <i className={`fa-solid ${/\.(jpg|jpeg|png|gif|webp|svg)$/i.test(selectedLiveIntel.attachment_url) ? 'fa-file-image' : 'fa-file-pdf'}`}></i>
                </div>
                <div className="text-left">
                  <p className="text-xs font-black uppercase tracking-widest">Download Attachment</p>
                  <p className="text-[10px] opacity-60">Intelligence Asset • Manual Dispatch</p>
                </div>
                <i className="fa-solid fa-download ml-4 opacity-40 group-hover/file:opacity-100 group-hover/file:translate-y-0.5 transition-all"></i>
              </a>
            </div>
          )}
        </section>
      </div>
    );
  };

  const renderExams = () => (
    <div className="animate-fadeIn">
      <TeacherExams
        supabase={supabase}
        schoolId={schoolId || ''}
        assignedCourses={assignedCoursesList}
      />
    </div>
  );

  if (!isLoggedIn) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="flex flex-col md:flex-row bg-[#0a1a19] min-h-screen text-[#f1f5f9] relative">
      {/* Background Ambient Orbs for Glass Effect */}
      <div className="fixed top-[-10%] left-[-5%] w-[500px] h-[500px] bg-[#4ea59d]/20 rounded-full blur-[120px] pointer-events-none z-[0]"></div>
      <div className="fixed bottom-[-10%] right-[-5%] w-[600px] h-[600px] bg-[#1f4e4a]/40 rounded-full blur-[150px] pointer-events-none z-0"></div>
      <header className="md:hidden flex items-center justify-between p-4 bg-[#0a1a19]/40 backdrop-blur-xl shadow-lg border-b border-[#1f4e4a] sticky top-0 z-[50]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[#4ea59d] rounded-lg flex items-center justify-center text-white"><i className="fa-solid fa-graduation-cap"></i></div>
          <h1 className="text-lg font-black tracking-tighter text-white uppercase ">IEM</h1>
        </div>
        <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="text-white p-2">
          <i className={`fa-solid ${isSidebarOpen ? 'fa-xmark' : 'fa-bars'} text-xl`}></i>
        </button>
      </header>

      <Sidebar
        currentView={currentView}
        onViewChange={setCurrentView}
        onLogout={handleLogout}
        userRole={user.role}
        userEmail={user.email}
        userName={user.name}
        hasNewNotices={hasNewNotices}
        unreadMessagesCount={unreadMessagesCount}
        isOpen={isSidebarOpen}
        onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
        isCollapsed={isSidebarCollapsed}
        onCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        onSwitch={onSwitch}
        schoolName={schoolName}
      />
      <main className={`flex-1 transition-all duration-300 p-6 md:p-8 overflow-x-hidden ${isSidebarOpen ? 'hidden md:block' : 'block'} ${isSidebarCollapsed ? 'md:ml-20' : 'md:ml-72'}`}>
        {currentView === 'dashboard' && renderDashboard()}
        {currentView === 'notice-board' && renderNoticeBoard()}
        {currentView === 'notice-detail' && renderNoticeDetail()}
        {currentView === 'parent-portal' && renderParentPortal()}
        {currentView === 'instruction' && renderInstruction()}
        {currentView === 'activity' && renderActivity()}
        {currentView === 'homework' && renderHomework()}
        {currentView === 'courses' && renderCourses()}
        {currentView === 'class-detail' && renderClassDetail()}
        {currentView === 'course-detail' && renderCourseDetail()}
        {currentView === 'quiz-player' && renderQuizPlayer()}
        {currentView === 'studies' && user.role !== UserRole.TEACHER && renderStudies()}
        {currentView === 'contact' && renderContact()}
        {currentView === 'about-school' && renderAboutSchool()}
        {currentView === 'live-intel-detail' && renderLiveIntelDetail()}
        {currentView === 'exams' && renderExams()}
        {currentView === 'timetable' && <LiveCalendar schoolId={schoolId} />}
        {currentView === 'profile' && (
          <div className="space-y-8 animate-fadeIn text-slate-100">
            <h2 className="text-2xl md:text-3xl font-black text-white uppercase tracking-tight">STUDENT PROFILE</h2>
            <div className="bg-white/10 backdrop-blur-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] p-6 md:p-10 rounded-[32px] md:rounded-[40px] border border-white/20 max-w-4xl shadow-2xl relative overflow-hidden">
              <div className="flex flex-col md:flex-row gap-6 md:gap-10 items-start relative z-10">
                <div className="flex flex-col items-center gap-4">
                  <div className="relative group">
                    <img src={user.avatar} className="w-32 h-32 md:w-40 md:h-40 rounded-[24px] md:rounded-[40px] border-4 border-[#4ea59d] p-1 shadow-2xl object-cover" />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingAvatar}
                      className="absolute inset-0 bg-black/40 rounded-[24px] md:rounded-[40px] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white"
                    >
                      <div className="text-center">
                        <i className={`fa-solid ${uploadingAvatar ? 'fa-spinner animate-spin' : 'fa-camera'} text-2xl mb-1`}></i>
                        <p className="text-[10px] font-black uppercase tracking-widest">{uploadingAvatar ? 'Uploading...' : 'Change Photo'}</p>
                      </div>
                    </button>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleAvatarUpload}
                      className="hidden"
                      accept="image/*"
                    />
                  </div>
                  <div className="px-4 py-2 bg-[#4ea59d]/20 rounded-xl border border-[#4ea59d]/30 text-center">
                    <p className="text-[10px] font-black text-[#4ea59d] uppercase">Attendance</p>
                    <p className="text-xl font-black text-white">{studentAttendanceRate}</p>
                  </div>
                </div>
                <div className="flex-1 space-y-6 text-center sm:text-left">
                  <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                    <div>
                      <p className="text-[9px] font-black text-[#4ea59d] uppercase mb-1">Full Name</p>
                      <h3 className="text-2xl md:text-4xl font-black text-white tracking-tight">{user.name}</h3>
                    </div>
                    <div className="bg-white/5 px-4 py-2 rounded-2xl border border-white/10">
                      <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Grade / Level</p>
                      <p className="text-sm font-black text-[#4ea59d]">{user.grade || 'N/A'}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-6 border-t border-white/5">
                    <div className="space-y-1">
                      <p className="text-[9px] font-black text-slate-400 uppercase flex items-center gap-2">
                        <i className="fa-solid fa-envelope text-[#4ea59d]"></i> Email Address
                      </p>
                      <p className="text-sm font-bold text-slate-200 truncate">{user.email}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[9px] font-black text-slate-400 uppercase flex items-center gap-2">
                        <i className="fa-solid fa-id-card text-[#4ea59d]"></i> Student ID
                      </p>
                      <p className="text-sm font-mono font-bold text-slate-200">{user.studentId || 'N/A'}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[9px] font-black text-slate-400 uppercase flex items-center gap-2">
                        <i className="fa-solid fa-cake-candles text-[#4ea59d]"></i> Date of Birth
                      </p>
                      <p className="text-sm font-bold text-slate-200">{user.dob ? new Date(user.dob).toLocaleDateString() : 'N/A'}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[9px] font-black text-slate-400 uppercase flex items-center gap-2">
                        <i className="fa-solid fa-phone text-[#4ea59d]"></i> Student Phone
                      </p>
                      <p className="text-sm font-bold text-slate-200">{user.phone || 'N/A'}</p>
                    </div>
                    <div className="space-y-1 md:col-span-2 lg:col-span-2">
                      <p className="text-[9px] font-black text-slate-400 uppercase flex items-center gap-2">
                        <i className="fa-solid fa-location-dot text-[#4ea59d]"></i> Residential Address
                      </p>
                      <p className="text-sm font-bold text-slate-200 break-words">{user.address || 'N/A'}</p>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-white/5">
                    <h4 className="text-[10px] font-black text-[#4ea59d] uppercase tracking-widest mb-4 flex items-center gap-2">
                      <i className="fa-solid fa-users-gear"></i> Guardian Information
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white/5 p-6 rounded-3xl border border-white/5">
                      <div className="space-y-1">
                        <p className="text-[9px] font-black text-slate-400 uppercase">Primary Guardian</p>
                        <p className="text-sm font-bold text-white">{user.parentName || 'N/A'}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[9px] font-black text-slate-400 uppercase">Contact Number</p>
                        <p className="text-sm font-bold text-white">{user.parentPhone || 'N/A'}</p>
                      </div>
                      <div className="md:col-span-2 space-y-1">
                        <p className="text-[9px] font-black text-slate-400 uppercase">Guardian Email</p>
                        <p className="text-sm font-bold text-white">{user.parentEmail || 'N/A'}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {isLoading && (
        <div className="fixed inset-0 bg-[#0a1a19]/80 backdrop-blur-md flex items-center justify-center z-[200] animate-fadeIn">
          <div className="flex flex-col items-center">
            <div className="w-20 h-20 border-4 border-[#4ea59d]/20 border-t-[#4ea59d] rounded-full animate-spin mb-6"></div>

            <p className="text-[#4ea59d] mt-2 animate-pulse uppercase text-[10px] font-black tracking-widest">Processing request</p>
          </div>
        </div>
      )}
      {/* Homework Submission Modal */}
      {isSubmissionModalOpen && selectedAssignment && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-xl bg-[#0a1a19] rounded-[32px] sm:rounded-[40px] border border-white/20 p-5 sm:p-8 shadow-2xl animate-in zoom-in duration-300 max-h-[95vh] overflow-y-auto custom-scrollbar">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-black text-white tracking-tighter uppercase underline decoration-[#4ea59d] decoration-4 underline-offset-8">Submit Homework</h3>
              <button
                onClick={() => setIsSubmissionModalOpen(false)}
                className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white hover:bg-white/10 transition-colors"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-[10px] font-black text-[#4ea59d] uppercase tracking-widest mb-2">Assignment</label>
                <div className="p-4 bg-white/5 rounded-2xl border border-white/10 text-white font-bold">
                  {selectedAssignment.title}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-[#4ea59d] uppercase tracking-widest mb-2">Upload PDF (Max 200 MB)</label>
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    if (file && file.size > MAX_SUBMISSION_FILE_SIZE) {
                      setSubmissionFileError('File exceeds 200 MB limit. Please choose a smaller PDF.');
                      setSubmissionFile(null);
                      e.target.value = '';
                    } else {
                      setSubmissionFileError(null);
                      setSubmissionFile(file);
                    }
                  }}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-black file:bg-[#4ea59d] file:text-white hover:file:bg-[#3d8c85]"
                />
                {submissionFileError && (
                  <p className="mt-2 text-[10px] font-black text-red-400 uppercase tracking-wider flex items-center gap-1">
                    <i className="fa-solid fa-circle-exclamation"></i> {submissionFileError}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-[10px] font-black text-[#4ea59d] uppercase tracking-widest mb-2">Comments (Optional)</label>
                <textarea
                  value={submissionComment}
                  onChange={(e) => setSubmissionComment(e.target.value)}
                  placeholder="Add any notes here..."
                  className="w-full h-32 bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#4ea59d] transition-colors resize-none"
                />
              </div>

              <button
                onClick={() => setShowSubmitConfirm(true)}
                disabled={isSubmitting || !submissionFile || !!submissionFileError || submissionStatus === 'success'}
                className="w-full py-4 bg-[#4ea59d] hover:bg-[#3d8c85] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-2xl font-black uppercase tracking-[0.2em] transition-all shadow-lg shadow-[#4ea59d]/20"
              >
                {isSubmitting ? 'Uploading...' : 'Complete Submission'}
              </button>
            </div>

            {/* Inner Notification Overlay */}
            {submissionStatus !== 'idle' && (
              <div className={`mt-6 p-4 rounded-2xl border flex items-center gap-3 animate-in slide-in-from-top duration-300 ${submissionStatus === 'success' ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-red-500/10 border-red-500/20 text-red-400'
                }`}>
                <i className={`fa-solid ${submissionStatus === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation'}`}></i>
                <p className="text-[10px] font-black uppercase tracking-wider">{statusMessage}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Are You Sure Confirmation Modal */}
      {showSubmitConfirm && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="w-full max-w-sm bg-[#0a1a19] rounded-[32px] border border-white/20 p-8 shadow-2xl text-center">
            <div className="w-16 h-16 bg-[#4ea59d]/10 rounded-full flex items-center justify-center text-[#4ea59d] text-2xl mx-auto mb-6">
              <i className="fa-solid fa-cloud-arrow-up"></i>
            </div>
            <h3 className="text-xl font-black text-white uppercase tracking-tight mb-4">Confirm Submission</h3>
            <p className="text-xs text-slate-400 leading-relaxed mb-8">
              Are you sure you want to submit your homework? This action will register your solution in the SMS records.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => setShowSubmitConfirm(false)}
                className="py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
              >
                Cancel
              </button>
              <button
                onClick={executeHomeworkSubmission}
                className="py-3 bg-[#4ea59d] hover:bg-[#3d8c85] text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-[#4ea59d]/20"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Homework Composer Modal */}
      {isHomeworkComposerOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="w-full max-w-2xl bg-[#0a1a19] rounded-[40px] border border-white/20 p-10 shadow-3xl animate-in zoom-in-95 duration-500 max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex justify-between items-center mb-10">
              <h3 className="text-3xl font-black text-white uppercase tracking-tighter">Create New Assignment</h3>
              <button onClick={() => setIsHomeworkComposerOpen(false)} className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-white hover:bg-white/10 transition-all">
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <div className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-[#4ea59d] uppercase tracking-[0.2em]">Assignment Title</label>
                  <input
                    type="text"
                    value={homeworkTitle}
                    onChange={(e) => setHomeworkTitle(e.target.value)}
                    placeholder="e.g. Calculus Weekly Quiz"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white font-bold focus:border-[#4ea59d] transition-all outline-none"
                  />
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-[#4ea59d] uppercase tracking-[0.2em]">Due Date</label>
                  <input
                    type="date"
                    value={homeworkDueDate}
                    onChange={(e) => setHomeworkDueDate(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white font-bold focus:border-[#4ea59d] transition-all outline-none"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black text-[#4ea59d] uppercase tracking-[0.2em]">Target Course & Class</label>
                <select
                  value={assignedCourseId}
                  onChange={(e) => setAssignedCourseId(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white font-bold focus:border-[#4ea59d] transition-all outline-none appearance-none"
                >
                  <option value="" className="bg-[#0a1a19]">Select Course</option>
                  {assignedCoursesList.map(c => (
                    <option key={c.id} value={c.id} className="bg-[#0a1a19]">{c.className} - {c.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black text-[#4ea59d] uppercase tracking-[0.2em]">Instructions / Description</label>
                <textarea
                  value={homeworkDescription}
                  onChange={(e) => setHomeworkDescription(e.target.value)}
                  placeholder="Provide detailed instructions for the students..."
                  className="w-full h-40 bg-white/5 border border-white/10 rounded-3xl px-6 py-4 text-white font-medium focus:border-[#4ea59d] transition-all outline-none resize-none"
                />
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black text-[#4ea59d] uppercase tracking-[0.2em]">Attachment (PDF preferred)</label>
                <input
                  type="file"
                  onChange={(e) => setHomeworkFile(e.target.files?.[0] || null)}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white text-xs file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-[10px] file:font-black file:bg-[#4ea59d] file:text-white"
                />
              </div>

              <button
                onClick={handleSaveHomework}
                disabled={isSavingTeacherData || !homeworkTitle || !assignedCourseId}
                className="w-full py-5 bg-[#4ea59d] text-white rounded-[24px] font-black uppercase tracking-[0.2em] shadow-xl shadow-[#4ea59d]/20 hover:scale-[1.02] active:scale-95 disabled:opacity-50 transition-all"
              >
                {isSavingTeacherData ? 'Publishing...' : 'Publish Assignment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notice Composer Modal */}
      {isNoticeComposerOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="w-full max-w-2xl bg-[#0a1a19] rounded-[40px] border border-white/20 p-10 shadow-3xl animate-in zoom-in-95 duration-500 max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex justify-between items-center mb-10">
              <h3 className="text-3xl font-black text-white uppercase tracking-tighter">Publish New Notice</h3>
              <button onClick={() => setIsNoticeComposerOpen(false)} className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-white hover:bg-white/10 transition-all">
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <div className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-[#4ea59d] uppercase tracking-[0.2em]">Notice Title</label>
                  <input
                    type="text"
                    value={noticeTitle}
                    onChange={(e) => setNoticeTitle(e.target.value)}
                    placeholder="e.g. Mid-term Postponement"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white font-bold focus:border-[#4ea59d] transition-all outline-none"
                  />
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-[#4ea59d] uppercase tracking-[0.2em]">Notice Date</label>
                  <input
                    type="date"
                    value={noticeDate}
                    onChange={(e) => setNoticeDate(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white font-bold focus:border-[#4ea59d] transition-all outline-none"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <label className="text-[10px] font-black text-[#4ea59d] uppercase tracking-[0.2em]">Target Classes & Courses (Select Multiple)</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-48 overflow-y-auto pr-2 custom-scrollbar p-1">
                  {assignedCoursesList.map(c => {
                    const isSelected = selectedNoticeTargets.some(t => t.courseId === c.id);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setSelectedNoticeTargets(prev => {
                            const exists = prev.some(t => t.courseId === c.id);
                            if (exists) {
                              return prev.filter(t => t.courseId !== c.id);
                            }
                            return [...prev, { classId: c.classId, courseId: c.id, displayName: `${c.className} - ${c.name}` }];
                          });
                        }}
                        className={`group flex items-center justify-between px-5 py-4 rounded-2xl border transition-all hover:scale-[1.02] active:scale-95 ${isSelected
                          ? 'bg-[#4ea59d] border-[#4ea59d] text-white shadow-lg shadow-[#4ea59d]/20'
                          : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 hover:border-white/20'
                          }`}
                      >
                        <span className="text-[11px] font-bold truncate pr-2">{c.className} - {c.name}</span>
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] transition-all ${isSelected
                          ? 'bg-white text-[#4ea59d]'
                          : 'bg-white/10 text-transparent group-hover:text-white/20'
                          }`}>
                          <i className="fa-solid fa-check"></i>
                        </div>
                      </button>
                    );
                  })}
                </div>
                {selectedNoticeTargets.length === 0 && (
                  <p className="text-[10px] font-bold text-rose-500/80 animate-pulse">Please select at least one target for your announcement.</p>
                )}
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black text-[#4ea59d] uppercase tracking-[0.2em]">Priority Status</label>
                <div className="flex gap-4">
                  {['Low', 'Medium', 'High', 'Urgent'].map(p => (
                    <button
                      key={p}
                      onClick={() => setNoticePriority(p as any)}
                      className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${noticePriority === p
                        ? 'bg-[#4ea59d] text-white shadow-lg shadow-[#4ea59d]/20'
                        : 'bg-white/5 text-slate-400 hover:bg-white/10'
                        }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black text-[#4ea59d] uppercase tracking-[0.2em]">Detailed Message</label>
                <textarea
                  value={noticeMessage}
                  onChange={(e) => setNoticeMessage(e.target.value)}
                  placeholder="Compose your notice details here..."
                  className="w-full h-40 bg-white/5 border border-white/10 rounded-3xl px-6 py-4 text-white font-medium focus:border-[#4ea59d] transition-all outline-none resize-none"
                />
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black text-[#4ea59d] uppercase tracking-[0.2em]">Attachment (Optional)</label>
                <input
                  type="file"
                  onChange={(e) => setNoticeFile(e.target.files?.[0] || null)}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white text-xs file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-[10px] file:font-black file:bg-[#4ea59d] file:text-white"
                />
              </div>

              <button
                onClick={handleSaveNotice}
                disabled={isSavingTeacherData || !noticeTitle || !noticeMessage}
                className="w-full py-5 bg-[#4ea59d] text-white rounded-[24px] font-black uppercase tracking-[0.2em] shadow-xl shadow-[#4ea59d]/20 hover:scale-[1.02] active:scale-95 disabled:opacity-50 transition-all"
              >
                {isSavingTeacherData ? 'Publishing...' : 'Publish Notice'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Global Confirmation Modal */}
      {confirmDialog && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="absolute inset-0" onClick={() => setConfirmDialog(null)}></div>
          <div className="relative w-full max-w-md bg-[#0a1a19] border border-white/10 rounded-[40px] p-10 shadow-3xl text-center animate-in zoom-in-95 duration-500">
            <div className="w-20 h-20 bg-[#4ea59d]/10 text-[#4ea59d] rounded-[32px] flex items-center justify-center text-3xl mx-auto mb-8 shadow-inner">
              <i className={`fa-solid ${confirmDialog.type === 'confirm' ? 'fa-triangle-exclamation' : 'fa-circle-check'} animate-pulse`}></i>
            </div>
            <h3 className="text-2xl font-black text-white uppercase tracking-tighter mb-4">{confirmDialog.title}</h3>
            <p className="text-sm font-medium text-slate-400 leading-relaxed mb-10 max-w-[280px] mx-auto">{confirmDialog.message}</p>

            <div className="flex gap-4">
              {confirmDialog.type === 'confirm' && (
                <button
                  onClick={() => setConfirmDialog(null)}
                  className="flex-1 py-4 bg-white/5 border border-white/10 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-white/10 transition-all"
                >
                  Cancel
                </button>
              )}
              <button
                onClick={confirmDialog.onConfirm}
                className="flex-1 py-4 bg-[#4ea59d] text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-[#4ea59d]/20 hover:scale-105 active:scale-95 transition-all"
              >
                {confirmDialog.type === 'confirm' ? 'Confirm' : 'Continue'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
