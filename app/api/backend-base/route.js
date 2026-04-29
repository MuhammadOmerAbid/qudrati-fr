import { NextResponse } from 'next/server'
import { resolveBackendBase } from '@/infrastructure/api/backendBaseResolver'

export const runtime = 'nodejs'

export async function GET() {
  const result = await resolveBackendBase()
  if (result.base) {
    return NextResponse.json(
      { base: result.base },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  }

  return NextResponse.json(
    {
      base: null,
      message: result.message,
    },
    { status: 503, headers: { 'Cache-Control': 'no-store' } }
  )
}

