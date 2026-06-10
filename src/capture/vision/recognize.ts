import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'

// Greenfield capture engine: instead of local CV (which failed on real dice — see
// src/capture/README.md), send the photo to Claude's vision API and let a model that
// was trained on real-world images do the reading. Costs ~a cent per photo, needs
// network + an API key, but should generalize across dice styles/lighting.

export const MODEL = 'claude-opus-4-8'

const DieSchema = z.object({
  face: z
    .number()
    .int()
    .min(1)
    .max(6)
    .describe('The value showing on the TOP face of the die (1-6).'),
  look: z
    .string()
    .describe(
      'Very short visual description so a human can match it, e.g. "red, white pips" or "white, black pips".',
    ),
  confidence: z
    .enum(['high', 'medium', 'low'])
    .describe('How sure you are of this read. Use "low" for blurry, occluded, or cocked dice.'),
})

const ReadingSchema = z.object({
  dice: z
    .array(DieSchema)
    .describe('One entry per die visible in the photo, in reading order (left-to-right, top-to-bottom).'),
  notes: z
    .string()
    .describe(
      'One short sentence flagging anything ambiguous (occluded dice, dice cut off at the edge, unusual pip styles). Empty string if nothing to flag.',
    ),
})

export type DieReading = z.infer<typeof DieSchema>
export type DiceReading = z.infer<typeof ReadingSchema>

export interface RecognizeResult {
  reading: DiceReading
  ms: number
  inputTokens: number
  outputTokens: number
}

const PROMPT = `This photo shows six-sided dice that were just rolled (for a game of Liar's Dice).

Read the TOP face of every die visible in the photo. Be careful and methodical:
- Dice vary a lot: white, black, or colored bodies; white, black, or gold pips; sometimes engraved or worn.
- Count pips by their geometric layout (center pip = odd; 4/6 are corner grids), not by overall blob size.
- Only read the TOP face. Side faces visible at an angle are not the value.
- Include every die, even partially visible ones — use confidence "low" if a read is a guess.
- Do not invent dice that are not there; shadows, reflections, and table texture are not dice.`

// Anthropic's vision sweet spot: ~1568px on the long edge. Bigger images are
// downscaled server-side anyway, so resizing client-side just saves upload time.
const MAX_EDGE = 1568

export async function fileToBase64Jpeg(file: File): Promise<{ dataUrl: string; base64: string }> {
  const url = URL.createObjectURL(file)
  try {
    const img = await loadImage(url)
    const scale = Math.min(1, MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight))
    const w = Math.round(img.naturalWidth * scale)
    const h = Math.round(img.naturalHeight * scale)
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(img, 0, 0, w, h)
    // Re-encoding via canvas also normalizes formats the API can't take (e.g. iPhone HEIC).
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9)
    return { dataUrl, base64: dataUrl.split(',')[1] }
  } finally {
    URL.revokeObjectURL(url)
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Could not decode that image.'))
    img.src = url
  })
}

export async function recognizeDice(apiKey: string, base64Jpeg: string): Promise<RecognizeResult> {
  const client = new Anthropic({
    apiKey,
    // This is a client-side-only PWA: the key is the user's own, pasted on-device
    // and kept in localStorage, so browser access is the intended deployment.
    dangerouslyAllowBrowser: true,
  })

  const started = performance.now()
  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    thinking: { type: 'adaptive' },
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: base64Jpeg } },
          { type: 'text', text: PROMPT },
        ],
      },
    ],
    output_config: { format: zodOutputFormat(ReadingSchema) },
  })
  const ms = performance.now() - started

  if (!response.parsed_output) {
    throw new Error('The model response could not be parsed — try another photo.')
  }
  return {
    reading: response.parsed_output,
    ms,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  }
}

export function friendlyError(err: unknown): string {
  if (err instanceof Anthropic.AuthenticationError) {
    return 'API key was rejected — double-check it (it should start with "sk-ant-").'
  }
  if (err instanceof Anthropic.RateLimitError) {
    return 'Rate limited by the API — wait a few seconds and try again.'
  }
  if (err instanceof Anthropic.APIConnectionError) {
    return 'Could not reach the Claude API — is the phone online?'
  }
  if (err instanceof Anthropic.APIError) {
    return `API error ${err.status}: ${err.message}`
  }
  return err instanceof Error ? err.message : String(err)
}
