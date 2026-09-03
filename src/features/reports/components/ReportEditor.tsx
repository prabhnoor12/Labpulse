import React, { useState } from 'react';
import { 
  Plus, 
  Trash2, 
  Sparkles, 
  Wand2, 
  MessageCircle, 
  Printer, 
  Save, 
  Clock, 
  CreditCard, 
  User, 
  Stethoscope, 
  FileSpreadsheet, 
  Check, 
  AlertCircle, 
  ChevronDown, 
  ChevronUp, 
  Layers, 
  RefreshCw,
  HelpCircle,
  Eye,
  Languages,
  CheckCircle2
} from 'lucide-react';
import { DiagnosticReport, LabProfile, TestPanel, TestParameter, TestTemplate } from '@/domain/types';
import { computeDerivedValues, evaluateParameterFlag } from '@/domain/rangeEvaluator';

interface ReportEditorProps {
  report: DiagnosticReport;
  lab: LabProfile;
  templates: TestTemplate[];
  onSaveReport: (updatedReport: DiagnosticReport) => void;
  onPreviewReport: (report: DiagnosticReport) => void;
  onWhatsAppShare: (report: DiagnosticReport) => void;
  onOpenBilling: () => void;
  onOpenRxScanner: () => void;
}

export const ReportEditor: React.FC<ReportEditorProps> = ({
  report,
  lab,
  templates,
  onSaveReport,
  onPreviewReport,
  onWhatsAppShare,
  onOpenBilling,
  onOpenRxScanner,
}) => {
  const [currentReport, setCurrentReport] = useState<DiagnosticReport>({ ...report });
  const [aiLoading, setAiLoading] = useState<boolean>(false);
  const [aiSuccess, setAiSuccess] = useState<boolean>(false);
  const [selectedAddTemplateId, setSelectedAddTemplateId] = useState<string>('');

  // Keep state synced when prop changes
  React.useEffect(() => {
    setCurrentReport({ ...report });
  }, [report.id]);

  const patient = currentReport.patient;

  const handlePatientChange = (field: string, value: any) => {
    const updated = {
      ...currentReport,
      patient: {
        ...currentReport.patient,
        [field]: value,
      },
    };
    setCurrentReport(updated);
  };

  const handleAddTestPanel = (templateId: string) => {
    if (!templateId) return;
    const template = templates.find((t) => t.id === templateId);
    if (!template) return;

    // Check if already added
    if (currentReport.tests.some((t) => t.templateId === template.id)) {
      alert('This test panel is already added to the report.');
      return;
    }

    const rawParams: TestParameter[] = template.parameters.map((p) => ({
      id: p.id,
      name: p.name,
      shortName: p.shortName,
      value: p.defaultVal || '',
      unit: p.unit,
      method: p.method,
      refRange: patient.gender === 'Female' ? p.femaleRefRange : p.maleRefRange,
      minVal: p.minVal,
      maxVal: p.maxVal,
      criticalMin: p.criticalMin,
      criticalMax: p.criticalMax,
      options: p.options,
      subCategory: p.subCategory,
      isCalculated: p.isCalculated,
    }));

    const parameters = computeDerivedValues(rawParams);

    const newPanel: TestPanel = {
      id: `panel-${template.id}-${Date.now()}`,
      templateId: template.id,
      testName: template.name,
      category: template.category,
      sampleType: template.sampleType,
      method: template.method,
      price: template.defaultPrice,
      parameters,
      clinicalInterpretation: template.defaultNotes,
    };

    const newTests = [...currentReport.tests, newPanel];
    const newTotal = newTests.reduce((acc, t) => acc + t.price, 0);

    const updated = {
      ...currentReport,
      tests: newTests,
      billing: {
        ...currentReport.billing,
        totalAmount: newTotal,
        netAmount: Math.max(0, newTotal - currentReport.billing.discount),
      },
    };

    setCurrentReport(updated);
    setSelectedAddTemplateId('');
  };

  const handleRemoveTestPanel = (panelId: string) => {
    const newTests = currentReport.tests.filter((t) => t.id !== panelId);
    const newTotal = newTests.reduce((acc, t) => acc + t.price, 0);

    const updated = {
      ...currentReport,
      tests: newTests,
      billing: {
        ...currentReport.billing,
        totalAmount: newTotal,
        netAmount: Math.max(0, newTotal - currentReport.billing.discount),
      },
    };
    setCurrentReport(updated);
  };

  const handleParameterValueChange = (panelId: string, paramId: string, val: string) => {
    const updatedTests = currentReport.tests.map((panel) => {
      if (panel.id !== panelId) return panel;

      const rawParams = panel.parameters.map((p) => {
        if (p.id !== paramId) return p;
        return {
          ...p,
          value: val,
        };
      });

      // Recalculate derived formulas & evaluate flags
      const evaluatedParams = computeDerivedValues(rawParams);

      return {
        ...panel,
        parameters: evaluatedParams,
      };
    });

    setCurrentReport({
      ...currentReport,
      tests: updatedTests,
    });
  };

  const handleFillNormalValues = (panelId: string) => {
    const updatedTests = currentReport.tests.map((panel) => {
      if (panel.id !== panelId) return panel;
      const template = templates.find((t) => t.id === panel.templateId);
      if (!template) return panel;

      const rawParams = panel.parameters.map((p) => {
        const tmplParam = template.parameters.find((tp) => tp.id === p.id);
        return {
          ...p,
          value: tmplParam?.defaultVal || p.value,
        };
      });

      return {
        ...panel,
        parameters: computeDerivedValues(rawParams),
      };
    });

    setCurrentReport({
      ...currentReport,
      tests: updatedTests,
    });
  };

  const handleRunAiImpression = async () => {
    setAiLoading(true);
    setAiSuccess(false);

    try {
      // Gather abnormal values
      const abnormalList: any[] = [];
      currentReport.tests.forEach((t) => {
        t.parameters.forEach((p) => {
          if (p.flag && p.flag !== 'NORMAL') {
            abnormalList.push({
              test: t.testName,
              name: p.name,
              value: p.value,
              unit: p.unit,
              flag: p.flag,
              refRange: p.refRange,
            });
          }
        });
      });

      const res = await fetch('/api/ai/clinical-impression', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient: currentReport.patient,
          tests: currentReport.tests.map((t) => ({
            name: t.testName,
            parameters: t.parameters.map((p) => ({
              name: p.name,
              value: p.value,
              unit: p.unit,
              flag: p.flag,
            })),
          })),
          abnormalParameters: abnormalList,
          notes: currentReport.pathologistNotes,
        }),
      });

      if (!res.ok) {
        throw new Error('AI interpretation service temporarily unavailable');
      }

      const data = await res.json();

      const updated = {
        ...currentReport,
        clinicalImpression: data.impression || currentReport.clinicalImpression,
        pathologistNotes: data.pathologistNote || currentReport.pathologistNotes,
        patientSummaryEn: data.patientSummaryEn || currentReport.patientSummaryEn,
        patientSummaryHi: data.patientSummaryHi || currentReport.patientSummaryHi,
        keyHighlights: data.keyHighlights || currentReport.keyHighlights,
        dietaryAdvice: data.dietaryAdvice || currentReport.dietaryAdvice,
      };

      setCurrentReport(updated);
      setAiSuccess(true);
      setTimeout(() => setAiSuccess(false), 3000);
    } catch (err: any) {
      console.error(err);
      alert('Error generating clinical impression: ' + err.message);
    } finally {
      setAiLoading(false);
    }
  };

  const handleSave = () => {
    const updated = {
      ...currentReport,
      updatedAt: new Date().toISOString(),
    };
    onSaveReport(updated);
  };

  return (
    <div className="space-y-4 sm:space-y-6 max-w-7xl mx-auto pb-16">
      {/* Top Action Ribbon - Responsive Grid & Flex */}
      <div className="bg-white p-3 sm:p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center justify-between sm:justify-start gap-2 sm:gap-3">
          <div className="bg-teal-50 border border-teal-200 text-teal-900 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5">
            <span className="hidden sm:inline">Report No:</span>
            <span className="font-mono text-teal-800">{currentReport.reportNumber}</span>
          </div>
          <span className={`px-2.5 py-1 rounded-md text-[11px] sm:text-xs font-bold uppercase ${
            currentReport.status === 'VERIFIED' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'
          }`}>
            {currentReport.status}
          </span>
        </div>

        {/* Action Buttons Grid on Mobile, Flex on Desktop */}
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2">
          {/* AI Prescription OCR Button */}
          <button
            id="open-rx-scanner-btn"
            type="button"
            onClick={onOpenRxScanner}
            className="flex items-center justify-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold px-2.5 sm:px-3 py-2 rounded-lg border border-slate-300 transition-colors"
          >
            <Stethoscope className="w-3.5 h-3.5 text-teal-700 shrink-0" />
            <span className="truncate">Rx Scanner</span>
          </button>

          {/* Billing Modal */}
          <button
            id="open-billing-btn"
            type="button"
            onClick={onOpenBilling}
            className="flex items-center justify-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold px-2.5 sm:px-3 py-2 rounded-lg border border-slate-300 transition-colors"
          >
            <CreditCard className="w-3.5 h-3.5 text-indigo-700 shrink-0" />
            <span className="truncate">Bill: ₹{currentReport.billing.netAmount}</span>
          </button>

          {/* Preview / Print */}
          <button
            id="btn-preview-report-document"
            type="button"
            onClick={() => onPreviewReport(currentReport)}
            className="flex items-center justify-center gap-1.5 bg-teal-50 hover:bg-teal-100 text-teal-900 border border-teal-300 text-xs font-bold px-2.5 sm:px-3.5 py-2 rounded-lg transition-colors"
          >
            <Eye className="w-3.5 h-3.5 text-teal-700 shrink-0" />
            <span className="truncate">Preview A4</span>
          </button>

          {/* WhatsApp Direct Dispatch */}
          <button
            id="btn-trigger-whatsapp-dispatch"
            type="button"
            onClick={() => onWhatsAppShare(currentReport)}
            className="flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 sm:px-4 py-2 rounded-lg transition-all shadow-xs"
          >
            <MessageCircle className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">WhatsApp</span>
          </button>

          {/* Save Report (Full width on very small screens, fits neatly into ribbon) */}
          <button
            id="btn-save-report-changes"
            type="button"
            onClick={handleSave}
            className="col-span-2 sm:col-span-1 flex items-center justify-center gap-1.5 bg-teal-800 hover:bg-teal-900 text-white text-xs font-bold px-3.5 sm:px-4 py-2 rounded-lg transition-all shadow-xs"
          >
            <Save className="w-3.5 h-3.5 shrink-0" />
            <span>Save Report</span>
          </button>
        </div>
      </div>

      {/* 1. Patient Demographics & Sample Meta */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between pb-3 mb-4 border-b border-slate-200 gap-2">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-teal-700 shrink-0" />
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Patient Demographics & Specimen Details ({patient.uhid})
            </h3>
          </div>
          <span className="text-[11px] text-slate-500 font-mono">
            Barcode: {patient.sampleBarcode}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4 text-xs">
          {/* Patient Name */}
          <div>
            <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
              Patient Full Name *
            </label>
            <input
              id="patient-name-input"
              type="text"
              required
              value={patient.name}
              onChange={(e) => handlePatientChange('name', e.target.value)}
              placeholder="Enter patient name"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold text-slate-900 focus:ring-2 focus:ring-teal-600 focus:outline-none"
            />
          </div>

          {/* Age & Unit */}
          <div>
            <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
              Age & Unit
            </label>
            <div className="flex gap-2">
              <input
                id="patient-age-input"
                type="number"
                min={0}
                max={120}
                value={patient.age}
                onChange={(e) => handlePatientChange('age', Number(e.target.value) || 0)}
                className="w-20 px-2.5 py-2 border border-slate-300 rounded-lg font-bold"
              />
              <select
                id="patient-ageunit-select"
                value={patient.ageUnit}
                onChange={(e) => handlePatientChange('ageUnit', e.target.value)}
                className="flex-1 px-2 py-2 border border-slate-300 rounded-lg font-medium"
              >
                <option value="Yrs">Years</option>
                <option value="Months">Months</option>
                <option value="Days">Days</option>
              </select>
            </div>
          </div>

          {/* Gender */}
          <div>
            <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
              Gender
            </label>
            <select
              id="patient-gender-select"
              value={patient.gender}
              onChange={(e) => handlePatientChange('gender', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold text-slate-800"
            >
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
          </div>

          {/* WhatsApp Mobile Number */}
          <div>
            <label className="block text-[10px] font-bold text-emerald-800 uppercase mb-1 flex items-center gap-1">
              <MessageCircle className="w-3 h-3 text-emerald-600 shrink-0" />
              WhatsApp Mobile (10 Digits) *
            </label>
            <div className="flex">
              <span className="bg-slate-100 border border-r-0 border-slate-300 px-2.5 py-2 text-slate-600 rounded-l-lg font-bold text-xs shrink-0">
                +91
              </span>
              <input
                id="patient-phone-input"
                type="tel"
                value={patient.phone}
                onChange={(e) => handlePatientChange('phone', e.target.value)}
                placeholder="Enter mobile number"
                className="w-full px-2.5 py-2 border border-slate-300 rounded-r-lg font-bold text-emerald-950 font-mono focus:ring-2 focus:ring-emerald-600 focus:outline-none"
              />
            </div>
          </div>

          {/* Referring Doctor */}
          <div>
            <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
              Referred By (Doctor / Hospital)
            </label>
            <input
              id="patient-doctor-input"
              type="text"
              value={patient.referringDoctor}
              onChange={(e) => handlePatientChange('referringDoctor', e.target.value)}
              placeholder="Enter referring doctor or hospital"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800"
            />
          </div>

          {/* Fasting Status */}
          <div>
            <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
              Fasting Status
            </label>
            <select
              id="patient-fasting-select"
              value={patient.fastingStatus}
              onChange={(e) => handlePatientChange('fastingStatus', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            >
              <option value="Fasting (12h)">Fasting (12 Hours)</option>
              <option value="Post-Prandial (2h)">Post-Prandial (2 Hours)</option>
              <option value="Random">Random / Non-Fasting</option>
              <option value="N/A">N/A</option>
            </select>
          </div>

          {/* Sample Type */}
          <div>
            <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
              Specimen / Sample Type
            </label>
            <input
              id="patient-sampletype-input"
              type="text"
              value={patient.sampleType}
              onChange={(e) => handlePatientChange('sampleType', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-slate-700"
            />
          </div>

          {/* Signatory Pathologist */}
          <div>
            <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
              Consultant Pathologist Signatory
            </label>
            <select
              id="report-signatory-select"
              value={currentReport.selectedSignatoryId}
              onChange={(e) => setCurrentReport({ ...currentReport, selectedSignatoryId: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg font-semibold text-slate-800"
            >
              {lab.signatories.map((doc) => (
                <option key={doc.id} value={doc.id}>
                  {doc.name} ({doc.degrees})
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* 2. Add Test Panels Bar */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 mb-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-teal-700 shrink-0" />
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Diagnostic Test Investigations & Parameter Values ({currentReport.tests.length} Panels)
            </h3>
          </div>

          {/* Dropdown to add a test panel */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select
              id="select-add-template-dropdown"
              value={selectedAddTemplateId}
              onChange={(e) => setSelectedAddTemplateId(e.target.value)}
              className="flex-1 sm:flex-initial px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-600 max-w-xs truncate"
            >
              <option value="">-- Add Test Panel from Indian Catalog --</option>
              {templates.map((tmpl) => (
                <option key={tmpl.id} value={tmpl.id}>
                  {tmpl.name} (₹{tmpl.defaultPrice})
                </option>
              ))}
            </select>
            <button
              id="btn-add-selected-test-panel"
              type="button"
              disabled={!selectedAddTemplateId}
              onClick={() => handleAddTestPanel(selectedAddTemplateId)}
              className="flex items-center gap-1 bg-teal-700 hover:bg-teal-800 disabled:bg-slate-300 text-white text-xs font-bold px-3.5 py-1.5 rounded-lg transition-colors shadow-2xs shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Panel</span>
            </button>
          </div>
        </div>

        {/* 3. Render Each Active Test Panel Table */}
        <div className="space-y-5">
          {currentReport.tests.map((panel, panelIdx) => (
            <div key={panel.id} className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
              {/* Panel Header */}
              <div className="bg-slate-900 text-white px-3.5 sm:px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                  <span className="w-6 h-6 rounded bg-teal-700 text-teal-100 flex items-center justify-center font-bold text-xs shrink-0">
                    {panelIdx + 1}
                  </span>
                  <div className="min-w-0">
                    <h4 className="text-xs font-bold tracking-wide uppercase truncate">{panel.testName}</h4>
                    <span className="text-[10px] text-slate-400 font-mono block truncate">
                      Category: {panel.category} • Rate: ₹{panel.price}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 ml-auto">
                  {/* Fill standard normal values */}
                  <button
                    id={`fill-normal-btn-${panel.id}`}
                    type="button"
                    onClick={() => handleFillNormalValues(panel.id)}
                    title="Quickly fill default standard normal values for this panel"
                    className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-teal-300 hover:text-white text-[11px] font-semibold px-2.5 py-1 rounded border border-slate-700 transition-colors"
                  >
                    <Wand2 className="w-3 h-3" />
                    <span className="hidden xs:inline">Auto-Fill Normal</span>
                    <span className="xs:hidden">Auto Normal</span>
                  </button>

                  {/* Remove Panel */}
                  <button
                    id={`remove-panel-btn-${panel.id}`}
                    type="button"
                    onClick={() => handleRemoveTestPanel(panel.id)}
                    title="Remove this test panel"
                    className="p-1 text-slate-400 hover:text-rose-400 rounded hover:bg-slate-800 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Panel Parameters Table with Responsive Scroll Wrapper */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs min-w-[500px]">
                  <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 text-[10px] uppercase">
                    <tr>
                      <th className="py-2 px-3 w-5/12">Investigation Parameter</th>
                      <th className="py-2 px-3 w-3/12">Observed Result Value</th>
                      <th className="py-2 px-3 w-1/12">Units</th>
                      <th className="py-2 px-3 w-3/12">Reference Range</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {panel.parameters.map((param) => {
                      const isHigh = param.flag === 'HIGH' || param.flag === 'CRITICAL_HIGH';
                      const isLow = param.flag === 'LOW' || param.flag === 'CRITICAL_LOW';

                      return (
                        <tr 
                          key={param.id} 
                          className={`hover:bg-slate-50/60 ${
                            param.flag === 'CRITICAL_HIGH' || param.flag === 'CRITICAL_LOW'
                              ? 'bg-rose-50/50'
                              : isHigh || isLow
                              ? 'bg-amber-50/40'
                              : ''
                          }`}
                        >
                          <td className="py-2 px-3">
                            <div className="font-semibold text-slate-900">
                              {param.subCategory && (
                                <span className="text-[9px] text-slate-500 block uppercase font-mono">
                                  {param.subCategory}
                                </span>
                              )}
                              {param.name}
                              {param.isCalculated && (
                                <span className="text-[9px] text-teal-700 ml-1 font-normal italic">
                                  (Auto-calc)
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="py-2 px-3">
                            <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap">
                              {param.options && param.options.length > 0 ? (
                                <select
                                  value={param.value}
                                  onChange={(e) => handleParameterValueChange(panel.id, param.id, e.target.value)}
                                  className="px-2 py-1 border border-slate-300 rounded text-xs font-semibold bg-white max-w-[130px]"
                                >
                                  {param.options.map((opt) => (
                                    <option key={opt} value={opt}>
                                      {opt}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <input
                                  type="text"
                                  value={param.value}
                                  onChange={(e) => handleParameterValueChange(panel.id, param.id, e.target.value)}
                                  placeholder="Value"
                                  className={`w-24 sm:w-28 px-2 py-1 border rounded text-xs font-mono font-bold ${
                                    isHigh
                                      ? 'border-rose-400 bg-rose-50 text-rose-800'
                                      : isLow
                                      ? 'border-blue-400 bg-blue-50 text-blue-800'
                                      : 'border-slate-300 text-slate-900'
                                  } focus:outline-none focus:ring-1 focus:ring-teal-600`}
                                />
                              )}

                              {isHigh && (
                                <span className="text-[10px] font-extrabold text-rose-700 bg-rose-100 px-1.5 py-0.5 rounded shrink-0">
                                  HIGH ↑
                                </span>
                              )}
                              {isLow && (
                                <span className="text-[10px] font-extrabold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded shrink-0">
                                  LOW ↓
                                </span>
                              )}
                              {param.flag === 'NORMAL' && param.value && (
                                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1 py-0.5 rounded shrink-0">
                                  ✓
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="py-2 px-3 text-slate-500 font-mono text-[11px]">
                            {param.unit || '-'}
                          </td>

                          <td className="py-2 px-3 text-slate-700 font-mono text-[11px]">
                            {param.refRange}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 4. AI Clinical Impressions & Pathologist Remarks */}
      <section className="bg-white rounded-xl border border-teal-200 shadow-xs p-4 sm:p-5 relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 mb-4 border-b border-teal-100">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-teal-700 text-white flex items-center justify-center shrink-0">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Smart Clinical Impression & Bilingual Patient Summary (Gemini 3.7 Flash)
              </h3>
              <p className="text-[11px] text-slate-500">
                Auto-generates diagnostic impressions, doctor remarks & easy Hindi/English summary for WhatsApp
              </p>
            </div>
          </div>

          <button
            id="btn-generate-ai-impression"
            type="button"
            disabled={aiLoading}
            onClick={handleRunAiImpression}
            className="flex items-center justify-center gap-1.5 bg-gradient-to-r from-teal-700 to-teal-900 hover:from-teal-800 hover:to-teal-950 text-white text-xs font-bold px-4 py-2 rounded-lg transition-all shadow-xs shrink-0"
          >
            {aiLoading ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Analyzing Lab Parameters...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 text-teal-300" />
                <span>Auto-Generate Clinical Impression</span>
              </>
            )}
          </button>
        </div>

        {aiSuccess && (
          <div className="mb-4 p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Clinical impressions and Hindi patient takeaway updated successfully!</span>
          </div>
        )}

        <div className="space-y-4 text-xs">
          {/* Clinical Impression */}
          <div>
            <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">
              Pathologist Diagnostic Impression
            </label>
            <textarea
              id="clinical-impression-textarea"
              rows={3}
              value={currentReport.clinicalImpression}
              onChange={(e) => setCurrentReport({ ...currentReport, clinicalImpression: e.target.value })}
              placeholder="e.g. Microcytic Hypochromic Anemia with elevated RDW / Impaired Glycemic Control..."
              className="w-full p-2.5 border border-slate-300 rounded-lg font-medium text-slate-900 focus:ring-2 focus:ring-teal-600 focus:outline-none"
            />
          </div>

          {/* Pathologist Notes for Doctor */}
          <div>
            <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">
              Technical Remarks for Referring Physician
            </label>
            <input
              id="pathologist-notes-input"
              type="text"
              value={currentReport.pathologistNotes}
              onChange={(e) => setCurrentReport({ ...currentReport, pathologistNotes: e.target.value })}
              placeholder="e.g. Recommend serum ferritin correlation. Internal quality controls verified."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800"
            />
          </div>

          {/* Bilingual Patient-Friendly Takeaways (For WhatsApp) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
            <div>
              <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1 flex items-center gap-1">
                <span>Patient Guidance (English)</span>
              </label>
              <textarea
                id="patient-summary-en-textarea"
                rows={2}
                value={currentReport.patientSummaryEn}
                onChange={(e) => setCurrentReport({ ...currentReport, patientSummaryEn: e.target.value })}
                placeholder="Easy explanation for patient in simple English..."
                className="w-full p-2 border border-slate-300 rounded-lg text-xs"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1 flex items-center gap-1">
                <Languages className="w-3.5 h-3.5 text-teal-700 shrink-0" />
                <span>सरल हिंदी सारांश (WhatsApp Hindi Summary)</span>
              </label>
              <textarea
                id="patient-summary-hi-textarea"
                rows={2}
                value={currentReport.patientSummaryHi}
                onChange={(e) => setCurrentReport({ ...currentReport, patientSummaryHi: e.target.value })}
                placeholder="मरीज के लिए आसान भाषा में सारांश..."
                className="w-full p-2 border border-slate-300 rounded-lg text-xs font-hindi text-slate-800"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Bottom Sticky Action Footer */}
      <div className="bg-slate-900 text-white p-4 rounded-xl shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-bold text-slate-200 truncate">
            Ready to finalize report for {patient.name}?
          </div>
          <div className="text-[11px] text-slate-400 truncate">
            UHID: {patient.uhid} • Tests: {currentReport.tests.length} • Bill Amount: ₹{currentReport.billing.netAmount}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={handleSave}
            className="flex-1 sm:flex-initial px-3.5 py-2 border border-slate-600 hover:bg-slate-800 rounded-lg text-xs font-bold transition-colors text-center"
          >
            Save Draft
          </button>

          <button
            type="button"
            onClick={() => onPreviewReport(currentReport)}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-teal-300 px-3.5 py-2 rounded-lg text-xs font-bold transition-colors border border-slate-700"
          >
            <Printer className="w-4 h-4" />
            <span>Print A4</span>
          </button>

          <button
            type="button"
            onClick={() => onWhatsAppShare(currentReport)}
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 sm:px-5 py-2 rounded-lg text-xs font-extrabold transition-all shadow-md hover:shadow-lg"
          >
            <MessageCircle className="w-4 h-4" />
            <span>Send to Patient via WhatsApp</span>
          </button>
        </div>
      </div>
    </div>
  );
};
