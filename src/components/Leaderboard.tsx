import type { LeaderboardEntry } from '../lib/leaderboard'

interface Props {
  entries: LeaderboardEntry[]
  total: number
  userId?: string
  userRank?: number | null
  loading: boolean
}

export function Leaderboard({ entries, total, userId, userRank, loading }: Props) {
  return (
    <div className="leaderboard">
      <div className="lb-header">
        {userRank != null
          ? `Your rank: #${userRank} of ${total}`
          : 'Leaderboard'}
      </div>

      {loading ? (
        <div className="lb-loading">Loading...</div>
      ) : entries.length === 0 ? (
        <div className="lb-loading">No entries yet. Be the first!</div>
      ) : (
        <table className="lb-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Name</th>
              <th>Time</th>
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
                <td>{entry.displayTime}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {!loading && total > 0 && (
        <div className="lb-footer">{total} total {total === 1 ? 'entry' : 'entries'}</div>
      )}
    </div>
  )
}
