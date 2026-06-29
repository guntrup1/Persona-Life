import re

with open('client/src/lib/i18n.tsx', 'r', encoding='utf-8') as f:
    i18n = f.read()

i18n = i18n.replace('compareSims: "Сравнить 2 симуляции",', 'compareSims: "Архив симуляций",')
i18n = i18n.replace('compareSims: "Compare 2 simulations",', 'compareSims: "Simulations Archive",')

with open('client/src/lib/i18n.tsx', 'w', encoding='utf-8') as f:
    f.write(i18n)
