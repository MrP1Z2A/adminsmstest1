import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';
import { 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, AreaChart, Area, Cell, RadarChart, PolarGrid, PolarAngleAxis, Radar
} from 'recharts';
import { Status, Student, PageId, StudentPermissions } from './types';
import { supabase } from './supabaseClient';
import { authService } from './services/authService';
import { getCurrentTenantContext, withSchoolId } from './services/tenantService';
import CreateSchoolPage from './components/CreateSchoolPage';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import StudentDirectory from './components/StudentDirectory';
import ParentDirectory from './components/ParentDirectory';
import ParentDetailPage from './components/ParentDetailPage';
import RegistrationHub from './components/RegistrationHub';
import TeacherRegistrationHub from './components/TeacherRegistrationHub';
import StudentServiceBatchRegister from './components/StudentServiceBatchRegister';
import AttendanceProtocol from './components/AttendanceProtocol';
import LiveCalendar from './components/LiveCalendar';
import HomeworkManager from './components/HomeworkManager';
import ReportCardPage from './components/Reportcard';
import ExamManagementPage from './components/exammangement.tsx';
import NoticeBoard from './components/NoticeBoard';
import NoticeDetailPage from './components/NoticeDetailPage';
import PaymentFinanceHub from './components/PaymentFinanceHub';
import SecurityPermission from './components/Modals/SecurityPermission';
import EnrollmentModal from './components/Modals/EnrollmentModal';
import TeacherEnrollmentModal from './components/Modals/TeacherEnrollmentModal';
import EditModal from './components/Modals/EditModal';
import PermissionsModal from './components/Modals/PermissionsModal';
import { buildParentEntries } from './components/parentDirectoryUtils';
import logoIem from './src/LOGO_IEM.png';

const DEFAULT_AVATAR = logoIem;

const INITIAL_PERMISSIONS: StudentPermissions = {
  neuralSync: true,
  libraryAccess: true,
  examEntry: true,
  apiAccess: false
};

const INITIAL_STUDENTS: Student[] = [];

const INITIAL_SUBJECTS: any[] = [];

const INITIAL_TEACHERS: Student[] = [];

const INITIAL_LIBRARY: any[] = [];

const INITIAL_EXAMS: any[] = [];

const INITIAL_HOMEWORK: any[] = [];

const INITIAL_PROGRAMS: any[] = [];
const INITIAL_PARENTS: any[] = [];

type AttendanceContextType = 'class' | 'subject';
const CLOUD_SYNC_INTERVAL_SECONDS = 60;

const normalizeClassCodeBase = (name: string) => {
  const sanitized = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  return sanitized || 'class';
};

