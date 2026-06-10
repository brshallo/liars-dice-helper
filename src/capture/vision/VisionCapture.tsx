import { useRef, useState } from 'react'
import {
  MODEL,
  fileToBase64Jpeg,
  friendlyError,
  recognizeDice,
  type DieReading,
} from './recognize'
import './VisionCapture.css'

const KEY_STORAGE = 'dice-vision-api-key'
const PIPS = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅']

type Status = 'idle' | 'working' | 'done' | 'error'

export function VisionCapture() {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem(KEY_STORAGE) ?? '')
  const [keyDraft, setKeyDraft] = useState('')
  const [editingKey, setEditingKey] = useState(false)

  const [status, setStatus] = useState<Status>('idle')
  const [preview, setPreview] = useState<string | null>(null)
  const [dice, setDice] = useState<DieReading[]>([])
  const [notes, setNotes] = useState('')
  const [stats, setStats] = useState('')
  const [error, setError] = useState('')

  const cameraRef = useRef<HTMLInputElement>(null)
  const libraryRef = useRef<HTMLInputElement>(null)

  const saveKey = () => {
    const k = keyDraft.trim()
    if (!k) return
    localStorage.setItem(KEY_STORAGE, k)
    setApiKey(k)
    setKeyDraft('')
    setEditingKey(false)
  }

  const onFile = async (file: File | undefined) => {
    if (!file) return
    setStatus('working')
    setError('')
    setDice([])
    setNotes('')
    setStats('')
    try {
      const { dataUrl, base64 } = await fileToBase64Jpeg(file)
      setPreview(dataUrl)
      const result = await recognizeDice(apiKey, base64)
      setDice(result.reading.dice)
      setNotes(result.reading.notes)
      setStats(
        `${(result.ms / 1000).toFixed(1)}s · ${result.inputTokens} in / ${result.outputTokens} out tokens`,
      )
      setStatus('done')
    } catch (err) {
      setError(friendlyError(err))
      setStatus('error')
    }
  }

  const cycleFace = (i: number) =>
    setDice((d) => d.map((die, j) => (j === i ? { ...die, face: (die.face % 6) + 1 } : die)))
  const removeDie = (i: number) => setDice((d) => d.filter((_, j) => j !== i))
  const addDie = () =>
    setDice((d) => [...d, { face: 1, look: 'added by hand', confidence: 'high' }])

  const counts = [1, 2, 3, 4, 5, 6].map((f) => dice.filter((d) => d.face === f).length)
  const needsKey = !apiKey || editingKey

  return (
    <div className="vision">
      <header className="vision-head">
        <h1>Dice Vision</h1>
        <p>
          Snap a photo of your rolled dice — Claude ({MODEL}) reads the faces. Tap a die to fix a
          wrong read.
        </p>
      </header>

      {needsKey ? (
        <section className="vision-card key-card">
          <label className="vision-label" htmlFor="api-key">
            Anthropic API key
          </label>
          <p className="key-hint">
            Stays on this device (localStorage); calls go straight from your phone to the Claude
            API. Get one at console.anthropic.com.
          </p>
          <div className="key-row">
            <input
              id="api-key"
              type="password"
              inputMode="text"
              autoComplete="off"
              placeholder="sk-ant-…"
              value={keyDraft}
              onChange={(e) => setKeyDraft(e.target.value)}
            />
            <button className="primary" onClick={saveKey} disabled={!keyDraft.trim()}>
              Save
            </button>
            {apiKey && (
              <button className="ghost" onClick={() => setEditingKey(false)}>
                Cancel
              </button>
            )}
          </div>
        </section>
      ) : (
        <p className="key-status">
          Key saved (…{apiKey.slice(-4)}){' '}
          <button className="linkish" onClick={() => setEditingKey(true)}>
            change
          </button>
        </p>
      )}

      <section className="vision-card">
        <div className="shoot-row">
          <label className="primary shoot-btn">
            📷 Take photo
            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              hidden
              disabled={needsKey || status === 'working'}
              onChange={(e) => {
                void onFile(e.target.files?.[0])
                e.target.value = ''
              }}
            />
          </label>
          <label className="ghost shoot-btn">
            Choose from library
            <input
              ref={libraryRef}
              type="file"
              accept="image/*"
              hidden
              disabled={needsKey || status === 'working'}
              onChange={(e) => {
                void onFile(e.target.files?.[0])
                e.target.value = ''
              }}
            />
          </label>
        </div>
        <p className="shoot-hint">
          Best results: dice on a plain surface, shot from above, all dice in frame.
        </p>
      </section>

      {preview && (
        <section className="vision-card preview-card">
          <img className="preview-img" src={preview} alt="Your dice" />
          {status === 'working' && <div className="working-banner">Reading dice…</div>}
        </section>
      )}

      {status === 'error' && <p className="vision-error">{error}</p>}

      {status === 'done' && (
        <section className="vision-card results">
          <div className="results-head">
            <span className="vision-label">
              {dice.length} {dice.length === 1 ? 'die' : 'dice'} found
            </span>
            {stats && <span className="stats">{stats}</span>}
          </div>

          <div className="die-grid">
            {dice.map((die, i) => (
              <div key={i} className={`die-chip conf-${die.confidence}`}>
                <button
                  className="die-face"
                  onClick={() => cycleFace(i)}
                  title="Tap to cycle the face value"
                >
                  <span className="die-pips">{PIPS[die.face - 1]}</span>
                  <span className="die-num">{die.face}</span>
                </button>
                <span className="die-look">{die.look}</span>
                <button className="die-remove" onClick={() => removeDie(i)} aria-label="Remove die">
                  ×
                </button>
              </div>
            ))}
            <button className="ghost add-die" onClick={addDie}>
              + add die
            </button>
          </div>

          {notes && <p className="model-notes">⚠ {notes}</p>}

          <div className="counts-row">
            {counts.map((c, i) => (
              <div key={i} className={`count-cell${c > 0 ? ' has-some' : ''}`}>
                <span className="count-face">{PIPS[i]}</span>
                <span className="count-n">{c}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
