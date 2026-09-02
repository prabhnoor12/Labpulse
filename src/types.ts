export type AgeUnit = 'Yrs' | 'Months' | 'Days';
export type Gender = 'Male' | 'Female' | 'Other';
export type ParameterFlag = 'NORMAL' | 'LOW' | 'HIGH' | 'CRITICAL_LOW' | 'CRITICAL_HIGH' | 'ABNORMAL' | 'POSITIVE' | 'REACTIVE' | 'NEGATIVE' | 'NON_REACTIVE';

export interface DoctorSignatory {
  id: string;
  name: string;
  degrees: string;
  regNumber: string;
  designation: string;
  signatureUrl?: string;
  signatureText?: string;
  isDefault?: boolean;
}

export interface LabProfile {
  id: string;
  name: string;
  tagline: string;
  accreditations: string[]; // e.g., 'NABL ACCREDITED (ISO 15189:2022)', 'ICMR APPROVED', 'ISO 9001:2015'
  regNumber: string;
  gstin?: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  pincode: string;
  phone: string;
  whatsapp: string;
  email: string;
  website?: string;
  logoUrl?: string;
  upiId?: string;
  primaryColor: string;
  showWatermark: boolean;
  watermarkText: string;
  headerStyle: 'modern' | 'classic' | 'minimal' | 'bordered';
  footerDisclaimer: string;
  technologistName: string;
  technologistDegrees: string;
  signatories: DoctorSignatory[];
}

export interface Patient {
  id: string;
  uhid: string; // Unique Healthcare ID e.g., UHID-2026-0941
  name: string;
  age: number;
  ageUnit: AgeUnit;
  gender: Gender;
  phone: string; // 10 digit Indian mobile
  email?: string;
  address?: string;
  referringDoctor: string; // e.g. "Dr. R.K. Aggarwal, MD (Med)" or "Self"
  sampleCollectedAt: string; // ISO string
  sampleReceivedAt: string;
  reportGeneratedAt: string;
  sampleType: string; // 'EDTA Whole Blood', 'Serum', 'Fluoride Plasma', 'Spot Urine', etc.
  fastingStatus: 'Fasting (12h)' | 'Post-Prandial (2h)' | 'Random' | 'N/A';
  sampleBarcode: string;
}

export interface TestParameter {
  id: string;
  name: string;
  shortName?: string;
  value: string;
  unit: string;
  method?: string;
  refRange: string;
  minVal?: number;
  maxVal?: number;
  criticalMin?: number;
  criticalMax?: number;
  flag?: ParameterFlag;
  options?: string[]; // for dropdowns like 'Nil', '+', '++', '+++', 'Positive', 'Negative'
  subCategory?: string; // e.g. 'Differential Count (DLC)'
  isCalculated?: boolean;
  notes?: string;
}

export interface TestPanel {
  id: string;
  templateId: string;
  testName: string;
  category: string;
  sampleType: string;
  method?: string;
  price: number;
  parameters: TestParameter[];
  clinicalInterpretation?: string;
}

export interface BillingInfo {
  totalAmount: number;
  discount: number;
  netAmount: number;
  paidAmount: number;
  paymentMethod: 'UPI' | 'Cash' | 'Card' | 'Online';
  paymentStatus: 'PAID' | 'PARTIAL' | 'UNPAID';
  transactionRef?: string;
}

export interface DiagnosticReport {
  id: string;
  reportNumber: string;
  patient: Patient;
  tests: TestPanel[];
  clinicalImpression: string;
  pathologistNotes: string;
  patientSummaryEn: string;
  patientSummaryHi: string;
  keyHighlights?: string[];
  dietaryAdvice?: string;
  selectedSignatoryId: string;
  status: 'DRAFT' | 'VERIFIED' | 'DISPATCHED';
  billing: BillingInfo;
  whatsAppLogs: Array<{
    sentAt: string;
    phoneNumber: string;
    templateType: 'detailed' | 'quick_summary' | 'hindi_bilingual';
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface TestParameterTemplate {
  id: string;
  name: string;
  shortName?: string;
  defaultVal?: string;
  unit: string;
  method?: string;
  maleRefRange: string;
  femaleRefRange: string;
  childRefRange?: string;
  minVal?: number;
  maxVal?: number;
  criticalMin?: number;
  criticalMax?: number;
  options?: string[];
  subCategory?: string;
  isCalculated?: boolean;
}

export interface TestTemplate {
  id: string;
  name: string;
  code: string;
  category: 'Hematology' | 'Biochemistry' | 'Clinical Pathology' | 'Serology & Immunology' | 'Endocrinology' | 'Vitamins & Minerals' | 'Diabetic Care' | 'Preventive Health Package';
  sampleType: string;
  fastingRequired: boolean;
  tat: string;
  defaultPrice: number;
  method: string;
  parameters: TestParameterTemplate[];
  defaultNotes?: string;
}
