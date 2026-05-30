import { NextRequest, NextResponse } from 'next/server';
import { BACKEND_BASE_URL } from '@/lib/backend';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.url ? new URL(request.url) : { searchParams: new URLSearchParams() };
    const qs = searchParams.toString();
    const url = qs ? `${BACKEND_BASE_URL}/api/funds?${qs}` : `${BACKEND_BASE_URL}/api/funds`;
    const res = await fetch(url, { next: { revalidate: 60 } });
    if (!res.ok) throw new Error(`Backend error: ${res.status}`);
    const data = await res.json();
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
