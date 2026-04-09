import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const targetUrl = searchParams.get('url');

  if (!targetUrl) {
    return NextResponse.json({ error: 'Missing "url" parameter' }, { status: 400 });
  }

  try {
    // 1. YouTube Bypass (Microlink aggressively throttles YT)
    if (targetUrl.includes('youtube.com') || targetUrl.includes('youtu.be')) {
        const ytRes = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(targetUrl)}&format=json`);
        if (ytRes.ok) {
            const ytData = await ytRes.json();
            return NextResponse.json({
                title: ytData.title,
                description: "YouTube Video",
                image_url: ytData.thumbnail_url,
                provider_name: "YouTube",
                url: targetUrl
            });
        }
    }

    // 2. Generic Fallback
    const microlinkApi = `https://api.microlink.io?url=${encodeURIComponent(targetUrl)}`;
    
    const response = await fetch(microlinkApi);
    const data = await response.json();

    if (data.status === 'success') {
      return NextResponse.json({
        title: data.data.title,
        description: data.data.description,
        image_url: data.data.image?.url,
        provider_name: data.data.publisher,
        url: data.data.url
      });
    } else {
      return NextResponse.json({ error: 'Failed to unfurl URL' }, { status: 500 });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
