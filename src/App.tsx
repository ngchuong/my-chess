import { useState } from 'react';
import ChessBoard from './components/ChessBoard/ChessBoard'
import GameMenu from './components/GameMenu/GameMenu'
import type { GameSettings } from './types/game'

function App() {
  const [settings, setSettings] = useState<GameSettings | null>(null);

  if (!settings) {
    return <GameMenu onStart={setSettings} />;
  }

  return <ChessBoard settings={settings} onExit={() => setSettings(null)} />;
}

export default App
