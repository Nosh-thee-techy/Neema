/**
 * Renders a real QR code from the nurse-summary payload.
 */

import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';

export function SummaryQr({ payload, label = 'Nurse summary QR code' }: { payload: string; label?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!payload || !canvasRef.current) return;
    setFailed(false);
    void QRCode.toCanvas(canvasRef.current, payload, {
      width: 200,
      margin: 2,
      color: { dark: '#1b1a33', light: '#ffffff' },
      errorCorrectionLevel: 'M',
    }).catch(() => setFailed(true));
  }, [payload]);

  if (!payload) {
    return (
      <div className="qr-placeholder" aria-hidden>
        Preparing…
      </div>
    );
  }

  if (failed) {
    return (
      <div className="qr-placeholder" role="img" aria-label="QR unavailable">
        QR unavailable — copy payload below
      </div>
    );
  }

  return (
    <canvas
      ref={canvasRef}
      className="qr-canvas"
      aria-label={label}
    />
  );
}
