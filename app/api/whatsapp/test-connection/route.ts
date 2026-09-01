import { NextResponse } from 'next/server';

const META_API_VERSION = 'v20.0';

// Verifies WhatsApp Business API credentials by fetching the phone number's
// own details from Meta - a simple, side-effect-free GET request. This lets
// an admin confirm their setup works right after entering credentials,
// rather than only discovering a typo'd token when a real reminder fails
// silently later.
export async function POST(request: Request) {
  try {
    const { phone_number_id, access_token } = await request.json();
    if (!phone_number_id || !access_token) {
      return NextResponse.json({ error: 'Phone Number ID and Access Token are both required to test the connection.' }, { status: 400 });
    }

    const res = await fetch(`https://graph.facebook.com/${META_API_VERSION}/${phone_number_id}?fields=verified_name,display_phone_number,quality_rating`, {
      headers: { 'Authorization': `Bearer ${access_token}` },
    });
    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json({ error: data?.error?.message || `Meta rejected these credentials (status ${res.status}).` }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      verifiedName: data.verified_name,
      displayPhoneNumber: data.display_phone_number,
      qualityRating: data.quality_rating,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Could not reach Meta\'s API to test the connection.' }, { status: 500 });
  }
}
