import net from "node:net";
import tls from "node:tls";
import { buildSmsLink, buildWaLink, isSendEnabled, toE164, type DeliveryRequest, type DeliveryResult, type EnvLike } from "@/lib/automation/channels";
import { ensureMarketingFooter, quoteSendCost } from "@/lib/automation/compliance";

function queued(message: DeliveryRequest, provider: string): DeliveryResult {
  return {
    status: "queued",
    provider,
    providerId: "",
    waLink: manualLink(message),
    error: "",
    body: message.body,
  };
}

function blocked(message: DeliveryRequest, error: string): DeliveryResult {
  return {
    status: "blocked",
    provider: "suppressed",
    providerId: "",
    waLink: "",
    error,
    body: message.body,
  };
}

function quoteOnto(result: DeliveryResult, message: DeliveryRequest, env: EnvLike): DeliveryResult {
  const sentAt = message.sentAt ? new Date(message.sentAt) : new Date();
  const quote = quoteSendCost({
    channel: message.channel,
    provider: result.provider,
    category: message.category ?? "service",
    status: result.status,
    sentAt: Number.isNaN(sentAt.getTime()) ? new Date() : sentAt,
    serviceSendsThisMonth: message.serviceSendsThisMonth ?? 0,
    env,
  });
  return { ...result, body: message.body, ...quote };
}

function manualLink(message: DeliveryRequest) {
  if (message.channel === "whatsapp") return buildWaLink(message.to, message.body);
  if (message.channel === "sms") return buildSmsLink(message.to, message.body);
  return "";
}

/**
 * Delivery stays behind AUTOMATION_SEND_ENABLED (default off).
 * When the switch is off this returns immediately and does not call a provider.
 */
export async function deliverMessage(
  message: DeliveryRequest,
  env: EnvLike = process.env,
  fetchImpl: typeof fetch = fetch,
): Promise<DeliveryResult> {
  const category = message.category ?? "service";
  const body = category === "marketing" ? ensureMarketingFooter(message.body, message.owner || "Billy") : message.body;
  const prepared: DeliveryRequest = { ...message, body, category };

  if (prepared.suppressed) {
    return quoteOnto(blocked(prepared, "Suppressed. This address opted out."), prepared, env);
  }
  if (category === "marketing" && prepared.marketingConsent !== true) {
    return quoteOnto(blocked(prepared, "POPIA: marketing needs recorded opt-in consent before this can send."), prepared, env);
  }
  if (!isSendEnabled(env)) return quoteOnto(queued(prepared, "outbox"), prepared, env);

  if (prepared.channel === "email") {
    if (env.RESEND_API_KEY) return quoteOnto(await sendResend(prepared, env, fetchImpl), prepared, env);
    if (env.SMTP_HOST) return quoteOnto(await sendSmtp(prepared, env), prepared, env);
    return quoteOnto(
      {
        status: "failed",
        provider: "email",
        providerId: "",
        waLink: "",
        error: "No email provider configured. Set RESEND_API_KEY or SMTP_HOST.",
      },
      prepared,
      env,
    );
  }

  if (prepared.channel === "sms") return quoteOnto(await sendSms(prepared, env, fetchImpl), prepared, env);

  if (env.WHATSAPP_TOKEN && env.WHATSAPP_PHONE_NUMBER_ID) {
    return quoteOnto(await sendWhatsAppCloud(prepared, env, fetchImpl), prepared, env);
  }

  return quoteOnto(queued(prepared, "wa.me"), prepared, env);
}

async function sendSms(message: DeliveryRequest, env: EnvLike, fetchImpl: typeof fetch): Promise<DeliveryResult> {
  const link = buildSmsLink(message.to, message.body);
  const to = toE164(message.to);
  if (!to) {
    return { status: "failed", provider: "sms", providerId: "", waLink: "", error: "SMS needs a phone number." };
  }

  if (env.BULKSMS_TOKEN_ID && env.BULKSMS_TOKEN_SECRET) {
    return postBulkSms(message, to, link, env.BULKSMS_TOKEN_ID, env.BULKSMS_TOKEN_SECRET, fetchImpl);
  }
  if (env.BULKSMS_USERNAME && env.BULKSMS_PASSWORD) {
    return postBulkSms(message, to, link, env.BULKSMS_USERNAME, env.BULKSMS_PASSWORD, fetchImpl);
  }
  if (env.CLICKATELL_API_KEY) return postClickatell(message, to, link, env.CLICKATELL_API_KEY, fetchImpl);
  if (env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_FROM_NUMBER) {
    return postTwilio(message, to, link, env, fetchImpl);
  }

  return {
    status: "failed",
    provider: "sms",
    providerId: "",
    waLink: link,
    error: "No SMS provider configured. Set BULKSMS_TOKEN_ID and BULKSMS_TOKEN_SECRET, or CLICKATELL_API_KEY, or TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_FROM_NUMBER.",
  };
}

