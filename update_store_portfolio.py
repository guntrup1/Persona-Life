import os
import re

content = """import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface RoutineTask {
  id: string;
  text: string;
  completed: boolean;
  time?: string;
  type?: 'daily' | 'weekly' | 'monthly';
  days?: number[];
  category?: 'morning' | 'day' | 'evening';
  archived?: boolean;
}

export interface DayRoutine {
  date: string;
  tasks: RoutineTask[];
}

export interface SimulationResult {
  probSL: number;
  probTP: number;
  profitFactor: number;
  mathExpectation: number;
  streak3: number;
  streak5: number;
  streak10: number;
  maxDrawdown: number;
  riskOfRuin: number;
  avgIncomePerTrade: number;
  monthlyIncome: number | null;
  quarterlyIncome: number | null;
  halfYearlyIncome: number | null;
  yearlyIncome: number | null;
  chartData: any[];
  isPropMode: boolean;
  probPhase1?: number;
  probPhase2?: number;
  probLive?: number;
  avgTradesToLive?: number;
  avgDaysToLive?: number;
}

export interface Asset {
  id: string;
  name: string;
  winRate: number;
  rr: number;
  riskPercent: number;
  trades: number;
  backtestDays: number;
}

export interface SimulationSession {
  id: string;
  name: string;
  createdAt: string;
  mode: "SELF" | "PROP";
  startingBalance: number;
  riskType: "fixed" | "dynamic";
  commission: number;
  assets: Asset[];
  results: SimulationResult;
}

interface AppState {
  routineTasks: RoutineTask[];
  history: DayRoutine[];
  simulations: SimulationSession[];
  
  addRoutineTask: (task: Omit<RoutineTask, 'id' | 'completed'>) => void;
  toggleRoutineTask: (id: string, date: string) => void;
  deleteRoutineTask: (id: string) => void;
  archiveRoutineTask: (id: string) => void;
  unarchiveRoutineTask: (id: string) => void;
  editRoutineTask: (id: string, updates: Partial<RoutineTask>) => void;
  
  addSimulation: (sim: SimulationSession) => void;
  deleteSimulation: (id: string) => void;
  clearSimulations: () => void;
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      routineTasks: [],
      history: [],
      simulations: [],
      
      addRoutineTask: (task) => set((state) => ({
        routineTasks: [...state.routineTasks, { ...task, id: Date.now().toString(), completed: false }]
      })),
      
      toggleRoutineTask: (id, date) => set((state) => {
        const historyIndex = state.history.findIndex(h => h.date === date);
        if (historyIndex >= 0) {
          const newHistory = [...state.history];
          const taskIndex = newHistory[historyIndex].tasks.findIndex(t => t.id === id);
          if (taskIndex >= 0) {
            newHistory[historyIndex].tasks[taskIndex].completed = !newHistory[historyIndex].tasks[taskIndex].completed;
            return { history: newHistory };
          }
        }
        
        const newHistory = [...state.history, {
          date,
          tasks: state.routineTasks.map(t => t.id === id ? { ...t, completed: true } : { ...t, completed: false })
        }];
        return { history: newHistory };
      }),
      
      deleteRoutineTask: (id) => set((state) => ({
        routineTasks: state.routineTasks.filter(t => t.id !== id)
      })),
      
      archiveRoutineTask: (id) => set((state) => ({
        routineTasks: state.routineTasks.map(t => t.id === id ? { ...t, archived: true } : t)
      })),
      
      unarchiveRoutineTask: (id) => set((state) => ({
        routineTasks: state.routineTasks.map(t => t.id === id ? { ...t, archived: false } : t)
      })),
      
      editRoutineTask: (id, updates) => set((state) => ({
        routineTasks: state.routineTasks.map(t => t.id === id ? { ...t, ...updates } : t)
      })),
      
      addSimulation: (sim) => set((state) => ({
        simulations: [sim, ...state.simulations]
      })),
      
      deleteSimulation: (id) => set((state) => ({
        simulations: state.simulations.filter(s => s.id !== id)
      })),
      
      clearSimulations: () => set({ simulations: [] })
    }),
    {
      name: 'persona-life-storage',
      version: 2,
      migrate: (persistedState: any, version) => {
        if (version === 1 || !version) {
          persistedState.simulations = []; // Reset simulations as structure deeply changed
        }
        return persistedState;
      }
    }
  )
);
"""

with open('client/src/lib/store.ts', 'w', encoding='utf-8') as f:
    f.write(content)
