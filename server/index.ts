import express, { Request, Response } from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

// Lazy Gemini client getter
function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  return new GoogleGenAI({
    apiKey: apiKey || '',
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Health check
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// AI Clinical Impression & Pathologist Notes
app.post('/api/ai/clinical-impression', async (req: Request, res: Response) => {
  try {
    const { patient, tests, abnormalParameters, notes } = req.body;
    
    if (!process.env.GEMINI_API_KEY) {
      return res.status(200).json({
        impression: 'Clinical correlation recommended. Please consult the referring physician with these results.',
        pathologistNote: 'Sample processed on automated and standardized laboratory analyzers with calibrated reference controls.',
        patientSummaryEn: 'Your test results are ready. Please review the highlighted parameters with your doctor.',
        patientSummaryHi: 'आपकी जाँच रिपोर्ट तैयार है। कृपया अपने चिकित्सक से परामर्श लें।',
        keyHighlights: abnormalParameters?.map((p: any) => `${p.name}: ${p.value} ${p.unit} (${p.flag})`) || [],
        dietaryAdvice: 'Follow a balanced diet and stay hydrated. Take medications strictly as advised by your physician.',
      });
    }

    const ai = getGeminiClient();

    const prompt = `
You are a senior consultant pathologist reviewing a diagnostic laboratory report in India.
Patient Context:
- Name: ${patient?.name || 'Patient'}
- Age/Gender: ${patient?.age || 'N/A'} Yrs / ${patient?.gender || 'N/A'}
- Referring Doctor: ${patient?.referringDoctor || 'Self / Consulting Physician'}
- Clinical History/Notes: ${notes || 'Routine checkup / Diagnostic workup'}

Tests Conducted:
${JSON.stringify(tests, null, 2)}

Abnormal Values Flagged:
${JSON.stringify(abnormalParameters, null, 2)}

Provide an authoritative, medical-grade diagnostic impression, clinical notes for the doctor, and a respectful, reassuring bilingual (English & Hindi) summary tailored for WhatsApp delivery to the patient.

Strictly adhere to professional pathology reporting standards in India (NABL / Indian Medical Council norms).
Return JSON adhering to schema:
{
  "impression": "Precise clinical pathologist impression summarizing key diagnostic takeaways, e.g. Microcytic Hypochromic Anemia / Elevated HbA1c suggestive of Poor Glycemic Control / etc.",
  "pathologistNote": "Technical note for the physician, e.g. Correlation with peripheral blood smear or ultrasound suggested.",
  "patientSummaryEn": "Concise, comforting, easy-to-understand 2-3 sentence English summary explaining what the main test numbers mean in simple words.",
  "patientSummaryHi": "सटीक, सरल और आश्वस्त करने वाली हिंदी में 2-3 पंक्तियों का सारांश ताकि मरीज आसानी से समझ सके।",
  "keyHighlights": ["Point 1: Key finding", "Point 2: Secondary observation"],
  "dietaryAdvice": "Brief general wellness / lifestyle advice relevant to these findings (with mandatory doctor consultation advice)"
}
`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            impression: { type: Type.STRING },
            pathologistNote: { type: Type.STRING },
            patientSummaryEn: { type: Type.STRING },
            patientSummaryHi: { type: Type.STRING },
            keyHighlights: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            dietaryAdvice: { type: Type.STRING },
          },
          required: ['impression', 'pathologistNote', 'patientSummaryEn', 'patientSummaryHi', 'keyHighlights'],
        },
      },
    });

    const responseText = response.text || '{}';
    const parsed = JSON.parse(responseText);
    return res.json(parsed);
  } catch (error: any) {
    console.error('Error in AI clinical impression:', error);
    return res.status(500).json({
      error: 'Failed to generate clinical impression',
      details: error.message,
    });
  }
});

// AI Doctor Prescription / Clinical note parser
app.post('/api/ai/parse-doctor-rx', async (req: Request, res: Response) => {
  try {
    const { rxText } = req.body;

    if (!rxText || !rxText.trim()) {
      return res.status(400).json({ error: 'rxText is required' });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(200).json({
        suggestedTestIds: ['cbc', 'lft', 'kft', 'lipid', 'fbs_ppbs'],
        extractedPatientInfo: {},
        fastingRequired: false,
      });
    }

    const ai = getGeminiClient();

    const prompt = `
Analyze the following doctor prescription / clinical test requisition in India:
"""${rxText}"""

Identify ordered diagnostic lab tests, match them to common Indian pathology panels (CBC, LFT, KFT/RFT, Lipid Profile, Thyroid Profile / TSH, Blood Sugar Fasting/PPBS, HbA1c, Urine Routine, Vitamin D, Vitamin B12, Widal, Dengue NS1, Malaria, CRP, ESR), and detect patient details if present.

Return JSON adhering to schema:
{
  "suggestedTestIds": ["cbc", "lipid", "lft", "kft", "thyroid", "hba1c", "blood_sugar", "urine_rm", "vitamins", "widal", "dengue", "crp_esr"],
  "patientName": "Patient Name if mentioned or null",
  "patientAge": 0,
  "patientGender": "Male | Female | Other | null",
  "doctorName": "Doctor Name if mentioned or null",
  "fastingRequired": true/false,
  "specialInstructions": "e.g. 10-12 hours overnight fasting required for lipid and FBS"
}
`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            suggestedTestIds: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            patientName: { type: Type.STRING },
            patientAge: { type: Type.INTEGER },
            patientGender: { type: Type.STRING },
            doctorName: { type: Type.STRING },
            fastingRequired: { type: Type.BOOLEAN },
            specialInstructions: { type: Type.STRING },
          },
          required: ['suggestedTestIds', 'fastingRequired'],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    return res.json(parsed);
  } catch (error: any) {
    console.error('Error in AI prescription parser:', error);
    return res.status(500).json({
      error: 'Failed to parse prescription text',
      details: error.message,
    });
  }
});

// Vite middleware & Production static serving
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`LabPulse India Server running on http://localhost:${PORT}`);
  });
}

startServer();
