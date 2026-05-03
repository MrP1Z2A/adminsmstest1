
import { Course, User, UserRole } from "./types";

export const INITIAL_USER: User = {
  id: 'u1',
  name: 'Student User',
  email: 'student@school.edu',
  role: UserRole.STUDENT,
  avatar: 'https://picsum.photos/seed/student-user/200',
  studentId: 'STUDENT-000',
  eduLevel: 'Undergraduate (Year 2)'
};

export const ANNOUNCEMENTS = [
  { id: 1, title: 'Campus Network Upgrade', date: 'Mar 26', content: 'IT will be performing maintenance on the campus-wide Wi-Fi tonight at 12:00 AM.', priority: 'Medium' },
  { id: 2, title: 'Scholarship Applications Open', date: 'Mar 24', content: 'Merit-based scholarship applications for the Fall 2025 semester are now being accepted.', priority: 'High' },
  { id: 3, title: 'Guest Lecture: AI in Ethics', date: 'Mar 22', content: 'Join us in Hall A for a session with Dr. Aris Thorne on the future of generative models.', priority: 'Low' },
];

export const SCHOOL_EVENTS = [
  { id: 1, name: 'Tech Symposium 2025', date: 'April 12', type: 'Academic', image: 'https://images.unsplash.com/photo-1540575861501-7cf05a4b125a?auto=format&fit=crop&w=400' },
  { id: 2, name: 'Winter Gala', date: 'April 20', type: 'Social', image: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=400' },
];

export const SCHOOL_ACTIVITIES = [
  { name: 'Coding Club', icon: 'fa-code', description: 'Weekly hackathons and peer coding sessions.' },
  { name: 'Drama Society', icon: 'fa-masks-theater', description: 'Rehearsing for the spring production of Hamlet.' },
  { name: 'Robotics Lab', icon: 'fa-robot', description: 'Building autonomous drones for the regional cup.' },
];

export const DETAILED_GRADES = [
  { assignment: 'Quantum Lab 1', grade: '95/100', feedback: 'Excellent grasp of wave mechanics. Focus on clearer graph labeling.' },
  { assignment: 'Midterm Quiz', grade: '88/100', feedback: 'Strong performance. Review binary search tree balancing logic.' },
  { assignment: 'Ethics Essay', grade: '92/100', feedback: 'Very thoughtful analysis of AI bias. Well structured argument.' },
];

export const STUDENT_ACHIEVEMENTS = [
  { id: 1, title: 'Dean\'s List', desc: 'Fall Semester 2024', icon: 'fa-award', color: 'text-yellow-500' },
  { id: 2, title: 'Top Coder', desc: 'Hackathon Winner', icon: 'fa-trophy', color: 'text-blue-500' },
  { id: 3, title: 'Volunteer Star', desc: '50+ Hours Community Service', icon: 'fa-star', color: 'text-purple-500' },
];

export const SCHOOL_HIVE_POSTS = [
  { id: 1, user: 'Dr. Sarah Smith', content: 'Exciting news! The new research library will be open 24/7 during finals week.', likes: 124, replies: 12, time: '2h ago' },
  { id: 2, user: 'Athletics Dept', content: 'Go Eagles! Basketball finals this Saturday at 6PM in the Main Gymnasium.', likes: 89, replies: 5, time: '5h ago' },
  { id: 3, user: 'Campus Café', content: 'New seasonal Matcha Lattes are here! Get 20% off with your student ID card.', likes: 45, replies: 2, time: '1d ago' },
];

export const SCHOOL_CONTACTS = {
  phone: [
    { label: 'General Administration', number: '+1 (555) 012-3456', hours: 'Mon-Fri, 9AM-5PM' },
    { label: 'Student Support Desk', number: '+1 (555) 987-6543', hours: 'Mon-Fri, 10AM-4PM' },
    { label: 'IT & Portal Support', number: '+1 (555) 111-2222', hours: '24/7 Available' },
  ],
  socials: [
    { brand: 'Facebook', icon: 'fa-facebook-f', color: '#1877F2', link: '#' },
    { brand: 'Instagram', icon: 'fa-instagram', color: '#E4405F', link: '#' },
    { brand: 'X (Twitter)', icon: 'fa-x-twitter', color: '#000000', link: '#' },
    { brand: 'LinkedIn', icon: 'fa-linkedin-in', color: '#0A66C2', link: '#' },
  ]
};

// Fix: Added missing FREELANCE_TEACHERS export to resolve import error in App.tsx
export const FREELANCE_TEACHERS = [
  { id: 'ft1', name: 'Dr. Sarah Smith', specialization: ['Physics', 'Quantum Computing'] },
  { id: 'ft2', name: 'Eng. Lisa Chen', specialization: ['Computer Science', 'Data Structures'] },
];

export const INITIAL_COURSES: Course[] = [
  {
    id: 'c1',
    title: 'Introduction to Modern Physics',
    description: 'Explore the fascinating world of quantum mechanics and relativity.',
    moduleIntro: 'This module serves as the foundation for modern theoretical physics, covering the transition from classical mechanics to quantum theory.',
    topics: ['Wave-Particle Duality', 'Heisenberg Uncertainty', 'Schrödinger Equation', 'Special Relativity'],
    teacherId: 't2',
    subTeacherName: 'Dr. Robert Penrose',
    onlineClassUrl: 'https://zoom.us/j/physics-demo',
    scheduleDescription: 'Mon & Wed @ 10:30 AM (Room 402)',
    thumbnail: 'https://picsum.photos/seed/physics/800/600',
    category: 'Science',
    notes: [
      {
        id: 'n1',
        title: 'Wave-Particle Duality',
        content: 'Wave–particle duality is the concept in quantum mechanics that every particle or quantum entity may be described as either a particle or a wave.',
        summary: 'Quantum entities behave as both waves and particles.',
        ebookUrl: 'https://example.com/physics_wave_duality.pdf',
        createdAt: new Date().toISOString()
      }
    ],
    quizzes: []
  },
  {
    id: 'c2',
    title: 'Data Structures 101',
    description: 'Master the building blocks of computer science.',
    moduleIntro: 'Efficiency is key in software development. This course teaches you how to organize and store data optimally.',
    topics: ['Arrays & Linked Lists', 'Stacks & Queues', 'Hash Tables', 'Binary Search Trees'],
    teacherId: 't1',
    subTeacherName: 'Eng. Lisa Chen',
    onlineClassUrl: 'https://meet.google.com/cs-demo',
    scheduleDescription: 'Tue & Thu @ 09:00 AM (Tech Wing)',
    thumbnail: 'https://picsum.photos/seed/coding/800/600',
    category: 'CS',
    notes: [],
    quizzes: []
  }
];
