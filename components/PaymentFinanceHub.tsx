import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient';

type FinanceView = 'payment' | 'payment-assign' | 'payment-history' | 'late-payment' | 'student-finance-status';

type AppStudent = {
  id: string;
  name: string;
  email?: string;
};

type PaymentStatus = 'paid' | 'pending' | 'overdue';

type StudentPayment = {
  id: string;
  student_id: string;
  amount_mmk: number;
  payment_date: string;
  due_date: string | null;
  status: PaymentStatus;
  note: string | null;
  created_at: string;
};

type StudentCourseLink = {
  student_id: string;
  class_id: string;
  class_course_id: string;
};

type AppCourse = {
  id: string;
  name: string;
  class_id: string;
};

type PaymentFinanceHubProps = {
  view: FinanceView;
};

const getTodayIso = () => new Date().toISOString().slice(0, 10);
const toIsoDate = (value: string | null | undefined) => {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().slice(0, 10);
};

const formatMMK = (value: number) => `${Math.round(value || 0).toLocaleString('en-US')} MMK`;

const PaymentFinanceHub: React.FC<PaymentFinanceHubProps> = ({ view }) => {
  const [students, setStudents] = useState<AppStudent[]>([]);
  const [payments, setPayments] = useState<StudentPayment[]>([]);
  const [studentCourseLinks, setStudentCourseLinks] = useState<StudentCourseLink[]>([]);
  const [courseRows, setCourseRows] = useState<AppCourse[]>([]);
  const [classesMap, setClassesMap] = useState<Map<string, string>>(new Map());
  const [coursesMap, setCoursesMap] = useState<Map<string, string>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [studentSearchQuery, setStudentSearchQuery] = useState('');
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [assignAmountMmk, setAssignAmountMmk] = useState('');
  const [assignDueDate, setAssignDueDate] = useState(getTodayIso());
  const [assignNote, setAssignNote] = useState('');
  const [assignClassFilter, setAssignClassFilter] = useState('');
  const [assignCourseFilter, setAssignCourseFilter] = useState('');
  const [financeStatusTab, setFinanceStatusTab] = useState<'all' | 'pending'>('all');

  const [formData, setFormData] = useState({
    student_id: '',
    amount_mmk: '',
    payment_date: getTodayIso(),
    due_date: getTodayIso(),
    status: 'paid' as PaymentStatus,
    note: '',
  });

  const studentMap = useMemo(() => {
    const map = new Map<string, AppStudent>();
    students.forEach(student => map.set(student.id, student));
    return map;
  }, [students]);

  const studentAcademicMap = useMemo(() => {
    const map = new Map<string, { className: string; courseName: string }>();

    studentCourseLinks.forEach(link => {
      if (!link.student_id || map.has(link.student_id)) return;
      map.set(link.student_id, {
        className: classesMap.get(link.class_id) || 'Unassigned Class',
        courseName: coursesMap.get(link.class_course_id) || 'Unassigned Course',
      });
    });

    return map;
  }, [studentCourseLinks, classesMap, coursesMap]);

  const studentAcademicIdMap = useMemo(() => {
    const map = new Map<string, { classIds: Set<string>; courseIds: Set<string> }>();

    studentCourseLinks.forEach(link => {
      if (!link.student_id) return;
      const current = map.get(link.student_id) || { classIds: new Set<string>(), courseIds: new Set<string>() };
      if (link.class_id) current.classIds.add(link.class_id);
      if (link.class_course_id) current.courseIds.add(link.class_course_id);
      map.set(link.student_id, current);
    });

    return map;
  }, [studentCourseLinks]);

  const getStudentAcademic = (studentId: string) => {
    const data = studentAcademicMap.get(studentId);
    if (!data) {
      return {
        className: 'Unassigned Class',
        courseName: 'Unassigned Course',
      };
    }

    return data;
  };

  const getStudentAcademicIds = (studentId: string) => {
    const data = studentAcademicIdMap.get(studentId);
    if (!data) {
      return {
        classIds: new Set<string>(),
        courseIds: new Set<string>(),
      };
    }

    return data;
  };

  const matchesStudentSearch = (studentId: string) => {
    const q = studentSearchQuery.trim().toLowerCase();
    if (!q) return true;
    const student = studentMap.get(studentId);
    const name = String(student?.name || studentId).toLowerCase();
    const email = String(student?.email || '').toLowerCase();
    return name.includes(q) || email.includes(q);
  };

  const filteredStudents = useMemo(
    () => students.filter(student => matchesStudentSearch(student.id)),
    [students, studentSearchQuery, studentMap]
  );

  const assignClassOptions = useMemo(() => {
    const uniqueIds = new Set<string>();
    studentCourseLinks.forEach(link => {
      if (link.class_id) uniqueIds.add(link.class_id);
    });

    return Array.from(uniqueIds)
      .map(id => ({ id, name: classesMap.get(id) || id }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [studentCourseLinks, classesMap]);

  const assignCourseOptions = useMemo(() => {
    if (!assignClassFilter) return [];

    return courseRows
      .filter(course => course.class_id === assignClassFilter)
      .map(course => ({ id: course.id, name: course.name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [courseRows, assignClassFilter]);

  const filteredStudentsForAssign = useMemo(
    () => filteredStudents.filter(student => {
      const academicIds = getStudentAcademicIds(student.id);
      if (assignClassFilter && !academicIds.classIds.has(assignClassFilter)) return false;
      if (assignCourseFilter && !academicIds.courseIds.has(assignCourseFilter)) return false;
      return true;
    }),
    [filteredStudents, assignClassFilter, assignCourseFilter, studentAcademicIdMap]
  );

  const areAllFilteredStudentsSelected = filteredStudentsForAssign.length > 0
    && filteredStudentsForAssign.every(student => selectedStudentIds.includes(student.id));

  useEffect(() => {
    setAssignCourseFilter('');
  }, [assignClassFilter]);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [studentsResult, paymentsResult, classesResult, coursesResult, linksResult] = await Promise.all([
        supabase
          .from('students')
          .select('id, name, email')
          .order('created_at', { ascending: false }),
        supabase
          .from('student_payments')
          .select('*')
          .order('created_at', { ascending: false }),
        supabase
          .from('classes')
          .select('id, name'),
        supabase
          .from('class_courses')
          .select('id, name, class_id'),
        supabase
          .from('class_course_students')
          .select('student_id, class_id, class_course_id, created_at')
          .order('created_at', { ascending: true }),
      ]);

      if (studentsResult.error) throw studentsResult.error;
      if (paymentsResult.error) throw paymentsResult.error;
      if (classesResult.error) throw classesResult.error;
      if (coursesResult.error) throw coursesResult.error;
      if (linksResult.error) throw linksResult.error;

      const studentRows = (studentsResult.data || []).map((row: any) => ({
        id: String(row.id),
        name: String(row.name || row.full_name || row.id),
        email: row.email ? String(row.email) : '',
      }));

      const paymentRows = (paymentsResult.data || []).map((row: any) => ({
        id: String(row.id),
        student_id: String(row.student_id || ''),
        amount_mmk: Number(row.amount_mmk || 0),
        payment_date: String(row.payment_date || row.created_at || getTodayIso()),
        due_date: row.due_date ? String(row.due_date) : null,
        status: (String(row.status || 'paid').toLowerCase() as PaymentStatus),
        note: row.note ? String(row.note) : null,
        created_at: String(row.created_at || new Date().toISOString()),
      }));

      const nextClassesMap = new Map<string, string>();
      (classesResult.data || []).forEach((row: any) => {
        nextClassesMap.set(String(row.id), String(row.name || row.id));
      });

      const nextCoursesMap = new Map<string, string>();
      const nextCourseRows: AppCourse[] = [];
      (coursesResult.data || []).forEach((row: any) => {
        nextCoursesMap.set(String(row.id), String(row.name || row.id));
        nextCourseRows.push({
          id: String(row.id),
          name: String(row.name || row.id),
          class_id: String(row.class_id || ''),
        });
      });

      const linkRows = (linksResult.data || []).map((row: any) => ({
        student_id: String(row.student_id || ''),
        class_id: String(row.class_id || ''),
        class_course_id: String(row.class_course_id || ''),
      })).filter((row: StudentCourseLink) => row.student_id);

      setStudents(studentRows);
      setPayments(paymentRows);
      setClassesMap(nextClassesMap);
      setCoursesMap(nextCoursesMap);
      setCourseRows(nextCourseRows);
      setStudentCourseLinks(linkRows);
    } catch (loadError: any) {
      setError(loadError?.message || 'Failed to load payment records.');
      setStudents([]);
      setPayments([]);
      setClassesMap(new Map());
      setCoursesMap(new Map());
      setCourseRows([]);
      setStudentCourseLinks([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const isLate = (payment: StudentPayment) => {
    if (!payment.due_date) return false;
    if (payment.status === 'paid') return false;
    const due = toIsoDate(payment.due_date);
    if (!due) return false;
    return due < getTodayIso();
  };

  const isPaidLate = (payment: StudentPayment) => {
    if (payment.status !== 'paid' || !payment.due_date) return false;
    const paid = toIsoDate(payment.payment_date);
    const due = toIsoDate(payment.due_date);
    if (!paid || !due) return false;
    return paid > due;
  };

  const latePayments = useMemo(
    () => payments.filter(payment => isPaidLate(payment)),
    [payments]
  );

  const filteredPayments = useMemo(
    () => payments.filter(payment => matchesStudentSearch(payment.student_id)),
    [payments, studentSearchQuery, studentMap]
  );

  const filteredLatePayments = useMemo(
    () => latePayments.filter(payment => matchesStudentSearch(payment.student_id)),
    [latePayments, studentSearchQuery, studentMap]
  );

  const studentFinanceRows = useMemo(() => {
    const map = new Map<string, {
      student: AppStudent;
      totalPaid: number;
      totalPending: number;
      totalOverdue: number;
      status: 'pending' | 'overdue' | 'clear';
    }>();

    students.forEach(student => {
      map.set(student.id, {
        student,
        totalPaid: 0,
        totalPending: 0,
        totalOverdue: 0,
        status: 'clear',
      });
    });

    payments.forEach(payment => {
      const student = studentMap.get(payment.student_id) || { id: payment.student_id, name: payment.student_id, email: '' };
      const current = map.get(payment.student_id) || {
        student,
        totalPaid: 0,
        totalPending: 0,
        totalOverdue: 0,
        status: 'clear' as const,
      };

      if (payment.status === 'paid') {
        current.totalPaid += payment.amount_mmk;
      } else if (payment.status === 'pending') {
        if (isLate(payment)) {
          current.totalOverdue += payment.amount_mmk;
        } else {
          current.totalPending += payment.amount_mmk;
        }
      } else {
        current.totalOverdue += payment.amount_mmk;
      }

      map.set(payment.student_id, current);
    });

    const rows = Array.from(map.values()).map(item => {
      const statusValue: 'pending' | 'overdue' | 'clear' = item.totalOverdue > 0
        ? 'overdue'
        : item.totalPending > 0
          ? 'pending'
          : 'clear';

      return {
        ...item,
        status: statusValue,
      };
    });

    return rows.sort((a, b) => {
      const order = { overdue: 0, pending: 1, clear: 2 } as const;
      return order[a.status] - order[b.status];
    });
  }, [payments, studentMap, students]);

  const filteredStudentFinanceRows = useMemo(
    () => studentFinanceRows.filter(row => matchesStudentSearch(row.student.id)),
    [studentFinanceRows, studentSearchQuery, studentMap]
  );

  const pendingStudentFinanceRows = useMemo(
    () => filteredStudentFinanceRows.filter(row => (row.totalPending + row.totalOverdue) > 0),
    [filteredStudentFinanceRows]
  );

  const toggleStudentSelection = (studentId: string) => {
    setSelectedStudentIds(prev => (
      prev.includes(studentId)
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    ));
  };

  const toggleSelectAllFilteredStudents = () => {
    if (areAllFilteredStudentsSelected) {
      setSelectedStudentIds(prev => prev.filter(id => !filteredStudentsForAssign.some(student => student.id === id)));
      return;
    }

    setSelectedStudentIds(prev => {
      const next = new Set(prev);
      filteredStudentsForAssign.forEach(student => next.add(student.id));
      return Array.from(next);
    });
  };

  const assignPaymentsToSelectedStudents = async () => {
    setError(null);
    setStatus(null);

    if (selectedStudentIds.length === 0) {
      setError('Select at least one student.');
      return;
    }

    const amount = Number(assignAmountMmk);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Please enter a valid amount in MMK.');
      return;
    }

    if (!assignDueDate) {
      setError('Please set a deadline date.');
      return;
    }

    setIsSaving(true);
    try {
      const rows = selectedStudentIds.map(studentId => ({
        student_id: studentId,
        amount_mmk: Math.round(amount),
        payment_date: getTodayIso(),
        due_date: assignDueDate,
        status: 'pending' as PaymentStatus,
        note: assignNote.trim() || null,
      }));

      const insertResult = await supabase.from('student_payments').insert(rows);
      if (insertResult.error) throw insertResult.error;

      setStatus(`Assigned pending dues to ${selectedStudentIds.length} student(s).`);
      setSelectedStudentIds([]);
      setAssignAmountMmk('');
      setAssignNote('');
      setAssignDueDate(getTodayIso());
      await loadData();
    } catch (assignError: any) {
      setError(assignError?.message || 'Failed to assign payments.');
    } finally {
      setIsSaving(false);
    }
  };

  const submitPayment = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setStatus(null);

    if (!formData.student_id) {
      setError('Please select a student.');
      return;
    }

    const amount = Number(formData.amount_mmk);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Please enter a valid amount in MMK.');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        student_id: formData.student_id,
        amount_mmk: Math.round(amount),
        payment_date: formData.payment_date || getTodayIso(),
        due_date: formData.due_date || null,
        status: formData.status,
        note: formData.note.trim() || null,
      };

      const insertResult = await supabase.from('student_payments').insert([payload]);
      if (insertResult.error) throw insertResult.error;

      setStatus('Payment saved.');
      setFormData({
        student_id: '',
        amount_mmk: '',
        payment_date: getTodayIso(),
        due_date: getTodayIso(),
        status: 'paid',
        note: '',
      });

      await loadData();
    } catch (saveError: any) {
      setError(saveError?.message || 'Failed to save payment.');
    } finally {
      setIsSaving(false);
    }
  };

  const pageMeta = {
    payment: {
      title: 'Payment Collection Desk',
      subtitle: 'Record payments collected from students in MMK.',
    },
    'payment-assign': {
      title: 'Assign Student Dues',
      subtitle: 'Assign pending amount students must pay by deadline.',
    },
    'payment-history': {
      title: 'Payment History',
      subtitle: 'Track all recorded student payments.',
    },
    'late-payment': {
      title: 'Late Payment',
      subtitle: 'Monitor overdue student payments.',
    },
    'student-finance-status': {
      title: 'Student Finance Status',
      subtitle: 'Pending and overdue visibility by student.',
    },
  } as const;

  return (
    <div className="space-y-8 pb-20 animate-in fade-in duration-700">
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-700 rounded-[40px] p-6 sm:p-8 lg:p-10 text-white shadow-premium">
        <p className="text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] text-emerald-200">Finance Control</p>
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tighter mt-2">{pageMeta[view].title}</h2>
        <p className="text-slate-200 mt-3 text-sm sm:text-base">{pageMeta[view].subtitle}</p>
      </div>

      {(error || status) && (
        <div className="space-y-2">
          {error && <p className="text-sm font-semibold text-rose-600 bg-rose-50 rounded-2xl px-4 py-3">{error}</p>}
          {status && <p className="text-sm font-semibold text-emerald-700 bg-emerald-50 rounded-2xl px-4 py-3">{status}</p>}
        </div>
      )}

      {(view === 'payment-history' || view === 'late-payment' || view === 'student-finance-status' || view === 'payment' || view === 'payment-assign') && (
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[28px] p-4 sm:p-5 shadow-premium">
          <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Search Student</label>
          <input
            value={studentSearchQuery}
            onChange={(event) => setStudentSearchQuery(event.target.value)}
            placeholder="Search by student name or email"
            className="mt-2 w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-4 py-3 text-sm font-semibold"
          />
        </div>
      )}

      {isLoading ? (
        <div className="rounded-[32px] border border-slate-200 bg-white dark:bg-slate-900 px-6 py-8 text-sm font-semibold text-slate-500">
          Loading finance data...
        </div>
      ) : (
        <>
          {view === 'payment' && (
            <form onSubmit={submitPayment} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[36px] p-5 sm:p-6 lg:p-8 shadow-premium space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Student</label>
                  <select
                    value={formData.student_id}
                    onChange={(event) => setFormData(prev => ({ ...prev, student_id: event.target.value }))}
                    className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-4 py-3 text-sm font-semibold"
                  >
                    <option value="">Select student</option>
                    {students.map(student => {
                      const academic = getStudentAcademic(student.id);
                      return (
                        <option key={student.id} value={student.id}>{student.name} ({academic.className} / {academic.courseName})</option>
                      );
                    })}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Amount Received (MMK)</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={formData.amount_mmk}
                    onChange={(event) => setFormData(prev => ({ ...prev, amount_mmk: event.target.value }))}
                    placeholder="e.g. 150000 collected"
                    className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-4 py-3 text-sm font-semibold"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Date Collected</label>
                  <input
                    type="date"
                    value={formData.payment_date}
                    onChange={(event) => setFormData(prev => ({ ...prev, payment_date: event.target.value }))}
                    className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-4 py-3 text-sm font-semibold"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Due Date (If Any)</label>
                  <input
                    type="date"
                    value={formData.due_date}
                    onChange={(event) => setFormData(prev => ({ ...prev, due_date: event.target.value }))}
                    className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-4 py-3 text-sm font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Status</label>
                  <select
                    value={formData.status}
                    onChange={(event) => setFormData(prev => ({ ...prev, status: event.target.value as PaymentStatus }))}
                    className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-4 py-3 text-sm font-semibold"
                  >
                    <option value="paid">Paid</option>
                    <option value="pending">Pending</option>
                    <option value="overdue">Overdue</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Note (Optional)</label>
                  <input
                    value={formData.note}
                    onChange={(event) => setFormData(prev => ({ ...prev, note: event.target.value }))}
                    placeholder="Installment, scholarship, etc."
                    className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-4 py-3 text-sm font-semibold"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-black uppercase tracking-widest disabled:opacity-60"
                >
                  {isSaving ? 'Saving...' : 'Save Collected Payment'}
                </button>
              </div>
            </form>
          )}

          {view === 'payment-assign' && (
            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[36px] p-5 sm:p-6 lg:p-8 shadow-premium space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Amount Student Must Pay (MMK)</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={assignAmountMmk}
                    onChange={(event) => setAssignAmountMmk(event.target.value)}
                    placeholder="e.g. 150000 due"
                    className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-4 py-3 text-sm font-semibold"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Payment Deadline</label>
                  <input
                    type="date"
                    value={assignDueDate}
                    onChange={(event) => setAssignDueDate(event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-4 py-3 text-sm font-semibold"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Note (Optional)</label>
                  <input
                    value={assignNote}
                    onChange={(event) => setAssignNote(event.target.value)}
                    placeholder="Monthly fee, lab fee, etc."
                    className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-4 py-3 text-sm font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Filter By Class</label>
                  <select
                    value={assignClassFilter}
                    onChange={(event) => setAssignClassFilter(event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-4 py-3 text-sm font-semibold"
                  >
                    <option value="">All Classes</option>
                    {assignClassOptions.map(item => (
                      <option key={item.id} value={item.id}>{item.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Filter By Course</label>
                  <select
                    value={assignCourseFilter}
                    onChange={(event) => setAssignCourseFilter(event.target.value)}
                    disabled={!assignClassFilter}
                    className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-4 py-3 text-sm font-semibold"
                  >
                    <option value="">{assignClassFilter ? 'All Courses' : 'Select class first'}</option>
                    {assignCourseOptions.map(item => (
                      <option key={item.id} value={item.id}>{item.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <label className="inline-flex items-center gap-2 text-sm font-black text-slate-700 dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={areAllFilteredStudentsSelected}
                    onChange={toggleSelectAllFilteredStudents}
                    className="w-4 h-4 rounded border-slate-300"
                  />
                  Select All
                </label>
                <p className="text-xs font-black uppercase tracking-widest text-slate-500">
                  {selectedStudentIds.length} Selected
                </p>
              </div>

              <div className="max-h-[380px] overflow-y-auto space-y-2 pr-1">
                {filteredStudentsForAssign.length === 0 ? (
                  <p className="text-sm font-semibold text-slate-500">No students match your search.</p>
                ) : (
                  filteredStudentsForAssign.map(student => {
                    const academic = getStudentAcademic(student.id);
                    const isSelected = selectedStudentIds.includes(student.id);
                    return (
                      <label key={student.id} className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 cursor-pointer transition-all ${isSelected ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 dark:border-slate-700'}`}>
                        <div className="flex items-center gap-3 min-w-0">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleStudentSelection(student.id)}
                            className="w-4 h-4 rounded border-slate-300"
                          />
                          <div className="min-w-0">
                            <p className="text-sm font-black text-slate-900 dark:text-white truncate">{student.name}</p>
                            <p className="text-[11px] text-slate-500 truncate">{student.email || 'No email'}</p>
                          </div>
                        </div>
                        <div className="hidden sm:flex flex-wrap gap-2 justify-end">
                          <span className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 text-[11px] font-black">{academic.className}</span>
                          <span className="px-2.5 py-1 rounded-lg bg-cyan-50 text-cyan-700 text-[11px] font-black">{academic.courseName}</span>
                        </div>
                      </label>
                    );
                  })
                )}
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => void assignPaymentsToSelectedStudents()}
                  disabled={isSaving}
                  className="px-5 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-black uppercase tracking-widest disabled:opacity-60"
                >
                  {isSaving ? 'Assigning...' : 'Assign Pending Dues'}
                </button>
              </div>
            </div>
          )}

          {(view === 'payment-history' || view === 'payment') && (
            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[36px] p-5 sm:p-6 lg:p-8 shadow-premium space-y-4">
              <h3 className="text-xl font-black tracking-tight">Payment History</h3>
              {filteredPayments.length === 0 ? (
                <p className="text-sm font-semibold text-slate-500">No payment records found.</p>
              ) : (
                <div className="space-y-3">
                  {filteredPayments.map(payment => (
                    <div key={payment.id} className="rounded-2xl border border-slate-200 dark:border-slate-700 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="space-y-2">
                        <p className="text-sm font-black text-slate-900 dark:text-white">{studentMap.get(payment.student_id)?.name || payment.student_id}</p>
                        <p className="text-xs text-slate-500">
                          Collected: {toIsoDate(payment.payment_date) || '-'} | Deadline: {toIsoDate(payment.due_date) || '-'}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <span className="px-3 py-1.5 rounded-xl bg-indigo-50 text-indigo-700 text-xs font-black tracking-wide">
                            Class: {getStudentAcademic(payment.student_id).className}
                          </span>
                          <span className="px-3 py-1.5 rounded-xl bg-cyan-50 text-cyan-700 text-xs font-black tracking-wide">
                            Course: {getStudentAcademic(payment.student_id).courseName}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-[10px] font-black uppercase tracking-widest text-slate-500">{payment.status}</span>
                        <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-[10px] font-black uppercase tracking-widest text-emerald-700">{formatMMK(payment.amount_mmk)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {view === 'late-payment' && (
            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[36px] p-5 sm:p-6 lg:p-8 shadow-premium space-y-4">
              <h3 className="text-xl font-black tracking-tight">Late Payment</h3>
              {filteredLatePayments.length === 0 ? (
                <p className="text-sm font-semibold text-slate-500">No late-paid student dues found.</p>
              ) : (
                <div className="space-y-3">
                  {filteredLatePayments.map(payment => (
                    <div key={payment.id} className="rounded-2xl border border-rose-200 bg-rose-50 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="space-y-2">
                        <p className="text-sm font-black text-slate-900">{studentMap.get(payment.student_id)?.name || payment.student_id}</p>
                        <p className="text-xs text-rose-700">Deadline: {toIsoDate(payment.due_date) || '-'} | Collected: {toIsoDate(payment.payment_date) || '-'} | Status: Paid Late</p>
                        <div className="flex flex-wrap gap-2">
                          <span className="px-3 py-1.5 rounded-xl bg-white text-rose-700 text-xs font-black tracking-wide border border-rose-200">
                            Class: {getStudentAcademic(payment.student_id).className}
                          </span>
                          <span className="px-3 py-1.5 rounded-xl bg-white text-rose-700 text-xs font-black tracking-wide border border-rose-200">
                            Course: {getStudentAcademic(payment.student_id).courseName}
                          </span>
                        </div>
                      </div>
                      <span className="px-2.5 py-1 rounded-lg bg-white text-[10px] font-black uppercase tracking-widest text-rose-700">{formatMMK(payment.amount_mmk)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {view === 'student-finance-status' && (
            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[36px] p-5 sm:p-6 lg:p-8 shadow-premium space-y-4">
              <h3 className="text-xl font-black tracking-tight">Student Finance Status</h3>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setFinanceStatusTab('all')}
                  className={`px-3 py-2 rounded-xl text-xs font-black uppercase tracking-widest ${financeStatusTab === 'all' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}
                >
                  All Students ({filteredStudentFinanceRows.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFinanceStatusTab('pending')}
                  className={`px-3 py-2 rounded-xl text-xs font-black uppercase tracking-widest ${financeStatusTab === 'pending' ? 'bg-amber-600 text-white' : 'bg-amber-50 text-amber-700'}`}
                >
                  Pending Payments ({pendingStudentFinanceRows.length})
                </button>
              </div>

              {(financeStatusTab === 'all' ? filteredStudentFinanceRows : pendingStudentFinanceRows).length === 0 ? (
                <p className="text-sm font-semibold text-slate-500">No students found.</p>
              ) : (
                <div className="space-y-3">
                  {(financeStatusTab === 'all' ? filteredStudentFinanceRows : pendingStudentFinanceRows).map(row => (
                    <div key={row.student.id} className="rounded-2xl border border-slate-200 dark:border-slate-700 p-4 space-y-3">
                      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                        <div className="space-y-2">
                        <p className="text-sm font-black text-slate-900 dark:text-white">{row.student.name}</p>
                        <div className="flex flex-wrap gap-2">
                          <span className="px-3 py-1.5 rounded-xl bg-indigo-50 text-indigo-700 text-xs font-black tracking-wide">
                            Class: {getStudentAcademic(row.student.id).className}
                          </span>
                          <span className="px-3 py-1.5 rounded-xl bg-cyan-50 text-cyan-700 text-xs font-black tracking-wide">
                            Course: {getStudentAcademic(row.student.id).courseName}
                          </span>
                        </div>
                        </div>
                        <span
                          className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest w-fit ${
                            row.status === 'overdue'
                              ? 'bg-rose-50 text-rose-700'
                              : row.status === 'pending'
                                ? 'bg-amber-50 text-amber-700'
                                : 'bg-emerald-50 text-emerald-700'
                          }`}
                        >
                          {row.status === 'overdue' ? 'Overdue' : row.status === 'pending' ? 'Pending' : 'Clear'}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                          <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700">Paid</p>
                          <p className="text-sm font-black text-emerald-700 mt-1">{formatMMK(row.totalPaid)}</p>
                        </div>
                        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                          <p className="text-[10px] font-black uppercase tracking-widest text-amber-700">Pending</p>
                          <p className="text-sm font-black text-amber-700 mt-1">{formatMMK(row.totalPending)}</p>
                        </div>
                        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3">
                          <p className="text-[10px] font-black uppercase tracking-widest text-rose-700">Overdue</p>
                          <p className="text-sm font-black text-rose-700 mt-1">{formatMMK(row.totalOverdue)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default PaymentFinanceHub;
