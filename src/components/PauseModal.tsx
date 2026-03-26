import { Button, Stack, Text, Title, Divider } from '@mantine/core'
import type { GameOptions } from '../game/types'

type Difficulty = 'easy' | 'normal' | 'hard' | 'custom'

function difficultyLabel(difficulty: Difficulty, options: GameOptions): string {
  if (difficulty === 'easy')   return 'Easy — 10 monsters · No Leshen · No torch burnout'
  if (difficulty === 'normal') return 'Normal — 20 monsters · Leshen · No torch burnout'
  if (difficulty === 'hard')   return 'Hard — 30 monsters · Leshen · Torch burnout: 2:30'
  // custom
  const parts = [`${options.monsterCount} monsters`]
  parts.push(options.leshenEnabled ? 'Leshen' : 'No Leshen')
  if (options.torchBurnoutEnabled) {
    const m = Math.floor(options.torchTimerSeconds / 60)
    const s = String(options.torchTimerSeconds % 60).padStart(2, '0')
    parts.push(`Torch burnout: ${m}:${s}`)
  } else {
    parts.push('No torch burnout')
  }
  return `Custom — ${parts.join(' · ')}`
}

interface Props {
  difficulty: Difficulty
  options: GameOptions
  onResume: () => void
  onRestart: () => void
  onMainMenu: () => void
  onOptions: () => void
}

export function PauseModal({ difficulty, options, onResume, onRestart, onMainMenu, onOptions }: Props) {
  return (
    <div className="pause-backdrop" onClick={onResume}>
      <div className="pause-modal" onClick={(e) => e.stopPropagation()}>
        <Stack gap="sm" align="stretch">
          <Title order={2} className="pause-title">Paused</Title>
          <Text size="xs" c="dimmed" ta="center">{difficultyLabel(difficulty, options)}</Text>
          <Divider />
          <Button onClick={onResume}>Resume</Button>
          <Button variant="subtle" onClick={onOptions}>Options</Button>
          <Button variant="subtle" onClick={onRestart}>Restart</Button>
          <Button variant="subtle" onClick={onMainMenu}>Main Menu</Button>
        </Stack>
      </div>
    </div>
  )
}
