import QRCode from "qrcode";

/** A QR code as an inline SVG string (no image file, no external service). Error correction M survives a printed or screen-shot QR. */
export async function qrSvg(text: string, size = 224): Promise<string> {
  const svg = await QRCode.toString(text, { type: "svg", errorCorrectionLevel: "M", margin: 2, color: { dark: "#111111", light: "#ffffff" } });
  return svg.replace("<svg ", `<svg width="${size}" height="${size}" role="img" aria-label="QR code" `);
}
