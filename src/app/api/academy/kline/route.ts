import { NextRequest, NextResponse } from 'next/server';

const BACKEND = 'http://localhost:8000';

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get('symbol') || 'sh000300';
  const days = req.nextUrl.searchParams.get('days') || '120';
  try {
    const res = await fetch(`${BACKEND}/api/academy/kline?symbol=${symbol}&days=${days}`);
    if (!res.ok) throw new Error(`Backend error: ${res.status}`);
    const data = await res.json();
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
