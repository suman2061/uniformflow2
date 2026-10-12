/**
 * Outbound messaging provider stubs: WhatsApp, Email, SMS.
 *
 * These are intentionally thin interfaces. In-app notifications (Notification
 * model) are the primary, fully-working channel. External messaging requires
 * paid provider accounts and, in India, DLT/template registration — so these
 * are left as documented stubs that report `configured: false` until the
 * relevant credentials are supplied.
 *
 * Required environment variables (set when the business is ready to go live):
 *  - WhatsApp (Meta Cloud API): WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_ACCESS_TOKEN
 *      Costs: per-conversation pricing; templates need Meta approval.
 *  - Email: handled via the built-in platform notification email for owner
 *      alerts; a bulk provider (e.g. SendGrid) would use SENDGRID_API_KEY.
 *  - SMS (e.g. MSG91 / Twilio): SMS_API_KEY, SMS_SENDER_ID
 *      Costs: per-message; India requires DLT-registered templates.
 */

export type MessageChannel = 'whatsapp' | 'email' | 'sms';

export interface SendMessageParams {
  to: string;
  template: string;
  variables?: Record<string, string>;
  body?: string;
}

export interface SendResult {
  ok: boolean;
  configured: boolean;
  channel: MessageChannel;
  message?: string;
}

function whatsappConfigured() {
  return Boolean(process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_ACCESS_TOKEN);
}
function smsConfigured() {
  return Boolean(process.env.SMS_API_KEY && process.env.SMS_SENDER_ID);
}
function emailConfigured() {
  return Boolean(process.env.ABACUSAI_API_KEY || process.env.SENDGRID_API_KEY);
}

export async function sendMessage(
  channel: MessageChannel,
  _params: SendMessageParams
): Promise<SendResult> {
  const configured =
    channel === 'whatsapp' ? whatsappConfigured() : channel === 'sms' ? smsConfigured() : emailConfigured();

  if (!configured) {
    return {
      ok: false,
      configured: false,
      channel,
      message: `${channel} provider is not configured. Add the required credentials to enable this channel.`,
    };
  }

  // Real send implementation goes here once provider credentials are supplied.
  return {
    ok: false,
    configured: true,
    channel,
    message: `${channel} send is pending final provider verification.`,
  };
}

export function getMessagingStatus() {
  return {
    whatsapp: { configured: whatsappConfigured() },
    sms: { configured: smsConfigured() },
    email: { configured: emailConfigured() },
  };
}
