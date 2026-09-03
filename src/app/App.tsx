import React, { useEffect, useState } from 'react';
import { DiagnosticReport, LabProfile, TestTemplate } from '@/domain/types';
import { defaultLabProfile } from '@/config/defaultLabProfile';
import { standardTestTemplates } from '@/data/defaultTemplates';
import { ApiError, api, apiClient, CurrentUser } from '@/services/apiClient';
import { LabHeader } from '@/components/layout/LabHeader';
import { LoginScreen } from '@/features/auth/LoginScreen';
import { BillingReceiptModal } from '@/features/billing/BillingReceiptModal';
import { LabSettingsModal } from '@/features/lab-settings/LabSettingsModal';
import { PatientRegistry } from '@/features/patients/PatientRegistry';
import { PrescriptionScannerModal } from '@/features/prescription/PrescriptionScannerModal';
import { applyPrescriptionToReport } from '@/features/prescription/prescriptionService';
import { ReportEditor } from '@/features/reports/components/ReportEditor';
import { ReportViewerModal } from '@/features/reports/components/ReportViewerModal';
import { PublicReportPage } from '@/features/reports/PublicReportPage';
import { createBlankReport } from '@/features/reports/reportFactory';
import { replaceReport } from '@/features/reports/reportService';
import { validateReportForVerification } from '@/features/reports/reportValidation';
import { TestCatalogModal } from '@/features/test-catalog/TestCatalogModal';
import { WhatsAppShareModal } from '@/features/whatsapp/WhatsAppShareModal';
import { PrescriptionParseResult } from '@/services/aiService';
import {
  clearOfflineSession,
  clearWorkspaceSnapshot,
  enqueueOfflineReportCreate,
  enqueueOfflineReportUpdate,
  hasOfflineSession,
  hasPendingOfflineReportCreate,
  readWorkspaceSnapshot,
  saveOfflineSession,
  saveWorkspaceSnapshot,
  unlockOfflineSession,
} from '@/app/offlineStore';
import { flushOfflineReportOperations, offlineCreateOperation, offlineUpdateOperation } from '@/services/offlineSync';

type Tab = 'editor' | 'registry';
type WhatsAppTemplate = 'standard' | 'detailed' | 'urgent' | 'hindi';

