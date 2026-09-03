import React, { useState } from 'react';
import { 
  X, 
  Plus, 
  Search, 
  BookOpen, 
  Edit3, 
  Check, 
  IndianRupee, 
  Clock, 
  FlaskConical, 
  Layers,
  ChevronRight,
  ArrowLeft
} from 'lucide-react';
import { TestTemplate } from '@/domain/types';

interface TestCatalogModalProps {
  isOpen: boolean;
  onClose: () => void;
  templates: TestTemplate[];
  onUpdateTemplates: (updated: TestTemplate[]) => void;
}

export const TestCatalogModal: React.FC<TestCatalogModalProps> = ({
  isOpen,
  onClose,
  templates,
  onUpdateTemplates,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedTemplate, setSelectedTemplate] = useState<TestTemplate | null>(templates[0] || null);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editForm, setEditForm] = useState<TestTemplate | null>(templates[0] || null);
  const [mobileDetailView, setMobileDetailView] = useState<boolean>(false);

  if (!isOpen) return null;

  const filteredTemplates = templates.filter(
    (t) =>
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelect = (t: TestTemplate) => {
    setSelectedTemplate(t);
    setEditForm({ ...t });
    setIsEditing(false);
    setMobileDetailView(true);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm) return;

    const updated = templates.map((t) => (t.id === editForm.id ? editForm : t));
    onUpdateTemplates(updated);
    setSelectedTemplate(editForm);
    setIsEditing(false);
  };

  const handleCreateNew = () => {
    const newTmpl: TestTemplate = {
      id: `custom-test-${Date.now()}`,
      name: 'New Custom Diagnostic Test',
      code: 'CUST-001',
      category: 'Biochemistry',
      sampleType: 'Serum (2.0 mL)',
      fastingRequired: false,
      tat: '2 Hours',
      defaultPrice: 400,
      method: 'Automated Clinical Analyzer',
      defaultNotes: 'Clinical correlation advised.',
      parameters: [
        {
          id: `param-${Date.now()}-1`,
          name: 'Primary Parameter',
          defaultVal: '10.0',
          unit: 'mg/dL',
          maleRefRange: '5.0 - 15.0',
          femaleRefRange: '5.0 - 15.0',
          minVal: 5.0,
          maxVal: 15.0,
        },
      ],
    };

    const updated = [...templates, newTmpl];
    onUpdateTemplates(updated);
    setSelectedTemplate(newTmpl);
    setEditForm(newTmpl);
    setIsEditing(true);
    setMobileDetailView(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full overflow-hidden border border-slate-200 flex flex-col max-h-[88vh]">
        {/* Header */}
        <div className="bg-slate-900 text-white px-4 sm:px-6 py-3.5 sm:py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-600 flex items-center justify-center shrink-0">
              <BookOpen className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold truncate">Diagnostic Test Catalog & Rate List</h3>
              <p className="text-[11px] text-slate-400 truncate">Standard Indian Pathology Templates & Parameter Reference Ranges</p>
            </div>
          </div>
          <button
            id="close-catalog-modal-btn"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Grid with Mobile Toggle */}
        <div className="grid grid-cols-1 md:grid-cols-12 flex-1 overflow-hidden">
          {/* Left: Template List (hidden on mobile if viewing details) */}
          <div className={`md:col-span-4 border-r border-slate-200 bg-slate-50 flex flex-col overflow-hidden ${
            mobileDetailView ? 'hidden md:flex' : 'flex'
          }`}>
            <div className="p-3 border-b border-slate-200 space-y-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search test panel..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-600"
                />
              </div>

              <button
                id="add-new-custom-test-btn"
                type="button"
                onClick={handleCreateNew}
                className="w-full flex items-center justify-center gap-1.5 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold py-1.5 rounded-lg transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Custom Test</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {filteredTemplates.map((tmpl) => (
                <button
                  key={tmpl.id}
                  onClick={() => handleSelect(tmpl)}
                  className={`w-full text-left p-2.5 rounded-lg text-xs transition-all ${
                    selectedTemplate?.id === tmpl.id
                      ? 'bg-white text-teal-900 border border-teal-300 shadow-xs font-bold'
                      : 'text-slate-700 hover:bg-slate-100 font-medium'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <span className="line-clamp-1">{tmpl.name}</span>
                    <span className="text-teal-700 font-mono font-bold shrink-0 ml-2">₹{tmpl.defaultPrice}</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-500 mt-1">
                    <span>{tmpl.category} • {tmpl.parameters.length} params</span>
                    <ChevronRight className="w-3 h-3 text-slate-400 md:hidden" />
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Right: Selected Template Details & Editor (hidden on mobile if in list view) */}
          <div className={`md:col-span-8 p-4 sm:p-6 overflow-y-auto bg-white flex flex-col justify-between ${
            !mobileDetailView ? 'hidden md:flex' : 'flex'
          }`}>
            {selectedTemplate && (
              <div>
                {/* Mobile Back to List Button */}
                <div className="md:hidden pb-2 mb-2 border-b border-slate-200">
                  <button
                    type="button"
                    onClick={() => setMobileDetailView(false)}
                    className="flex items-center gap-1 text-xs font-bold text-teal-800"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back to Test List</span>
                  </button>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-start justify-between pb-3 mb-4 border-b border-slate-200 gap-2">
                  <div>
                    <h4 className="text-sm sm:text-base font-bold text-slate-900">{selectedTemplate.name}</h4>
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs text-slate-500 mt-1">
                      <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-700 font-bold">{selectedTemplate.code}</span>
                      <span>Category: <strong>{selectedTemplate.category}</strong></span>
                      <span>Sample: <strong>{selectedTemplate.sampleType}</strong></span>
                    </div>
                  </div>
                  
                  <button
                    id="edit-template-toggle-btn"
                    type="button"
                    onClick={() => setIsEditing(!isEditing)}
                    className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 transition-colors shrink-0"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>{isEditing ? 'Cancel' : 'Edit Rate & Details'}</span>
                  </button>
                </div>

                {isEditing && editForm ? (
                  <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">Test Name</label>
                        <input
                          type="text"
                          value={editForm.name}
                          onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                          className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-semibold"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">Default Rate (INR ₹)</label>
                        <input
                          type="number"
                          value={editForm.defaultPrice}
                          onChange={(e) => setEditForm({ ...editForm, defaultPrice: Number(e.target.value) || 0 })}
                          className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-mono font-bold"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">Category</label>
                        <select
                          value={editForm.category}
                          onChange={(e) => setEditForm({ ...editForm, category: e.target.value as any })}
                          className="w-full px-2 py-1.5 border border-slate-300 rounded"
                        >
                          <option value="Hematology">Hematology</option>
                          <option value="Biochemistry">Biochemistry</option>
                          <option value="Clinical Pathology">Clinical Pathology</option>
                          <option value="Serology & Immunology">Serology & Immunology</option>
                          <option value="Endocrinology">Endocrinology</option>
                          <option value="Vitamins & Minerals">Vitamins & Minerals</option>
                          <option value="Diabetic Care">Diabetic Care</option>
                          <option value="Preventive Health Package">Preventive Health Package</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">Sample Type</label>
                        <input
                          type="text"
                          value={editForm.sampleType}
                          onChange={(e) => setEditForm({ ...editForm, sampleType: e.target.value })}
                          className="w-full px-2.5 py-1.5 border border-slate-300 rounded"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">Turnaround Time (TAT)</label>
                        <input
                          type="text"
                          value={editForm.tat}
                          onChange={(e) => setEditForm({ ...editForm, tat: e.target.value })}
                          className="w-full px-2.5 py-1.5 border border-slate-300 rounded"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">Methodology</label>
                      <input
                        type="text"
                        value={editForm.method}
                        onChange={(e) => setEditForm({ ...editForm, method: e.target.value })}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-slate-700"
                      />
                    </div>

                    {/* Parameters summary */}
                    <div>
                      <span className="text-[10px] font-bold text-slate-600 uppercase block mb-1.5">
                        Test Parameters ({editForm.parameters.length})
                      </span>
                      <div className="border border-slate-200 rounded-lg overflow-x-auto max-h-48 overflow-y-auto">
                        <table className="w-full text-left text-[11px] min-w-[400px]">
                          <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                            <tr>
                              <th className="py-1.5 px-2.5">Parameter</th>
                              <th className="py-1.5 px-2.5">Default</th>
                              <th className="py-1.5 px-2.5">Units</th>
                              <th className="py-1.5 px-2.5">Male Ref.</th>
                              <th className="py-1.5 px-2.5">Female Ref.</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {editForm.parameters.map((p, idx) => (
                              <tr key={idx}>
                                <td className="py-1 px-2.5 font-medium">{p.name}</td>
                                <td className="py-1 px-2.5 font-mono">{p.defaultVal || '-'}</td>
                                <td className="py-1 px-2.5 text-slate-500">{p.unit}</td>
                                <td className="py-1 px-2.5 font-mono text-slate-700">{p.maleRefRange}</td>
                                <td className="py-1 px-2.5 font-mono text-slate-700">{p.femaleRefRange}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setIsEditing(false)}
                        className="px-3 py-1.5 border border-slate-300 rounded text-xs font-semibold"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="bg-teal-700 text-white px-4 py-1.5 rounded text-xs font-bold hover:bg-teal-800"
                      >
                        Save Changes
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="space-y-4 text-xs">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 bg-slate-50 p-3 rounded-lg border border-slate-200">
                      <div>
                        <span className="text-[10px] text-slate-500 font-bold uppercase block">Standard Price</span>
                        <span className="text-sm font-bold font-mono text-teal-800">₹{selectedTemplate.defaultPrice}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 font-bold uppercase block">Sample</span>
                        <span className="font-semibold text-slate-800">{selectedTemplate.sampleType}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 font-bold uppercase block">Fasting</span>
                        <span className="font-semibold text-slate-800">
                          {selectedTemplate.fastingRequired ? '10-12h' : 'Random'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 font-bold uppercase block">TAT</span>
                        <span className="font-semibold text-slate-800">{selectedTemplate.tat}</span>
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Method</span>
                      <p className="text-slate-700 bg-slate-50 p-2 rounded border border-slate-200 text-[11px]">
                        {selectedTemplate.method}
                      </p>
                    </div>

                    {/* Parameters Table */}
                    <div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                        Investigation Parameters ({selectedTemplate.parameters.length})
                      </span>
                      <div className="border border-slate-200 rounded-lg overflow-x-auto">
                        <table className="w-full text-left text-[11px] min-w-[460px]">
                          <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                            <tr>
                              <th className="py-2 px-3">Parameter Name</th>
                              <th className="py-2 px-3">Default Value</th>
                              <th className="py-2 px-3">Unit</th>
                              <th className="py-2 px-3">Biological Reference Range</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {selectedTemplate.parameters.map((p, idx) => (
                              <tr key={idx} className="hover:bg-slate-50">
                                <td className="py-1.5 px-3 font-medium text-slate-900">
                                  {p.name}
                                  {p.isCalculated && (
                                    <span className="text-[9px] text-teal-700 ml-1.5 font-normal">(Auto-calc)</span>
                                  )}
                                </td>
                                <td className="py-1.5 px-3 font-mono text-slate-800">{p.defaultVal || '-'}</td>
                                <td className="py-1.5 px-3 font-mono text-slate-500">{p.unit || '-'}</td>
                                <td className="py-1.5 px-3 font-mono text-slate-700">{p.maleRefRange}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 border-t border-slate-200 px-4 sm:px-6 py-3 flex justify-end shrink-0">
          <button
            id="close-catalog-btn"
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 text-slate-800 hover:bg-slate-300 rounded-lg text-xs font-semibold"
          >
            Close Catalog
          </button>
        </div>
      </div>
    </div>
  );
};
