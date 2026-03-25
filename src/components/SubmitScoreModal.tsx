import { useState } from 'react'
import { getUsername, setUsername } from '../lib/storage'
import { submitScore } from '../lib/leaderboard'
import type { GameStats } from '../lib/leaderboard'

interface Props {
  timeSeconds: number
  displayTime: string
  userId: string
  stats?: GameStats
  onDone: (submitted: boolean) => void
}

export function SubmitScoreModal({ timeSeconds, displayTime, userId, stats, onDone }: Props) {
  const [name, setName] = useState(getUsername())
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit() {
    const trimmed = name.trim() || 'Anonymous'
    setUsername(trimmed)
    setSubmitting(true)
    await submitScore(trimmed, timeSeconds, displayTime, userId, stats)
    setSubmitting(false)
    onDone(true)
  }

  function handleSkip() {
    onDone(false)
  }

  return (
    <div className="submit-backdrop">
      <div className="submit-modal">
        <h2 className="modal-title">You Escaped!</h2>
        <p className="modal-subtitle">Submit your time to the leaderboard?</p>
        <div className="submit-time">{displayTime}</div>
        <div className="submit-name-row">
          <label className="submit-name-label">Name</label>
          <input
            className="submit-name-input"
            type="text"
            maxLength={24}
            placeholder="Anonymous"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit() }}
            autoFocus
          />
        </div>
        <div className="submit-actions">
          <button className="btn" onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Submitting...' : 'Submit'}
          </button>
          <button className="btn btn-secondary" onClick={handleSkip} disabled={submitting}>
            Skip
          </button>
        </div>
      </div>
    </div>
  )
}
