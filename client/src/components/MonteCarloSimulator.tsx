import React, { useState, useMemo, useEffect } from "react";
import { useI18n } from "@/lib/i18n";
import { useStore, SimulationSession, SimulationResult } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { Trash2, Save, Activity, CalendarDays, Eye } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

function runMonteCarlo(
  mode: "SELF" | "PROP",
  winRate: number,
  rr: number,
  trades: number,
  startingBalance: number,
  riskPercent: number,
  riskType: "fixed" | "dynamic",
  commission: number,
  tradesPerDay: number
): SimulationResult {
  const NUM_PATHS = 1000;
  const paths: number[][] = [];
  
  let totalDrawdowns = 0;
  let ruinCount = 0;
  let streak3Count = 0;
  let streak5Count = 0;
  let streak10Count = 0;
  
  let phase1Pass = 0;
  let phase2Pass = 0;
  let livePass = 0;
  let totalTradesToLive = 0;
  
  for (let p = 0; p < NUM_PATHS; p++) {
    let balance = startingBalance;
    let maxBalance = startingBalance;
    let maxPathDrawdown = 0;
    let currentStreak = 0;
    let hit3 = false, hit5 = false, hit10 = false;
    
    const path: number[] = [balance];
    
    let propState: "PHASE_1" | "PHASE_2" | "LIVE" | "FAILED" = "PHASE_1";
    let phaseStartBalance = startingBalance;
    let dayStartBalance = startingBalance;
    let passedLiveAtTrade = -1;
    
    for (let t = 0; t < trades; t++) {
      if (balance <= 0 || (mode === "PROP" && propState === "FAILED")) {
        const fillVal = balance <= 0 ? 0 : balance;
        for (let i = t; i < trades; i++) path.push(fillVal);
        break;
      }
      
      if (tradesPerDay > 0) {
        if (tradesPerDay < 1) {
          dayStartBalance = balance;
        } else if (t > 0 && t % Math.ceil(tradesPerDay) === 0) {
          dayStartBalance = balance;
        }
      }
      
      const riskAmount = riskType === "fixed" ? phaseStartBalance * (riskPercent / 100) : balance * (riskPercent / 100);
      const commAmount = riskAmount * (commission / 100);
      
      const rand = Math.random() * 100;
      if (rand <= winRate) {
        balance += (riskAmount * rr) - commAmount;
        currentStreak = 0;
      } else {
        balance -= (riskAmount + commAmount);
        currentStreak++;
        if (currentStreak >= 3) hit3 = true;
        if (currentStreak >= 5) hit5 = true;
        if (currentStreak >= 10) hit10 = true;
      }
      
      if (balance > maxBalance) maxBalance = balance;
      const drawdown = ((maxBalance - balance) / maxBalance) * 100;
      if (drawdown > maxPathDrawdown) maxPathDrawdown = drawdown;
      
      if (mode === "PROP") {
        const dailyLossLimit = dayStartBalance * 0.95;
        const maxLossLimit = phaseStartBalance * 0.90;
        
        if (balance <= dailyLossLimit || balance <= maxLossLimit) {
          propState = "FAILED";
        } else {
          if (propState === "PHASE_1" && balance >= phaseStartBalance * 1.08) {
            propState = "PHASE_2";
            balance = phaseStartBalance; 
            dayStartBalance = phaseStartBalance;
            maxBalance = phaseStartBalance;
          } else if (propState === "PHASE_2" && balance >= phaseStartBalance * 1.05) {
            propState = "LIVE";
            passedLiveAtTrade = t + 1;
            balance = phaseStartBalance; 
            dayStartBalance = phaseStartBalance;
            maxBalance = phaseStartBalance;
          }
        }
      }
      
      path.push(balance);
    }
    
    if (mode === "PROP") {
      if (propState === "PHASE_2" || propState === "LIVE") phase1Pass++;
      if (propState === "LIVE") {
        phase2Pass++;
        livePass++;
        if (passedLiveAtTrade > 0) {
          totalTradesToLive += passedLiveAtTrade;
        }
      }
    }
    
    paths.push(path);
    totalDrawdowns += maxPathDrawdown;
    
    const finalBalance = path[path.length - 1];
    if (finalBalance < startingBalance * 0.1) ruinCount++;
    if (hit3) streak3Count++;
    if (hit5) streak5Count++;
    if (hit10) streak10Count++;
  }
  
  paths.sort((a, b) => a[a.length - 1] - b[b.length - 1]);
  const worstPath = paths[0];
  const medianPath = paths[Math.floor(NUM_PATHS / 2)];
  const bestPath = paths[NUM_PATHS - 1];
  
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
  
  let avgTradesToLive = undefined;
  let avgDaysToLive = undefined;
  
  if (mode === "PROP" && livePass > 0) {
    avgTradesToLive = totalTradesToLive / livePass;
    if (tradesPerDay > 0) {
      avgDaysToLive = avgTradesToLive / tradesPerDay;
    }
  }
  
  let monthlyIncome = null;
  let quarterlyIncome = null;
  let halfYearlyIncome = null;
  let yearlyIncome = null;
  
  if (tradesPerDay > 0) {
    monthlyIncome = mathExpectation * tradesPerDay * (365 / 12);
    quarterlyIncome = mathExpectation * tradesPerDay * (365 / 4);
    halfYearlyIncome = mathExpectation * tradesPerDay * (365 / 2);
    yearlyIncome = mathExpectation * tradesPerDay * 365;
  }
  
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
    monthlyIncome,
    quarterlyIncome,
    halfYearlyIncome,
    yearlyIncome,
    chartData,
    isPropMode: mode === "PROP",
    probPhase1: (phase1Pass / NUM_PATHS) * 100,
    probPhase2: (phase2Pass / (phase1Pass || 1)) * 100,
    probLive: (livePass / NUM_PATHS) * 100,
    avgTradesToLive,
    avgDaysToLive
  };
}

