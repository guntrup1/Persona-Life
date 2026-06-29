import React, { useState, useMemo } from "react";
import { useI18n } from "@/lib/i18n";
import { useStore, SimulationSession, SimulationResult } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { Trash2, Save, TrendingUp, TrendingDown, ArrowRight } from "lucide-react";
import { toast } from "@/hooks/use-toast";

function runMonteCarlo(
  winRate: number,
  rr: number,
  trades: number,
  startingBalance: number,
  riskPercent: number,
  riskType: "fixed" | "dynamic",
  commission: number
): SimulationResult {
  const NUM_PATHS = 1000;
  const paths: number[][] = [];
  
  let totalDrawdowns = 0;
  let ruinCount = 0;
  let streak3Count = 0;
  let streak5Count = 0;
  let streak10Count = 0;
  
  for (let p = 0; p < NUM_PATHS; p++) {
    let balance = startingBalance;
    let maxBalance = startingBalance;
    let currentDrawdown = 0;
    let maxPathDrawdown = 0;
    let currentStreak = 0;
    let hit3 = false, hit5 = false, hit10 = false;
    
    const path: number[] = [balance];
    
    for (let t = 0; t < trades; t++) {
      if (balance <= 0) {
        // Ruin, fill rest with 0
        for (let i = t; i < trades; i++) path.push(0);
        break;
      }
      
      const riskAmount = riskType === "fixed" ? startingBalance * (riskPercent / 100) : balance * (riskPercent / 100);
      const commAmount = riskAmount * (commission / 100);
      
      const rand = Math.random() * 100;
      if (rand <= winRate) {
        // Win
        balance += (riskAmount * rr) - commAmount;
        currentStreak = 0;
      } else {
        // Loss
        balance -= (riskAmount + commAmount);
        currentStreak++;
        if (currentStreak >= 3) hit3 = true;
        if (currentStreak >= 5) hit5 = true;
        if (currentStreak >= 10) hit10 = true;
      }
      
      if (balance > maxBalance) maxBalance = balance;
      const drawdown = ((maxBalance - balance) / maxBalance) * 100;
      if (drawdown > maxPathDrawdown) maxPathDrawdown = drawdown;
      
      path.push(balance);
    }
    
    paths.push(path);
    totalDrawdowns += maxPathDrawdown;
    
    const finalBalance = path[path.length - 1];
    if (finalBalance < startingBalance * 0.1) ruinCount++; // Risk of ruin = <10% of start
    
    if (hit3) streak3Count++;
    if (hit5) streak5Count++;
    if (hit10) streak10Count++;
  }
  
  // Chart data extraction
  // We sort paths by final balance
  paths.sort((a, b) => a[a.length - 1] - b[b.length - 1]);
  
  const worstPath = paths[0];
  const medianPath = paths[Math.floor(NUM_PATHS / 2)];
  const bestPath = paths[NUM_PATHS - 1];
  
  // Create 50 random paths for visual cloud
  const cloudPaths = [];
  for (let i = 0; i < 50; i++) {
    cloudPaths.push(paths[Math.floor(Math.random() * NUM_PATHS)]);
  }
  
  const chartData = [];
  for (let i = 0; i <= trades; i++) {
    const point: any = { step: i, worst: worstPath[i] || 0, median: medianPath[i] || 0, best: bestPath[i] || 0 };
    cloudPaths.forEach((p, idx) => {
      point[`path_${idx}`] = p[i] || 0;
    });
    chartData.push(point);
  }
  
  const riskAmountApprox = startingBalance * (riskPercent / 100);
  const commAmountApprox = riskAmountApprox * (commission / 100);
  const avgWin = (riskAmountApprox * rr) - commAmountApprox;
  const avgLoss = riskAmountApprox + commAmountApprox;
  const wr = winRate / 100;
  const mathExpectation = (avgWin * wr) - (avgLoss * (1 - wr));
  
  const profitFactor = (avgWin * wr) / (avgLoss * (1 - wr));
  
  return {
    probSL: 100 - winRate,
    probTP: winRate,
    profitFactor,
    mathExpectation,
    streak3: (streak3Count / NUM_PATHS) * 100,
    streak5: (streak5Count / NUM_PATHS) * 100,
    streak10: (streak10Count / NUM_PATHS) * 100,
    maxDrawdown: totalDrawdowns / NUM_PATHS,
    riskOfRuin: (ruinCount / NUM_PATHS) * 100,
    avgIncomePerTrade: mathExpectation,
    monthlyIncome: null,
    quarterlyIncome: null,
    halfYearlyIncome: null,
    yearlyIncome: null,
    chartData
  };
}

