import React, { useState } from 'react';
import { 
  X, 
  MessageSquare, 
  Send, 
  Check, 
  Copy, 
  ExternalLink, 
  FileText, 
  Sparkles, 
  Clock, 
  Download,
  Share2,
  PhoneCall
} from 'lucide-react';
import { DiagnosticReport, LabProfile } from '../types';
import { generateWhatsAppMessage, openWhatsAppChat } from '../utils/whatsappHelper';

interface WhatsAppShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  report: DiagnosticReport;
  lab: LabProfile;
  onReportDispatched?: (templateType: string) => void;
  onRecordDispatch?: (channel: 'DIRECT_WHATSAPP' | 'WA_WEB' | 'SMS') => void;
}

export const WhatsAppShareModal: React.FC<WhatsAppShareModalProps> = ({
  isOpen,
  onClose,
  report,
  lab,
  onReportDispatched,
  onRecordDispatch,
}) => {
  const [recipientPhone, setRecipientPhone] = useState<string>(report.patient.phone || '');
  const [templateType, setTemplateType] = useState<'standard' | 'detailed' | 'urgent' | 'hindi'>('standard');
  const [includeInterpretation, setIncludeInterpretation] = useState<boolean>(true);
  const [includeUPIReceipt, setIncludeUPIReceipt] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);
  const [showQrCode, setShowQrCode] = useState<boolean>(false);
  const [sendSuccess, setSendSuccess] = useState<boolean>(false);

  if (!isOpen) return null;

  const currentMessage = generateWhatsAppMessage(report, lab, {
    templateType,
    includeInterpretation,
    includeUPIReceipt,
  });

  const cleanPhone = recipientPhone.replace(/\D/g, '');
  const fullPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
  const encodedText = encodeURIComponent(currentMessage);
  const waUrl = `https://wa.me/${fullPhone}?text=${encodedText}`;
  const waWebUrl = `https://web.whatsapp.com/send?phone=${fullPhone}&text=${encodedText}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(waUrl)}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(currentMessage);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleSendDirectWhatsApp = () => {
    try {
      window.open(waUrl, '_blank', 'noopener,noreferrer');
    } catch {
      window.location.href = waUrl;
    }
    if (onReportDispatched) {
      onReportDispatched(templateType);
    }
    if (onRecordDispatch) {
      onRecordDispatch('DIRECT_WHATSAPP');
    }
    setSendSuccess(true);
    setTimeout(() => {
      setSendSuccess(false);
      onClose();
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200 flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="bg-emerald-700 text-white px-4 sm:px-6 py-3.5 sm:py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-800 flex items-center justify-center shrink-0">
              <MessageSquare className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold truncate">Instant WhatsApp Diagnostic Report Dispatch</h3>
              <p className="text-[11px] text-emerald-100 truncate">Deliver report link, abnormal alerts & UPI receipt</p>
            </div>
          </div>
          <button
            id="close-whatsapp-modal-btn"
            onClick={onClose}
            className="p-1.5 text-emerald-100 hover:text-white hover:bg-emerald-800 rounded-lg transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body - Scrollable */}
        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1 text-xs">
          {/* Recipient Information */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
              <span className="font-bold text-slate-800 text-[11px] uppercase tracking-wider">
                Patient Contact & WhatsApp Destination
              </span>
              <span className="text-[11px] text-slate-500 font-mono">
                UHID: {report.patient.uhid}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-slate-500 font-bold uppercase block mb-1">
                  Recipient Name
                </label>
                <div className="font-bold text-slate-900 text-sm">
                  {report.patient.name} ({report.patient.age} {report.patient.ageUnit}, {report.patient.gender})
                </div>
              </div>

              <div>
                <label className="text-[10px] text-slate-500 font-bold uppercase block mb-1">
                  WhatsApp Number (+91 India)
                </label>
                <div className="flex">
                  <span className="bg-slate-200 border border-r-0 border-slate-300 px-2.5 py-1.5 text-slate-700 rounded-l-lg font-bold font-mono text-xs">
                    +91
                  </span>
                  <input
                    id="whatsapp-phone-input"
                    type="tel"
                    value={recipientPhone}
                    onChange={(e) => setRecipientPhone(e.target.value)}
                    placeholder="9810123456"
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-r-lg font-mono font-bold text-emerald-950 focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Template Configuration Pills */}
          <div>
            <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              WhatsApp Message Template Style
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => setTemplateType('standard')}
                className={`p-2 rounded-lg border text-left transition-all ${
                  templateType === 'standard'
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-900 font-bold shadow-2xs'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700 font-medium'
                }`}
              >
                <div className="text-xs">Standard</div>
                <div className="text-[10px] text-slate-500 mt-0.5">Link + Key info</div>
              </button>

              <button
                type="button"
                onClick={() => setTemplateType('detailed')}
                className={`p-2 rounded-lg border text-left transition-all ${
                  templateType === 'detailed'
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-900 font-bold shadow-2xs'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700 font-medium'
                }`}
              >
                <div className="text-xs">Detailed</div>
                <div className="text-[10px] text-slate-500 mt-0.5">Parameters breakdown</div>
              </button>

              <button
                type="button"
                onClick={() => setTemplateType('hindi')}
                className={`p-2 rounded-lg border text-left transition-all ${
                  templateType === 'hindi'
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-900 font-bold shadow-2xs'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700 font-medium'
                }`}
              >
                <div className="text-xs font-hindi">हिंदी (Hindi)</div>
                <div className="text-[10px] text-slate-500 mt-0.5">सरल भाषा संदेश</div>
              </button>

              <button
                type="button"
                onClick={() => setTemplateType('urgent')}
                className={`p-2 rounded-lg border text-left transition-all ${
                  templateType === 'urgent'
                    ? 'border-rose-600 bg-rose-50 text-rose-900 font-bold shadow-2xs'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700 font-medium'
                }`}
              >
                <div className="text-xs text-rose-700 font-bold">Critical Alert</div>
                <div className="text-[10px] text-slate-500 mt-0.5">Abnormal flag alert</div>
              </button>
            </div>
          </div>

          {/* Toggle Switches & QR Code */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <label className="flex items-center gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer">
              <input
                type="checkbox"
                checked={includeInterpretation}
                onChange={(e) => setIncludeInterpretation(e.target.checked)}
                className="w-4 h-4 text-emerald-600 rounded"
              />
              <span className="text-[11px] text-slate-800 font-medium">
                Include Doctor Diagnostic Impression & Highlights
              </span>
            </label>

            <label className="flex items-center gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer">
              <input
                type="checkbox"
                checked={includeUPIReceipt}
                onChange={(e) => setIncludeUPIReceipt(e.target.checked)}
                className="w-4 h-4 text-emerald-600 rounded"
              />
              <span className="text-[11px] text-slate-800 font-medium">
                Include Payment / Billing Summary & Lab Contact
              </span>
            </label>
          </div>

          {/* Quick QR & WhatsApp Web bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-emerald-50/70 border border-emerald-200 rounded-lg">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-emerald-900">Delivery Channels:</span>
              <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => {
                  if (onReportDispatched) onReportDispatched(templateType);
                  if (onRecordDispatch) onRecordDispatch('DIRECT_WHATSAPP');
                }}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-white border border-emerald-300 px-2 py-1 rounded hover:bg-emerald-100 transition-colors"
              >
                <ExternalLink className="w-3 h-3" />
                <span>wa.me Link</span>
              </a>
              <a
                href={waWebUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => {
                  if (onReportDispatched) onReportDispatched(templateType);
                  if (onRecordDispatch) onRecordDispatch('WA_WEB');
                }}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-white border border-emerald-300 px-2 py-1 rounded hover:bg-emerald-100 transition-colors"
              >
                <ExternalLink className="w-3 h-3" />
                <span>WhatsApp Web</span>
              </a>
            </div>

            <button
              type="button"
              onClick={() => setShowQrCode(!showQrCode)}
              className="text-[11px] font-bold text-emerald-800 underline hover:text-emerald-950"
            >
              {showQrCode ? 'Hide QR Code' : 'Show WhatsApp QR Code'}
            </button>
          </div>

          {showQrCode && (
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 p-4 bg-white border border-emerald-200 rounded-xl shadow-xs">
              <img
                src={qrUrl}
                alt="WhatsApp QR Code"
                className="w-32 h-32 border border-slate-200 rounded-lg"
                referrerPolicy="no-referrer"
              />
              <div className="text-center sm:text-left">
                <div className="font-bold text-slate-800 text-xs">Scan to Send WhatsApp Directly</div>
                <p className="text-[11px] text-slate-500 max-w-xs mt-0.5">
                  Scan this QR code from any smartphone camera to open WhatsApp with pre-filled report message.
                </p>
              </div>
            </div>
          )}

          {/* WhatsApp Message Preview Bubble */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                Live WhatsApp Message Preview (Patient View)
              </span>
              <button
                type="button"
                onClick={handleCopy}
                className="flex items-center gap-1 text-[11px] text-emerald-700 hover:text-emerald-800 font-semibold"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied Message!' : 'Copy Text'}</span>
              </button>
            </div>

            <div className="bg-[#EFEAE2] p-3.5 rounded-xl border border-slate-300 font-sans shadow-inner max-h-48 sm:max-h-56 overflow-y-auto">
              {/* WhatsApp chat bubble */}
              <div className="bg-white p-3 rounded-lg shadow-xs text-xs text-slate-900 whitespace-pre-wrap leading-relaxed max-w-lg font-mono">
                {currentMessage}
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="bg-slate-50 border-t border-slate-200 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-lg text-xs font-semibold"
          >
            Cancel
          </button>

          <div className="flex items-center gap-2 ml-auto">
            <button
              id="copy-whatsapp-text-btn"
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1 bg-slate-200 hover:bg-slate-300 text-slate-800 px-3 py-2 rounded-lg text-xs font-semibold transition-colors"
            >
              <Copy className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Copy Text</span>
            </button>

            <button
              id="send-whatsapp-now-btn"
              type="button"
              onClick={handleSendDirectWhatsApp}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-4 sm:px-5 py-2 rounded-lg text-xs font-extrabold transition-all shadow-xs"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Send via WhatsApp (+91)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
