import { NextRequest, NextResponse } from 'next/server';

const BACKEND = 'http://localhost:8000';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  try {
    const res = await fetch(`${BACKEND}/api/fund/${code}/analyze`);
    if (!res.ok) throw new Error(`Backend error: ${res.status}`);
    const data = await res.json();
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
