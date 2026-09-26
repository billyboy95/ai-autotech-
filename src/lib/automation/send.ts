import net from "node:net";
import tls from "node:tls";
import { buildWaLink, isSendEnabled, type DeliveryRequest, type DeliveryResult, type EnvLike } from "@/lib/automation/channels";

function queued(message: DeliveryRequest, provider: string): DeliveryResult {
  return {
    status: "queued",
    provider,
    providerId: "",
    waLink: message.channel === "whatsapp" ? buildWaLink(message.to, message.body) : "",
    error: "",
  };
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
  if (!isSendEnabled(env)) return queued(message, "outbox");

  if (message.channel === "email") {
    if (env.RESEND_API_KEY) return sendResend(message, env, fetchImpl);
    if (env.SMTP_HOST) return sendSmtp(message, env);
    return {
      status: "failed",
      provider: "email",
      providerId: "",
      waLink: "",
      error: "No email provider configured. Set RESEND_API_KEY or SMTP_HOST.",
    };
  }

  if (env.WHATSAPP_TOKEN && env.WHATSAPP_PHONE_NUMBER_ID) {
    return sendWhatsAppCloud(message, env, fetchImpl);
  }

  return queued(message, "wa.me");
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
