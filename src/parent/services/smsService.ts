
import { supabase } from '../../sms/supabaseClient';

export interface SubjectResult {
  name: string;
  grade: string;
  score: number;
  comment: string;
}

export interface ReportCard {
  term: string;
  gpa: string;
  rank: string;
  attendance: string;
  subjects: SubjectResult[];
}

export interface PaymentRecord {
  id: string;
  description: string;
  amount: number;
  status: 'Paid' | 'Pending' | 'Overdue' | 'paid' | 'pending' | 'overdue';
  date: string;
  note?: string;
}

export interface ExamResult {
  subject: string;
  score: number;
  grade: string;
  examTitle: string;
  date: string;
}

export interface AttendanceStats {
  total: number;
  present: number;
  absent: number;
  late: number;
  rate: string;
}

export interface HomeworkItem {
  id: string;
  title: string;
  status: string;
  dueDate: string;
  description: string;
}

export interface NoticeRecord {
  title: string;
  content: string;
  date: string;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  date: string;
}

export interface ParentPortalData {
  examResults: ExamResult[];
  attendance: AttendanceStats;
  homework: HomeworkItem[];
  payments: PaymentRecord[];
  reportCard: ReportCard | null;
  notices: NoticeRecord[];
  achievements: Achievement[];
  lastSync: string;
}

/**
 * Fetches all live data from Supabase for the given student IDs.
 * Falls back gracefully with zeros/empty arrays if data is missing.
 */
