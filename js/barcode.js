// Barcode: mit der Kamera scannen, wo der Browser es kann (BarcodeDetector, z. B. Chrome am Android),
// sonst die Nummer eintippen. Eigene Ebene über dem Fenster, damit die Suche offen bleibt.
import { ICON } from './icons.js';

const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e'];

export function scanBarcode() {
  return new Promise((resolve) => {
    const canScan = 'BarcodeDetector' in window && navigator.mediaDevices?.getUserMedia;
    const el = document.createElement('div');
    el.className = 'backdrop confirm-backdrop';
    el.innerHTML = `<div class="confirm bc">
      <div class="confirm-q">Barcode</div>
      ${canScan ? '<div class="bc-cam"><video playsinline muted></video><i class="bc-line"></i></div>' : ''}
      <form class="bc-form"><input class="input" inputmode="numeric" pattern="[0-9]*" maxlength="14" placeholder="Nummer unter dem Strichcode" aria-label="Barcode-Nummer">
        <button class="cbtn" type="submit" aria-label="Suchen">${ICON.arrow}</button></form>
      <div class="confirm-actions"><button type="button" class="btn secondary" data-no>Abbrechen</button></div></div>`;
    document.body.appendChild(el);

    let stream = null, timer = 0;
    const done = (code) => {
      clearInterval(timer);
      stream?.getTracks().forEach((t) => t.stop());
      el.remove();
      resolve(code && /^\d{6,14}$/.test(code) ? code : null);
    };
    el.addEventListener('click', (e) => { if (e.target === el) done(null); });
    el.querySelector('[data-no]').addEventListener('click', () => done(null));
    el.querySelector('.bc-form').addEventListener('submit', (e) => { e.preventDefault(); done(e.target.querySelector('input').value.replace(/\D/g, '')); });

    if (!canScan) return el.querySelector('input').focus();
    const video = el.querySelector('video');
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false }).then(async (s) => {
      if (!el.isConnected) return s.getTracks().forEach((t) => t.stop());
      stream = s;
      video.srcObject = s;
      await video.play();
      const det = new window.BarcodeDetector({ formats: FORMATS });
      timer = setInterval(async () => {
        try {
          const [hit] = await det.detect(video);
          if (hit?.rawValue) { navigator.vibrate?.(20); done(hit.rawValue); }
        } catch { /* nächster Versuch */ }
      }, 250);
    }).catch(() => { el.querySelector('.bc-cam')?.remove(); el.querySelector('input').focus(); });
  });
}
