export type User = {
  id: string;
  name: string;
  email: string;
  role: string;
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
  patientCount?: number;
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
  doctor?:
    | string
    | {
        _id?: string;
        id?: string;
        name: string;
        specialization?: string;
        hospital?: string;
      };
  doctorId?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type DashboardStats = {
  totals: {
    doctors: number;
    patients: number;
    avgPatientsPerDoctor: number;
    conditionsTracked: number;
  };
  patientsPerDoctor: Array<{
    doctorId: string;
    name: string;
    specialization: string;
    patients: number;
  }>;
  conditionBreakdown: Array<{ condition: string; count: number }>;
  specializationBreakdown: Array<{ specialization: string; count: number }>;
  patientTrend: Array<{ date: string; label: string; patients: number }>;
  recentPatients: Array<{
    id: string;
    name: string;
    condition: string;
    createdAt: string;
    doctor: string;
  }>;
};
