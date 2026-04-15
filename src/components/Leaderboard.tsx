import { useState } from 'react'
import type { LeaderboardEntry } from '../lib/leaderboard'

interface Props {
  entries: LeaderboardEntry[]
  total: number
  userId?: string
  userRank?: number | null
  loading: boolean
}

function stat(value: number | null | undefined): string {
  return value == null ? '—' : String(value)
}

export function Leaderboard({ entries, total, userId, userRank, loading }: Props) {
  const [showExtra, setShowExtra] = useState(false)

  return (
    <div className="leaderboard">
      <div className="lb-header">
        <span>
          {userRank != null
            ? `Your rank: #${userRank} of ${total}`
            : 'Leaderboard'}
        </span>
        {!loading && entries.length > 0 && (
          <button className="lb-toggle-btn" onClick={() => setShowExtra((v) => !v)}>
            {showExtra ? 'Hide stats' : 'Show stats'}
          </button>
        )}
      </div>

      {loading ? (
        <div className="lb-loading">Loading...</div>
      ) : entries.length === 0 ? (
        <div className="lb-loading">No entries yet. Be the first!</div>
      ) : (
        <div className="lb-scroll">
          <table className="lb-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Name</th>
                <th>Time</th>
                {showExtra && (
                  <>
                    <th className="lb-th-extra">Steps</th>
                    <th className="lb-th-extra">Enemies</th>
                    <th className="lb-th-extra">Crows</th>
                    <th className="lb-th-extra">Avg HR</th>
                    <th className="lb-th-extra">Max HR</th>
                    <th className="lb-th-extra">Leshen</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, i) => (
                <tr
                  key={entry.id}
                  className={entry.userId === userId ? 'lb-row-highlight' : ''}
                >
                  <td>{i + 1}</td>
                  <td>{entry.username}</td>
                  <td className="lb-td-time">{entry.displayTime}</td>
                  {showExtra && (
                    <>
                      <td className="lb-td-extra">{stat(entry.stepsTaken)}</td>
                      <td className="lb-td-extra">{stat(entry.enemiesNoticed)}</td>
                      <td className="lb-td-extra">{stat(entry.crowsSpooked)}</td>
                      <td className="lb-td-extra">{stat(entry.avgHeartRate)}</td>
                      <td className="lb-td-extra">{stat(entry.maxHeartRate)}</td>
                      <td className="lb-td-extra">{stat(entry.leshenSteps)}</td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && total > 0 && (
        <div className="lb-footer">{total} total {total === 1 ? 'entry' : 'entries'}</div>
      )}
    </div>
  )
}
