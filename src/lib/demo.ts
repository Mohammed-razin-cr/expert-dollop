/**
 * A deliberately small, database-free fallback for the public Vercel demo.
 *
 * It activates only when no API key was configured. Local and production
 * installations with an API continue to use the normal authentication flow.
 */
export const isDemoMode = () => !process.env.NEXT_PUBLIC_ANON_KEY

export const DEMO_SESSION_COOKIE = 'oms-demo-session'
export const DEMO_EMAIL = 'saqib@electrobtech.in'
