"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type Locale = "en" | "es";

type Dict = Record<string, string>;

const en: Dict = {
  "app.name": "Doctor Tracker",
  "app.tagline": "Clinical operations desk",
  "nav.dashboard": "Dashboard",
  "nav.doctors": "Doctors",
  "nav.patients": "Patients",
  "nav.appointments": "Appointments",
  "nav.prescriptions": "Prescriptions",
  "nav.labs": "Labs",
  "nav.referrals": "Referrals",
  "nav.hospitals": "Hospitals",
  "nav.documents": "Documents",
  "nav.import": "Import",
  "nav.trash": "Trash",
  "nav.audit": "Audit log",
  "nav.team": "Team",
  "action.search": "Search",
  "action.signOut": "Sign out",
  "action.csv": "CSV",
  "action.addDoctor": "Add doctor",
  "action.addPatient": "Add patient",
  "action.previous": "Previous",
  "action.next": "Next",
  "action.cancel": "Cancel",
  "action.save": "Save",
  "action.back": "Back",
  "action.continue": "Continue",
  "action.create": "Create",
  "action.undo": "Undo",
  "action.theme": "Toggle theme",
  "action.language": "Language",
  "doctors.title": "Doctors",
  "doctors.subtitle": "Create, edit, export, and manage each clinician’s caseload.",
  "doctors.emptyTitle": "No doctors match these filters",
  "doctors.emptyDesc": "Try clearing search or date filters, or create the first doctor record.",
  "doctors.col.name": "Doctor",
  "doctors.col.specialty": "Specialization",
  "doctors.col.hospital": "Hospital",
  "doctors.col.patients": "Patients",
  "doctors.col.added": "Added",
  "doctors.col.actions": "Actions",
  "patients.title": "Patients",
  "patients.subtitle": "Search, filter, edit, and soft-delete patient charts across the clinic.",
  "patients.emptyTitle": "No patients found",
  "patients.emptyDesc": "Adjust filters or add a patient assigned to an existing doctor.",
  "patients.col.name": "Patient",
  "patients.col.condition": "Condition",
  "patients.col.doctor": "Doctor",
  "patients.col.demo": "Demographics",
  "patients.col.registered": "Registered",
  "patients.col.actions": "Actions",
  "toast.doctorCreated": "Doctor created",
  "toast.doctorUpdated": "Doctor updated",
  "toast.patientCreated": "Patient created",
  "toast.patientUpdated": "Patient updated",
  "toast.movedTrash": "Moved to trash",
  "toast.restored": "Restored",
  "toast.signedOut": "Signed out",
  "wizard.doctor.step1": "Identity",
  "wizard.doctor.step2": "Assignment",
  "wizard.doctor.step3": "Profile",
  "wizard.patient.step1": "Identity",
  "wizard.patient.step2": "Clinical",
  "wizard.patient.step3": "Assignment",
  "a11y.skip": "Skip to main content",
  "a11y.main": "Main content",
  "theme.light": "Light",
  "theme.dark": "Dark",
};

const es: Dict = {
  "app.name": "Doctor Tracker",
  "app.tagline": "Mesa de operaciones clínicas",
  "nav.dashboard": "Panel",
  "nav.doctors": "Médicos",
  "nav.patients": "Pacientes",
  "nav.appointments": "Citas",
  "nav.prescriptions": "Recetas",
  "nav.labs": "Laboratorio",
  "nav.referrals": "Referencias",
  "nav.hospitals": "Hospitales",
  "nav.documents": "Documentos",
  "nav.import": "Importar",
  "nav.trash": "Papelera",
  "nav.audit": "Auditoría",
  "nav.team": "Equipo",
  "action.search": "Buscar",
  "action.signOut": "Cerrar sesión",
  "action.csv": "CSV",
  "action.addDoctor": "Agregar médico",
  "action.addPatient": "Agregar paciente",
  "action.previous": "Anterior",
  "action.next": "Siguiente",
  "action.cancel": "Cancelar",
  "action.save": "Guardar",
  "action.back": "Atrás",
  "action.continue": "Continuar",
  "action.create": "Crear",
  "action.undo": "Deshacer",
  "action.theme": "Cambiar tema",
  "action.language": "Idioma",
  "doctors.title": "Médicos",
  "doctors.subtitle": "Cree, edite, exporte y gestione la carga de cada clínico.",
  "doctors.emptyTitle": "Ningún médico coincide con estos filtros",
  "doctors.emptyDesc": "Pruebe limpiar la búsqueda o cree el primer registro de médico.",
  "doctors.col.name": "Médico",
  "doctors.col.specialty": "Especialidad",
  "doctors.col.hospital": "Hospital",
  "doctors.col.patients": "Pacientes",
  "doctors.col.added": "Alta",
  "doctors.col.actions": "Acciones",
  "patients.title": "Pacientes",
  "patients.subtitle": "Busque, filtre, edite y elimine suavemente historias clínicas.",
  "patients.emptyTitle": "No se encontraron pacientes",
  "patients.emptyDesc": "Ajuste los filtros o agregue un paciente asignado a un médico.",
  "patients.col.name": "Paciente",
  "patients.col.condition": "Condición",
  "patients.col.doctor": "Médico",
  "patients.col.demo": "Demografía",
  "patients.col.registered": "Registro",
  "patients.col.actions": "Acciones",
  "toast.doctorCreated": "Médico creado",
  "toast.doctorUpdated": "Médico actualizado",
  "toast.patientCreated": "Paciente creado",
  "toast.patientUpdated": "Paciente actualizado",
  "toast.movedTrash": "Movido a la papelera",
  "toast.restored": "Restaurado",
  "toast.signedOut": "Sesión cerrada",
  "wizard.doctor.step1": "Identidad",
  "wizard.doctor.step2": "Asignación",
  "wizard.doctor.step3": "Perfil",
  "wizard.patient.step1": "Identidad",
  "wizard.patient.step2": "Clínico",
  "wizard.patient.step3": "Asignación",
  "a11y.skip": "Saltar al contenido principal",
  "a11y.main": "Contenido principal",
  "theme.light": "Claro",
  "theme.dark": "Oscuro",
};

const dictionaries: Record<Locale, Dict> = { en, es };

type I18nContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");

  useEffect(() => {
    const saved = localStorage.getItem("doctor-tracker-locale") as Locale | null;
    if (saved === "en" || saved === "es") setLocaleState(saved);
  }, []);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    localStorage.setItem("doctor-tracker-locale", next);
    document.documentElement.lang = next;
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const t = useCallback(
    (key: string) => dictionaries[locale][key] || dictionaries.en[key] || key,
    [locale]
  );

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
