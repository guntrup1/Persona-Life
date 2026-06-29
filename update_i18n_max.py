import re

with open('client/src/lib/i18n.tsx', 'r', encoding='utf-8') as f:
    i18n = f.read()

i18n = i18n.replace('tradesPerMonth: "Сделок в месяц (в среднем)",', 'tradesPerMonth: "Сделок в месяц (в среднем)",\n      maxTradesPerDay: "Макс. сделок в день (Для Daily DD)",')
i18n = i18n.replace('tradesPerMonth: "Avg Trades per month",', 'tradesPerMonth: "Avg Trades per month",\n      maxTradesPerDay: "Max trades per day (For Daily DD)",')

with open('client/src/lib/i18n.tsx', 'w', encoding='utf-8') as f:
    f.write(i18n)
