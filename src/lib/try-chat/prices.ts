export const TRY_PRICE_REFUSAL =
  "I can't quote a price in this test. The business confirms prices. Nothing was sent and nothing was charged.";

const MONEY = /(?:R|ZAR|USD|\$|£)\s?\d[\d\s,]*(?:[.,]\d{2})?|\b\d[\d\s,]*(?:[.,]\d{2})?\s*(?:rand|zar)\b/i;

export function mentionsMoney(text: string) {
  return MONEY.test(text);
}

/** Replace a reply that states a price. Grounded facts do not include fees. */
export function guardTryReply(text: string) {
  const reply = text.trim();
  if (!reply || !mentionsMoney(reply)) return reply;
  return TRY_PRICE_REFUSAL;
}
