import React, { useEffect, useState } from 'react';
import { 
  Search, 
  Filter, 
  MessageSquare, 
  Printer, 
  Eye, 
  Edit3, 
  PlusCircle, 
  CheckCircle2, 
  Clock, 
  FileText, 
  Download, 
  CreditCard,
  Trash2,
  Calendar,
  AlertCircle
} from 'lucide-react';
import { DiagnosticReport, LabProfile, TestTemplate } from '@/domain/types';
import type { CurrentUser } from '@/services/apiClient';
import { isClinicallyAbnormalFlag } from '@/domain/rangeEvaluator';
import { getReportTat, tatStateLabel, TatState } from '@/features/reports/tatService';
import { downloadRegistryCsv } from '@/features/patients/registryExport';

interface PatientRegistryProps {
  reports: DiagnosticReport[];
  lab: LabProfile;
  templates: TestTemplate[];
  onSelectReport: (report: DiagnosticReport) => void;
  onEditReport: (report: DiagnosticReport) => void;
  onWhatsAppShare: (report: DiagnosticReport) => void;
  onDeleteReport: (reportId: string) => void;
  onAmendReport: (report: DiagnosticReport) => void;
  onNewReport: () => void;
  canCreateReport: boolean;
  canEditReport: boolean;
  canDispatchReport: boolean;
  canArchiveReport: boolean;
  canAmendReport: boolean;
  userRole: CurrentUser['role'];
}