export const fetchParentPortalData = async (
  studentIds: string[],
  schoolId: string | undefined
): Promise<ParentPortalData> => {
  if (!studentIds || studentIds.length === 0 || !schoolId) {
    return getEmptyPortalData();
  }

  const primaryStudentId = studentIds[0];

  const [
    examGradesRes,
    attendanceRes,
    paymentsRes,
    reportCardRes,
    noticesRes,
    achievementsRes,
  ] = await Promise.allSettled([
    // 3. Exam grades - use student_id and school_id
    supabase
      .from('exam_grades')
      .select('percentage, grade, note, student_id, exam_id, exam_title, exams(title, exam_date, class_id)')
      .eq('student_id', primaryStudentId)
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false }),

    // 4. Attendance - use student_id and school_id
    supabase
      .from('attendance_records')
      .select('status, attendance_date')
      .eq('student_id', primaryStudentId)
      .eq('school_id', schoolId),

    // 5. Student payments - get all history for student and school
    supabase
      .from('student_payments')
      .select('id, amount_mmk, status, created_at, note')
      .eq('student_id', primaryStudentId)
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false })
      .limit(50),

    // 6. Latest report card - use student_id and school_id
    supabase
      .from('report_cards')
      .select('*')
      .eq('student_id', primaryStudentId)
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),

    // 7. Notice board - use school_id
    supabase
      .from('notice_board')
      .select('title, message, notice_date')
      .eq('school_id', schoolId)
      .order('notice_date', { ascending: false })
      .limit(5),

    // 8. Achievements - use student_id and school_id
    supabase
      .from('student_achievements')
      .select('*')
      .eq('student_id', primaryStudentId)
      .eq('school_id', schoolId)
      .order('achievement_date', { ascending: false }),
  ]);

  // --- Sub-queries for Homework ---
  let homework: HomeworkItem[] = [];
  if (noticesRes.status === 'fulfilled') { // Just a marker to keep the flow
    // 1. Try direct mapping from class_course_students
    const classStudentRes = (examGradesRes.status === 'fulfilled' ? (await Promise.allSettled([
      supabase.from('class_course_students').select('class_id').eq('student_id', primaryStudentId).eq('school_id', schoolId)
    ]))[0] : null);

    let classIds: string[] = [];
    if (classStudentRes && classStudentRes.status === 'fulfilled' && classStudentRes.value.data) {
      const data = classStudentRes.value.data as any[];
      classIds = Array.from(new Set(data.map(d => d.class_id).filter(Boolean)));
    }

    let classId = classIds.length > 0 ? classIds[0] : null;

    // 2. Fallback: Try to get class_id from existing exam records if mapping is missing
    if (!classId && examGradesRes.status === 'fulfilled' && examGradesRes.value.data) {
      const examData = examGradesRes.value.data as any[];
      const foundExamClassId = examData.find(eg => eg.exams?.class_id)?.exams?.class_id;
      if (foundExamClassId) {
        classId = foundExamClassId;
        if (classId) classIds.push(classId);
      }
    }

    // 3. Fallback: Try student_courses -> class_courses
    if (!classId) {
      const studentCoursesRes = await supabase
        .from('student_courses')
        .select('course_id')
        .eq('student_id', primaryStudentId);
      
      if (!studentCoursesRes.error && studentCoursesRes.data && studentCoursesRes.data.length > 0) {
        const courseIds = studentCoursesRes.data.map(sc => sc.course_id);
        const classCoursesRes = await supabase
          .from('class_courses')
          .select('class_id')
          .in('id', courseIds)
          .limit(1);
        
        if (!classCoursesRes.error && classCoursesRes.data && classCoursesRes.data.length > 0) {
          classId = classCoursesRes.data[0].class_id;
        }
      }
    }

    if (classIds.length > 0) {
      const [assignmentsRes, submissionsRes] = await Promise.all([
        supabase
          .from('homework_assignments')
          .select('id, title, due_date, description')
          .in('class_id', classIds)
          .eq('school_id', schoolId)
          .order('due_date', { ascending: true }),
        supabase
          .from('homework_submissions')
          .select('assignment_id, status')
          .eq('student_id', primaryStudentId)
          .eq('school_id', schoolId)
      ]);

      console.log('[smsService] Assignments fetch result:', assignmentsRes.data?.length || 0, 'rows');
      console.log('[smsService] Submissions fetch result:', submissionsRes.data?.length || 0, 'rows');

      if (assignmentsRes.data) {
        const submissionMap = new Map((submissionsRes.data || []).map(s => [s.assignment_id, s.status]));
        for (const row of assignmentsRes.data) {
          const subStatus = submissionMap.get(row.id);
          homework.push({
            id: String(row.id),
            title: row.title || 'Assignment',
            status: subStatus || 'Pending',
            dueDate: row.due_date || '',
            description: (row as any).description || '',
          });
        }
      }
    }
  }

  // --- Exam Results ---
  const examResults: ExamResult[] = [];
  if (examGradesRes.status === 'fulfilled' && examGradesRes.value.data) {
    for (const row of examGradesRes.value.data) {
      const exam = (row as any).exams;
      // Get percentage, or try to parse from grade if percentage is missing
      let percentage = parsePercentage((row as any).percentage);
      
      // Fallback: If percentage is 0 and grade looks like a number, use grade
      if (percentage === 0) {
        const gradeVal = parsePercentage(row.grade);
        if (gradeVal > 0) percentage = gradeVal;
      }

      examResults.push({
        subject: (row as any).exam_title || exam?.title || 'Subject',
        score: percentage || 0,
        grade: String(row.grade || scoreToGrade(percentage || 0)),
        examTitle: (row as any).exam_title || exam?.title || 'Assessment',
        date: exam?.exam_date || '',
      });
    }
  }

  // --- Attendance ---
  const attendance: AttendanceStats = { total: 0, present: 0, absent: 0, late: 0, rate: '0%' };
  if (attendanceRes.status === 'fulfilled' && attendanceRes.value.data) {
    const records = attendanceRes.value.data;
    attendance.total = records.length;
    attendance.present = records.filter((r: any) => {
      const s = String(r.status || '').toLowerCase();
      return s === 'p' || s === 'present' || s === 'true';
    }).length;
    attendance.absent = records.filter((r: any) => {
      const s = String(r.status || '').toLowerCase();
      return s === 'a' || s === 'absent' || s === 'false';
    }).length;
    attendance.late = records.filter((r: any) => {
      const s = String(r.status || '').toLowerCase();
      return s === 'l' || s === 'late';
    }).length;
    attendance.rate = attendance.total > 0
      ? `${Math.round((attendance.present / attendance.total) * 100)}%`
      : '0%';
  }

  // --- Homework (Processed above) ---


  // --- Payments ---
  const payments: PaymentRecord[] = [];
  if (paymentsRes.status === 'fulfilled' && paymentsRes.value.data) {
    for (const row of paymentsRes.value.data) {
      payments.push({
        id: String(row.id),
        description: row.note || 'Fee',
        amount: Number(row.amount_mmk) || 0,
        status: row.status ? (row.status.charAt(0).toUpperCase() + row.status.slice(1).toLowerCase() as PaymentRecord['status']) : 'Pending',
        date: row.created_at ? new Date(row.created_at).toLocaleDateString() : '',
        note: row.note || '',
      });
    }
  }

  // --- Report Card ---
  let reportCard: ReportCard | null = null;
  if (reportCardRes.status === 'fulfilled' && reportCardRes.value.data) {
    const rc = reportCardRes.value.data as any;
    // Parse subjects either from JSON or build from exam results
    let subjects: SubjectResult[] = [];
    if (Array.isArray(rc.subjects)) {
      subjects = rc.subjects;
    } else if (examResults.length > 0) {
      // Build per-subject averages from exam grades
      const subjectMap: Record<string, number[]> = {};
      examResults.forEach(e => {
        if (!subjectMap[e.subject]) subjectMap[e.subject] = [];
        subjectMap[e.subject].push(e.score);
      });
      subjects = Object.entries(subjectMap).map(([name, scores]) => {
        const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
        return { name, score: avg, grade: scoreToGrade(avg), comment: '' };
      });
    }

    const overallAvg = examResults.length > 0
      ? examResults.reduce((sum, e) => sum + e.score, 0) / examResults.length
      : 0;

    reportCard = {
      term: rc.term || rc.semester || 'Current Term',
      gpa: overallAvg > 0 ? `${overallAvg.toFixed(2)}%` : '0.00%',
      rank: rc.rank || '—',
      attendance: attendance.rate,
      subjects,
    };
  } else if (examResults.length > 0) {
    // Build from exam_grades if no report_card row
    const subjectMap: Record<string, number[]> = {};
    examResults.forEach(e => {
      if (!subjectMap[e.subject]) subjectMap[e.subject] = [];
      subjectMap[e.subject].push(e.score);
    });
    const subjects: SubjectResult[] = Object.entries(subjectMap).map(([name, scores]) => {
      const avg = Math.round(scores.reduce((a, b) => a + b, 0) / (scores.length || 1));
      return { name, score: avg, grade: scoreToGrade(avg), comment: '' };
    });
    
    const overallAvg = examResults.reduce((sum, e) => sum + e.score, 0) / (examResults.length || 1);

    reportCard = {
      term: 'Current Term',
      gpa: `${overallAvg.toFixed(2)}%`,
      rank: '—',
      attendance: attendance.rate,
      subjects,
    };
  }

  // --- Notices ---
  const notices: NoticeRecord[] = [];
  if (noticesRes.status === 'fulfilled' && noticesRes.value.data) {
    for (const row of noticesRes.value.data) {
      notices.push({
        title: row.title || 'Notification',
        content: (row as any).message || '',
        date: (row as any).notice_date ? new Date((row as any).notice_date).toLocaleDateString() : '',
      });
    }
  }

  // --- Achievements ---
  const achievements: Achievement[] = [];
  if (achievementsRes.status === 'fulfilled' && achievementsRes.value.data) {
    for (const row of achievementsRes.value.data) {
      achievements.push({
        id: row.id,
        title: row.title,
        description: row.description || '',
        icon: row.icon || 'fa-award',
        color: row.color ? (row.color.startsWith('text-') ? row.color : `text-${row.color}-500`) : 'text-emerald-500',
        date: row.achievement_date ? new Date(row.achievement_date).toLocaleDateString() : '',
      });
    }
  }

  return {
    examResults,
    attendance,
    homework,
    payments,
    reportCard,
    notices,
    achievements,
    lastSync: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  };
};

