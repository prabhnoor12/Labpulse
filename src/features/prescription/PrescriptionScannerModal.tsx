import React, { useState } from 'react';
import { 
  X, 
  Sparkles, 
  FileText, 
  Check, 
  Loader2, 
  Stethoscope, 
  CheckCircle2, 
  AlertCircle 
} from 'lucide-react';
import { standardTestTemplates } from '@/data/defaultTemplates';
import { parseDoctorPrescription, PrescriptionParseResult } from '@/services/aiService';

interface PrescriptionScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyParsedData: (data: PrescriptionParseResult) => void;
}

export const PrescriptionScannerModal: React.FC<PrescriptionScannerModalProps> = ({
  isOpen,
  onClose,
  onApplyParsedData,
}) => {
  const [rxText, setRxText] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PrescriptionParseResult | null>(null);

  if (!isOpen) return null;

  const handleParse = async () => {
    if (!rxText.trim()) return;
    setLoading(true);
    setError(null);

    try {
      setResult(await parseDoctorPrescription(rxText));
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Error parsing requisition notes');
    } finally {
      setLoading(false);
    }
  };

  const handleApply = () => {
    if (!result) return;
    onApplyParsedData({
      suggestedTestIds: result.suggestedTestIds || [],
      patientName: result.patientName,
      patientAge: result.patientAge,
      patientGender: result.patientGender,
      doctorName: result.doctorName,
      fastingRequired: result.fastingRequired,
      specialInstructions: result.specialInstructions,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-slate-900 text-white px-4 sm:px-6 py-3.5 sm:py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-600 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold truncate">AI Doctor Prescription & Requisition Extractor</h3>
              <p className="text-[11px] text-slate-400 truncate">Paste doctor handwritten transcription or typed notes to auto-select tests</p>
            </div>
          </div>
          <button
            id="close-rx-scanner-modal-btn"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1 text-xs">
          {/* Textarea */}
          <div>
            <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Paste Doctor Prescription / Test Order Notes
            </label>
            <textarea
              id="doctor-rx-textarea"
              rows={5}
              value={rxText}
              onChange={(e) => setRxText(e.target.value)}
              placeholder="Paste the prescription or requisition notes here"
              className="w-full p-2.5 sm:p-3 border border-slate-300 rounded-lg text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-transparent leading-relaxed"
            />
          </div>

          {/* Action to Parse */}
          <div className="flex justify-end">
            <button
              id="btn-run-ai-rx-parse"
              type="button"
              disabled={loading || !rxText.trim()}
              onClick={handleParse}
              className="flex items-center gap-2 bg-teal-700 hover:bg-teal-800 disabled:bg-slate-300 text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Extracting Diagnostic Tests...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Parse Requisition with AI</span>
                </>
              )}
            </button>
          </div>

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Parsed Result Display */}
          {result && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 sm:p-4 space-y-3">
              <div className="flex items-center gap-2 text-emerald-900 font-bold text-xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Extracted Lab Order Details:</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                <div className="bg-white p-2 rounded border border-emerald-100">
                  <span className="text-[10px] text-slate-500 font-bold uppercase block">Patient Name</span>
                  <span className="font-semibold text-slate-900">{result.patientName || 'Not specified'}</span>
                </div>
                <div className="bg-white p-2 rounded border border-emerald-100">
                  <span className="text-[10px] text-slate-500 font-bold uppercase block">Age / Gender</span>
                  <span className="font-semibold text-slate-900">
                    {result.patientAge ? `${result.patientAge} Yrs` : '-'} / {result.patientGender || '-'}
                  </span>
                </div>
                <div className="bg-white p-2 rounded border border-emerald-100">
                  <span className="text-[10px] text-slate-500 font-bold uppercase block">Referring Doctor</span>
                  <span className="font-semibold text-slate-900">{result.doctorName || 'Self / Consulting'}</span>
                </div>
              </div>

              <div>
                <span className="text-[10px] text-slate-600 font-bold uppercase tracking-wider block mb-1">
                  Detected Test Panels ({result.suggestedTestIds?.length || 0}):
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {result.suggestedTestIds?.map((tid: string) => {
                    const match = standardTestTemplates.find((t) => t.id === tid || t.code.toLowerCase().includes(tid.toLowerCase()));
                    return (
                      <span key={tid} className="bg-emerald-200 text-emerald-900 font-bold text-[11px] sm:text-xs px-2.5 py-1 rounded-md">
                        {match ? match.name : tid.toUpperCase()}
                      </span>
                    );
                  })}
                </div>
              </div>

              {result.specialInstructions && (
                <div className="text-xs text-emerald-800 bg-white p-2 rounded border border-emerald-100 italic">
                  <strong>Instructions: </strong>{result.specialInstructions}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 border-t border-slate-200 px-4 sm:px-6 py-3.5 flex items-center justify-between shrink-0">
          <button
            id="cancel-rx-scanner-btn"
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-lg text-xs font-semibold"
          >
            Cancel
          </button>
          <button
            id="apply-rx-scanner-btn"
            type="button"
            disabled={!result}
            onClick={handleApply}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white px-4 sm:px-5 py-2 rounded-lg text-xs font-bold transition-colors shadow-xs"
          >
            <Check className="w-4 h-4" />
            <span>Apply to Lab Report</span>
          </button>
        </div>
      </div>
    </div>
  );
};
