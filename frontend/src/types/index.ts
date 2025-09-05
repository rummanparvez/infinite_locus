export interface User {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: 'student' | 'organizer' | 'admin' | 'faculty';
  studentId?: string;
  department: string;
  year?: number;
  semester?: number;
  section?: string;
  phone?: string;
  bio?: string;
  interests?: string[];
  skills?: string[];
  isActive: boolean;
  profilePicture?: string;
}

export interface Event {
  _id: string;
  title: string;
  description: string;
  shortDescription: string;
  category: Category;
  department: Department;
  organizer: User;
  venue: {
    name: string;
    address: string;
    capacity: number;
    type: 'physical' | 'virtual' | 'hybrid';
  };
  schedule: {
    startDate: string;
    endDate: string;
  };
  registration: {
    isRequired: boolean;
    maxCapacity: number;
    approvalRequired: boolean;
    deadline: string;
    allowedRoles: string[];
    allowedYears: number[];
  };
  status: 'draft' | 'published' | 'cancelled' | 'completed';
  tags: string[];
  images?: string[];
  stats: {
    totalRegistrations: number;
    approvedRegistrations: number;
    attendees: number;
    rating: number;
    views: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface Registration {
  _id: string;
  user: User;
  event: Event;
  status: 'pending' | 'approved' | 'rejected' | 'attended' | 'cancelled';
  preferences?: {
    dietary?: string;
    accessibility?: string;
    emergencyContact?: {
      name: string;
      phone: string;
      relation: string;
    };
  };
  approvedBy?: User;
  approvedAt?: string;
  reason?: string;
  attendedAt?: string;
  createdAt: string;
}

export interface Department {
  _id: string;
  name: string;
  code: string;
  description: string;
  hod?: User;
  building?: string;
  floor?: string;
  contact?: {
    email: string;
    phone: string;
    website?: string;
  };
  isActive: boolean;
}

export interface Category {
  _id: string;
  name: string;
  description: string;
  icon?: string;
  color: string;
  parent?: Category;
  isActive: boolean;
}

export interface Notification {
  _id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'reminder';
  priority: 'low' | 'normal' | 'high';
  isRead: boolean;
  metadata?: {
    actionUrl?: string;
    actionText?: string;
  };
  createdAt: string;
  expiresAt?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: {
    current: number;
    pages: number;
    total: number;
    limit: number;
  };
}