export const fetchEvents = async (schoolId: string) => {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('school_id', schoolId)
    .order('event_date', { ascending: true });
  if (error) throw error;
  return data || [];
};

export const fetchStudentActivities = async (schoolId: string) => {
  const { data, error } = await supabase
    .from('student_activities')
    .select('*')
    .eq('school_id', schoolId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
};

export const fetchParentAnnouncements = async (schoolId: string) => {
  const { data, error } = await supabase
    .from('parent_announcements')
    .select('*')
    .eq('school_id', schoolId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
};

export const fetchLiveIntel = async (schoolId: string) => {
  const { data, error } = await supabase
    .from('live_intel')
    .select('*')
    .eq('school_id', schoolId)
    .order('created_at', { ascending: false })
    .limit(10);
  if (error) throw error;
  return data || [];
};

// ---------- helpers ----------

function scoreToGrade(score: number): string {
  if (score >= 97) return 'A+';
  if (score >= 93) return 'A';
  if (score >= 90) return 'A-';
  if (score >= 87) return 'B+';
  if (score >= 83) return 'B';
  if (score >= 80) return 'B-';
  if (score >= 77) return 'C+';
  if (score >= 73) return 'C';
  if (score >= 70) return 'C-';
  if (score >= 60) return 'D';
  return 'F';
}

function parsePercentage(val: any): number {
  if (val === null || val === undefined) return 0;
  const str = String(val).trim();
  if (!str) return 0;
  // Remove % and any non-numeric characters except decimal point
  const numericStr = str.replace(/[^0-9.]/g, '');
  const num = parseFloat(numericStr);
  return isNaN(num) ? 0 : num;
}

function getEmptyPortalData(): ParentPortalData {
  return {
    examResults: [],
    attendance: { total: 0, present: 0, absent: 0, late: 0, rate: '0%' },
    homework: [],
    payments: [],
    reportCard: null,
    notices: [],
    achievements: [],
    lastSync: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  };
}

// Legacy export kept for backward compat
export const syncSmsData = fetchParentPortalData;