export const PatientRegistry: React.FC<PatientRegistryProps> = ({
  reports,
  lab,
  templates,
  onSelectReport,
  onEditReport,
  onWhatsAppShare,
  onDeleteReport,
  onAmendReport,
  onNewReport,
  canCreateReport,
  canEditReport,
  canDispatchReport,
  canArchiveReport,
  canAmendReport,
  userRole,
}) => {
  const [search, setSearch] = useState<string>('');
  const [queueFilter, setQueueFilter] = useState<'ALL' | 'MY_QUEUE'>('MY_QUEUE');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'READY_FOR_REVIEW' | 'VERIFIED' | 'DISPATCHED' | 'DRAFT'>('ALL');
  const [specimenFilter, setSpecimenFilter] = useState<'ALL' | 'ORDERED' | 'COLLECTED' | 'RECEIVED' | 'PROCESSING' | 'RESULTS_PENDING' | 'COMPLETE' | 'REJECTED'>('ALL');
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const tatByReport = new Map<string, ReturnType<typeof getReportTat>>(reports.map((report) => [report.id, getReportTat(report, templates, now)]));
  const tatAtRiskCount = reports.filter((report) => {
    const state = tatByReport.get(report.id)?.state;
    return state === 'OVERDUE' || state === 'DUE_SOON';
  }).length;

  const queueLabel = userRole === 'PATHOLOGIST'
    ? 'Reports awaiting review'
    : userRole === 'TECHNICIAN'
    ? 'Reports needing result entry'
    : userRole === 'RECEPTIONIST'
    ? 'Reports needing reception action'
    : userRole === 'VIEWER'
    ? 'Recently updated reports'
    : 'Open laboratory work';

  const isInMyQueue = (report: DiagnosticReport): boolean => {
    if (userRole === 'PATHOLOGIST') return report.status === 'READY_FOR_REVIEW';
    if (userRole === 'TECHNICIAN') return report.status === 'DRAFT' && ['RECEIVED', 'PROCESSING', 'RESULTS_PENDING'].includes(report.patient.specimenStatus);
    if (userRole === 'RECEPTIONIST') return report.status === 'DRAFT' && ['ORDERED', 'COLLECTED', 'REJECTED'].includes(report.patient.specimenStatus);
    if (userRole === 'VIEWER') return report.status !== 'ARCHIVED';
    return report.status === 'DRAFT' || report.status === 'READY_FOR_REVIEW';
  };

  const queueReports = reports.filter(isInMyQueue);

  const filteredReports = reports.filter((r) => {
    const matchesSearch =
      r.patient.name.toLowerCase().includes(search.toLowerCase()) ||
      r.patient.phone.includes(search) ||
      r.patient.uhid.toLowerCase().includes(search.toLowerCase()) ||
      r.reportNumber.toLowerCase().includes(search.toLowerCase()) ||
      r.patient.accessionNumber.toLowerCase().includes(search.toLowerCase()) ||
      r.patient.referringDoctor.toLowerCase().includes(search.toLowerCase());

    const matchesQueue = queueFilter === 'ALL' || isInMyQueue(r);
    const matchesStatus =
      statusFilter === 'ALL' || r.status === statusFilter;
    const matchesSpecimen = specimenFilter === 'ALL' || r.patient.specimenStatus === specimenFilter;

    return matchesSearch && matchesQueue && matchesStatus && matchesSpecimen;
  });

  const exportQueue = () => {
    const date = new Date().toISOString().slice(0, 10);
    downloadRegistryCsv(filteredReports, templates, `labpulse-queue-${date}.csv`);
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Top Banner & Quick Metrics - Responsive 2x2 on mobile, 4 on desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 sm:gap-4">
        <div className="bg-teal-50 p-3.5 sm:p-4 rounded-xl border border-teal-200 shadow-xs">
          <div className="flex justify-between items-center text-teal-800 text-[10px] sm:text-xs font-semibold uppercase">
            <span>My Work Queue</span>
            <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-teal-600" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-teal-900 mt-1">{queueReports.length}</div>
          <div className="text-[10px] sm:text-[11px] text-teal-700 mt-0.5 truncate">{queueLabel}</div>
        </div>

        <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex justify-between items-center text-slate-500 text-[10px] sm:text-xs font-semibold uppercase">
            <span>Patients Logged</span>
            <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-teal-600" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-900 mt-1">{reports.length}</div>
          <div className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5 truncate">Total diagnostic records</div>
        </div>

        <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex justify-between items-center text-slate-500 text-[10px] sm:text-xs font-semibold uppercase">
            <span>WhatsApp Attempts</span>
            <MessageSquare className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-emerald-700 mt-1">
            {reports.filter((r) => r.whatsAppLogs && r.whatsAppLogs.length > 0).length}
          </div>
          <div className="text-[10px] sm:text-[11px] text-emerald-600 font-medium mt-0.5 truncate">Browser dispatches recorded</div>
        </div>

        <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex justify-between items-center text-slate-500 text-[10px] sm:text-xs font-semibold uppercase">
            <span>Verified & Signed</span>
            <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-teal-600" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-teal-800 mt-1">
            {reports.filter((r) => r.status === 'VERIFIED').length}
          </div>
          <div className="text-[10px] sm:text-[11px] text-teal-600 mt-0.5 truncate">Ready for review</div>
        </div>

        <div className={`p-3.5 sm:p-4 rounded-xl border shadow-xs ${tatAtRiskCount > 0 ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-200'}`}>
          <div className={`flex justify-between items-center text-[10px] sm:text-xs font-semibold uppercase ${tatAtRiskCount > 0 ? 'text-amber-800' : 'text-slate-500'}`}>
            <span>TAT at risk</span>
            <Clock className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${tatAtRiskCount > 0 ? 'text-amber-600' : 'text-slate-400'}`} />
          </div>
          <div className={`text-xl sm:text-2xl font-black mt-1 ${tatAtRiskCount > 0 ? 'text-amber-900' : 'text-slate-900'}`}>{tatAtRiskCount}</div>
          <div className={`text-[10px] sm:text-[11px] mt-0.5 truncate ${tatAtRiskCount > 0 ? 'text-amber-700' : 'text-slate-500'}`}>Due soon or overdue</div>
        </div>

        <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex justify-between items-center text-slate-500 text-[10px] sm:text-xs font-semibold uppercase">
            <span>Billed Total (₹)</span>
            <CreditCard className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-600" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-indigo-900 mt-1 font-mono">
            ₹{reports.reduce((acc, r) => acc + (r.billing?.netAmount || 0), 0)}
          </div>
          <div className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5 truncate">Diagnostic receipts</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-3 sm:p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex-1 w-full relative">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            id="registry-search-input"
            type="text"
            placeholder="Search by Patient Name, Phone (WhatsApp), UHID, Doctor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-transparent font-medium"
          />
        </div>

        {/* Status Filter Pills & New Report Button */}
        <div className="flex flex-wrap items-center justify-between md:justify-end gap-2">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs">
            <button
              type="button"
              onClick={() => setQueueFilter('MY_QUEUE')}
              className={`px-2.5 py-1 rounded-md font-semibold text-[11px] sm:text-xs transition-all ${queueFilter === 'MY_QUEUE' ? 'bg-white text-teal-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
            >
              My queue ({queueReports.length})
            </button>
            <button
              type="button"
              onClick={() => setQueueFilter('ALL')}
              className={`px-2.5 py-1 rounded-md font-semibold text-[11px] sm:text-xs transition-all ${queueFilter === 'ALL' ? 'bg-white text-teal-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
            >
              All reports ({reports.length})
            </button>
          </div>

          <select
            id="specimen-status-filter"
            value={specimenFilter}
            onChange={(event) => setSpecimenFilter(event.target.value as typeof specimenFilter)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-[11px] sm:text-xs font-semibold text-slate-700 bg-white"
          >
            <option value="ALL">All specimens</option>
            <option value="ORDERED">Ordered</option>
            <option value="COLLECTED">Collected</option>
            <option value="RECEIVED">Received</option>
            <option value="PROCESSING">Processing</option>
            <option value="RESULTS_PENDING">Results pending</option>
            <option value="COMPLETE">Complete</option>
            <option value="REJECTED">Rejected</option>
          </select>

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs overflow-x-auto max-w-full">
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-2.5 py-1 rounded-md font-semibold text-[11px] sm:text-xs transition-all shrink-0 ${
                statusFilter === 'ALL' ? 'bg-white text-teal-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All ({reports.length})
            </button>
            <button
              onClick={() => setStatusFilter('READY_FOR_REVIEW')}
              className={`px-2.5 py-1 rounded-md font-semibold text-[11px] sm:text-xs transition-all shrink-0 ${
                statusFilter === 'READY_FOR_REVIEW' ? 'bg-white text-teal-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Review ({reports.filter((r) => r.status === 'READY_FOR_REVIEW').length})
            </button>
            <button
              onClick={() => setStatusFilter('VERIFIED')}
              className={`px-2.5 py-1 rounded-md font-semibold text-[11px] sm:text-xs transition-all shrink-0 ${
                statusFilter === 'VERIFIED' ? 'bg-white text-teal-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Verified ({reports.filter((r) => r.status === 'VERIFIED').length})
            </button>
            <button
              onClick={() => setStatusFilter('DISPATCHED')}
              className={`px-2.5 py-1 rounded-md font-semibold text-[11px] sm:text-xs transition-all shrink-0 ${
                statusFilter === 'DISPATCHED' ? 'bg-white text-teal-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Sent ({reports.filter((r) => r.status === 'DISPATCHED').length})
            </button>
            <button
              onClick={() => setStatusFilter('DRAFT')}
              className={`px-2.5 py-1 rounded-md font-semibold text-[11px] sm:text-xs transition-all shrink-0 ${
                statusFilter === 'DRAFT' ? 'bg-white text-teal-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Draft ({reports.filter((r) => r.status === 'DRAFT').length})
            </button>
          </div>

          <button
            type="button"
            onClick={exportQueue}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
            title="Download the currently filtered queue as CSV"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Export queue</span>
          </button>

          <button
            id="new-report-from-registry-btn"
            hidden={!canCreateReport}
            type="button"
            onClick={onNewReport}
            className="flex items-center gap-1.5 bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold px-3.5 py-2 rounded-lg transition-colors shadow-xs shrink-0"
          >
            <PlusCircle className="w-4 h-4" />
            <span>New Report</span>
          </button>
        </div>
      </div>

      {/* Reports Responsive Table / Card View */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse min-w-[820px]">
            <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-3 sm:px-4">Patient Name & Details</th>
                <th className="py-3 px-3 sm:px-4">UHID / Rep. No</th>
                <th className="py-3 px-3 sm:px-4">Tests Performed</th>
                <th className="py-3 px-3 sm:px-4">Referring Doctor</th>
                <th className="py-3 px-3 sm:px-4">Bill (₹)</th>
                <th className="py-3 px-3 sm:px-4">Turnaround</th>
                <th className="py-3 px-3 sm:px-4">Status</th>
                <th className="py-3 px-3 sm:px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredReports.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-slate-400 text-xs">
                    No diagnostic patient records found matching your filter criteria.
                  </td>
                </tr>
              ) : (
                filteredReports.map((report) => {
                  const hasDispatched = report.whatsAppLogs && report.whatsAppLogs.length > 0;
                  const abnormalCount = report.tests.reduce(
                    (acc, t) => acc + t.parameters.filter((p) => isClinicallyAbnormalFlag(p.flag)).length,
                    0
                  );
                  const tat = tatByReport.get(report.id);
                  const tatTone: Record<TatState, string> = {
                    NOT_STARTED: 'text-slate-500 bg-slate-50 border-slate-200',
                    ON_TRACK: 'text-emerald-700 bg-emerald-50 border-emerald-200',
                    DUE_SOON: 'text-amber-800 bg-amber-50 border-amber-200',
                    OVERDUE: 'text-rose-800 bg-rose-50 border-rose-200',
                    COMPLETED_ON_TIME: 'text-teal-800 bg-teal-50 border-teal-200',
                    COMPLETED_LATE: 'text-amber-800 bg-amber-50 border-amber-200',
                    NOT_APPLICABLE: 'text-slate-400 bg-slate-50 border-slate-200',
                  };

                  return (
                    <tr key={report.id} className="hover:bg-slate-50 transition-colors">
                      {/* Patient */}
                      <td className="py-3 px-3 sm:px-4">
                        <div className="font-bold text-slate-900 text-xs sm:text-sm">{report.patient.name}</div>
                        <div className="text-slate-500 text-[11px]">
                          {report.patient.age} {report.patient.ageUnit} • {report.patient.gender} • 📞 +91 {report.patient.phone}
                        </div>
                      </td>

                      {/* UHID */}
                      <td className="py-3 px-3 sm:px-4">
                        <span className="font-mono font-bold text-teal-800 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200 text-[10px] sm:text-[11px] block w-fit">
                          {report.patient.uhid}
                        </span>
                        <span className="text-[10px] font-mono text-slate-500 mt-0.5 block truncate max-w-[160px]">
                          {report.patient.accessionNumber}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400 mt-0.5 block truncate max-w-[120px]">
                          {report.reportNumber}
                        </span>
                      </td>

                      {/* Tests */}
                      <td className="py-3 px-3 sm:px-4 max-w-xs">
                        <div className="font-medium text-slate-800 line-clamp-1">
                          {report.tests.map((t) => t.testName).join(', ')}
                        </div>
                        {abnormalCount > 0 ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.2 rounded border border-rose-200 mt-0.5">
                            <AlertCircle className="w-3 h-3 shrink-0" />
                            {abnormalCount} Abnormal
                          </span>
                        ) : (
                          <span className="text-[10px] font-medium text-emerald-700">
                            Normal Parameters
                          </span>
                        )}
                      </td>

                      {/* Referring Doctor */}
                      <td className="py-3 px-3 sm:px-4 text-slate-700">
                        <div className="font-medium truncate max-w-[140px]">{report.patient.referringDoctor || 'Self'}</div>
                        <div className="text-[10px] text-slate-400">
                          {new Date(report.patient.sampleCollectedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                        </div>
                      </td>

                      {/* Billing */}
                      <td className="py-3 px-3 sm:px-4">
                        <div className="font-mono font-bold text-slate-900">
                          ₹{report.billing?.netAmount || 0}
                        </div>
                        <span className={`text-[10px] font-bold uppercase ${
                          report.billing?.paymentStatus === 'PAID' ? 'text-emerald-700' : 'text-amber-700'
                        }`}>
                          {report.billing?.paymentStatus || 'PAID'}
                        </span>
                      </td>

                      {/* Turnaround time */}
                      <td className="py-3 px-3 sm:px-4">
                        {tat ? (
                          <div className="space-y-1">
                            <span className={`inline-flex rounded border px-1.5 py-0.5 text-[10px] font-bold ${tatTone[tat.state]}`}>
                              {tatStateLabel(tat.state)}
                            </span>
                            <div className="text-[10px] text-slate-500">Target: {tat.hours < 1 ? `${Math.round(tat.hours * 60)} min` : `${tat.hours} hr${tat.hours === 1 ? '' : 's'}`}</div>
                            {tat.dueAt && tat.state !== 'COMPLETED_ON_TIME' && tat.state !== 'COMPLETED_LATE' && (
                              <div className="text-[10px] text-slate-400">Due {new Date(tat.dueAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</div>
                            )}
                          </div>
                        ) : <span className="text-[10px] text-slate-400">Not configured</span>}
                      </td>

                      {/* Status & WhatsApp Log */}
                      <td className="py-3 px-3 sm:px-4">
                        <div className="flex flex-col gap-1 items-start">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-teal-100 text-teal-800">
                            <CheckCircle2 className="w-3 h-3 shrink-0" /> {report.status}
                          </span>
                          {hasDispatched ? (
                            <span className="text-[10px] font-semibold text-emerald-700 flex items-center gap-1">
                              <MessageSquare className="w-3 h-3 text-emerald-600 shrink-0" />
                              WhatsApp Attempted
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400">No WhatsApp attempt</span>
                          )}
                          <span className={`text-[10px] font-semibold ${report.patient.specimenStatus === 'REJECTED' ? 'text-rose-700' : 'text-slate-500'}`}>
                            Specimen: {report.patient.specimenStatus || 'ORDERED'}
                          </span>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-3 sm:px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Instant WhatsApp Share */}
                          <button
                            id={`wa-share-btn-${report.id}`}
                            hidden={!canDispatchReport}
                            type="button"
                            onClick={() => onWhatsAppShare(report)}
                            title="Share Report to Patient on WhatsApp"
                            className="p-1.5 text-emerald-700 hover:bg-emerald-50 rounded-lg border border-emerald-300 transition-colors"
                          >
                            <MessageSquare className="w-4 h-4" />
                          </button>

                          {/* View / Print */}
                          <button
                            id={`view-report-btn-${report.id}`}
                            type="button"
                            onClick={() => onSelectReport(report)}
                            title="View & Print Diagnostic Document"
                            className="p-1.5 text-teal-700 hover:bg-teal-50 rounded-lg border border-teal-300 transition-colors"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {/* Edit Report */}
                          <button
                            id={`edit-report-btn-${report.id}`}
                            hidden={!canEditReport}
                            type="button"
                            onClick={() => onEditReport(report)}
                            title="Edit Report Values"
                            className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>

                          {/* Create a controlled correction from a released report */}
                          <button
                            id={`amend-report-btn-${report.id}`}
                            hidden={!canAmendReport || !['VERIFIED', 'DISPATCHED'].includes(report.status)}
                            type="button"
                            onClick={() => onAmendReport(report)}
                            title="Create amended report"
                            className="p-1.5 text-amber-700 hover:bg-amber-50 rounded-lg border border-amber-200 transition-colors"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>

                          {/* Delete */}
                          <button
                            id={`delete-report-btn-${report.id}`}
                            hidden={!canArchiveReport}
                            type="button"
                            onClick={() => {
                              if (window.confirm(`Delete lab report for ${report.patient.name}?`)) {
                                onDeleteReport(report.id);
                              }
                            }}
                            title="Delete Record"
                            className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg border border-rose-200 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
