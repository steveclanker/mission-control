import { NextRequest } from 'next/server'
import { GET as scanGet } from '../scan/route'

export async function GET(request: NextRequest) {
  return scanGet(request)
}
