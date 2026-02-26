import React, { useState, useEffect, useMemo } from 'react';
import { 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, AreaChart, Area, Cell, RadarChart, PolarGrid, PolarAngleAxis, Radar
} from 'recharts';
import { Status, Student, PageId, StudentPermissions } from './types';
import { supabase } from './supabaseClient';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import StudentDirectory from './components/StudentDirectory';
import RegistrationHub from './components/RegistrationHub';
import AttendanceProtocol from './components/AttendanceProtocol';
import EnrollmentModal from './components/Modals/EnrollmentModal';
import EditModal from './components/Modals/EditModal';
import PermissionsModal from './components/Modals/PermissionsModal';

const DEFAULT_AVATAR = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"><rect width="24" height="24" fill="%23f8fafc"/><circle cx="12" cy="9" r="4" fill="%23e2e8f0"/><path d="M12 14c-4.4 0-8 2-8 6v1h16v-1c0-4-3.6-6-8-6z" fill="%23cbd5e1"/></svg>`;

const INITIAL_PERMISSIONS: StudentPermissions = {
  neuralSync: true,
  libraryAccess: true,
  examEntry: true,
  apiAccess: false
};

const INITIAL_STUDENTS: Student[] = [
  { 
    id: 'NODE-781', name: 'Evelyn Harper', grade: '12th Grade', gender: 'Female', status: Status.ACTIVE, email: 'evelyn@iacademy.io', 
    attendanceRate: 98, courseAttendance: [], securityStatus: { lastLogin: '2 mins ago', twoFactorEnabled: true, trustedDevices: 2, riskLevel: 'Low' },
    permissions: { ...INITIAL_PERMISSIONS }, type: 'Old'
  },
  { 
    id: 'NODE-742', name: 'Diana Plenty', grade: '11th Grade', gender: 'Female', status: Status.ACTIVE, email: 'diana@iacademy.io', 
    attendanceRate: 91, courseAttendance: [], securityStatus: { lastLogin: '1 hour ago', twoFactorEnabled: true, trustedDevices: 1, riskLevel: 'Medium' },
    permissions: { ...INITIAL_PERMISSIONS }, type: 'New'
  },
  { 
    id: 'NODE-190', name: 'Marcus Aurelius', grade: '12th Grade', gender: 'Male', status: Status.ACTIVE, email: 'marcus@iacademy.io', 
    attendanceRate: 85, courseAttendance: [], securityStatus: { lastLogin: '5 hours ago', twoFactorEnabled: false, trustedDevices: 1, riskLevel: 'Low' },
    permissions: { ...INITIAL_PERMISSIONS, apiAccess: true }, type: 'Old'
  }
];

const INITIAL_SUBJECTS = [
  { id: '1', code: 'MATH401', name: 'Advanced Calculus', teacher: 'Dr. Sarah Smith', room: 'Hall A', grade: '12th Grade', icon: 'fa-calculator', color: 'text-blue-500', bg: 'bg-blue-50', progress: 75, resources: 42 },
  { id: '2', code: 'PHYS302', name: 'Quantum Physics', teacher: 'Prof. James Wilson', room: 'Lab 302', grade: '12th Grade', icon: 'fa-atom', color: 'text-purple-500', bg: 'bg-purple-50', progress: 40, resources: 28 },
  { id: '3', code: 'BIOL205', name: 'Molecular Biology', teacher: 'Dr. Emily Brown', room: 'Lab 101', grade: '11th Grade', icon: 'fa-dna', color: 'text-emerald-500', bg: 'bg-emerald-50', progress: 62, resources: 35 },
  { id: '4', code: 'COMP501', name: 'Neural Engineering', teacher: 'Prof. Alan Turing', room: 'Cyber Lab', grade: '12th Grade', icon: 'fa-brain', color: 'text-brand-500', bg: 'bg-brand-50', progress: 88, resources: 56 },
];

const INITIAL_TEACHERS = [
  { id: 'STAFF-101', name: 'Dr. Sarah Smith', dept: 'Mathematics', status: 'Online', load: 85, icon: 'fa-user-tie', skills: ['Calculus', 'Linear Algebra'], hours: '10am - 2pm' },
  { id: 'STAFF-102', name: 'Prof. James Wilson', dept: 'Physics', status: 'In Lab', load: 60, icon: 'fa-user-gear', skills: ['Quantum', 'Mechanics'], hours: '1pm - 5pm' },
  { id: 'STAFF-103', name: 'Dr. Emily Brown', dept: 'Biology', status: 'Available', load: 45, icon: 'fa-user-doctor', skills: ['Genetics', 'Virology'], hours: '9am - 12pm' },
];

