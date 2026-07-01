import os
import re

with open('client/src/components/MonteCarloSimulator.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Fix PROP Badge Alignment (remove gap-3 and add items-center properly)
content = content.replace(
    '''<div className="flex items-center gap-3">
                    <Badge className={`text-sm px-3 py-1 font-bold tracking-widest uppercase ${viewingSim.mode === 'PROP' ? 'bg-blue-500 text-white hover:bg-blue-500' : 'bg-zinc-700 text-white hover:bg-zinc-700'}`}>
                      {viewingSim.mode}
                    </Badge>
                    <span className="text-zinc-500 text-sm font-medium">Монте-Карло Симуляция</span>
                  </div>''',
    '''<div className="flex items-center gap-3">
                    <Badge className={`text-sm px-3 py-1 font-bold tracking-widest uppercase leading-none h-auto flex items-center justify-center ${viewingSim.mode === 'PROP' ? 'bg-blue-500 text-white hover:bg-blue-500' : 'bg-zinc-700 text-white hover:bg-zinc-700'}`}>
                      {viewingSim.mode}
                    </Badge>
                    <span className="text-zinc-500 text-sm font-medium leading-none">Монте-Карло Симуляция</span>
                  </div>'''
)


# 2. Fix Text Vertical Centering in Probabilities
# Replace Phase 1 & 2
content = content.replace(
    '''<div className="flex-1 text-center bg-black/20 p-5 rounded-2xl border border-white/5">
                        <p className="text-zinc-400 text-xs uppercase tracking-widest mb-2 font-medium">Фаза 1 (+8%)</p>
                        <p className="text-4xl font-black text-blue-400">{viewingSim.results.probPhase1?.toFixed(1)}%</p>
                      </div>
                      <div className="text-blue-500/30 text-3xl font-light">→</div>
                      <div className="flex-1 text-center bg-black/20 p-5 rounded-2xl border border-white/5">
                        <p className="text-zinc-400 text-xs uppercase tracking-widest mb-2 font-medium">Фаза 2 (+5%)</p>
                        <p className="text-4xl font-black text-purple-400">{viewingSim.results.probPhase2?.toFixed(1)}%</p>
                      </div>''',
    '''<div className="flex-1 text-center bg-black/20 p-5 rounded-2xl border border-white/5 flex flex-col justify-center items-center">
                        <p className="text-zinc-400 text-xs uppercase tracking-widest mb-2 font-medium">Фаза 1 (+8%)</p>
                        <p className="text-4xl font-black text-blue-400 leading-none">{viewingSim.results.probPhase1?.toFixed(1)}%</p>
                      </div>
                      <div className="text-blue-500/30 text-3xl font-light">→</div>
                      <div className="flex-1 text-center bg-black/20 p-5 rounded-2xl border border-white/5 flex flex-col justify-center items-center">
                        <p className="text-zinc-400 text-xs uppercase tracking-widest mb-2 font-medium">Фаза 2 (+5%)</p>
                        <p className="text-4xl font-black text-purple-400 leading-none">{viewingSim.results.probPhase2?.toFixed(1)}%</p>
                      </div>'''
)

# Replace Funded
content = content.replace(
    '''<div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-6 text-center mx-8">
                      <p className="text-emerald-500/80 text-sm font-black uppercase tracking-[0.2em] mb-2">Шанс получить Funded</p>
                      <p className="text-[64px] leading-none font-black text-emerald-400 drop-shadow-[0_0_15px_rgba(52,211,153,0.3)]">{viewingSim.results.probLive?.toFixed(1)}%</p>
                    </div>''',
    '''<div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-6 text-center mx-8 flex flex-col justify-center items-center">
                      <p className="text-emerald-500/80 text-sm font-black uppercase tracking-[0.2em] mb-2">Шанс получить Funded</p>
                      <p className="text-[64px] leading-none font-black text-emerald-400 drop-shadow-[0_0_15px_rgba(52,211,153,0.3)]">{viewingSim.results.probLive?.toFixed(1)}%</p>
                    </div>'''
)

# 3. Fix Chart (Flatness and Rendering in html2canvas)
# Recharts ResponsiveContainer often fails in html2canvas because it renders offscreen with 0 width.
# Also, domain={['auto', 'auto']} makes it flat if the range is small relative to absolute values, 'dataMin'/'dataMax' is better.
content = content.replace(
    '''<div className="flex-grow w-full opacity-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={viewingSim.results.chartData}>
                          <YAxis domain={['auto', 'auto']} hide />
                          <Line type="monotone" dataKey="median" stroke="#eab308" strokeWidth={4} dot={false} isAnimationActive={false} />
                          <Line type="monotone" dataKey="worst" stroke="#ef4444" strokeWidth={1.5} strokeDasharray="4 4" dot={false} isAnimationActive={false} />
                          <Line type="monotone" dataKey="best" stroke="#22c55e" strokeWidth={1.5} strokeDasharray="4 4" dot={false} isAnimationActive={false} />
                        </LineChart>
                      </ResponsiveContainer>
                   </div>''',
    '''<div className="flex-grow w-full opacity-80 flex items-end overflow-hidden">
                      <LineChart width={540} height={130} data={viewingSim.results.chartData}>
                          <YAxis domain={['dataMin - 100', 'dataMax + 100']} hide />
                          <Line type="monotone" dataKey="median" stroke="#eab308" strokeWidth={4} dot={false} isAnimationActive={false} />
                          <Line type="monotone" dataKey="worst" stroke="#ef4444" strokeWidth={1.5} strokeDasharray="4 4" dot={false} isAnimationActive={false} />
                          <Line type="monotone" dataKey="best" stroke="#22c55e" strokeWidth={1.5} strokeDasharray="4 4" dot={false} isAnimationActive={false} />
                        </LineChart>
                   </div>'''
)


with open('client/src/components/MonteCarloSimulator.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
