import React, { useEffect, useState } from 'react';
import { DiagnosticReport, LabProfile, TestTemplate } from '@/domain/types';
import { defaultLabProfile } from '@/config/defaultLabProfile';
import { standardTestTemplates } from '@/data/defaultTemplates';
import { readStorage, writeStorage } from '@/app/storage';
import { LabHeader } from '@/components/layout/LabHeader';
import { BillingReceiptModal } from '@/features/billing/BillingReceiptModal';
import { LabSettingsModal } from '@/features/lab-settings/LabSettingsModal';
import { PatientRegistry } from '@/features/patients/PatientRegistry';
import { PrescriptionScannerModal } from '@/features/prescription/PrescriptionScannerModal';
import { applyPrescriptionToReport } from '@/features/prescription/prescriptionService';
import { ReportEditor } from '@/features/reports/components/ReportEditor';
import { ReportViewerModal } from '@/features/reports/components/ReportViewerModal';
import { createBlankReport } from '@/features/reports/reportFactory';
import { removeReport, replaceReport } from '@/features/reports/reportService';
import { TestCatalogModal } from '@/features/test-catalog/TestCatalogModal';
import { WhatsAppShareModal } from '@/features/whatsapp/WhatsAppShareModal';
import { PrescriptionParseResult } from '@/services/aiService';

type Tab = 'editor' | 'registry';
type WhatsAppTemplate = 'standard' | 'detailed' | 'urgent' | 'hindi';

