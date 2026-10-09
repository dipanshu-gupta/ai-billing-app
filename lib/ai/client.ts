// Client-side helper: friendly text for /api/ai error payloads.
export function aiErrorText(data: any): string {
  if (data?.code === 'AI_NOT_CONFIGURED') {
    return data.isAdmin
      ? 'AI is not set up yet. Set it up in Admin Tools > AI Settings.'
      : 'AI is not set up yet. Ask your administrator to set up AI.';
  }
  return data?.error || 'AI is unavailable right now.';
}
