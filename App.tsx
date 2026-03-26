import React, { useState, useEffect, useCallback } from 'react';
import { BoardState, GameState, Difficulty, GameStats } from './types';
import { generateSudoku, checkWin, createEmptyBoard } from './services/sudokuUtils';
import { getHint } from './services/geminiService';
import { loadStats, updateStatsOnStart, updateStatsOnWin } from './services/statsService';

const App: React.FC = () => {
  // --- State ---
  const [gameState, setGameState] = useState<GameState>({
    board: createEmptyBoard(),
    solution: [],
    difficulty: 'Easy',
    mistakes: 0,
    isWon: false,
    selectedCell: null,
    history: [],
    timer: 0,
    isPaused: false,
    isLoading: false,
    isNotesMode: false,
  });

  const [hintMessage, setHintMessage] = useState<{ text: string; cell: { r: number, c: number } } | null>(null);
  const [stats, setStats] = useState<GameStats>(loadStats());
  
  // Modal States
  const [showNewGameModal, setShowNewGameModal] = useState(false);
  const [showStatsModal, setShowStatsModal] = useState(false);

  // --- Initialization ---
  const startNewGame = useCallback((difficulty: Difficulty) => {
    const { board, solution } = generateSudoku(difficulty);
    setGameState({
      board,
      solution,
      difficulty,
      mistakes: 0,
      isWon: false,
      selectedCell: null,
      history: [],
      timer: 0,
      isPaused: false,
      isLoading: false,
      isNotesMode: false,
    });
    setHintMessage(null);
    setStats(prev => updateStatsOnStart(prev));
    setShowNewGameModal(false);
  }, []);

  // Initial Game Load
  useEffect(() => {
    const { board, solution } = generateSudoku('Easy');
    setGameState(prev => ({ ...prev, board, solution, difficulty: 'Easy' }));
  }, []);

  // --- Timer ---
  useEffect(() => {
    let interval: any;
    if (!gameState.isPaused && !gameState.isWon && !showNewGameModal && !showStatsModal) {
      interval = setInterval(() => {
        setGameState(prev => ({ ...prev, timer: prev.timer + 1 }));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [gameState.isPaused, gameState.isWon, showNewGameModal, showStatsModal]);

  // --- Win Handler ---
  useEffect(() => {
    if (gameState.isWon) {
      setStats(prev => updateStatsOnWin(prev, gameState.difficulty, gameState.timer));
    }
  }, [gameState.isWon]);

  const formatTime = (seconds: number | null) => {
    if (seconds === null) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // --- Game Logic ---
  const togglePause = () => {
    if (gameState.isWon) return;
    setGameState(prev => ({ ...prev, isPaused: !prev.isPaused }));
  };

  const handleCellClick = (row: number, col: number) => {
    if (gameState.isWon || gameState.isPaused) return;
    setGameState(prev => ({ ...prev, selectedCell: { row, col } }));
  };

  const handleNumberInput = (number: number) => {
    if (gameState.isWon || gameState.isPaused || !gameState.selectedCell) return;
    
    const { row, col } = gameState.selectedCell;
    const currentCell = gameState.board[row][col];

    if (currentCell.isFixed || currentCell.value !== 0) return;

    const newHistory = [...gameState.history, gameState.board.map(r => r.map(c => ({ ...c })))];
    if (newHistory.length > 20) newHistory.shift();

    const newBoard = gameState.board.map(r => r.map(c => ({ ...c })));
    const targetCell = newBoard[row][col];

    if (gameState.isNotesMode) {
      if (targetCell.notes.includes(number)) {
        targetCell.notes = targetCell.notes.filter(n => n !== number);
      } else {
        targetCell.notes = [...targetCell.notes, number].sort();
      }
      setGameState(prev => ({ ...prev, board: newBoard, history: newHistory }));
    } else {
      const correctValue = gameState.solution[row][col];
      const isCorrect = number === correctValue;

      if (isCorrect) {
        targetCell.value = number;
        targetCell.isError = false;
        targetCell.notes = []; 
        const won = checkWin(newBoard);
        setGameState(prev => ({ ...prev, board: newBoard, isWon: won, history: newHistory }));
      } else {
        targetCell.value = number;
        targetCell.isError = true;
        setGameState(prev => ({ ...prev, board: newBoard, mistakes: prev.mistakes + 1, history: newHistory }));
      }
    }
  };

  const handleErase = () => {
    if (!gameState.selectedCell || gameState.isWon || gameState.isPaused) return;
    const { row, col } = gameState.selectedCell;
    const cell = gameState.board[row][col];
    if (cell.isFixed) return;

    const newHistory = [...gameState.history, gameState.board.map(r => r.map(c => ({ ...c })))];
    const newBoard = gameState.board.map(r => r.map(c => ({ ...c })));
    newBoard[row][col].value = 0;
    newBoard[row][col].isError = false;
    newBoard[row][col].notes = [];

    setGameState(prev => ({ ...prev, board: newBoard, history: newHistory }));
  };

  const handleUndo = () => {
    if (gameState.history.length === 0 || gameState.isPaused) return;
    const previousBoard = gameState.history[gameState.history.length - 1];
    const newHistory = gameState.history.slice(0, -1);
    setGameState(prev => ({ ...prev, board: previousBoard, history: newHistory }));
  };

  const handleHint = async () => {
    if (gameState.isWon || gameState.isPaused) return;
    setGameState(prev => ({ ...prev, isLoading: true }));
    setHintMessage(null);
    try {
      const hint = await getHint(gameState.board);
      setHintMessage({ text: hint.explanation, cell: { r: hint.row, c: hint.col } });
      setGameState(prev => ({ ...prev, isLoading: false, selectedCell: { row: hint.row, col: hint.col } }));
    } catch (error) {
      console.error(error);
      setGameState(prev => ({ ...prev, isLoading: false }));
      alert("AI couldn't find a hint right now. Try again!");
    }
  };

  // Keyboard support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameState.isWon || showNewGameModal || showStatsModal) return;
      
      if (e.key === 'p' || e.key === 'P') {
        togglePause();
        return;
      }

      if (gameState.isPaused) return;

      if (e.key >= '1' && e.key <= '9') {
        handleNumberInput(parseInt(e.key));
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        handleErase();
      } else if (e.key.toLowerCase() === 'n') {
        setGameState(prev => ({ ...prev, isNotesMode: !prev.isNotesMode }));
      } else if (e.key.toLowerCase() === 'u') {
        handleUndo();
      } else if (e.key.startsWith('Arrow')) {
        setGameState(prev => {
          if (!prev.selectedCell) return { ...prev, selectedCell: { row: 0, col: 0 } };
          let { row, col } = prev.selectedCell;
          if (e.key === 'ArrowUp') row = Math.max(0, row - 1);
          if (e.key === 'ArrowDown') row = Math.min(8, row + 1);
          if (e.key === 'ArrowLeft') col = Math.max(0, col - 1);
          if (e.key === 'ArrowRight') col = Math.min(8, col + 1);
          return { ...prev, selectedCell: { row, col } };
        });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState, showNewGameModal, showStatsModal]);

  // --- Rendering Helpers ---
  const isSelected = (r: number, c: number) => gameState.selectedCell?.row === r && gameState.selectedCell?.col === c;
  const isRelated = (r: number, c: number) => {
    if (!gameState.selectedCell) return false;
    const { row, col } = gameState.selectedCell;
    return r === row || c === col || (Math.floor(r/3) === Math.floor(row/3) && Math.floor(c/3) === Math.floor(col/3));
  };
  const isSameValue = (val: number) => {
    if (!gameState.selectedCell || val === 0) return false;
    const { row, col } = gameState.selectedCell;
    return gameState.board[row][col].value === val;
  };

  return (
    <div className="min-h-screen bg-sudoku-bg text-sudoku-text flex flex-col items-center py-8 px-4 select-none">
      
      {/* Header */}
      <div className="w-full max-w-md flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Sudoku</h1>
          <p className="text-xs text-gray-500">Gemini AI Edition</p>
        </div>
        <div className="flex flex-col items-end">
          <div className="flex items-center gap-3">
            <button 
              onClick={togglePause}
              className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
              title={gameState.isPaused ? "Resume" : "Pause"}
            >
              {gameState.isPaused ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
              )}
            </button>
            <div className="text-lg font-mono font-semibold text-gray-600">{formatTime(gameState.timer)}</div>
          </div>
          <div className="text-sm text-gray-500">Mistakes: <span className="font-medium text-red-500">{gameState.mistakes}/3</span></div>
        </div>
      </div>

      {/* Controls Bar */}
      <div className="w-full max-w-md flex justify-between items-center mb-4 bg-white p-2 rounded-xl shadow-sm border border-gray-100">
        <div className="flex items-center gap-2">
           <span className="text-sm font-semibold text-gray-500 px-2">{gameState.difficulty}</span>
        </div>
        <div className="flex gap-2">
           <button 
            onClick={() => setShowStatsModal(true)}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            title="Statistics"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2z" />
            </svg>
          </button>
          <button 
            onClick={() => setShowNewGameModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-1.5 px-4 rounded-lg transition-colors shadow-sm"
          >
            New Game
          </button>
        </div>
      </div>

      {/* Main Board Area */}
      <div className="relative">
        <div className={`bg-sudoku-board p-1 rounded-lg shadow-xl border-4 border-gray-800 transition-all ${gameState.isPaused ? 'blur-md grayscale' : ''}`}>
          <div className="grid grid-cols-9 border-2 border-gray-800 bg-gray-800 gap-[1px]">
            {gameState.board.map((row, rIdx) => (
              row.map((cell, cIdx) => {
                const isSel = isSelected(rIdx, cIdx);
                const isRel = !isSel && isRelated(rIdx, cIdx);
                const isSame = !isSel && isSameValue(cell.value);
                const isRightBorder = (cIdx + 1) % 3 === 0 && cIdx !== 8;
                const isBottomBorder = (rIdx + 1) % 3 === 0 && rIdx !== 8;
                
                let bgClass = "bg-white";
                if (cell.isError) bgClass = "bg-red-200";
                else if (isSel) bgClass = "bg-blue-300";
                else if (isSame) bgClass = "bg-blue-200";
                else if (isRel) bgClass = "bg-gray-100";
                
                const isHintCell = hintMessage?.cell.r === rIdx && hintMessage?.cell.c === cIdx;
                if (isHintCell && !isSel) bgClass = "bg-yellow-100 animate-pulse";

                return (
                  <div 
                    key={`${rIdx}-${cIdx}`}
                    onClick={() => handleCellClick(rIdx, cIdx)}
                    className={`
                      w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 
                      ${bgClass}
                      ${isRightBorder ? 'mr-[2px]' : ''}
                      ${isBottomBorder ? 'mb-[2px]' : ''}
                      flex items-center justify-center relative
                      hover:bg-blue-50 cursor-pointer
                    `}
                  >
                    {!gameState.isPaused && (cell.value !== 0 ? (
                      <span className={`text-xl sm:text-2xl font-medium ${cell.isFixed ? 'text-gray-900' : cell.isError ? 'text-red-600' : 'text-blue-600'}`}>
                        {cell.value}
                      </span>
                    ) : (
                      <div className="grid grid-cols-3 gap-0.5 w-full h-full p-0.5">
                        {cell.notes.map(note => (
                          <div key={note} className="flex items-center justify-center">
                             <span className="text-[8px] sm:text-[10px] leading-none text-gray-500 font-semibold">{note}</span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                );
              })
            ))}
          </div>
        </div>

        {/* Pause Overlay */}
        {gameState.isPaused && !gameState.isWon && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-gray-900/10 rounded-lg">
             <button 
              onClick={togglePause}
              className="bg-blue-600 text-white p-6 rounded-full shadow-2xl hover:bg-blue-700 transition-transform active:scale-95 flex items-center justify-center"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
            </button>
            <span className="mt-4 text-gray-800 font-bold text-xl drop-shadow-sm">GAME PAUSED</span>
          </div>
        )}

        {/* Win Overlay */}
        {gameState.isWon && (
          <div className="absolute inset-0 bg-blue-500/80 rounded-lg flex flex-col items-center justify-center text-white backdrop-blur-sm animate-fade-in z-30">
            <div className="text-4xl font-bold mb-2">Solved!</div>
            <div className="text-lg">Time: {formatTime(gameState.timer)}</div>
            <div className="text-sm mt-1 opacity-90">{gameState.difficulty} Mode</div>
            <button 
              onClick={() => setShowNewGameModal(true)}
              className="mt-6 bg-white text-blue-600 px-6 py-2 rounded-full font-bold shadow-lg hover:bg-gray-100 transition"
            >
              Play Again
            </button>
          </div>
        )}
      </div>

      {/* Hint Message Area */}
      <div className="w-full max-w-md mt-4 min-h-[60px]">
        {hintMessage && !gameState.isPaused && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-start gap-3 shadow-sm animate-fade-in-up">
            <div className="text-yellow-600 mt-1">
               <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
               </svg>
            </div>
            <div className="text-sm text-gray-700">
              <span className="font-semibold block mb-1">AI Hint:</span>
              {hintMessage.text}
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className={`w-full max-w-md mt-6 flex flex-col gap-4 transition-opacity ${gameState.isPaused ? 'opacity-50 pointer-events-none' : ''}`}>
        {/* Numpad */}
        <div className="grid grid-cols-9 gap-1 sm:gap-2">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
            <button
              key={num}
              onClick={() => handleNumberInput(num)}
              className="aspect-square bg-white rounded-lg shadow-sm border border-gray-200 text-blue-600 font-semibold text-xl hover:bg-blue-50 active:bg-blue-100 transition-colors"
            >
              {num}
            </button>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="flex justify-between gap-2">
          <ControlButton 
            icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>}
            label="Undo" 
            onClick={handleUndo} 
          />
           <ControlButton 
            icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>}
            label="Erase" 
            onClick={handleErase} 
          />
          <ControlButton 
            active={gameState.isNotesMode}
            icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill={gameState.isNotesMode ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>}
            label="Notes" 
            onClick={() => setGameState(prev => ({ ...prev, isNotesMode: !prev.isNotesMode }))} 
          />
           <ControlButton 
            isLoading={gameState.isLoading}
            icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>}
            label="Hint" 
            onClick={handleHint}
            className="text-amber-600 hover:bg-amber-50"
          />
        </div>
      </div>

      {/* --- Modals --- */}
      
      {/* New Game Modal */}
      {showNewGameModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm animate-fade-in-up">
            <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">Start New Game</h2>
            <div className="grid grid-cols-2 gap-3 mb-6">
              {(['Easy', 'Medium', 'Hard', 'Expert'] as Difficulty[]).map(d => (
                <button
                  key={d}
                  onClick={() => startNewGame(d)}
                  className={`py-3 px-4 rounded-xl border-2 font-semibold transition-all
                    ${d === 'Easy' ? 'border-green-100 bg-green-50 text-green-700 hover:bg-green-100' : ''}
                    ${d === 'Medium' ? 'border-blue-100 bg-blue-50 text-blue-700 hover:bg-blue-100' : ''}
                    ${d === 'Hard' ? 'border-orange-100 bg-orange-50 text-orange-700 hover:bg-orange-100' : ''}
                    ${d === 'Expert' ? 'border-red-100 bg-red-50 text-red-700 hover:bg-red-100' : ''}
                  `}
                >
                  {d}
                </button>
              ))}
            </div>
            <button 
              onClick={() => setShowNewGameModal(false)}
              className="w-full py-2 text-gray-500 font-medium hover:text-gray-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Statistics Modal */}
      {showStatsModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm animate-fade-in-up">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-800">Statistics</h2>
              <button onClick={() => setShowStatsModal(false)} className="text-gray-400 hover:text-gray-600">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="flex justify-between mb-6 px-2">
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-600">{stats.gamesStarted}</div>
                <div className="text-xs text-gray-500 uppercase tracking-wide">Played</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600">{stats.gamesWon}</div>
                <div className="text-xs text-gray-500 uppercase tracking-wide">Won</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-purple-600">
                  {stats.gamesStarted > 0 ? Math.round((stats.gamesWon / stats.gamesStarted) * 100) : 0}%
                </div>
                <div className="text-xs text-gray-500 uppercase tracking-wide">Win Rate</div>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-2">Best Times</h3>
              {(['Easy', 'Medium', 'Hard', 'Expert'] as Difficulty[]).map(d => (
                <div key={d} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span className="font-medium text-gray-700">{d}</span>
                  <span className="font-mono text-gray-600 font-semibold">{formatTime(stats.bestTime[d])}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

interface ControlButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
  isLoading?: boolean;
  className?: string;
}

const ControlButton: React.FC<ControlButtonProps> = ({ icon, label, onClick, active, isLoading, className = "text-gray-600 hover:bg-gray-50" }) => (
  <button
    onClick={onClick}
    disabled={isLoading}
    className={`
      flex-1 flex flex-col items-center justify-center py-3 rounded-xl border border-gray-200 shadow-sm transition-all
      ${active ? 'bg-blue-600 text-white border-blue-600 shadow-blue-200' : 'bg-white'}
      ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}
      ${!active && className}
    `}
  >
    <div className={`mb-1 ${isLoading ? 'animate-spin' : ''}`}>
      {isLoading ? (
        <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      ) : icon}
    </div>
    <span className="text-xs font-medium">{label}</span>
  </button>
);

export default App;
