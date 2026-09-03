import React, { useEffect, useState } from 'react';
import { AlertCircle, Loader2, ShieldCheck } from 'lucide-react';
import { defaultLabProfile } from '@/config/defaultLabProfile';
import { DiagnosticReport, LabProfile } from '@/domain/types';
import { DiagnosticReportDocument } from './components/DiagnosticReportDocument';
import { apiClient, PublicReportResponse, toDiagnosticReport } from '@/services/apiClient';

interface PublicReportPageProps {
  token: string;
}

export const PublicReportPage: React.FC<PublicReportPageProps> = ({ token }) => {
  const [report, setReport] = useState<DiagnosticReport | null>(null);
  const [lab, setLab] = useState<LabProfile>(defaultLabProfile);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    apiClient.publicReport(token)
      .then(({ report: publicReport }: { report: PublicReportResponse }) => {
        if (!active) return;
        setReport(toDiagnosticReport(publicReport));
        setLab({
          ...defaultLabProfile,
          ...publicReport.lab,
          signatories: Array.isArray(publicReport.lab.signatories) ? publicReport.lab.signatories : [],
        });
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : 'This report link is unavailable.');
      });
    return () => { active = false; };
  }, [token]);

  if (error) {
    return (
      <main className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="max-w-md rounded-2xl border border-rose-200 bg-white p-6 text-center shadow-xl">
          <AlertCircle className="mx-auto h-10 w-10 text-rose-600" />
          <h1 className="mt-3 text-lg font-black text-slate-900">Report unavailable</h1>
          <p className="mt-1 text-sm text-slate-600">{error}</p>
        </div>
      </main>
    );
  }

  if (!report) {
    return (
      <main className="min-h-screen bg-slate-100 flex items-center justify-center gap-2 text-sm font-semibold text-slate-600">
        <Loader2 className="h-5 w-5 animate-spin" /> Loading verified report…
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-200 p-3 sm:p-8">
      <div className="mx-auto mb-4 flex max-w-[840px] items-center gap-2 text-xs font-bold text-slate-700">
        <ShieldCheck className="h-4 w-4 text-teal-700" /> Verified LabPulse report · {report.reportNumber}
      </div>
      <DiagnosticReportDocument report={report} lab={lab} showHeaderWatermark />
    </main>
  );
};
