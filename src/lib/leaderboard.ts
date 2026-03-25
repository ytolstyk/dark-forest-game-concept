import { Amplify } from 'aws-amplify'
import { generateClient } from 'aws-amplify/data'
import type { Schema } from '../../amplify/data/resource'

let client: ReturnType<typeof generateClient<Schema>> | null = null
let configAttempted = false

async function ensureClient(): Promise<ReturnType<typeof generateClient<Schema>> | null> {
  if (client) return client
  if (configAttempted) return null
  configAttempted = true
  try {
    const outputs = await import('../../amplify_outputs.json')
    Amplify.configure(outputs.default)
    client = generateClient<Schema>()
    return client
  } catch {
    return null
  }
}

export interface LeaderboardEntry {
  id: string
  username: string
  timeSeconds: number
  userId: string
  displayTime: string
  stepsTaken?: number | null
  enemiesNoticed?: number | null
  crowsSpooked?: number | null
  avgHeartRate?: number | null
  maxHeartRate?: number | null
  leshenSteps?: number | null
}

export interface GameStats {
  stepsTaken?: number
  enemiesNoticed?: number
  crowsSpooked?: number
  avgHeartRate?: number
  maxHeartRate?: number
  leshenSteps?: number
}

export interface LeaderboardResult {
  entries: LeaderboardEntry[]
  total: number
}

export async function submitScore(
  username: string,
  timeSeconds: number,
  displayTime: string,
  userId: string,
  stats?: GameStats,
): Promise<void> {
  const c = await ensureClient()
  if (!c) return
  await c.models.LeaderboardEntry.create({
    username,
    timeSeconds,
    userId,
    displayTime,
    stepsTaken: stats?.stepsTaken,
    enemiesNoticed: stats?.enemiesNoticed,
    crowsSpooked: stats?.crowsSpooked,
    avgHeartRate: stats?.avgHeartRate,
    maxHeartRate: stats?.maxHeartRate,
    leshenSteps: stats?.leshenSteps,
  })
}

export async function fetchLeaderboard(): Promise<LeaderboardResult> {
  const c = await ensureClient()
  if (!c) return { entries: [], total: 0 }

  const { data, errors } = await c.models.LeaderboardEntry.list({ limit: 1000 })
  if (errors || !data) return { entries: [], total: 0 }

  const sorted = [...data].sort((a, b) => (a.timeSeconds ?? 0) - (b.timeSeconds ?? 0))
  const total = sorted.length
  const top10 = sorted.slice(0, 10).map((e) => ({
    id: e.id,
    username: e.username ?? 'Unknown',
    timeSeconds: e.timeSeconds ?? 0,
    userId: e.userId ?? '',
    displayTime: e.displayTime ?? '',
    stepsTaken: e.stepsTaken ?? null,
    enemiesNoticed: e.enemiesNoticed ?? null,
    crowsSpooked: e.crowsSpooked ?? null,
    avgHeartRate: e.avgHeartRate ?? null,
    maxHeartRate: e.maxHeartRate ?? null,
    leshenSteps: e.leshenSteps ?? null,
  }))

  return { entries: top10, total }
}

export function getUserRank(userId: string, allEntries: { userId: string }[]): number | null {
  const idx = allEntries.findIndex((e) => e.userId === userId)
  return idx === -1 ? null : idx + 1
}