async function postBulkSms(
  message: DeliveryRequest,
  to: string,
  link: string,
  user: string,
  secret: string,
  fetchImpl: typeof fetch,
): Promise<DeliveryResult> {
  const response = await fetchImpl("https://api.bulksms.com/v1/messages", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${user}:${secret}`).toString("base64")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([{ to, body: message.body }]),
  });
  const payload = (await response.json().catch(() => ({}))) as { id?: string; detail?: string; title?: string } | Array<{ id?: string }>;
  if (!response.ok) {
    const detail = Array.isArray(payload) ? "" : payload.detail || payload.title || "";
    return { status: "failed", provider: "bulksms", providerId: "", waLink: link, error: detail || `BulkSMS returned ${response.status}` };
  }
  const id = Array.isArray(payload) ? payload[0]?.id || "" : payload.id || "";
  return { status: "sent", provider: "bulksms", providerId: id, waLink: link, error: "" };
}

async function postClickatell(
  message: DeliveryRequest,
  to: string,
  link: string,
  apiKey: string,
  fetchImpl: typeof fetch,
): Promise<DeliveryResult> {
  const response = await fetchImpl("https://platform.clickatell.com/messages", {
    method: "POST",
    headers: {
      Authorization: apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messages: [{ channel: "sms", to: to.replace(/\D/g, ""), content: message.body }],
    }),
  });
  const payload = (await response.json().catch(() => ({}))) as {
    messages?: Array<{ apiMessageId?: string }>;
    error?: { description?: string };
  };
  if (!response.ok) {
    return {
      status: "failed",
      provider: "clickatell",
      providerId: "",
      waLink: link,
      error: payload.error?.description || `Clickatell returned ${response.status}`,
    };
  }
  return { status: "sent", provider: "clickatell", providerId: payload.messages?.[0]?.apiMessageId || "", waLink: link, error: "" };
}

async function postTwilio(
  message: DeliveryRequest,
  to: string,
  link: string,
  env: EnvLike,
  fetchImpl: typeof fetch,
): Promise<DeliveryResult> {
  const sid = env.TWILIO_ACCOUNT_SID || "";
  const token = env.TWILIO_AUTH_TOKEN || "";
  const body = new URLSearchParams({ To: to, From: env.TWILIO_FROM_NUMBER || "", Body: message.body });
  const response = await fetchImpl(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const payload = (await response.json().catch(() => ({}))) as { sid?: string; message?: string };
  if (!response.ok) {
    return { status: "failed", provider: "twilio", providerId: "", waLink: link, error: payload.message || `Twilio returned ${response.status}` };
  }
  return { status: "sent", provider: "twilio", providerId: payload.sid || "", waLink: link, error: "" };
}

async function sendResend(
  message: DeliveryRequest,
  env: EnvLike,
  fetchImpl: typeof fetch,
): Promise<DeliveryResult> {
  const from = env.RESEND_FROM || "AI AutoTech <billy@aiautotech.co.za>";
  const response = await fetchImpl("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [message.to],
      subject: message.subject || "AI AutoTech",
      text: message.body,
    }),
  });
  const payload = (await response.json().catch(() => ({}))) as { id?: string; message?: string };
  if (!response.ok) {
    return {
      status: "failed",
      provider: "resend",
      providerId: "",
      waLink: "",
      error: payload.message || `Resend returned ${response.status}`,
    };
  }
  return { status: "sent", provider: "resend", providerId: payload.id || "", waLink: "", error: "" };
}

async function sendWhatsAppCloud(
  message: DeliveryRequest,
  env: EnvLike,
  fetchImpl: typeof fetch,
): Promise<DeliveryResult> {
  const to = message.to.replace(/\D/g, "");
  const version = env.WHATSAPP_GRAPH_VERSION || "v21.0";
  const response = await fetchImpl(
    `https://graph.facebook.com/${version}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { preview_url: false, body: message.body },
      }),
    },
  );
  const payload = (await response.json().catch(() => ({}))) as {
    messages?: Array<{ id?: string }>;
    error?: { message?: string };
  };
  if (!response.ok) {
    return {
      status: "failed",
      provider: "whatsapp_cloud",
      providerId: "",
      waLink: buildWaLink(message.to, message.body),
      error: payload.error?.message || `WhatsApp returned ${response.status}`,
    };
  }
  return {
    status: "sent",
    provider: "whatsapp_cloud",
    providerId: payload.messages?.[0]?.id || "",
    waLink: buildWaLink(message.to, message.body),
    error: "",
  };
}

