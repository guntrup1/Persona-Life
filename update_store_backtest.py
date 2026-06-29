import re

with open('client/src/lib/store.ts', 'r', encoding='utf-8') as f:
    store = f.read()

result_old = """  isPropMode?: boolean;
  probPhase1?: number;
  probPhase2?: number;
  probLive?: number;
}"""

result_new = """  isPropMode?: boolean;
  probPhase1?: number;
  probPhase2?: number;
  probLive?: number;
  avgTradesToLive?: number;
  avgDaysToLive?: number;
}"""

store = store.replace(result_old, result_new)

session_old = """  commission: number;
  tradesPerDay: number | null;
  results: SimulationResult;"""

session_new = """  commission: number;
  tradesPerDay: number | null;
  backtestTrades: number | null;
  backtestDays: number | null;
  results: SimulationResult;"""

store = store.replace(session_old, session_new)

with open('client/src/lib/store.ts', 'w', encoding='utf-8') as f:
    f.write(store)
