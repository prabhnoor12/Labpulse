import React, { useState } from 'react';
import { 
  X, 
  Save, 
  Building2, 
  ShieldCheck, 
  UserCheck, 
  Plus, 
  Trash2, 
  Check 
} from 'lucide-react';
import { LabProfile, DoctorSignatory } from '@/domain/types';

interface LabSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  lab: LabProfile;
  onSaveLab: (updated: LabProfile) => void;
}

export const LabSettingsModal: React.FC<LabSettingsModalProps> = ({
  isOpen,
  onClose,
  lab,
  onSaveLab,
}) => {
  const [formData, setFormData] = useState<LabProfile>({ ...lab });
  const [activeTab, setActiveTab] = useState<'profile' | 'signatories' | 'letterhead'>('profile');

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveLab(formData);
    onClose();
  };

  const handleAddSignatory = () => {
    const newSign: DoctorSignatory = {
      id: `doc-${Date.now()}`,
      name: 'Dr. New Pathologist',
      degrees: 'MBBS, MD (Pathology)',
      regNumber: 'MCI / DMC - 00000',
      designation: 'Consultant Pathologist',
      signatureText: 'Dr. Pathologist (MD)',
      isDefault: false,
    };
    setFormData({
      ...formData,
      signatories: [...formData.signatories, newSign],
    });
  };

  const handleRemoveSignatory = (id: string) => {
    if (formData.signatories.length <= 1) return;
    setFormData({
      ...formData,
      signatories: formData.signatories.filter((s) => s.id !== id),
    });
  };

  const handleUpdateSignatory = (id: string, field: keyof DoctorSignatory, val: any) => {
    setFormData({
      ...formData,
      signatories: formData.signatories.map((s) => {
        if (s.id === id) {
          return { ...s, [field]: val };
        }
        return s;
      }),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-slate-900 text-white px-4 sm:px-6 py-3.5 sm:py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-600 flex items-center justify-center shrink-0">
              <Building2 className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold truncate">Diagnostic Center Profile & Settings</h3>
              <p className="text-[11px] text-slate-400 truncate">Indian Lab Branding, NABL Badges & Pathologist Signatures</p>
            </div>
          </div>
          <button
            id="close-lab-settings-modal-btn"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Strip - Horizontal Scroll on Mobile */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-3 sm:px-6 pt-2 overflow-x-auto shrink-0">
          <button
            id="tab-profile-btn"
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`px-3 sm:px-4 py-2 text-xs font-bold border-b-2 whitespace-nowrap transition-colors ${
              activeTab === 'profile'
                ? 'border-teal-700 text-teal-800 bg-white rounded-t-lg'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Lab Details & Contact
          </button>
          <button
            id="tab-signatories-btn"
            type="button"
            onClick={() => setActiveTab('signatories')}
            className={`px-3 sm:px-4 py-2 text-xs font-bold border-b-2 whitespace-nowrap transition-colors ${
              activeTab === 'signatories'
                ? 'border-teal-700 text-teal-800 bg-white rounded-t-lg'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Doctors & Signatories ({formData.signatories.length})
          </button>
          <button
            id="tab-letterhead-btn"
            type="button"
            onClick={() => setActiveTab('letterhead')}
            className={`px-3 sm:px-4 py-2 text-xs font-bold border-b-2 whitespace-nowrap transition-colors ${
              activeTab === 'letterhead'
                ? 'border-teal-700 text-teal-800 bg-white rounded-t-lg'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Letterhead & Accreditations
          </button>
        </div>

        {/* Form Content */}
        <form onSubmit={handleSave} className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
          {activeTab === 'profile' && (
            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-bold uppercase mb-1 text-[10px]">
                  Diagnostic Center / Laboratory Name *
                </label>
                <input
                  id="lab-name-input"
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold text-slate-900 focus:ring-2 focus:ring-teal-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold uppercase mb-1 text-[10px]">
                  Tagline / Motto
                </label>
                <input
                  id="lab-tagline-input"
                  type="text"
                  value={formData.tagline}
                  onChange={(e) => setFormData({ ...formData, tagline: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 focus:ring-2 focus:ring-teal-600 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold uppercase mb-1 text-[10px]">
                    Registration No. / Clinical License
                  </label>
                  <input
                    id="lab-regno-input"
                    type="text"
                    value={formData.regNumber}
                    onChange={(e) => setFormData({ ...formData, regNumber: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold uppercase mb-1 text-[10px]">
                    GSTIN No. (Optional)
                  </label>
                  <input
                    id="lab-gstin-input"
                    type="text"
                    value={formData.gstin || ''}
                    onChange={(e) => setFormData({ ...formData, gstin: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold uppercase mb-1 text-[10px]">
                    Address Line 1
                  </label>
                  <input
                    id="lab-address1-input"
                    type="text"
                    value={formData.addressLine1}
                    onChange={(e) => setFormData({ ...formData, addressLine1: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold uppercase mb-1 text-[10px]">
                    City, State & PIN Code
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      type="text"
                      placeholder="City"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      className="px-2 py-2 border border-slate-300 rounded-lg"
                    />
                    <input
                      type="text"
                      placeholder="State"
                      value={formData.state}
                      onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                      className="px-2 py-2 border border-slate-300 rounded-lg"
                    />
                    <input
                      type="text"
                      placeholder="PIN"
                      value={formData.pincode}
                      onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
                      className="px-2 py-2 border border-slate-300 rounded-lg font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold uppercase mb-1 text-[10px]">
                    WhatsApp Helpline
                  </label>
                  <input
                    id="lab-whatsapp-input"
                    type="text"
                    value={formData.whatsapp}
                    onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold uppercase mb-1 text-[10px]">
                    Phone / Landline
                  </label>
                  <input
                    id="lab-phone-input"
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold uppercase mb-1 text-[10px]">
                    Lab Email
                  </label>
                  <input
                    id="lab-email-input"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold uppercase mb-1 text-[10px]">
                  UPI VPA ID (For Patient Payment QR)
                </label>
                <input
                  id="lab-upi-input"
                  type="text"
                  placeholder="Enter UPI ID"
                  value={formData.upiId || ''}
                  onChange={(e) => setFormData({ ...formData, upiId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-teal-800 font-semibold"
                />
              </div>
            </div>
          )}

          {activeTab === 'signatories' && (
            <div className="space-y-4 text-xs">
              <div className="flex flex-wrap justify-between items-center gap-2">
                <span className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">
                  Authorized Medical Pathologists & Doctors
                </span>
                <button
                  id="add-signatory-btn"
                  type="button"
                  onClick={handleAddSignatory}
                  className="flex items-center gap-1 text-xs font-bold text-teal-700 hover:text-teal-800 bg-teal-50 px-2.5 py-1 rounded-md border border-teal-200"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Signatory Doctor</span>
                </button>
              </div>

              <div className="space-y-3">
                {formData.signatories.map((doc, idx) => (
                  <div key={doc.id} className="p-3.5 border border-slate-200 rounded-xl bg-slate-50 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800 text-xs">Doctor #{idx + 1}</span>
                      {formData.signatories.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveSignatory(doc.id)}
                          className="text-rose-600 hover:text-rose-700 p-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-slate-500 font-bold uppercase block">Doctor Name</label>
                        <input
                          type="text"
                          value={doc.name}
                          onChange={(e) => handleUpdateSignatory(doc.id, 'name', e.target.value)}
                          className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white font-semibold"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-500 font-bold uppercase block">Degrees / Qualifications</label>
                        <input
                          type="text"
                          value={doc.degrees}
                          onChange={(e) => handleUpdateSignatory(doc.id, 'degrees', e.target.value)}
                          className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-slate-500 font-bold uppercase block">Medical Council Reg. No.</label>
                        <input
                          type="text"
                          value={doc.regNumber}
                          onChange={(e) => handleUpdateSignatory(doc.id, 'regNumber', e.target.value)}
                          className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-500 font-bold uppercase block">Designation / Role</label>
                        <input
                          type="text"
                          value={doc.designation}
                          onChange={(e) => handleUpdateSignatory(doc.id, 'designation', e.target.value)}
                          className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-2 border-t border-slate-200">
                <label className="block text-slate-700 font-bold uppercase mb-1 text-[10px]">
                  Senior Lab Technologist Details
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Technologist Name"
                    value={formData.technologistName}
                    onChange={(e) => setFormData({ ...formData, technologistName: e.target.value })}
                    className="px-3 py-2 border border-slate-300 rounded-lg"
                  />
                  <input
                    type="text"
                    placeholder="Degrees (e.g. B.Sc MLT)"
                    value={formData.technologistDegrees}
                    onChange={(e) => setFormData({ ...formData, technologistDegrees: e.target.value })}
                    className="px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'letterhead' && (
            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-bold uppercase mb-1 text-[10px]">
                  Accreditation Tags (Comma separated)
                </label>
                <input
                  id="accreditations-input"
                  type="text"
                  value={formData.accreditations.join(', ')}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      accreditations: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                    })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <input
                  id="show-watermark-checkbox"
                  type="checkbox"
                  checked={formData.showWatermark}
                  onChange={(e) => setFormData({ ...formData, showWatermark: e.target.checked })}
                  className="w-4 h-4 text-teal-600 rounded shrink-0"
                />
                <div className="flex-1">
                  <label htmlFor="show-watermark-checkbox" className="font-bold text-slate-900 block cursor-pointer">
                    Enable Diagnostic Watermark on Printed Reports
                  </label>
                  <span className="text-[11px] text-slate-500 block">
                    Adds subtle diagonal verified text across the center of report documents.
                  </span>
                </div>
              </div>

              {formData.showWatermark && (
                <div>
                  <label className="block text-slate-700 font-bold uppercase mb-1 text-[10px]">
                    Watermark Text
                  </label>
                  <input
                    id="watermark-text-input"
                    type="text"
                    value={formData.watermarkText}
                    onChange={(e) => setFormData({ ...formData, watermarkText: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono uppercase"
                  />
                </div>
              )}

              <div>
                <label className="block text-slate-700 font-bold uppercase mb-1 text-[10px]">
                  Footer Legal & EQAS Disclaimer Note
                </label>
                <textarea
                  id="footer-disclaimer-textarea"
                  rows={3}
                  value={formData.footerDisclaimer}
                  onChange={(e) => setFormData({ ...formData, footerDisclaimer: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-xs text-slate-800"
                />
              </div>
            </div>
          )}

          {/* Footer Save */}
          <div className="bg-slate-50 -mx-4 sm:-mx-6 -mb-4 sm:-mb-6 px-4 sm:px-6 py-3.5 border-t border-slate-200 flex items-center justify-between shrink-0">
            <button
              id="cancel-lab-settings-btn"
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-lg text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              id="save-lab-settings-btn"
              type="submit"
              className="flex items-center gap-1.5 bg-teal-700 hover:bg-teal-800 text-white px-5 py-2 rounded-lg text-xs font-bold transition-colors shadow-xs"
            >
              <Save className="w-4 h-4" />
              <span>Save Lab Profile</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
