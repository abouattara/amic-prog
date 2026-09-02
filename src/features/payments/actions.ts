'use server'

import { prisma } from '@/lib/prisma'
import { paymentProvider } from '@/services/payment-provider'
import { auth } from '@/lib/auth'
import type { ActionResult } from '@/types'

export async function initiatePaymentAction(courseId: string): Promise<ActionResult<{ redirectUrl?: string; orderId: string }>> {
  const session = await auth()
  if (!session?.user) return { success: false, error: 'Non authentifié.' }

  const course = await prisma.course.findUnique({
    where: { id: courseId, status: 'PUBLISHED' },
    select: { id: true, title: true, price: true, currency: true },
  })
  if (!course) return { success: false, error: 'Formation introuvable.' }

  // Already enrolled?
  const existing = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId: session.user.id, courseId } },
    select: { id: true },
  })
  if (existing) return { success: false, error: 'Vous êtes déjà inscrit à cette formation.' }

  // Free course → direct enrollment
  if (course.price === 0) {
    await createEnrollment(session.user.id, courseId, null)
    return { success: true, data: { orderId: 'free' } }
  }

  // Create order
  const order = await prisma.order.create({
    data: {
      userId: session.user.id,
      totalAmount: course.price,
      currency: course.currency,
      status: 'PENDING',
      items: { create: { courseId, price: course.price, currency: course.currency } },
    },
  })

  // Create pending payment
  const payment = await prisma.payment.create({
    data: {
      orderId: order.id,
      amount: course.price,
      currency: course.currency,
      status: 'PENDING',
    },
  })

  const appUrl = process.env.APP_URL!
  const result = await paymentProvider.initiatePayment({
    orderId: order.id,
    amount: course.price,
    currency: course.currency,
    returnUrl: `${appUrl}/dashboard/paiements`,
    webhookUrl: `${appUrl}/api/webhooks/payment`,
  })

  // Store providerRef
  await prisma.payment.update({
    where: { id: payment.id },
    data: { providerRef: result.providerRef },
  })

  return { success: true, data: { redirectUrl: result.redirectUrl, orderId: order.id } }
}

// Called only from webhook — idempotent
export async function confirmPaymentFromWebhook(orderId: string, providerRef: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    })
    if (!order) throw new Error(`Order not found: ${orderId}`)
    if (order.status === 'SUCCESS') return // idempotent — already processed

    await tx.order.update({ where: { id: orderId }, data: { status: 'SUCCESS' } })
    await tx.payment.updateMany({
      where: { orderId, providerRef },
      data: { status: 'SUCCESS', webhookReceivedAt: new Date() },
    })

    // Create enrollments
    for (const item of order.items) {
      await createEnrollment(order.userId, item.courseId, orderId, tx as typeof prisma)
    }
  })
}

async function createEnrollment(
  userId: string,
  courseId: string,
  orderId: string | null,
  tx: typeof prisma = prisma
) {
  // Idempotent: upsert
  const enrollment = await tx.enrollment.upsert({
    where: { userId_courseId: { userId, courseId } },
    create: { userId, courseId },
    update: {},
  })

  // Init course progress
  const totalLessons = await tx.lesson.count({
    where: { module: { courseId } },
  })
  await tx.courseProgress.upsert({
    where: { enrollmentId: enrollment.id },
    create: { enrollmentId: enrollment.id, totalLessons },
    update: {},
  })

  // Notify
  const { notificationProvider } = await import('@/services/notification-provider')
  await notificationProvider
    .send({
      userId,
      event: 'COURSE_ACCESS_GRANTED',
      title: 'Accès à la formation accordé !',
      body: `Votre accès à la formation a été activé. Bonne formation !`,
    })
    .catch(console.error)

  void orderId // unused but kept for future audit log
}
