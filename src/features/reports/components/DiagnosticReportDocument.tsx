import React, { useEffect, useState } from 'react';
import { 
  ShieldCheck, 
  Award, 
  Phone, 
  Mail, 
  MapPin, 
  CheckCircle2, 
  AlertTriangle,
  QrCode,
  Calendar,
  User,
  Activity
} from 'lucide-react';
import { DiagnosticReport, LabProfile } from '@/domain/types';
import { generateQrDataUrl } from '@/services/qrService';

interface DiagnosticReportDocumentProps {
  report: DiagnosticReport;
  lab: LabProfile;
  showHeaderWatermark?: boolean;
  isCompact?: boolean;
}

export const DiagnosticReportDocument: React.FC<DiagnosticReportDocumentProps> = ({
  report,
  lab,
  showHeaderWatermark = true,
  isCompact = false,
}) => {
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');

  const patient = report.patient;
  const signatory = lab.signatories.find((s) => s.id === report.selectedSignatoryId) || lab.signatories[0];
  const isFinalReport = report.status === 'VERIFIED' || report.status === 'DISPATCHED';
  const reportStatusLabel = report.status === 'READY_FOR_REVIEW'
    ? 'AWAITING PATHOLOGIST REVIEW - NOT FINAL'
    : report.status === 'SUPERSEDED'
      ? 'SUPERSEDED - DO NOT USE'
      : report.status === 'ARCHIVED'
        ? 'ARCHIVED - DO NOT USE'
        : 'DRAFT - NOT FOR CLINICAL USE';

  useEffect(() => {
    const verifyUrl = report.publicReportUrl;
    if (!verifyUrl) {
      setQrCodeUrl('');
      return;
    }
    let active = true;
    generateQrDataUrl(verifyUrl).then((url) => {
      if (active) setQrCodeUrl(url);
    });
    return () => { active = false; };
  }, [report.publicReportUrl, report.reportNumber]);

  return (
    <div 
      id={`diagnostic-report-${report.reportNumber}`}
      className="bg-white text-slate-900 mx-auto w-full max-w-[840px] p-6 sm:p-8 md:p-10 shadow-lg print:shadow-none border border-slate-200 print:border-none print:p-4 rounded-xl relative overflow-hidden font-sans text-xs leading-relaxed"
    >
      {/* Background Watermark */}
      {lab.showWatermark && showHeaderWatermark && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.03] select-none z-0">
          <div className="text-center transform -rotate-45 text-slate-900 font-extrabold text-5xl tracking-widest uppercase">
            {lab.watermarkText || lab.name}
          </div>
        </div>
      )}

      {!isFinalReport && (
        <div className="relative z-10 mb-3 rounded border-2 border-amber-500 bg-amber-50 px-3 py-2 text-center text-[11px] font-extrabold tracking-wide text-amber-900 print:border-amber-700 print:bg-amber-50">
          {reportStatusLabel}
        </div>
      )}

      {/* 1. Header & Letterhead */}
      <header className="border-b-2 border-teal-800 pb-4 mb-4 relative z-10">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xl sm:text-2xl font-black text-teal-900 tracking-tight uppercase">
                {lab.name}
              </span>
            </div>
            <p className="text-xs text-teal-700 font-semibold mb-1">
              {lab.tagline}
            </p>
            <div className="text-[11px] text-slate-600 flex flex-wrap gap-x-3 gap-y-0.5">
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3 text-slate-400" />
                {lab.addressLine1}, {lab.city} - {lab.pincode}
              </span>
              <span className="flex items-center gap-1">
                <Phone className="w-3 h-3 text-slate-400" />
                {lab.phone} / {lab.whatsapp}
              </span>
              <span className="flex items-center gap-1">
                <Mail className="w-3 h-3 text-slate-400" />
                {lab.email}
              </span>
            </div>
          </div>

          {/* Accreditation Badges & QR Code */}
          <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
            <div className="text-right hidden sm:block">
              <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 border border-emerald-300 rounded text-[10px] font-bold text-emerald-800 uppercase tracking-wide">
                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                {lab.accreditations[0] || 'Accreditation not configured'}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                Reg: {lab.regNumber}
              </div>
            </div>

            {qrCodeUrl && (
              <div className="bg-white p-1 border border-slate-300 rounded shadow-2xs text-center">
                <img 
                  src={qrCodeUrl} 
                  alt="Scan to Verify Report" 
                  className="w-16 h-16 object-contain"
                />
                <span className="text-[8px] text-slate-500 font-mono block">Scan to Verify</span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* 2. Patient Demographics & Requisition Box */}
      <section className="bg-slate-50 border border-slate-300 rounded-lg p-3 mb-5 relative z-10">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px]">
          <div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Patient Name</span>
            <span className="font-bold text-slate-900 text-xs sm:text-sm">{patient.name}</span>
            <div className="text-slate-600 text-[10px]">
              {patient.age} {patient.ageUnit} / {patient.gender}
            </div>
          </div>

          <div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">UHID / Lab No.</span>
            <span className="font-mono font-bold text-teal-800">{patient.uhid}</span>
            <div className="text-slate-600 text-[10px] font-mono">
              Rep ID: {report.reportNumber}
            </div>
          </div>

          <div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Referred By</span>
            <span className="font-semibold text-slate-800 line-clamp-1">{patient.referringDoctor || 'Self'}</span>
            <div className="text-slate-600 text-[10px]">
              Sample: {patient.sampleType.split('(')[0]}
            </div>
          </div>

          <div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Timestamps</span>
            <div className="text-slate-700 text-[10px]">
              <span className="font-medium">Coll:</span> {new Date(patient.sampleCollectedAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </div>
            <div className="text-slate-700 text-[10px]">
              <span className="font-medium">Rep:</span> {new Date(patient.reportGeneratedAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        </div>

        {/* Barcode Strip */}
        <div className="mt-2 pt-2 border-t border-slate-200 flex items-center justify-between text-[10px] text-slate-600">
          <div className="flex items-center gap-2 font-mono">
            <span className="bg-slate-200 px-1.5 py-0.5 rounded text-slate-800 font-bold">||||| | |||| ||| ||||</span>
            <span>{patient.sampleBarcode}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-medium text-slate-500">Fasting Status:</span>
            <span className="font-semibold text-slate-800">{patient.fastingStatus}</span>
          </div>
        </div>
      </section>

      {/* 3. Diagnostic Test Panels & Results */}
      <main className="space-y-6 mb-6 relative z-10">
        {report.tests.map((testPanel, panelIdx) => (
          <div key={testPanel.id || panelIdx} className="test-panel-block">
            {/* Test Header */}
            <div className="bg-teal-900 text-white px-3 py-1.5 rounded-t-md flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="w-3.5 h-3.5 text-teal-300" />
                <h3 className="font-bold text-xs uppercase tracking-wide">
                  {testPanel.testName}
                </h3>
              </div>
              <div className="text-[10px] text-teal-200 font-mono">
                {testPanel.category}
              </div>
            </div>

            {/* Test Results Table */}
            <table className="w-full border-collapse border border-slate-300 text-left text-[11px]">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-300 text-slate-700 font-bold text-[10px] uppercase">
                  <th className="py-1.5 px-3 w-5/12">Investigation Parameter</th>
                  <th className="py-1.5 px-3 w-2/12 text-center">Observed Value</th>
                  <th className="py-1.5 px-3 w-2/12">Units</th>
                  <th className="py-1.5 px-3 w-3/12">Biological Ref. Interval</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {testPanel.parameters.map((param) => {
                  const isHigh = param.flag === 'HIGH' || param.flag === 'CRITICAL_HIGH';
                  const isLow = param.flag === 'LOW' || param.flag === 'CRITICAL_LOW';
                  const isAbnormal = isHigh || isLow;

                  return (
                    <tr 
                      key={param.id} 
                      className={`hover:bg-slate-50/50 ${
                        param.flag === 'CRITICAL_HIGH' || param.flag === 'CRITICAL_LOW'
                          ? 'bg-rose-50/80 font-semibold'
                          : isAbnormal
                          ? 'bg-amber-50/50'
                          : ''
                      }`}
                    >
                      <td className="py-1.5 px-3">
                        <div className="font-medium text-slate-900">
                          {param.subCategory && (
                            <span className="text-[9px] text-slate-500 block uppercase">
                              {param.subCategory}
                            </span>
                          )}
                          {param.name}
                        </div>
                        {param.method && (
                          <span className="text-[9px] text-slate-500 font-normal italic">
                            Method: {param.method}
                          </span>
                        )}
                      </td>

                      <td className="py-1.5 px-3 text-center">
                        <div className="inline-flex items-center gap-1 font-bold">
                          <span 
                            className={`text-xs ${
                              isHigh
                                ? 'text-rose-700'
                                : isLow
                                ? 'text-blue-700'
                                : 'text-slate-900'
                            }`}
                          >
                            {param.value || '-'}
                          </span>
                          {isHigh && (
                            <span className="text-[10px] font-extrabold text-rose-600 bg-rose-100 px-1 py-0.2 rounded" title="High / Elevated">
                              H ↑
                            </span>
                          )}
                          {isLow && (
                            <span className="text-[10px] font-extrabold text-blue-600 bg-blue-100 px-1 py-0.2 rounded" title="Low / Subnormal">
                              L ↓
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-1.5 px-3 text-slate-600 font-mono text-[10px]">
                        {param.unit || '-'}
                      </td>

                      <td className="py-1.5 px-3 text-slate-700 font-mono text-[10px]">
                        {param.refRange}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Test Interpretation / Notes if present */}
            {testPanel.clinicalInterpretation && (
              <div className="bg-slate-50 p-2 text-[10px] text-slate-600 border-x border-b border-slate-300 rounded-b-md italic">
                <span className="font-semibold not-italic text-slate-700">Clinical Notes: </span>
                {testPanel.clinicalInterpretation}
              </div>
            )}
          </div>
        ))}
      </main>

      {/* 4. Clinical Impression & Pathologist Observations */}
      {(report.clinicalImpression || report.pathologistNotes) && (
        <section className="mb-6 border border-teal-200 bg-teal-50/50 rounded-lg p-3.5 relative z-10">
          <div className="flex items-center gap-2 mb-2 text-teal-900 font-bold text-xs uppercase tracking-wide">
            <CheckCircle2 className="w-4 h-4 text-teal-700" />
            <span>Consultant Pathologist Clinical Impression & Comments</span>
          </div>
          
          {report.clinicalImpression && (
            <p className="text-slate-800 font-medium text-[11px] mb-2 leading-relaxed">
              {report.clinicalImpression}
            </p>
          )}

          {report.pathologistNotes && (
            <p className="text-slate-600 text-[10px] border-t border-teal-200 pt-2 italic">
              <strong className="text-slate-700 not-italic">Technical Remarks: </strong>
              {report.pathologistNotes}
            </p>
          )}
        </section>
      )}

      {/* 5. Bilingual Patient Takeaway (English & Hindi) */}
      {(report.patientSummaryEn || report.patientSummaryHi) && (
        <section className="mb-6 bg-slate-100/80 border border-slate-300 rounded-lg p-3 text-[11px] relative z-10 print:border-slate-300">
          <div className="font-bold text-slate-800 text-[10px] uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            <span>Patient Guidance & Summary (मरीज के लिए सरल सारांश)</span>
          </div>
          {report.patientSummaryEn && (
            <p className="text-slate-700 mb-1">
              <strong>Summary (EN):</strong> {report.patientSummaryEn}
            </p>
          )}
          {report.patientSummaryHi && (
            <p className="text-slate-700 font-hindi">
              <strong>सरल भाषा (HI):</strong> {report.patientSummaryHi}
            </p>
          )}
        </section>
      )}

      {/* 6. Signatory Authorities & Authentication Footer */}
      <footer className="pt-4 border-t-2 border-slate-300 relative z-10">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 items-end mb-4">
          {/* Technologist */}
          <div className="text-center sm:text-left">
            <div className="h-10 flex items-center justify-center sm:justify-start">
              <span className="font-serif italic text-slate-500 font-medium text-xs">{lab.technologistName || 'Laboratory Technologist'}</span>
            </div>
            <div className="border-t border-slate-400 pt-1">
              <div className="font-bold text-slate-800 text-[11px]">{lab.technologistName}</div>
              <div className="text-[10px] text-slate-500">{lab.technologistDegrees}</div>
            </div>
          </div>

          {/* Stamp / Verified Badge */}
          <div className="text-center hidden sm:flex flex-col items-center justify-center">
            <div className={`w-16 h-16 rounded-full border-2 border-dashed flex flex-col items-center justify-center p-1 transform rotate-[-8deg] ${
              isFinalReport ? 'border-teal-600 bg-teal-50/30' : 'border-amber-600 bg-amber-50/60'
            }`}>
              <ShieldCheck className={`w-5 h-5 ${isFinalReport ? 'text-teal-700' : 'text-amber-700'}`} />
              <span className={`text-[7px] font-extrabold uppercase tracking-tighter text-center leading-tight ${
                isFinalReport ? 'text-teal-800' : 'text-amber-800'
              }`}>
                {isFinalReport ? <>{lab.name || 'LABORATORY'}<br/>VERIFIED</> : reportStatusLabel}
              </span>
            </div>
          </div>

          {/* Consultant Pathologist */}
          <div className="text-center sm:text-right">
            <div className="h-10 flex items-center justify-center sm:justify-end">
              <span className="font-serif italic text-teal-900 font-bold text-sm tracking-wide">
                {signatory?.signatureText || signatory?.name || 'Authorized signatory'}
              </span>
            </div>
            <div className="border-t border-slate-400 pt-1">
              <div className="font-bold text-slate-900 text-[11px]">{signatory?.name || 'Not configured'}</div>
              <div className="text-[10px] text-teal-800 font-medium">{signatory?.degrees}</div>
              <div className="text-[9px] text-slate-500">Reg: {signatory?.regNumber}</div>
            </div>
          </div>
        </div>

        {/* Bottom Disclaimer */}
        <div className="text-[9px] text-slate-500 text-center border-t border-slate-200 pt-2 leading-tight">
          <p>{lab.footerDisclaimer}</p>
          <div className="mt-1 text-slate-400 font-mono text-[8px] flex items-center justify-between">
            <span>Report Generated electronically on: {new Date(report.updatedAt || report.createdAt).toLocaleString('en-IN')}</span>
            <span>LabPulse India System</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
