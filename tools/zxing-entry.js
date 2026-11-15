// Eingang zum Bündeln der Barcode-Erkennung nach js/vendor/zxing.js (npm run zxing) – nur Strichcodes EAN/UPC
export { default as BinaryBitmap } from '@zxing/library/esm/core/BinaryBitmap';
export { default as RGBLuminanceSource } from '@zxing/library/esm/core/RGBLuminanceSource';
export { default as HybridBinarizer } from '@zxing/library/esm/core/common/HybridBinarizer';
export { default as MultiFormatUPCEANReader } from '@zxing/library/esm/core/oned/MultiFormatUPCEANReader';
