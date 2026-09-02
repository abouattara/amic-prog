export interface InitiatePaymentParams {
  orderId: string
  amount: number
  currency: string
  phoneNumber?: string
  returnUrl: string
  webhookUrl: string
  metadata?: Record<string, string>
}

export interface InitiatePaymentResult {
  providerRef: string
  redirectUrl?: string
  instructions?: string
}

export interface WebhookVerifyResult {
  isValid: boolean
  orderId?: string
  providerRef?: string
  status: 'SUCCESS' | 'FAILED' | 'PENDING'
  rawPayload: Record<string, unknown>
}

export interface IPaymentProvider {
  initiatePayment(params: InitiatePaymentParams): Promise<InitiatePaymentResult>
  verifyWebhook(payload: string, signature: string): Promise<WebhookVerifyResult>
  refund(providerRef: string, amount: number, currency: string): Promise<void>
}

// ── Mock provider (dev / CI) ──────────────────────────────────────────────────
class MockPaymentProvider implements IPaymentProvider {
  async initiatePayment(params: InitiatePaymentParams): Promise<InitiatePaymentResult> {
    console.log(`[PaymentProvider:mock] initiate ${params.orderId} ${params.amount}${params.currency}`)
    const ref = `mock-ref-${params.orderId}`
    return {
      providerRef: ref,
      redirectUrl: `${params.returnUrl}?orderId=${params.orderId}&mock=1`,
    }
  }

  async verifyWebhook(payload: string, _signature: string): Promise<WebhookVerifyResult> {
    try {
      const data = JSON.parse(payload) as Record<string, unknown>
      return {
        isValid: true,
        orderId: data.orderId as string,
        providerRef: data.providerRef as string,
        status: (data.status as 'SUCCESS' | 'FAILED' | 'PENDING') ?? 'SUCCESS',
        rawPayload: data,
      }
    } catch {
      return { isValid: false, status: 'FAILED', rawPayload: {} }
    }
  }

  async refund(providerRef: string, amount: number, currency: string): Promise<void> {
    console.log(`[PaymentProvider:mock] refund ${providerRef} ${amount}${currency}`)
  }
}

function createPaymentProvider(): IPaymentProvider {
  const provider = process.env.PAYMENT_PROVIDER ?? 'mock'
  if (provider === 'mock') return new MockPaymentProvider()
  // Future: add CinetPay, Orange Money, etc.
  throw new Error(`Unknown PAYMENT_PROVIDER: ${provider}`)
}

export const paymentProvider = createPaymentProvider()
