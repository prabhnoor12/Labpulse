import { DiagnosticReport } from '../types';
import { standardTestTemplates } from './defaultTemplates';
import { computeDerivedValues } from '../utils/rangeEvaluator';

// Helper to instantiate a test panel from a template
function createPanelFromTemplate(templateId: string, customValues: Record<string, string> = {}) {
  const template = standardTestTemplates.find((t) => t.id === templateId)!;
  const rawParams = template.parameters.map((p) => {
    const val = customValues[p.id] !== undefined ? customValues[p.id] : p.defaultVal || '';
    return {
      id: p.id,
      name: p.name,
      shortName: p.shortName,
      value: val,
      unit: p.unit,
      method: p.method,
      refRange: p.maleRefRange,
      minVal: p.minVal,
      maxVal: p.maxVal,
      criticalMin: p.criticalMin,
      criticalMax: p.criticalMax,
      options: p.options,
      subCategory: p.subCategory,
      isCalculated: p.isCalculated,
    };
  });

  const parameters = computeDerivedValues(rawParams);

  return {
    id: `panel-${templateId}-${Date.now()}`,
    templateId: template.id,
    testName: template.name,
    category: template.category,
    sampleType: template.sampleType,
    method: template.method,
    price: template.defaultPrice,
    parameters,
    clinicalInterpretation: template.defaultNotes,
  };
}