const getLocalIsoDate = (date: Date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const isCourseAssignmentSchemaMissing = (message?: string | null) => {
  const text = (message || '').toLowerCase();
  return (
    /relation|does not exist|column/.test(text)
    || text.includes('could not find the table')
    || text.includes('schema cache')
  );
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^\d{6,15}$/;

const isValidEmail = (value: string) => EMAIL_PATTERN.test(value.trim());
const normalizeDigits = (value: string) => value.replace(/\D/g, '');
const isValidPhoneDigits = (value: string) => PHONE_PATTERN.test(normalizeDigits(value));
const toInternationalPhone = (countryCode: string, phoneValue: string) => {
  const normalizedCountryCode = String(countryCode || '').trim() || '+1';
  const normalizedPhone = normalizeDigits(phoneValue);
  return `${normalizedCountryCode}${normalizedPhone}`;
};

const getInitialEnrollData = (type: 'New' | 'Old' = 'New') => ({
  name: '',
  email: '',
  role: 'student' as const,
  type,
  selectedStudentId: '',
  selectedClassIds: [] as string[],
  selectedBatchCodes: [] as string[],
  selectedClassCourseIds: [] as string[],
  dateOfBirth: '',
  parentName: '',
  parentCountryCode: '+1',
  parentNumber: '',
  parentEmail: '',
  secondaryParentName: '',
  secondaryParentCountryCode: '+1',
  secondaryParentNumber: '',
  secondaryParentEmail: '',
});

const getInitialTeacherEnrollData = () => ({
  name: '',
  email: '',
});

interface AppProps {
  onSwitch?: () => void;
  schoolId?: string;
  schoolName?: string;
  onSchoolIdChange?: (newId: string | undefined, newName?: string) => void;
}

const App: React.FC<AppProps> = ({ onSwitch, schoolId, schoolName, onSchoolIdChange }) => {
  const [onboardingStatus, setOnboardingStatus] = useState<'loading' | 'needs-school' | 'ready'>('loading');
  const [currentPage, setCurrentPage] = useState<PageId>('dashboard');
  const [selectedNoticeId, setSelectedNoticeId] = useState<string | null>(null);
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null);
  const [selectedClassAttendanceId, setSelectedClassAttendanceId] = useState<string | null>(null);
  const [selectedClassCourse, setSelectedClassCourse] = useState<{ id: string; name: string; classId: string; className?: string } | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'info'} | null>(null);
  const [cloudSyncCountdown, setCloudSyncCountdown] = useState(CLOUD_SYNC_INTERVAL_SECONDS);
  const [isCloudSyncRunning, setIsCloudSyncRunning] = useState(false);
  const isCloudSyncRunningRef = useRef(false);

  // Stateful Data
  const [students, setStudents] = useState<Student[]>(INITIAL_STUDENTS);
  const [attendanceStudents, setAttendanceStudents] = useState<Student[]>(INITIAL_STUDENTS);
  const [subjects, setSubjects] = useState(INITIAL_SUBJECTS);
  const [teachers, setTeachers] = useState<Student[]>(INITIAL_TEACHERS);
  const [libraryItems, setLibraryItems] = useState(INITIAL_LIBRARY);
  const [exams, setExams] = useState(INITIAL_EXAMS);
  const [homeworks, setHomeworks] = useState(INITIAL_HOMEWORK);
  const [programs, setPrograms] = useState(INITIAL_PROGRAMS);
  const [parents, setParents] = useState(INITIAL_PARENTS);
  const [totalEarningMMK, setTotalEarningMMK] = useState(0);
  const [policies, setPolicies] = useState({
    mfaRequired: true,
    ipWhitelist: false,
    sessionTimeout: true,
    bruteForceProtection: true,
    dataEncryption: true
  });
  
  // Filters
  const [selectedDate, setSelectedDate] = useState('');
  const [classes, setClasses] = useState<any[]>([]);
  // const [schoolId, setSchoolId] = useState<string>(''); // Removed in favor of prop schoolId
  const [allStudents, setAllStudents] = useState<any[]>([]);
  const [className, setClassName] = useState('');
  const [classImage, setClassImage] = useState<File | null>(null);
  const [classOuterColor, setClassOuterColor] = useState('#f8fafc');
  const [editingClassId, setEditingClassId] = useState<string | null>(null);
  const [isClassCodeSupported, setIsClassCodeSupported] = useState(true);

  // Attendance State (Subject-specific)
  const [selectedAttendanceSubject, setSelectedAttendanceSubject] = useState<string | null>(null);
  const [attendanceDate, setAttendanceDate] = useState(getLocalIsoDate());
  // Mapping: subjectId -> date -> studentId -> status
  const [subjectAttendanceStore, setSubjectAttendanceStore] = useState<Record<string, Record<string, Record<string, 'P' | 'A' | 'L'>>>>({});
  const [isAttendanceContextNameSupported, setIsAttendanceContextNameSupported] = useState(true);

  // Modals
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false);
  const [enrollData, setEnrollData] = useState(getInitialEnrollData());
  const [enrollClassCourses, setEnrollClassCourses] = useState<Array<{ id: string; name: string; class_id: string }>>([]);
  const [isEnrollClassCoursesLoading, setIsEnrollClassCoursesLoading] = useState(false);
  const [isBatchRegistering, setIsBatchRegistering] = useState(false);
  const [isTeacherEnrollModalOpen, setIsTeacherEnrollModalOpen] = useState(false);
  const [teacherEnrollData, setTeacherEnrollData] = useState(getInitialTeacherEnrollData());
  const [isBatchTeacherRegistering, setIsBatchTeacherRegistering] = useState(false);
  const [studentServiceStaff, setStudentServiceStaff] = useState<Student[]>([]);
  const [isStudentServiceEnrollModalOpen, setIsStudentServiceEnrollModalOpen] = useState(false);
  const [studentServiceEnrollData, setStudentServiceEnrollData] = useState(getInitialTeacherEnrollData());
  const [isBatchStudentServiceRegistering, setIsBatchStudentServiceRegistering] = useState(false);
  const [studentProfileImage, setStudentProfileImage] = useState<File | null>(null);
  const enrollAbortCounterRef = useRef(0);
  const [editTarget, setEditTarget] = useState<{ type: string, data: any } | null>(null);
  const [isPermissionsModalOpen, setIsPermissionsModalOpen] = useState(false);
  const [permTarget, setPermTarget] = useState<Student | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ message: string, onConfirm: () => void | Promise<void> } | null>(null);
  const [studentDeleteDialog, setStudentDeleteDialog] = useState<{ id: string; name: string; entityType: 'student' | 'teacher' } | null>(null);
  const [studentDeleteNameInput, setStudentDeleteNameInput] = useState('');
  const [adminDeletePassword, setAdminDeletePassword] = useState('');
  const [studentDeleteError, setStudentDeleteError] = useState<string | null>(null);
  const [isStudentDeleteSubmitting, setIsStudentDeleteSubmitting] = useState(false);
  const [studentEditAuthDialog, setStudentEditAuthDialog] = useState<Student | null>(null);
  const [studentEditAuthPassword, setStudentEditAuthPassword] = useState('');
  const [studentEditAuthError, setStudentEditAuthError] = useState<string | null>(null);
  const [isStudentEditAuthSubmitting, setIsStudentEditAuthSubmitting] = useState(false);
  const [classDeleteDialog, setClassDeleteDialog] = useState<{ id: string; name: string; onDeleted?: () => void } | null>(null);
  const [classDeleteNameInput, setClassDeleteNameInput] = useState('');
  const [classAdminDeletePassword, setClassAdminDeletePassword] = useState('');
  const [classDeleteError, setClassDeleteError] = useState<string | null>(null);
  const [isClassDeleteSubmitting, setIsClassDeleteSubmitting] = useState(false);
  const [newStudentCredentials, setNewStudentCredentials] = useState<{ name: string; email: string; password: string } | null>(null);

  const stats = useMemo(() => {
    const totalStudents = allStudents.length || students.length;
    const totalTeachers = teachers.length;
    
    // Calculate parents from student records for dashboard consistency
    const totalParents = buildParentEntries(allStudents.length > 0 ? allStudents : students).length;
    
    const totalStudentServices = studentServiceStaff.length;
    const maleStudents = students.filter(student => student.gender === 'Male').length;
    const femaleStudents = students.filter(student => student.gender === 'Female').length;
    const maleTeachers = teachers.filter(teacher => teacher.gender === 'Male').length;
    const femaleTeachers = teachers.filter(teacher => teacher.gender === 'Female').length;

    return {
      totalStudents,
      totalParents,
      totalEarningMMK,
      totalTeachers,
      totalStudentServices,
      genderBreakdown: {
        male: maleStudents,
        female: femaleStudents,
      },
      teacherGenderBreakdown: {
        male: maleTeachers,
        female: femaleTeachers,
      },
    };
  }, [students, teachers, parents, allStudents, totalEarningMMK, studentServiceStaff]);

  const notify = useCallback((message: string) => {
    setNotification({ message, type: 'info' });
    setTimeout(() => setNotification(null), 3000);
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      await authService.signOut();
      if (onSchoolIdChange) onSchoolIdChange(undefined);
      setOnboardingStatus('needs-school');
      notify('Logged out successfully.');
    } catch (error: any) {
      notify(error?.message || 'Failed to log out.');
    }
  }, [notify, onSchoolIdChange]);

  const requireSchoolId = useCallback(async () => {
    if (schoolId) return schoolId;
    const tenant = await getCurrentTenantContext();
    return tenant.schoolId;
  }, [schoolId]);

  // Check onboarding status on mount
  useEffect(() => {
    const checkOnboarding = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setOnboardingStatus('needs-school');
          return;
        }

        let profile: any = null;
        let profileError: any = null;
        let attempts = 0;
        const maxAttempts = 3;

        while (attempts < maxAttempts) {
          const { data, error } = await supabase
            .from('profiles')
            .select('school_id')
            .eq('id', user.id)
            .maybeSingle();
          
          profile = data;
          profileError = error;

          if (!error && data) {
            if (data.school_id && data.school_id !== schoolId && onSchoolIdChange) {
              onSchoolIdChange(String(data.school_id));
            }
            break;
          }
          
          attempts++;
          if (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 800 * attempts)); // Exponential backoff
          }
        }

        if (profileError || !profile?.school_id) {
          setOnboardingStatus('needs-school');
        } else {
          setOnboardingStatus('ready');
        }
      } catch (err) {
        console.error('Onboarding check failed:', err);
        setOnboardingStatus('needs-school');
      }
    };
    void checkOnboarding();
  }, []);

  useEffect(() => {
    if (isDarkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [isDarkMode]);

  const mapStudentFromDB = (student: any): Student => ({
    ...(student as Student),
    role: (student?.role || 'student') as Student['role'],
    gender: (student?.gender || 'Male') as Student['gender'],
    status: (student?.status || Status.PENDING) as Status,
    attendanceRate: typeof student?.attendanceRate === 'number' ? student.attendanceRate : 0,
    courseAttendance: Array.isArray(student?.courseAttendance) ? student.courseAttendance : [],
    securityStatus: student?.securityStatus || { lastLogin: 'Never', twoFactorEnabled: false, trustedDevices: 0, riskLevel: 'Low' },
  });

  const fetchStudentsByDate = async (date: string) => {
    if (!date) return;
    const schoolId = await requireSchoolId();

    const start = new Date(date);
    start.setHours(0, 0, 0, 0);

    const end = new Date(date);
    end.setHours(23, 59, 59, 999);

    const { data, error } = await supabase
      .schema('public')
      .from('students')
      .select('*')
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setStudents(data.map(mapStudentFromDB));
    }
  };

  const fetchAllStudents = async () => {
    const schoolId = await requireSchoolId();
    const { data, error } = await supabase
      .schema('public')
      .from('students')
      .select('*')
      .eq('school_id', schoolId);

    if (!error && data) {
      setAllStudents(data);
    }
  };

  const fetchTeachers = async () => {
    const schoolId = await requireSchoolId();
    const orderedResult = await supabase
      .schema('public')
      .from('teachers')
      .select('*')
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false });

    if (!orderedResult.error && Array.isArray(orderedResult.data)) {
      setTeachers(orderedResult.data.map((teacher: any) => mapStudentFromDB({ ...teacher, role: 'teacher' })));
      return;
    }

    const fallbackResult = await supabase
      .schema('public')
      .from('teachers')
      .select('*')
      .eq('school_id', schoolId);

    if (!fallbackResult.error && Array.isArray(fallbackResult.data)) {
      setTeachers(fallbackResult.data.map((teacher: any) => mapStudentFromDB({ ...teacher, role: 'teacher' })));
      return;
    }

    setTeachers([]);
    const message = orderedResult.error?.message || fallbackResult.error?.message;
    if (message) {
      notify(`Failed to fetch teachers from public.teachers: ${message}`);
    }
  };

  const fetchParents = async () => {
    const schoolId = await requireSchoolId();
    const { data, error } = await supabase
      .from('parents')
      .select('*')
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setParents(data);
      return;
    }

    if (error && /created_at|column|schema cache|does not exist/i.test(error.message || '')) {
      const fallbackResult = await supabase
        .from('parents')
        .select('*')
        .eq('school_id', schoolId);

      if (!fallbackResult.error && fallbackResult.data) {
        setParents(fallbackResult.data);
      }
    }
  };

  const fetchStudentServiceStaff = async () => {
    const schoolId = await requireSchoolId();
    const orderedResult = await supabase
      .schema('public')
      .from('student_services')
      .select('*')
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false });

    if (!orderedResult.error && Array.isArray(orderedResult.data)) {
      setStudentServiceStaff(orderedResult.data.map((staff: any) => mapStudentFromDB({ ...staff, role: 'student_service' })));
      return;
    }

    const fallbackResult = await supabase
      .schema('public')
      .from('student_services')
      .select('*')
      .eq('school_id', schoolId);

    if (!fallbackResult.error && Array.isArray(fallbackResult.data)) {
      setStudentServiceStaff(fallbackResult.data.map((staff: any) => mapStudentFromDB({ ...staff, role: 'student_service' })));
      return;
    }

    setStudentServiceStaff([]);
  };

  const fetchTotalEarnings = async () => {
    const schoolId = await requireSchoolId();
    const { data, error } = await supabase
      .from('student_payments')
      .select('amount_mmk, status')
      .eq('school_id', schoolId);

    if (error) {
      setTotalEarningMMK(0);
      return;
    }

    const total = (data || []).reduce((sum: number, row: any) => {
      const status = String(row?.status || '').toLowerCase();
      if (status !== 'paid') return sum;
      return sum + Number(row?.amount_mmk || 0);
    }, 0);

    setTotalEarningMMK(Math.round(total));
  };

  const fetchClasses = async () => {
    const schoolId = await requireSchoolId();
    const { data, error } = await supabase
      .from('classes')
      .select('*, class_course_students(student_id)')
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false });

    if (!error && data) {
      const mappedClasses = data.map((classItem: any) => ({
        ...classItem,
        class_code: classItem.class_code || null,
        outer_color: classItem.color || classItem.outer_color || '#f8fafc',
        student_ids: Array.from(new Set((classItem.class_course_students || []).map((relation: any) => String(relation.student_id)))),
        student_count: Array.from(new Set((classItem.class_course_students || []).map((relation: any) => String(relation.student_id)))).length,
      }));
      setClasses(mappedClasses);
    }
  };

  const buildNextClassCode = useCallback((name: string, excludeClassId?: string) => {
    const base = normalizeClassCodeBase(name);
    const prefixRegex = new RegExp(`^${base}(\\d+)$`);

    const nextNumber = classes
      .filter(classItem => (excludeClassId ? String(classItem.id) !== excludeClassId : true))
      .reduce((max, classItem) => {
        const existingCode = String(classItem.class_code || '');
        const matched = existingCode.match(prefixRegex);
        if (!matched) return max;
        const parsed = Number(matched[1]);
        if (!Number.isFinite(parsed)) return max;
        return Math.max(max, parsed);
      }, 0) + 1;

    return `${base}${nextNumber}`;
  }, [classes]);

  const uploadClassImage = async (file: File) => {
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = `class-${Date.now()}-${sanitizedName}`;

    const { error } = await supabase.storage
      .from('class_image')
      .upload(filePath, file, { upsert: true });

    if (error) throw error;

    const { data } = supabase.storage
      .from('class_image')
      .getPublicUrl(filePath);

    if (!data?.publicUrl) {
      throw new Error('Failed to retrieve uploaded image URL.');
    }

    return data.publicUrl;
  };

  const uploadStudentProfileImage = async (file: File) => {
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = `profiles/student-${Date.now()}-${sanitizedName}`;

    const { error } = await supabase.storage
      .from('student_profile')
      .upload(filePath, file, {
        upsert: false,
        contentType: file.type || 'image/jpeg',
        cacheControl: '3600',
      });

    if (error) throw error;

    const { data } = supabase.storage
      .from('student_profile')
      .getPublicUrl(filePath);

    if (!data?.publicUrl) {
      throw new Error('Failed to retrieve uploaded student profile URL.');
    }

    return data.publicUrl;
  };

  const createClassWithStudents = async () => {
    try {
      if (!className.trim()) {
        notify('Please enter a class name.');
        return;
      }

      let imageUrl = '';

      if (classImage) {
        imageUrl = await uploadClassImage(classImage);
      }

      const nextClassCode = buildNextClassCode(className);

      const schoolId = await requireSchoolId();
      const insertPayload = isClassCodeSupported
        ? { name: className, image_url: imageUrl, color: classOuterColor, class_code: nextClassCode, school_id: schoolId }
        : { name: className, image_url: imageUrl, color: classOuterColor, school_id: schoolId };

      let classData: any = null;
      let classError: any = null;

      {
        const result = await supabase
          .from('classes')
          .insert([insertPayload])
          .select()
          .maybeSingle();
        classData = result.data;
        classError = result.error;
      }

      if (classError && /class_code/i.test(classError.message || '')) {
        setIsClassCodeSupported(false);
        const fallbackResult = await supabase
          .from('classes')
          .insert([{ name: className, image_url: imageUrl, color: classOuterColor, school_id: schoolId }])
          .select()
          .maybeSingle();
        classData = fallbackResult.data;
        classError = fallbackResult.error;
      }

      if (classError) throw classError;

      const createdClass = classData || { ...insertPayload, id: 'temp-' + Date.now() };

      setClasses(prev => [{ ...createdClass, class_code: createdClass.class_code || (isClassCodeSupported ? nextClassCode : null), color: classOuterColor, outer_color: classOuterColor, student_ids: [], student_count: 0 }, ...prev]);
      notify('Class created successfully!');
      setClassName('');
      setClassImage(null);
      setClassOuterColor('#f8fafc');
    } catch (err: any) {
      console.error(err);
      notify(`Error creating class: ${err?.message || 'Please try again.'}`);
    }
  };

  const startEditClass = (classItem: any) => {
    setEditingClassId(String(classItem.id));
    setClassName(classItem.name || '');
    setClassOuterColor(classItem.color || classItem.outer_color || '#f8fafc');
    setClassImage(null);
  };

  const cancelEditClass = () => {
    setEditingClassId(null);
    setClassName('');
    setClassImage(null);
    setClassOuterColor('#f8fafc');
  };

  const saveClassEdits = async () => {
    if (!editingClassId) return;
    if (!className.trim()) {
      notify('Please enter a class name.');
      return;
    }

    try {
      const targetClass = classes.find(classItem => String(classItem.id) === editingClassId);
      let imageUrl = targetClass?.image_url || '';
      const classCode = buildNextClassCode(className, editingClassId);

      if (classImage) {
        imageUrl = await uploadClassImage(classImage);
      }

      const schoolId = await requireSchoolId();
      const updatePayload = isClassCodeSupported
        ? { name: className, image_url: imageUrl, color: classOuterColor, class_code: classCode, school_id: schoolId }
        : { name: className, image_url: imageUrl, color: classOuterColor, school_id: schoolId };

      let error: any = null;

      {
        const result = await supabase
          .from('classes')
          .update(updatePayload)
          .eq('id', editingClassId);
        error = result.error;
      }

      if (error && /class_code/i.test(error.message || '')) {
        setIsClassCodeSupported(false);
        const fallbackResult = await supabase
          .from('classes')
          .update({ name: className, image_url: imageUrl, color: classOuterColor, school_id: schoolId })
          .eq('id', editingClassId);
        error = fallbackResult.error;
      }

      if (error) throw error;

      setClasses(prev => prev.map(classItem => {
        if (String(classItem.id) !== editingClassId) return classItem;
        return {
          ...classItem,
          name: className,
          class_code: isClassCodeSupported ? classCode : (classItem.class_code || null),
          image_url: imageUrl,
          color: classOuterColor,
          outer_color: classOuterColor,
          student_ids: classItem.student_ids || [],
          student_count: classItem.student_count ?? (classItem.student_ids || []).length,
        };
      }));

      notify('Class updated successfully.');
      cancelEditClass();
    } catch (error: any) {
      console.error('Edit class error:', error);
      notify(`Failed to update class: ${error?.message || 'Unknown error'}`);
    }
  };

  const exportMonthlyAttendancePdf = useCallback(async (
    contextType: AttendanceContextType,
    contextId: string,
    month: string,
    studentList: Array<{ id: string; name: string }>,
    contextLabel?: string
  ) => {
    if (!month) {
      notify('Please choose a month to export.');
      return;
    }

    if (!contextId) {
      notify('Please choose a class or subject first.');
      return;
    }

    const [yearStr, monthStr] = month.split('-');
    const year = Number(yearStr);
    const monthNumber = Number(monthStr);
    if (!Number.isFinite(year) || !Number.isFinite(monthNumber) || monthNumber < 1 || monthNumber > 12) {
      notify('Invalid month selected.');
      return;
    }

    const monthStart = `${month}-01`;
    const lastDay = new Date(year, monthNumber, 0).getDate();
    const monthEnd = `${month}-${String(lastDay).padStart(2, '0')}`;

    const { data, error } = await supabase
      .from('attendance_records')
      .select('student_id, status, attendance_date')
      .eq('context_type', contextType)
      .eq('context_id', contextId)
      .gte('attendance_date', monthStart)
      .lte('attendance_date', monthEnd)
      .order('attendance_date', { ascending: true });

    if (error) {
      console.error('Attendance export query failed:', error);
      notify(`Failed to export attendance: ${error.message}`);
      return;
    }

    const countsByStudent: Record<string, { present: number; absent: number; late: number; total: number }> = {};
    (data || []).forEach((row: any) => {
      const studentId = String(row.student_id);
      if (!countsByStudent[studentId]) {
        countsByStudent[studentId] = { present: 0, absent: 0, late: 0, total: 0 };
      }
      if (row.status === 'P') countsByStudent[studentId].present += 1;
      if (row.status === 'A') countsByStudent[studentId].absent += 1;
      if (row.status === 'L') countsByStudent[studentId].late += 1;
      countsByStudent[studentId].total += 1;
    });

    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    const monthLabel = new Date(year, monthNumber - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });
    const headerTitle = `Attendance Report - ${monthLabel}`;
    const subTitle = `${contextType.toUpperCase()}: ${contextLabel || contextId}`;

    doc.setFontSize(18);
    doc.text(headerTitle, 40, 40);
    doc.setFontSize(11);
    doc.text(subTitle, 40, 60);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 40, 78);

    let y = 110;
    const lineHeight = 20;
    const columns = [
      { label: 'Student Name', x: 40 },
      { label: 'Student ID', x: 260 },
      { label: 'Present', x: 430 },
      { label: 'Absent', x: 510 },
      { label: 'Late', x: 580 },
      { label: 'Marked Days', x: 650 },
      { label: 'Rate %', x: 760 },
    ];

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    columns.forEach(col => doc.text(col.label, col.x, y));
    y += 10;
    doc.line(40, y, 820, y);
    y += 16;
    doc.setFont('helvetica', 'normal');

    const rows = studentList.map(student => {
      const stats = countsByStudent[String(student.id)] || { present: 0, absent: 0, late: 0, total: 0 };
      const rate = stats.total === 0 ? 0 : Math.round((stats.present / stats.total) * 100);
      return {
        name: student.name,
        id: String(student.id),
        ...stats,
        rate,
      };
    });

    rows.forEach(row => {
      if (y > 560) {
        doc.addPage();
        y = 50;
        doc.setFont('helvetica', 'bold');
        columns.forEach(col => doc.text(col.label, col.x, y));
        y += 10;
        doc.line(40, y, 820, y);
        y += 16;
        doc.setFont('helvetica', 'normal');
      }

      doc.text(row.name.slice(0, 32), 40, y);
      doc.text(row.id.slice(0, 18), 260, y);
      doc.text(String(row.present), 430, y);
      doc.text(String(row.absent), 510, y);
      doc.text(String(row.late), 580, y);
      doc.text(String(row.total), 650, y);
      doc.text(String(row.rate), 760, y);
      y += lineHeight;
    });

    const safeContext = (contextLabel || contextId).toLowerCase().replace(/[^a-z0-9]+/g, '-');
    doc.save(`attendance-${safeContext}-${month}.pdf`);
    notify(`Attendance PDF exported for ${monthLabel}.`);
  }, [notify]);

  const deleteClass = (classId: string, onDeleted?: () => void) => {
    const targetClass = classes.find(classItem => String(classItem.id) === classId);
    if (!targetClass) {
      notify('Class not found.');
      return;
    }

    setClassDeleteDialog({
      id: classId,
      name: targetClass.name || 'Unnamed Class',
      onDeleted
    });
    setClassDeleteNameInput('');
    setClassAdminDeletePassword('');
    setClassDeleteError(null);
  };

  const removeStudentFromClass = async (classId: string, studentId: string, classCourseId?: string) => {
    setConfirmDialog({
      message: 'are you sure to remove this student?',
      onConfirm: async () => {
        try {
          if (classCourseId) {
            let usedFallbackStudentCourses = false;

            const primaryDeleteResult = await supabase
              .from('class_course_students')
              .delete()
              .eq('class_id', classId)
              .eq('class_course_id', classCourseId)
              .eq('student_id', studentId);

            if (primaryDeleteResult.error && /class_id|column|schema cache|does not exist/i.test(primaryDeleteResult.error.message || '')) {
              const secondaryDeleteResult = await supabase
                .from('class_course_students')
                .delete()
                .eq('class_course_id', classCourseId)
                .eq('student_id', studentId);

              if (secondaryDeleteResult.error && isCourseAssignmentSchemaMissing(secondaryDeleteResult.error.message)) {
                const fallbackDeleteResult = await supabase
                  .from('student_courses')
                  .delete()
                  .eq('course_id', classCourseId)
                  .eq('student_id', studentId);

                if (fallbackDeleteResult.error && !isCourseAssignmentSchemaMissing(fallbackDeleteResult.error.message)) {
                  throw fallbackDeleteResult.error;
                }

                usedFallbackStudentCourses = true;
              } else if (secondaryDeleteResult.error && !isCourseAssignmentSchemaMissing(secondaryDeleteResult.error.message)) {
                throw secondaryDeleteResult.error;
              }
            } else if (primaryDeleteResult.error && isCourseAssignmentSchemaMissing(primaryDeleteResult.error.message)) {
              const fallbackDeleteResult = await supabase
                .from('student_courses')
                .delete()
                .eq('course_id', classCourseId)
                .eq('student_id', studentId);

              if (fallbackDeleteResult.error && !isCourseAssignmentSchemaMissing(fallbackDeleteResult.error.message)) {
                throw fallbackDeleteResult.error;
              }

              usedFallbackStudentCourses = true;
            } else if (primaryDeleteResult.error) {
              throw primaryDeleteResult.error;
            }

            if (usedFallbackStudentCourses) {
              const fallbackVerifyResult = await supabase
                .from('student_courses')
                .select('student_id')
                .eq('course_id', classCourseId)
                .eq('student_id', studentId)
                .limit(1);

              if (!fallbackVerifyResult.error && (fallbackVerifyResult.data || []).length > 0) {
                throw new Error('Student still exists in student_courses after delete attempt.');
              }
            } else {
              const verifyResult = await supabase
                .from('class_course_students')
                .select('student_id')
                .eq('class_course_id', classCourseId)
                .eq('student_id', studentId)
                .limit(1);

              if (!verifyResult.error && (verifyResult.data || []).length > 0) {
                throw new Error('Student still exists in class_course_students after delete attempt.');
              }
            }

            const remainingInClassResult = await supabase
              .from('class_course_students')
              .select('student_id')
              .eq('class_id', classId)
              .eq('student_id', studentId)
              .limit(1);

            if (!remainingInClassResult.error && (remainingInClassResult.data || []).length === 0) {
              setClasses(prev => prev.map(classItem => {
                if (String(classItem.id) !== classId) return classItem;

                const nextStudentIds = (classItem.student_ids || []).filter((id: string) => String(id) !== studentId);
                return {
                  ...classItem,
                  student_ids: nextStudentIds,
                  student_count: nextStudentIds.length,
                };
              }));
            } else {
              setClasses(prev => [...prev]);
            }

            notify('Student removed from course successfully.');
            return;
          }

          const { error } = await supabase
            .from('class_course_students')
            .delete()
            .eq('class_id', classId)
            .eq('student_id', studentId);

          if (error) throw error;

          setClasses(prev => prev.map(classItem => {
            if (String(classItem.id) !== classId) return classItem;

            const nextStudentIds = (classItem.student_ids || []).filter((id: string) => String(id) !== studentId);
            return {
              ...classItem,
              student_ids: nextStudentIds,
              student_count: nextStudentIds.length,
            };
          }));

          notify('Student removed from class.');
        } catch (error) {
          console.error('Remove student from class error:', error);
          notify('Failed to remove student from class.');
        }
      }
    });
  };

  const bulkAssignStudentsToClass = async (studentIds: string[], classId: string, classCourseId?: string) => {
    if (!studentIds.length) {
      notify('Please select at least one student.');
      return;
    }

    const targetClass = classes.find(classItem => String(classItem.id) === String(classId));
    if (!targetClass) {
      notify('Selected class/batch was not found.');
      return;
    }

    const existingClassIds = (targetClass.student_ids || []).map((id: any) => String(id));
    const uniqueIncomingIds = Array.from(new Set(studentIds.map(id => String(id))));

    if (!classCourseId) {
      notify('Please select a class course when assigning students.');
      return;
    }

    const schoolId = await requireSchoolId();

    // Check which students are ALREADY in this specific course
    const { data: existingCourseStudents } = await supabase
      .from('class_course_students')
      .select('student_id')
      .eq('class_course_id', classCourseId)
      .eq('school_id', schoolId);

    const studentsInCourse = new Set((existingCourseStudents || []).map(r => String(r.student_id)));
    
    const idsToInsertToCourse = uniqueIncomingIds.filter(id => !studentsInCourse.has(id));
    const alreadyEnrolledCount = uniqueIncomingIds.length - idsToInsertToCourse.length;

    if (!idsToInsertToCourse.length) {
      notify(`All ${uniqueIncomingIds.length} selected students are already enrolled in this course.`);
      return;
    }

    if (alreadyEnrolledCount > 0) {
      notify(`Skipped ${alreadyEnrolledCount} student(s) already in this course. Proceeding with ${idsToInsertToCourse.length} new enrollment(s).`);
    }

    const idsToInsertToClass = idsToInsertToCourse.filter(id => !existingClassIds.includes(id));

    if (idsToInsertToClass.length > 0) {
      setClasses(prev => prev.map(classItem => {
        if (String(classItem.id) !== String(classId)) return classItem;
        const prevIds = (classItem.student_ids || []).map((id: any) => String(id));
        const merged = Array.from(new Set([...prevIds, ...idsToInsertToClass]));
        return {
          ...classItem,
          student_ids: merged,
          student_count: merged.length,
        };
      }));
    }

    const coursePayload = idsToInsertToCourse.map(studentId => ({
      class_id: classId,
      class_course_id: classCourseId,
      student_id: studentId,
      school_id: schoolId,
    }));

    const primaryCourseAssign = await supabase
      .from('class_course_students')
      .insert(coursePayload);

    if (primaryCourseAssign.error && isCourseAssignmentSchemaMissing(primaryCourseAssign.error.message)) {
      const fallbackCoursePayload = idsToInsertToCourse.map(studentId => ({
        course_id: classCourseId,
        student_id: studentId,
        school_id: schoolId,
      }));

      const fallbackCourseAssign = await supabase
        .from('student_courses')
        .insert(fallbackCoursePayload);

      if (fallbackCourseAssign.error && !/duplicate key|already exists/i.test(fallbackCourseAssign.error.message || '')) {
        if (isCourseAssignmentSchemaMissing(fallbackCourseAssign.error.message)) {
          notify('Course assignment skipped: no supported course-student table found. Create public.class_course_students in Supabase.');
          return;
        }
        notify(`Class assignment completed, but course assignment failed: ${fallbackCourseAssign.error.message || 'Unknown error'}`);
        return;
      }
    } else if (primaryCourseAssign.error && !/duplicate key|already exists/i.test(primaryCourseAssign.error.message || '')) {
      notify(`Class assignment completed, but course assignment failed: ${primaryCourseAssign.error.message || 'Unknown error'}`);
      return;
    }

    notify(`${idsToInsertToCourse.length} student(s) added to the selected course.`);
  };

  const bulkDeleteStudents = async (studentIds: string[]) => {
    const uniqueIds = Array.from(new Set(studentIds.map(id => String(id)).filter(Boolean)));
    if (!uniqueIds.length) {
      notify('No students selected.');
      return;
    }

    setConfirmDialog({
      message: `Delete ${uniqueIds.length} selected student(s)? This action is irreversible.`,
      onConfirm: async () => {
        const classRelationDeleteResult = await supabase
          .from('class_course_students')
          .delete()
          .in('student_id', uniqueIds);

        if (classRelationDeleteResult.error && !isCourseAssignmentSchemaMissing(classRelationDeleteResult.error.message)) {
          notify(`Failed to delete class relations: ${classRelationDeleteResult.error.message || 'Unknown error'}`);
          return;
        }

        const { error: attendanceDeleteError } = await supabase
          .from('attendance_records')
          .delete()
          .in('student_id', uniqueIds);

        if (attendanceDeleteError) {
          notify(`Failed to delete attendance records: ${attendanceDeleteError.message || 'Unknown error'}`);
          return;
        }

        const { error: deleteError } = await supabase
          .from('students')
          .delete()
          .in('id', uniqueIds);

        if (deleteError) {
          notify(`Failed to delete students: ${deleteError.message || 'Unknown error'}`);
          return;
        }

        const deletedIdSet = new Set(uniqueIds.map(id => String(id)));

        setStudents(prev => prev.filter(student => !deletedIdSet.has(String(student.id))));
        setTeachers(prev => prev.filter(teacher => !deletedIdSet.has(String(teacher.id))));
        setAllStudents(prev => prev.filter((student: any) => !deletedIdSet.has(String(student.id))));
        setAttendanceStudents(prev => prev.filter(student => !deletedIdSet.has(String(student.id))));
        setClasses(prev => prev.map(classItem => {
          const nextStudentIds = (classItem.student_ids || [])
            .map((id: any) => String(id))
            .filter((id: string) => !deletedIdSet.has(id));

          if (nextStudentIds.length === (classItem.student_ids || []).length) {
            return classItem;
          }

          return {
            ...classItem,
            student_ids: nextStudentIds,
            student_count: nextStudentIds.length,
          };
        }));

        notify(`${uniqueIds.length} student(s) deleted.`);
      }
    });
  };

  const fetchAttendanceStudentsByDate = async (date: string) => {
    if (!date) return;

    const start = new Date(date);
    start.setHours(0, 0, 0, 0);

    const end = new Date(date);
    end.setHours(23, 59, 59, 999);

    const schoolId = await requireSchoolId();
    const { data, error } = await supabase
      .from('students')
      .select('*')
      .eq('school_id', schoolId)
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString())
      .order('created_at', { ascending: false });

    if (!error && data) {
      setAttendanceStudents(data.map(mapStudentFromDB));
    }
  };

  useEffect(() => {
    const syncStudentsForDateFilter = async () => {
      if (selectedDate) {
        await fetchStudentsByDate(selectedDate);
        return;
      }

      const schoolId = await requireSchoolId();
      const { data, error } = await supabase
        .schema('public')
        .from('students')
        .select('*')
        .eq('school_id', schoolId)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setStudents(data.map(mapStudentFromDB));
      }
    };

    void syncStudentsForDateFilter();
  }, [selectedDate]);

  useEffect(() => {
    const fetchStudents = async () => {
      const schoolId = await requireSchoolId();
      const { data, error } = await supabase
        .schema('public')
        .from('students')
        .select('*')
        .eq('school_id', schoolId)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setStudents(data.map(mapStudentFromDB));
      }
    };
    fetchStudents();
    fetchAllStudents();
    fetchTeachers();
    fetchParents();
    fetchStudentServiceStaff();
    fetchClasses();
    fetchTotalEarnings();
  }, []);

  useEffect(() => {
    if (currentPage === 'dashboard') {
      void fetchTotalEarnings();
    }
  }, [currentPage]);

  useEffect(() => {
    if ((currentPage === 'student-attendance' || currentPage === 'class-attendance') && attendanceDate) {
      fetchAttendanceStudentsByDate(attendanceDate);
    }
  }, [attendanceDate, currentPage]);

  useEffect(() => {
    if (currentPage !== 'student-attendance' && currentPage !== 'class-attendance') {
      setAttendanceStudents(students);
    }
  }, [students, currentPage]);

  const generateStudentPassword = () => {
    const lower = 'abcdefghijkmnopqrstuvwxyz';
    const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const digits = '23456789';
    const specials = '@#$%&*!';
    const allChars = `${lower}${upper}${digits}${specials}`;

    const pick = (chars: string) => chars[Math.floor(Math.random() * chars.length)];

    const passwordChars = [pick(lower), pick(upper), pick(digits), pick(specials)];
    for (let i = passwordChars.length; i < 12; i += 1) {
      passwordChars.push(pick(allChars));
    }

    for (let i = passwordChars.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [passwordChars[i], passwordChars[j]] = [passwordChars[j], passwordChars[i]];
    }

    return passwordChars.join('');
  };

  const generateStudentNodeId = () => {
    const randomSeed = globalThis.crypto?.randomUUID
      ? globalThis.crypto.randomUUID().replace(/-/g, '')
      : `${Date.now()}${Math.random().toString(36).slice(2, 10)}`;

    return `NODE-${randomSeed.slice(0, 10).toUpperCase()}`;
  };

  const batchRegisterStudents = async (file: File) => {
    const allowedExtensions = ['csv', 'tsv', 'xls', 'xlsx', 'ods'];
    const extension = (file.name.split('.').pop() || '').toLowerCase();
    if (!allowedExtensions.includes(extension)) {
      notify('Unsupported file format. Please upload CSV, XLS, XLSX, or ODS file.');
      return;
    }

    setIsBatchRegistering(true);
    try {
      const schoolId = await requireSchoolId();
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) {
        notify('No sheet found in uploaded file.');
        return;
      }

      const sheet = workbook.Sheets[firstSheetName];
      const rawRows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, {
        defval: '',
        raw: false,
      });

      if (!rawRows.length) {
        notify('Uploaded spreadsheet is empty.');
        return;
      }

      const getValue = (row: Record<string, any>, keys: string[]) => {
        const normalizedMap = Object.keys(row).reduce<Record<string, any>>((acc, key) => {
          const normalized = String(key).toLowerCase().replace(/[^a-z0-9]/g, '');
          acc[normalized] = row[key];
          return acc;
        }, {});

        for (const key of keys) {
          const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, '');
          if (normalizedMap[normalized] !== undefined && normalizedMap[normalized] !== null && String(normalizedMap[normalized]).trim() !== '') {
            return String(normalizedMap[normalized]).trim();
          }
        }

        return '';
      };

      const parseGender = (value: string): 'Male' | 'Female' => {
        const normalized = String(value || '').trim().toLowerCase();
        return normalized === 'female' || normalized === 'f' ? 'Female' : 'Male';
      };

      const successfulStudents: Student[] = [];
      const skippedRows: string[] = [];

      for (let index = 0; index < rawRows.length; index += 1) {
        const row = rawRows[index];
        const rowNumber = index + 2;

        const name = getValue(row, ['name', 'fullname', 'studentname']);
        const email = getValue(row, ['email', 'studentemail', 'mail']);
        const gender = parseGender(getValue(row, ['gender', 'sex']));

        if (!name || !email) {
          skippedRows.push(`Row ${rowNumber}: missing name or email`);
          continue;
        }

        const generatedPassword = generateStudentPassword();

        const newStudent: Student = {
          id: generateStudentNodeId(),
          name,
          role: 'student',
          gender,
          status: Status.PENDING,
          email,
          attendanceRate: 0,
          courseAttendance: [],
          securityStatus: { lastLogin: 'Never', twoFactorEnabled: false, trustedDevices: 0, riskLevel: 'Low' },
          permissions: { ...INITIAL_PERMISSIONS },
          type: 'New',
        };

        const payload = withSchoolId({
          ...newStudent,
          temp_password: generatedPassword,
          temp_password_created_at: new Date().toISOString(),
          date_of_birth: getValue(row, ['dateofbirth', 'dob']) || null,
          parent_name: getValue(row, ['parentname']) || null,
          parent_number: getValue(row, ['parentnumber', 'parentphone']) || null,
          parent_email: getValue(row, ['parentemail']) || null,
          secondary_parent_name: getValue(row, ['secondaryparentname']) || null,
          secondary_parent_number: getValue(row, ['secondaryparentnumber', 'secondaryparentphone']) || null,
          secondary_parent_email: getValue(row, ['secondaryparentemail']) || null,
        }, schoolId);

        let createdRow: any = null;
        let insertError: any = null;

        {
          const result = await supabase
            .from('students')
            .insert([payload])
            .select()
            .maybeSingle();
          createdRow = result.data;
          insertError = result.error;
        }

        if (insertError && /invalid input syntax|type uuid|type integer|bigint|smallint/i.test(insertError.message || '')) {
          const { id, ...payloadWithoutId } = payload;
          const retryResult = await supabase
            .from('students')
            .insert([payloadWithoutId])
            .select()
            .maybeSingle();
          createdRow = retryResult.data;
          insertError = retryResult.error;
        }

        if (insertError) {
          skippedRows.push(`Row ${rowNumber}: ${insertError.message || 'insert failed'}`);
          continue;
        }

        successfulStudents.push(mapStudentFromDB(createdRow || payload));
      }

      if (successfulStudents.length > 0) {
        setStudents(prev => [...successfulStudents, ...prev]);
        setAllStudents(prev => [...successfulStudents, ...prev]);
      }

      if (successfulStudents.length === 0) {
        notify(`Batch import failed. ${skippedRows.slice(0, 2).join(' | ') || 'No valid rows found.'}`);
      } else if (skippedRows.length > 0) {
        notify(`Batch import completed: ${successfulStudents.length} added, ${skippedRows.length} skipped.`);
      } else {
        notify(`Batch import completed: ${successfulStudents.length} students added.`);
      }
    } catch (error: any) {
      console.error('Batch registration error:', error);
      notify(`Batch registration failed: ${error?.message || 'Unknown error'}`);
    } finally {
      setIsBatchRegistering(false);
    }
  };

  const batchRegisterTeachers = async (file: File) => {
    const allowedExtensions = ['csv', 'tsv', 'xls', 'xlsx', 'ods'];
    const extension = (file.name.split('.').pop() || '').toLowerCase();
    if (!allowedExtensions.includes(extension)) {
      notify('Unsupported file format. Please upload CSV, XLS, XLSX, or ODS file.');
      return;
    }

    setIsBatchTeacherRegistering(true);
    try {
      const schoolId = await requireSchoolId();
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) {
        notify('No sheet found in uploaded file.');
        return;
      }

      const sheet = workbook.Sheets[firstSheetName];
      const rawRows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, {
        defval: '',
        raw: false,
      });

      if (!rawRows.length) {
        notify('Uploaded spreadsheet is empty.');
        return;
      }

      const getValue = (row: Record<string, any>, keys: string[]) => {
        const normalizedMap = Object.keys(row).reduce<Record<string, any>>((acc, key) => {
          const normalized = String(key).toLowerCase().replace(/[^a-z0-9]/g, '');
          acc[normalized] = row[key];
          return acc;
        }, {});

        for (const key of keys) {
          const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, '');
          if (normalizedMap[normalized] !== undefined && normalizedMap[normalized] !== null && String(normalizedMap[normalized]).trim() !== '') {
            return String(normalizedMap[normalized]).trim();
          }
        }

        return '';
      };

      const parseGender = (value: string): 'Male' | 'Female' => {
        const normalized = String(value || '').trim().toLowerCase();
        return normalized === 'female' || normalized === 'f' ? 'Female' : 'Male';
      };

      const successfulTeachers: Student[] = [];
      const skippedRows: string[] = [];

      for (let index = 0; index < rawRows.length; index += 1) {
        const row = rawRows[index];
        const rowNumber = index + 2;

        const name = getValue(row, ['name', 'fullname', 'teachername']);
        const email = getValue(row, ['email', 'teacheremail', 'mail']);
        const gender = parseGender(getValue(row, ['gender', 'sex']));

        if (!name || !email) {
          skippedRows.push(`Row ${rowNumber}: missing name or email`);
          continue;
        }

        const generatedPassword = generateStudentPassword();

        const newTeacher: Student = {
          id: generateStudentNodeId(),
          name,
          role: 'teacher',
          gender,
          status: Status.PENDING,
          email,
          attendanceRate: 0,
          courseAttendance: [],
          securityStatus: { lastLogin: 'Never', twoFactorEnabled: false, trustedDevices: 0, riskLevel: 'Low' },
          permissions: { ...INITIAL_PERMISSIONS },
          type: 'New',
        };

        const payload = withSchoolId({
          id: newTeacher.id,
          name: newTeacher.name,
          role: 'teacher',
          gender: newTeacher.gender,
          status: newTeacher.status,
          email: newTeacher.email,
          type: newTeacher.type,
          temp_password: generatedPassword,
          temp_password_created_at: new Date().toISOString(),
        }, schoolId);

        let createdRow: any = null;
        let insertError: any = null;

        {
          const result = await supabase
            .from('teachers')
            .insert([payload])
            .select()
            .maybeSingle();
          createdRow = result.data;
          insertError = result.error;
        }

        if (insertError && /invalid input syntax|type uuid|type integer|bigint|smallint/i.test(insertError.message || '')) {
          const { id, ...payloadWithoutId } = payload;
          const retryResult = await supabase
            .from('teachers')
            .insert([payloadWithoutId])
            .select()
            .maybeSingle();
          createdRow = retryResult.data;
          insertError = retryResult.error;
        }

        if (insertError) {
          skippedRows.push(`Row ${rowNumber}: ${insertError.message || 'insert failed'}`);
          continue;
        }

        successfulTeachers.push(mapStudentFromDB(createdRow || payload));
      }

      if (successfulTeachers.length > 0) {
        setTeachers(prev => [...successfulTeachers, ...prev]);
      }

      if (successfulTeachers.length === 0) {
        notify(`Batch teacher import failed. ${skippedRows.slice(0, 2).join(' | ') || 'No valid rows found.'}`);
      } else if (skippedRows.length > 0) {
        notify(`Batch teacher import completed: ${successfulTeachers.length} added, ${skippedRows.length} skipped.`);
      } else {
        notify(`Batch teacher import completed: ${successfulTeachers.length} teachers added.`);
      }
    } catch (error: any) {
      console.error('Batch teacher registration error:', error);
      notify(`Batch teacher registration failed: ${error?.message || 'Unknown error'}`);
    } finally {
      setIsBatchTeacherRegistering(false);
    }
  };

  const openEditModal = (type: string, data: any) => {
    if (type === 'student') {
      setEditTarget({
        type,
        data: {
          ...data,
          date_of_birth: data?.date_of_birth ?? '',
          parent_name: data?.parent_name ?? '',
          parent_number: data?.parent_number ?? '',
          parent_email: data?.parent_email ?? '',
          secondary_parent_name: data?.secondary_parent_name ?? '',
          secondary_parent_number: data?.secondary_parent_number ?? '',
          secondary_parent_email: data?.secondary_parent_email ?? '',
        },
      });
      setIsEditModalOpen(true);
      return;
    }

    setEditTarget({ type, data: { ...data } });
    setIsEditModalOpen(true);
  };

  const handleUpdate = async () => {
    if (!editTarget) return;
    const { type, data } = editTarget;
    
    try {
      let finalData = { ...data };

      // Sync with Supabase if it's a student
      if (type === 'student') {
        const schoolId = await requireSchoolId();
        const existingStudent = students.find(student => student.id === data.id);
        const studentPayload = withSchoolId({
          ...data,
          role: data.role ?? existingStudent?.role ?? 'student',
          status: data.status ?? existingStudent?.status ?? Status.PENDING,
          attendanceRate: data.attendanceRate ?? existingStudent?.attendanceRate ?? 0,
        }, schoolId);

        const { error } = await supabase.from('students').upsert(studentPayload);
        if (error) {
          console.error('Supabase Update Error:', error);
          notify(`Student sync failed: ${error.message}`);
          return;
        }
        finalData = studentPayload;
      }

      if (type === 'teacher') {
        const schoolId = await requireSchoolId();
        const existingTeacher = teachers.find(teacher => teacher.id === data.id);
        const teacherPayload = withSchoolId({
          id: data.id,
          name: data.name,
          email: data.email,
          role: 'teacher',
          gender: data.gender ?? existingTeacher?.gender ?? 'Male',
          status: data.status ?? existingTeacher?.status ?? Status.PENDING,
          type: data.type ?? existingTeacher?.type ?? 'New',
          avatar: data.avatar ?? existingTeacher?.avatar ?? null,
        }, schoolId);

        const { error } = await supabase.from('teachers').upsert(teacherPayload);
        if (error) {
          console.error('Supabase Teacher Update Error:', error);
          notify(`Teacher sync failed: ${error.message}`);
          return;
        }
        finalData = teacherPayload;
      }

      switch (type) {
        case 'student':
          setStudents(prev => prev.map(s => s.id === finalData.id ? finalData : s));
          break;
        case 'teacher': setTeachers(prev => prev.map(t => t.id === finalData.id ? finalData : t)); break;
        case 'subject': setSubjects(prev => prev.map(s => s.id === finalData.id ? finalData : s)); break;
        case 'library': setLibraryItems(prev => prev.map(i => i.id === finalData.id ? finalData : i)); break;
        case 'exam': setExams(prev => prev.map(e => e.id === finalData.id ? finalData : e)); break;
        case 'homework': setHomeworks(prev => prev.map(h => h.id === finalData.id ? finalData : h)); break;
        case 'program': setPrograms(prev => prev.map(p => p.id === finalData.id ? finalData : p)); break;
      }
      
      notify(`${type.charAt(0).toUpperCase() + type.slice(1)} synchronized.`);
      setIsEditModalOpen(false);
      setEditTarget(null);
    } catch (err: any) {
      console.error('Update operation failed:', err);
      notify(err.message || `Failed to update ${type}.`);
    }
  };

  const updateStudentProfilePhoto = async (studentId: string, file: File): Promise<Student> => {
    const profileImageUrl = await uploadStudentProfileImage(file);

    const schoolId = await requireSchoolId();
    const { error: studentUpdateError } = await supabase
      .from('students')
      .update({ avatar: profileImageUrl })
      .eq('id', studentId)
      .eq('school_id', schoolId);

    if (studentUpdateError) {
      const { error: teacherUpdateError } = await supabase
        .from('teachers')
        .update({ avatar: profileImageUrl })
        .eq('id', studentId)
        .eq('school_id', schoolId);

      if (teacherUpdateError) {
        throw studentUpdateError;
      }
    }

    let updatedStudent: Student | null = null;

    setStudents(prev => prev.map(student => {
      if (String(student.id) !== String(studentId)) return student;
      const next = { ...student, avatar: profileImageUrl };
      updatedStudent = next;
      return next;
    }));

    setAllStudents(prev => prev.map((student: any) => {
      if (String(student.id) !== String(studentId)) return student;
      return { ...student, avatar: profileImageUrl };
    }));

    setTeachers(prev => prev.map(student => {
      if (String(student.id) !== String(studentId)) return student;
      return { ...student, avatar: profileImageUrl };
    }));

    notify('Profile photo updated successfully.');

    if (updatedStudent) {
      return updatedStudent;
    }

    throw new Error('Student not found after photo update.');
  };

  const deleteEntity = async (id: string, type: string) => {
    if (type === 'student') {
      const targetStudent = students.find(student => String(student.id) === String(id));
      const targetTeacher = teachers.find(teacher => String(teacher.id) === String(id));
      const target = targetStudent || targetTeacher;
      if (!target) {
        notify('Student not found.');
        return;
      }
      setStudentDeleteDialog({
        id: target.id,
        name: target.name,
        entityType: targetTeacher ? 'teacher' : 'student',
      });
      setStudentDeleteNameInput('');
      setAdminDeletePassword('');
      setStudentDeleteError(null);
      return;
    }

    setConfirmDialog({
      message: `Are you sure you want to terminate this ${type} node? This action is irreversible.`,
      onConfirm: async () => {
        switch (type) {
          case 'teacher': setTeachers(prev => prev.filter(t => t.id !== id)); break;
          case 'subject': setSubjects(prev => prev.filter(s => s.id !== id)); break;
          case 'library': setLibraryItems(prev => prev.filter(i => i.id !== id)); break;
          case 'exam': setExams(prev => prev.filter(e => e.id !== id)); break;
          case 'homework': setHomeworks(prev => prev.filter(h => h.id !== id)); break;
          case 'program': setPrograms(prev => prev.filter(p => p.id !== id)); break;
          case 'student-service': {
            const schoolId = await requireSchoolId();
            void supabase.schema('public').from('student_services').delete().eq('id', id).eq('school_id', schoolId);
            setStudentServiceStaff(prev => prev.filter(s => s.id !== id));
            break;
          }
        }
        notify(`${type.charAt(0).toUpperCase() + type.slice(1)} node deleted.`);
      }
    });
  };

  const handleConfirmDialog = async () => {
    if (!confirmDialog) return;
    const action = confirmDialog.onConfirm;
    setConfirmDialog(null);
    await action();
  };

  const handleSecureStudentDelete = async () => {
    if (!studentDeleteDialog) return;

    const expectedName = studentDeleteDialog.name.trim();
    const typedName = studentDeleteNameInput.trim();
    if (typedName !== expectedName) {
      setStudentDeleteError('Student name does not match.');
      return;
    }

    if (!adminDeletePassword.trim()) {
      setStudentDeleteError('Admin password is required.');
      return;
    }

    setIsStudentDeleteSubmitting(true);
    setStudentDeleteError(null);

    try {
      const { data, error } = await supabase.rpc('verify_admin_delete_password', { input_password: adminDeletePassword });
      if (error) {
        console.error('Password verification error:', error);
        setStudentDeleteError('Failed to verify admin password.');
        return;
      }

      if (!data) {
        setStudentDeleteError('Invalid admin password.');
        return;
      }

      if (studentDeleteDialog.entityType === 'student') {
        const schoolId = await requireSchoolId();
        const { error: classRelationDeleteError } = await supabase
          .from('class_course_students')
          .delete()
          .eq('student_id', studentDeleteDialog.id)
          .eq('school_id', schoolId);

        if (classRelationDeleteError && !isCourseAssignmentSchemaMissing(classRelationDeleteError.message)) {
          console.error('Class relation delete error:', classRelationDeleteError);
          setStudentDeleteError('Failed to delete student class relations.');
          return;
        }

        const { error: attendanceDeleteError } = await supabase
          .from('attendance_records')
          .delete()
          .eq('student_id', studentDeleteDialog.id)
          .eq('school_id', schoolId);

        if (attendanceDeleteError) {
          console.error('Attendance delete error:', attendanceDeleteError);
          setStudentDeleteError('Failed to delete student attendance records.');
          return;
        }
      }

      const schoolId = await requireSchoolId();
      const { error: deleteError } = await supabase
        .from(studentDeleteDialog.entityType === 'teacher' ? 'teachers' : 'students')
        .delete()
        .eq('id', studentDeleteDialog.id)
        .eq('school_id', schoolId);
      if (deleteError) {
        console.error('Supabase Delete Error:', deleteError);
        setStudentDeleteError('Failed to delete student.');
        return;
      }

      setStudents(prev => prev.filter(student => student.id !== studentDeleteDialog.id));
      setTeachers(prev => prev.filter(student => student.id !== studentDeleteDialog.id));
      setAllStudents(prev => prev.filter(student => String(student.id) !== studentDeleteDialog.id));
      setAttendanceStudents(prev => prev.filter(student => student.id !== studentDeleteDialog.id));
      setClasses(prev => prev.map(classItem => {
        const nextStudentIds = (classItem.student_ids || []).filter((id: string) => String(id) !== studentDeleteDialog.id);
        if (nextStudentIds.length === (classItem.student_ids || []).length) {
          return classItem;
        }

        return {
          ...classItem,
          student_ids: nextStudentIds,
          student_count: nextStudentIds.length,
        };
      }));
      notify(`${studentDeleteDialog.entityType === 'teacher' ? 'Teacher' : 'Student'} node deleted.`);
      setStudentDeleteDialog(null);
      setStudentDeleteNameInput('');
      setAdminDeletePassword('');
      setStudentDeleteError(null);
    } finally {
      setIsStudentDeleteSubmitting(false);
    }
  };

  const handleSecureClassDelete = async () => {
    if (!classDeleteDialog) return;

    const expectedName = classDeleteDialog.name.trim();
    const typedName = classDeleteNameInput.trim();
    if (typedName !== expectedName) {
      setClassDeleteError('Class name does not match.');
      return;
    }

    if (!classAdminDeletePassword.trim()) {
      setClassDeleteError('Admin password is required.');
      return;
    }

    setIsClassDeleteSubmitting(true);
    setClassDeleteError(null);

    try {
      const { data, error } = await supabase.rpc('verify_admin_delete_password', { input_password: classAdminDeletePassword });
      if (error) {
        console.error('Password verification error:', error);
        setClassDeleteError('Failed to verify admin password.');
        return;
      }

      if (!data) {
        setClassDeleteError('Invalid admin password.');
        return;
      }

      const schoolId = await requireSchoolId();
      const { error: relationDeleteError } = await supabase
        .from('class_course_students')
        .delete()
        .eq('class_id', classDeleteDialog.id)
        .eq('school_id', schoolId);
      if (relationDeleteError && !isCourseAssignmentSchemaMissing(relationDeleteError.message)) {
        console.error('Delete class relations error:', relationDeleteError);
        setClassDeleteError('Failed to delete class students relations.');
        return;
      }

      const { data: deletedClassRows, error: classDeleteErrorResult } = await supabase
        .from('classes')
        .delete()
        .eq('id', classDeleteDialog.id)
        .eq('school_id', schoolId)
        .select('id');
      if (classDeleteErrorResult) {
        console.error('Delete class error:', classDeleteErrorResult);
        setClassDeleteError('Failed to delete class.');
        return;
      }

      if (!deletedClassRows || deletedClassRows.length === 0) {
        setClassDeleteError('Supabase did not delete the class row. Check table permissions (RLS) for delete on classes.');
        return;
      }

      const { data: verifyRows, error: verifyError } = await supabase
        .from('classes')
        .select('id')
        .eq('id', classDeleteDialog.id)
        .eq('school_id', schoolId)
        .limit(1);

      if (verifyError) {
        console.error('Class delete verify error:', verifyError);
        setClassDeleteError('Class delete verification failed.');
        return;
      }

      if (verifyRows && verifyRows.length > 0) {
        setClassDeleteError('Class still exists in database after delete attempt.');
        return;
      }

      setClasses(prev => prev.filter(classItem => String(classItem.id) !== classDeleteDialog.id));
      classDeleteDialog.onDeleted?.();
      notify('Class deleted successfully.');
      setClassDeleteDialog(null);
      setClassDeleteNameInput('');
      setClassAdminDeletePassword('');
      setClassDeleteError(null);
    } finally {
      setIsClassDeleteSubmitting(false);
    }
  };

  const enrollStudentAction = (type: 'New' | 'Old') => {
    setEnrollData(getInitialEnrollData(type));
    setEnrollClassCourses([]);
    setIsEnrollClassCoursesLoading(false);
    setStudentProfileImage(null);
    setIsEnrollModalOpen(true);
  };

  const abortEnrollFlow = () => {
    enrollAbortCounterRef.current += 1;
    setIsEnrollModalOpen(false);
    setEnrollData(getInitialEnrollData());
    setEnrollClassCourses([]);
    setIsEnrollClassCoursesLoading(false);
    setStudentProfileImage(null);
  };

  const enrollTeacherAction = () => {
    setTeacherEnrollData(getInitialTeacherEnrollData());
    setIsTeacherEnrollModalOpen(true);
  };

  const abortTeacherEnrollFlow = () => {
    setIsTeacherEnrollModalOpen(false);
    setTeacherEnrollData(getInitialTeacherEnrollData());
  };

  const enrollStudentServiceAction = () => {
    setStudentServiceEnrollData(getInitialTeacherEnrollData());
    setIsStudentServiceEnrollModalOpen(true);
  };

  const abortStudentServiceEnrollFlow = () => {
    setIsStudentServiceEnrollModalOpen(false);
    setStudentServiceEnrollData(getInitialTeacherEnrollData());
  };

  useEffect(() => {
    const loadEnrollClassCourses = async () => {
      if (!isEnrollModalOpen) {
        setEnrollClassCourses([]);
        setIsEnrollClassCoursesLoading(false);
        return;
      }

      if (!enrollData.selectedClassIds || enrollData.selectedClassIds.length === 0) {
        setEnrollClassCourses([]);
        setIsEnrollClassCoursesLoading(false);
        return;
      }

      setIsEnrollClassCoursesLoading(true);
      const schoolId = await requireSchoolId();
      const { data, error } = await supabase
        .from('class_courses')
        .select('id, name, class_id')
        .in('class_id', enrollData.selectedClassIds)
        .eq('school_id', schoolId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Failed to load enrollment class courses:', error);
        setEnrollClassCourses([]);
      } else {
        setEnrollClassCourses((data || []).map((course: any) => ({
          id: String(course.id),
          name: String(course.name || ''),
          class_id: String(course.class_id),
        })));
      }

      setIsEnrollClassCoursesLoading(false);
    };

    void loadEnrollClassCourses();
  }, [isEnrollModalOpen, enrollData.type, enrollData.selectedClassIds]);

  const handleEnrollSubmit = async () => {
    const enrollToken = enrollAbortCounterRef.current;
    const isEnrollmentAborted = () => enrollToken !== enrollAbortCounterRef.current;

    try {
      const schoolId = await requireSchoolId();
      if (enrollData.type === 'Old') {
        if (!enrollData.selectedStudentId) {
          notify('Please select a student for re-entry.');
          return;
        }

        if (!enrollData.selectedClassIds || enrollData.selectedClassIds.length === 0) {
          notify('Please select at least one class.');
          return;
        }

        if (!enrollData.selectedClassCourseIds || enrollData.selectedClassCourseIds.length === 0) {
          notify('Please select at least one course.');
          return;
        }

        const target = students.find(student => String(student.id) === String(enrollData.selectedStudentId));
        if (!target) {
          notify('Selected student not found.');
          return;
        }

        const updatedStudent: Student = {
          ...target,
          role: 'student',
          type: 'Old',
          status: Status.ACTIVE,
        };

        const { error: dbError } = await supabase
          .from('students')
          .update({ type: 'Old', status: Status.ACTIVE, role: 'student', school_id: schoolId })
          .eq('id', updatedStudent.id)
          .eq('school_id', schoolId);

        if (dbError) throw dbError;

        const assignments = enrollData.selectedClassCourseIds.map(courseId => {
          const course = enrollClassCourses.find(c => String(c.id) === String(courseId));
          return {
            class_id: course ? course.class_id : enrollData.selectedClassIds[0],
            class_course_id: courseId,
            student_id: updatedStudent.id,
            school_id: schoolId
          };
        });

        const primaryCourseAssign = await supabase
          .from('class_course_students')
          .insert(assignments);

        if (primaryCourseAssign.error && isCourseAssignmentSchemaMissing(primaryCourseAssign.error.message)) {
          const fallbackAssignments = enrollData.selectedClassCourseIds.map(courseId => ({
            course_id: courseId,
            student_id: updatedStudent.id,
            school_id: schoolId
          }));
          const fallbackCourseAssign = await supabase
            .from('student_courses')
            .insert(fallbackAssignments);

          if (fallbackCourseAssign.error && !/duplicate key|already exists/i.test(fallbackCourseAssign.error.message || '')) {
            if (isCourseAssignmentSchemaMissing(fallbackCourseAssign.error.message)) {
              throw new Error('Course assignment is not configured. Create public.class_course_students in Supabase.');
            }
            throw fallbackCourseAssign.error;
          }
        } else if (primaryCourseAssign.error && !/duplicate key|already exists/i.test(primaryCourseAssign.error.message || '')) {
          throw primaryCourseAssign.error;
        }

        setStudents(prev => prev.map(student => String(student.id) === String(updatedStudent.id) ? updatedStudent : student));
        setAllStudents(prev => prev.map(student => String(student.id) === String(updatedStudent.id) ? updatedStudent : student));
        
        setClasses(prev => prev.map(classItem => {
          if (!enrollData.selectedClassIds.includes(String(classItem.id))) return classItem;
          const existingIds = (classItem.student_ids || []).map((id: any) => String(id));
          if (existingIds.includes(String(updatedStudent.id))) {
            return classItem;
          }
          return {
            ...classItem,
            student_ids: [...existingIds, String(updatedStudent.id)],
            student_count: (classItem.student_count ?? existingIds.length) + 1,
          };
        }));
        notify('Old student re-entry completed.');
        abortEnrollFlow();
        return;
      }

      if (!enrollData.name || !enrollData.email) {
        notify('Please provide both name and email.');
        return;
      }

      if (!isValidEmail(enrollData.email)) {
        notify('Please enter a valid student email address.');
        return;
      }

      if (!enrollData.dateOfBirth || !enrollData.parentName || !enrollData.parentNumber || !enrollData.parentEmail) {
        notify('Please provide DOB and primary parent details.');
        return;
      }

      if (!isValidPhoneDigits(enrollData.parentNumber)) {
        notify('Please enter a valid primary parent phone number.');
        return;
      }

      if (!isValidEmail(enrollData.parentEmail)) {
        notify('Please enter a valid primary parent email address.');
        return;
      }

      if (enrollData.secondaryParentNumber && !isValidPhoneDigits(enrollData.secondaryParentNumber)) {
        notify('Please enter a valid secondary parent phone number.');
        return;
      }

      if (enrollData.secondaryParentEmail && !isValidEmail(enrollData.secondaryParentEmail)) {
        notify('Please enter a valid secondary parent email address.');
        return;
      }

      if (!enrollData.selectedClassIds || enrollData.selectedClassIds.length === 0) {
        notify('Please choose at least one class for the student.');
        return;
      }

      if (!enrollData.selectedClassCourseIds || enrollData.selectedClassCourseIds.length === 0) {
        notify('Please choose at least one class course for the student.');
        return;
      }

      const generatedPassword = generateStudentPassword();
      const normalizedStudentEmail = enrollData.email.trim().toLowerCase();
      const normalizedParentEmail = enrollData.parentEmail.trim().toLowerCase();
      const normalizedSecondaryParentEmail = enrollData.secondaryParentEmail.trim().toLowerCase();
      const primaryParentPhone = toInternationalPhone(enrollData.parentCountryCode, enrollData.parentNumber);
      const secondaryParentPhone = enrollData.secondaryParentNumber
        ? toInternationalPhone(enrollData.secondaryParentCountryCode, enrollData.secondaryParentNumber)
        : null;

      let profileImageUrl: string | undefined;
      if (studentProfileImage) {
        try {
          profileImageUrl = await uploadStudentProfileImage(studentProfileImage);
        } catch (uploadError: any) {
          console.error('Student profile upload failed:', uploadError);
          notify(`Profile upload failed: ${uploadError?.message || 'Upload blocked. Student will be created without image.'}`);
          profileImageUrl = undefined;
        }
      }

      if (isEnrollmentAborted()) {
        return;
      }

      let authUserId: string | null = null;
      try {
        const authData = await authService.signUp(normalizedStudentEmail, generatedPassword, enrollData.name, 'student');
        authUserId = authData?.user?.id || null;
      } catch (authError: any) {
        console.error('Auth sign-up failed, continuing with student profile only:', authError);
      }

      if (isEnrollmentAborted()) {
        return;
      }

      const newStudent: Student = {
        id: generateStudentNodeId(),
        name: enrollData.name,
        role: 'student',
        gender: 'Male',
        status: Status.PENDING,
        email: normalizedStudentEmail,
        avatar: profileImageUrl,
        attendanceRate: 0,
        courseAttendance: [],
        securityStatus: { lastLogin: 'Never', twoFactorEnabled: false, trustedDevices: 0, riskLevel: 'Low' },
        permissions: { ...INITIAL_PERMISSIONS },
        type: 'New'
      };

      const insertPayload = withSchoolId({
        ...newStudent,
        auth_user_id: authUserId,
        temp_password: generatedPassword,
        date_of_birth: enrollData.dateOfBirth,
        parent_name: enrollData.parentName,
        parent_number: primaryParentPhone,
        parent_email: normalizedParentEmail,
        secondary_parent_name: enrollData.secondaryParentName || null,
        secondary_parent_number: secondaryParentPhone,
        secondary_parent_email: normalizedSecondaryParentEmail || null,
      }, schoolId);

      let createdStudentRecord: any = null;
      let dbError: any = null;

      {
        const result = await supabase.from('students').insert([insertPayload]).select().maybeSingle();
        createdStudentRecord = result.data;
        dbError = result.error;
      }

      if (dbError && /invalid input syntax|type uuid|type integer|bigint|smallint/i.test(dbError.message || '')) {
        const { id, ...payloadWithoutId } = insertPayload;
        const retryResult = await supabase.from('students').insert([payloadWithoutId]).select().maybeSingle();
        createdStudentRecord = retryResult.data;
        dbError = retryResult.error;
      }

      if (dbError) throw dbError;

      if (isEnrollmentAborted()) {
        if (createdStudentRecord?.id) {
          const schoolId = await requireSchoolId();
          await supabase.from('students').delete().eq('id', createdStudentRecord.id).eq('school_id', schoolId);
        }
        return;
      }

      const createdStudent = mapStudentFromDB(createdStudentRecord || newStudent);

      const assignmentIssues: string[] = [];

      {
        const assignments = enrollData.selectedClassCourseIds.map(courseId => {
          const course = enrollClassCourses.find(c => String(c.id) === String(courseId));
          return {
            class_id: course ? course.class_id : enrollData.selectedClassIds[0],
            class_course_id: courseId,
            student_id: createdStudent.id,
            school_id: schoolId
          };
        });

        const primaryCourseAssign = await supabase
          .from('class_course_students')
          .insert(assignments);

        if (primaryCourseAssign.error && isCourseAssignmentSchemaMissing(primaryCourseAssign.error.message)) {
          const fallbackAssignments = enrollData.selectedClassCourseIds.map(courseId => ({
            course_id: courseId,
            student_id: createdStudent.id,
            school_id: schoolId
          }));

          const fallbackCourseAssign = await supabase
            .from('student_courses')
            .insert(fallbackAssignments);

          if (fallbackCourseAssign.error && !/duplicate key|already exists/i.test(fallbackCourseAssign.error.message || '')) {
            if (isCourseAssignmentSchemaMissing(fallbackCourseAssign.error.message)) {
              assignmentIssues.push('course assignment not configured (create public.class_course_students)');
            } else {
              assignmentIssues.push(`course assignment failed (${fallbackCourseAssign.error.message})`);
            }
          }
        } else if (primaryCourseAssign.error && !/duplicate key|already exists/i.test(primaryCourseAssign.error.message || '')) {
          assignmentIssues.push(`course assignment failed (${primaryCourseAssign.error.message})`);
        }

        if (!primaryCourseAssign.error || /duplicate key|already exists/i.test(primaryCourseAssign.error.message || '')) {
          setClasses(prev => prev.map(classItem => {
            if (!enrollData.selectedClassIds.includes(String(classItem.id))) return classItem;
            const existingIds = (classItem.student_ids || []).map((id: any) => String(id));
            if (existingIds.includes(String(createdStudent.id))) {
              return classItem;
            }
            return {
              ...classItem,
              student_ids: [...existingIds, String(createdStudent.id)],
              student_count: (classItem.student_count ?? existingIds.length) + 1,
            };
          }));
        }
      }

      notify(assignmentIssues.length > 0
        ? `New Student Node Created, but ${assignmentIssues.join(' and ')}.`
        : 'New Student Node Created & Synced.');
      setNewStudentCredentials({ name: createdStudent.name, email: createdStudent.email, password: generatedPassword });

      setStudents(prev => [createdStudent, ...prev]);
      setAllStudents(prev => [createdStudent, ...prev]);
      abortEnrollFlow();
      openEditModal('student', createdStudent);
    } catch (error: any) {
      console.error('Enrollment Error:', error);
      notify(`Sync Failed: ${error.message}`);
    }
  };

  const handleTeacherEnrollSubmit = async () => {
    try {
      const schoolId = await requireSchoolId();
      if (!teacherEnrollData.name || !teacherEnrollData.email) {
        notify('Please provide both name and email.');
        return;
      }

      if (!isValidEmail(teacherEnrollData.email)) {
        notify('Please enter a valid teacher email address.');
        return;
      }

      const generatedPassword = generateStudentPassword();
      const normalizedTeacherEmail = teacherEnrollData.email.trim().toLowerCase();

      let authUserId: string | null = null;
      try {
        const authData = await authService.signUp(normalizedTeacherEmail, generatedPassword, teacherEnrollData.name, 'teacher');
        authUserId = authData?.user?.id || null;
      } catch (authError: any) {
        console.error('Auth sign-up failed, continuing with teacher profile only:', authError);
      }

      const newTeacher: Student = {
        id: generateStudentNodeId(),
        name: teacherEnrollData.name,
        role: 'teacher',
        gender: 'Male',
        status: Status.PENDING,
        email: normalizedTeacherEmail,
        attendanceRate: 0,
        courseAttendance: [],
        securityStatus: { lastLogin: 'Never', twoFactorEnabled: false, trustedDevices: 0, riskLevel: 'Low' },
        permissions: { ...INITIAL_PERMISSIONS },
        type: 'New',
      };

      const insertPayload = withSchoolId({
        id: newTeacher.id,
        name: newTeacher.name,
        email: newTeacher.email,
        role: 'teacher',
        gender: newTeacher.gender,
        status: newTeacher.status,
        type: newTeacher.type,
        auth_user_id: authUserId,
        temp_password: generatedPassword,
      }, schoolId);

      let createdTeacherRecord: any = null;
      let dbError: any = null;

      {
        const result = await supabase.from('teachers').insert([insertPayload]).select().maybeSingle();
        createdTeacherRecord = result.data;
        dbError = result.error;
      }

      if (dbError && /invalid input syntax|type uuid|type integer|bigint|smallint/i.test(dbError.message || '')) {
        const { id, ...payloadWithoutId } = insertPayload;
        const retryResult = await supabase.from('teachers').insert([payloadWithoutId]).select().maybeSingle();
        createdTeacherRecord = retryResult.data;
        dbError = retryResult.error;
      }

      if (dbError) throw dbError;

      const createdTeacher = mapStudentFromDB(createdTeacherRecord || newTeacher);
      setTeachers(prev => [createdTeacher, ...prev]);
      setNewStudentCredentials({ name: createdTeacher.name, email: createdTeacher.email, password: generatedPassword });

      notify('New Teacher Node Created & Synced.');
      abortTeacherEnrollFlow();
      openEditModal('teacher', createdTeacher);
    } catch (error: any) {
      console.error('Teacher enrollment error:', error);
      notify(`Teacher sync failed: ${error?.message || 'Unknown error'}`);
    }
  };

  const handleStudentServiceEnrollSubmit = async () => {
    try {
      const schoolId = await requireSchoolId();
      if (!studentServiceEnrollData.name || !studentServiceEnrollData.email) {
        notify('Please provide both name and email.');
        return;
      }

      if (!isValidEmail(studentServiceEnrollData.email)) {
        notify('Please enter a valid email address.');
        return;
      }

      const generatedPassword = generateStudentPassword();
      const normalizedEmail = studentServiceEnrollData.email.trim().toLowerCase();

      let authUserId: string | null = null;
      try {
        const authData = await authService.signUp(normalizedEmail, generatedPassword, studentServiceEnrollData.name, 'teacher');
        authUserId = authData?.user?.id || null;
      } catch (authError: any) {
        console.error('Auth sign-up failed, continuing with staff profile only:', authError);
      }

      const newStaff: Student = {
        id: generateStudentNodeId(),
        name: studentServiceEnrollData.name,
        role: 'teacher',
        gender: 'Male',
        status: Status.PENDING,
        email: normalizedEmail,
        attendanceRate: 0,
        courseAttendance: [],
        securityStatus: { lastLogin: 'Never', twoFactorEnabled: false, trustedDevices: 0, riskLevel: 'Low' },
        permissions: { ...INITIAL_PERMISSIONS },
        type: 'New',
      };

      const insertPayload = withSchoolId({
        id: newStaff.id,
        name: newStaff.name,
        email: newStaff.email,
        role: 'student_service',
        gender: newStaff.gender,
        status: newStaff.status,
        type: newStaff.type,
        auth_user_id: authUserId,
        temp_password: generatedPassword,
      }, schoolId);

      let createdRecord: any = null;
      let dbError: any = null;

      {
        const result = await supabase.schema('public').from('student_services').insert([insertPayload]).select().maybeSingle();
        createdRecord = result.data;
        dbError = result.error;
      }

      if (dbError && /invalid input syntax|type uuid|type integer|bigint|smallint/i.test(dbError.message || '')) {
        const { id, ...payloadWithoutId } = insertPayload;
        const retryResult = await supabase.schema('public').from('student_services').insert([payloadWithoutId]).select().maybeSingle();
        createdRecord = retryResult.data;
        dbError = retryResult.error;
      }

      if (dbError) throw dbError;

      const createdStaff = mapStudentFromDB(createdRecord || newStaff);
      setStudentServiceStaff(prev => [createdStaff, ...prev]);
      setNewStudentCredentials({ name: createdStaff.name, email: createdStaff.email, password: generatedPassword });

      notify('New Student Service Staff Created & Synced.');
      abortStudentServiceEnrollFlow();
    } catch (error: any) {
      console.error('Student service enrollment error:', error);
      notify(`Staff registration failed: ${error?.message || 'Unknown error'}`);
    }
  };

  const batchRegisterStudentService = async (file: File) => {
    const allowedExtensions = ['csv', 'tsv', 'xls', 'xlsx', 'ods'];
    const extension = (file.name.split('.').pop() || '').toLowerCase();
    if (!allowedExtensions.includes(extension)) {
      notify('Unsupported file format. Please upload CSV, XLS, XLSX, or ODS file.');
      return;
    }

    setIsBatchStudentServiceRegistering(true);
    try {
      const schoolId = await requireSchoolId();
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) {
        notify('No sheet found in uploaded file.');
        return;
      }

      const sheet = workbook.Sheets[firstSheetName];
      const rawRows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, {
        defval: '',
        raw: false,
      });

      if (!rawRows.length) {
        notify('Uploaded spreadsheet is empty.');
        return;
      }

      const getValue = (row: Record<string, any>, keys: string[]) => {
        const normalizedMap = Object.keys(row).reduce<Record<string, any>>((acc, key) => {
          const normalized = String(key).toLowerCase().replace(/[^a-z0-9]/g, '');
          acc[normalized] = row[key];
          return acc;
        }, {});
        for (const key of keys) {
          const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, '');
          if (normalizedMap[normalized] !== undefined && normalizedMap[normalized] !== null && String(normalizedMap[normalized]).trim() !== '') {
            return String(normalizedMap[normalized]).trim();
          }
        }
        return '';
      };

      const parseGender = (value: string): 'Male' | 'Female' => {
        const normalized = String(value || '').trim().toLowerCase();
        return normalized === 'female' || normalized === 'f' ? 'Female' : 'Male';
      };

      const successfulStaff: Student[] = [];
      const skippedRows: string[] = [];

      for (let index = 0; index < rawRows.length; index += 1) {
        const row = rawRows[index];
        const rowNumber = index + 2;

        const name = getValue(row, ['name', 'fullname', 'staffname']);
        const email = getValue(row, ['email', 'staffemail', 'mail']);
        const gender = parseGender(getValue(row, ['gender', 'sex']));

        if (!name || !email) {
          skippedRows.push(`Row ${rowNumber}: missing name or email`);
          continue;
        }

        const generatedPassword = generateStudentPassword();

        const newStaff: Student = {
          id: generateStudentNodeId(),
          name,
          role: 'teacher',
          gender,
          status: Status.PENDING,
          email,
          attendanceRate: 0,
          courseAttendance: [],
          securityStatus: { lastLogin: 'Never', twoFactorEnabled: false, trustedDevices: 0, riskLevel: 'Low' },
          permissions: { ...INITIAL_PERMISSIONS },
          type: 'New',
        };

        const payload = withSchoolId({
          id: newStaff.id,
          name: newStaff.name,
          role: 'student_service',
          gender: newStaff.gender,
          status: newStaff.status,
          email: newStaff.email,
          type: newStaff.type,
          temp_password: generatedPassword,
          temp_password_created_at: new Date().toISOString(),
        }, schoolId);

        let createdRow: any = null;
        let insertError: any = null;

        {
          const result = await supabase.schema('public').from('student_services').insert([payload]).select().maybeSingle();
          createdRow = result.data;
          insertError = result.error;
        }

        if (insertError && /invalid input syntax|type uuid|type integer|bigint|smallint/i.test(insertError.message || '')) {
          const { id, ...payloadWithoutId } = payload;
          const retryResult = await supabase.schema('public').from('student_services').insert([payloadWithoutId]).select().maybeSingle();
          createdRow = retryResult.data;
          insertError = retryResult.error;
        }

        if (insertError) {
          skippedRows.push(`Row ${rowNumber}: ${insertError.message || 'insert failed'}`);
          continue;
        }

        successfulStaff.push(mapStudentFromDB(createdRow || payload));
      }

      if (successfulStaff.length > 0) {
        setStudentServiceStaff(prev => [...successfulStaff, ...prev]);
      }

      if (successfulStaff.length === 0) {
        notify(`Batch import failed. ${skippedRows.slice(0, 2).join(' | ') || 'No valid rows found.'}`);
      } else if (skippedRows.length > 0) {
        notify(`Batch import completed: ${successfulStaff.length} added, ${skippedRows.length} skipped.`);
      } else {
        notify(`Batch import completed: ${successfulStaff.length} staff members added.`);
      }
    } catch (error: any) {
      console.error('Batch student service registration error:', error);
      notify(`Batch registration failed: ${error?.message || 'Unknown error'}`);
    } finally {
      setIsBatchStudentServiceRegistering(false);
    }
  };

  const openPermissions = (student: Student) => {
    setPermTarget(student);
    setIsPermissionsModalOpen(true);
  };

  const verifyAdminPassword = async (password: string): Promise<boolean> => {
    const { data, error } = await supabase.rpc('verify_admin_delete_password', { input_password: password });
    if (error) {
      console.error('Admin password verification error:', error);
      return false;
    }
    return Boolean(data);
  };

  const requestStudentEditWithPassword = (student: Student) => {
    setStudentEditAuthDialog(student);
    setStudentEditAuthPassword('');
    setStudentEditAuthError(null);
  };

  const handleStudentEditAuthConfirm = async () => {
    if (!studentEditAuthDialog) return;
    if (!studentEditAuthPassword.trim()) {
      setStudentEditAuthError('Admin password is required.');
      return;
    }

    setIsStudentEditAuthSubmitting(true);
    setStudentEditAuthError(null);

    try {
      const { data, error } = await supabase.rpc('verify_admin_delete_password', { input_password: studentEditAuthPassword });
      if (error) {
        setStudentEditAuthError('Failed to verify admin password.');
        return;
      }

      if (!data) {
        setStudentEditAuthError('Invalid admin password.');
        return;
      }

      openEditModal(studentEditAuthDialog.role === 'teacher' ? 'teacher' : 'student', studentEditAuthDialog);
      setStudentEditAuthDialog(null);
      setStudentEditAuthPassword('');
      setStudentEditAuthError(null);
    } finally {
      setIsStudentEditAuthSubmitting(false);
    }
  };

  const togglePermission = (key: keyof StudentPermissions) => {
    if (!permTarget) return;
    const updated = {
      ...permTarget,
      permissions: { ...permTarget.permissions!, [key]: !permTarget.permissions![key] }
    };
    setStudents(prev => prev.map(s => s.id === permTarget.id ? updated : s));
    setPermTarget(updated);
  };

  const getAttendanceStoreKey = useCallback((contextType: AttendanceContextType, contextId: string) => `${contextType}:${contextId}`, []);

  const setAttendanceForDate = useCallback((
    storeKey: string,
    date: string,
    studentStatuses: Record<string, 'P' | 'A' | 'L'>
  ) => {
    setSubjectAttendanceStore(prev => {
      const contextData = prev[storeKey] || {};
      return {
        ...prev,
        [storeKey]: {
          ...contextData,
          [date]: studentStatuses,
        },
      };
    });
  }, []);

  const loadAttendanceForContext = useCallback(async (contextType: AttendanceContextType, contextId: string, date: string) => {
    if (!contextId || !date) return;

    const { data, error } = await supabase
      .from('attendance_records')
      .select('student_id, status')
      .eq('context_type', contextType)
      .eq('context_id', contextId)
      .eq('attendance_date', date);

    if (error) {
      console.error('Failed to load attendance:', error);
      notify(`Failed to load attendance: ${error.message}`);
      return;
    }

    const nextDateData: Record<string, 'P' | 'A' | 'L'> = {};
    (data || []).forEach((item: any) => {
      nextDateData[String(item.student_id)] = item.status;
    });

    setAttendanceForDate(getAttendanceStoreKey(contextType, contextId), date, nextDateData);
  }, [getAttendanceStoreKey, notify, setAttendanceForDate]);

  const syncStudentAttendanceRates = useCallback(async (
    studentIds: string[],
    options?: { showErrorToast?: boolean; errorPrefix?: string }
  ) => {
    const showErrorToast = options?.showErrorToast ?? true;
    const errorPrefix = options?.errorPrefix || 'Failed to sync attendance rate';
    const uniqueStudentIds = Array.from(new Set(studentIds.map(id => String(id)).filter(Boolean)));
    if (!uniqueStudentIds.length) return;

    const { data: attendanceRows, error: attendanceError } = await supabase
      .from('attendance_records')
      .select('student_id, status')
      .in('student_id', uniqueStudentIds);

    if (attendanceError) {
      console.error('Failed to load attendance records for rate sync:', attendanceError);
      if (showErrorToast) {
        notify(`${errorPrefix}: ${attendanceError.message}`);
      }
      return;
    }

    const statsMap = new Map<string, { total: number; presentLike: number }>();
    uniqueStudentIds.forEach(id => {
      statsMap.set(id, { total: 0, presentLike: 0 });
    });

    (attendanceRows || []).forEach((row: any) => {
      const id = String(row.student_id);
      const existing = statsMap.get(id) || { total: 0, presentLike: 0 };
      existing.total += 1;
      if (row.status === 'P' || row.status === 'L') {
        existing.presentLike += 1;
      }
      statsMap.set(id, existing);
    });

    const updates = uniqueStudentIds.map(id => {
      const stats = statsMap.get(id) || { total: 0, presentLike: 0 };
      const attendanceRate = stats.total > 0
        ? Number(((stats.presentLike / stats.total) * 100).toFixed(2))
        : 0;
      return { id, attendanceRate };
    });

    for (const item of updates) {
      const { error: updateError } = await supabase
        .from('students')
        .update({ attendanceRate: item.attendanceRate })
        .eq('id', item.id);

      if (updateError) {
        console.error('Failed to persist attendance rate:', updateError);
        if (showErrorToast) {
          notify(`${errorPrefix}: ${updateError.message}`);
        }
        return;
      }
    }

    const rateMap = new Map<string, number>();
    updates.forEach(item => {
      rateMap.set(String(item.id), item.attendanceRate);
    });

    setStudents(prev => prev.map(student => {
      const key = String(student.id);
      if (!rateMap.has(key)) return student;
      return { ...student, attendanceRate: rateMap.get(key)! };
    }));

    setAttendanceStudents(prev => prev.map(student => {
      const key = String(student.id);
      if (!rateMap.has(key)) return student;
      return { ...student, attendanceRate: rateMap.get(key)! };
    }));

    setAllStudents(prev => prev.map((student: any) => {
      const key = String(student.id);
      if (!rateMap.has(key)) return student;
      return { ...student, attendanceRate: rateMap.get(key)! };
    }));
  }, [notify]);

  const syncAllStudentsToCloud = useCallback(async (showErrorToast = false) => {
    if (isCloudSyncRunningRef.current) return;

    isCloudSyncRunningRef.current = true;
    setIsCloudSyncRunning(true);

    try {
      const { data, error } = await supabase
        .from('students')
        .select('id');

      if (error) {
        console.error('Failed to load students for cloud sync:', error);
        if (showErrorToast) {
          notify(`Cloud sync failed: ${error.message}`);
        }
        return;
      }

      if (!data?.length) return;

      await syncStudentAttendanceRates(
        data.map((row: any) => String(row.id)),
        {
          showErrorToast,
          errorPrefix: 'Cloud sync failed',
        }
      );
    } finally {
      setIsCloudSyncRunning(false);
      isCloudSyncRunningRef.current = false;
    }
  }, [notify, syncStudentAttendanceRates]);

  const updateSubjectAttendance = useCallback(async (
    contextType: AttendanceContextType,
    contextId: string,
    date: string,
    studentId: string,
    status: 'P' | 'A' | 'L',
    contextName?: string
  ) => {
    const schoolId = await requireSchoolId();

    const basePayload = withSchoolId({
      context_type: contextType,
      context_id: contextId,
      attendance_date: date,
      student_id: studentId,
      status,
    }, schoolId);

    let error: any = null;

    if (isAttendanceContextNameSupported && contextName) {
      const result = await supabase
        .from('attendance_records')
        .upsert([
          {
            ...basePayload,
            context_name: contextName,
          },
        ], { onConflict: 'context_type,context_id,attendance_date,student_id' });
      error = result.error;

      if (error && /context_name/i.test(error.message || '')) {
        setIsAttendanceContextNameSupported(false);
        const fallbackResult = await supabase
          .from('attendance_records')
          .upsert([basePayload], { onConflict: 'context_type,context_id,attendance_date,student_id' });
        error = fallbackResult.error;
      }
    } else {
      const result = await supabase
        .from('attendance_records')
        .upsert([basePayload], { onConflict: 'context_type,context_id,attendance_date,student_id' });
      error = result.error;
    }

    if (error) {
      console.error('Failed to save attendance:', error);
      notify(`Failed to save attendance: ${error.message}`);
      return;
    }

    await syncStudentAttendanceRates([studentId]);

    const storeKey = getAttendanceStoreKey(contextType, contextId);
    setSubjectAttendanceStore(prev => {
      const contextData = prev[storeKey] || {};
      const dateData = contextData[date] || {};
      return {
        ...prev,
        [storeKey]: {
          ...contextData,
          [date]: {
            ...dateData,
            [studentId]: status,
          },
        },
      };
    });
  }, [getAttendanceStoreKey, notify, requireSchoolId, syncStudentAttendanceRates]);

  const bulkMarkSubjectPresent = useCallback(async (
    contextType: AttendanceContextType,
    contextId: string,
    date: string,
    studentIds: string[],
    contextName?: string
  ) => {
    if (studentIds.length === 0) {
      notify('No students found to mark attendance.');
      return;
    }

    const schoolId = await requireSchoolId();

    const basePayload = studentIds.map(studentId => withSchoolId({
      context_type: contextType,
      context_id: contextId,
      attendance_date: date,
      student_id: studentId,
      status: 'P' as const,
    }, schoolId));

    let error: any = null;

    if (isAttendanceContextNameSupported && contextName) {
      const payloadWithName = basePayload.map(item => ({
        ...item,
        context_name: contextName,
      }));

      const result = await supabase
        .from('attendance_records')
        .upsert(payloadWithName, { onConflict: 'context_type,context_id,attendance_date,student_id' });
      error = result.error;

      if (error && /context_name/i.test(error.message || '')) {
        setIsAttendanceContextNameSupported(false);
        const fallbackResult = await supabase
          .from('attendance_records')
          .upsert(basePayload, { onConflict: 'context_type,context_id,attendance_date,student_id' });
        error = fallbackResult.error;
      }
    } else {
      const result = await supabase
        .from('attendance_records')
        .upsert(basePayload, { onConflict: 'context_type,context_id,attendance_date,student_id' });
      error = result.error;
    }

    if (error) {
      console.error('Failed to bulk save attendance:', error);
      notify(`Failed to save attendance: ${error.message}`);
      return;
    }

    await syncStudentAttendanceRates(studentIds);

    const nextDateData: Record<string, 'P'> = {};
    studentIds.forEach(studentId => {
      nextDateData[studentId] = 'P';
    });

    setAttendanceForDate(getAttendanceStoreKey(contextType, contextId), date, nextDateData);
    notify(`All students marked Present for ${contextName || 'selected attendance context'}.`);
  }, [getAttendanceStoreKey, notify, requireSchoolId, setAttendanceForDate, syncStudentAttendanceRates]);

  useEffect(() => {
    void syncAllStudentsToCloud(false);
  }, [syncAllStudentsToCloud]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setCloudSyncCountdown(prev => {
        if (prev <= 1) {
          void syncAllStudentsToCloud(false);
          return CLOUD_SYNC_INTERVAL_SECONDS;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [syncAllStudentsToCloud]);

  const cloudSyncTimeText = useMemo(() => {
    const minutes = Math.floor(cloudSyncCountdown / 60);
    const seconds = cloudSyncCountdown % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }, [cloudSyncCountdown]);

  if (onboardingStatus === 'loading') {
    return (
      <div className="min-h-screen bg-[#f8fafc] dark:bg-slate-950 flex items-center justify-center">
        <p className="text-sm font-bold text-slate-400">Loading…</p>
      </div>
    );
  }

  if (onboardingStatus === 'needs-school') {
    return (
      <CreateSchoolPage
        onCreated={() => setOnboardingStatus('ready')}
      />
    );
  }

  return (
    <div className="flex min-h-screen bg-[#f8fafc] dark:bg-slate-950 transition-colors duration-500 relative">

      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9998] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-premium rounded-2xl px-4 py-2">
        <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
          {`Updating to cloud in ${isCloudSyncRunning ? '00:00' : cloudSyncTimeText}second`}
        </p>
      </div>

      {notification && (
        <div className="fixed top-4 right-4 z-[9999] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-premium rounded-2xl px-4 py-3 min-w-[220px] max-w-[90vw]">
          <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{notification.message}</p>
        </div>
      )}

      {newStudentCredentials && (
        <div className="fixed inset-0 z-[140] bg-slate-950/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-2xl p-6 space-y-5">
            <h3 className="text-xl font-black tracking-tight">Login Credentials</h3>
            <p className="text-sm text-slate-600 dark:text-slate-300">Share these once with the user.</p>

            <div className="rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 space-y-2">
              <p className="text-sm"><span className="font-black">Name:</span> {newStudentCredentials.name}</p>
              <p className="text-sm"><span className="font-black">Email:</span> {newStudentCredentials.email}</p>
              <p className="text-sm"><span className="font-black">Password:</span> {newStudentCredentials.password}</p>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={async () => {
                  await navigator.clipboard.writeText(`Email: ${newStudentCredentials.email}\nPassword: ${newStudentCredentials.password}`);
                  notify('Credentials copied.');
                }}
                className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs uppercase tracking-widest"
              >
                Copy
              </button>
              <button
                onClick={() => setNewStudentCredentials(null)}
                className="px-4 py-2.5 rounded-xl bg-brand-500 text-white font-bold text-xs uppercase tracking-widest"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDialog && (
        <div className="fixed inset-0 z-[120] bg-slate-950/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-2xl p-6 space-y-5">
            <h3 className="text-xl font-black tracking-tight">Confirm Deletion</h3>
            <p className="text-sm text-slate-600 dark:text-slate-300">{confirmDialog.message}</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmDialog(null)}
                className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs uppercase tracking-widest"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDialog}
                className="px-4 py-2.5 rounded-xl bg-rose-500 text-white font-bold text-xs uppercase tracking-widest"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {studentDeleteDialog && (
        <div className="fixed inset-0 z-[130] bg-slate-950/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-2xl p-6 space-y-5">
            <h3 className="text-xl font-black tracking-tight">Secure Student Deletion</h3>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Retype <span className="font-black">{studentDeleteDialog.name}</span> and enter admin password to continue.
            </p>

            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Retype Student Name</label>
              <input
                type="text"
                value={studentDeleteNameInput}
                onChange={(e) => setStudentDeleteNameInput(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 outline-none"
                placeholder="Enter exact student name"
              />
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Admin Password</label>
              <input
                type="password"
                value={adminDeletePassword}
                onChange={(e) => setAdminDeletePassword(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 outline-none"
                placeholder="Enter admin password"
              />
            </div>

            {studentDeleteError && (
              <p className="text-xs font-bold text-rose-500">{studentDeleteError}</p>
            )}

            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  if (isStudentDeleteSubmitting) return;
                  setStudentDeleteDialog(null);
                  setStudentDeleteNameInput('');
                  setAdminDeletePassword('');
                  setStudentDeleteError(null);
                }}
                className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs uppercase tracking-widest"
              >
                Cancel
              </button>
              <button
                onClick={handleSecureStudentDelete}
                disabled={isStudentDeleteSubmitting}
                className={`px-4 py-2.5 rounded-xl text-white font-bold text-xs uppercase tracking-widest ${isStudentDeleteSubmitting ? 'bg-rose-300 cursor-not-allowed' : 'bg-rose-500'}`}
              >
                {isStudentDeleteSubmitting ? 'Verifying...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {studentEditAuthDialog && (
        <div className="fixed inset-0 z-[240] bg-slate-950/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-2xl p-6 space-y-5">
            <h3 className="text-xl font-black tracking-tight">Admin Verification Required</h3>
            <p className="text-sm text-slate-600 dark:text-slate-300">Enter admin password to edit student: <span className="font-black">{studentEditAuthDialog.name}</span></p>

            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Admin Password</label>
              <input
                type="password"
                value={studentEditAuthPassword}
                onChange={(e) => setStudentEditAuthPassword(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 outline-none"
                placeholder="Enter admin password"
              />
            </div>

            {studentEditAuthError && (
              <p className="text-xs font-bold text-rose-500">{studentEditAuthError}</p>
            )}

            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  if (isStudentEditAuthSubmitting) return;
                  setStudentEditAuthDialog(null);
                  setStudentEditAuthPassword('');
                  setStudentEditAuthError(null);
                }}
                className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs uppercase tracking-widest"
              >
                Cancel
              </button>
              <button
                onClick={handleStudentEditAuthConfirm}
                disabled={isStudentEditAuthSubmitting}
                className={`px-4 py-2.5 rounded-xl text-white font-bold text-xs uppercase tracking-widest ${isStudentEditAuthSubmitting ? 'bg-brand-300 cursor-not-allowed' : 'bg-brand-500'}`}
              >
                {isStudentEditAuthSubmitting ? 'Verifying...' : 'Continue'}
              </button>
            </div>
          </div>
        </div>
      )}

      {classDeleteDialog && (
        <div className="fixed inset-0 z-[130] bg-slate-950/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-2xl p-6 space-y-5">
            <h3 className="text-xl font-black tracking-tight">Secure Class Deletion</h3>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Retype <span className="font-black">{classDeleteDialog.name}</span> and enter admin password to continue.
            </p>

            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Retype Class Name</label>
              <input
                type="text"
                value={classDeleteNameInput}
                onChange={(e) => setClassDeleteNameInput(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 outline-none"
                placeholder="Enter exact class name"
              />
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Admin Password</label>
              <input
                type="password"
                value={classAdminDeletePassword}
                onChange={(e) => setClassAdminDeletePassword(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 outline-none"
                placeholder="Enter admin password"
              />
            </div>

            {classDeleteError && (
              <p className="text-xs font-bold text-rose-500">{classDeleteError}</p>
            )}

            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  if (isClassDeleteSubmitting) return;
                  setClassDeleteDialog(null);
                  setClassDeleteNameInput('');
                  setClassAdminDeletePassword('');
                  setClassDeleteError(null);
                }}
                className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs uppercase tracking-widest"
              >
                Cancel
              </button>
              <button
                onClick={handleSecureClassDelete}
                disabled={isClassDeleteSubmitting}
                className={`px-4 py-2.5 rounded-xl text-white font-bold text-xs uppercase tracking-widest ${isClassDeleteSubmitting ? 'bg-rose-300 cursor-not-allowed' : 'bg-rose-500'}`}
              >
                {isClassDeleteSubmitting ? 'Verifying...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* ENROLLMENT MODAL */}
      <EnrollmentModal 
        isOpen={isEnrollModalOpen}
        onClose={abortEnrollFlow}
        enrollData={enrollData}
        setEnrollData={setEnrollData}
        studentProfileImage={studentProfileImage}
        setStudentProfileImage={setStudentProfileImage}
        students={students}
        classes={classes}
        classCourses={enrollClassCourses}
        isClassCoursesLoading={isEnrollClassCoursesLoading}
        onSubmit={handleEnrollSubmit}
      />

      <TeacherEnrollmentModal
        isOpen={isTeacherEnrollModalOpen}
        onClose={abortTeacherEnrollFlow}
        enrollData={teacherEnrollData}
        setEnrollData={setTeacherEnrollData}
        onSubmit={handleTeacherEnrollSubmit}
      />

      <TeacherEnrollmentModal
        isOpen={isStudentServiceEnrollModalOpen}
        onClose={abortStudentServiceEnrollFlow}
        enrollData={studentServiceEnrollData}
        setEnrollData={setStudentServiceEnrollData}
        onSubmit={handleStudentServiceEnrollSubmit}
      />

      {/* GLOBAL EDIT MODAL */}
      <EditModal 
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        editTarget={editTarget}
        setEditTarget={setEditTarget}
        onUpdate={handleUpdate}
      />

      {/* PERMISSIONS MODAL */}
      <PermissionsModal 
        isOpen={isPermissionsModalOpen}
        onClose={() => setIsPermissionsModalOpen(false)}
        permTarget={permTarget}
        togglePermission={togglePermission}
      />

      {/* Sidebar Navigation */}
      <Sidebar 
        currentPage={currentPage} 
        setCurrentPage={setCurrentPage} 
        isMobileMenuOpen={isMobileMenuOpen} 
        setIsMobileMenuOpen={setIsMobileMenuOpen} 
        isCollapsed={isSidebarCollapsed}
        onCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        onSwitch={onSwitch}
        schoolName={schoolName}
      />

      <main className={`flex-1 transition-all duration-300 ${isSidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64'} flex flex-col min-w-0`}>
        <header className="h-20 bg-white/60 dark:bg-slate-900/40 backdrop-blur-md px-4 sm:px-6 lg:px-8 flex items-center justify-between sticky top-0 z-40 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-4 sm:gap-8">
            <button className="lg:hidden p-3 text-slate-500 hover:text-brand-500 transition-all" onClick={() => setIsMobileMenuOpen(true)}><i className="fas fa-bars-staggered"></i></button>
            <div className="hidden sm:flex flex-col"><span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">System Pulse</span><span className="text-xs font-bold text-emerald-500">Live Calibration</span></div>
          </div>
          <div className="flex items-center gap-3 sm:gap-6">
            <button
              onClick={() => void handleLogout()}
              className="px-4 py-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-300 border border-rose-200 dark:border-rose-900 font-black text-xs uppercase tracking-widest hover:bg-rose-100 dark:hover:bg-rose-950/60 transition-all"
            >
              Log Out
            </button>
            <button onClick={() => setIsDarkMode(!isDarkMode)} className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-brand-500 rounded-xl active:scale-75 transition-all"><i className={`fas ${isDarkMode ? 'fa-sun' : 'fa-moon'}`}></i></button>
            <div className="w-10 h-10 rounded-xl bg-slate-100 overflow-hidden border-2 border-slate-200 dark:border-slate-800"><img src={DEFAULT_AVATAR} className="w-full h-full object-cover" /></div>
          </div>
        </header>

        <div className="p-4 sm:p-6 lg:p-10 xl:p-12 space-y-8 sm:space-y-10 lg:space-y-12 max-w-[1800px] w-full mx-auto overflow-hidden">
          
          {/* DASHBOARD */}
          {currentPage === 'dashboard' && <Dashboard stats={stats} schoolId={schoolId} />}

          {currentPage === 'live-calendar' && (
            <LiveCalendar
              classes={classes}
              schoolId={schoolId}
              notify={notify}
            />
          )}

          {/* STUDENTS PAGE (DIRECTORY) - FULL CRUD CONTROLS */}
          {currentPage === 'students' && (
            <StudentDirectory 
              title="Student Directory"
              selectLabel="Student Select"
              students={students}
              classes={classes}
              schoolId={schoolId}
              selectedDate={selectedDate}
              setSelectedDate={setSelectedDate}
              bulkAssignStudentsToClass={bulkAssignStudentsToClass}
              openPermissions={openPermissions}
              openEditModal={openEditModal}
              requestStudentEditWithPassword={requestStudentEditWithPassword}
              verifyAdminPassword={verifyAdminPassword}
              updateStudentProfilePhoto={updateStudentProfilePhoto}
              bulkDeleteStudents={bulkDeleteStudents}
              deleteEntity={deleteEntity}
            />
          )}

          {currentPage === 'parents' && (
            <ParentDirectory
              students={allStudents.length ? allStudents : students}
              onOpenParent={(parentId) => {
                setSelectedParentId(parentId);
                setCurrentPage('parent-detail');
              }}
            />
          )}

          {currentPage === 'parent-detail' && (
            <ParentDetailPage
              parentId={selectedParentId}
              students={allStudents.length ? allStudents : students}
              classes={classes}
              onBack={() => {
                setCurrentPage('parents');
              }}
            />
          )}

          {/* REGISTRATION HUB - ENROLLMENT & DELETION */}
          {currentPage === 'student-register' && (
            <RegistrationHub 
              students={students}
              schoolId={schoolId}
              enrollStudentAction={enrollStudentAction}
              batchRegisterStudents={batchRegisterStudents}
              isBatchRegistering={isBatchRegistering}
              deleteEntity={deleteEntity}
            />
          )}

          {currentPage === 'teacher-register' && (
            <TeacherRegistrationHub
              teachers={teachers}
              schoolId={schoolId}
              enrollTeacherAction={enrollTeacherAction}
              batchRegisterTeachers={batchRegisterTeachers}
              isBatchRegistering={isBatchTeacherRegistering}
              deleteEntity={deleteEntity}
            />
          )}

          {/* DAILY ATTENDANCE - SUBJECT SPECIFIC */}
          {currentPage === 'student-attendance' && (
            <AttendanceProtocol 
              students={attendanceStudents}
              subjects={subjects}
              attendanceDate={attendanceDate}
              setAttendanceDate={setAttendanceDate}
              classes={classes}
              schoolId={schoolId}
              allStudents={allStudents}
              className={className}
              setClassName={setClassName}
              classImage={classImage}
              setClassImage={setClassImage}
              classOuterColor={classOuterColor}
              setClassOuterColor={setClassOuterColor}
              createClassWithStudents={createClassWithStudents}
              editingClassId={editingClassId}
              startEditClass={startEditClass}
              cancelEditClass={cancelEditClass}
              saveClassEdits={saveClassEdits}
              deleteClass={deleteClass}
              removeStudentFromClass={removeStudentFromClass}
              selectedAttendanceSubject={selectedAttendanceSubject}
              setSelectedAttendanceSubject={setSelectedAttendanceSubject}
              subjectAttendanceStore={subjectAttendanceStore}
              updateSubjectAttendance={updateSubjectAttendance}
              bulkMarkSubjectPresent={bulkMarkSubjectPresent}
              loadAttendanceForContext={loadAttendanceForContext}
              exportMonthlyAttendancePdf={exportMonthlyAttendancePdf}
              notify={notify}
              openClassCoursePage={(course) => {
                setSelectedClassAttendanceId(course.classId);
                setSelectedClassCourse(course);
                setCurrentPage('class-course');
              }}
              openClassAttendancePage={(classId) => {
                setSelectedClassAttendanceId(classId);
                setCurrentPage('class-attendance');
              }}
            />
          )}

          {currentPage === 'class-attendance' && (
            <AttendanceProtocol
              schoolId={schoolId}
              students={attendanceStudents}
              subjects={subjects}
              attendanceDate={attendanceDate}
              setAttendanceDate={setAttendanceDate}
              classes={classes}
              allStudents={allStudents}
              className={className}
              setClassName={setClassName}
              classImage={classImage}
              setClassImage={setClassImage}
              classOuterColor={classOuterColor}
              setClassOuterColor={setClassOuterColor}
              createClassWithStudents={createClassWithStudents}
              editingClassId={editingClassId}
              startEditClass={startEditClass}
              cancelEditClass={cancelEditClass}
              saveClassEdits={saveClassEdits}
              deleteClass={deleteClass}
              removeStudentFromClass={removeStudentFromClass}
              selectedAttendanceSubject={selectedAttendanceSubject}
              setSelectedAttendanceSubject={setSelectedAttendanceSubject}
              subjectAttendanceStore={subjectAttendanceStore}
              updateSubjectAttendance={updateSubjectAttendance}
              bulkMarkSubjectPresent={bulkMarkSubjectPresent}
              loadAttendanceForContext={loadAttendanceForContext}
              exportMonthlyAttendancePdf={exportMonthlyAttendancePdf}
              notify={notify}
              openClassCoursePage={(course) => {
                setSelectedClassAttendanceId(course.classId);
                setSelectedClassCourse(course);
                setCurrentPage('class-course');
              }}
              classAttendancePage
              focusClassId={selectedClassAttendanceId}
              onExitClassAttendancePage={() => {
                setCurrentPage('student-attendance');
                setSelectedClassAttendanceId(null);
              }}
            />
          )}

          {currentPage === 'class-course' && selectedClassCourse && (
            <div className="space-y-10 animate-in fade-in duration-500 pb-20">
              <div className="bg-white dark:bg-slate-900 rounded-[32px] sm:rounded-[48px] lg:rounded-[56px] p-6 sm:p-8 lg:p-10 border border-slate-100 dark:border-slate-800 shadow-premium">
                <div className="flex items-center gap-4 sm:gap-6 lg:gap-8 min-w-0">
                  <button
                    onClick={() => setCurrentPage('class-attendance')}
                    className="w-12 h-12 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-brand-500 transition-all"
                  >
                    <i className="fas fa-arrow-left"></i>
                  </button>
                  <div className="min-w-0">
                    <h3 className="text-2xl sm:text-3xl font-black tracking-tight">Course Page: {selectedClassCourse.name}</h3>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-2">
                      Class: {selectedClassCourse.className || selectedClassCourse.classId}
                    </p>
                  </div>
                </div>
              </div>

              <AttendanceProtocol
                students={attendanceStudents}
                subjects={subjects}
                attendanceDate={attendanceDate}
                setAttendanceDate={setAttendanceDate}
                classes={classes}
                schoolId={schoolId}
                allStudents={allStudents}
                className={className}
                setClassName={setClassName}
                classImage={classImage}
                setClassImage={setClassImage}
                classOuterColor={classOuterColor}
                setClassOuterColor={setClassOuterColor}
                createClassWithStudents={createClassWithStudents}
                editingClassId={editingClassId}
                startEditClass={startEditClass}
                cancelEditClass={cancelEditClass}
                saveClassEdits={saveClassEdits}
                deleteClass={deleteClass}
                removeStudentFromClass={removeStudentFromClass}
                selectedAttendanceSubject={selectedAttendanceSubject}
                setSelectedAttendanceSubject={setSelectedAttendanceSubject}
                subjectAttendanceStore={subjectAttendanceStore}
                updateSubjectAttendance={updateSubjectAttendance}
                bulkMarkSubjectPresent={bulkMarkSubjectPresent}
                loadAttendanceForContext={loadAttendanceForContext}
                exportMonthlyAttendancePdf={exportMonthlyAttendancePdf}
                notify={notify}
                openClassCoursePage={(course) => {
                  setSelectedClassAttendanceId(course.classId);
                  setSelectedClassCourse(course);
                  setCurrentPage('class-course');
                }}
                classAttendancePage
                courseAttendanceOnly
                focusClassId={selectedClassCourse.classId}
                focusCourse={selectedClassCourse}
                onExitClassAttendancePage={() => {
                  setCurrentPage('class-attendance');
                  setSelectedClassAttendanceId(selectedClassCourse.classId);
                }}
              />
            </div>
          )}

          {/* EXAM PAGE - WITH CRUD */}
          {currentPage === 'exam' && (
            <ExamManagementPage schoolId={schoolId} />
          )}

          {currentPage === 'notice' && (
            <NoticeBoard
              schoolId={schoolId}
              onOpenNotice={(noticeId) => {
                setSelectedNoticeId(noticeId);
                setCurrentPage('notice-detail');
              }}
            />
          )}

          {currentPage === 'notice-detail' && (
            <NoticeDetailPage
              noticeId={selectedNoticeId}
              onBack={() => {
                setCurrentPage('notice');
              }}
            />
          )}

          {currentPage === 'security' && (
            <SecurityPermission />
          )}

          {/* SUBJECT PAGE - WITH CRUD */}
          {currentPage === 'subject' && (
            <div className="space-y-12 animate-in fade-in duration-700 pb-20">
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tighter">Neural Curricula</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                {subjects.map(sub => (
                  <div key={sub.id} className="bg-white dark:bg-slate-900 p-10 rounded-[56px] shadow-premium border border-slate-100 dark:border-slate-800 group hover:-translate-y-4 transition-all duration-500 relative">
                    <div className="absolute top-8 right-8 flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                       <button onClick={() => openEditModal('subject', sub)} className="w-10 h-10 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-brand-500 shadow-sm"><i className="fas fa-edit text-sm"></i></button>
                       <button onClick={() => deleteEntity(sub.id, 'subject')} className="w-10 h-10 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-rose-500 shadow-sm"><i className="fas fa-trash text-sm"></i></button>
                    </div>
                    <div className="flex justify-between items-start mb-12">
                      <div className={`w-20 h-20 ${sub.bg} ${sub.color} rounded-[32px] flex items-center justify-center text-4xl shadow-inner group-hover:rotate-6 transition-transform`}><i className={`fas ${sub.icon}`}></i></div>
                      <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{sub.code}</p>
                    </div>
                    <h4 className="text-2xl font-black mb-2 group-hover:text-brand-500 transition-colors">{sub.name}</h4>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-10">{sub.teacher}</p>
                    <div className="space-y-4">
                       <div className="flex justify-between text-[10px] font-black uppercase tracking-widest"><span className="text-slate-400">Syllabus Sync</span><span className="text-brand-500">{sub.progress}%</span></div>
                       <div className="h-2.5 w-full bg-slate-50 dark:bg-slate-800 rounded-full overflow-hidden"><div className="h-full bg-brand-500 transition-all duration-1000 shadow-glow" style={{ width: `${sub.progress}%` }}></div></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* HOMEWORK PAGE - WITH CRUD */}
          {currentPage === 'homework' && (
            <HomeworkManager schoolId={schoolId} />
          )}

          {currentPage === 'report-card' && (
            <ReportCardPage />
          )}

          {currentPage === 'payment' && (
            <PaymentFinanceHub schoolId={schoolId} view="payment" />
          )}

          {currentPage === 'payment-assign' && (
            <PaymentFinanceHub schoolId={schoolId} view="payment-assign" />
          )}

          {currentPage === 'payment-history' && (
            <PaymentFinanceHub schoolId={schoolId} view="payment-history" />
          )}

          {currentPage === 'student-finance-status' && (
            <PaymentFinanceHub schoolId={schoolId} view="student-finance-status" />
          )}

          {/* PROGRAMS PAGE - WITH CRUD */}
          {currentPage === 'programs' && (
            <div className="space-y-12 animate-in fade-in duration-700 pb-20">
               <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tighter">Academic Pathways</h2>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                 {programs.map((prog) => (
                    <div key={prog.id} className="bg-white dark:bg-slate-900 rounded-[80px] p-16 shadow-premium border border-slate-100 dark:border-slate-800 group hover:shadow-2xl transition-all duration-500 flex flex-col md:flex-row gap-12 relative overflow-hidden">
                       <div className="absolute top-12 right-12 flex gap-4 opacity-0 group-hover:opacity-100 transition-all">
                          <button onClick={() => openEditModal('program', prog)} className="w-12 h-12 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-brand-500 shadow-sm"><i className="fas fa-gear"></i></button>
                          <button onClick={() => deleteEntity(prog.id, 'program')} className="w-12 h-12 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-rose-500 shadow-sm"><i className="fas fa-trash-can"></i></button>
                       </div>
                       <div className={`w-32 h-32 md:w-48 md:h-48 rounded-[64px] bg-gradient-to-tr ${prog.color} flex items-center justify-center text-white text-5xl md:text-7xl shadow-xl group-hover:scale-110 group-hover:-rotate-3 transition-transform flex-shrink-0`}><i className={`fas ${prog.icon}`}></i></div>
                       <div className="flex-1 flex flex-col justify-center">
                          <p className="text-xs font-black text-brand-500 uppercase tracking-[0.4em] mb-4">{prog.code}</p>
                          <h4 className="text-4xl font-black mb-8 leading-tight tracking-tighter">{prog.name}</h4>
                          <div className="flex gap-12">
                             <div><p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Total Students</p><p className="text-2xl font-black">{prog.students}</p></div>
                             <div><p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Duration</p><p className="text-2xl font-black">{prog.duration}</p></div>
                          </div>
                       </div>
                    </div>
                 ))}
               </div>
            </div>
          )}

          {/* TEACHERS PAGE - DIRECTORY */}
          {currentPage === 'teachers' && (
            <StudentDirectory
              title="Teacher Directory"
              selectLabel="Teacher Select"
              schoolId={schoolId}
              namePrefix="(T) "
              students={teachers}
              classes={classes}
              selectedDate={selectedDate}
              setSelectedDate={setSelectedDate}
              bulkAssignStudentsToClass={bulkAssignStudentsToClass}
              openPermissions={openPermissions}
              openEditModal={openEditModal}
              requestStudentEditWithPassword={requestStudentEditWithPassword}
              verifyAdminPassword={verifyAdminPassword}
              updateStudentProfilePhoto={updateStudentProfilePhoto}
              bulkDeleteStudents={bulkDeleteStudents}
              deleteEntity={deleteEntity}
            />
          )}

          {/* STUDENT SERVICE DIRECTORY */}
          {currentPage === 'student-service' && (
            <StudentDirectory
              title="Student Service Directory"
              selectLabel="Staff Select"
              schoolId={schoolId}
              namePrefix="(SS) "
              students={studentServiceStaff}
              classes={classes}
              selectedDate={selectedDate}
              setSelectedDate={setSelectedDate}
              bulkAssignStudentsToClass={bulkAssignStudentsToClass}
              openPermissions={openPermissions}
              openEditModal={openEditModal}
              requestStudentEditWithPassword={requestStudentEditWithPassword}
              verifyAdminPassword={verifyAdminPassword}
              updateStudentProfilePhoto={updateStudentProfilePhoto}
              bulkDeleteStudents={bulkDeleteStudents}
              deleteEntity={deleteEntity}
            />
          )}

          {/* STUDENT SERVICE BATCH REGISTERING */}
          {currentPage === 'student-service-batch' && (
            <StudentServiceBatchRegister
              studentServiceStaff={studentServiceStaff}
              enrollStudentServiceAction={enrollStudentServiceAction}
              batchRegisterStudentService={batchRegisterStudentService}
              isBatchRegistering={isBatchStudentServiceRegistering}
              deleteEntity={deleteEntity}
            />
          )}

          {/* FALLBACK HUB */}
          {![ 'dashboard', 'live-calendar', 'students', 'parents', 'parent-detail', 'student-attendance', 'class-attendance', 'class-course', 'student-register', 'teacher-register', 'teachers', 'student-service', 'student-service-batch', 'library', 'homework', 'report-card', 'payment', 'payment-assign', 'payment-history', 'student-finance-status', 'programs', 'exam', 'security', 'subject', 'notice', 'notice-detail' ].includes(currentPage) && (
            <div className="bg-white dark:bg-slate-900 p-6 sm:p-10 md:p-16 lg:p-24 rounded-[40px] sm:rounded-[72px] lg:rounded-[120px] text-center shadow-premium animate-in zoom-in-95 duration-500 border border-slate-100 dark:border-slate-800">
              <div className="w-24 h-24 sm:w-36 sm:h-36 lg:w-48 lg:h-48 bg-brand-500/10 text-brand-500 rounded-[32px] sm:rounded-[56px] lg:rounded-[80px] flex items-center justify-center mx-auto mb-8 sm:mb-12 lg:mb-16 text-4xl sm:text-6xl lg:text-8xl shadow-inner group-hover:rotate-12 transition-all"><i className="fas fa-microchip"></i></div>
              <h3 className="text-2xl sm:text-4xl lg:text-6xl font-black tracking-tighter capitalize">{currentPage.replace('-', ' ')} Hub</h3>
              <button onClick={() => setCurrentPage('dashboard')} className="mt-8 sm:mt-12 lg:mt-16 px-8 sm:px-14 lg:px-24 py-4 sm:py-6 lg:py-8 bg-brand-500 text-white font-black rounded-[24px] sm:rounded-[40px] lg:rounded-[64px] text-[10px] sm:text-xs lg:text-sm uppercase tracking-[0.2em] sm:tracking-[0.35em] lg:tracking-[0.5em] shadow-2xl active:scale-95 transition-all">Initialize Core</button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default App;