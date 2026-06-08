import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { messages, system, max_tokens = 1024 } = body;
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY not set in .env.local' }, { status: 500 });
    }

    // Convert messages to Gemini format
    const geminiMessages = messages.map((m: any) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    // Prepend system prompt as first user message
    const contents = [
      { role: 'user',  parts: [{ text: system }] },
      { role: 'model', parts: [{ text: 'Understood. I am ready to assist as the Business Advisor Agent.' }] },
      ...geminiMessages,
    ];

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          generationConfig: { maxOutputTokens: max_tokens, temperature: 0.7 },
        }),
      }
    );

    const data = await response.json();
    if (!response.ok) {
      return NextResponse.json({ error: data?.error?.message || 'Gemini API error' }, { status: response.status });
    }

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'No response generated.';
    // Return in Anthropic-compatible format so AIAdvisorChat doesn't need changes
    return NextResponse.json({ content: [{ type: 'text', text }] });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}