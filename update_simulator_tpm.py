import re

with open('client/src/components/MonteCarloSimulator.tsx', 'r', encoding='utf-8') as f:
    sim = f.read()

# Replace states and UI elements
sim = sim.replace('const [tradesPerDay, setTradesPerDay] = useState<string>("3");', 'const [tradesPerMonth, setTradesPerMonth] = useState<string>("10");')

sim = sim.replace("""              <div className="space-y-2">
                <Label className={mode === "PROP" ? "text-blue-400 font-bold" : ""}>
                  {t.simulator.tradesPerDay} {mode === "PROP" && "*"}
                </Label>
                <Input 
                  type="number" 
                  value={tradesPerDay} 
                  onChange={e => { setTradesPerDay(e.target.value); setCurrentResult(null); }} 
                  placeholder={mode === "PROP" ? "Max trades per day for Daily DD" : "0"} 
                  className={`bg-black/40 ${mode === "PROP" && !tradesPerDay ? "border-blue-500/50" : ""}`} 
                />
              </div>""", """              <div className="space-y-2">
                <Label className="text-gray-200">
                  {t.simulator.tradesPerMonth || "Сделок в месяц (в среднем)"}
                </Label>
                <Input 
                  type="number" 
                  value={tradesPerMonth} 
                  onChange={e => { setTradesPerMonth(e.target.value); setCurrentResult(null); }} 
                  placeholder="Например: 15" 
                  className="bg-black/40" 
                />
              </div>""")

# Replace logic in handleRun
sim = sim.replace("""    let tpd = parseFloat(tradesPerDay);
    if (mode === "PROP" && (isNaN(tpd) || tpd <= 0)) {
      toast({ title: "Макс сделок в день (Trades per day) требуется для расчета Daily DD", variant: "destructive" });
      return;
    }
    
    if (isNaN(tpd)) tpd = 0;
    
    const btTrades = parseFloat(backtestTrades) || null;
    const btDays = parseFloat(backtestDays) || null;
    
    const res = runMonteCarlo(mode, winRate, rr, trades, startBalance, riskPercent, riskType, commission, tpd, btTrades, btDays);""", """    const btTrades = parseFloat(backtestTrades) || null;
    const btDays = parseFloat(backtestDays) || null;
    
    let tpd = 0;
    if (btTrades && btDays && btTrades > 0 && btDays > 0) {
      tpd = btTrades / btDays;
    } else {
      const tpm = parseFloat(tradesPerMonth);
      if (mode === "PROP" && (isNaN(tpm) || tpm <= 0)) {
        toast({ title: "Укажите 'Сделок в месяц' или данные бэктеста для PROP", variant: "destructive" });
        return;
      }
      if (!isNaN(tpm) && tpm > 0) {
        tpd = tpm / 30; // approx trades per day
      }
    }
    
    const res = runMonteCarlo(mode, winRate, rr, trades, startBalance, riskPercent, riskType, commission, tpd, btTrades, btDays);""")

# Replace save payload
sim = sim.replace('tradesPerDay: parseFloat(tradesPerDay) || null,', 'tradesPerMonth: parseFloat(tradesPerMonth) || null,')

# Replace reset
sim = sim.replace('setTradesPerDay("3");', 'setTradesPerMonth("10");')

# Replace runMonteCarlo signature logic for daily drawdown
run_logic_old = """      if (t > 0 && tradesPerDay > 0 && t % Math.ceil(tradesPerDay) === 0) {
        dayStartBalance = balance;
      }"""

run_logic_new = """      // Если tradesPerDay < 1, значит каждая сделка происходит в новый день.
      // Иначе обнуляем dayStartBalance каждые tradesPerDay сделок.
      if (tradesPerDay > 0) {
        if (tradesPerDay < 1) {
          dayStartBalance = balance;
        } else if (t > 0 && t % Math.ceil(tradesPerDay) === 0) {
          dayStartBalance = balance;
        }
      }"""

sim = sim.replace(run_logic_old, run_logic_new)

with open('client/src/components/MonteCarloSimulator.tsx', 'w', encoding='utf-8') as f:
    f.write(sim)
