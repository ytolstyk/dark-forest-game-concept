import { useRef, useEffect, useState, useCallback } from 'react'
import type React from 'react'
import { Game } from './game/Game'
import { GameState, DEFAULT_GAME_OPTIONS } from './game/types'
import type { GameOptions } from './game/types'
import { DONATION_LINKS } from './game/constants'
import { getUserId, getUsername, setUsername } from './lib/storage'
import { fetchLeaderboard, getUserRank } from './lib/leaderboard'
import type { LeaderboardResult } from './lib/leaderboard'
import { Leaderboard } from './components/Leaderboard'
import { SubmitScoreModal } from './components/SubmitScoreModal'
import { PauseModal } from './components/PauseModal'
import './App.css'

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function HeartRateWidget({ bpm }: { bpm: number }) {
  const danger = bpm >= 150
  const elevated = bpm >= 110
  const color = danger ? '#ff3333' : elevated ? '#ff8844' : '#88cc88'
  const pulseDuration = `${(60 / bpm / 2).toFixed(2)}s`
  return (
    <div className="heart-rate-widget" style={{ borderColor: color, color }}>
      <span className="hr-icon" style={{ animationDuration: pulseDuration }}>♥</span>
      <span className="hr-value">{bpm}</span>
      <span className="hr-unit">bpm</span>
    </div>
  )
}

function MonsterCreature() {
  return (
    <div className="creature-body">
      <div className="creature-eyes">
        <div className="creature-eye" />
        <div className="creature-eye" />
      </div>
    </div>
  )
}

function SupportModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="support-backdrop" onClick={onClose}>
      <div className="support-creature support-creature-1"><MonsterCreature /></div>
      <div className="support-creature support-creature-2"><MonsterCreature /></div>
      <div className="support-modal" onClick={e => e.stopPropagation()}>
        <button className="modal-close-btn" onClick={onClose}>&#x2715;</button>
        <h2 className="modal-title">Support the Developer</h2>
        <p className="modal-subtitle">Enjoying Dark Forest? Help keep it alive.</p>
        <div className="modal-donate-btns">
          <a href={DONATION_LINKS.paypal} target="_blank" rel="noopener noreferrer" className="donate-btn donate-paypal">
            PayPal
          </a>
          <a href={DONATION_LINKS.venmo} target="_blank" rel="noopener noreferrer" className="donate-btn donate-venmo">
            Venmo
          </a>
        </div>
      </div>
    </div>
  )
}

function Footer({ onSupportClick }: { onSupportClick: () => void }) {
  return (
    <div className="screen-footer">
      <span className="footer-author">Yuriy Tolstykh</span>
      <span className="footer-sep">&middot;</span>
      <button className="footer-support-btn" onClick={onSupportClick}>Support</button>
    </div>
  )
}

const EMPTY_LB: LeaderboardResult = { entries: [], total: 0 }

interface OptionsPanelProps {
  onBack: () => void
  options: GameOptions
  setOptions: React.Dispatch<React.SetStateAction<GameOptions>>
  displayName: string
  onNameBlur: (value: string) => void
  onViewLeaderboard: () => void
  leaderboard: LeaderboardResult
  lbLoading: boolean
  userId: string
}

