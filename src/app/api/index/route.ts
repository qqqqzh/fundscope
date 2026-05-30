import { NextResponse } from 'next/server';
import { BACKEND_BASE_URL } from '@/lib/backend';

export async function GET() {
  try {
    const res = await fetch(`${BACKEND_BASE_URL}/api/index`, { next: { revalidate: 30 } });
    if (!res.ok) throw new Error(`Backend error: ${res.status}`);
    const data = await res.json();
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
