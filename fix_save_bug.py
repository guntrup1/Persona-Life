import re

with open('client/src/components/MonteCarloSimulator.tsx', 'r', encoding='utf-8') as f:
    sim = f.read()

# Modify handleSave to clear state
save_old = """    actions.addSimulation(sim);
    toast({ title: t.simulator.simSaved });
  };"""

save_new = """    actions.addSimulation(sim);
    toast({ title: t.simulator.simSaved });
    
    // Clear session name and results to prevent accidental duplicate saves
    // or saving new settings with old simulation results.
    setSessionName("");
    setCurrentResult(null);
  };"""

sim = sim.replace(save_old, save_new)

# Modify inputs to clear currentResult when changed (except sessionName)
# This forces the user to hit "Run" again if they change the math parameters.
inputs_to_wrap = [
    ("setRr(parseFloat(e.target.value))", "setRr(parseFloat(e.target.value)); setCurrentResult(null);"),
    ("setWinRate(parseFloat(e.target.value))", "setWinRate(parseFloat(e.target.value)); setCurrentResult(null);"),
    ("setTrades(parseFloat(e.target.value))", "setTrades(parseFloat(e.target.value)); setCurrentResult(null);"),
    ("setStartBalance(parseFloat(e.target.value))", "setStartBalance(parseFloat(e.target.value)); setCurrentResult(null);"),
    ("setRiskPercent(parseFloat(e.target.value))", "setRiskPercent(parseFloat(e.target.value)); setCurrentResult(null);"),
    ("setRiskType(v)", "setRiskType(v); setCurrentResult(null);"),
    ("setCommission(parseFloat(e.target.value))", "setCommission(parseFloat(e.target.value)); setCurrentResult(null);"),
    ("setTradesPerDay(e.target.value)", "setTradesPerDay(e.target.value); setCurrentResult(null);"),
    ("setMode(v)", "setMode(v); setCurrentResult(null);")
]

for old_code, new_code in inputs_to_wrap:
    sim = sim.replace(old_code, new_code)


with open('client/src/components/MonteCarloSimulator.tsx', 'w', encoding='utf-8') as f:
    f.write(sim)
