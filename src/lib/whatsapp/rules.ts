/** Deterministic checks that run before and after the LLM, so safety doesn't depend on the model. */

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[’'`]/g, "'")
    .replace(/[^\p{L}\p{N}'\s?]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Opt-out: the whole message is (basically) an opt-out word. "stop" inside a sentence doesn't count. */
export function isOptOut(text: string) {
  const t = norm(text).replace(/[?]/g, "").trim();
  return /^(please )?(stop|stop it|stop please|unsubscribe|opt out|optout|no thanks|no thank you|nah thanks|not interested|remove me|remove my number|don't message me|dont message me|do not message me|stop messaging me|stop texting me|nee dankie|stop asseblief|moenie my weer kontak nie|moenie weer boodskappe stuur nie)( please| thanks| thank you)?$/.test(
    t,
  );
}

export function isBotQuestion(text: string) {
  const t = norm(text);
  return (
    /\b(are|r) (you|u) (a |an )?(bot|robot|ai|chat ?bot|real|human|person|automated|machine|computer)\b/.test(t) ||
    /\b(is|iz) (this|it) (a |an )?(bot|robot|ai|chat ?bot|automated|real person|human|a real person|machine|auto ?reply)(?=\s*(\?|$|or\b|talking|replying|answering|chatting|responding|here|lol|haha))/.test(t) ||
    /\b(am i|i'm|im) (talking|chatting|speaking) (to|with) (a |an )?(bot|robot|ai|machine|real|human|person|computer)\b/.test(t) ||
    /\b(real person|real human|actual person|actual human)\b.*\?/.test(t) ||
    /\bis (jy|dit) ('n |n )?(robot|bot|rekenaar|regte mens|mens)\b/.test(t) ||
    /\bpraat ek met ('n |n )?(robot|bot|regte mens|mens)\b/.test(t) ||
    /^(bot|robot|ai|human|real person)\s*\?$/.test(t)
  );
}

export function wantsHuman(text: string) {
  const t = norm(text);
  return (
    /\b(speak|talk|chat) (to|with) (billy|a human|a person|someone|somebody|a real person|the owner|a manager|your boss|management)\b/.test(t) ||
    /\b(can|could|may) (billy|someone|somebody|a person|a human) (call|phone|contact|message)\b/.test(t) ||
    /\b(get|put) (billy|a human|a person|someone) (on|to)\b/.test(t) ||
    /\b(i want|i need|i'd like|id like|give me|get me) (a |to speak to a |to talk to a )?(human|real person|billy|person)\b/.test(t) ||
    /\bcall me\b/.test(t) ||
    /\b(praat met|skakel my|bel my)\b/.test(t)
  );
}

export function looksAngry(text: string) {
  const t = norm(text);
  return /\b(fuck|fok|f off|voetsek|bullshit|kak|scam|scammers|idiot|stupid|useless|pathetic|report you|lawyer|attorney|sue you|rubbish service|worst service|waste of (my )?time)\b/.test(
    t,
  );
}

export function looksLegal(text: string) {
  const t = norm(text);
  return /\b(contract|lawsuit|legal action|attorney|lawyer|popia complaint|information regulator|breach|refund|chargeback|terms and conditions)\b/.test(
    t,
  );
}

/** Phrases that must never appear in an outgoing message (honesty rule). */
export function claimsHuman(reply: string) {
  const t = norm(reply);
  return (
    /\b(i am|i'm|im|this is|it's|its) (billy|willem)(?!'s|'|\s+se\b)\b/.test(t) ||
    /\b(i am|i'm|im) (a )?(real person|human|real human|not a bot|not an ai|not a robot|not ai)\b/.test(t) ||
    /\bnot a (bot|robot)\b/.test(t) ||
    /\b(ek is|dis) ((billy|willem)(?!\s+se\b)|'n regte mens|n regte mens|'n mens|n mens|nie 'n robot|nie n robot)\b/.test(t)
  );
}

export function mentionsAi(reply: string) {
  return /\b(ai|a\.i\.|assistant|bot|kunsmatige|assistent|outomatiese)\b/i.test(reply);
}