function readPublicReportToken(): string | null {
  if (typeof window === 'undefined') return null;
  const match = window.location.hash.match(/^#public-([A-Za-z0-9_-]{40,64})$/);
  return match?.[1] || null;
}

export default function App() {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [authStatus, setAuthStatus] = useState<'loading' | 'authenticated' | 'unauthenticated'>('loading');
  const [authError, setAuthError] = useState<string | null>(null);
  const [labProfile, setLabProfile] = useState<LabProfile>(defaultLabProfile);
  const [testTemplates, setTestTemplates] = useState<TestTemplate[]>(standardTestTemplates);
  const [reports, setReports] = useState<DiagnosticReport[]>([]);
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
  const [publicReportToken, setPublicReportToken] = useState<string | null>(readPublicReportToken);
  const [offlinePendingCount, setOfflinePendingCount] = useState(0);
  const [isOnline, setIsOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine);
  const [offlineUnlockAvailable, setOfflineUnlockAvailable] = useState(false);
  const [isOfflineSession, setIsOfflineSession] = useState(false);

  const loadWorkspace = async (user: CurrentUser, offlinePassword?: string) => {
    const [profile, apiTemplates, apiReports] = await Promise.all([
      api.labProfile(),
      api.templates(),
      api.reports(),
    ]);

    let templates = apiTemplates;
    if (templates.length === 0) {
      templates = standardTestTemplates;
      if (user.role === 'OWNER') {
        try {
          templates = await api.saveTemplates(templates);
        } catch {
          // A non-blocking seed failure should not prevent the workspace from opening.
        }
      }
    }

    setLabProfile({ ...defaultLabProfile, ...profile, id: user.labId });
    setTestTemplates(templates);
    setReports(apiReports);
    setCurrentReportId(apiReports[0]?.id || '');
    if (offlinePassword) {
      void saveWorkspaceSnapshot({
        userId: user.id,
        labId: user.labId,
        savedAt: new Date().toISOString(),
        profile: { ...defaultLabProfile, ...profile, id: user.labId },
        templates,
        reports: apiReports,
      }, offlinePassword).catch(() => {
        // Secure offline caching is optional and must not block the online workspace.
      });
    }
  };

  useEffect(() => {
    if (publicReportToken) return;
    let active = true;
    api.me()
      .then(async (user) => {
        if (!active) return;
        await loadWorkspace(user);
        if (!active) return;
        setCurrentUser(user);
        setIsOfflineSession(false);
        setAuthStatus('authenticated');
      })
      .catch(async (error: unknown) => {
        if (!active) return;
        if (error instanceof ApiError && error.status === 401) {
          setOfflineUnlockAvailable(false);
          setAuthStatus('unauthenticated');
        } else if (error instanceof ApiError && error.status === 0) {
          setOfflineUnlockAvailable(await hasOfflineSession().catch(() => false));
          setAuthError('The server is unavailable. Sign in when connected or unlock a cached workspace.');
          setAuthStatus('unauthenticated');
        } else {
          setAuthError(error instanceof Error ? error.message : 'Unable to connect to the LabPulse API.');
          setAuthStatus('unauthenticated');
        }
      });
    return () => { active = false; };
  }, [publicReportToken]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (!currentUser) return undefined;
    let active = true;
    const synchronize = async () => {
      if (!navigator.onLine) return;
      try {
        const result = await flushOfflineReportOperations(currentUser);
        if (!active) return;
        if (result.syncedReports.length > 0 || result.idMappings.length > 0) {
          setReports((previous) => {
            let next = previous;
            for (const mapping of result.idMappings) {
              next = next.filter((report) => report.id !== mapping.localId && report.id !== mapping.report.id);
              next = [mapping.report, ...next];
            }
            return result.syncedReports.reduce((reports, report) => (
              reports.some((item) => item.id === report.id)
                ? replaceReport(reports, report)
                : [report, ...reports]
            ), next);
          });
          setCurrentReportId((reportId) => result.idMappings.find((mapping) => mapping.localId === reportId)?.report.id || reportId);
          setShareTargetReport((target) => {
            if (!target) return target;
            const mapping = result.idMappings.find((item) => item.localId === target.id);
            if (mapping) return mapping.report;
            return result.syncedReports.find((report) => report.id === target.id) || target;
          });
          const createdCount = result.idMappings.length;
          const updatedCount = result.syncedReports.length - createdCount;
          const parts = [
            createdCount > 0 ? `${createdCount} report${createdCount === 1 ? '' : 's'} created` : '',
            updatedCount > 0 ? `${updatedCount} report update${updatedCount === 1 ? '' : 's'} synchronized` : '',
          ].filter(Boolean);
          showToast(`${parts.join(' and ')}.`);
        }
        setOfflinePendingCount(result.pendingCount + result.failedCount);
      } catch {
        // IndexedDB availability must not prevent the online workspace from opening.
      }
    };
    const handleOnline = () => { void synchronize(); };
    window.addEventListener('online', handleOnline);
    void synchronize();
    return () => {
      active = false;
      window.removeEventListener('online', handleOnline);
    };
  }, [currentUser]);

  useEffect(() => {
    const updatePublicToken = () => {
      setPublicReportToken(readPublicReportToken());
    };
    window.addEventListener('hashchange', updatePublicToken);
    return () => window.removeEventListener('hashchange', updatePublicToken);
  }, []);

  const handleLogin = async (email: string, password: string) => {
    try {
      const user = await api.login(email, password);
      await saveOfflineSession(user, password).catch(() => {
        // Secure offline storage is optional and must not block online login.
      });
      await loadWorkspace(user, password);
      setCurrentUser(user);
      setOfflineUnlockAvailable(false);
      setIsOfflineSession(false);
      setAuthError(null);
      setAuthStatus('authenticated');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to sign in.';
      setAuthError(message);
      throw error;
    }
  };

  const handleOfflineUnlock = async (email: string, password: string) => {
    const unlocked = await unlockOfflineSession(email, password);
    if (!unlocked) throw new Error('Invalid offline credentials.');
    const snapshot = await readWorkspaceSnapshot(unlocked.user.id, unlocked.user.labId, password);
    if (!snapshot) throw new Error('No secure workspace snapshot is available for this account. Sign in online once to enable offline access.');

    setLabProfile(snapshot.profile);
    setTestTemplates(snapshot.templates);
    setReports(snapshot.reports);
    setCurrentReportId(snapshot.reports[0]?.id || '');
    setCurrentUser(unlocked.user);
    setOfflineUnlockAvailable(false);
    setIsOfflineSession(true);
    setAuthError(null);
    setAuthStatus('authenticated');
  };

  const handleLogout = async () => {
    const userId = currentUser?.id;
    try {
      await api.logout();
    } finally {
      void Promise.all([
        clearWorkspaceSnapshot(),
        userId ? clearOfflineSession(userId) : Promise.resolve(),
      ]).catch(() => undefined);
      setCurrentUser(null);
      setReports([]);
      setIsOfflineSession(false);
      setAuthStatus('unauthenticated');
    }
  };

  useEffect(() => {
    const openHashReport = () => {
      const hash = window.location.hash;
      const match = hash.match(/^#(?:report|verify)-(.+)$/);
      if (!match) return;

      let reportNumber: string;
      try {
        reportNumber = decodeURIComponent(match[1]);
      } catch {
        return;
      }

      const report = reports.find((item) => item.reportNumber === reportNumber);
      if (!report) return;

      setShareTargetReport(report);
      setIsViewerModalOpen(true);
    };

    openHashReport();
    window.addEventListener('hashchange', openHashReport);
    return () => window.removeEventListener('hashchange', openHashReport);
  }, [reports]);

  const showToast = (message: string) => {
    setToastMessage(message);
    window.setTimeout(() => setToastMessage(null), 3500);
  };

  const currentReport = reports.find((report) => report.id === currentReportId) || reports[0];

  const createNewReport = async () => {
    const report = createBlankReport(testTemplates, labProfile);
    try {
      const savedReport = await api.createReport(report);
      setReports((previous) => [savedReport, ...previous]);
      setCurrentReportId(savedReport.id);
      setActiveTab('editor');
      showToast(`Created new diagnostic report #${savedReport.reportNumber}`);
    } catch (error) {
      if (error instanceof ApiError && error.status === 0 && currentUser) {
        const offlineReport = { ...report, offlinePending: true };
        try {
          await enqueueOfflineReportCreate(offlineCreateOperation(currentUser, offlineReport));
        } catch {
          showToast('The server and offline storage are unavailable; this report was not saved.');
          return;
        }
        setReports((previous) => [offlineReport, ...previous]);
        setCurrentReportId(offlineReport.id);
        setActiveTab('editor');
        setOfflinePendingCount((count) => count + 1);
        showToast('Report created on this device and will synchronize when the server is available.');
        return;
      }
      showToast(error instanceof Error ? error.message : 'Unable to create report');
    }
  };

  const handleSaveReport = async (updatedReport: DiagnosticReport) => {
    const queueOfflineUpdate = async () => {
      if (!currentUser) return undefined;
      const offlineReport = { ...updatedReport, offlinePending: true };
      try {
        await enqueueOfflineReportUpdate(offlineUpdateOperation(currentUser, offlineReport));
      } catch {
        showToast('The server and offline storage are unavailable; this change was not saved.');
        return undefined;
      }
      setReports((previous) => replaceReport(previous, offlineReport));
      setOfflinePendingCount((count) => count + 1);
      showToast('Report saved on this device and will synchronize when the server is available.');
      return offlineReport;
    };

    if (currentUser && !/^[0-9a-f-]{36}$/i.test(updatedReport.id)) {
      try {
        if (await hasPendingOfflineReportCreate(currentUser.id, currentUser.labId, updatedReport.id)) {
          return queueOfflineUpdate();
        }
      } catch {
        // Continue with the API request when IndexedDB is unavailable.
      }
    }

    try {
      const savedReport = await api.updateReport(updatedReport);
      setReports((previous) => replaceReport(previous, savedReport));
      if (shareTargetReport?.id === savedReport.id) setShareTargetReport(savedReport);
      showToast(`Report #${savedReport.reportNumber} saved successfully`);
      return savedReport;
    } catch (error) {
      if (error instanceof ApiError && error.status === 0 && currentUser) {
        const isServerReport = /^[0-9a-f-]{36}$/i.test(updatedReport.id);
        let hasPendingCreate = false;
        if (!isServerReport) {
          try {
            hasPendingCreate = await hasPendingOfflineReportCreate(currentUser.id, currentUser.labId, updatedReport.id);
          } catch {
            hasPendingCreate = false;
          }
        }
        if (isServerReport || hasPendingCreate) return queueOfflineUpdate();
      }
      showToast(error instanceof Error ? error.message : 'Unable to save report');
      return undefined;
    }
  };

  const handleDeleteReport = async (reportId: string) => {
    try {
      const reportToArchive = reports.find((report) => report.id === reportId);
      await api.archiveReport(reportId, reportToArchive?.version);
      const remaining = reports.filter((report) => report.id !== reportId);
      setReports(remaining);
      if (currentReportId === reportId) setCurrentReportId(remaining[0]?.id || '');
      showToast('Patient record archived');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Unable to archive report');
    }
  };

  const handleOpenWhatsAppShare = (report: DiagnosticReport) => {
    const open = async () => {
      let target = report;
      if ((report.status === 'VERIFIED' || report.status === 'DISPATCHED') && !report.publicReportUrl) {
        try {
          const link = await api.createPublicLink(report.id, report.version);
          target = { ...report, publicReportUrl: `${window.location.origin}/#public-${link.token}` };
        } catch (error: unknown) {
          showToast(error instanceof Error ? error.message : 'Unable to create a secure report link.');
          return;
        }
      }
      setShareTargetReport(target);
      setIsWhatsAppModalOpen(true);
    };
    void open();
  };

  const handlePreviewReport = (report: DiagnosticReport) => {
    setShareTargetReport(report);
    setIsViewerModalOpen(true);
  };

  const handleReportDispatched = (
    templateType: WhatsAppTemplate,
    recipientPhone: string,
    channel: 'DIRECT_WHATSAPP' | 'WA_WEB' | 'COPY' = 'DIRECT_WHATSAPP',
  ) => {
    if (!shareTargetReport) return;
    if (shareTargetReport.status !== 'VERIFIED' && shareTargetReport.status !== 'DISPATCHED') {
      showToast('Verify and sign the report before dispatching it.');
      return;
    }

    void api.dispatchReport(shareTargetReport.id, { phoneNumber: recipientPhone, templateType, channel }, shareTargetReport.version)
      .then((updatedReport) => {
        const reportWithLink = { ...updatedReport, publicReportUrl: shareTargetReport.publicReportUrl };
        setReports((previous) => replaceReport(previous, reportWithLink));
        setShareTargetReport(reportWithLink);
        showToast(`WhatsApp link opened for ${recipientPhone}; delivery is not confirmed.`);
      })
      .catch((error: unknown) => showToast(error instanceof Error ? error.message : 'Unable to record dispatch'));
  };

  const handleVerifyAndSign = () => {
    if (!shareTargetReport) return;

    const validation = validateReportForVerification(shareTargetReport, labProfile);
    if (!validation.valid) {
      showToast(validation.errors[0] || 'Complete the report before verification.');
      return;
    }

    const verificationRequest = shareTargetReport.status === 'READY_FOR_REVIEW'
      ? api.verifyReport(shareTargetReport.id, shareTargetReport.version)
      : api.submitReport(shareTargetReport.id, shareTargetReport.version).then((submittedReport) => api.verifyReport(submittedReport.id, submittedReport.version));

    void verificationRequest
      .then(async (updatedReport) => {
        const verifiedReport = { ...updatedReport };
        setReports((previous) => replaceReport(previous, verifiedReport));
        setShareTargetReport(verifiedReport);

        try {
          const link = await api.createPublicLink(updatedReport.id, updatedReport.version);
          const reportWithLink = { ...verifiedReport, publicReportUrl: `${window.location.origin}/#public-${link.token}` };
          setReports((previous) => replaceReport(previous, reportWithLink));
          setShareTargetReport(reportWithLink);
          showToast(`Report #${reportWithLink.reportNumber} verified and signed.`);
        } catch {
          showToast(`Report #${verifiedReport.reportNumber} verified. Secure link will be created when shared.`);
        }
      })
      .catch((error: unknown) => showToast(error instanceof Error ? error.message : 'Unable to verify report'));
  };

  const handleApplyParsedRx = async (data: PrescriptionParseResult) => {
    if (!currentReport) return;

    const result = applyPrescriptionToReport(currentReport, testTemplates, data);
    const saved = await handleSaveReport(result.report);
    if (saved) showToast(`Prescription parsed! Loaded ${result.panelCount} test panels.`);
  };

  if (publicReportToken) return <PublicReportPage token={publicReportToken} />;

  if (authStatus === 'loading') {
    return <div className="min-h-screen bg-slate-100 flex items-center justify-center text-sm font-semibold text-slate-600">Connecting to LabPulse…</div>;
  }

  if (authStatus === 'unauthenticated') {
    return <LoginScreen onLogin={handleLogin} onOfflineUnlock={handleOfflineUnlock} offlineAvailable={offlineUnlockAvailable} error={authError} />;
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 font-sans flex flex-col selection:bg-teal-700 selection:text-white">
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900 text-white border border-teal-500 shadow-2xl rounded-xl px-4 py-3 text-xs font-semibold flex items-center gap-2.5 animate-in slide-in-from-bottom-5 duration-300">
          <div className="w-2 h-2 rounded-full bg-teal-400 animate-ping" />
          <span>{toastMessage}</span>
        </div>
      )}

      {!isOnline && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-40 rounded-full bg-amber-100 border border-amber-300 text-amber-900 px-4 py-2 text-xs font-semibold shadow-lg">
          Offline: new reports and edits are queued locally; verification and sharing require a connection.
        </div>
      )}
      {isOfflineSession && isOnline && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-40 rounded-full bg-amber-100 border border-amber-300 text-amber-900 px-4 py-2 text-xs font-semibold shadow-lg">
          Cached workspace unlocked. Reconnect to the server and sign in to revalidate this session.
        </div>
      )}
      {offlinePendingCount > 0 && isOnline && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-40 rounded-full bg-blue-100 border border-blue-300 text-blue-900 px-4 py-2 text-xs font-semibold shadow-lg">
          {offlinePendingCount} offline change{offlinePendingCount === 1 ? '' : 's'} waiting to synchronize.
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
        userName={currentUser?.name}
        onLogout={() => void handleLogout()}
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
          void api.saveLabProfile(updated)
            .then((saved) => {
              setLabProfile(saved);
              showToast('Lab profile and letterhead updated');
            })
            .catch((error: unknown) => showToast(error instanceof Error ? error.message : 'Unable to save lab profile'));
        }}
      />

      <TestCatalogModal
        isOpen={isTestCatalogModalOpen}
        onClose={() => setIsTestCatalogModalOpen(false)}
        templates={testTemplates}
        onUpdateTemplates={(updated) => {
          void api.saveTemplates(updated)
            .then((saved) => {
              setTestTemplates(saved);
              showToast('Diagnostic test catalog updated');
            })
            .catch((error: unknown) => showToast(error instanceof Error ? error.message : 'Unable to save test catalog'));
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
