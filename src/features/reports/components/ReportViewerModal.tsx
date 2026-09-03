import React, { useState } from 'react';
import { 
  X, 
  Printer, 
  MessageCircle, 
  Download, 
  ArrowLeft, 
  CheckCircle2, 
  ShieldCheck, 
  Sparkles,
  Layers,
  FileCheck
} from 'lucide-react';
import { DiagnosticReport, LabProfile } from '@/domain/types';
import { DiagnosticReportDocument } from './DiagnosticReportDocument';

interface ReportViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  report: DiagnosticReport;
  lab: LabProfile;
  onWhatsAppShare: () => void;
  onVerifyAndSign: () => void;
}

export const ReportViewerModal: React.FC<ReportViewerModalProps> = ({
  isOpen,
  onClose,
  report,
  lab,
  onWhatsAppShare,
  onVerifyAndSign,
}) => {
  const [showWatermark, setShowWatermark] = useState<boolean>(lab.showWatermark);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/80 backdrop-blur-xs overflow-y-auto">
      <div className="bg-slate-100 rounded-2xl shadow-2xl max-w-5xl w-full my-auto overflow-hidden border border-slate-300 flex flex-col max-h-[96vh]">
        {/* Top Control Bar - Responsive Flex/Wrap */}
        <div className="bg-slate-900 text-white px-3 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-2.5 shrink-0 print:hidden">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-1 text-xs shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden xs:inline">Back</span>
            </button>
            <div className="border-l border-slate-700 pl-2 sm:pl-3 min-w-0">
              <span className="font-bold text-xs sm:text-sm text-white truncate block">{report.patient.name}</span>
              <span className="text-[10px] sm:text-xs text-slate-400 font-mono truncate block">({report.reportNumber})</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap ml-auto">
            {/* Watermark toggle */}
            <label className="hidden sm:flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer mr-1">
              <input
                type="checkbox"
                checked={showWatermark}
                onChange={(e) => setShowWatermark(e.target.checked)}
                className="w-3.5 h-3.5 text-teal-600 rounded"
              />
              <span>Watermark</span>
            </label>

            {/* Verify & Sign status */}
            {report.status !== 'VERIFIED' && report.status !== 'DISPATCHED' && (
              <button
                id="btn-verify-and-sign-doc"
                type="button"
                onClick={onVerifyAndSign}
                className="flex items-center gap-1 bg-teal-700 hover:bg-teal-800 text-white text-[11px] sm:text-xs font-bold px-2.5 sm:px-3 py-1.5 rounded-lg transition-colors"
              >
                <FileCheck className="w-3.5 h-3.5 text-teal-200" />
                <span className="hidden sm:inline">Verify & Sign</span>
                <span className="sm:hidden">Sign</span>
              </button>
            )}

            {/* Print A4 / Save PDF */}
            <button
              id="btn-print-from-viewer"
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-teal-300 text-[11px] sm:text-xs font-bold px-2.5 sm:px-3 py-1.5 rounded-lg border border-slate-700 transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Print / PDF</span>
              <span className="sm:hidden">Print</span>
            </button>

            {/* WhatsApp Share */}
            <button
              id="btn-whatsapp-from-viewer"
              type="button"
              onClick={onWhatsAppShare}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] sm:text-xs font-bold px-3 sm:px-4 py-1.5 rounded-lg transition-colors shadow-xs"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>WhatsApp</span>
            </button>

            <button
              id="close-viewer-btn"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Document Scroll Area */}
        <div className="p-2 sm:p-6 md:p-8 overflow-y-auto flex-1 flex justify-center bg-slate-200 print:bg-white print:p-0">
          <DiagnosticReportDocument
            report={report}
            lab={lab}
            showHeaderWatermark={showWatermark}
          />
        </div>
      </div>
    </div>
  );
};
