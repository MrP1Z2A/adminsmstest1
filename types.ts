export type UserRole = 'student' | 'teacher' | 'parent' | 'admin';

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  avatar_url?: string;
  updated_at: string;
}

export enum Status {
  ACTIVE = 'Active',
  INACTIVE = 'Inactive',
  PENDING = 'Pending'
}

export interface CourseAttendance {
  course: string;
  rate: number;
}

export interface AttendanceRecord {
  date: string;
  studentId: string;
  status: 'P' | 'A' | 'L';
}

export interface StudentPermissions {
  neuralSync: boolean;
  libraryAccess: boolean;
  examEntry: boolean;
  apiAccess: boolean;
}

export interface Student {
  id: string;
  created_at?: string;
  name: string;
  role: UserRole;
  gender: 'Male' | 'Female';
  status: Status;
  email: string;
  avatar?: string;
  attendanceRate: number;
  courseAttendance: CourseAttendance[];
  securityStatus: {
    lastLogin: string;
    twoFactorEnabled: boolean;
    trustedDevices: number;
    riskLevel: 'Low' | 'Medium' | 'High';
  };
  permissions?: StudentPermissions;
  type?: 'New' | 'Old';
  date_of_birth?: string;
  parent_name?: string;
  parent_number?: string;
  parent_email?: string;
  secondary_parent_name?: string;
  secondary_parent_number?: string;
  secondary_parent_email?: string;
}

export type PageId = 
  | 'dashboard' 
  | 'students' 
  | 'student-import'
  | 'student-register'
  | 'teacher-register'
  | 'live-calendar'
  | 'student-assign'
  | 'student-attendance'
  | 'class-attendance'
  | 'class-course'
  | 'teachers' 
  | 'library' 
  | 'account' 
  | 'class' 
  | 'subject' 
  | 'routine' 
  | 'attendance' 
  | 'exam' 
  | 'notice' 
  | 'transport' 
  | 'hostel' 
  | 'security' 
  | 'ai-chat'
  | 'programs'
  | 'homework'
  | 'report-card'
  | 'payment'
  | 'payment-assign'
  | 'payment-history'
  | 'late-payment'
  | 'student-finance-status';