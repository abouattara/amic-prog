import { NextRequest, NextResponse } from 'next/server'
import { paymentProvider } from '@/services/payment-provider'
import { confirmPaymentFromWebhook } from '@/features/payments/actions'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const signature = req.headers.get('x-payment-signature') ?? ''

  let verifyResult
  try {
    verifyResult = await paymentProvider.verifyWebhook(rawBody, signature)
  } catch {
    return NextResponse.json({ error: 'Webhook verification failed' }, { status: 400 })
  }

  if (!verifyResult.isValid) {
    return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 })
  }

  // Persist raw transaction event (idempotent)
  if (verifyResult.orderId && verifyResult.providerRef) {
    const payment = await prisma.payment.findFirst({
      where: { orderId: verifyResult.orderId, providerRef: verifyResult.providerRef },
    })

    if (payment) {
      await prisma.paymentTransaction.create({
        data: {
          paymentId: payment.id,
          event: verifyResult.status,
          payload: verifyResult.rawPayload as object,
        },
      })
    }

    if (verifyResult.status === 'SUCCESS') {
      await confirmPaymentFromWebhook(verifyResult.orderId, verifyResult.providerRef)
    }
  }

  return NextResponse.json({ received: true }, { status: 200 })
}
