import re

with open('client/src/lib/store.ts', 'r', encoding='utf-8') as f:
    store = f.read()

old_fields = """  commission: number;
  tradesPerMonth: number | null;
  backtestTrades: number | null;
  backtestDays: number | null;"""

new_fields = """  commission: number;
  tradesPerMonth: number | null;
  maxTradesPerDay: number | null;
  backtestTrades: number | null;
  backtestDays: number | null;"""

store = store.replace(old_fields, new_fields)

with open('client/src/lib/store.ts', 'w', encoding='utf-8') as f:
    f.write(store)