export default function App() {
  const [labProfile, setLabProfile] = useState<LabProfile>(() =>
    readStorage('labpulse_profile', defaultLabProfile),
  );
  const [testTemplates, setTestTemplates] = useState<TestTemplate[]>(() =>
    readStorage('labpulse_templates', standardTestTemplates),
  );
  const [reports, setReports] = useState<DiagnosticReport[]>(() =>
    readStorage('labpulse_reports', []),
  );
  const [activeTab, setActiveTab] = useState<Tab>('editor');
  const [currentReportId, setCurrentReportId] = useState(reports[0]?.id || '');
  const [shareTargetReport, setShareTargetReport] = useState<DiagnosticReport | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);
  const [isBillingModalOpen, setIsBillingModalOpen] = useState(false);
  const [isRxScannerModalOpen, setIsRxScannerModalOpen] = useState(false);
  const [isLabSettingsModalOpen, setIsLabSettingsModalOpen] = useState(false);
  const [isTestCatalogModalOpen, setIsTestCatalogModalOpen] = useState(false);
  const [isViewerModalOpen, setIsViewerModalOpen] = useState(false);

  useEffect(() => writeStorage('labpulse_profile', labProfile), [labProfile]);
  useEffect(() => writeStorage('labpulse_templates', testTemplates), [testTemplates]);
  useEffect(() => writeStorage('labpulse_reports', reports), [reports]);

  const showToast = (message: string) => {
    setToastMessage(message);
    window.setTimeout(() => setToastMessage(null), 3500);
  };

  const currentReport = reports.find((report) => report.id === currentReportId) || reports[0];

  const createNewReport = () => {
    try {
      const report = createBlankReport(testTemplates, labProfile);
      setReports((previous) => [report, ...previous]);
      setCurrentReportId(report.id);
      setActiveTab('editor');
      showToast(`Created new diagnostic report #${report.reportNumber}`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Unable to create report');
    }
  };

  const handleSaveReport = (updatedReport: DiagnosticReport) => {
    setReports((previous) => replaceReport(previous, updatedReport));
    showToast(`Report #${updatedReport.reportNumber} saved successfully`);
  };

  const handleDeleteReport = (reportId: string) => {
    const remaining = removeReport(reports, reportId);
    setReports(remaining);
    if (currentReportId === reportId) setCurrentReportId(remaining[0]?.id || '');
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

  const handleReportDispatched = (templateType: WhatsAppTemplate) => {
    if (!shareTargetReport) return;

    const updatedReport: DiagnosticReport = {
      ...shareTargetReport,
      status: 'DISPATCHED',
      whatsAppLogs: [
        ...shareTargetReport.whatsAppLogs,
        {
          sentAt: new Date().toISOString(),
          phoneNumber: shareTargetReport.patient.phone,
          templateType,
        },
      ],
    };

    setReports((previous) => replaceReport(previous, updatedReport));
    setShareTargetReport(updatedReport);
    showToast(`WhatsApp report sent to ${updatedReport.patient.phone}`);
  };

  const handleVerifyAndSign = () => {
    if (!shareTargetReport) return;

    const updatedReport: DiagnosticReport = {
      ...shareTargetReport,
      status: 'VERIFIED',
      updatedAt: new Date().toISOString(),
    };

    setReports((previous) => replaceReport(previous, updatedReport));
    setShareTargetReport(updatedReport);
    showToast(`Report #${updatedReport.reportNumber} verified and signed.`);
  };

  const handleApplyParsedRx = (data: PrescriptionParseResult) => {
    if (!currentReport) return;

    const result = applyPrescriptionToReport(currentReport, testTemplates, data);
    handleSaveReport(result.report);
    showToast(`Prescription parsed! Loaded ${result.panelCount} test panels.`);
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 font-sans flex flex-col selection:bg-teal-700 selection:text-white">
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900 text-white border border-teal-500 shadow-2xl rounded-xl px-4 py-3 text-xs font-semibold flex items-center gap-2.5 animate-in slide-in-from-bottom-5 duration-300">
          <div className="w-2 h-2 rounded-full bg-teal-400 animate-ping" />
          <span>{toastMessage}</span>
        </div>
      )}

      <LabHeader
        lab={labProfile}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onOpenSettings={() => setIsLabSettingsModalOpen(true)}
        onOpenCatalog={() => setIsTestCatalogModalOpen(true)}
        onNewReport={createNewReport}
        patientCount={reports.length}
      />

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

        {activeTab === 'editor' && !currentReport && (
          <div className="bg-white rounded-xl border border-dashed border-slate-300 p-10 text-center max-w-2xl mx-auto">
            <h2 className="text-base font-bold text-slate-900">No reports yet</h2>
            <p className="mt-1 text-sm text-slate-500">Create a report to begin entering patient and test information.</p>
            <button type="button" onClick={createNewReport} className="mt-5 bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold px-4 py-2 rounded-lg">
              Create New Report
            </button>
          </div>
        )}

        {activeTab === 'registry' && (
          <PatientRegistry
            reports={reports}
            lab={labProfile}
            onSelectReport={(report) => {
              setCurrentReportId(report.id);
              handlePreviewReport(report);
            }}
            onEditReport={(report) => {
              setCurrentReportId(report.id);
              setActiveTab('editor');
            }}
            onWhatsAppShare={handleOpenWhatsAppShare}
            onDeleteReport={handleDeleteReport}
            onNewReport={createNewReport}
          />
        )}
      </main>

      {shareTargetReport && (
        <WhatsAppShareModal
          isOpen={isWhatsAppModalOpen}
          onClose={() => setIsWhatsAppModalOpen(false)}
          report={shareTargetReport}
          lab={labProfile}
          onReportDispatched={handleReportDispatched}
        />
      )}

      {currentReport && (
        <BillingReceiptModal
          isOpen={isBillingModalOpen}
          onClose={() => setIsBillingModalOpen(false)}
          report={currentReport}
          lab={labProfile}
          onUpdateBilling={(billing) => handleSaveReport({ ...currentReport, billing })}
        />
      )}

      <PrescriptionScannerModal
        isOpen={isRxScannerModalOpen}
        onClose={() => setIsRxScannerModalOpen(false)}
        onApplyParsedData={handleApplyParsedRx}
      />

      <LabSettingsModal
        isOpen={isLabSettingsModalOpen}
        onClose={() => setIsLabSettingsModalOpen(false)}
        lab={labProfile}
        onSaveLab={(updated) => {
          setLabProfile(updated);
          showToast('Lab profile and letterhead updated');
        }}
      />

      <TestCatalogModal
        isOpen={isTestCatalogModalOpen}
        onClose={() => setIsTestCatalogModalOpen(false)}
        templates={testTemplates}
        onUpdateTemplates={(updated) => {
          setTestTemplates(updated);
          showToast('Diagnostic test catalog updated');
        }}
      />

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
