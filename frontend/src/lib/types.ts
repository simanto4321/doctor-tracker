export type User = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "receptionist" | "doctor" | string;
};

export type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type Doctor = {
  id: string;
  _id?: string;
  name: string;
  specialization: string;
  hospital: string;
  phone: string;
  email: string;
  department?: string;
  workingHours?: string;
  bio?: string;
  patientCount?: number;
  deletedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type Patient = {
  id: string;
  _id?: string;
  name: string;
  age: number;
  gender: "male" | "female" | "other";
  condition: string;
  phone: string;
  email: string;
  notes?: string;
  riskFlag?: "none" | "low" | "medium" | "high";
  doctor?:
    | string
    | {
        _id?: string;
        id?: string;
        name: string;
        specialization?: string;
        hospital?: string;
        email?: string;
        phone?: string;
      };
  doctorId?: string;
  deletedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type Appointment = {
  id: string;
  startsAt: string;
  endsAt: string;
  status: string;
  reason?: string;
  notes?: string;
  doctor?: { _id?: string; id?: string; name: string; specialization?: string } | string;
  patient?: { _id?: string; id?: string; name: string; condition?: string } | string;
};

export type Visit = {
  id: string;
  visitedAt: string;
  diagnosis: string;
  treatment?: string;
  followUpAt?: string | null;
  notes?: string;
  doctor?: { name: string } | string;
  patient?: { name: string } | string;
};

export type Prescription = {
  id: string;
  medication: string;
  dosage: string;
  frequency: string;
  status: string;
  startDate: string;
  endDate?: string | null;
  notes?: string;
  doctor?: { name: string } | string;
  patient?: { name: string } | string;
};

export type NotificationItem = {
  id: string;
  title: string;
  body: string;
  type: string;
  href?: string;
  read: boolean;
  createdAt: string;
};

export type DashboardStats = {
  totals: {
    doctors: number;
    patients: number;
    avgPatientsPerDoctor: number;
    conditionsTracked: number;
    upcomingAppointments?: number;
    openFollowUps?: number;
  };
  range?: { from: string; to: string };
  patientsPerDoctor: Array<{
    doctorId: string;
    name: string;
    specialization: string;
    patients: number;
  }>;
  conditionBreakdown: Array<{ condition: string; count: number }>;
  specializationBreakdown: Array<{ specialization: string; count: number }>;
  genderBreakdown?: Array<{ gender: string; count: number }>;
  ageBreakdown?: Array<{ bucket: string; count: number }>;
  patientTrend: Array<{ date: string; label: string; patients: number }>;
  recentPatients: Array<{
    id: string;
    name: string;
    condition: string;
    createdAt: string;
    doctor: string;
    riskFlag?: string;
  }>;
};
