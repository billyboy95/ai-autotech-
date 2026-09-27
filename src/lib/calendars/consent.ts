export function bookingConsentText(senderName: string) {
  const sender = senderName.trim() || "This workspace";
  return `I agree that ${sender} may store my name, phone, and email to arrange this appointment, and may contact me about this booking. I can ask for my details to be corrected or deleted. This is not marketing consent.`;
}

export function consentTextForLink(stored: string, senderName: string) {
  const custom = stored.trim();
  return custom.length >= 12 ? custom : bookingConsentText(senderName);
}
