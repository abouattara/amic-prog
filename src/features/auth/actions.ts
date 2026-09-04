'use server'

import { prisma } from '@/lib/prisma'
import { signIn, signOut } from '@/lib/auth'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import type { ActionResult } from '@/types'
import { notificationProvider } from '@/services/notification-provider'
import { AuthError } from 'next-auth'

const RegisterSchema = z
  .object({
    firstName: z.string().min(2, 'Prénom requis (min. 2 caractères)'),
    lastName: z.string().min(2, 'Nom requis (min. 2 caractères)'),
    email: z.string().email('Email invalide'),
    phone: z.string().optional(),
    password: z.string().min(8, 'Mot de passe : 8 caractères minimum'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Les mots de passe ne correspondent pas',
    path: ['confirmPassword'],
  })

export async function registerAction(formData: FormData): Promise<ActionResult<{ email: string }>> {
  const raw = {
    firstName: (formData.get('firstName') as string) || '',
    lastName: (formData.get('lastName') as string) || '',
    email: (formData.get('email') as string) || '',
    phone: (formData.get('phone') as string) || undefined,
    password: (formData.get('password') as string) || '',
    confirmPassword: (formData.get('confirmPassword') as string) || '',
  }

  const parsed = RegisterSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, fieldErrors: parsed.error.flatten().fieldErrors }
  }

  const { firstName, lastName, email, phone, password } = parsed.data

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    return { success: false, error: 'Un compte existe déjà avec cet email.' }
  }

  const passwordHash = await bcrypt.hash(password, 12)

  const user = await prisma.user.create({
    data: {
      firstName,
      lastName,
      email,
      phone: phone || null,
      passwordHash,
      profile: { create: {} },
    },
  })

  // Notify (fire-and-forget)
  notificationProvider
    .send({
      userId: user.id,
      event: 'ACCOUNT_CREATED',
      title: 'Bienvenue sur Amic-Academia !',
      body: `Bonjour ${firstName}, votre compte a été créé avec succès.`,
      email,
    })
    .catch(console.error)

  return { success: true, data: { email } }
}

export async function loginAction(formData: FormData): Promise<ActionResult> {
  try {
    await signIn('credentials', {
      email: (formData.get('email') as string) || '',
      password: (formData.get('password') as string) || '',
      redirect: false,
    })
    return { success: true }
  } catch (error) {
    if (error instanceof AuthError) {
      return { success: false, error: 'Email ou mot de passe incorrect.' }
    }
    throw error
  }
}

export async function logoutAction(): Promise<void> {
  await signOut({ redirectTo: '/' })
}

export async function forgotPasswordAction(formData: FormData): Promise<ActionResult> {
  const email = formData.get('email')
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return { success: false, error: 'Email invalide.' }
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, firstName: true },
  })

  // Always return success to avoid user enumeration
  if (user) {
    notificationProvider
      .send({
        userId: user.id,
        event: 'ACCOUNT_CREATED',
        title: 'Réinitialisation de votre mot de passe',
        body: `Bonjour ${user.firstName}, un lien de réinitialisation vous sera envoyé par email.`,
        email,
      })
      .catch(console.error)
  }

  return { success: true }
}