const INITIAL_LIBRARY = [
  { title: 'Neural Quantum Mechanics v2', author: 'Dr. Feynman', cat: 'Digital', status: 'Available', id: 'LIB-001' },
  { title: 'Advanced Organic Chem', author: 'P. Atkins', cat: 'Physical', status: 'Borrowed', id: 'LIB-002' },
  { title: 'Linear Algebra Concepts', author: 'Gilbert Strang', cat: 'Digital', status: 'Available', id: 'LIB-003' },
  { title: 'Neural Engineering Ethics', author: 'Institutional Hub', cat: 'Digital', status: 'Available', id: 'LIB-004' },
  { title: 'Biology: A Cellular Approach', author: 'Campbell', cat: 'Physical', status: 'Maintenance', id: 'LIB-005' },
];

const INITIAL_EXAMS = [
  { id: 'EX-1', subject: 'Advanced Calculus', type: 'Midterm', date: 'May 28', status: 'Pending', priority: 'Critical', bg: 'bg-rose-50', color: 'text-rose-500' },
  { id: 'EX-2', subject: 'Quantum Physics', type: 'Quantum Eval', date: 'June 02', status: 'Ready', priority: 'High', bg: 'bg-brand-50', color: 'text-brand-500' },
  { id: 'EX-3', subject: 'Molecular Biology', type: 'Lab Final', date: 'June 10', status: 'Locked', priority: 'Medium', bg: 'bg-amber-50', color: 'text-amber-500' },
  { id: 'EX-4', subject: 'Neural Engineering', type: 'Simulation', date: 'June 15', status: 'Draft', priority: 'High', bg: 'bg-indigo-50', color: 'text-indigo-500' },
];

const INITIAL_HOMEWORK = [
  { id: 'HW-1', sub: 'Advanced Calculus', title: 'Stochastic Calculus Integrals', deadline: '2 Days Left', load: 85, color: 'text-blue-500', bg: 'bg-blue-50' },
  { id: 'HW-2', sub: 'Quantum Physics', title: 'Wave-Particle Duality Exp', deadline: '5 Days Left', load: 60, color: 'text-purple-500', bg: 'bg-purple-50' },
  { id: 'HW-3', sub: 'Neural Engineering', title: 'Synaptic Signal Mapping', deadline: 'Today', load: 95, color: 'text-brand-500', bg: 'bg-brand-50' },
  { id: 'HW-4', sub: 'Molecular Biology', title: 'CRISPR Sequence Synthesis', deadline: '8 Days Left', load: 40, color: 'text-emerald-500', bg: 'bg-emerald-50' },
];

const INITIAL_PROGRAMS = [
  { id: 'PR-1', name: 'Quantum Engineering', code: 'QE-PRO', students: 1240, duration: '4 Years', icon: 'fa-atom', color: 'from-blue-600 to-indigo-600' },
  { id: 'PR-2', name: 'Neural System Architecture', code: 'NSA-PRO', students: 850, duration: '4 Years', icon: 'fa-brain', color: 'from-brand-600 to-emerald-600' },
  { id: 'PR-3', name: 'Advanced Stochastic Math', code: 'ASM-PRO', students: 420, duration: '2 Years', icon: 'fa-infinity', color: 'from-purple-600 to-fuchsia-600' },
  { id: 'PR-4', name: 'Institutional Governance', code: 'GOV-PRO', students: 210, duration: '3 Years', icon: 'fa-landmark', color: 'from-amber-600 to-orange-600' },
];

