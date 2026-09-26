export function serviceConsentText(senderName: string) {
  const sender = senderName.trim() || "This workspace";
  return `I agree that ${sender} may contact me about this enquiry, and I can opt out later.`;
}

export function marketingConsentText(senderName: string) {
  const sender = senderName.trim() || "This workspace";
  return `I consent to ${sender} sending me marketing by email, SMS, and WhatsApp. I can opt out at any time by replying STOP.`;
}