export function MonteCarloSimulator() {
  const { t } = useI18n();
  const { state, actions } = useStore();
  
  const [activeTab, setActiveTab] = useState("new");
  
  const [mode, setMode] = useState<"SELF" | "PROP">("SELF");
  const [sessionName, setSessionName] = useState("");
  const [rr, setRr] = useState(2);
  const [winRate, setWinRate] = useState(40);
  const [trades, setTrades] = useState(168);
  const [startBalance, setStartBalance] = useState(5000);
  const [riskPercent, setRiskPercent] = useState(1);
  const [riskType, setRiskType] = useState<"fixed" | "dynamic">("fixed");
  const [commission, setCommission] = useState(0.1);
  const [backtestDays, setBacktestDays] = useState<string>("912");
  
  const [currentResult, setCurrentResult] = useState<SimulationResult | null>(null);
  
  // Archive states
  const [viewingSimId, setViewingSimId] = useState<string>("");
  const [comp2Id, setComp2Id] = useState<string>("none");
  
  const calcTradesPerMonth = () => {
    const d = parseFloat(backtestDays);
    if (isNaN(d) || d <= 0) return 0;
    return (trades / d) * (365 / 12);
  };
  
  const handleRun = () => {
    if (!sessionName.trim()) {
      toast({ title: t.simulator.fillFields, variant: "destructive" });
      return;
    }
    
    const bDays = parseFloat(backtestDays);
    if (isNaN(bDays) || bDays <= 0) {
      toast({ title: "Укажите количество дней бэктеста", variant: "destructive" });
      return;
    }
    
    const tpd = trades / bDays;
    const res = runMonteCarlo(mode, winRate, rr, trades, startBalance, riskPercent, riskType, commission, tpd);
    setCurrentResult(res);
  };
  
  const handleSave = () => {
    if (!currentResult) return;
    
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
      tradesPerMonth: null,
      backtestTrades: trades,
      backtestDays: parseFloat(backtestDays) || null,
      results: currentResult
    };
    actions.addSimulation(sim);
    toast({ title: t.simulator.simSaved });
    
    setSessionName("");
    setRr(2);
    setWinRate(40);
    setTrades(168);
    setStartBalance(5000);
    setRiskPercent(1);
    setRiskType("fixed");
    setCommission(0.1);
    setBacktestDays("912");
    setCurrentResult(null);
  };
  
  const viewingSim = state.simulations?.find(s => s.id === viewingSimId);
  const comp2Sim = state.simulations?.find(s => s.id === comp2Id);
  
  const compareChartData = useMemo(() => {
    if (!viewingSim || !comp2Sim) return [];
    const len = Math.max(viewingSim.trades, comp2Sim.trades);
    const data = [];
    for (let i = 0; i <= len; i++) {
      data.push({
        step: i,
        sim1: viewingSim.results.chartData[i]?.median || viewingSim.results.chartData[viewingSim.results.chartData.length-1]?.median || 0,
        sim2: comp2Sim.results.chartData[i]?.median || comp2Sim.results.chartData[comp2Sim.results.chartData.length-1]?.median || 0,
      });
    }
    return data;
  }, [viewingSim, comp2Sim]);

  const formatPct = (val: number | null, sb: number) => {
    if (val === null) return "-";
    return (val / sb * 100).toFixed(2) + "%";
  };

  const renderDashboard = (res: SimulationResult, sb: number) => (
    <div className="space-y-6 mt-6 animate-in fade-in zoom-in-95 duration-500">
      <h3 className="text-xl font-bold tracking-wider text-red-400">{t.simulator.resultsTitle}</h3>
      
      {res.isPropMode && (
        <Card className="p-6 bg-blue-900/10 border-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.1)] mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="text-blue-400 w-5 h-5" />
            <h4 className="font-bold text-lg text-blue-100">{t.simulator.propStats || "PROP Статистика (Фазы)"}</h4>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="bg-black/40 p-4 rounded-lg">
              <p className="text-sm text-muted-foreground">{t.simulator.probPhase1 || "Шанс пройти Фазу 1"}</p>
              <p className="text-2xl font-bold text-blue-400">{res.probPhase1?.toFixed(1)}%</p>
            </div>
            <div className="bg-black/40 p-4 rounded-lg">
              <p className="text-sm text-muted-foreground">{t.simulator.probPhase2 || "Шанс пройти Фазу 2"}</p>
              <p className="text-2xl font-bold text-purple-400">{res.probPhase2?.toFixed(1)}%</p>
            </div>
            <div className="bg-black/40 p-4 rounded-lg border border-emerald-500/20">
              <p className="text-sm text-emerald-500/80 font-medium">{t.simulator.probLive || "Шанс получить Live"}</p>
              <p className="text-2xl font-bold text-emerald-400">{res.probLive?.toFixed(1)}%</p>
            </div>
          </div>
          
          {res.avgTradesToLive !== undefined && (
            <div className="bg-blue-950/30 p-4 rounded-lg border border-blue-500/10 grid grid-cols-1 md:grid-cols-2 gap-4">
               <div>
                 <p className="text-sm text-blue-300/80">{t.simulator.avgTradesToFunded || "Среднее кол-во сделок до Funded:"}</p>
                 <p className="text-xl font-bold text-blue-200">~{Math.ceil(res.avgTradesToLive)} сделок</p>
               </div>
               {res.avgDaysToLive !== undefined && (
                 <div>
                   <p className="text-sm text-blue-300/80">{t.simulator.avgDaysToFunded || "Среднее кол-во дней до Funded:"}</p>
                   <p className="text-xl font-bold text-blue-200">~{Math.ceil(res.avgDaysToLive)} дней</p>
                 </div>
               )}
            </div>
          )}
        </Card>
      )}
      
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
          <p 
            title={`${res.mathExpectation.toFixed(2)}$`}
            className="text-2xl font-bold text-yellow-400 cursor-help border-b border-dashed border-yellow-400/50 inline-block"
          >
            {formatPct(res.mathExpectation, sb)}
          </p>
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
            {!res.isPropMode && (
              <div className="flex justify-between text-red-400"><span>{t.simulator.riskOfRuin}:</span> <span>{res.riskOfRuin.toFixed(2)}%</span></div>
            )}
          </div>
        </Card>
        
        {res.monthlyIncome !== null && (
          <Card className="p-4 bg-background/50 border-white/5">
            <div className="flex items-center gap-2 mb-3">
              <CalendarDays className="w-4 h-4 text-green-400" />
              <h4 className="font-semibold">{t.simulator.timeProjections || "Временные проекции"}</h4>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>{t.simulator.avgIncome}:</span> 
                <span title={`${res.avgIncomePerTrade.toFixed(2)}$`} className="text-green-400 cursor-help border-b border-dashed border-green-400/50">{formatPct(res.avgIncomePerTrade, sb)}</span>
              </div>
              <div className="flex justify-between">
                <span>{t.simulator.monthIncome}:</span> 
                <span title={`${res.monthlyIncome?.toFixed(2)}$`} className="text-green-400 cursor-help border-b border-dashed border-green-400/50">{formatPct(res.monthlyIncome, sb)}</span>
              </div>
              <div className="flex justify-between">
                <span>{t.simulator.quarterIncome}:</span> 
                <span title={`${res.quarterlyIncome?.toFixed(2)}$`} className="text-green-400 cursor-help border-b border-dashed border-green-400/50">{formatPct(res.quarterlyIncome, sb)}</span>
              </div>
              <div className="flex justify-between">
                <span>{t.simulator.halfYearIncome}:</span> 
                <span title={`${res.halfYearlyIncome?.toFixed(2)}$`} className="text-green-400 cursor-help border-b border-dashed border-green-400/50">{formatPct(res.halfYearlyIncome, sb)}</span>
              </div>
              <div className="flex justify-between font-bold">
                <span>{t.simulator.yearIncome}:</span> 
                <span title={`${res.yearlyIncome?.toFixed(2)}$`} className="text-green-400 cursor-help border-b border-dashed border-green-400/50">{formatPct(res.yearlyIncome, sb)}</span>
              </div>
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
          <TabsTrigger value="compare">{t.simulator.compareSims || "Архив симуляций"}</TabsTrigger>
        </TabsList>
        
        <TabsContent value="new" className="mt-4">
          <Card className="p-6 bg-background/50 backdrop-blur border-white/5">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold tracking-wider text-red-400">{t.simulator.formTitle}</h3>
              <Select value={mode} onValueChange={(v: "SELF" | "PROP") => { setMode(v); setCurrentResult(null); }}>
                <SelectTrigger className="w-[200px] bg-black/60 border-primary/50 text-primary font-bold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SELF">{t.simulator.modeSelf || "SELF (Стандарт)"}</SelectItem>
                  <SelectItem value="PROP">{t.simulator.modeProp || "PROP (Проп-компания)"}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <Label>{t.simulator.sessionName}</Label>
                <Input value={sessionName} onChange={e => setSessionName(e.target.value)} placeholder={t.simulator.sessionNamePlaceholder} className="bg-black/40" />
              </div>
              <div className="space-y-2">
                <Label>{t.simulator.avgRR}</Label>
                <Input type="number" step="0.1" value={rr} onChange={e => { setRr(parseFloat(e.target.value)); setCurrentResult(null); }} className="bg-black/40" />
              </div>
              <div className="space-y-2">
                <Label>{t.simulator.winRate}</Label>
                <Input type="number" value={winRate} onChange={e => { setWinRate(parseFloat(e.target.value)); setCurrentResult(null); }} className="bg-black/40" />
              </div>
              
              <div className="space-y-2">
                <Label>{t.simulator.tradesCount || "Кол-во сделок"}</Label>
                <Input type="number" value={trades} onChange={e => { setTrades(parseFloat(e.target.value)); setCurrentResult(null); }} className="bg-black/40" />
              </div>
              <div className="space-y-2">
                <Label>{t.simulator.startBalance}</Label>
                <Input type="number" value={startBalance} onChange={e => { setStartBalance(parseFloat(e.target.value)); setCurrentResult(null); }} className="bg-black/40" />
              </div>
              <div className="space-y-2">
                <Label>{t.simulator.riskPerTrade}</Label>
                <Input type="number" step="0.1" value={riskPercent} onChange={e => { setRiskPercent(parseFloat(e.target.value)); setCurrentResult(null); }} className="bg-black/40" />
              </div>
              
              <div className="space-y-2">
                <Label>{t.simulator.riskType}</Label>
                <Select value={riskType} onValueChange={(v: "fixed" | "dynamic") => { setRiskType(v); setCurrentResult(null); }}>
                  <SelectTrigger className="bg-black/40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed">{t.simulator.riskFixed}</SelectItem>
                    <SelectItem value="dynamic">{t.simulator.riskDynamic}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t.simulator.commission}</Label>
                <Input type="number" step="0.01" value={commission} onChange={e => { setCommission(parseFloat(e.target.value)); setCurrentResult(null); }} className="bg-black/40" />
              </div>
              
              <div className="space-y-2">
                <Label>{t.simulator.backtestDays || "Период (дней)"}</Label>
                <Input 
                  type="number" 
                  value={backtestDays} 
                  onChange={e => { setBacktestDays(e.target.value); setCurrentResult(null); }} 
                  placeholder="Например: 912" 
                  className="bg-black/40" 
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end">
               <div className="text-sm text-gray-400 bg-black/20 px-3 py-1.5 rounded-md border border-white/5">
                 Сделок в месяц (в среднем): <span className="text-white font-bold">{calcTradesPerMonth().toFixed(1)}</span>
               </div>
            </div>
            
            <div className="flex gap-4 mt-6">
              <Button onClick={handleRun} className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold tracking-widest">{t.simulator.runSim}</Button>
              {currentResult && (
                <Button onClick={handleSave} variant="outline" className="flex-1 border-red-500/50 hover:bg-red-500/10">
                  <Save className="w-4 h-4 mr-2" /> {t.simulator.saveSim}
                </Button>
              )}
            </div>
          </Card>
          
          {currentResult && renderDashboard(currentResult, startBalance)}
        </TabsContent>
        
        <TabsContent value="compare" className="mt-4">
          <Card className="p-6 bg-background/50 backdrop-blur border-white/5 min-h-[400px]">
            {(!state.simulations || state.simulations.length === 0) ? (
              <div className="text-center text-muted-foreground py-12">{t.simulator.noArchive}</div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                
                {/* Левая панель - Список сессий */}
                <div className="lg:col-span-1 border-r border-white/10 pr-4 space-y-3 max-h-[800px] overflow-y-auto custom-scrollbar">
                  <h4 className="font-bold mb-4 text-gray-300">Сохраненные сессии</h4>
                  {state.simulations.map(sim => (
                    <div 
                      key={sim.id} 
                      onClick={() => setViewingSimId(sim.id)}
                      className={`p-3 rounded-lg cursor-pointer border transition-colors ${viewingSimId === sim.id ? 'bg-black/60 border-red-500/50 shadow-inner shadow-red-500/10' : 'bg-black/20 border-white/5 hover:bg-black/40'}`}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <h5 className="font-bold text-sm truncate pr-2" title={sim.name}>{sim.name}</h5>
                        <Badge variant="outline" className={`text-[10px] px-1 py-0 h-4 ${sim.mode === 'PROP' ? 'bg-blue-500/20 text-blue-400 border-blue-500/50' : 'bg-gray-500/20 text-gray-300 border-gray-500/50'}`}>{sim.mode}</Badge>
                      </div>
                      <div className="text-xs text-gray-500 mb-2">{new Date(sim.createdAt).toLocaleDateString()}</div>
                      <div className="flex justify-between text-xs items-center">
                        <span className="text-white bg-white/10 px-1.5 py-0.5 rounded">WR: {sim.winRate}%</span>
                        <span className="text-yellow-400">EV: {formatPct(sim.results.mathExpectation, sim.startingBalance)}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Основная панель - Детальный просмотр */}
                <div className="lg:col-span-3">
                  {viewingSim ? (
                    <div className="animate-in fade-in duration-300 h-full">
                      <div className="flex justify-between items-center bg-black/30 p-4 rounded-lg border border-white/5 mb-2">
                        <div>
                          <h2 className="text-2xl font-bold text-white mb-1 flex items-center gap-2">
                            <Eye className="w-5 h-5 text-red-400" />
                            {viewingSim.name}
                          </h2>
                          <div className="text-sm text-gray-400">Создано: {new Date(viewingSim.createdAt).toLocaleString()}</div>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2 items-end sm:items-center">
                          <Select value={comp2Id} onValueChange={setComp2Id}>
                            <SelectTrigger className="bg-black/60 w-[200px] border-primary/30">
                              <SelectValue placeholder="Сравнить с..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Не сравнивать</SelectItem>
                              {state.simulations.filter(s => s.id !== viewingSim.id).map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <Button variant="destructive" size="icon" onClick={() => { 
                            actions.deleteSimulation(viewingSim.id); 
                            if(viewingSimId === viewingSim.id) setViewingSimId(""); 
                            toast({title: t.simulator.simDeleted}); 
                          }}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                        <div className="bg-black/40 p-3 rounded-lg border border-white/5">
                          <p className="text-xs text-gray-500">Сделок / Период</p>
                          <p className="font-bold text-white">{viewingSim.trades} / {viewingSim.backtestDays || "-"} дней</p>
                        </div>
                        <div className="bg-black/40 p-3 rounded-lg border border-white/5">
                          <p className="text-xs text-gray-500">Стартовый баланс</p>
                          <p className="font-bold text-white">{viewingSim.startingBalance}$</p>
                        </div>
                        <div className="bg-black/40 p-3 rounded-lg border border-white/5">
                          <p className="text-xs text-gray-500">Риск на сделку</p>
                          <p className="font-bold text-white">{viewingSim.riskPercent}% ({viewingSim.riskType})</p>
                        </div>
                        <div className="bg-black/40 p-3 rounded-lg border border-white/5">
                          <p className="text-xs text-gray-500">Комиссия</p>
                          <p className="font-bold text-white">{viewingSim.commission}%</p>
                        </div>
                      </div>

                      {renderDashboard(viewingSim.results, viewingSim.startingBalance)}

                      {comp2Sim && comp2Id !== "none" && (
                         <div className="h-[400px] w-full mt-12 pt-8 border-t border-white/10">
                           <h4 className="text-center font-bold mb-4 text-xl">
                             Сравнение Медианных Исходов: <span className="text-blue-500">{viewingSim.name}</span> vs <span className="text-purple-500">{comp2Sim.name}</span>
                           </h4>
                           <ResponsiveContainer width="100%" height="100%">
                             <LineChart data={compareChartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                               <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                               <XAxis dataKey="step" stroke="#888" />
                               <YAxis stroke="#888" domain={['auto', 'auto']} />
                               <Tooltip contentStyle={{ backgroundColor: '#111', borderColor: '#333' }} />
                               <Legend />
                               <Line type="monotone" dataKey="sim1" stroke="#3b82f6" strokeWidth={2} dot={false} name={viewingSim.name} />
                               <Line type="monotone" dataKey="sim2" stroke="#a855f7" strokeWidth={2} dot={false} name={comp2Sim.name} />
                             </LineChart>
                           </ResponsiveContainer>
                         </div>
                      )}
                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-gray-500 py-32 border border-dashed border-white/10 rounded-xl bg-black/10">
                       <CalendarDays className="w-16 h-16 mb-4 opacity-50" />
                       <p className="text-lg">Выберите сессию из списка слева</p>
                       <p className="text-sm opacity-70">для просмотра деталей и статистики</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
