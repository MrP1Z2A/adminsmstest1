import { Student, Achievement, GradeResult, Event, Advertisement, PaymentRecord, Assignment } from './types';

export const MOCK_STUDENT: Student = {
  id: "STD-PREVIEW",
  name: "Student Preview",
  grade: "9th Grade",
  section: "B",
  attendance: 94,
  avatar: "https://picsum.photos/seed/student-preview/200/200"
};

export const MOCK_GRADES: GradeResult[] = [
  { subject: "Mathematics", score: 88, average: 75 },
  { subject: "Science", score: 92, average: 78 },
  { subject: "History", score: 79, average: 82 },
  { subject: "English", score: 85, average: 80 },
  { subject: "Art", score: 95, average: 88 },
];

export const MOCK_ACHIEVEMENTS: Achievement[] = [
  { id: "1", title: "Math Olympiad 2nd Place", date: "2024-03-12", category: "Academic" },
  { id: "2", title: "Varsity Basketball MVP", date: "2023-11-05", category: "Sports" },
];

export const MOCK_EVENTS: Event[] = [
  { id: "e1", title: "Parent-Teacher Meeting", date: "2024-06-15", description: "Mandatory meeting regarding finals.", type: "Meeting" },
  { id: "e2", title: "Summer Break Starts", date: "2024-07-01", description: "Official start of summer vacations.", type: "Holiday" },
  { id: "e3", title: "Final Examinations", date: "2024-06-20", description: "Semester 2 finals begin.", type: "Exam" },
];

export const ANNOUNCEMENTS: string[] = [
  "End of Semester exams scheduled for next Monday.",
  "School will remain closed on Friday for Teacher's Day.",
  "Library books must be returned by June 15th."
];

export const UPCOMING_EXAMS: Event[] = [
  { id: "ex1", title: "Advanced Physics", date: "2025-05-10", description: "Covering Chapters 1-12", type: "Exam" },
  { id: "ex2", title: "World History", date: "2025-05-12", description: "Covering Industrial Revolution", type: "Exam" }
];

export const MOCK_ASSIGNMENTS: Assignment[] = [
  { id: "as1", title: "Calculus Problem Set", dueDate: "2025-05-01", status: "Submitted" },
  { id: "as2", title: "Biology Lab Report", dueDate: "2025-05-05", status: "Pending" }
];

export const MOCK_ADS: Advertisement[] = [
  { id: "ad1", title: "Summer Coding Camp 2024", image: "https://picsum.photos/seed/code/600/400", link: "#" },
  { id: "ad2", title: "New School Uniforms Available", image: "https://picsum.photos/seed/uniform/600/400", link: "#" },
];

export const MOCK_PAYMENTS: PaymentRecord[] = [
  { id: "p1", description: "Quarter 2 Tuition Fee", amount: 1200, date: "2024-04-10", status: "Paid" },
  { id: "p2", description: "Annual Sports Club Fee", amount: 150, date: "2024-05-15", status: "Pending" },
  { id: "p3", description: "Library Overdue Charge", amount: 15, date: "2024-05-20", status: "Overdue" },
];
