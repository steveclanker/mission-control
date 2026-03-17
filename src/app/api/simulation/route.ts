import { NextRequest, NextResponse } from 'next/server';

const MIROFISH_API_URL = process.env.MIROFISH_API_URL || 'http://localhost:5001';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const endpoint = searchParams.get('endpoint');
  
  if (!endpoint) {
    return NextResponse.json({ error: 'Missing endpoint parameter' }, { status: 400 });
  }

  try {
    const response = await fetch(`${MIROFISH_API_URL}${endpoint}`);
    const data = await response.json();
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('MiroFish API Error:', error);
    return NextResponse.json({ error: 'Failed to connect to simulation service' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const endpoint = searchParams.get('endpoint');
  
  if (!endpoint) {
    return NextResponse.json({ error: 'Missing endpoint parameter' }, { status: 400 });
  }

  try {
    const body = await request.json();
    
    const response = await fetch(`${MIROFISH_API_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    
    const data = await response.json();
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('MiroFish API Error:', error);
    return NextResponse.json({ error: 'Failed to connect to simulation service' }, { status: 500 });
  }
}