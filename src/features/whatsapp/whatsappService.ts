import { DiagnosticReport, LabProfile } from '@/domain/types';

export function sanitizeIndianPhone(phone: string): string {
  // Extract only digits
  let digits = phone.replace(/\D/g, '');
  // If 10 digits, prepend 91
  if (digits.length === 10) {
    digits = `91${digits}`;
  }
  // If 11 digits starting with 0, replace with 91
  if (digits.startsWith('0') && digits.length === 11) {
    digits = `91${digits.slice(1)}`;
  }
  return digits;
}

export interface WhatsAppFormatOptions {
  templateType?: 'standard' | 'detailed' | 'urgent' | 'hindi';
  includeInterpretation?: boolean;
  includeUPIReceipt?: boolean;
}

export function generateWhatsAppMessage(
  report: DiagnosticReport,
  lab: LabProfile,
  options?: WhatsAppFormatOptions
): string {
  const templateType = options?.templateType || 'standard';
  const includeInterpretation = options?.includeInterpretation ?? true;
  const includeUPIReceipt = options?.includeUPIReceipt ?? true;

  const patient = report.patient;
  const testNames = report.tests.map((t) => t.testName).join(', ');
  
  // Find abnormal findings
  const abnormalList: string[] = [];
  report.tests.forEach((t) => {
    t.parameters.forEach((p) => {
      if (p.flag && p.flag !== 'NORMAL') {
        const arrow = p.flag === 'HIGH' || p.flag === 'CRITICAL_HIGH' ? '🔺 HIGH' : '🔻 LOW';
        abnormalList.push(`• *${p.name}*: ${p.value} ${p.unit} (${arrow})`);
      }
    });
  });

  const appUrl = typeof window !== 'undefined' ? window.location.origin : 'https://labpulse.in';
  const reportLink = `${appUrl}/#report-${report.reportNumber}`;

  if (templateType === 'hindi') {
    return `🏥 *${lab.name.toUpperCase()}*
📍 ${lab.city}, ${lab.state} | 📞 WhatsApp: ${lab.whatsapp}

प्रिय *${patient.name}* जी,
आपकी लैब जाँच रिपोर्ट (Report ID: *${report.reportNumber}*) तैयार और वेरिफाइड है।

📋 *जाँच का विवरण (Tests Conducted):*
${testNames}

${
  abnormalList.length > 0
    ? `⚠️ *महत्वपूर्ण परिणाम (Important Findings):*\n${abnormalList.slice(0, 5).join('\n')}\n`
    : `✅ *सभी मुख्य परिणाम सामान्य सीमा में हैं (All key parameters in normal limits).*\n`
}
${
  includeInterpretation && report.patientSummaryHi
    ? `💡 *डॉक्टर सारांश:*\n"${report.patientSummaryHi}"\n`
    : ''
}
📄 *डिजिटल रिपोर्ट देखें / डाउनलोड करें:*
${reportLink}

${includeUPIReceipt ? `💳 *बिल राशि:* ₹${report.billing.netAmount} (${report.billing.paymentStatus})\n` : ''}
👨‍⚕️ *कृपया इस रिपोर्ट को अपने परामर्शदाता चिकित्सक (${patient.referringDoctor || 'डॉक्टर'}) को दिखाएँ।*
_स्वस्थ रहें, सुरक्षित रहें!_`;
  }

  if (templateType === 'urgent') {
    return `🚨 *CRITICAL LAB ALERT - ${lab.name.toUpperCase()}*
Dear *${patient.name}*,

Your diagnostic evaluation (*${report.reportNumber}*) has been completed.
⚠️ *ATTENTION REQUIRED:* Certain parameters require priority medical review by your consulting doctor.

🧪 *Investigations:* ${testNames}
${abnormalList.length > 0 ? `\n*Flagged Values:*\n${abnormalList.join('\n')}\n` : ''}
${includeInterpretation && report.clinicalImpression ? `🔬 *Pathologist Impression:* ${report.clinicalImpression}\n` : ''}
🔗 *Access Full Diagnostic Document:*
${reportLink}

📞 Lab Helpline: ${lab.whatsapp}
Please consult *Dr. ${patient.referringDoctor}* immediately with this report.`;
  }

  if (templateType === 'detailed') {
    const abnormalSection =
      abnormalList.length > 0
        ? `\n🚨 *KEY ATTENTION PARAMETERS:*\n${abnormalList.join('\n')}\n`
        : `\n✅ *OBSERVATION:* All recorded parameters fall within standard reference intervals.\n`;

    const impressionSection = includeInterpretation && report.clinicalImpression
      ? `\n🔬 *PATHOLOGIST IMPRESSION:*\n${report.clinicalImpression}\n`
      : '';

    const billingSection = includeUPIReceipt
      ? `\n💳 *Billing:* ₹${report.billing.netAmount} (${report.billing.paymentStatus} - Receipt Attached)`
      : '';

    return `🏥 *${lab.name.toUpperCase()}*
*NABL ACCREDITED DIAGNOSTIC REPORT NOTIFICATION*
━━━━━━━━━━━━━━━━━━━━━━
👤 *Patient Name:* ${patient.name} (${patient.age} ${patient.ageUnit} / ${patient.gender})
🆔 *UHID / Lab No:* ${patient.uhid} | *Report ID:* ${report.reportNumber}
👨‍⚕️ *Referred By:* ${patient.referringDoctor || 'Self'}
📅 *Sample Date:* ${new Date(patient.sampleCollectedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
━━━━━━━━━━━━━━━━━━━━━━
🧪 *TESTS COMPLETED:*
${testNames}
${abnormalSection}${impressionSection}${billingSection}

🔗 *VIEW & DOWNLOAD VERIFIED DIGITAL REPORT:*
${reportLink}

📌 _This is an authorized diagnostic document verified by ${lab.signatories[0]?.name || 'Chief Pathologist'}. Kindly consult your physician for clinical correlation and prescription._

━━━━━━━━━━━━━━━━━━━━━━
📞 Lab WhatsApp / Helpdesk: ${lab.whatsapp}
🌐 ${lab.email}`;
  }

  // Standard template
  return `🏥 *${lab.name}*
Dear *${patient.name}*,

Your Diagnostic Test Report (*${report.reportNumber}*) is ready and verified.

🗓 *Date:* ${new Date(patient.reportGeneratedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
🧪 *Tests Conducted:* ${testNames}
${abnormalList.length > 0 ? `⚠️ *Finding:* ${abnormalList.length} parameter(s) flagged outside standard range.` : `✅ *Status:* Parameters within normal reference range.`}

${includeInterpretation && report.patientSummaryEn ? `💡 *Summary:* ${report.patientSummaryEn}\n` : ''}
${includeUPIReceipt ? `💳 *Bill Status:* ₹${report.billing.netAmount} (${report.billing.paymentStatus})\n` : ''}
📥 *View & Download PDF Report:*
${reportLink}

For inquiries, WhatsApp our Lab Helpdesk at ${lab.whatsapp}.
Kindly share this report with your consulting physician: *${patient.referringDoctor || 'Doctor'}*.`;
}

export function openWhatsAppChat(phone: string, message: string): void {
  const cleanPhone = sanitizeIndianPhone(phone);
  const encodedText = encodeURIComponent(message);
  
  // Use universal WhatsApp Web / App API link
  const url = `https://wa.me/${cleanPhone}?text=${encodedText}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}
