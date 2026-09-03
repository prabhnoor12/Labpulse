import { z } from 'zod';

const text = (max: number) => z.string().trim().max(max);
const money = z.number().finite().min(0).max(1_000_000_000);

const patientDataSchema = z.object({
  id: text(128).optional(),
  uhid: text(64).optional(),
  name: text(200).optional(),
  age: z.number().finite().min(0).max(120).optional(),
  ageUnit: z.enum(['Yrs', 'Months', 'Days']).optional(),
  gender: z.enum(['Male', 'Female', 'Other']).optional(),
  phone: text(32).optional(),
  email: text(320).optional(),
  address: text(1_000).optional(),
  referringDoctor: text(300).optional(),
  sampleCollectedAt: text(80).optional(),
  sampleReceivedAt: text(80).optional(),
  reportGeneratedAt: text(80).optional(),
  sampleType: text(200).optional(),
  fastingStatus: z.enum(['Fasting (12h)', 'Post-Prandial (2h)', 'Random', 'N/A']).optional(),
  sampleBarcode: text(128).optional(),
}).strip();

const parameterSchema = z.object({
  id: text(128),
  name: text(300),
  shortName: text(100).optional(),
  value: text(2_000),
  unit: text(100),
  method: text(200).optional(),
  refRange: text(300),
  minVal: z.number().finite().optional(),
  maxVal: z.number().finite().optional(),
  criticalMin: z.number().finite().optional(),
  criticalMax: z.number().finite().optional(),
  flag: z.enum(['NORMAL', 'PENDING', 'INVALID', 'LOW', 'HIGH', 'CRITICAL_LOW', 'CRITICAL_HIGH', 'ABNORMAL', 'POSITIVE', 'REACTIVE', 'NEGATIVE', 'NON_REACTIVE']).optional(),
  options: z.array(text(200)).max(50).optional(),
  subCategory: text(200).optional(),
  isCalculated: z.boolean().optional(),
  notes: text(2_000).optional(),
}).strip();

const testPanelSchema = z.object({
  id: text(128),
  templateId: text(128),
  testName: text(300),
  category: text(200),
  sampleType: text(200),
  method: text(200).optional(),
  price: money,
  parameters: z.array(parameterSchema).max(500),
  clinicalInterpretation: text(5_000).optional(),
}).strip();

const billingSchema = z.object({
  totalAmount: money.optional().default(0),
  discount: money.optional().default(0),
  netAmount: money.optional().default(0),
  paidAmount: money.optional().default(0),
  paymentMethod: z.enum(['UPI', 'Cash', 'Card', 'Online']).optional().default('UPI'),
  paymentStatus: z.enum(['PAID', 'PARTIAL', 'UNPAID']).optional().default('UNPAID'),
  transactionRef: text(256).optional(),
}).strip();

const reportDataSchema = z.object({
  patient: patientDataSchema.optional(),
  tests: z.array(testPanelSchema).max(100).default([]),
  clinicalImpression: text(10_000).optional().default(''),
  pathologistNotes: text(10_000).optional().default(''),
  patientSummaryEn: text(5_000).optional().default(''),
  patientSummaryHi: text(5_000).optional().default(''),
  keyHighlights: z.array(text(500)).max(20).optional().default([]),
  dietaryAdvice: text(5_000).optional().default(''),
  selectedSignatoryId: text(128).optional().default(''),
  billing: billingSchema.default({}),
}).strip();

const reportInputSchema = z.object({
  reportNumber: text(64).optional(),
  clientId: text(128).optional(),
  version: z.number().int().positive().optional(),
  patient: z.object({
    uhid: text(64),
    name: text(200),
    phone: text(32),
    data: patientDataSchema.optional(),
  }).strip(),
  data: reportDataSchema,
}).strip();

export interface ParsedReportInput {
  reportNumber?: string;
  clientId?: string;
  version?: number;
  patient: {
    uhid: string;
    name: string;
    phone: string;
    data?: Record<string, unknown>;
  };
  data: Record<string, unknown>;
}

function currency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function parseReportInput(value: unknown): ParsedReportInput {
  const input = reportInputSchema.parse(value);
  const totalAmount = currency(input.data.tests.reduce((sum, panel) => sum + panel.price, 0));
  const discount = currency(input.data.billing.discount);
  const paidAmount = currency(input.data.billing.paidAmount);

  if (discount > totalAmount) throw new Error('REPORT_DISCOUNT_INVALID');
  const netAmount = currency(totalAmount - discount);
  if (paidAmount > netAmount) throw new Error('REPORT_PAYMENT_INVALID');
  const paymentStatus = paidAmount <= 0 ? 'UNPAID' : paidAmount >= netAmount ? 'PAID' : 'PARTIAL';

  return {
    reportNumber: input.reportNumber,
    clientId: input.clientId,
    version: input.version,
    patient: {
      uhid: input.patient.uhid,
      name: input.patient.name,
      phone: input.patient.phone,
      data: input.patient.data as Record<string, unknown> | undefined,
    },
    data: {
      ...input.data,
      billing: {
        ...input.data.billing,
        totalAmount,
        discount,
        netAmount,
        paidAmount,
        paymentStatus,
      },
    },
  } as unknown as ParsedReportInput;
}
