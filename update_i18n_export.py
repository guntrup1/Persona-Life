import re

with open('client/src/lib/i18n.tsx', 'r', encoding='utf-8') as f:
    i18n = f.read()

i18n = i18n.replace('maxTradesPerDay: "Макс. сделок в день (Для Daily DD)",', 'maxTradesPerDay: "Макс. сделок в день (Для Daily DD)",\n      downloadJson: "Скачать ИИ-датасет (JSON)",\n      shareImage: "Поделиться статистикой",')
i18n = i18n.replace('maxTradesPerDay: "Max trades per day (For Daily DD)",', 'maxTradesPerDay: "Max trades per day (For Daily DD)",\n      downloadJson: "Download AI-Dataset (JSON)",\n      shareImage: "Share Statistics",')

with open('client/src/lib/i18n.tsx', 'w', encoding='utf-8') as f:
    f.write(i18n)
