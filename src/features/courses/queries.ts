import { prisma } from '@/lib/prisma'
import type { PaginationParams, PaginatedResult, CourseWithMeta } from '@/types'
import { CourseStatus } from '@prisma/client'

export async function getPublishedCourses(
  params: PaginationParams & { search?: string; categorySlug?: string }
): Promise<PaginatedResult<CourseWithMeta>> {
  const page = params.page ?? 1
  const limit = params.limit ?? 12
  const skip = (page - 1) * limit

  const where = {
    status: CourseStatus.PUBLISHED,
    ...(params.search
      ? {
          OR: [
            { title: { contains: params.search, mode: 'insensitive' as const } },
            { shortDesc: { contains: params.search, mode: 'insensitive' as const } },
          ],
        }
      : {}),
    ...(params.categorySlug ? { category: { slug: params.categorySlug } } : {}),
  }

  const [data, total] = await Promise.all([
    prisma.course.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        slug: true,
        shortDesc: true,
        price: true,
        currency: true,
        thumbnailUrl: true,
        level: true,
        language: true,
        duration: true,
        status: true,
        instructor: { select: { firstName: true, lastName: true } },
        category: { select: { name: true, slug: true } },
        _count: { select: { enrollments: true, modules: true } },
      },
    }),
    prisma.course.count({ where }),
  ])

  return { data: data as CourseWithMeta[], total, page, limit, totalPages: Math.ceil(total / limit) }
}

export async function getCourseBySlug(slug: string, userId?: string) {
  const course = await prisma.course.findUnique({
    where: { slug },
    include: {
      instructor: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
      category: true,
      modules: {
        orderBy: { position: 'asc' },
        include: {
          lessons: {
            orderBy: { position: 'asc' },
            select: { id: true, title: true, type: true, isFree: true, position: true, video: { select: { duration: true } } },
          },
        },
      },
      _count: { select: { enrollments: true } },
    },
  })

  if (!course) return null

  let enrollment = null
  if (userId) {
    enrollment = await prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId: course.id } },
      include: { courseProgress: true },
    })
  }

  return { course, enrollment }
}

export async function getUserEnrollments(userId: string) {
  return prisma.enrollment.findMany({
    where: { userId },
    orderBy: { enrolledAt: 'desc' },
    include: {
      course: {
        select: {
          id: true, title: true, slug: true, thumbnailUrl: true,
          instructor: { select: { firstName: true, lastName: true } },
        },
      },
      courseProgress: { select: { percentage: true, completedAt: true } },
    },
  })
}

export async function checkEnrollment(userId: string, courseId: string): Promise<boolean> {
  const e = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId } },
    select: { id: true },
  })
  return !!e
}