function OptionsPanel({ onBack, options, setOptions, displayName, onNameBlur, onViewLeaderboard, leaderboard, lbLoading, userId }: OptionsPanelProps) {
  const [showLb, setShowLb] = useState(false)

  function handleViewLeaderboard() {
    onViewLeaderboard()
    setShowLb(true)
  }

  if (showLb) {
    return (
      <div className="options-panel">
        <h2 className="options-title">Leaderboard</h2>
        <Leaderboard
          entries={leaderboard.entries}
          total={leaderboard.total}
          userId={userId}
          userRank={null}
          loading={lbLoading}
        />
        <div className="options-actions">
          <button className="btn" onClick={() => setShowLb(false)}>Back</button>
        </div>
      </div>
    )
  }

  return (
    <div className="options-panel">
      <h2 className="options-title">Options</h2>

      <div className="option-row">
        <label className="option-label">Volume</label>
        <div className="option-control">
          <input
            type="range" min={0} max={1} step={0.05}
            value={options.volume}
            className="option-slider"
            onChange={(e) => setOptions((o) => ({ ...o, volume: parseFloat(e.target.value) }))}
          />
          <span className="option-value">{Math.round(options.volume * 100)}%</span>
        </div>
      </div>

      <div className="option-row">
        <label className="option-label">Monsters</label>
        <div className="option-control">
          <input
            type="range" min={0} max={40} step={1}
            value={options.monsterCount}
            className="option-slider"
            onChange={(e) => setOptions((o) => ({ ...o, monsterCount: parseInt(e.target.value) }))}
          />
          <span className="option-value">{options.monsterCount}</span>
        </div>
      </div>

      <div className="option-row">
        <label className="option-label">The Leshen</label>
        <div className="option-control">
          <button
            className={`option-toggle ${options.leshenEnabled ? 'on' : 'off'}`}
            onClick={() => setOptions((o) => ({ ...o, leshenEnabled: !o.leshenEnabled }))}
          >
            {options.leshenEnabled ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>

      <div className="option-row">
        <label className="option-label">Name</label>
        <div className="option-control">
          <input
            type="text"
            className="option-name-input"
            maxLength={24}
            placeholder="Anonymous"
            defaultValue={displayName}
            onBlur={(e) => onNameBlur(e.target.value)}
          />
        </div>
      </div>

      <div className="option-row option-row-action">
        <label className="option-label">Leaderboard</label>
        <div className="option-control">
          <button className="option-toggle on" onClick={handleViewLeaderboard}>
            View
          </button>
        </div>
      </div>

      <div className="options-actions">
        <button className="btn btn-secondary" onClick={() => setOptions({ ...DEFAULT_GAME_OPTIONS })}>
          Reset Defaults
        </button>
        <button className="btn" onClick={onBack}>Back</button>
      </div>
    </div>
  )
}

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gameRef = useRef<Game | null>(null)
  const [gameState, setGameState] = useState<GameState>(GameState.MENU)
  const [loadProgress, setLoadProgress] = useState(0)
  const [torchOn, setTorchOn] = useState(false)
  const [inventory, setInventory] = useState({ keys: false, fuel: false })
  const [totalSteps, setTotalSteps] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const startTimeRef = useRef<number>(0)
  const [heartRate, setHeartRate] = useState(75)
  const [endAvgHR, setEndAvgHR] = useState(0)
  const [endMaxHR, setEndMaxHR] = useState(0)
  const [endEnemiesNoticed, setEndEnemiesNoticed] = useState(0)
  const [endCrowsSpooked, setEndCrowsSpooked] = useState(0)
  const [endLeshenSteps, setEndLeshenSteps] = useState(0)
  const [showOptions, setShowOptions] = useState(false)
  const [showSupport, setShowSupport] = useState(false)
  const [options, setOptions] = useState<GameOptions>({ ...DEFAULT_GAME_OPTIONS })

  // User identity
  const [userId] = useState(() => getUserId())
  const [displayName, setDisplayName] = useState(() => getUsername())

  // Pause
  const [isPaused, setIsPaused] = useState(false)
  const [pauseShowOptions, setPauseShowOptions] = useState(false)

  // Submit score modal (WIN flow)
  const [showSubmitModal, setShowSubmitModal] = useState(false)

  // Leaderboard state
  const [leaderboard, setLeaderboard] = useState<LeaderboardResult>(EMPTY_LB)
  const [lbLoading, setLbLoading] = useState(false)
  const [userRank, setUserRank] = useState<number | null>(null)

  // All entries (for rank calculation — top 1000 fetched internally)
  const allEntriesRef = useRef<{ userId: string }[]>([])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const game = new Game()
    gameRef.current = game

    game.init(canvas).then(() => {
      game.onStateChange((state: string) => {
        setGameState(state as GameState)
      })
    })

    return () => {
      game.destroy()
      gameRef.current = null
    }
  }, [])

  // Poll game state for HUD (lightweight)
  useEffect(() => {
    if (gameState !== GameState.PLAYING) return
    const interval = setInterval(() => {
      const scene = gameRef.current?.scene
      if (scene) {
        setTorchOn(scene.torchOn)
        setInventory({ ...scene.inventory })
        setTotalSteps(scene.totalSteps)
        setHeartRate(scene.heartRate)
      }
    }, 100)
    return () => clearInterval(interval)
  }, [gameState])

  // Capture stats when game ends
  useEffect(() => {
    if (gameState !== GameState.GAME_OVER && gameState !== GameState.WIN) return
    const scene = gameRef.current?.scene
    if (scene) {
      const avgHR = scene.avgHeartRate
      const maxHR = scene.maxHeartRate
      const enemiesNoticed = scene.enemiesNoticed
      const crowsSpooked = scene.crowsSpooked
      const leshenSteps = scene.leshenSteps
      setTimeout(() => {
        setEndAvgHR(avgHR)
        setEndMaxHR(maxHR)
        setEndEnemiesNoticed(enemiesNoticed)
        setEndCrowsSpooked(crowsSpooked)
        setEndLeshenSteps(leshenSteps)
      }, 0)
    }

    if (gameState === GameState.WIN) {
      // Show submit modal first; leaderboard loads after submit/skip
      setShowSubmitModal(true)
      setLeaderboard(EMPTY_LB)
      setUserRank(null)
    } else {
      // GAME_OVER: fetch leaderboard immediately (no rank)
      loadLeaderboard(null)
    }
  }, [gameState])

  async function loadLeaderboard(submittedUserId: string | null) {
    setLbLoading(true)
    try {
      const result = await fetchLeaderboard()
      setLeaderboard(result)
      if (submittedUserId) {
        // Re-fetch full list for accurate rank
        const rank = getUserRank(submittedUserId, allEntriesRef.current.length > 0
          ? allEntriesRef.current
          : result.entries)
        setUserRank(rank)
      }
    } catch {
      setLeaderboard(EMPTY_LB)
    } finally {
      setLbLoading(false)
    }
  }

  function handleSubmitDone(submitted: boolean) {
    setShowSubmitModal(false)
    // After submit or skip, load leaderboard; pass userId only if submitted
    loadLeaderboard(submitted ? userId : null)
  }

  // Timer — runs while playing
  useEffect(() => {
    if (gameState !== GameState.PLAYING) return
    startTimeRef.current = Date.now()
    setTimeout(() => setElapsed(0), 0)
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [gameState])

  // Escape key — pause / unpause during PLAYING
  useEffect(() => {
    if (gameState !== GameState.PLAYING) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsPaused((p) => {
          const next = !p
          if (next) gameRef.current?.pause()
          else gameRef.current?.resume()
          return next
        })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [gameState])

  // Reset pause state when leaving PLAYING
  useEffect(() => {
    if (gameState !== GameState.PLAYING) {
      setIsPaused(false)
      setPauseShowOptions(false)
    }
  }, [gameState])

  const joystickPadRef = useRef<HTMLDivElement>(null)
  const joystickKnobRef = useRef<HTMLDivElement>(null)
  const activeTouchId = useRef<number | null>(null)

  const handleJoystickStart = useCallback((e: React.TouchEvent) => {
    if (activeTouchId.current !== null) return
    activeTouchId.current = e.changedTouches[0].identifier
  }, [])

  const handleJoystickMove = useCallback((e: React.TouchEvent) => {
    const pad = joystickPadRef.current
    const knob = joystickKnobRef.current
    if (!pad || !knob || activeTouchId.current === null) return
    let touch: React.Touch | null = null
    for (let i = 0; i < e.touches.length; i++) {
      if (e.touches[i].identifier === activeTouchId.current) { touch = e.touches[i]; break }
    }
    if (!touch) return
    const rect = pad.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    const dx = touch.clientX - cx
    const dy = touch.clientY - cy
    const dist = Math.sqrt(dx * dx + dy * dy)
    const maxDist = rect.width / 2 - 8
    const clamped = Math.min(dist, maxDist)
    const nx = dist > 0 ? dx / dist : 0
    const ny = dist > 0 ? dy / dist : 0
    knob.style.transform = `translate(calc(-50% + ${nx * clamped}px), calc(-50% + ${ny * clamped}px))`
    gameRef.current?.scene?.input.setVirtualMove(nx * (clamped / maxDist), ny * (clamped / maxDist))
  }, [gameRef])

  const handleJoystickEnd = useCallback((e: React.TouchEvent) => {
    let found = false
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === activeTouchId.current) { found = true; break }
    }
    if (!found) return
    activeTouchId.current = null
    if (joystickKnobRef.current) joystickKnobRef.current.style.transform = 'translate(-50%, -50%)'
    gameRef.current?.scene?.input.setVirtualMove(0, 0)
  }, [gameRef])

  const handleTorchTap = useCallback((e: React.TouchEvent) => {
    e.stopPropagation()
    gameRef.current?.scene?.input.triggerVirtualPress('Space')
  }, [gameRef])

  const startGame = useCallback(async () => {
    const game = gameRef.current
    if (!game) return
    setLoadProgress(0)
    setGameState(GameState.LOADING)
    setShowOptions(false)
    setIsPaused(false)
    setPauseShowOptions(false)

    await game.startGame((pct) => setLoadProgress(pct), options)

    setGameState(GameState.PLAYING)
    setTorchOn(false)
    setInventory({ keys: false, fuel: false })
    setTotalSteps(0)
  }, [options])

  function handleResume() {
    setIsPaused(false)
    setPauseShowOptions(false)
    gameRef.current?.resume()
  }

  function handleMainMenu() {
    gameRef.current?.stopGame()
    setGameState(GameState.MENU)
    setIsPaused(false)
    setPauseShowOptions(false)
  }

  async function handleViewLeaderboard() {
    setLbLoading(true)
    try {
      const result = await fetchLeaderboard()
      setLeaderboard(result)
    } catch {
      setLeaderboard(EMPTY_LB)
    } finally {
      setLbLoading(false)
    }
  }

  function handleNameBlur(value: string) {
    const trimmed = value.trim()
    setDisplayName(trimmed)
    setUsername(trimmed)
  }

  const endStatsBlock = (
    <>
      <div className="end-stat">
        <span className="end-stat-label">survived</span>
        <span className="end-stat-value">{formatTime(elapsed)}</span>
      </div>
      <div className="end-stat-divider" />
      <div className="end-stat">
        <span className="end-stat-label">steps taken</span>
        <span className="end-stat-value">👣 {totalSteps}</span>
      </div>
      <div className="end-stat-divider" />
      <div className="end-stat">
        <span className="end-stat-label">enemies noticed you</span>
        <span className="end-stat-value">{endEnemiesNoticed}</span>
      </div>
      <div className="end-stat-divider" />
      <div className="end-stat">
        <span className="end-stat-label">crows spooked</span>
        <span className="end-stat-value">{endCrowsSpooked}</span>
      </div>
      {endLeshenSteps > 0 && (
        <>
          <div className="end-stat-divider" />
          <div className="end-stat">
            <span className="end-stat-label">leshen steps chasing you</span>
            <span className="end-stat-value end-stat-peak">{endLeshenSteps}</span>
          </div>
        </>
      )}
      <div className="end-stat-divider" />
      <div className="end-stat">
        <span className="end-stat-label">avg heart rate</span>
        <span className="end-stat-value">♥ {endAvgHR} bpm</span>
      </div>
      <div className="end-stat-divider" />
      <div className="end-stat">
        <span className="end-stat-label">peak heart rate</span>
        <span className="end-stat-value end-stat-peak">♥ {endMaxHR} bpm</span>
      </div>
    </>
  )

  return (
    <div className="game-container">
      <canvas ref={canvasRef} style={(isPaused && pauseShowOptions) || (gameState === GameState.MENU && showOptions) ? { pointerEvents: 'none' } : undefined} />

      {gameState === GameState.MENU && (
        <div className="overlay menu-overlay">
          <Footer onSupportClick={() => setShowSupport(true)} />
          <h1 className="menu-title">Dark Forest</h1>
          {!showOptions ? (
            <>
              <div className="menu-instructions">
                <p><kbd>WASD</kbd> or <kbd>Arrow Keys</kbd> to move</p>
                <p><kbd>Space</kbd> to toggle torch</p>
                <p>Find the <strong>keys</strong> and <strong>fuel</strong>, then reach the <strong>car</strong> to escape</p>
                <p>Your torch attracts creatures — use it wisely</p>
              </div>
              <button className="btn" onClick={startGame}>Start Game</button>
              <button className="btn btn-secondary" onClick={() => setShowOptions(true)}>Options</button>
            </>
          ) : (
            <OptionsPanel onBack={() => setShowOptions(false)} options={options} setOptions={setOptions} displayName={displayName} onNameBlur={handleNameBlur} onViewLeaderboard={handleViewLeaderboard} leaderboard={leaderboard} lbLoading={lbLoading} userId={userId} />
          )}
        </div>
      )}

      {gameState === GameState.LOADING && (
        <div className="overlay loading-overlay">
          <h2 className="loading-title">Generating Forest...</h2>
          <div className="progress-bar-track">
            <div
              className="progress-bar-fill"
              style={{ width: `${Math.round(loadProgress * 100)}%` }}
            />
          </div>
          <p className="loading-pct">{Math.round(loadProgress * 100)}%</p>
        </div>
      )}

      {gameState === GameState.PLAYING && (
        <>
          <div className="mobile-controls">
            <div
              ref={joystickPadRef}
              className="joystick-pad"
              onTouchStart={handleJoystickStart}
              onTouchMove={handleJoystickMove}
              onTouchEnd={handleJoystickEnd}
              onTouchCancel={handleJoystickEnd}
            >
              <div ref={joystickKnobRef} className="joystick-knob" />
            </div>
            <div
              className="mobile-torch-btn"
              onTouchStart={handleTorchTap}
            >🔦</div>
            <div
              className="mobile-menu-btn"
              onTouchStart={(e) => { e.stopPropagation(); setIsPaused(true); gameRef.current?.pause() }}
            >&#9776;</div>
          </div>
          <div className="game-timer">{formatTime(elapsed)}</div>
          <div className="step-counter">👣 {totalSteps}</div>
          <HeartRateWidget bpm={heartRate} />
          <div className={`torch-indicator ${torchOn ? 'on' : 'off'}`}>
            {torchOn ? 'TORCH ON' : 'TORCH OFF'}
          </div>
          <div className="hud">
            <div className={`hud-slot ${inventory.keys ? 'collected' : ''}`}>
              <span className="icon">🔑</span>
              <span>Keys</span>
            </div>
            <div className={`hud-slot ${inventory.fuel ? 'collected' : ''}`}>
              <span className="icon">⛽</span>
              <span>Fuel</span>
            </div>
            <div className="hud-slot">
              <span className="icon">🚗</span>
              <span>Car</span>
            </div>
          </div>

          {isPaused && !pauseShowOptions && (
            <PauseModal
              onResume={handleResume}
              onRestart={startGame}
              onMainMenu={handleMainMenu}
              onOptions={() => setPauseShowOptions(true)}
            />
          )}

          {isPaused && pauseShowOptions && (
            <div className="pause-backdrop" onClick={handleResume}>
              <div className="pause-modal pause-modal-options" onClick={(e) => e.stopPropagation()}>
                <OptionsPanel onBack={() => setPauseShowOptions(false)} options={options} setOptions={setOptions} displayName={displayName} onNameBlur={handleNameBlur} onViewLeaderboard={handleViewLeaderboard} leaderboard={leaderboard} lbLoading={lbLoading} userId={userId} />
              </div>
            </div>
          )}
        </>
      )}

      {gameState === GameState.GAME_OVER && (
        <div className="overlay gameover-overlay">
          <Footer onSupportClick={() => setShowSupport(true)} />
          <h1 className="gameover-title">You Were Caught</h1>
          <div className="end-stats">
            {endStatsBlock}
          </div>
          <Leaderboard
            entries={leaderboard.entries}
            total={leaderboard.total}
            userId={userId}
            userRank={null}
            loading={lbLoading}
          />
          <button className="btn" onClick={startGame}>Try Again</button>
        </div>
      )}

      {gameState === GameState.WIN && !showSubmitModal && (
        <div className="overlay win-overlay">
          <Footer onSupportClick={() => setShowSupport(true)} />
          <h1 className="win-title">You Escaped the Forest</h1>
          <div className="end-stats">
            <div className="end-stat">
              <span className="end-stat-label">escaped in</span>
              <span className="end-stat-value">{formatTime(elapsed)}</span>
            </div>
            <div className="end-stat-divider" />
            <div className="end-stat">
              <span className="end-stat-label">steps taken</span>
              <span className="end-stat-value">👣 {totalSteps}</span>
            </div>
            <div className="end-stat-divider" />
            <div className="end-stat">
              <span className="end-stat-label">enemies noticed you</span>
              <span className="end-stat-value">{endEnemiesNoticed}</span>
            </div>
            <div className="end-stat-divider" />
            <div className="end-stat">
              <span className="end-stat-label">crows spooked</span>
              <span className="end-stat-value">{endCrowsSpooked}</span>
            </div>
            {endLeshenSteps > 0 && (
              <>
                <div className="end-stat-divider" />
                <div className="end-stat">
                  <span className="end-stat-label">leshen steps chasing you</span>
                  <span className="end-stat-value end-stat-peak">{endLeshenSteps}</span>
                </div>
              </>
            )}
            <div className="end-stat-divider" />
            <div className="end-stat">
              <span className="end-stat-label">avg heart rate</span>
              <span className="end-stat-value">♥ {endAvgHR} bpm</span>
            </div>
            <div className="end-stat-divider" />
            <div className="end-stat">
              <span className="end-stat-label">peak heart rate</span>
              <span className="end-stat-value end-stat-peak">♥ {endMaxHR} bpm</span>
            </div>
          </div>
          <Leaderboard
            entries={leaderboard.entries}
            total={leaderboard.total}
            userId={userId}
            userRank={userRank}
            loading={lbLoading}
          />
          <button className="btn" onClick={startGame}>Play Again</button>
        </div>
      )}

      {gameState === GameState.WIN && showSubmitModal && (
        <SubmitScoreModal
          timeSeconds={elapsed}
          displayTime={formatTime(elapsed)}
          userId={userId}
          onDone={handleSubmitDone}
        />
      )}

      {showSupport && <SupportModal onClose={() => setShowSupport(false)} />}


    </div>
  )
}

export default App
