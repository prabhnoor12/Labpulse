import { LabProfile } from '@/domain/types';

export const defaultLabProfile: LabProfile = {
  id: '',
  name: '',
  tagline: '',
  accreditations: [],
  regNumber: '',
  gstin: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  state: '',
  pincode: '',
  phone: '',
  whatsapp: '',
  email: '',
  website: '',
  upiId: '',
  primaryColor: '#0f766e', // teal-700
  showWatermark: false,
  watermarkText: '',
  headerStyle: 'modern',
  footerDisclaimer: '',
  technologistName: '',
  technologistDegrees: '',
  signatories: [],
};
