// Barcode mit der Kamera scannen: eingebaute Erkennung des Browsers (BarcodeDetector, z. B. Chrome am Android),
// sonst ZXing (js/vendor/zxing.js, fest im Projekt, wird erst beim Scannen geladen) – damit geht es auch am iPhone.
// Ohne Kamera: Nummer eintippen. Eigene Ebene über dem Fenster, damit die Suche offen bleibt.
import { ICON } from './icons.js';

const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e'];
const EVERY = 200;     // ms zwischen zwei Versuchen
const WIDTH = 720;     // Bildbreite für ZXing (kleiner = schneller)

// Erkennung wählen: liefert eine Funktion (video) => Code oder null
async function makeDetector() {
  if ('BarcodeDetector' in window) {
    try {
      const det = new window.BarcodeDetector({ formats: FORMATS });
      return async (video) => (await det.detect(video))[0]?.rawValue || null;
    } catch { /* Formate nicht unterstützt: ZXing nehmen */ }
  }
  const { BinaryBitmap, HybridBinarizer, MultiFormatUPCEANReader, RGBLuminanceSource } = await import('./vendor/zxing.js');
  const reader = new MultiFormatUPCEANReader(new Map());
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  return (video) => {
    const vw = video.videoWidth, vh = video.videoHeight;
    if (!vw) return null;
    // mittlerer Streifen des Bildes (dort liegt die rote Linie), verkleinert
    const sh = Math.round(vh * 0.4), sy = Math.round((vh - sh) / 2);
    const w = Math.min(WIDTH, vw), h = Math.round((sh * w) / vw);
    canvas.width = w; canvas.height = h;
    ctx.drawImage(video, 0, sy, vw, sh, 0, 0, w, h);
    const px = ctx.getImageData(0, 0, w, h).data, lum = new Uint8ClampedArray(w * h);
    for (let i = 0, j = 0; j < lum.length; i += 4, j++) lum[j] = (px[i] * 77 + px[i + 1] * 150 + px[i + 2] * 29) >> 8;
    try {
      return reader.decode(new BinaryBitmap(new HybridBinarizer(new RGBLuminanceSource(lum, w, h))), new Map()).getText();
    } catch { return null; }   // in diesem Bild kein Code gefunden
  };
}

export function scanBarcode() {
  return new Promise((resolve) => {
    const canCam = !!navigator.mediaDevices?.getUserMedia;
    const el = document.createElement('div');
    el.className = 'backdrop confirm-backdrop';
    el.innerHTML = `<div class="confirm bc">
      <div class="confirm-q">Barcode</div>
      ${canCam ? '<div class="bc-cam"><video playsinline muted></video><i class="bc-line"></i></div>' : ''}
      <form class="bc-form"><input class="input" inputmode="numeric" pattern="[0-9]*" maxlength="14" placeholder="oder Nummer eintippen" aria-label="Barcode-Nummer">
        <button class="cbtn" type="submit" aria-label="Suchen">${ICON.arrow}</button></form>
      <div class="confirm-actions"><button type="button" class="btn secondary" data-no>Abbrechen</button></div></div>`;
    document.body.appendChild(el);

    let stream = null, timer = 0, ended = false;
    const done = (code) => {
      if (ended) return;
      ended = true;
      clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
      el.remove();
      resolve(code && /^\d{6,14}$/.test(code) ? code : null);
    };
    el.addEventListener('click', (e) => { if (e.target === el) done(null); });
    el.querySelector('[data-no]').addEventListener('click', () => done(null));
    el.querySelector('.bc-form').addEventListener('submit', (e) => { e.preventDefault(); done(e.target.querySelector('input').value.replace(/\D/g, '')); });
    const noCam = () => {   // keine Kamera oder kein Zugriff: nur eintippen
      stream?.getTracks().forEach((t) => t.stop());
      el.querySelector('.bc-cam')?.remove();
      if (!ended) el.querySelector('input').focus();
    };
    if (!canCam) return noCam();

    const video = el.querySelector('video');
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 } }, audio: false }).then(async (s) => {
      stream = s;
      if (ended) return s.getTracks().forEach((t) => t.stop());
      const detect = await makeDetector();
      video.srcObject = s;
      await video.play();
      // nacheinander prüfen (nie zwei Versuche gleichzeitig)
      const tick = async () => {
        if (ended) return;
        const code = await Promise.resolve().then(() => detect(video)).catch(() => null);
        if (code) { navigator.vibrate?.(20); return done(code); }
        timer = setTimeout(tick, EVERY);
      };
      tick();
    }).catch(noCam);
  });
}
