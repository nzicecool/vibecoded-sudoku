import { Difficulty, GameStats } from '../types';

const STORAGE_KEY = 'gemini-sudoku-stats';

const DEFAULT_STATS: GameStats = {
  gamesStarted: 0,
  gamesWon: 0,
  bestTime: {
    'Easy': null,
    'Medium': null,
    'Hard': null,
    'Expert': null,
  }
};

export const loadStats = (): GameStats => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return { ...DEFAULT_STATS, ...JSON.parse(stored) };
    }
  } catch (e) {
    console.error("Failed to load stats", e);
  }
  return DEFAULT_STATS;
};

export const saveStats = (stats: GameStats) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
  } catch (e) {
    console.error("Failed to save stats", e);
  }
};

export const updateStatsOnStart = (current: GameStats): GameStats => {
  const newStats = {
    ...current,
    gamesStarted: current.gamesStarted + 1
  };
  saveStats(newStats);
  return newStats;
};

export const updateStatsOnWin = (current: GameStats, difficulty: Difficulty, time: number): GameStats => {
  const currentBest = current.bestTime[difficulty];
  const newBest = currentBest === null ? time : Math.min(currentBest, time);
  
  const newStats = {
    ...current,
    gamesWon: current.gamesWon + 1,
    bestTime: {
      ...current.bestTime,
      [difficulty]: newBest
    }
  };
  saveStats(newStats);
  return newStats;
};
