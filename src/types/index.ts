import { Role, CourseStatus, PaymentStatus } from '@prisma/client'

export type { Role, CourseStatus, PaymentStatus }

export interface ActionResult<T = void> {
  success: boolean
  data?: T
  error?: string
  fieldErrors?: Record<string, string[]>
}

export interface PaginationParams {
  page?: number
  limit?: number
}

export interface PaginatedResult<T> {
  data: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface CourseWithMeta {
  id: string
  title: string
  slug: string
  shortDesc: string | null
  price: number
  currency: string
  thumbnailUrl: string | null
  level: string | null
  language: string
  duration: number | null
  status: CourseStatus
  instructor: { firstName: string; lastName: string }
  category: { name: string; slug: string } | null
  _count: { enrollments: number; modules: number }
}

export interface EnrollmentWithCourse {
  id: string
  enrolledAt: Date
  course: {
    id: string
    title: string
    slug: string
    thumbnailUrl: string | null
    instructor: { firstName: string; lastName: string }
  }
  courseProgress: {
    percentage: number
    completedAt: Date | null
  } | null
}
