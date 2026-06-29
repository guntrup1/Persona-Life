import re

with open('client/src/components/MonteCarloSimulator.tsx', 'r', encoding='utf-8') as f:
    sim = f.read()

save_old = """  const handleSave = () => {
    if (!currentResult) return;
    const sim: SimulationSession = {
      id: crypto.randomUUID(),
      name: sessionName,
      createdAt: new Date().toISOString(),
      mode,
      winRate, rr, trades, startingBalance: startBalance,
      riskPercent, riskType, commission, 
      tradesPerDay: parseFloat(tradesPerDay) || null,
      results: currentResult
    };
    actions.addSimulation(sim);
    toast({ title: t.simulator.simSaved });
  };"""

save_new = """  const handleSave = () => {
    if (!currentResult) return;
    
    // Use fallback for ID generation in case crypto.randomUUID is unavailable in non-secure contexts
    const simId = (typeof crypto !== 'undefined' && crypto.randomUUID) 
      ? crypto.randomUUID() 
      : Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      
    const sim: SimulationSession = {
      id: simId,
      name: sessionName,
      createdAt: new Date().toISOString(),
      mode,
      winRate, rr, trades, startingBalance: startBalance,
      riskPercent, riskType, commission, 
      tradesPerDay: parseFloat(tradesPerDay) || null,
      results: currentResult
    };
    actions.addSimulation(sim);
    toast({ title: t.simulator.simSaved });
    
    // Clear all fields to default state after saving
    setSessionName("");
    setRr(2);
    setWinRate(40);
    setTrades(100);
    setStartBalance(5000);
    setRiskPercent(1);
    setRiskType("fixed");
    setCommission(0.1);
    setTradesPerDay("3");
    setCurrentResult(null);
  };"""

sim = sim.replace(save_old, save_new)

with open('client/src/components/MonteCarloSimulator.tsx', 'w', encoding='utf-8') as f:
    f.write(sim)
