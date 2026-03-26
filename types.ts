export type Difficulty = 'Easy' | 'Medium' | 'Hard' | 'Expert';

export interface CellData {
  row: number;
  col: number;
  value: number; // 0 for empty
  isFixed: boolean; // Part of the initial puzzle
  notes: number[]; // Pencil marks
  isError: boolean; // Validation error
}

export type BoardState = CellData[][];

export interface GameState {
  board: BoardState;
  solution: number[][];
  difficulty: Difficulty;
  mistakes: number;
  isWon: boolean;
  selectedCell: { row: number; col: number } | null;
  history: BoardState[]; // For undo functionality
  timer: number;
  isPaused: boolean;
  isLoading: boolean; // For AI operations
  isNotesMode: boolean;
}

export interface HintResponse {
  row: number;
  col: number;
  value: number;
  explanation: string;
}

export interface GameStats {
  gamesStarted: number;
  gamesWon: number;
  bestTime: Record<Difficulty, number | null>;
}
