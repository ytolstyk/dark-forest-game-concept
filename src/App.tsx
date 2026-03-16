import { useRef, useEffect, useState, useCallback } from 'react'
import type React from 'react'
import { Game } from './game/Game'
import { GameState } from './game/types'
import './App.css'

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
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
      }
    }, 100)
    return () => clearInterval(interval)
  }, [gameState])

  // Timer — runs while playing
  useEffect(() => {
    if (gameState !== GameState.PLAYING) return
    startTimeRef.current = Date.now()
    setElapsed(0)
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000))
    }, 1000)
    return () => clearInterval(interval)
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

    await game.startGame((pct) => setLoadProgress(pct))

    setGameState(GameState.PLAYING)
    setTorchOn(false)
    setInventory({ keys: false, fuel: false })
    setTotalSteps(0)
  }, [])

  return (
    <div className="game-container">
      <canvas ref={canvasRef} />

      {gameState === GameState.MENU && (
        <div className="overlay menu-overlay">
          <h1 className="menu-title">Dark Forest</h1>
          <div className="menu-instructions">
            <p><kbd>WASD</kbd> or <kbd>Arrow Keys</kbd> to move</p>
            <p><kbd>Space</kbd> to toggle torch</p>
            <p>Find the <strong>keys</strong> and <strong>fuel</strong>, then reach the <strong>car</strong> to escape</p>
            <p>Your torch attracts creatures — use it wisely</p>
          </div>
          <button className="btn" onClick={startGame}>Start Game</button>
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
          </div>
          <div className="game-timer">{formatTime(elapsed)}</div>
          <div className="step-counter">👣 {totalSteps}</div>
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
        </>
      )}

      {gameState === GameState.GAME_OVER && (
        <div className="overlay gameover-overlay">
          <h1 className="gameover-title">You Were Caught</h1>
          <div className="end-stats">
            <div className="end-stat">
              <span className="end-stat-label">survived</span>
              <span className="end-stat-value">{formatTime(elapsed)}</span>
            </div>
            <div className="end-stat-divider" />
            <div className="end-stat">
              <span className="end-stat-label">steps taken</span>
              <span className="end-stat-value">👣 {totalSteps}</span>
            </div>
          </div>
          <button className="btn" onClick={startGame}>Try Again</button>
        </div>
      )}

      {gameState === GameState.WIN && (
        <div className="overlay win-overlay">
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
          </div>
          <button className="btn" onClick={startGame}>Play Again</button>
        </div>
      )}
    </div>
  )
}

export default App
