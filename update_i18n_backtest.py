import re

with open('client/src/lib/i18n.tsx', 'r', encoding='utf-8') as f:
    i18n = f.read()

ru_new = """      simMode: "Режим симуляции",
      backtestTrades: "Сделок в бэктесте",
      backtestDays: "Дней в бэктесте (период)",
      avgTradesToFunded: "Среднее кол-во сделок до Funded:",
      avgDaysToFunded: "Среднее кол-во дней до Funded:",
      timeProjections: "Временные проекции (на основе бэктеста)",
      modeSelf: "SELF (Стандартный)","""

i18n = i18n.replace('      simMode: "Режим симуляции",\n      modeSelf: "SELF (Стандартный)",', ru_new)

en_new = """      simMode: "Simulation Mode",
      backtestTrades: "Backtest Trades",
      backtestDays: "Backtest Days (Period)",
      avgTradesToFunded: "Avg Trades to Funded:",
      avgDaysToFunded: "Avg Days to Funded:",
      timeProjections: "Time Projections (based on backtest)",
      modeSelf: "SELF (Standard)","""

i18n = i18n.replace('      simMode: "Simulation Mode",\n      modeSelf: "SELF (Standard)",', en_new)

with open('client/src/lib/i18n.tsx', 'w', encoding='utf-8') as f:
    f.write(i18n)
