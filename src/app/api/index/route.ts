import { NextResponse } from 'next/server';

const BACKEND = 'http://localhost:8000';

export async function GET() {
  try {
    const res = await fetch(`${BACKEND}/api/index`, { next: { revalidate: 30 } });
    if (!res.ok) throw new Error(`Backend error: ${res.status}`);
    const data = await res.json();
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
