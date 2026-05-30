import { NextRequest, NextResponse } from 'next/server';
import { BACKEND_BASE_URL } from '@/lib/backend';

export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const days = req.nextUrl.searchParams.get('days') || '365';
  try {
    const res = await fetch(`${BACKEND_BASE_URL}/api/fund/${code}/nav?days=${days}`);
    if (!res.ok) throw new Error(`Backend error: ${res.status}`);
    const data = await res.json();
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
