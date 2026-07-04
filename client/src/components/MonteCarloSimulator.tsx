import React, { useState, useMemo, useRef, useEffect } from "react";
import { useI18n } from "@/lib/i18n";
import { useStore, SimulationSession, SimulationResult, Asset } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { Trash2, Save, Activity, CalendarDays, Eye, Download, Share2, TrendingUp, ShieldAlert, BarChart3, Plus, X } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import html2canvas from "html2canvas";

function runMonteCarloPortfolio(
  mode: "SELF" | "PROP",
  startingBalance: number,
  riskType: "fixed" | "dynamic",
  commission: number,
  assets: Asset[],
  maxTradesPerDay: number = 0,
  maxWinsPerDay: number = 0
): SimulationResult {
  const NUM_PATHS = 1000;
  const paths: number[][] = [];
  
  let totalDrawdowns = 0;
  let ruinCount = 0;
  let phase1Pass = 0;
  let phase2Pass = 0;
  let livePass = 0;
  let totalDaysToLive = 0;
  
  let totalEmpiricalProfit = 0;
  let totalEmpiricalWins = 0;
  let totalEmpiricalLosses = 0;
  let totalActiveDays = 0;
  
  // Calculate frequencies and metrics per asset
  const assetConfigs = assets.map(a => {
    const freq = a.backtestDays > 0 ? a.trades / a.backtestDays : 0;
    return { ...a, freq };
  });

  const maxDays = Math.max(...assets.map(a => a.backtestDays), 1);
  const avgTradesPerDay = assets.reduce((acc, a) => acc + (a.trades / (a.backtestDays || 1)), 0);

  // Global variables for overall stats
  let streak3Count = 0;
  let streak5Count = 0;
  let streak10Count = 0;

  for (let p = 0; p < NUM_PATHS; p++) {
    let balance = startingBalance;
    let maxBalance = startingBalance;
    let maxPathDrawdown = 0;
    let currentStreak = 0;
    let hit3 = false, hit5 = false, hit10 = false;
    
    const path: number[] = [balance];
    
    let propState: "PHASE_1" | "PHASE_2" | "LIVE" | "FAILED" = "PHASE_1";
    let phaseStartBalance = startingBalance;
    let passedLiveAtDay = -1;
    
    for (let day = 1; day <= maxDays; day++) {
      if (balance <= 0 || (mode === "PROP" && propState === "FAILED")) {
        const fillVal = balance <= 0 ? 0 : balance;
        path.push(fillVal);
        continue; // Keep array same length
      }
      
      totalActiveDays++;
      let dayStartBalance = balance;
      let winsToday = 0;
      
      // Generate trades for today
      let todayTrades: { asset: typeof assetConfigs[0] }[] = [];
      
      for (const asset of assetConfigs) {
        if (day > asset.backtestDays) continue;
        
        const integerTrades = Math.floor(asset.freq);
        const fractionalTrade = asset.freq - integerTrades;
        
        for (let i = 0; i < integerTrades; i++) {
          todayTrades.push({ asset });
        }
        if (Math.random() < fractionalTrade) {
          todayTrades.push({ asset });
        }
      }
      
      // Shuffle today's trades randomly
      todayTrades.sort(() => Math.random() - 0.5);
      
      if (maxTradesPerDay > 0 && todayTrades.length > maxTradesPerDay) {
        todayTrades = todayTrades.slice(0, maxTradesPerDay);
      }
      
      // Execute trades
      for (const trade of todayTrades) {
        if (maxWinsPerDay > 0 && winsToday >= maxWinsPerDay) {
          break; // Stop trading for the day after hitting Take-Profit limit
        }
        
        const riskAmount = riskType === "fixed" ? phaseStartBalance * (trade.asset.riskPercent / 100) : balance * (trade.asset.riskPercent / 100);
        const commAmount = riskAmount * (commission / 100);
        
        const isWin = (Math.random() * 100) <= trade.asset.winRate;
        
        // Empirical tracking (Always as fixed risk from starting balance to get pure mathematical edge)
        const shadowRisk = startingBalance * (trade.asset.riskPercent / 100);
        const shadowComm = shadowRisk * (commission / 100);
        if (isWin) {
          totalEmpiricalProfit += (shadowRisk * trade.asset.rr) - shadowComm;
          totalEmpiricalWins++;
        } else {
          totalEmpiricalProfit -= (shadowRisk + shadowComm);
          totalEmpiricalLosses++;
        }
        
        if (isWin) {
          balance += (riskAmount * trade.asset.rr) - commAmount;
          currentStreak = 0;
          winsToday++;
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
          const dailyLossLimit = dayStartBalance * 0.95; // 5% Daily DD
          const maxLossLimit = phaseStartBalance * 0.90; // 10% Total DD
          
          if (balance <= dailyLossLimit || balance <= maxLossLimit) {
            propState = "FAILED";
            break; // Stop trading today
          } else {
            if (propState === "PHASE_1" && balance >= phaseStartBalance * 1.08) {
              propState = "PHASE_2";
              balance = phaseStartBalance; 
              dayStartBalance = phaseStartBalance;
              maxBalance = phaseStartBalance;
            } else if (propState === "PHASE_2" && balance >= phaseStartBalance * 1.05) {
              propState = "LIVE";
              if (passedLiveAtDay === -1) passedLiveAtDay = day;
              balance = phaseStartBalance; 
              dayStartBalance = phaseStartBalance;
              maxBalance = phaseStartBalance;
            }
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
        if (passedLiveAtDay > 0) {
          totalDaysToLive += passedLiveAtDay;
        }
      }
    }
    
    paths.push(path);
    totalDrawdowns += maxPathDrawdown;
    
    const finalBalance = path[path.length - 1];
    if (finalBalance < startingBalance * 0.1) ruinCount++; // Risk of ruin for SELF
    
    if (hit3) streak3Count++;
    if (hit5) streak5Count++;
    if (hit10) streak10Count++;
  }
  
  paths.sort((a, b) => a[a.length - 1] - b[b.length - 1]);
  const worstPath = paths[0];
  const medianPath = paths[Math.floor(NUM_PATHS / 2)];
  const bestPath = paths[NUM_PATHS - 1];
  
  const chartData = [];
  for (let i = 0; i <= maxDays; i++) {
    chartData.push({ 
      step: i, 
      worst: worstPath[i] || 0, 
      median: medianPath[i] || 0, 
      best: bestPath[i] || 0 
    });
  }
  
  const empiricalEVPerDay = totalActiveDays > 0 ? (totalEmpiricalProfit / totalActiveDays) : 0;
  const overallWinRate = (totalEmpiricalWins + totalEmpiricalLosses) > 0 
    ? (totalEmpiricalWins / (totalEmpiricalWins + totalEmpiricalLosses)) * 100 
    : 0;
  
  let avgDaysToLive = undefined;
  if (mode === "PROP" && livePass > 0) {
    avgDaysToLive = totalDaysToLive / livePass;
  }
  
  let monthlyIncome = avgTradesPerDay > 0 ? empiricalEVPerDay * (365 / 12) : null;
  let quarterlyIncome = avgTradesPerDay > 0 ? empiricalEVPerDay * (365 / 4) : null;
  let halfYearlyIncome = avgTradesPerDay > 0 ? empiricalEVPerDay * (365 / 2) : null;
  let yearlyIncome = avgTradesPerDay > 0 ? empiricalEVPerDay * 365 : null;
  
  return {
    probSL: 100 - overallWinRate,
    probTP: overallWinRate,
    profitFactor: 0, 
    mathExpectation: empiricalEVPerDay, // updated to use empirical EV
    streak3: (streak3Count / NUM_PATHS) * 100,
    streak5: (streak5Count / NUM_PATHS) * 100,
    streak10: (streak10Count / NUM_PATHS) * 100,
    maxDrawdown: totalDrawdowns / NUM_PATHS,
    riskOfRuin: (ruinCount / NUM_PATHS) * 100,
    avgIncomePerTrade: empiricalEVPerDay, // This is now correctly EV per DAY
    monthlyIncome,
    quarterlyIncome,
    halfYearlyIncome,
    yearlyIncome,
    chartData,
    isPropMode: mode === "PROP",
    probPhase1: (phase1Pass / NUM_PATHS) * 100,
    probPhase2: (phase2Pass / (phase1Pass || 1)) * 100,
    probLive: (livePass / NUM_PATHS) * 100,
    avgDaysToLive
  };
}

export function MonteCarloSimulator() {
  const { t } = useI18n();
  const { state, actions } = useStore();
  
  const [activeTab, setActiveTab] = useState("new");
  
  const [mode, setMode] = useState<"SELF" | "PROP">("SELF");
  const [sessionName, setSessionName] = useState("");
  const [startBalance, setStartBalance] = useState(5000);
  const [riskType, setRiskType] = useState<"fixed" | "dynamic">("fixed");
  const [commission, setCommission] = useState(0.1);
  const [maxTrades, setMaxTrades] = useState<number | undefined>(undefined);
  const [maxWins, setMaxWins] = useState<number | undefined>(undefined);
  const [simNotes, setSimNotes] = useState("");
  
  // helper to calculate winrate/profit
  const calcTargetProfit = (a: Partial<Asset>, comm: number) => {
     const w = (a.winRate || 0) / 100;
     const c = comm / 100;
     const evR = w * ((a.rr || 0) + 1) - (1 + c);
     return parseFloat((evR * (a.trades || 0) * (a.riskPercent || 0)).toFixed(2));
  };

  const [assets, setAssets] = useState<Asset[]>([
    { id: "1", name: "Asset 1 (e.g. EURUSD)", winRate: 40, rr: 2, riskPercent: 1, trades: 168, backtestDays: 912, targetProfit: 33.43 }
  ]);
  
  const [currentResult, setCurrentResult] = useState<SimulationResult | null>(null);
  
  const [viewingSimId, setViewingSimId] = useState<string>("");
  const [comp2Id, setComp2Id] = useState<string>("none");

  const shareCardRef = useRef<HTMLDivElement>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  
  // Recalculate all target profits when commission changes
  useEffect(() => {
    setAssets(prev => prev.map(a => ({ ...a, targetProfit: calcTargetProfit(a, commission) })));
  }, [commission]);
  
  const handleAddAsset = () => {
    const newAsset: Asset = { 
      id: Date.now().toString(), 
      name: `Asset ${assets.length + 1}`, 
      winRate: 40, 
      rr: 2, 
      riskPercent: 1, 
      trades: 100, 
      backtestDays: 365 
    };
    newAsset.targetProfit = calcTargetProfit(newAsset, commission);
    setAssets([...assets, newAsset]);
  };

  const handleRemoveAsset = (id: string) => {
    if (assets.length === 1) return;
    setAssets(assets.filter(a => a.id !== id));
  };

  const updateAsset = (id: string, field: keyof Asset, value: string | number) => {
    setAssets(assets.map(a => {
      if (a.id !== id) return a;
      const updated = { ...a, [field]: value };
      
      if (field === 'targetProfit') {
         const p = parseFloat(value as string) || 0;
         if (updated.trades > 0 && updated.riskPercent > 0) {
            const evR = p / (updated.trades * updated.riskPercent);
            const c = commission / 100;
            const w = ((evR + 1 + c) / (updated.rr + 1)) * 100;
            updated.winRate = parseFloat(w.toFixed(2));
         }
      } else if (['winRate', 'rr', 'riskPercent', 'trades'].includes(field)) {
         updated.targetProfit = calcTargetProfit(updated, commission);
      }
      return updated;
    }));
    setCurrentResult(null);
  };
  
  const calcTotalTradesPerMonth = () => {
    const raw = assets.reduce((acc, a) => {
      const d = a.backtestDays;
      if (d <= 0) return acc;
      return acc + ((a.trades / d) * (365 / 12));
    }, 0);
    if (maxTrades && maxTrades > 0) {
       const dailyAvg = raw / (365/12);
       if (dailyAvg > maxTrades) return maxTrades * (365 / 12);
    }
    return raw;
  };
  
  const handleRun = () => {
    if (!sessionName.trim()) {
      toast({ title: t.simulator.fillFields, variant: "destructive" });
      return;
    }
    
    for (const a of assets) {
      if (a.backtestDays <= 0 || a.trades <= 0) {
        toast({ title: `Некорректные данные бэктеста для ${a.name}`, variant: "destructive" });
        return;
      }
    }
    
    const res = runMonteCarloPortfolio(mode, startBalance, riskType, commission, assets, maxTrades || 0, maxWins || 0);
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
      startingBalance: startBalance,
      riskType, 
      commission, 
      maxTradesPerDay: maxTrades,
      maxWinsPerDay: maxWins,
      notes: simNotes,
      assets: [...assets],
      results: currentResult
    };
    actions.addSimulation(sim);
    toast({ title: t.simulator.simSaved });
    
    setSessionName("");
    setSimNotes("");
    setCurrentResult(null);
  };

  const handleDownloadJson = (sim: SimulationSession) => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(sim, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `simulation_${sim.name.replace(/\s+/g, '_')}_${new Date(sim.createdAt).toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
    toast({ title: "Файл JSON скачан!" });
  };

  const handleShareImage = async () => {
    if (!shareCardRef.current) return;
    setIsCapturing(true);
    
    setTimeout(async () => {
      try {
        const canvas = await html2canvas(shareCardRef.current!, {
          backgroundColor: '#050505',
          scale: 2, 
          useCORS: true,
          logging: false
        });

        canvas.toBlob(async (blob) => {
          if (!blob) {
            setIsCapturing(false);
            return;
          }
          const file = new File([blob], 'persona_life_stats.png', { type: 'image/png' });
          
          if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
            try {
              await navigator.share({
                files: [file],
                title: 'Моя статистика Persona Life',
              });
              toast({ title: "Успешно отправлено!" });
            } catch (e: any) {
              if (e.name !== 'AbortError') console.error("Share failed", e);
            }
          } else {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'persona_life_stats.png';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            toast({ title: "Картинка скачана!" });
          }
          setIsCapturing(false);
        }, 'image/png');
      } catch (err) {
        console.error(err);
        toast({ title: "Ошибка генерации изображения", variant: "destructive" });
        setIsCapturing(false);
      }
    }, 100);
  };
  
  const viewingSim = state.simulations?.find(s => s.id === viewingSimId);
  const comp2Sim = state.simulations?.find(s => s.id === comp2Id);
  
  const compareChartData = useMemo(() => {
    if (!viewingSim || !comp2Sim) return [];
    const len = Math.max(viewingSim.results.chartData.length, comp2Sim.results.chartData.length);
    const data = [];
    for (let i = 0; i < len; i++) {
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

  const renderDashboard = (res: SimulationResult, sb: number, assetsList: Asset[]) => (
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
          
          {res.avgDaysToLive !== undefined && (
            <div className="bg-blue-950/30 p-4 rounded-lg border border-blue-500/10 grid grid-cols-1 md:grid-cols-2 gap-4">
               <div>
                 <p className="text-sm text-blue-300/80">{t.simulator.avgDaysToFunded || "Среднее кол-во дней до Funded:"}</p>
                 <p className="text-xl font-bold text-blue-200">~{Math.ceil(res.avgDaysToLive)} дней</p>
               </div>
            </div>
          )}
        </Card>
      )}
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 bg-background/50 backdrop-blur border-white/5">
          <p className="text-sm text-muted-foreground">{t.simulator.probSL || "Общий шанс SL"}</p>
          <p className="text-2xl font-bold text-red-400">{res.probSL.toFixed(1)}%</p>
        </Card>
        <Card className="p-4 bg-background/50 backdrop-blur border-white/5">
          <p className="text-sm text-muted-foreground">{t.simulator.probTP || "Общий шанс TP"}</p>
          <p className="text-2xl font-bold text-green-400">{res.probTP.toFixed(1)}%</p>
        </Card>
        <Card className="p-4 bg-background/50 backdrop-blur border-white/5">
          <p className="text-sm text-muted-foreground">Активов в портфеле</p>
          <p className="text-2xl font-bold text-blue-400">{assetsList.length}</p>
        </Card>
        <Card className="p-4 bg-background/50 backdrop-blur border-white/5">
          <p className="text-sm text-muted-foreground">{t.simulator.mathExpectation}</p>
          <p 
            title={`${res.mathExpectation.toFixed(2)}$`}
            className="text-2xl font-bold text-yellow-400 cursor-help border-b border-dashed border-yellow-400/50 inline-block"
          >
            {formatPct(res.mathExpectation, sb)} <span className="text-sm">в день</span>
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
        <h4 className="font-semibold mb-4">{t.simulator.chartTitle} (По дням, 1000 симуляций)</h4>
        <div className="h-[400px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={res.chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="step" stroke="#888" />
              <YAxis stroke="#888" domain={['auto', 'auto']} />
              <Tooltip contentStyle={{ backgroundColor: '#111', borderColor: '#333' }} />
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
      
      {/* Horizontal Share Card Rendered Off-screen for html2canvas */}
      {viewingSim && (
        <div style={{ position: "fixed", top: "-9999px", left: "-9999px" }}>
          <div 
            ref={shareCardRef} 
            className="w-[1000px] h-[600px] text-white overflow-hidden relative flex flex-col justify-between"
            style={{ backgroundColor: '#050505', fontFamily: "'Inter', sans-serif" }}
          >
            <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-red-600/10 blur-[100px] rounded-full pointer-events-none" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-blue-600/10 blur-[120px] rounded-full pointer-events-none" />
            <div className="absolute top-[20%] right-[30%] w-[300px] h-[300px] bg-emerald-500/5 blur-[80px] rounded-full pointer-events-none" />
            
            <div className="relative z-10 flex w-full h-full p-8 gap-8">
              
              <div className="w-[40%] flex flex-col justify-between h-full">
                <div>
                  <h2 className="text-3xl font-black text-white leading-tight mb-2 tracking-wide truncate pr-4">{viewingSim.name}</h2>
                  <div className="flex items-center gap-3">
                    <Badge className={`text-sm px-3 py-1 font-bold tracking-widest uppercase leading-none h-auto flex items-center justify-center ${viewingSim.mode === 'PROP' ? 'bg-blue-500 text-white' : 'bg-zinc-700 text-white'}`}>
                      {viewingSim.mode}
                    </Badge>
                    <span className="text-zinc-500 text-sm font-medium leading-none">Portfolio Monte-Carlo</span>
                  </div>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-md space-y-5">
                  <div className="flex justify-between items-center border-b border-white/10 pb-5">
                    <div>
                      <p className="text-xs text-zinc-500 uppercase tracking-widest mb-1 font-semibold">Активов</p>
                      <p className="text-3xl font-black text-white">{viewingSim.assets?.length || 0}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-zinc-500 uppercase tracking-widest mb-1 font-semibold">Сделок / Месяц</p>
                      <p className="text-3xl font-black text-white">
                        {viewingSim.assets.reduce((acc, a) => acc + ((a.trades / (a.backtestDays || 1)) * (365 / 12)), 0).toFixed(1)}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                     <div>
                       <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1 font-semibold">Стартовый баланс</p>
                       <p className="text-lg font-bold text-white">{viewingSim.startingBalance}$</p>
                     </div>
                     <div>
                       <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1 font-semibold">Win Rate (Avg)</p>
                       <p className="text-lg font-bold text-white">{((viewingSim.assets || []).reduce((acc, a) => acc + a.winRate, 0) / Math.max(viewingSim.assets?.length || 1, 1)).toFixed(1)}%</p>
                     </div>
                  </div>
                </div>
                
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-md">
                   <div className="flex justify-between items-center mb-4">
                     <span className="text-zinc-400 text-sm font-medium">Вероятность лузстрика 5:</span>
                     <span className="text-white font-bold text-lg">{viewingSim.results.streak5?.toFixed(1)}%</span>
                   </div>
                   <div className="flex justify-between items-center mb-4">
                     <span className="text-zinc-400 text-sm font-medium">Вероятность лузстрика 10:</span>
                     <span className="text-white font-bold text-lg">{viewingSim.results.streak10?.toFixed(1)}%</span>
                   </div>
                   <div className="flex justify-between items-center pt-4 border-t border-white/10">
                     <span className="text-zinc-400 text-sm font-medium">Ожидаемая Макс. Просадка:</span>
                     <span className="text-yellow-500 font-bold text-xl">{viewingSim.results.maxDrawdown?.toFixed(2)}%</span>
                   </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded bg-red-600 flex items-center justify-center font-black text-sm text-white">P</div>
                  <span className="font-bold tracking-widest text-base text-white">PERSONA LIFE</span>
                </div>
              </div>
              
              <div className="w-[60%] flex flex-col justify-between h-full">
                
                {viewingSim.mode === "PROP" ? (
                  <div className="bg-gradient-to-br from-blue-900/30 to-blue-950/20 border border-blue-500/20 rounded-3xl p-8 shadow-[0_0_40px_rgba(59,130,246,0.1)] flex-grow flex flex-col justify-center">
                    
                    <h3 className="text-center text-blue-300/50 text-sm uppercase tracking-[0.2em] font-black mb-8">Шансы прохождения (Prop)</h3>
                    
                    <div className="flex justify-center items-center gap-8 mb-10 w-full px-8">
                      <div className="flex-1 text-center bg-black/20 p-5 rounded-2xl border border-white/5 flex flex-col justify-center items-center">
                        <p className="text-zinc-400 text-xs uppercase tracking-widest mb-2 font-medium">Фаза 1 (+8%)</p>
                        <p className="text-4xl font-black text-blue-400 leading-none">{viewingSim.results.probPhase1?.toFixed(1)}%</p>
                      </div>
                      <div className="text-blue-500/30 text-3xl font-light">→</div>
                      <div className="flex-1 text-center bg-black/20 p-5 rounded-2xl border border-white/5 flex flex-col justify-center items-center">
                        <p className="text-zinc-400 text-xs uppercase tracking-widest mb-2 font-medium">Фаза 2 (+5%)</p>
                        <p className="text-4xl font-black text-purple-400 leading-none">{viewingSim.results.probPhase2?.toFixed(1)}%</p>
                      </div>
                    </div>
                    
                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-6 text-center mx-8 flex flex-col justify-center items-center">
                      <p className="text-emerald-500/80 text-sm font-black uppercase tracking-[0.2em] mb-2">Шанс получить Funded</p>
                      <p className="text-[64px] leading-none font-black text-emerald-400 drop-shadow-[0_0_15px_rgba(52,211,153,0.3)]">{viewingSim.results.probLive?.toFixed(1)}%</p>
                    </div>
                  </div>
                ) : (
                  <div className="bg-gradient-to-br from-yellow-900/20 to-zinc-900/30 border border-yellow-500/20 rounded-3xl p-8 shadow-[0_0_40px_rgba(234,179,8,0.1)] flex-grow flex flex-col justify-center">
                    <h3 className="text-center text-yellow-500/50 text-sm uppercase tracking-[0.2em] font-black mb-12">Итог портфеля (Self)</h3>
                    
                    <div className="flex justify-center items-center w-full">
                      <div className="flex-1 text-center border-r border-white/10 pr-8">
                        <p className="text-zinc-400 text-sm uppercase tracking-widest mb-4 font-medium">Мат. Ожидание (EV) в день</p>
                        <p className="text-6xl font-black text-yellow-400">{formatPct(viewingSim.results.mathExpectation, viewingSim.startingBalance)}</p>
                      </div>
                      <div className="flex-1 text-center pl-8">
                        <p className="text-zinc-400 text-sm uppercase tracking-widest mb-4 font-medium">Риск полного разорения</p>
                        <p className="text-6xl font-black text-red-500">{viewingSim.results.riskOfRuin?.toFixed(1)}%</p>
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="bg-white/5 border border-white/10 rounded-3xl p-6 mt-6 h-[180px] flex flex-col justify-between backdrop-blur-md">
                   <div className="flex justify-between items-center mb-2 px-2">
                     <span className="text-zinc-500 text-xs font-semibold uppercase tracking-widest">График симуляции (Дни)</span>
                     <span className="text-zinc-600 text-xs">
                        {new Date().toLocaleString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                     </span>
                   </div>
                   <div className="flex-grow w-full opacity-80 flex items-end overflow-hidden">
                      <LineChart width={540} height={130} data={viewingSim.results.chartData}>
                          <YAxis domain={['dataMin - 100', 'dataMax + 100']} hide />
                          <Line type="monotone" dataKey="median" stroke="#eab308" strokeWidth={4} dot={false} isAnimationActive={false} />
                          <Line type="monotone" dataKey="worst" stroke="#ef4444" strokeWidth={1.5} strokeDasharray="4 4" dot={false} isAnimationActive={false} />
                          <Line type="monotone" dataKey="best" stroke="#22c55e" strokeWidth={1.5} strokeDasharray="4 4" dot={false} isAnimationActive={false} />
                      </LineChart>
                   </div>
                </div>

              </div>

            </div>
          </div>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-background/50 border border-white/10 w-full flex">
          <TabsTrigger value="new" className="flex-1">Сборка портфеля</TabsTrigger>
          <TabsTrigger value="compare" className="flex-1">{t.simulator.compareSims || "Архив симуляций"}</TabsTrigger>
        </TabsList>
        
        <TabsContent value="new" className="mt-4">
          <Card className="p-6 bg-background/50 backdrop-blur border-white/5 border-t-4 border-t-red-600 shadow-2xl">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4">
              <div>
                <h3 className="text-2xl font-black tracking-wider text-white">Портфельная Time-Series Симуляция</h3>
                <p className="text-zinc-500 text-sm mt-1">Оценивает корреляцию просадок активов по дням с хардкод-лимитами PROP</p>
              </div>
              <Select value={mode} onValueChange={(v: "SELF" | "PROP") => { setMode(v); setCurrentResult(null); }}>
                <SelectTrigger className={`w-[200px] font-bold border-2 ${mode === 'PROP' ? 'bg-blue-950/50 border-blue-500/50 text-blue-400' : 'bg-black/60 border-primary/50 text-primary'}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SELF">{t.simulator.modeSelf || "SELF (Стандарт)"}</SelectItem>
                  <SelectItem value="PROP">{t.simulator.modeProp || "PROP (8% / 5% / 10% / 5%)"}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
              <div className="md:col-span-1 space-y-6 bg-black/20 p-6 rounded-2xl border border-white/5 shadow-inner">
                <div className="flex items-center gap-2 mb-2 border-b border-white/10 pb-3">
                  <ShieldAlert className="w-5 h-5 text-red-400" />
                  <h4 className="font-bold text-base text-zinc-300">Счет и Риск</h4>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-zinc-400 text-xs">Название сессии</Label>
                  <Input value={sessionName} onChange={e => setSessionName(e.target.value)} placeholder="Мой портфель" className="bg-black/40 border-zinc-800" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-zinc-400 text-xs">{t.simulator.startBalance}</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-zinc-500 text-sm">$</span>
                    <Input type="number" value={startBalance} onChange={e => { setStartBalance(parseFloat(e.target.value)); setCurrentResult(null); }} className="bg-black/40 border-zinc-800 pl-7" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-zinc-400 text-xs">{t.simulator.riskType}</Label>
                  <Select value={riskType} onValueChange={(v: "fixed" | "dynamic") => { setRiskType(v); setCurrentResult(null); }}>
                    <SelectTrigger className="bg-black/40 border-zinc-800"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fixed">{t.simulator.riskFixed}</SelectItem>
                      <SelectItem value="dynamic">{t.simulator.riskDynamic}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-zinc-400 text-xs">{t.simulator.commission}</Label>
                  <div className="relative">
                    <Input type="number" step="0.01" value={commission} onChange={e => { setCommission(parseFloat(e.target.value)); setCurrentResult(null); }} className="bg-black/40 border-zinc-800 pr-8" />
                    <span className="absolute right-3 top-2.5 text-zinc-500 text-sm">%</span>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-zinc-400 text-xs">Макс. сделок в день</Label>
                  <Input type="number" value={maxTrades === undefined ? "" : maxTrades} onChange={e => { setMaxTrades(e.target.value ? parseInt(e.target.value) : undefined); setCurrentResult(null); }} placeholder="Без лимита" className="bg-black/40 border-zinc-800" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-zinc-400 text-xs text-emerald-500 font-bold">Макс. тейков в день</Label>
                  <Input type="number" value={maxWins === undefined ? "" : maxWins} onChange={e => { setMaxWins(e.target.value ? parseInt(e.target.value) : undefined); setCurrentResult(null); }} placeholder="Без лимита" className="bg-emerald-950/20 border-emerald-900/50 text-emerald-400" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-zinc-400 text-xs">Заметки к симуляции</Label>
                  <textarea 
                    value={simNotes} 
                    onChange={e => setSimNotes(e.target.value)} 
                    placeholder="Например: Тест агрессивного разгона..." 
                    className="flex min-h-[80px] w-full rounded-md border border-zinc-800 bg-black/40 px-3 py-2 text-sm text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-red-500/50 custom-scrollbar resize-y" 
                  />
                </div>
                <div className="pt-5 border-t border-white/10 mt-6">
                  <p className="text-xs text-zinc-400 mb-1">Ожидаемых сделок в месяц:</p>
                  <p className="text-xl font-bold text-white">{calcTotalTradesPerMonth().toFixed(1)}</p>
                </div>
              </div>

              <div className="md:col-span-3 space-y-6">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-emerald-400" />
                    <h4 className="font-bold text-base text-zinc-300">Активы в портфеле</h4>
                  </div>
                  <Button size="sm" variant="outline" className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 rounded-xl px-4 py-2" onClick={handleAddAsset}>
                    <Plus className="w-4 h-4 mr-2" /> Добавить актив
                  </Button>
                </div>
                
                <div className="space-y-5 max-h-[500px] overflow-y-auto custom-scrollbar pr-3">
                  {assets.map((asset, index) => (
                    <div key={asset.id} className="bg-black/20 p-4 rounded-xl border border-white/5 relative group">
                      {assets.length > 1 && (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="absolute right-2 top-2 w-6 h-6 text-zinc-500 hover:text-red-400 hover:bg-red-400/10"
                          onClick={() => handleRemoveAsset(asset.id)}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      )}
                      
                      <div className="grid grid-cols-2 md:grid-cols-8 gap-2">
                        <div className="col-span-2 md:col-span-2 space-y-1">
                          <Label className="text-[10px] text-zinc-500 uppercase">Название</Label>
                          <Input value={asset.name} onChange={e => updateAsset(asset.id, 'name', e.target.value)} className="h-8 text-sm bg-black/40 border-zinc-800 px-2" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] text-zinc-500 uppercase">Win Rate (%)</Label>
                          <Input type="number" step="0.01" value={asset.winRate} onChange={e => updateAsset(asset.id, 'winRate', parseFloat(e.target.value))} className="h-8 text-sm bg-black/40 border-zinc-800 px-1 text-center" />
                        </div>
                        <div className="space-y-1 relative group/profit">
                          <Label className="text-[10px] text-emerald-500 font-bold uppercase truncate">Profit (%)</Label>
                          <Input type="number" step="0.1" value={asset.targetProfit || 0} onChange={e => updateAsset(asset.id, 'targetProfit', parseFloat(e.target.value))} className="h-8 text-sm bg-emerald-950/20 border-emerald-900/50 text-emerald-400 px-1 text-center font-bold shadow-[0_0_10px_rgba(52,211,153,0.1)]" />
                          <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-black/90 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover/profit:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity">
                            Впишите профит, чтобы рассчитать Win Rate
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] text-zinc-500 uppercase">RR (1:X)</Label>
                          <Input type="number" step="0.1" value={asset.rr} onChange={e => updateAsset(asset.id, 'rr', parseFloat(e.target.value))} className="h-8 text-sm bg-black/40 border-zinc-800 px-1 text-center" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] text-zinc-500 uppercase">Риск (%)</Label>
                          <Input type="number" step="0.1" value={asset.riskPercent} onChange={e => updateAsset(asset.id, 'riskPercent', parseFloat(e.target.value))} className="h-8 text-sm bg-black/40 border-zinc-800 px-1 text-center" />
                        </div>
                        <div className="col-span-2 md:col-span-2 space-y-1">
                          <Label className="text-[10px] text-zinc-500 uppercase flex whitespace-nowrap overflow-hidden">Сделок / Период</Label>
                          <div className="flex items-center gap-1">
                            <Input type="number" value={asset.trades} onChange={e => updateAsset(asset.id, 'trades', parseFloat(e.target.value))} className="h-8 text-sm bg-black/40 border-zinc-800 px-1 text-center flex-1" />
                            <span className="text-zinc-600 text-sm">/</span>
                            <Input type="number" value={asset.backtestDays} onChange={e => updateAsset(asset.id, 'backtestDays', parseFloat(e.target.value))} className="h-8 text-sm bg-black/40 border-zinc-800 px-1 text-center flex-1" />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4 pt-6 border-t border-white/5">
              <Button onClick={handleRun} size="lg" className="w-full sm:flex-1 bg-red-600 hover:bg-red-700 text-white font-black tracking-widest text-lg shadow-[0_0_20px_rgba(220,38,38,0.3)]">
                {t.simulator.runSim}
              </Button>
              {currentResult && (
                <Button onClick={handleSave} size="lg" variant="outline" className="w-full sm:flex-1 border-emerald-500/50 hover:bg-emerald-500/10 text-emerald-400 font-bold">
                  <Save className="w-5 h-5 mr-2" /> {t.simulator.saveSim}
                </Button>
              )}
            </div>
          </Card>
          
          {currentResult && renderDashboard(currentResult, startBalance, assets)}
        </TabsContent>
        
        <TabsContent value="compare" className="mt-4">
          <Card className="p-6 bg-background/50 backdrop-blur border-white/5 min-h-[400px]">
            {(!state.simulations || state.simulations.length === 0) ? (
              <div className="text-center text-muted-foreground py-12">{t.simulator.noArchive}</div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                
                <div className="lg:col-span-1 lg:border-r border-b lg:border-b-0 border-white/10 pr-0 lg:pr-4 pb-6 lg:pb-0 space-y-3 max-h-[800px] overflow-y-auto custom-scrollbar">
                  <h4 className="font-bold mb-4 text-zinc-300">Сохраненные сессии</h4>
                  {state.simulations.map(sim => (
                    <div 
                      key={sim.id} 
                      onClick={() => setViewingSimId(sim.id)}
                      className={`p-3 rounded-xl cursor-pointer border transition-all ${viewingSimId === sim.id ? 'bg-black/60 border-red-500/50 shadow-[inset_0_0_15px_rgba(239,68,68,0.1)]' : 'bg-black/20 border-white/5 hover:bg-black/40 hover:border-white/20'}`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <h5 className="font-bold text-sm truncate pr-2 text-white" title={sim.name}>{sim.name}</h5>
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-4 border-transparent ${sim.mode === 'PROP' ? 'bg-blue-600/30 text-blue-300' : 'bg-zinc-700/50 text-zinc-300'}`}>{sim.mode}</Badge>
                      </div>
                      <div className="flex justify-between text-xs items-center mb-1 text-zinc-400">
                        <span>Активов: {sim.assets?.length || 0}</span>
                        <span>{new Date(sim.createdAt).toLocaleDateString()}</span>
                      </div>
                      <div className="flex justify-between text-xs items-center">
                        <span className="text-yellow-400 font-bold bg-yellow-400/10 px-1.5 py-0.5 rounded">EV: {formatPct(sim.results.mathExpectation, sim.startingBalance)}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="lg:col-span-3">
                  {viewingSim ? (
                    <div className="animate-in fade-in duration-300 h-full">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-black/40 p-4 sm:p-5 rounded-2xl border border-white/5 mb-4 shadow-xl gap-4">
                        <div>
                          <h2 className="text-2xl font-black text-white mb-1 flex items-center gap-2">
                            <Eye className="w-5 h-5 text-red-500" />
                            {viewingSim.name}
                          </h2>
                          <div className="text-sm text-zinc-500 font-medium">Создано: {new Date(viewingSim.createdAt).toLocaleString()}</div>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-3 items-end sm:items-center">
                          
                          <Button 
                            variant="outline" 
                            size="icon" 
                            onClick={handleShareImage}
                            disabled={isCapturing}
                            title={t.simulator.shareImage || "Поделиться статистикой"}
                            className="bg-blue-500/10 border-blue-500/30 hover:bg-blue-500/20 text-blue-400 rounded-xl"
                          >
                            <Share2 className="w-4 h-4" />
                          </Button>
                          
                          <Button 
                            variant="outline" 
                            size="icon" 
                            onClick={() => handleDownloadJson(viewingSim)}
                            title={t.simulator.downloadJson || "Скачать ИИ-датасет (JSON)"}
                            className="bg-emerald-500/10 border-emerald-500/30 hover:bg-emerald-500/20 text-emerald-400 rounded-xl"
                          >
                            <Download className="w-4 h-4" />
                          </Button>

                          <Select value={comp2Id} onValueChange={setComp2Id}>
                            <SelectTrigger className="bg-black/60 w-full sm:w-[200px] border-white/10 rounded-xl">
                              <SelectValue placeholder="Сравнить с..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Не сравнивать</SelectItem>
                              {state.simulations.filter(s => s.id !== viewingSim.id).map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          
                          <Button variant="destructive" size="icon" className="rounded-xl bg-red-600/20 text-red-500 hover:bg-red-600 hover:text-white border-transparent" onClick={() => { 
                            actions.deleteSimulation(viewingSim.id); 
                            if(viewingSimId === viewingSim.id) setViewingSimId(""); 
                            toast({title: t.simulator.simDeleted}); 
                          }}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-8">
                        <div className="bg-white/5 p-5 rounded-2xl border border-white/5 text-center">
                          <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Активов</p>
                          <p className="font-black text-white text-xl">{viewingSim.assets?.length || 0}</p>
                        </div>
                        <div className="bg-white/5 p-4 rounded-xl border border-white/5 text-center">
                          <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Старт. баланс</p>
                          <p className="font-bold text-white text-lg">{viewingSim.startingBalance}$</p>
                        </div>
                        <div className="bg-white/5 p-4 rounded-xl border border-white/5 text-center">
                          <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Тип риска</p>
                          <p className="font-bold text-red-400 text-lg">{viewingSim.riskType}</p>
                        </div>
                        <div className="bg-white/5 p-5 rounded-2xl border border-white/5 text-center">
                          <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Комиссия</p>
                          <p className="font-black text-white text-xl">{viewingSim.commission}%</p>
                        </div>
                      </div>

                      {viewingSim.notes && (
                        <div className="mt-6 bg-black/20 border border-white/10 p-5 rounded-2xl">
                          <h4 className="text-zinc-500 text-xs font-bold uppercase tracking-wider mb-2">Заметки</h4>
                          <p className="text-zinc-300 whitespace-pre-wrap text-sm leading-relaxed">{viewingSim.notes}</p>
                        </div>
                      )}

                      {renderDashboard(viewingSim.results, viewingSim.startingBalance, viewingSim.assets)}

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
                    <div className="h-full flex flex-col items-center justify-center text-zinc-500 py-32 border border-dashed border-white/10 rounded-2xl bg-black/10">
                       <TrendingUp className="w-16 h-16 mb-4 opacity-50 text-red-500" />
                       <p className="text-lg font-bold text-white">Выберите сессию из списка слева</p>
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
