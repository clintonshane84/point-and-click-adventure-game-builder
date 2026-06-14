export async function generateImageWithDalle(prompt: string, apiKey: string): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'dall-e-3',
      prompt,
      n: 1,
      size: '1024x1024',
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: { message?: string } }
    throw new Error(err?.error?.message ?? `OpenAI API error ${res.status}`)
  }
  const data = await res.json() as { data: { url: string }[] }
  const imageUrl = data.data[0].url

  // Fetch the image and convert to a base64 data URL so it can be embedded in the project
  const imgRes = await fetch(imageUrl)
  if (!imgRes.ok) throw new Error('Failed to download generated image')
  const blob = await imgRes.blob()
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('Failed to encode generated image'))
    reader.readAsDataURL(blob)
  })
}
