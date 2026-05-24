import { NextRequest, NextResponse } from 'next/server';

const BACKEND = 'http://localhost:8000';

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q') || '';
  try {
    const res = await fetch(`${BACKEND}/api/search?q=${encodeURIComponent(q)}`);
    if (!res.ok) throw new Error(`Backend error: ${res.status}`);
    const data = await res.json();
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
