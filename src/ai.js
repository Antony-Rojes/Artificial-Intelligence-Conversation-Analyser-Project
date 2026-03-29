const GROQ_KEY = process.env.REACT_APP_GROQ_API_KEY;

export async function groqChat(prompt, maxTokens = 1500) {
  if (!GROQ_KEY) throw new Error('REACT_APP_GROQ_API_KEY missing in .env');

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GROQ_KEY}`,
    },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: maxTokens,
      temperature: 0.3,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Groq error ${res.status}`);
  }

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content || '{}';
  return text.replace(/```json\n?|\n?```/g, '').trim();
}

export async function groqTranscribe(audioFile) {
  if (!GROQ_KEY) throw new Error('REACT_APP_GROQ_API_KEY missing in .env');

  const formData = new FormData();
  formData.append('file', audioFile, audioFile.name);
  formData.append('model', 'whisper-large-v3-turbo');
  formData.append('response_format', 'text');
  formData.append('language', 'en');

  const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${GROQ_KEY}` },
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Whisper error ${res.status}`);
  }

  return await res.text();
}
