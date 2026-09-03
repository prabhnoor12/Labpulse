import React, { useEffect, useState } from 'react';
import { 
  X, 
  CreditCard, 
  IndianRupee, 
  QrCode, 
  Printer, 
  Check, 
  Percent, 
  Receipt,
  FileSpreadsheet,
  Share2
} from 'lucide-react';
import { BillingInfo, DiagnosticReport, LabProfile } from '@/domain/types';
import { generateQrDataUrl, generateUpiString } from '@/services/qrService';

interface BillingReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  report: DiagnosticReport;
  lab: LabProfile;
  onUpdateBilling: (billing: BillingInfo) => void;
}

export const BillingReceiptModal: React.FC<BillingReceiptModalProps> = ({
  isOpen,
  onClose,
  report,
  lab,
  onUpdateBilling,
}) => {
  const [billing, setBilling] = useState<BillingInfo>({ ...report.billing });
  const [upiQrUrl, setUpiQrUrl] = useState<string>('');

  useEffect(() => {
    if (isOpen) setBilling({ ...report.billing });
  }, [isOpen, report.id, report.billing]);

  useEffect(() => {
    let active = true;
    if (!isOpen || !lab.upiId || billing.netAmount <= 0) {
      setUpiQrUrl('');
      return () => {
        active = false;
      };
    }

    generateQrDataUrl(
      generateUpiString(lab.upiId, lab.name, billing.netAmount, `Diagnostic-Bill-${report.patient.uhid}`),
    ).then((url) => {
      if (active) setUpiQrUrl(url);
    });

    return () => {
      active = false;
    };
  }, [billing.netAmount, isOpen, lab.name, lab.upiId, report.patient.uhid]);

  if (!isOpen) return null;

  const handleDiscountChange = (discountAmount: number) => {
    const total = billing.totalAmount;
    const discount = Math.min(Math.max(0, discountAmount), total);
    const net = Math.max(0, total - discount);
    setBilling({
      ...billing,
      discount,
      netAmount: net,
      paidAmount: Math.min(billing.paidAmount, net),
    });
  };

  const handlePaidAmountChange = (paidAmount: number) => {
    setBilling({
      ...billing,
      paidAmount: Math.min(Math.max(0, paidAmount), billing.netAmount),
    });
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const totalAmount = report.tests.reduce((sum, test) => sum + Math.max(0, Number(test.price) || 0), 0);
    const discount = Math.min(Math.max(0, Number(billing.discount) || 0), totalAmount);
    const netAmount = Math.max(0, totalAmount - discount);
    const paidAmount = Math.min(Math.max(0, Number(billing.paidAmount) || 0), netAmount);
    const paymentStatus = paidAmount >= netAmount && netAmount > 0
      ? 'PAID'
      : paidAmount > 0
      ? 'PARTIAL'
      : 'UNPAID';

    onUpdateBilling({
      ...billing,
      totalAmount,
      discount,
      netAmount,
      paidAmount,
      paymentStatus,
    });
    onClose();
  };

  const upiVpa = lab.upiId || '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full overflow-hidden border border-slate-200 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-slate-900 text-white px-4 sm:px-6 py-3.5 sm:py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0">
              <Receipt className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold truncate">Diagnostic Billing, GST & UPI Receipt</h3>
              <p className="text-[11px] text-slate-400 truncate">UHID: {report.patient.uhid} • {report.patient.name}</p>
            </div>
          </div>
          <button
            id="close-billing-modal-btn"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSave} className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1 text-xs">
          {/* Tests Rate Breakdown */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block mb-2">
              Itemized Test Panel Charges
            </span>
            <div className="space-y-1.5 divide-y divide-slate-200">
              {report.tests.map((t, idx) => (
                <div key={idx} className="flex justify-between items-center pt-1.5 text-xs">
                  <span className="font-semibold text-slate-800 truncate mr-2">{t.testName}</span>
                  <span className="font-mono font-bold text-slate-900 shrink-0">₹{t.price}</span>
                </div>
              ))}
            </div>

            <div className="border-t border-slate-300 mt-2.5 pt-2 flex justify-between items-center font-bold">
              <span className="text-slate-700">Subtotal Amount:</span>
              <span className="font-mono text-slate-900">₹{billing.totalAmount}</span>
            </div>
          </div>

          {/* Discount & Payment Mode */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">
                Discount Concession (₹)
              </label>
              <div className="flex">
                <span className="bg-slate-100 border border-r-0 border-slate-300 px-2.5 py-1.5 text-slate-600 rounded-l-lg font-bold">
                  ₹
                </span>
                <input
                  id="billing-discount-input"
                  type="number"
                  min={0}
                  max={billing.totalAmount}
                  value={billing.discount}
                  onChange={(e) => handleDiscountChange(Number(e.target.value) || 0)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-r-lg font-mono font-bold text-slate-900"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">
                Amount Paid (₹)
              </label>
              <div className="flex">
                <span className="bg-slate-100 border border-r-0 border-slate-300 px-2.5 py-1.5 text-slate-600 rounded-l-lg font-bold">
                  ₹
                </span>
                <input
                  id="billing-paid-input"
                  type="number"
                  min={0}
                  max={billing.netAmount}
                  step="0.01"
                  value={billing.paidAmount}
                  onChange={(e) => handlePaidAmountChange(Number(e.target.value) || 0)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-r-lg font-mono font-bold text-slate-900"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">
                Payment Status
              </label>
              <select
                id="billing-payment-status-select"
                value={billing.paymentStatus}
                onChange={(e) => {
                  const paymentStatus = e.target.value as BillingInfo['paymentStatus'];
                  setBilling({
                    ...billing,
                    paymentStatus,
                    paidAmount: paymentStatus === 'PAID'
                      ? billing.netAmount
                      : paymentStatus === 'UNPAID'
                      ? 0
                      : Math.min(billing.paidAmount, billing.netAmount),
                  });
                }}
                className="w-full px-2.5 py-2 border border-slate-300 rounded-lg font-bold text-slate-900"
              >
                <option value="PAID">PAID (Settled)</option>
                <option value="PARTIAL">PARTIAL (Advance)</option>
                <option value="UNPAID">UNPAID (Due)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">
                Payment Method / Mode
              </label>
              <select
                id="billing-payment-mode-select"
                value={billing.paymentMethod}
                onChange={(e) => setBilling({ ...billing, paymentMethod: e.target.value as BillingInfo['paymentMethod'] })}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-slate-800"
              >
                <option value="UPI">UPI (GPay / PhonePe / Paytm)</option>
                <option value="Cash">Cash at Reception</option>
                <option value="Card">Debit / Credit Card</option>
                <option value="Online">Online Portal</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">
                UPI / Bank Transaction Reference (UTR)
              </label>
              <input
                id="billing-txn-ref-input"
                type="text"
                value={billing.transactionRef || ''}
                onChange={(e) => setBilling({ ...billing, transactionRef: e.target.value })}
                placeholder="e.g. UTR-4938210984"
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg font-mono text-slate-800"
              />
            </div>
          </div>

          {/* Total Net Payable & QR Code Section */}
          <div className="bg-indigo-50/70 border border-indigo-200 rounded-xl p-3.5 sm:p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <span className="text-[10px] font-bold text-indigo-900 uppercase tracking-wider block">
                Net Bill Amount Payable
              </span>
              <div className="text-2xl sm:text-3xl font-black text-indigo-950 font-mono mt-0.5">
                ₹{billing.netAmount}
              </div>
              <p className="text-[11px] text-indigo-700 mt-1">
                UPI ID: <span className="font-mono font-bold">{upiVpa}</span>
              </p>
            </div>

            {/* UPI QR Code */}
            <div className="flex flex-col items-center bg-white p-2 rounded-lg border border-indigo-100 shadow-xs">
              {upiQrUrl ? (
                <img src={upiQrUrl} alt="UPI QR Code" className="w-24 h-24 sm:w-28 sm:h-28" />
              ) : (
                <div className="w-24 h-24 sm:w-28 sm:h-28 flex items-center justify-center text-center text-[10px] text-slate-500">
                  Configure a UPI ID to generate a QR code.
                </div>
              )}
              <span className="text-[9px] font-bold text-slate-500 mt-1 uppercase">Scan & Pay via UPI</span>
            </div>
          </div>

          {/* Footer Save */}
          <div className="bg-slate-50 -mx-4 sm:-mx-6 -mb-4 sm:-mb-6 px-4 sm:px-6 py-3.5 border-t border-slate-200 flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-lg text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              id="save-billing-btn"
              type="submit"
              className="flex items-center gap-1.5 bg-indigo-700 hover:bg-indigo-800 text-white px-5 py-2 rounded-lg text-xs font-bold transition-colors shadow-xs"
            >
              <Check className="w-4 h-4" />
              <span>Update Billing Receipt</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
