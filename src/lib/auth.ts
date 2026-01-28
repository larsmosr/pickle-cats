import { createServerFn } from '@tanstack/react-start'
import { deleteCookie, getCookie, setCookie } from '@tanstack/react-start/server'

const AUTH_COOKIE_NAME = 'pickle-cats-auth'
const THIRTY_DAYS_IN_SECONDS = 30 * 24 * 60 * 60

// Server function to check if user is authenticated
export const getAuthStatus = createServerFn({ method: 'GET' }).handler(async () => {
  const token = getCookie(AUTH_COOKIE_NAME)
  return { isAuthenticated: !!token }
})

// Server function to log in
export const login = createServerFn({ method: 'POST' })
  .inputValidator((data: { password: string }) => data)
  .handler(async ({ data }) => {
    const correctPassword = process.env.APP_PASSWORD

    if (!correctPassword) {
      throw new Error('APP_PASSWORD environment variable not set')
    }

    if (data.password !== correctPassword) {
      return { success: false }
    }

    // Generate a session token
    const token = crypto.randomUUID()

    // Set HttpOnly cookie with 30-day expiration
    setCookie(AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: THIRTY_DAYS_IN_SECONDS,
      path: '/',
    })

    return { success: true }
  })

// Server function to log out
export const logout = createServerFn({ method: 'POST' }).handler(async () => {
  deleteCookie(AUTH_COOKIE_NAME, {
    path: '/',
  })
  return { success: true }
})

// Helper to check auth status in beforeLoad (runs on server)
export const isAuthenticated = createServerFn({ method: 'GET' }).handler(async () => {
  const token = getCookie(AUTH_COOKIE_NAME)
  return !!token
})
