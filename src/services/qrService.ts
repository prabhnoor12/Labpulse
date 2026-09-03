import QRCode from 'qrcode';

export async function generateQrDataUrl(text: string): Promise<string> {
  try {
    return await QRCode.toDataURL(text, {
      width: 140,
      margin: 1,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'M',
    });
  } catch (err) {
    console.error('Failed to generate QR code', err);
    return '';
  }
}

export function generateUpiString(
  upiId: string,
  payeeName: string,
  amount: number,
  transactionNote: string
): string {
  const encName = encodeURIComponent(payeeName);
  const encNote = encodeURIComponent(transactionNote);
  return `upi://pay?pa=${upiId}&pn=${encName}&am=${amount.toFixed(2)}&cu=INR&tn=${encNote}`;
}
