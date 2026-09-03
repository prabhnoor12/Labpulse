import React from 'react';
import { 
  FlaskConical, 
  PlusCircle, 
  Users, 
  Settings, 
  BookOpen, 
  MessageSquare, 
  Award,
  ShieldCheck,
  FileText
} from 'lucide-react';
import { LabProfile } from '@/domain/types';

interface LabHeaderProps {
  lab: LabProfile;
  activeTab: 'editor' | 'registry';
  onTabChange: (tab: 'editor' | 'registry') => void;
  onNewReport: () => void;
  onOpenSettings: () => void;
  onOpenCatalog: () => void;
  patientCount: number;
}

export const LabHeader: React.FC<LabHeaderProps> = ({
  lab,
  activeTab,
  onTabChange,
  onNewReport,
  onOpenSettings,
  onOpenCatalog,
  patientCount,
}) => {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      {/* Top Banner - Accreditation & WhatsApp status */}
      <div className="bg-slate-900 text-slate-300 text-[11px] sm:text-xs px-3 sm:px-6 py-1.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 text-teal-400 font-medium">
            <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate max-w-[200px] sm:max-w-none">NABL (ISO 15189:2022)</span>
          </div>
          <span className="text-slate-600 hidden xs:inline">•</span>
          <span className="text-slate-400 hidden xs:inline font-mono text-[10px] sm:text-xs">Reg: {lab.regNumber}</span>
          <span className="text-slate-600 hidden md:inline">•</span>
          <span className="hidden md:inline text-slate-400 truncate">{lab.city}, {lab.state}</span>
        </div>

        <div className="flex items-center gap-3 text-[11px] sm:text-xs ml-auto">
          <div className="flex items-center gap-1 text-emerald-400 font-medium truncate">
            <MessageSquare className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline">WhatsApp Dispatch:</span>
            <span className="font-mono">{lab.whatsapp}</span>
          </div>
          <div className="flex items-center gap-1 bg-slate-800 px-2 py-0.5 rounded text-slate-300 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-[10px] sm:text-xs">Online</span>
          </div>
        </div>
      </div>

      {/* Main Navigation Bar */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5 sm:py-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Lab Identity & Logo */}
        <div className="flex items-center justify-between w-full md:w-auto">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-teal-800 text-white flex items-center justify-center font-bold shadow-xs shrink-0">
              <FlaskConical className="w-5 h-5 sm:w-6 sm:h-6 text-teal-200" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <h1 className="text-sm sm:text-base md:text-lg font-bold text-slate-900 tracking-tight leading-tight truncate">
                  {lab.name}
                </h1>
                <span className="hidden lg:inline-flex items-center gap-1 text-[10px] font-semibold bg-teal-50 text-teal-700 px-2 py-0.5 rounded-full border border-teal-200 shrink-0">
                  <Award className="w-3 h-3" /> NABL Grade
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-500 truncate max-w-[280px] sm:max-w-md">{lab.tagline}</p>
            </div>
          </div>

          {/* Quick Action Icons for Mobile (Settings & Catalog) */}
          <div className="flex items-center gap-1 md:hidden">
            <button
              id="btn-open-catalog-mobile"
              type="button"
              onClick={onOpenCatalog}
              title="Test Catalog & Rates"
              className="p-1.5 text-slate-600 hover:text-teal-700 hover:bg-slate-100 rounded-lg border border-slate-200"
            >
              <BookOpen className="w-4 h-4" />
            </button>
            <button
              id="btn-open-settings-mobile"
              type="button"
              onClick={onOpenSettings}
              title="Lab Profile & Settings"
              className="p-1.5 text-slate-600 hover:text-teal-700 hover:bg-slate-100 rounded-lg border border-slate-200"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Action Controls & Navigation Tabs */}
        <div className="flex items-center justify-between md:justify-end gap-2 sm:gap-3 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          {/* Navigation Tab Pills */}
          <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200 shrink-0">
            <button
              id="nav-editor-btn"
              type="button"
              onClick={() => onTabChange('editor')}
              className={`px-2.5 sm:px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all ${
                activeTab === 'editor'
                  ? 'bg-white text-teal-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Report Studio</span>
            </button>
            <button
              id="nav-registry-btn"
              type="button"
              onClick={() => onTabChange('registry')}
              className={`px-2.5 sm:px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all ${
                activeTab === 'registry'
                  ? 'bg-white text-teal-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span className="hidden xs:inline">Patients</span>
              <span className="xs:hidden">Records</span>
              <span className="bg-slate-200 text-slate-700 text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                {patientCount}
              </span>
            </button>
          </div>

          {/* New Report CTA */}
          <button
            id="btn-new-report-header"
            type="button"
            onClick={onNewReport}
            className="flex items-center gap-1.5 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold px-3 sm:px-3.5 py-2 rounded-lg transition-colors shadow-xs shrink-0"
          >
            <PlusCircle className="w-4 h-4" />
            <span className="hidden sm:inline">New Lab Report</span>
            <span className="sm:hidden">New</span>
          </button>

          {/* Test Catalog & Settings Desktop Buttons */}
          <div className="hidden md:flex items-center gap-2">
            <button
              id="btn-open-templates-desktop"
              type="button"
              onClick={onOpenCatalog}
              title="Manage Test Templates & Pricing"
              className="p-2 text-slate-600 hover:text-teal-700 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors"
            >
              <BookOpen className="w-4 h-4" />
            </button>

            <button
              id="btn-open-settings-desktop"
              type="button"
              onClick={onOpenSettings}
              title="Lab Profile, Letterhead & Signatures"
              className="p-2 text-slate-600 hover:text-teal-700 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
