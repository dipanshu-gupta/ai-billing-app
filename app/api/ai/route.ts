import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { messages, system, max_tokens = 1024 } = body;

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'GROQ_API_KEY not set in .env.local' },
        { status: 500 }
      );
    }

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: system },
          ...messages,
        ],
        max_tokens,
        temperature: 0.7,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data?.error?.message || 'Groq API error' },
        { status: response.status }
      );
    }

    const text = data?.choices?.[0]?.message?.content || 'No response generated.';
    return NextResponse.json({ content: [{ type: 'text', text }] });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}