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
  grade: string;
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
}

export type PageId = 
  | 'dashboard' 
  | 'students' 
  | 'student-import'
  | 'student-register'
  | 'student-assign'
  | 'student-attendance'
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
  | 'homework';