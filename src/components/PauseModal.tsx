interface Props {
  onResume: () => void
  onRestart: () => void
  onMainMenu: () => void
  onOptions: () => void
}

export function PauseModal({ onResume, onRestart, onMainMenu, onOptions }: Props) {
  return (
    <div className="pause-backdrop" onClick={onResume}>
      <div className="pause-modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="pause-title">Paused</h2>
        <button className="btn pause-btn" onClick={onResume}>Resume</button>
        <button className="btn btn-secondary pause-btn" onClick={onOptions}>Options</button>
        <button className="btn btn-secondary pause-btn" onClick={onRestart}>Restart</button>
        <button className="btn btn-secondary pause-btn" onClick={onMainMenu}>Main Menu</button>
      </div>
    </div>
  )
}