async function sendSmtp(message: DeliveryRequest, env: EnvLike): Promise<DeliveryResult> {
  const host = env.SMTP_HOST || "";
  const port = Number(env.SMTP_PORT || 587);
  const user = env.SMTP_USER || "";
  const pass = env.SMTP_PASS || "";
  const from = env.SMTP_FROM || user;
  if (!host || !from) {
    return { status: "failed", provider: "smtp", providerId: "", waLink: "", error: "SMTP_HOST and SMTP_FROM are required." };
  }

  try {
    await smtpSend({ host, port, user, pass, from, to: message.to, subject: message.subject || "AI AutoTech", body: message.body });
    return { status: "sent", provider: "smtp", providerId: "", waLink: "", error: "" };
  } catch (error) {
    return {
      status: "failed",
      provider: "smtp",
      providerId: "",
      waLink: "",
      error: error instanceof Error ? error.message : "SMTP send failed",
    };
  }
}

function smtpSend(input: {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
  to: string;
  subject: string;
  body: string;
}) {
  const secure = input.port === 465;
  return new Promise<void>((resolve, reject) => {
    const socket = secure
      ? tls.connect({ host: input.host, port: input.port, servername: input.host })
      : net.connect({ host: input.host, port: input.port });
    let buffer = "";
    const queue: string[] = [];
    let secureUpgrade = false;

    const sendLine = (line: string) => socket.write(`${line}\r\n`);
    const fail = (error: Error) => {
      socket.destroy();
      reject(error);
    };

    socket.setTimeout(20_000, () => fail(new Error("SMTP timeout")));
    socket.on("error", fail);

    const step = (line: string) => {
      const code = Number(line.slice(0, 3));
      const next = queue.shift();
      if (!next) {
        if (code >= 400) fail(new Error(line));
        else resolve();
        return;
      }
      if (next === "STARTTLS") {
        sendLine("STARTTLS");
        secureUpgrade = true;
        return;
      }
      sendLine(next);
    };

    socket.on("data", (chunk) => {
      buffer += chunk.toString("utf8");
      if (!buffer.endsWith("\n")) return;
      const lines = buffer.trim().split(/\r?\n/);
      buffer = "";
      const line = lines[lines.length - 1] ?? "";
      if (secureUpgrade && line.startsWith("220")) {
        secureUpgrade = false;
        const clear = socket as net.Socket;
        const upgraded = tls.connect({ socket: clear, servername: input.host });
        upgraded.on("error", fail);
        upgraded.on("secureConnect", () => {
          queue.push("EHLO aiautotech.local");
          if (input.user) {
            queue.push(`AUTH LOGIN`);
            queue.push(Buffer.from(input.user).toString("base64"));
            queue.push(Buffer.from(input.pass).toString("base64"));
          }
          queue.push(...envelope(input));
          upgraded.write("EHLO aiautotech.local\r\n");
        });
        return;
      }
      if (line.startsWith("220") && queue.length === 0) {
        queue.push("EHLO aiautotech.local");
        if (!secure && input.port === 587) queue.push("STARTTLS");
        else {
          if (input.user) {
            queue.push("AUTH LOGIN");
            queue.push(Buffer.from(input.user).toString("base64"));
            queue.push(Buffer.from(input.pass).toString("base64"));
          }
          queue.push(...envelope(input));
        }
        step(line);
        return;
      }
      if (/^[45]/.test(line)) {
        fail(new Error(line));
        return;
      }
      step(line);
    });
  });
}

function envelope(input: { from: string; to: string; subject: string; body: string }) {
  const data = [
    `From: ${input.from}`,
    `To: ${input.to}`,
    `Subject: ${input.subject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=utf-8",
    "",
    input.body.replace(/^\./gm, ".."),
  ].join("\r\n");
  return [`MAIL FROM:<${addressOnly(input.from)}>`, `RCPT TO:<${input.to}>`, "DATA", `${data}\r\n.`, "QUIT"];
}

function addressOnly(value: string) {
  const match = value.match(/<([^>]+)>/);
  return match?.[1] || value;
}
