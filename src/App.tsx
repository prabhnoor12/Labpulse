import React, { useState, useEffect } from 'react';
import { LabProfile, DiagnosticReport, TestTemplate, TestPanel } from './types';
import { defaultLabProfile } from './data/defaultLabProfile';
import { standardTestTemplates } from './data/defaultTemplates';
import { initialMockReports } from './data/mockReports';
import { LabHeader } from './components/LabHeader';
import { ReportEditor } from './components/ReportEditor';
import { PatientRegistry } from './components/PatientRegistry';
import { DiagnosticReportDocument } from './components/DiagnosticReportDocument';
import { WhatsAppShareModal } from './components/WhatsAppShareModal';
import { BillingReceiptModal } from './components/BillingReceiptModal';
import { PrescriptionScannerModal } from './components/PrescriptionScannerModal';
import { LabSettingsModal } from './components/LabSettingsModal';
import { TestCatalogModal } from './components/TestCatalogModal';
import { ReportViewerModal } from './components/ReportViewerModal';
import { computeDerivedValues } from './utils/rangeEvaluator';

export default function App() {
  // 1. Core State with Local Storage fallback
  const [labProfile, setLabProfile] = useState<LabProfile>(() => {
    const saved = localStorage.getItem('labpulse_profile');
    return saved ? JSON.parse(saved) : defaultLabProfile;
  });

  const [testTemplates, setTestTemplates] = useState<TestTemplate[]>(() => {
    const saved = localStorage.getItem('labpulse_templates');
    return saved ? JSON.parse(saved) : standardTestTemplates;
  });

  const [reports, setReports] = useState<DiagnosticReport[]>(() => {
    const saved = localStorage.getItem('labpulse_reports');
    return saved ? JSON.parse(saved) : initialMockReports;
  });

  const [activeTab, setActiveTab] = useState<'editor' | 'registry'>('editor');
  const [currentReportId, setCurrentReportId] = useState<string>(reports[0]?.id || 'rep-001');

  // 2. Modals State
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState<boolean>(false);
  const [isBillingModalOpen, setIsBillingModalOpen] = useState<boolean>(false);
  const [isRxScannerModalOpen, setIsRxScannerModalOpen] = useState<boolean>(false);
  const [isLabSettingsModalOpen, setIsLabSettingsModalOpen] = useState<boolean>(false);
  const [isTestCatalogModalOpen, setIsTestCatalogModalOpen] = useState<boolean>(false);
  const [isViewerModalOpen, setIsViewerModalOpen] = useState<boolean>(false);
  const [shareTargetReport, setShareTargetReport] = useState<DiagnosticReport | null>(null);

  // Toast message
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Persistence effects
  useEffect(() => {
    localStorage.setItem('labpulse_profile', JSON.stringify(labProfile));
  }, [labProfile]);

  useEffect(() => {
    localStorage.setItem('labpulse_templates', JSON.stringify(testTemplates));
  }, [testTemplates]);

  useEffect(() => {
    localStorage.setItem('labpulse_reports', JSON.stringify(reports));
  }, [reports]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const currentReport = reports.find((r) => r.id === currentReportId) || reports[0];

  // Helper to create a new blank report
  const createNewReport = () => {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const randNum = Math.floor(1000 + Math.random() * 9000);
    const newUhid = `UHID-${dateStr.slice(2)}-${Math.floor(100 + Math.random() * 900)}`;
    const newRepNum = `LAB-${dateStr}-${randNum}`;

    // Default with CBC panel
    const cbcTmpl = testTemplates.find((t) => t.id === 'cbc-complete') || testTemplates[0];
    const defaultParams = computeDerivedValues(
      cbcTmpl.parameters.map((p) => ({
        id: p.id,
        name: p.name,
        shortName: p.shortName,
        value: p.defaultVal || '',
        unit: p.unit,
        method: p.method,
        refRange: p.maleRefRange,
        minVal: p.minVal,
        maxVal: p.maxVal,
        subCategory: p.subCategory,
        isCalculated: p.isCalculated,
      }))
    );

    const initialPanel: TestPanel = {
      id: `panel-${cbcTmpl.id}-${Date.now()}`,
      templateId: cbcTmpl.id,
      testName: cbcTmpl.name,
      category: cbcTmpl.category,
      sampleType: cbcTmpl.sampleType,
      method: cbcTmpl.method,
      price: cbcTmpl.defaultPrice,
      parameters: defaultParams,
      clinicalInterpretation: cbcTmpl.defaultNotes,
    };

    const newReport: DiagnosticReport = {
      id: `rep-${Date.now()}`,
      reportNumber: newRepNum,
      patient: {
        id: `pat-${Date.now()}`,
        uhid: newUhid,
        name: 'New Patient',
        age: 35,
        ageUnit: 'Yrs',
        gender: 'Male',
        phone: '9876543210',
        email: '',
        referringDoctor: 'Dr. Consulting Physician',
        sampleCollectedAt: new Date().toISOString(),
        sampleReceivedAt: new Date().toISOString(),
        reportGeneratedAt: new Date().toISOString(),
        sampleBarcode: `SMPL-${Date.now().toString().slice(-6)}`,
        sampleType: cbcTmpl.sampleType,
        fastingStatus: 'Random',
      },
      tests: [initialPanel],
      clinicalImpression: 'Investigation parameters are within normal biological limits.',
      pathologistNotes: 'Internal laboratory Quality Controls (QC) checked and verified.',
      patientSummaryEn: 'All tested parameters are normal. Maintain a balanced diet and hydration.',
      patientSummaryHi: 'सभी जांच रिपोर्ट सामान्य सीमा में हैं। संतुलित आहार और पर्याप्त पानी लें।',
      status: 'DRAFT',
      selectedSignatoryId: labProfile.signatories[0]?.id || 'doc-1',
      billing: {
        totalAmount: initialPanel.price,
        discount: 0,
        netAmount: initialPanel.price,
        paidAmount: initialPanel.price,
        paymentStatus: 'PAID',
        paymentMethod: 'UPI',
      },
      whatsAppLogs: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setReports([newReport, ...reports]);
    setCurrentReportId(newReport.id);
    setActiveTab('editor');
    showToast(`Created new diagnostic report #${newRepNum}`);
  };

  const handleSaveReport = (updated: DiagnosticReport) => {
    setReports((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    showToast(`Report #${updated.reportNumber} saved successfully`);
  };

  const handleDeleteReport = (reportId: string) => {
    const remaining = reports.filter((r) => r.id !== reportId);
    setReports(remaining);
    if (currentReportId === reportId && remaining.length > 0) {
      setCurrentReportId(remaining[0].id);
    }
    showToast('Patient record deleted');
  };

  const handleOpenWhatsAppShare = (report: DiagnosticReport) => {
    setShareTargetReport(report);
    setIsWhatsAppModalOpen(true);
  };

  const handlePreviewReport = (report: DiagnosticReport) => {
    setShareTargetReport(report);
    setIsViewerModalOpen(true);
  };

  const handleReportDispatched = (templateType: string) => {
    if (!shareTargetReport) return;
    const now = new Date().toISOString();
    const updated = {
      ...shareTargetReport,
      status: 'DISPATCHED' as const,
      whatsAppLogs: [
        ...(shareTargetReport.whatsAppLogs || []),
        {
          dispatchedAt: now,
          phoneNumber: shareTargetReport.patient.phone,
          templateUsed: templateType,
          status: 'SENT' as const,
        },
      ],
    };

    setReports((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    setShareTargetReport(updated);
    showToast(`WhatsApp report sent to +91 ${updated.patient.phone}`);
  };

  const handleVerifyAndSign = () => {
    if (!shareTargetReport) return;
    const updated = {
      ...shareTargetReport,
      status: 'VERIFIED' as const,
      updatedAt: new Date().toISOString(),
    };
    setReports((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    setShareTargetReport(updated);
    showToast(`Report #${updated.reportNumber} verified and signed by Consultant Pathologist.`);
  };

  // Handle AI Prescription parsing extraction into current report
  const handleApplyParsedRx = (data: {
    selectedTestIds: string[];
    patientName?: string;
    patientAge?: number;
    patientGender?: string;
    doctorName?: string;
    fastingRequired?: boolean;
    specialInstructions?: string;
  }) => {
    if (!currentReport) return;

    let updatedPatient = { ...currentReport.patient };
    if (data.patientName) updatedPatient.name = data.patientName;
    if (data.patientAge) updatedPatient.age = data.patientAge;
    if (data.patientGender) updatedPatient.gender = data.patientGender as any;
    if (data.doctorName) updatedPatient.referringDoctor = data.doctorName;
    if (data.fastingRequired) updatedPatient.fastingStatus = 'Fasting (12h)';

    // Match templates with robust alias mapping
    const newPanels: TestPanel[] = [];
    data.selectedTestIds.forEach((idOrCode) => {
      const q = idOrCode.toLowerCase().trim();
      const tmpl = testTemplates.find((t) => {
        const tid = t.id.toLowerCase();
        const tcode = t.code.toLowerCase();
        const tname = t.name.toLowerCase();
        if (tid === q || tcode.includes(q) || tname.includes(q)) return true;

        if ((q === 'cbc' || q.includes('hemo') || q.includes('platelet')) && tid === 'cbc') return true;
        if ((q === 'lft' || q.includes('liver') || q.includes('sgot') || q.includes('sgpt') || q.includes('bili')) && tid === 'lft') return true;
        if ((q === 'kft' || q === 'rft' || q.includes('kidney') || q.includes('renal') || q.includes('creatinine') || q.includes('urea')) && tid === 'kft') return true;
        if ((q === 'lipid' || q.includes('cholesterol') || q.includes('triglyceride')) && tid === 'lipid') return true;
        if ((q === 'diabetes' || q === 'fbs_ppbs' || q.includes('sugar') || q.includes('glucose') || q.includes('hba1c')) && tid === 'diabetes') return true;
        if ((q === 'thyroid' || q.includes('tsh') || q.includes('t3') || q.includes('t4')) && tid === 'thyroid') return true;
        if ((q === 'urine' || q === 'urine_rm' || q.includes('routine') || q.includes('urine')) && tid === 'urine_rm') return true;
        if ((q === 'vitamins' || q.includes('vit') || q.includes('b12') || q.includes('vitamin')) && tid === 'vitamins') return true;
        if ((q === 'fever' || q === 'fever_serology' || q.includes('widal') || q.includes('dengue') || q.includes('malaria') || q.includes('crp') || q.includes('typhoid')) && tid === 'fever_serology') return true;

        return false;
      });
      if (tmpl && !newPanels.some((p) => p.templateId === tmpl.id)) {
        const rawParams = tmpl.parameters.map((p) => ({
          id: p.id,
          name: p.name,
          shortName: p.shortName,
          value: p.defaultVal || '',
          unit: p.unit,
          method: p.method,
          refRange: updatedPatient.gender === 'Female' ? p.femaleRefRange : p.maleRefRange,
          minVal: p.minVal,
          maxVal: p.maxVal,
          subCategory: p.subCategory,
          isCalculated: p.isCalculated,
        }));

        newPanels.push({
          id: `panel-${tmpl.id}-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
          templateId: tmpl.id,
          testName: tmpl.name,
          category: tmpl.category,
          sampleType: tmpl.sampleType,
          method: tmpl.method,
          price: tmpl.defaultPrice,
          parameters: computeDerivedValues(rawParams),
          clinicalInterpretation: tmpl.defaultNotes,
        });
      }
    });

    const combinedTests = newPanels.length > 0 ? newPanels : currentReport.tests;
    const newTotal = combinedTests.reduce((acc, t) => acc + t.price, 0);

    const updatedReport: DiagnosticReport = {
      ...currentReport,
      patient: updatedPatient,
      tests: combinedTests,
      pathologistNotes: data.specialInstructions
        ? `Requisition instruction: ${data.specialInstructions}`
        : currentReport.pathologistNotes,
      billing: {
        ...currentReport.billing,
        totalAmount: newTotal,
        netAmount: Math.max(0, newTotal - currentReport.billing.discount),
      },
    };

    handleSaveReport(updatedReport);
    showToast(`Prescription parsed! Loaded ${newPanels.length} test panels.`);
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 font-sans flex flex-col selection:bg-teal-700 selection:text-white">
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900 text-white border border-teal-500 shadow-2xl rounded-xl px-4 py-3 text-xs font-semibold flex items-center gap-2.5 animate-in slide-in-from-bottom-5 duration-300">
          <div className="w-2 h-2 rounded-full bg-teal-400 animate-ping" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Application Header */}
      <LabHeader
        lab={labProfile}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onOpenSettings={() => setIsLabSettingsModalOpen(true)}
        onOpenCatalog={() => setIsTestCatalogModalOpen(true)}
        onNewReport={createNewReport}
        patientCount={reports.length}
      />

      {/* Main Screen Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">
        {activeTab === 'editor' && currentReport && (
          <ReportEditor
            report={currentReport}
            lab={labProfile}
            templates={testTemplates}
            onSaveReport={handleSaveReport}
            onPreviewReport={handlePreviewReport}
            onWhatsAppShare={handleOpenWhatsAppShare}
            onOpenBilling={() => setIsBillingModalOpen(true)}
            onOpenRxScanner={() => setIsRxScannerModalOpen(true)}
          />
        )}

        {activeTab === 'registry' && (
          <PatientRegistry
            reports={reports}
            lab={labProfile}
            onSelectReport={(rep) => {
              setCurrentReportId(rep.id);
              handlePreviewReport(rep);
            }}
            onEditReport={(rep) => {
              setCurrentReportId(rep.id);
              setActiveTab('editor');
            }}
            onWhatsAppShare={handleOpenWhatsAppShare}
            onDeleteReport={handleDeleteReport}
            onNewReport={createNewReport}
          />
        )}
      </main>

      {/* WhatsApp Share Modal */}
      {shareTargetReport && (
        <WhatsAppShareModal
          isOpen={isWhatsAppModalOpen}
          onClose={() => setIsWhatsAppModalOpen(false)}
          report={shareTargetReport}
          lab={labProfile}
          onReportDispatched={handleReportDispatched}
        />
      )}

      {/* Billing Invoice & Payment Receipt Modal */}
      {currentReport && (
        <BillingReceiptModal
          isOpen={isBillingModalOpen}
          onClose={() => setIsBillingModalOpen(false)}
          report={currentReport}
          lab={labProfile}
          onUpdateBilling={(billing) => {
            handleSaveReport({ ...currentReport, billing });
          }}
        />
      )}

      {/* Prescription Scanner Modal (Gemini AI OCR) */}
      <PrescriptionScannerModal
        isOpen={isRxScannerModalOpen}
        onClose={() => setIsRxScannerModalOpen(false)}
        onApplyParsedData={handleApplyParsedRx}
      />

      {/* Lab Settings Modal */}
      <LabSettingsModal
        isOpen={isLabSettingsModalOpen}
        onClose={() => setIsLabSettingsModalOpen(false)}
        lab={labProfile}
        onSaveLab={(updated) => {
          setLabProfile(updated);
          showToast('Lab profile and letterhead updated');
        }}
      />

      {/* Test Catalog & Rates Modal */}
      <TestCatalogModal
        isOpen={isTestCatalogModalOpen}
        onClose={() => setIsTestCatalogModalOpen(false)}
        templates={testTemplates}
        onUpdateTemplates={(updated) => {
          setTestTemplates(updated);
          showToast('Diagnostic test catalog updated');
        }}
      />

      {/* Full Document Viewer Modal */}
      {shareTargetReport && (
        <ReportViewerModal
          isOpen={isViewerModalOpen}
          onClose={() => setIsViewerModalOpen(false)}
          report={shareTargetReport}
          lab={labProfile}
          onWhatsAppShare={() => {
            setIsViewerModalOpen(false);
            setIsWhatsAppModalOpen(true);
          }}
          onVerifyAndSign={handleVerifyAndSign}
        />
      )}
    </div>
  );
}