export function MonteCarloSimulator() {
  const { t } = useI18n();
  const { state, actions } = useStore();
  
  const [activeTab, setActiveTab] = useState("new");
  
  // Form State
  const [sessionName, setSessionName] = useState("");
  const [rr, setRr] = useState(2);
  const [winRate, setWinRate] = useState(40);
  const [trades, setTrades] = useState(100);
  const [startBalance, setStartBalance] = useState(1000);
  const [riskPercent, setRiskPercent] = useState(1);
  const [riskType, setRiskType] = useState<"fixed" | "dynamic">("fixed");
  const [commission, setCommission] = useState(0.1);
  const [tradesPerDay, setTradesPerDay] = useState<string>("");
  
  const [currentResult, setCurrentResult] = useState<SimulationResult | null>(null);
  
  const handleRun = () => {
    if (!sessionName.trim()) {
      toast({ title: t.simulator.fillFields, variant: "destructive" });
      return;
    }
    
    const res = runMonteCarlo(winRate, rr, trades, startBalance, riskPercent, riskType, commission);
    
    // Calculate time based stats if tradesPerDay is set
    const tpd = parseFloat(tradesPerDay);
    if (!isNaN(tpd) && tpd > 0) {
      res.monthlyIncome = res.avgIncomePerTrade * tpd * 20; // ~20 trading days
      res.quarterlyIncome = res.avgIncomePerTrade * tpd * 60;
      res.halfYearlyIncome = res.avgIncomePerTrade * tpd * 120;
      res.yearlyIncome = res.avgIncomePerTrade * tpd * 240;
    }
    
    setCurrentResult(res);
  };
  
  const handleSave = () => {
    if (!currentResult) return;
    const sim: SimulationSession = {
      id: crypto.randomUUID(),
      name: sessionName,
      createdAt: new Date().toISOString(),
      winRate, rr, trades, startingBalance: startBalance,
      riskPercent, riskType, commission, 
      tradesPerDay: parseFloat(tradesPerDay) || null,
      results: currentResult
    };
    actions.addSimulation(sim);
    toast({ title: t.simulator.simSaved });
  };
  
  // Compare State
  const [comp1, setComp1] = useState<string>("");
  const [comp2, setComp2] = useState<string>("");
  
  const sim1 = state.simulations?.find(s => s.id === comp1);
  const sim2 = state.simulations?.find(s => s.id === comp2);
  
  const compareChartData = useMemo(() => {
    if (!sim1 || !sim2) return [];
    const len = Math.max(sim1.trades, sim2.trades);
    const data = [];
    for (let i = 0; i <= len; i++) {
      data.push({
        step: i,
        sim1: sim1.results.chartData[i]?.median || sim1.results.chartData[sim1.results.chartData.length-1]?.median || 0,
        sim2: sim2.results.chartData[i]?.median || sim2.results.chartData[sim2.results.chartData.length-1]?.median || 0,
      });
    }
    return data;
  }, [sim1, sim2]);

  const renderDashboard = (res: SimulationResult) => (
    <div className="space-y-6 mt-6">
      <h3 className="text-xl font-bold tracking-wider text-red-400">{t.simulator.resultsTitle}</h3>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 bg-background/50 backdrop-blur border-white/5">
          <p className="text-sm text-muted-foreground">{t.simulator.probSL}</p>
          <p className="text-2xl font-bold text-red-400">{res.probSL.toFixed(1)}%</p>
        </Card>
        <Card className="p-4 bg-background/50 backdrop-blur border-white/5">
          <p className="text-sm text-muted-foreground">{t.simulator.probTP}</p>
          <p className="text-2xl font-bold text-green-400">{res.probTP.toFixed(1)}%</p>
        </Card>
        <Card className="p-4 bg-background/50 backdrop-blur border-white/5">
          <p className="text-sm text-muted-foreground">{t.simulator.profitFactor}</p>
          <p className="text-2xl font-bold text-blue-400">{res.profitFactor.toFixed(2)}</p>
        </Card>
        <Card className="p-4 bg-background/50 backdrop-blur border-white/5">
          <p className="text-sm text-muted-foreground">{t.simulator.mathExpectation}</p>
          <p className="text-2xl font-bold text-yellow-400">{res.mathExpectation.toFixed(2)}$</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-4 bg-background/50 border-white/5">
          <h4 className="font-semibold mb-3">{t.simulator.risksDrawdowns}</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span>{t.simulator.streak3}:</span> <span>{res.streak3.toFixed(1)}%</span></div>
            <div className="flex justify-between"><span>{t.simulator.streak5}:</span> <span>{res.streak5.toFixed(1)}%</span></div>
            <div className="flex justify-between"><span>{t.simulator.streak10}:</span> <span>{res.streak10.toFixed(1)}%</span></div>
            <div className="flex justify-between text-yellow-400 mt-2"><span>{t.simulator.maxDrawdown}:</span> <span>{res.maxDrawdown.toFixed(2)}%</span></div>
            <div className="flex justify-between text-red-400"><span>{t.simulator.riskOfRuin}:</span> <span>{res.riskOfRuin.toFixed(2)}%</span></div>
          </div>
        </Card>
        
        {res.monthlyIncome !== null && (
          <Card className="p-4 bg-background/50 border-white/5">
            <h4 className="font-semibold mb-3">{t.simulator.timeStats}</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span>{t.simulator.avgIncome}:</span> <span className="text-green-400">{res.avgIncomePerTrade.toFixed(2)}$</span></div>
              <div className="flex justify-between"><span>{t.simulator.monthIncome}:</span> <span className="text-green-400">{res.monthlyIncome?.toFixed(2)}$</span></div>
              <div className="flex justify-between"><span>{t.simulator.quarterIncome}:</span> <span className="text-green-400">{res.quarterlyIncome?.toFixed(2)}$</span></div>
              <div className="flex justify-between"><span>{t.simulator.halfYearIncome}:</span> <span className="text-green-400">{res.halfYearlyIncome?.toFixed(2)}$</span></div>
              <div className="flex justify-between font-bold"><span>{t.simulator.yearIncome}:</span> <span className="text-green-400">{res.yearlyIncome?.toFixed(2)}$</span></div>
            </div>
          </Card>
        )}
      </div>
      
      <Card className="p-4 bg-background/50 border-white/5">
        <h4 className="font-semibold mb-4">{t.simulator.chartTitle}</h4>
        <div className="h-[400px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={res.chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="step" stroke="#888" />
              <YAxis stroke="#888" domain={['auto', 'auto']} />
              <Tooltip contentStyle={{ backgroundColor: '#111', borderColor: '#333' }} />
              {/* Draw 50 cloud lines */}
              {Array.from({ length: 50 }).map((_, i) => (
                <Line key={i} type="monotone" dataKey={`path_${i}`} stroke="#555" strokeWidth={1} dot={false} opacity={0.3} isAnimationActive={false} />
              ))}
              <Line type="monotone" dataKey="worst" stroke="#ef4444" strokeWidth={2} dot={false} name={t.simulator.worstCase} />
              <Line type="monotone" dataKey="median" stroke="#eab308" strokeWidth={2} dot={false} name={t.simulator.medianCase} />
              <Line type="monotone" dataKey="best" stroke="#22c55e" strokeWidth={2} dot={false} name={t.simulator.bestCase} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-background/50 border border-white/10">
          <TabsTrigger value="new">{t.simulator.tabSimulator}</TabsTrigger>
          <TabsTrigger value="compare">{t.simulator.compareSims}</TabsTrigger>
        </TabsList>
        
        <TabsContent value="new" className="mt-4">
          <Card className="p-6 bg-background/50 backdrop-blur border-white/5">
            <h3 className="text-xl font-bold tracking-wider mb-6 text-red-400">{t.simulator.formTitle}</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <Label>{t.simulator.sessionName}</Label>
                <Input value={sessionName} onChange={e => setSessionName(e.target.value)} placeholder={t.simulator.sessionNamePlaceholder} className="bg-black/40" />
              </div>
              <div className="space-y-2">
                <Label>{t.simulator.avgRR}</Label>
                <Input type="number" step="0.1" value={rr} onChange={e => setRr(parseFloat(e.target.value))} className="bg-black/40" />
              </div>
              <div className="space-y-2">
                <Label>{t.simulator.winRate}</Label>
                <Input type="number" value={winRate} onChange={e => setWinRate(parseFloat(e.target.value))} className="bg-black/40" />
              </div>
              
              <div className="space-y-2">
                <Label>{t.simulator.tradesCount}</Label>
                <Input type="number" value={trades} onChange={e => setTrades(parseFloat(e.target.value))} className="bg-black/40" />
              </div>
              <div className="space-y-2">
                <Label>{t.simulator.startBalance}</Label>
                <Input type="number" value={startBalance} onChange={e => setStartBalance(parseFloat(e.target.value))} className="bg-black/40" />
              </div>
              <div className="space-y-2">
                <Label>{t.simulator.riskPerTrade}</Label>
                <Input type="number" step="0.1" value={riskPercent} onChange={e => setRiskPercent(parseFloat(e.target.value))} className="bg-black/40" />
              </div>
              
              <div className="space-y-2">
                <Label>{t.simulator.riskType}</Label>
                <Select value={riskType} onValueChange={(v: "fixed" | "dynamic") => setRiskType(v)}>
                  <SelectTrigger className="bg-black/40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed">{t.simulator.riskFixed}</SelectItem>
                    <SelectItem value="dynamic">{t.simulator.riskDynamic}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t.simulator.commission}</Label>
                <Input type="number" step="0.01" value={commission} onChange={e => setCommission(parseFloat(e.target.value))} className="bg-black/40" />
              </div>
              <div className="space-y-2">
                <Label>{t.simulator.tradesPerDay}</Label>
                <Input type="number" value={tradesPerDay} onChange={e => setTradesPerDay(e.target.value)} placeholder="0" className="bg-black/40" />
              </div>
            </div>
            
            <div className="flex gap-4 mt-8">
              <Button onClick={handleRun} className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold tracking-widest">{t.simulator.runSim}</Button>
              {currentResult && (
                <Button onClick={handleSave} variant="outline" className="flex-1 border-red-500/50 hover:bg-red-500/10">
                  <Save className="w-4 h-4 mr-2" /> {t.simulator.saveSim}
                </Button>
              )}
            </div>
          </Card>
          
          {currentResult && renderDashboard(currentResult)}
        </TabsContent>
        
        <TabsContent value="compare" className="mt-4">
          <Card className="p-6 bg-background/50 backdrop-blur border-white/5 min-h-[400px]">
            {(!state.simulations || state.simulations.length === 0) ? (
              <div className="text-center text-muted-foreground py-12">{t.simulator.noArchive}</div>
            ) : (
              <div className="space-y-8">
                <div className="grid grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <Label>Симуляция 1</Label>
                    <Select value={comp1} onValueChange={setComp1}>
                      <SelectTrigger className="bg-black/40"><SelectValue placeholder={t.simulator.selectSim} /></SelectTrigger>
                      <SelectContent>
                        {state.simulations.map(s => <SelectItem key={s.id} value={s.id}>{s.name} ({new Date(s.createdAt).toLocaleDateString()})</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {sim1 && (
                      <div className="text-sm space-y-2 p-4 bg-black/20 rounded-lg">
                        <div className="flex justify-between"><span>Винрейт:</span> <span className="text-white">{sim1.winRate}%</span></div>
                        <div className="flex justify-between"><span>RR:</span> <span className="text-white">{sim1.rr}</span></div>
                        <div className="flex justify-between"><span>Мат. ожид.:</span> <span className="text-yellow-400">{sim1.results.mathExpectation.toFixed(2)}$</span></div>
                        <div className="flex justify-between"><span>Просадка:</span> <span className="text-red-400">{sim1.results.maxDrawdown.toFixed(2)}%</span></div>
                        <Button variant="ghost" size="sm" className="w-full text-red-500 hover:text-red-400 mt-4" onClick={() => { actions.deleteSimulation(sim1.id); setComp1(""); toast({title: t.simulator.simDeleted}); }}>
                          <Trash2 className="w-4 h-4 mr-2" /> {t.simulator.deleteSim}
                        </Button>
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-4">
                    <Label>Симуляция 2</Label>
                    <Select value={comp2} onValueChange={setComp2}>
                      <SelectTrigger className="bg-black/40"><SelectValue placeholder={t.simulator.selectSim} /></SelectTrigger>
                      <SelectContent>
                        {state.simulations.map(s => <SelectItem key={s.id} value={s.id}>{s.name} ({new Date(s.createdAt).toLocaleDateString()})</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {sim2 && (
                      <div className="text-sm space-y-2 p-4 bg-black/20 rounded-lg">
                        <div className="flex justify-between"><span>Винрейт:</span> <span className="text-white">{sim2.winRate}%</span></div>
                        <div className="flex justify-between"><span>RR:</span> <span className="text-white">{sim2.rr}</span></div>
                        <div className="flex justify-between"><span>Мат. ожид.:</span> <span className="text-yellow-400">{sim2.results.mathExpectation.toFixed(2)}$</span></div>
                        <div className="flex justify-between"><span>Просадка:</span> <span className="text-red-400">{sim2.results.maxDrawdown.toFixed(2)}%</span></div>
                        <Button variant="ghost" size="sm" className="w-full text-red-500 hover:text-red-400 mt-4" onClick={() => { actions.deleteSimulation(sim2.id); setComp2(""); toast({title: t.simulator.simDeleted}); }}>
                          <Trash2 className="w-4 h-4 mr-2" /> {t.simulator.deleteSim}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
                
                {sim1 && sim2 && (
                  <div className="h-[400px] w-full mt-8 pt-8 border-t border-white/10">
                    <h4 className="text-center font-bold mb-4">Сравнение Медианных Исходов</h4>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={compareChartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                        <XAxis dataKey="step" stroke="#888" />
                        <YAxis stroke="#888" domain={['auto', 'auto']} />
                        <Tooltip contentStyle={{ backgroundColor: '#111', borderColor: '#333' }} />
                        <Legend />
                        <Line type="monotone" dataKey="sim1" stroke="#3b82f6" strokeWidth={2} dot={false} name={sim1.name} />
                        <Line type="monotone" dataKey="sim2" stroke="#a855f7" strokeWidth={2} dot={false} name={sim2.name} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
