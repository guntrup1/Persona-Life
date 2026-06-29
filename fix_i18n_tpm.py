import re

with open('client/src/lib/i18n.tsx', 'r', encoding='utf-8') as f:
    i18n = f.read()

i18n = i18n.replace('tradesPerDay: "Сделок в день (опц.)",', 'tradesPerMonth: "Сделок в месяц (в среднем)",')
i18n = i18n.replace('tradesPerDay: "Trades per day (opt.)",', 'tradesPerMonth: "Avg Trades per month",')

with open('client/src/lib/i18n.tsx', 'w', encoding='utf-8') as f:
    f.write(i18n)
