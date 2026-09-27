import QRCode from "qrcode";

export async function referralQrSvg(value: string) {
  const svg = await QRCode.toString(value, {
    type: "svg",
    margin: 1,
    errorCorrectionLevel: "M",
    color: { dark: "#0B1F3A", light: "#FFFFFF" },
  });
  return svg.replace(/^\uFEFF/, "").replace(/<\?xml[^>]*>/, "").trim();
}
