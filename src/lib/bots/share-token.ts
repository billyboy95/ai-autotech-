/** 32 random bytes, hex. Used only as the public team-link key. */
export function newShareToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function isShareToken(value: string) {
  return /^[a-f0-9]{64}$/.test(value);
}
