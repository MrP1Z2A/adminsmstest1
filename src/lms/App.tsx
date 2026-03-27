
import React, { useState, useEffect, useCallback } from 'react';
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

type NoticeItem = {
  id: string;
  title: string;
  content: string;
  date: string;
  priority: 'Low' | 'Medium' | 'High' | 'Urgent';
  fileUrl?: string;
  fileName?: string;
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
  title: string | null;
  reportDate: string | null;
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

const fetchNoticeBoardData = async (schoolId?: string): Promise<NoticeItem[]> => {
  if (!supabase || !isSupabaseConfigured) {
    console.warn('[NoticeBoard] Data fetching skipped: Supabase is not configured. Please ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are valid and the dev server has been restarted.');
    return [];
  }

  let query = supabase
    .from('notice_board')
    .select('id, title, message, notice_date, created_at, priority, file_path, file_name')
    .order('notice_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (schoolId) {
    query = query.eq('school_id', schoolId);
  } else {
    // If no schoolId is provided, return empty to ensure data isolation
    return [];
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as NoticeBoardRow[];

  return rows.map((row) => ({
    id: row.id,
    title: (row.title || 'Untitled Notice').trim(),
    content: (row.message || '').trim() || 'No notice details provided.',
    date: formatNoticeDate(row.notice_date || row.created_at),
    priority: normalizePriority(row.priority),
    fileUrl: getNoticeFileUrl(row.file_path),
    fileName: row.file_name || undefined,
  }));
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
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [calendarDate, setCalendarDate] = useState(new Date(2025, 3, 1));
  const [calendarSubView, setCalendarSubView] = useState<'day' | 'week' | 'month'>('month');

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
      const notices = await fetchNoticeBoardData(schoolId);

      console.log('[NoticeBoard] Notices fetched:', notices);
      setDynamicAnnouncements(notices);

      if (supabase && isSupabaseConfigured) {
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
                  title: rc.title || rc.file_name || 'Official Report Card',
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

            // Fetch School Events
            const { data: schoolEventsData } = await supabase
              .from('events')
              .select('*')
              .eq('school_id', schoolId)
              .order('event_date', { ascending: true });

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

            // Fetch Live Intel
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

            // Fetch Achievements
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
      setLastSyncTime(new Date().toLocaleTimeString());
    } catch (err) {
      console.error("Sync error", err);
      setDynamicAnnouncements([]);
    } finally {
      if (!isSilent) setIsLoading(false);
    }
  }, [schoolId, user.studentId]);

  useEffect(() => {
    if (isLoggedIn) {
      performSmsSync(true);
      if (user.role === UserRole.PARENT) {
        setCurrentView('parent-portal');
      }
    }
  }, [isLoggedIn, user.role, schoolId, performSmsSync]);

  const loadStudentProfile = useCallback(async () => {
    if (!isLoggedIn || !supabase || !isSupabaseConfigured) return;

    let studentQuery = supabase
      .from('students')
      .select('id, name, avatar, email, attendanceRate, school_id, date_of_birth, parent_name, parent_number, parent_email')
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

    // Fetch Grade (Class Name)
    const { data: enrollment } = await supabase
      .from('class_course_students')
      .select('classes(name)')
      .eq('student_id', student.id)
      .limit(1)
      .maybeSingle();

    const grade = (enrollment?.classes as any)?.name || 'N/A';

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
      parentEmail: student.parent_email || undefined
    }));
  }, [isLoggedIn, user.email, schoolId]);

  useEffect(() => {
    void loadStudentProfile();
  }, [loadStudentProfile]);

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
      void loadStudentProfile();
    }, 10000);

    return () => window.clearInterval(refreshInterval);
  }, [isLoggedIn, performSmsSync, loadStudentProfile]);

  const handleLogin = (role: Exclude<UserRole, UserRole.PARENT>, email: string, loginSchoolId?: string, authUserId?: string) => {
    const newUser = {
      ...INITIAL_USER,
      id: authUserId || INITIAL_USER.id,
      role,
      email,
      name: INITIAL_USER.name,
      schoolId: loginSchoolId,
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

  const handleLogout = () => {
    setIsLoggedIn(false);
    setUser(INITIAL_USER);
    setSelectedCourse(null);
    setSelectedNotice(null);
    setActiveQuiz(null);
    setCurrentView('dashboard');
    setIsSidebarOpen(false);
  };

  const handleCourseClick = (course: Course) => {
    setSelectedCourse(course);
    setCurrentView('course-detail');
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

        {/* Metric Row */}
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
        <button
          onClick={() => performSmsSync(false)}
          className="w-full md:w-auto px-4 sm:px-6 py-2.5 bg-[#1f4e4a] border border-[#4ea59d]/20 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-[#4ea59d] transition-all flex items-center justify-center gap-2"
        >
          <i className={`fa-solid fa-rotate ${isLoading ? 'animate-spin' : ''}`}></i> Refresh Notices
        </button>
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
          <div className="space-y-6">
            {dynamicSchoolEvents.length > 0 ? dynamicSchoolEvents.map(ev => (
              <div key={ev.id} className="relative h-48 rounded-[32px] overflow-hidden group cursor-pointer shadow-xl">
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
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
        <div className="xl:col-span-3 space-y-10">
          <section>
            <h3 className="text-xl font-black text-white uppercase tracking-tight mb-8 flex items-center gap-4">
              <i className="fa-solid fa-list-check text-[#4ea59d]"></i> Assigned Homework
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {dynamicAssignments.length === 0 ? (
                <div className="md:col-span-2 p-10 bg-white/5 border border-white/10 rounded-[40px] text-center">
                  <p className="text-slate-400 text-sm">No homework assigned yet. Keep up the good work!</p>
                </div>
              ) : (
                dynamicAssignments.map((ass) => (
                  <div key={ass.id} className="bg-white/10 backdrop-blur-2xl shadow-xl p-8 rounded-[40px] border border-white/20 group hover:border-[#4ea59d]/50 transition-all flex flex-col h-full">
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

                    <div className="mt-auto pt-6 border-t border-white/10 flex items-center justify-between gap-4">
                      {ass.status === 'Active' || ass.status === 'Submitted' ? (
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
                      )}
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
                  <div className="flex items-center gap-3">
                    {ass.status === 'Active' || ass.status === 'Submitted' ? (
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
                    )}

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
      notify={(message) => console.log(message)}
      onOpenCoursePage={({ id }) => {
        const matchedCourse = courses.find(course => String(course.id) === String(id));
        if (!matchedCourse) {
          console.log('Course details page is only available for catalog courses.');
          return;
        }
        handleCourseClick(matchedCourse);
      }}
    />
  );

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
          <div className="max-h-[300px] overflow-y-auto pr-4 custom-scrollbar">
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

      <div className="mt-16">
        <SchoolInfo schoolId={schoolId || ''} />
      </div>
    </div>
  );

  const renderCourseDetail = () => {
    if (!selectedCourse) return null;
    return (
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
              <h3 className="text-xl font-black text-white uppercase tracking-tight mb-8 flex items-center gap-4">
                <i className="fa-solid fa-book-open text-[#4ea59d]"></i> Learning Resources
              </h3>
              <div className="space-y-8">
                {selectedCourse.notes.map(note => (
                  <div key={note.id} className="p-8 bg-[#0a1a19] rounded-[40px] border border-white/20 space-y-6">
                    <div className="flex justify-between items-start flex-col sm:flex-row gap-4">
                      <h4 className="text-xl font-black text-white">{note.title}</h4>
                      {note.ebookUrl && (
                        <a href={note.ebookUrl} target="_blank" rel="noopener noreferrer" className="px-5 py-2.5 bg-[#4ea59d]/10 border border-[#4ea59d]/20 text-[#4ea59d] rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-[#4ea59d] hover:text-white transition-all flex items-center gap-2">
                          <i className="fa-solid fa-download"></i> Download Ebook
                        </a>
                      )}
                    </div>
                    <p className="text-base text-slate-300 leading-relaxed">{note.content}</p>
                    <div className="flex flex-wrap gap-4 pt-4 border-t border-[#1f4e4a]">
                      <button onClick={() => handleSummarize(note)} className="px-6 py-3 bg-[#4ea59d]/10 border border-white/20 text-[#4ea59d] rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-[#4ea59d] hover:text-white transition-all">
                        AI Summary
                      </button>
                      <button onClick={() => handleGenerateQuiz(note)} className="px-6 py-3 bg-orange-500/10 border border-orange-500/30 text-orange-500 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-orange-500 hover:text-white transition-all">
                        Generate Quiz
                      </button>
                    </div>
                    {note.summary && (
                      <div className="mt-8 p-8 bg-[#4ea59d]/5 border-l-8 border-[#4ea59d] rounded-r-[32px] animate-slideIn">
                        <p className="text-[10px] font-black text-[#4ea59d] uppercase tracking-[0.2em] mb-4 ">AI Intelligent Summary</p>
                        <p className="text-base text-slate-400 leading-relaxed">{note.summary}</p>
                      </div>
                    )}
                  </div>
                ))}
                {selectedCourse.notes.length === 0 && (
                  <div className="p-12 text-center bg-[#0a1a19] rounded-[40px] border border-dashed border-[#1f4e4a] text-slate-300 font-black uppercase tracking-widest ">
                    No notes uploaded yet.
                  </div>
                )}
              </div>
            </section>
          </div>

          <div className="space-y-8">
            <section className="bg-white/10 backdrop-blur-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] p-8 rounded-[40px] border border-white/20 shadow-xl">
              <h3 className="text-lg font-black text-white uppercase tracking-tight mb-8">Faculty Details</h3>
              <div className="space-y-6">
                <div className="p-6 bg-[#0a1a19] rounded-3xl border border-white/20 flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-purple-500/10 text-purple-500 flex items-center justify-center text-xl shrink-0">
                    <i className="fa-solid fa-user-tie"></i>
                  </div>
                  <div>
                    <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Faculty Lead</p>
                    <p className="text-base font-bold text-white">{selectedCourse.subTeacherName || "Lead Professor"}</p>
                  </div>
                </div>
                <div className="p-6 bg-[#0a1a19] rounded-3xl border border-white/20 flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-[#4ea59d]/10 text-[#4ea59d] flex items-center justify-center text-xl shrink-0">
                    <i className="fa-solid fa-clock"></i>
                  </div>
                  <div>
                    <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Class Timetable</p>
                    <p className="text-sm font-bold text-white leading-snug">{selectedCourse.scheduleDescription}</p>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
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
        {currentView === 'course-detail' && renderCourseDetail()}
        {currentView === 'quiz-player' && renderQuizPlayer()}
        {currentView === 'studies' && renderStudies()}
        {currentView === 'contact' && renderContact()}
        {currentView === 'live-intel-detail' && renderLiveIntelDetail()}
        {currentView === 'timetable' && <LiveCalendar schoolId={schoolId} />}
        {currentView === 'profile' && (
          <div className="space-y-8 animate-fadeIn text-slate-100">
            <h2 className="text-2xl md:text-3xl font-black text-white uppercase tracking-tight">STUDENT PROFILE</h2>
            <div className="bg-white/10 backdrop-blur-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] p-6 md:p-10 rounded-[32px] md:rounded-[40px] border border-white/20 max-w-4xl shadow-2xl relative overflow-hidden">
              <div className="flex flex-col md:flex-row gap-6 md:gap-10 items-start relative z-10">
                <div className="flex flex-col items-center gap-4">
                  <img src={user.avatar} className="w-32 h-32 md:w-40 md:h-40 rounded-[24px] md:rounded-[40px] border-4 border-[#4ea59d] p-1 shadow-2xl object-cover" />
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
