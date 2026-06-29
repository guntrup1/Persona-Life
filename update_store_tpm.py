import re

with open('client/src/lib/store.ts', 'r', encoding='utf-8') as f:
    store = f.read()

store = store.replace('  tradesPerDay: number | null;', '  tradesPerMonth: number | null;')

with open('client/src/lib/store.ts', 'w', encoding='utf-8') as f:
    f.write(store)
