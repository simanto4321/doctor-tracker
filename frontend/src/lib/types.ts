export type User = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "receptionist" | "doctor" | string;
  emailVerified?: boolean;
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
  title?: string;
  degrees?: string;
  workingHours?: string;
  bio?: string;
  photoUrl?: string;
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

export type LabResult = {
  id: string;
  testName: string;
  value: number;
  unit: string;
  refLow: number;
  refHigh: number;
  abnormal: boolean;
  collectedAt: string;
  patient?: { name: string } | string;
  doctor?: { name: string } | string;
};

export type Vital = {
  id: string;
  recordedAt: string;
  bloodPressureSys: number;
  bloodPressureDia: number;
  heartRate: number;
  temperatureC: number;
  spo2: number;
  weightKg?: number | null;
  notes?: string;
};

export type ConditionEvent = {
  id: string;
  condition: string;
  status: string;
  note?: string;
  recordedAt: string;
};

export type DocumentMeta = {
  id: string;
  title: string;
  fileName?: string;
  category: string;
  mimeType?: string;
  sizeBytes?: number;
  createdAt: string;
};

export type Referral = {
  id: string;
  reason: string;
  status: string;
  priority?: string;
  fromDoctor?: { name: string } | string;
  toDoctor?: { name: string } | string;
  patient?: { name: string } | string;
  createdAt?: string;
};

export type TimelineNote = {
  id: string;
  type: "visit" | "condition" | "lab" | string;
  at: string;
  title: string;
  detail?: string;
};

export type DashboardStats = {
  totals: {
    doctors: number;
    patients: number;
    avgPatientsPerDoctor: number;
    conditionsTracked: number;
    upcomingAppointments?: number;
    openFollowUps?: number;
    patientsInRange?: number;
  };
  range?: { from: string; to: string };
  appliedFilters?: { hospital: string; specialization: string };
  filtersMeta?: { hospitals: string[]; specializations: string[] };
  patientsPerDoctor: Array<{
    doctorId: string;
    name: string;
    specialization: string;
    hospital?: string;
    patients: number;
  }>;
  conditionBreakdown: Array<{ condition: string; count: number }>;
  specializationBreakdown: Array<{ specialization: string; count: number }>;
  genderBreakdown?: Array<{ gender: string; count: number }>;
  ageBreakdown?: Array<{ bucket: string; count: number }>;
  hospitalComparison?: Array<{
    hospital: string;
    patients: number;
    doctors: number;
    avgPerDoctor: number;
  }>;
  specializationHeatmap?: {
    hospitals: string[];
    specializations: string[];
    cells: Array<{ hospital: string; specialization: string; patients: number }>;
  };
  doctorUtilization?: {
    doctors: Array<{ doctorId: string; name: string }>;
    series: Array<Record<string, string | number>>;
  };
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

export type DashboardPreset = {
  id: string;
  name: string;
  filters: {
    from?: string;
    to?: string;
    hospital?: string;
    specialization?: string;
  };
  updatedAt?: string;
};
