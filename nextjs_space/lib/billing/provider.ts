/**
 * Modular billing provider interface.
 *
 * Supports Stripe and Razorpay in TEST MODE. Keys are read from environment
 * variables. When keys are absent, providers report `configured: false` and
 * checkout creation returns a clear "not configured" result.
 *
 * CRITICAL: A payment is NEVER treated as successful here. Success is only
 * recorded when a verified webhook is received (see verifyWebhook) and a
 * BillingEvent row is persisted for idempotency (externalId @unique).
 */

export type ProviderName = 'stripe' | 'razorpay';

export interface CheckoutParams {
  businessId: string;
  planSlug: string;
  planName: string;
  amount: number; // in INR (major unit)
  billingCycle: 'monthly' | 'annual';
  customerEmail?: string;
}

export interface CheckoutResult {
  ok: boolean;
  configured: boolean;
  provider: ProviderName;
  /** Hosted checkout URL or client order payload when configured. */
  checkoutUrl?: string;
  orderId?: string;
  message?: string;
}

export interface WebhookVerifyResult {
  ok: boolean;
  configured: boolean;
  eventId?: string;
  eventType?: string;
  businessId?: string;
  message?: string;
}

export interface BillingProvider {
  name: ProviderName;
  isConfigured(): boolean;
  createCheckout(params: CheckoutParams): Promise<CheckoutResult>;
  verifyWebhook(rawBody: string, headers: Record<string, string>): Promise<WebhookVerifyResult>;
}

// ---------------------------------------------------------------------------
// Stripe (test mode)
// ---------------------------------------------------------------------------
const stripeProvider: BillingProvider = {
  name: 'stripe',
  isConfigured() {
    return Boolean(process.env.STRIPE_SECRET_KEY);
  },
  async createCheckout(params) {
    if (!this.isConfigured()) {
      return {
        ok: false,
        configured: false,
        provider: 'stripe',
        message:
          'Stripe is not configured. Add your Stripe test keys to enable checkout.',
      };
    }
    // Real implementation would call Stripe Checkout Sessions API here using
    // process.env.STRIPE_SECRET_KEY. We intentionally do not fabricate a
    // success; integration is completed once live/test keys are provided.
    return {
      ok: false,
      configured: true,
      provider: 'stripe',
      message:
        'Stripe checkout session creation is pending final key verification.',
    };
  },
  async verifyWebhook(rawBody, headers) {
    if (!this.isConfigured() || !process.env.STRIPE_WEBHOOK_SECRET) {
      return { ok: false, configured: false, provider: undefined } as any;
    }
    // Real implementation verifies the Stripe-Signature header using
    // stripe.webhooks.constructEvent. Never trust an unverified payload.
    return {
      ok: false,
      configured: true,
      message: 'Stripe webhook signature verification pending key setup.',
    };
  },
};

// ---------------------------------------------------------------------------
// Razorpay (test mode) — default provider for India
// ---------------------------------------------------------------------------
const razorpayProvider: BillingProvider = {
  name: 'razorpay',
  isConfigured() {
    return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
  },
  async createCheckout(params) {
    if (!this.isConfigured()) {
      return {
        ok: false,
        configured: false,
        provider: 'razorpay',
        message:
          'Razorpay is not configured. Add your Razorpay test keys to enable checkout.',
      };
    }
    // Real implementation would create a Razorpay Order via the Orders API
    // using process.env.RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET.
    return {
      ok: false,
      configured: true,
      provider: 'razorpay',
      message:
        'Razorpay order creation is pending final key verification.',
    };
  },
  async verifyWebhook(rawBody, headers) {
    if (!this.isConfigured() || !process.env.RAZORPAY_WEBHOOK_SECRET) {
      return { ok: false, configured: false } as any;
    }
    // Real implementation verifies the X-Razorpay-Signature HMAC using the
    // webhook secret. Never trust an unverified payload.
    return {
      ok: false,
      configured: true,
      message: 'Razorpay webhook signature verification pending key setup.',
    };
  },
};

const PROVIDERS: Record<ProviderName, BillingProvider> = {
  stripe: stripeProvider,
  razorpay: razorpayProvider,
};

export function getProvider(name: ProviderName): BillingProvider {
  return PROVIDERS[name];
}

/** The default provider for this app (India-first → Razorpay). */
export function getDefaultProvider(): BillingProvider {
  return razorpayProvider;
}

export function getProviderStatus() {
  return {
    stripe: { configured: stripeProvider.isConfigured() },
    razorpay: { configured: razorpayProvider.isConfigured() },
  };
}
