import { useState } from 'react';
import ChessBoard from './components/ChessBoard/ChessBoard'
import GameMenu from './components/GameMenu/GameMenu'
import { loadSavedGame, type SavedGame } from './lib/savedGame';
import type { GameSettings } from './types/game'

interface ActiveGame {
  settings: GameSettings;
  resume?: Pick<SavedGame, 'sanMoves' | 'clockSeconds'>;
}

function App() {
  const [activeGame, setActiveGame] = useState<ActiveGame | null>(null);
  // Đọc lại mỗi lần về menu, vì ván vừa rời đi có thể vừa được lưu (hoặc vừa xoá
  // vì đã kết thúc).
  const [savedGame, setSavedGame] = useState<SavedGame | null>(loadSavedGame);

  if (!activeGame) {
    return (
      <GameMenu
        savedGame={savedGame}
        onStart={(settings) => setActiveGame({ settings })}
        onResume={(saved) => setActiveGame({ settings: saved.settings, resume: saved })}
      />
    );
  }

  const handleExit = () => {
    setSavedGame(loadSavedGame());
    setActiveGame(null);
  };

  return <ChessBoard settings={activeGame.settings} resume={activeGame.resume} onExit={handleExit} />;
}

export default App
