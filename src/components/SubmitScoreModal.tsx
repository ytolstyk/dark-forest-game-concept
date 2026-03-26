import { useState } from 'react'
import { Button } from '@mantine/core'
import { getUsername, setUsername } from '../lib/storage'
import { submitScore } from '../lib/leaderboard'
import type { GameStats, GameSettings } from '../lib/leaderboard'

interface Props {
  timeSeconds: number
  displayTime: string
  userId: string
  stats?: GameStats
  settings?: GameSettings
  onDone: (submitted: boolean) => void
}

export function SubmitScoreModal({ timeSeconds, displayTime, userId, stats, settings, onDone }: Props) {
  const [name, setName] = useState(getUsername())
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit() {
    const trimmed = name.trim() || 'Anonymous'
    setUsername(trimmed)
    setSubmitting(true)
    await submitScore(trimmed, timeSeconds, displayTime, userId, stats, settings)
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
          <Button onClick={handleSubmit} disabled={submitting} loading={submitting}>
            {submitting ? 'Submitting...' : 'Submit'}
          </Button>
          <Button variant="subtle" onClick={handleSkip} disabled={submitting}>
            Skip
          </Button>
        </div>
      </div>
    </div>
  )
}