const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<PageId>('dashboard');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'info'} | null>(null);

  // Stateful Data
  const [students, setStudents] = useState<Student[]>(INITIAL_STUDENTS);
  const [attendanceStudents, setAttendanceStudents] = useState<Student[]>(INITIAL_STUDENTS);
  const [subjects, setSubjects] = useState(INITIAL_SUBJECTS);
  const [teachers, setTeachers] = useState(INITIAL_TEACHERS);
  const [libraryItems, setLibraryItems] = useState(INITIAL_LIBRARY);
  const [exams, setExams] = useState(INITIAL_EXAMS);
  const [homeworks, setHomeworks] = useState(INITIAL_HOMEWORK);
  const [programs, setPrograms] = useState(INITIAL_PROGRAMS);
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
  const [allStudents, setAllStudents] = useState<any[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [className, setClassName] = useState('');
  const [classImage, setClassImage] = useState<File | null>(null);
  const [classOuterColor, setClassOuterColor] = useState('#f8fafc');
  const [editingClassId, setEditingClassId] = useState<string | null>(null);

  // Attendance State (Subject-specific)
  const [selectedAttendanceSubject, setSelectedAttendanceSubject] = useState<string | null>(null);
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().split('T')[0]);
  // Mapping: subjectId -> date -> studentId -> status
  const [subjectAttendanceStore, setSubjectAttendanceStore] = useState<Record<string, Record<string, Record<string, 'P' | 'A' | 'L'>>>>({});

  // Modals
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false);
  const [enrollData, setEnrollData] = useState({ name: '', email: '', type: 'New' as 'New' | 'Old', selectedStudentId: '', grade: '10th Grade' });
  const [editTarget, setEditTarget] = useState<{ type: string, data: any } | null>(null);
  const [isPermissionsModalOpen, setIsPermissionsModalOpen] = useState(false);
  const [permTarget, setPermTarget] = useState<Student | null>(null);

  const stats = useMemo(() => {
    const total = students.length;
    const avgAttendance = students.reduce((acc, s) => acc + s.attendanceRate, 0) / (total || 1);
    const atRisk = students.filter(s => s.attendanceRate < 90).length;
    return { total, avgAttendance: avgAttendance.toFixed(1), atRisk, activeSubjects: subjects.length };
  }, [students, subjects]);

  useEffect(() => {
    if (isDarkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [isDarkMode]);

  const mapStudentFromDB = (student: any): Student => ({
    ...(student as Student),
  });

  const fetchStudentsByDate = async (date: string) => {
    if (!date) return;

    const start = new Date(date);
    start.setHours(0, 0, 0, 0);

    const end = new Date(date);
    end.setHours(23, 59, 59, 999);

    const { data, error } = await supabase
      .from('students')
      .select('*')
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString())
      .order('created_at', { ascending: false });

    if (!error && data) {
      setStudents(data.map(mapStudentFromDB));
    }
  };

  const fetchAllStudents = async () => {
    const { data, error } = await supabase
      .from('students')
      .select('*');

    if (!error && data) {
      setAllStudents(data);
    }
  };

  const fetchClasses = async () => {
    const { data, error } = await supabase
      .from('classes')
      .select('*, class_students(student_id)')
      .order('created_at', { ascending: false });

    if (!error && data) {
      const mappedClasses = data.map((classItem: any) => ({
        ...classItem,
        outer_color: classItem.color || classItem.outer_color || '#f8fafc',
        student_ids: (classItem.class_students || []).map((relation: any) => String(relation.student_id)),
        student_count: (classItem.class_students || []).length,
      }));
      setClasses(mappedClasses);
    }
  };

  const uploadClassImage = async (file: File) => {
    const fileToDataUrl = (inputFile: File) =>
      new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Failed to read image file.'));
        reader.readAsDataURL(inputFile);
      });

    const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = `class-${Date.now()}-${sanitizedName}`;

    const { error } = await supabase.storage
      .from('class-images')
      .upload(filePath, file, { upsert: true });

    if (!error) {
      const { data } = supabase.storage
        .from('class-images')
        .getPublicUrl(filePath);

      if (data?.publicUrl) {
        return data.publicUrl;
      }
    }

    console.error('Storage upload failed, using data URL fallback:', error);
    notify('Storage upload failed. Using fallback image storage.');
    return await fileToDataUrl(file);
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

      const { data: classData, error: classError } = await supabase
        .from('classes')
        .insert([{ name: className, image_url: imageUrl, color: classOuterColor }])
        .select()
        .single();

      if (classError) throw classError;

      const payload = selectedStudents.map(studentId => ({
        class_id: classData.id,
        student_id: studentId
      }));

      if (payload.length > 0) {
        const { error: relationError } = await supabase
          .from('class_students')
          .insert(payload);

        if (relationError) throw relationError;
      }

      setClasses(prev => [{ ...classData, color: classOuterColor, outer_color: classOuterColor, student_ids: selectedStudents, student_count: payload.length }, ...prev]);
      notify('Class created successfully!');
      setClassName('');
      setSelectedStudents([]);
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

      if (classImage) {
        imageUrl = await uploadClassImage(classImage);
      }

      const { error } = await supabase
        .from('classes')
        .update({ name: className, image_url: imageUrl, color: classOuterColor })
        .eq('id', editingClassId);

      if (error) throw error;

      setClasses(prev => prev.map(classItem => {
        if (String(classItem.id) !== editingClassId) return classItem;
        return {
          ...classItem,
          name: className,
          image_url: imageUrl,
          color: classOuterColor,
          outer_color: classOuterColor,
        };
      }));

      notify('Class updated successfully.');
      cancelEditClass();
    } catch (error: any) {
      console.error('Edit class error:', error);
      notify(`Failed to update class: ${error?.message || 'Unknown error'}`);
    }
  };

  const deleteClass = async (classId: string) => {
    try {
      const { error: relationDeleteError } = await supabase
        .from('class_students')
        .delete()
        .eq('class_id', classId);

      if (relationDeleteError) throw relationDeleteError;

      const { error: classDeleteError } = await supabase
        .from('classes')
        .delete()
        .eq('id', classId);

      if (classDeleteError) throw classDeleteError;

      setClasses(prev => prev.filter(classItem => String(classItem.id) !== classId));
      notify('Class deleted successfully.');
    } catch (error) {
      console.error('Delete class error:', error);
      notify('Failed to delete class.');
    }
  };

  const removeStudentFromClass = async (classId: string, studentId: string) => {
    try {
      const { error } = await supabase
        .from('class_students')
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
  };

  const fetchAttendanceStudentsByDate = async (date: string) => {
    if (!date) return;

    const start = new Date(date);
    start.setHours(0, 0, 0, 0);

    const end = new Date(date);
    end.setHours(23, 59, 59, 999);

    const { data, error } = await supabase
      .from('students')
      .select('*')
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString())
      .order('created_at', { ascending: false });

    if (!error && data) {
      setAttendanceStudents(data.map(mapStudentFromDB));
    }
  };

  useEffect(() => {
    if (selectedDate) {
      fetchStudentsByDate(selectedDate);
    }
  }, [selectedDate]);

  useEffect(() => {
    const fetchStudents = async () => {
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data) {
        setStudents(data.map(mapStudentFromDB));
      }
    };
    fetchStudents();
    fetchAllStudents();
    fetchClasses();
  }, []);

  useEffect(() => {
    if (currentPage === 'student-attendance' && attendanceDate) {
      fetchAttendanceStudentsByDate(attendanceDate);
    }
  }, [attendanceDate, currentPage]);

  useEffect(() => {
    if (currentPage !== 'student-attendance') {
      setAttendanceStudents(students);
    }
  }, [students, currentPage]);

  const notify = (message: string) => {
    setNotification({ message, type: 'info' });
    setTimeout(() => setNotification(null), 3000);
  };

  const openEditModal = (type: string, data: any) => {
    setEditTarget({ type, data: { ...data } });
    setIsEditModalOpen(true);
  };

  const handleUpdate = async () => {
    if (!editTarget) return;
    const { type, data } = editTarget;
    
    // Sync with Supabase if it's a student
    if (type === 'student') {
      const { error } = await supabase.from('students').upsert(data);
      if (error) console.error('Supabase Update Error:', error);
    }

    switch (type) {
      case 'student': setStudents(prev => prev.map(s => s.id === data.id ? data : s)); break;
      case 'teacher': setTeachers(prev => prev.map(t => t.id === data.id ? data : t)); break;
      case 'subject': setSubjects(prev => prev.map(s => s.id === data.id ? data : s)); break;
      case 'library': setLibraryItems(prev => prev.map(i => i.id === data.id ? data : i)); break;
      case 'exam': setExams(prev => prev.map(e => e.id === data.id ? data : e)); break;
      case 'homework': setHomeworks(prev => prev.map(h => h.id === data.id ? data : h)); break;
      case 'program': setPrograms(prev => prev.map(p => p.id === data.id ? data : p)); break;
    }
    notify(`${type.charAt(0).toUpperCase() + type.slice(1)} synchronized.`);
    setIsEditModalOpen(false);
    setEditTarget(null);
  };

  const deleteEntity = async (id: string, type: string) => {
    if (confirm(`Are you sure you want to terminate this ${type} node? This action is irreversible.`)) {
      // Sync with Supabase if it's a student
      if (type === 'student') {
        const { error } = await supabase.from('students').delete().eq('id', id);
        if (error) console.error('Supabase Delete Error:', error);
      }

      switch (type) {
        case 'student': setStudents(prev => prev.filter(s => s.id !== id)); break;
        case 'teacher': setTeachers(prev => prev.filter(t => t.id !== id)); break;
        case 'subject': setSubjects(prev => prev.filter(s => s.id !== id)); break;
        case 'library': setLibraryItems(prev => prev.filter(i => i.id !== id)); break;
        case 'exam': setExams(prev => prev.filter(e => e.id !== id)); break;
        case 'homework': setHomeworks(prev => prev.filter(h => h.id !== id)); break;
        case 'program': setPrograms(prev => prev.filter(p => p.id !== id)); break;
      }
      notify(`${type.charAt(0).toUpperCase() + type.slice(1)} node deleted.`);
    }
  };

  const enrollStudentAction = (type: 'New' | 'Old') => {
    setEnrollData({ name: '', email: '', type, selectedStudentId: '', grade: '10th Grade' });
    setIsEnrollModalOpen(true);
  };

  const handleEnrollSubmit = async () => {
    try {
      if (enrollData.type === 'Old') {
        if (!enrollData.selectedStudentId) {
          notify('Please select a student for re-entry.');
          return;
        }

        const target = students.find(student => student.id === enrollData.selectedStudentId);
        if (!target) {
          notify('Selected student not found.');
          return;
        }

        const updatedStudent: Student = {
          ...target,
          grade: enrollData.grade,
          type: 'Old',
          status: Status.ACTIVE,
        };

        const { error: dbError } = await supabase
          .from('students')
          .update({ grade: updatedStudent.grade, type: 'Old', status: Status.ACTIVE })
          .eq('id', updatedStudent.id);

        if (dbError) throw dbError;

        setStudents(prev => prev.map(student => student.id === updatedStudent.id ? updatedStudent : student));
        notify('Old student re-entry completed.');
        setIsEnrollModalOpen(false);
        return;
      }

      if (!enrollData.name || !enrollData.email) {
        notify('Please provide both name and email.');
        return;
      }

      const newId = `NODE-${Math.floor(100 + Math.random() * 900)}`;
      const newStudent: Student = {
        id: newId,
        name: enrollData.name,
        grade: enrollData.grade,
        gender: 'Male',
        status: Status.PENDING,
        email: enrollData.email,
        attendanceRate: 100,
        courseAttendance: [],
        securityStatus: { lastLogin: 'Never', twoFactorEnabled: false, trustedDevices: 0, riskLevel: 'Low' },
        permissions: { ...INITIAL_PERMISSIONS },
        type: enrollData.type
      };

      const { error: dbError } = await supabase.from('students').insert([newStudent]);

      if (dbError) throw dbError;

      notify(`${enrollData.type} Student Node Created & Synced.`);

      setStudents(prev => [newStudent, ...prev]);
      setIsEnrollModalOpen(false);
      openEditModal('student', newStudent);
    } catch (error: any) {
      console.error('Enrollment Error:', error);
      notify(`Sync Failed: ${error.message}`);
    }
  };

  const openPermissions = (student: Student) => {
    setPermTarget(student);
    setIsPermissionsModalOpen(true);
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

  const updateSubjectAttendance = (subjectId: string, date: string, studentId: string, status: 'P' | 'A' | 'L') => {
    setSubjectAttendanceStore(prev => {
      const subjectData = prev[subjectId] || {};
      const dateData = subjectData[date] || {};
      return {
        ...prev,
        [subjectId]: {
          ...subjectData,
          [date]: {
            ...dateData,
            [studentId]: status
          }
        }
      };
    });
  };

  const bulkMarkSubjectPresent = (subjectId: string, date: string) => {
    setSubjectAttendanceStore(prev => {
      const subjectData = prev[subjectId] || {};
      const newDateData: Record<string, 'P'> = {};
      students.forEach(s => newDateData[s.id] = 'P');
      return {
        ...prev,
        [subjectId]: {
          ...subjectData,
          [date]: newDateData
        }
      };
    });
    notify(`All students marked Present for ${subjects.find(s => s.id === subjectId)?.name}.`);
  };

  return (
    <div className="flex min-h-screen bg-[#f8fafc] dark:bg-slate-950 transition-colors duration-500 relative">

      {notification && (
        <div className="fixed top-4 right-4 z-[100] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-premium rounded-2xl px-4 py-3 min-w-[220px] max-w-[90vw]">
          <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{notification.message}</p>
        </div>
      )}
      
      {/* ENROLLMENT MODAL */}
      <EnrollmentModal 
        isOpen={isEnrollModalOpen}
        onClose={() => setIsEnrollModalOpen(false)}
        enrollData={enrollData}
        setEnrollData={setEnrollData}
        students={students}
        onSubmit={handleEnrollSubmit}
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
      />

      <main className="flex-1 lg:ml-64 flex flex-col min-w-0">
        <header className="h-20 bg-white/60 dark:bg-slate-900/40 backdrop-blur-md px-4 sm:px-6 lg:px-8 flex items-center justify-between sticky top-0 z-40 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-4 sm:gap-8">
            <button className="lg:hidden p-3 text-slate-500 hover:text-brand-500 transition-all" onClick={() => setIsMobileMenuOpen(true)}><i className="fas fa-bars-staggered"></i></button>
            <div className="hidden sm:flex flex-col"><span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">System Pulse</span><span className="text-xs font-bold text-emerald-500">Live Calibration</span></div>
          </div>
          <div className="flex items-center gap-3 sm:gap-6">
            <button onClick={() => setIsDarkMode(!isDarkMode)} className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-brand-500 rounded-xl active:scale-75 transition-all"><i className={`fas ${isDarkMode ? 'fa-sun' : 'fa-moon'}`}></i></button>
            <div className="w-10 h-10 rounded-xl bg-slate-100 overflow-hidden border-2 border-slate-200 dark:border-slate-800"><img src={DEFAULT_AVATAR} className="w-full h-full object-cover" /></div>
          </div>
        </header>

        <div className="p-4 sm:p-6 lg:p-10 xl:p-12 space-y-8 sm:space-y-10 lg:space-y-12 max-w-[1800px] w-full mx-auto overflow-hidden">
          
          {/* DASHBOARD */}
          {currentPage === 'dashboard' && <Dashboard stats={stats} />}

          {/* STUDENTS PAGE (DIRECTORY) - FULL CRUD CONTROLS */}
          {currentPage === 'students' && (
            <StudentDirectory 
              students={students}
              selectedDate={selectedDate}
              setSelectedDate={setSelectedDate}
              openPermissions={openPermissions}
              openEditModal={openEditModal}
              deleteEntity={deleteEntity}
            />
          )}

          {/* REGISTRATION HUB - ENROLLMENT & DELETION */}
          {currentPage === 'student-register' && (
            <RegistrationHub 
              students={students}
              enrollStudentAction={enrollStudentAction}
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
              allStudents={allStudents}
              selectedStudents={selectedStudents}
              setSelectedStudents={setSelectedStudents}
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
              notify={notify}
            />
          )}

          {/* EXAM PAGE - WITH CRUD */}
          {currentPage === 'exam' && (
            <div className="space-y-12 animate-in fade-in duration-700 pb-20">
               <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tighter">Evaluation Hub</h2>
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
                  {exams.map((exam) => (
                    <div key={exam.id} className="bg-white dark:bg-slate-900 rounded-[64px] p-12 shadow-premium border border-slate-100 dark:border-slate-800 hover:-translate-y-3 transition-all relative group overflow-hidden">
                       <div className="flex justify-between items-start mb-10">
                          <div className={`w-20 h-20 ${exam.bg} ${exam.color} rounded-[32px] flex items-center justify-center text-3xl shadow-inner group-hover:rotate-12 transition-transform`}><i className="fas fa-calendar-check"></i></div>
                          <span className="px-5 py-2 rounded-full text-[9px] font-black uppercase tracking-widest bg-slate-50 dark:bg-slate-800 text-slate-400">{exam.date}</span>
                       </div>
                       <h4 className="text-2xl font-black mb-10 tracking-tight leading-tight group-hover:text-brand-500 transition-colors">{exam.subject}</h4>
                       <div className="flex items-center justify-between border-t border-slate-50 dark:border-slate-800 pt-8 mt-4">
                          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{exam.priority} Priority</span>
                          <div className="flex gap-4">
                             <button onClick={() => openEditModal('exam', exam)} className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-brand-500 transition-all"><i className="fas fa-edit"></i></button>
                             <button onClick={() => deleteEntity(exam.id, 'exam')} className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-rose-500 transition-all"><i className="fas fa-trash"></i></button>
                          </div>
                       </div>
                    </div>
                  ))}
               </div>
            </div>
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
            <div className="space-y-12 animate-in fade-in duration-700 pb-20">
               <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tighter">Assignment Matrix</h2>
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
                 {homeworks.map((task) => (
                    <div key={task.id} className="bg-white dark:bg-slate-900 p-12 rounded-[64px] shadow-premium border border-slate-100 dark:border-slate-800 hover:-translate-y-3 transition-all relative group">
                       <div className="absolute top-10 right-10 flex gap-4 opacity-0 group-hover:opacity-100 transition-all">
                          <button onClick={() => openEditModal('homework', task)} className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-300 hover:text-brand-500 transition-colors"><i className="fas fa-pen-to-square"></i></button>
                          <button onClick={() => deleteEntity(task.id, 'homework')} className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-300 hover:text-rose-500 transition-colors"><i className="fas fa-trash-can"></i></button>
                       </div>
                       <div className="flex justify-between items-start mb-10">
                          <div className={`w-16 h-16 ${task.bg} ${task.color} rounded-2xl flex items-center justify-center text-2xl shadow-inner group-hover:rotate-12 transition-transform`}><i className="fas fa-file-pen"></i></div>
                          <span className="px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-slate-50 dark:bg-slate-800 text-slate-400">{task.deadline}</span>
                       </div>
                       <h4 className="text-xl font-black mb-10 leading-snug tracking-tight">{task.title}</h4>
                       <div className="space-y-4">
                          <div className="flex justify-between text-[10px] font-black uppercase tracking-widest"><span className="text-slate-400">Node Load</span><span className="text-brand-500">{task.load}%</span></div>
                          <div className="h-2 w-full bg-slate-50 dark:bg-slate-800 rounded-full overflow-hidden"><div className="h-full bg-brand-500 shadow-glow transition-all" style={{ width: `${task.load}%` }}></div></div>
                       </div>
                    </div>
                 ))}
               </div>
            </div>
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
                             <div><p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Total Nodes</p><p className="text-2xl font-black">{prog.students}</p></div>
                             <div><p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Duration</p><p className="text-2xl font-black">{prog.duration}</p></div>
                          </div>
                       </div>
                    </div>
                 ))}
               </div>
            </div>
          )}

          {/* TEACHERS PAGE - WITH CRUD */}
          {currentPage === 'teachers' && (
            <div className="space-y-12 animate-in fade-in duration-600 pb-20">
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tighter">Academic Hub</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
                {teachers.map(t => (
                  <div key={t.id} className="group bg-white dark:bg-slate-900 p-12 rounded-[64px] shadow-premium border border-slate-100 dark:border-slate-800 hover:-translate-y-3 transition-all relative overflow-hidden">
                    <div className="absolute top-10 right-10 flex gap-4 opacity-0 group-hover:opacity-100 transition-all">
                       <button onClick={() => openEditModal('teacher', t)} className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-300 hover:text-brand-500 transition-colors"><i className="fas fa-edit"></i></button>
                       <button onClick={() => deleteEntity(t.id, 'teacher')} className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-300 hover:text-rose-500 transition-colors"><i className="fas fa-trash-can"></i></button>
                    </div>
                    <div className="flex justify-between items-start mb-10">
                      <div className="w-20 h-20 rounded-[32px] bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-4xl shadow-inner group-hover:scale-110 transition-transform"><i className={`fas ${t.icon} text-brand-500`}></i></div>
                      <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${t.status === 'Online' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>{t.status}</span>
                    </div>
                    <h4 className="text-2xl font-black group-hover:text-brand-500 transition-colors">{t.name}</h4>
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-8">{t.dept}</p>
                    <div className="space-y-4">
                      <div className="flex justify-between text-[10px] font-black uppercase tracking-widest"><span className="text-slate-400">Faculty Load</span><span className="text-brand-500">{t.load}%</span></div>
                      <div className="h-2.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden"><div className="h-full bg-brand-500 shadow-glow" style={{ width: `${t.load}%` }}></div></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* FALLBACK HUB */}
          {![ 'dashboard', 'students', 'student-attendance', 'student-register', 'teachers', 'library', 'homework', 'programs', 'exam', 'security', 'subject' ].includes(currentPage) && (
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