export const initialReports: DiagnosticReport[] = [
  {
    id: 'rep-001',
    reportNumber: 'LP-2026-8891',
    patient: {
      id: 'pat-001',
      uhid: 'UHID-2026-04182',
      name: 'Ramesh Kumar Verma',
      age: 48,
      ageUnit: 'Yrs',
      gender: 'Male',
      phone: '9810123456',
      email: 'ramesh.verma@example.com',
      address: 'B-4/12, Model Town II, Delhi - 110009',
      referringDoctor: 'Dr. S.K. Grover, MD (Gen. Med)',
      sampleCollectedAt: new Date(Date.now() - 3600000 * 5).toISOString(),
      sampleReceivedAt: new Date(Date.now() - 3600000 * 4).toISOString(),
      reportGeneratedAt: new Date(Date.now() - 3600000 * 1).toISOString(),
      sampleType: 'Fluoride Plasma & Serum & EDTA Blood',
      fastingStatus: 'Fasting (12h)',
      sampleBarcode: 'SMP-DEL-8891',
    },
    tests: [
      createPanelFromTemplate('diabetes', {
        fbs: '154', // High
        ppbs: '228', // High
        hba1c: '8.4', // High
      }),
      createPanelFromTemplate('lipid', {
        chol_tot: '232', // High
        triglycerides: '215', // High
        hdl: '38', // Low
        ldl: '151', // High
      }),
      createPanelFromTemplate('kft', {
        creatinine: '1.05',
        urea: '28.0',
        uric_acid: '6.1',
      }),
    ],
    clinicalImpression: 'Glycemic profile reveals uncontrolled Type-2 Diabetes Mellitus (HbA1c 8.4%, eAG 194 mg/dL) with mixed dyslipidemia (elevated LDL and hypertriglyceridemia). Renal parameters are currently preserved.',
    pathologistNotes: 'Strict glycemic control advised. Recommend clinical assessment for microvascular complications and periodic urine microalbumin evaluation.',
    patientSummaryEn: 'Your blood sugar (Fasting 154, Post-meal 228) and HbA1c (8.4%) indicate elevated glucose levels needing medical review. Lipid levels are also mildly high. Please consult Dr. Grover for medication adjustment.',
    patientSummaryHi: 'आपकी फास्टिंग शुगर (154) और 3 महीने का औसत HbA1c (8.4%) बढ़ा हुआ है, जो अनियंत्रित डायबिटीज दर्शाता है। कोलेस्ट्रॉल भी कुछ अधिक है। कृपया डॉक्टर से संपर्क कर उचित दवा लें।',
    keyHighlights: [
      'HbA1c: 8.4% (Target < 7.0%)',
      'Fasting Blood Sugar: 154 mg/dL (High)',
      'Serum Triglycerides: 215 mg/dL (Elevated)',
      'LDL Bad Cholesterol: 151 mg/dL (High)',
    ],
    dietaryAdvice: 'Adopt a low-glycemic, fiber-rich diet. Limit refined sugars, fried items, and simple carbohydrates. Engage in 30 minutes of daily brisk walking.',
    selectedSignatoryId: 'doc-swaminathan',
    status: 'VERIFIED',
    billing: {
      totalAmount: 1800,
      discount: 200,
      netAmount: 1600,
      paidAmount: 1600,
      paymentMethod: 'UPI',
      paymentStatus: 'PAID',
    },
    whatsAppLogs: [
      {
        sentAt: new Date(Date.now() - 1800000).toISOString(),
        phoneNumber: '9810123456',
        templateType: 'detailed',
      },
    ],
    createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
    updatedAt: new Date(Date.now() - 1800000).toISOString(),
  },
  {
    id: 'rep-002',
    reportNumber: 'LP-2026-8892',
    patient: {
      id: 'pat-002',
      uhid: 'UHID-2026-04183',
      name: 'Sunita Sharma',
      age: 32,
      ageUnit: 'Yrs',
      gender: 'Female',
      phone: '9871198765',
      address: 'Pocket 3, Sector 14, Dwarka, New Delhi',
      referringDoctor: 'Dr. Anita Mehra, DGO (Gynecologist)',
      sampleCollectedAt: new Date(Date.now() - 3600000 * 8).toISOString(),
      sampleReceivedAt: new Date(Date.now() - 3600000 * 7).toISOString(),
      reportGeneratedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
      sampleType: 'EDTA Whole Blood & Serum',
      fastingStatus: 'Random',
      sampleBarcode: 'SMP-DEL-8892',
    },
    tests: [
      createPanelFromTemplate('cbc', {
        hb: '9.4', // Low
        rbc: '3.6', // Low
        pcv: '31.2', // Low
        mcv: '71.5', // Low
        mch: '23.8', // Low
        mchc: '30.1', // Low
        rdw: '16.8', // High
        platelets: '2.4',
        esr: '26', // Mildly elevated
      }),
      createPanelFromTemplate('vitamins', {
        vit_d: '14.2', // Deficient
        vit_b12: '168', // Low
      }),
    ],
    clinicalImpression: 'Hemogram exhibits moderate Microcytic Hypochromic Anemia with elevated RDW, characteristic of Iron Deficiency Anemia. Concomitant severe 25-OH Vitamin D deficiency and borderline Vitamin B12 deficiency noted.',
    pathologistNotes: 'Serum Ferritin and Iron profile correlation suggested. Peripheral smear demonstrates moderate anisopoikilocytosis with microcytes and pencil cells.',
    patientSummaryEn: 'Your Hemoglobin (9.4 g/dL) is on the lower side, indicating mild-to-moderate anemia. Vitamin D and B12 levels are also deficient. Nutritional supplementation and iron-rich diet are recommended.',
    patientSummaryHi: 'आपका हीमोग्लोबिन 9.4 g/dL है जो सामान्य से कम है (खून की कमी/एनीमिया)। साथ ही विटामिन D और B12 की भी कमी है। डॉक्टर की सलाह से आयरन और विटामिन सप्लीमेंट्स लें।',
    keyHighlights: [
      'Hemoglobin: 9.4 g/dL (Low - Anemia)',
      'MCV: 71.5 fL (Microcytic Picture)',
      'Vitamin D: 14.2 ng/mL (Deficient)',
      'Vitamin B12: 168 pg/mL (Low)',
    ],
    dietaryAdvice: 'Increase consumption of green leafy vegetables (spinach, fenugreek), jaggery, beetroot, pomegranates, and dairy/eggs. 15-20 minutes of morning sunlight exposure for Vitamin D.',
    selectedSignatoryId: 'doc-swaminathan',
    status: 'VERIFIED',
    billing: {
      totalAmount: 1550,
      discount: 150,
      netAmount: 1400,
      paidAmount: 1400,
      paymentMethod: 'Cash',
      paymentStatus: 'PAID',
    },
    whatsAppLogs: [],
    createdAt: new Date(Date.now() - 3600000 * 8).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
  },
  {
    id: 'rep-003',
    reportNumber: 'LP-2026-8893',
    patient: {
      id: 'pat-003',
      uhid: 'UHID-2026-04184',
      name: 'Aarav Gupta',
      age: 26,
      ageUnit: 'Yrs',
      gender: 'Male',
      phone: '9910012345',
      address: 'Flat 204, Royal Palms, Noida Sector 62',
      referringDoctor: 'Dr. Vivek Saxena, MD (Internal Med)',
      sampleCollectedAt: new Date(Date.now() - 3600000 * 3).toISOString(),
      sampleReceivedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
      reportGeneratedAt: new Date(Date.now() - 1800000).toISOString(),
      sampleType: 'EDTA Blood & Plain Serum',
      fastingStatus: 'Random',
      sampleBarcode: 'SMP-DEL-8893',
    },
    tests: [
      createPanelFromTemplate('fever_serology', {
        dengue_ns1: 'Reactive (Positive)',
        crp: '28.5', // Elevated
        malaria_antigen: 'Negative for Pv & Pf',
      }),
      createPanelFromTemplate('cbc', {
        hb: '14.8',
        tlc: '3200', // Low - Leukopenia
        neutro: '48',
        lympho: '44',
        platelets: '0.92', // Critical Low - Thrombocytopenia
      }),
    ],
    clinicalImpression: 'CRITICAL ALERT: Serology positive for Dengue NS1 Antigen with marked thrombocytopenia (Platelets 92,000/cu.mm) and leukopenia (TLC 3200 cells/cu.mm). Elevated CRP indicates active acute inflammatory response.',
    pathologistNotes: 'CRITICAL VALUE COMMUNICATED TO REFERRING PHYSICIAN. Daily platelet count monitoring and hematocrit tracking recommended to guard against plasma leakage.',
    patientSummaryEn: 'Dengue NS1 test is POSITIVE with a drop in platelet count (92,000). Immediate medical evaluation is necessary. Stay well-hydrated with fluids, ORS, coconut water, and avoid self-medication like painkillers (NSAIDs).',
    patientSummaryHi: 'डेंगू NS1 टेस्ट पॉजिटिव आया है और प्लेटलेट्स घटकर 92,000 हो गए हैं। तुरंत डॉक्टर से संपर्क करें। पर्याप्त मात्रा में पानी, नारियल पानी व तरल पदार्थ लें।',
    keyHighlights: [
      'Dengue NS1 Antigen: REACTIVE (POSITIVE)',
      'Platelet Count: 0.92 Lakhs (92,000/cu.mm) - LOW ALERT',
      'TLC: 3,200 cells/cu.mm (Leukopenia)',
      'CRP: 28.5 mg/L (Inflammatory Spike)',
    ],
    dietaryAdvice: 'Maintain vigorous oral hydration (ORS, coconut water, fresh clear juices). Rest completely. Monitor for any red flag signs like abdominal pain, persistent vomiting, or mucosal bleeding.',
    selectedSignatoryId: 'doc-swaminathan',
    status: 'VERIFIED',
    billing: {
      totalAmount: 1200,
      discount: 0,
      netAmount: 1200,
      paidAmount: 1200,
      paymentMethod: 'UPI',
      paymentStatus: 'PAID',
    },
    whatsAppLogs: [
      {
        sentAt: new Date(Date.now() - 900000).toISOString(),
        phoneNumber: '9910012345',
        templateType: 'hindi_bilingual',
      },
    ],
    createdAt: new Date(Date.now() - 3600000 * 3).toISOString(),
    updatedAt: new Date(Date.now() - 900000).toISOString(),
  },
];

export const initialMockReports = initialReports;
