'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { Plus, Trash2, Wallet, TrendingUp, TrendingDown, PieChart, X, ArrowUpRight, ArrowDownRight, Pencil } from 'lucide-react';
import { useHoldings, computeHoldingsSummary, type HoldingEntry, type HoldingSummary } from '@/lib/useHoldings';
import { getWatchlistMeta } from '@/lib/useWatchlist';

const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false });

const TYPE_COLORS: Record<string, string> = {
  '股票型': '#ef4444', '混合型': '#f59e0b', '指数型': '#3b82f6',
  'ETF': '#22c55e', '债券型': '#8b5cf6', '货币型': '#06b6d4',
  'QDII': '#f97316',
};

function formatMoney(v: number) {
  if (Math.abs(v) >= 10000) return (v / 10000).toFixed(2) + '万';
  return v.toFixed(2);
}

export default function HoldingsPage() {
  const { entries, addHolding, updateHolding, removeHolding } = useHoldings();
  const summaries = useMemo(() => computeHoldingsSummary(entries), [entries]);

  const totalMarketValue = summaries.reduce((s, h) => s + h.marketValue, 0);
  const totalCostValue = summaries.reduce((s, h) => s + h.costValue, 0);
  const totalPnl = totalMarketValue - totalCostValue;
  const totalPnlPct = totalCostValue > 0 ? (totalPnl / totalCostValue) * 100 : 0;

  // Add form state
  const [showForm, setShowForm] = useState(false);
  const [formCode, setFormCode] = useState('');
  const [formMarketValue, setFormMarketValue] = useState('');
  const [formPnl, setFormPnl] = useState('');
  const [formError, setFormError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'minimal' | 'full'>('minimal');

  // Auto-fill name from meta
  const formMeta = formCode ? getWatchlistMeta(formCode) : null;
  const formName = formMeta?.name ?? '';

  const resetForm = () => {
    setFormCode('');
    setFormMarketValue('');
    setFormPnl('');
    setFormError('');
    setEditingId(null);
  };

  const startEdit = (entry: HoldingEntry) => {
    setFormCode(entry.code);
    setFormMarketValue(String(entry.marketValue));
    setFormPnl(String(entry.pnl));
    setEditingId(entry.id);
    setFormError('');
    setShowForm(true);
  };

  const handleSave = () => {
    setFormError('');
    if (!formCode.trim()) { setFormError('请输入基金代码'); return; }
    const marketValue = parseFloat(formMarketValue);
    if (!marketValue || marketValue <= 0) { setFormError('请输入有效持有金额'); return; }
    const pnl = parseFloat(formPnl);
    if (isNaN(pnl)) { setFormError('请输入有效持有收益'); return; }

    const data = {
      code: formCode.trim(),
      name: formName || formCode.trim(),
      marketValue,
      pnl,
    };

    if (editingId) {
      updateHolding(editingId, data);
    } else {
      addHolding(data);
    }

    resetForm();
    setShowForm(false);
  };

  // Type distribution for pie chart
  const typeDistribution = useMemo(() => {
    const map = new Map<string, number>();
    summaries.forEach(h => {
      const type = h.type || '未知';
      map.set(type, (map.get(type) ?? 0) + h.marketValue);
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value: +value.toFixed(2) }));
  }, [summaries]);

  // Sector distribution
  const sectorDistribution = useMemo(() => {
    const map = new Map<string, number>();
    summaries.forEach(h => {
      if (h.sectors.length === 0) {
        map.set('未分类', (map.get('未分类') ?? 0) + h.marketValue);
      } else {
        h.sectors.forEach(s => {
          map.set(s, (map.get(s) ?? 0) + h.marketValue / h.sectors.length);
        });
      }
    });
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value: +value.toFixed(2) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [summaries]);

  const typePieOption = useMemo(() => ({
    tooltip: { trigger: 'item' as const, formatter: '{b}: {c} ({d}%)' },
    legend: { bottom: 0, textStyle: { fontSize: 11 } },
    series: [{
      type: 'pie',
      radius: ['45%', '72%'],
      center: ['50%', '48%'],
      itemStyle: { borderRadius: 4, borderColor: '#fff', borderWidth: 2 },
      label: { fontSize: 11 },
      data: typeDistribution.map(d => ({
        ...d,
        itemStyle: { color: TYPE_COLORS[d.name] || '#94a3b8' },
      })),
    }],
  }), [typeDistribution]);

  const sectorPieOption = useMemo(() => ({
    tooltip: { trigger: 'item' as const, formatter: '{b}: {c} ({d}%)' },
    legend: { bottom: 0, textStyle: { fontSize: 11 } },
    series: [{
      type: 'pie',
      radius: ['45%', '72%'],
      center: ['50%', '48%'],
      itemStyle: { borderRadius: 4, borderColor: '#fff', borderWidth: 2 },
      label: { fontSize: 11 },
      data: sectorDistribution.map((_, i) => {
        const palette = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#a855f7', '#06b6d4', '#f97316', '#ec4899'];
        return { itemStyle: { color: palette[i % palette.length] } };
      }),
    }],
  }), [sectorDistribution]);

  useEffect(() => {
    if (entries.length === 0 && !showForm) return;
  }, [entries.length, showForm]);

  if (entries.length === 0 && !showForm) {
    return (
      <div className="space-y-5 page-enter">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[28px] font-semibold tracking-tight">持仓管理</h1>
            <p className="text-[13px] text-gray-400 mt-1">记录基金持仓，跟踪收益与配置</p>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center min-h-[50vh]">
          <Wallet size={48} className="text-gray-200 mb-4" />
          <h2 className="text-[18px] font-semibold text-gray-700 mb-2">暂无持仓记录</h2>
          <p className="text-[13px] text-gray-400 mb-6">手动录入你的基金持仓，开始跟踪分析</p>
          <button
            onClick={() => { resetForm(); setShowForm(true); }}
            className="px-5 py-2 bg-blue-500 text-white text-[13px] rounded-xl hover:bg-blue-600 transition-colors flex items-center gap-1.5"
          >
            <Plus size={14} />添加持仓
          </button>
        </div>

        {/* Add form modal */}
        {showForm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30" onClick={() => setShowForm(false)}>
            <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-[16px] font-semibold">添加持仓</h3>
                <button onClick={() => setShowForm(false)} className="p-1 rounded-lg hover:bg-gray-100"><X size={16} /></button>
              </div>
              <div className="space-y-3.5">
                <div>
                  <label className="block text-[12px] text-gray-500 mb-1">基金代码</label>
                  <input value={formCode} onChange={e => setFormCode(e.target.value)} placeholder="如 000001"
                    className="w-full px-3 py-2 text-[13px] rounded-lg border border-gray-200 focus:outline-none focus:border-blue-400" />
                  {formName && <p className="text-[12px] text-blue-500 mt-0.5">{formName}</p>}
                </div>
                <div>
                  <label className="block text-[12px] text-gray-500 mb-1">持有金额</label>
                  <input value={formMarketValue} onChange={e => setFormMarketValue(e.target.value)} placeholder="如 10000"
                    className="w-full px-3 py-2 text-[13px] rounded-lg border border-gray-200 focus:outline-none focus:border-blue-400" />
                </div>
                <div>
                  <label className="block text-[12px] text-gray-500 mb-1">持有收益 <span className="text-gray-300">（可负）</span></label>
                  <input value={formPnl} onChange={e => setFormPnl(e.target.value)} placeholder="如 500 或 -200"
                    className="w-full px-3 py-2 text-[13px] rounded-lg border border-gray-200 focus:outline-none focus:border-blue-400" />
                </div>
                {formError && <p className="text-[12px] text-red-500">{formError}</p>}
                <button onClick={handleSave}
                  className="w-full py-2.5 bg-blue-500 text-white text-[13px] font-medium rounded-xl hover:bg-blue-600 transition-colors">
                  确认添加
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 page-enter">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight">持仓管理</h1>
          <p className="text-[13px] text-gray-400 mt-1">共 {entries.length} 只基金，跟踪收益与配置</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            <button onClick={() => setViewMode('minimal')}
              className={`px-3 py-1.5 text-[12px] rounded-md transition-colors ${viewMode === 'minimal' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>
              极简
            </button>
            <button onClick={() => setViewMode('full')}
              className={`px-3 py-1.5 text-[12px] rounded-md transition-colors ${viewMode === 'full' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>
              完全
            </button>
          </div>
          <button onClick={() => { resetForm(); setShowForm(true); }}
            className="px-4 py-2 bg-blue-500 text-white text-[13px] rounded-xl hover:bg-blue-600 transition-colors flex items-center gap-1.5">
            <Plus size={14} />添加持仓
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-black/[0.04] p-4">
          <p className="text-[11px] text-gray-400">持仓市值</p>
          <p className="text-[22px] font-semibold mt-1 tabular-nums">{formatMoney(totalMarketValue)}</p>
        </div>
        <div className="bg-white rounded-xl border border-black/[0.04] p-4">
          <p className="text-[11px] text-gray-400">投入成本</p>
          <p className="text-[22px] font-semibold mt-1 tabular-nums text-gray-600">{formatMoney(totalCostValue)}</p>
        </div>
        <div className="bg-white rounded-xl border border-black/[0.04] p-4">
          <p className="text-[11px] text-gray-400">持仓盈亏</p>
          <p className={`text-[22px] font-semibold mt-1 tabular-nums flex items-center gap-1 ${totalPnl >= 0 ? 'text-red-500' : 'text-green-500'}`}>
            {totalPnl >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
            {totalPnl >= 0 ? '+' : ''}{formatMoney(totalPnl)}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-black/[0.04] p-4">
          <p className="text-[11px] text-gray-400">收益率</p>
          <p className={`text-[22px] font-semibold mt-1 tabular-nums ${totalPnlPct >= 0 ? 'text-red-500' : 'text-green-500'}`}>
            {totalPnlPct >= 0 ? '+' : ''}{totalPnlPct.toFixed(2)}%
          </p>
        </div>
      </div>

      {/* Holdings table */}
      {viewMode === 'minimal' ? (
        <div className="bg-gray-50 rounded-2xl border border-black/[0.04] overflow-hidden">
          <div className="grid grid-cols-10 gap-4 px-5 py-2.5 border-b border-black/[0.04] text-[11px] text-gray-400 uppercase tracking-wider">
            <span className="col-span-4">基金</span>
            <span className="col-span-3 text-center">今日收益</span>
            <span className="col-span-2 text-center">持有收益</span>
            <span className="col-span-1 text-right">操作</span>
          </div>
          <div className="divide-y divide-black/[0.04]">
            {summaries.map(h => (
              <div key={h.id} className="grid grid-cols-10 gap-4 px-5 py-3 hover:bg-black/[0.02] transition-colors items-center">
                <Link href={`/watchlist/${h.code}`} className="col-span-4 flex items-center gap-3 min-w-0">
                  <div className="min-w-0">
                    <p className="text-[14px] font-medium truncate">{h.name}</p>
                    <p className="text-[11px] text-gray-400">{h.code}</p>
                  </div>
                </Link>
                <div className="col-span-3 text-center">
                  {h.hasMarketData ? (
                    <>
                      <p className={`text-[20px] font-bold tabular-nums leading-tight ${h.todayReturnPct >= 0 ? 'text-red-500' : 'text-green-500'}`}>
                        {h.todayReturnPct >= 0 ? '+' : ''}{h.todayReturnPct.toFixed(2)}%
                      </p>
                      <p className={`text-[11px] font-mono tabular-nums mt-0.5 ${h.todayReturn >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                        {h.todayReturn >= 0 ? '+' : ''}{formatMoney(h.todayReturn)}
                      </p>
                      {h.navDate && <p className="text-[10px] text-gray-400 mt-0.5">{h.navDate.slice(5)}</p>}
                    </>
                  ) : (
                    <p className="text-[18px] text-gray-300 font-semibold">--</p>
                  )}
                </div>
                <div className="col-span-2 text-center">
                  <p className={`text-[20px] font-bold tabular-nums leading-tight ${h.pnlPct >= 0 ? 'text-red-500' : 'text-green-500'}`}>
                    {h.pnlPct >= 0 ? '+' : ''}{h.pnlPct.toFixed(2)}%
                  </p>
                  <p className={`text-[11px] font-mono tabular-nums mt-0.5 ${h.pnl >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                    {h.pnl >= 0 ? '+' : ''}{formatMoney(h.pnl)}
                  </p>
                </div>
                <div className="col-span-1 text-right flex items-center justify-end gap-0.5">
                  <button onClick={() => startEdit(entries.find(e => e.id === h.id)!)}
                    className="p-1.5 rounded-lg text-gray-300 hover:text-blue-400 hover:bg-blue-50 transition-colors">
                    <Pencil size={13} />
                  </button>
                  <button onClick={() => removeHolding(h.id)}
                    className="p-1.5 rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-gray-50 rounded-2xl border border-black/[0.04] overflow-hidden">
          <div className="grid grid-cols-12 gap-2 px-5 py-2.5 border-b border-black/[0.04] text-[11px] text-gray-400 uppercase tracking-wider">
            <span className="col-span-3">基金</span>
            <span className="col-span-1 text-center">类型</span>
            <span className="col-span-1 text-right">净值</span>
            <span className="col-span-1 text-right">成本价</span>
            <span className="col-span-1 text-right">份额</span>
            <span className="col-span-1 text-right">市值</span>
            <span className="col-span-1 text-right">今日收益</span>
            <span className="col-span-2 text-right">持有收益</span>
            <span className="col-span-1 text-right">操作</span>
          </div>
          <div className="divide-y divide-black/[0.04]">
            {summaries.map(h => (
              <div key={h.id} className="grid grid-cols-12 gap-2 px-5 py-3 hover:bg-black/[0.02] transition-colors items-center">
                <Link href={`/watchlist/${h.code}`} className="col-span-3 flex items-center gap-3 min-w-0">
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium truncate">{h.name}</p>
                    <p className="text-[11px] text-gray-400">{h.code}</p>
                  </div>
                </Link>
                <span className="col-span-1 text-center">
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-black/[0.04] text-gray-500">{h.type}</span>
                </span>
                <span className="col-span-1 text-right text-[13px] font-mono tabular-nums text-gray-500">{h.currentNav > 0 ? h.currentNav.toFixed(4) : '-'}</span>
                <span className="col-span-1 text-right text-[13px] font-mono tabular-nums text-gray-500">{h.costNav > 0 ? h.costNav.toFixed(4) : '-'}</span>
                <span className="col-span-1 text-right text-[13px] font-mono tabular-nums text-gray-500">{h.shares > 0 ? h.shares.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}</span>
                <span className="col-span-1 text-right text-[13px] font-mono tabular-nums font-medium">{formatMoney(h.marketValue)}</span>
                <span className="col-span-1 text-right">
                  {h.hasMarketData ? (
                    <div className="flex flex-col items-end">
                      <span className={`text-[13px] font-semibold tabular-nums ${h.todayReturnPct >= 0 ? 'text-red-500' : 'text-green-500'}`}>
                        {h.todayReturnPct >= 0 ? '+' : ''}{h.todayReturnPct.toFixed(2)}%
                      </span>
                      <span className={`text-[10px] font-mono tabular-nums ${h.todayReturn >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                        {h.todayReturn >= 0 ? '+' : ''}{formatMoney(h.todayReturn)}
                      </span>
                      {h.navDate && <span className="text-[9px] text-gray-400 mt-0.5">{h.navDate.slice(5)}</span>}
                    </div>
                  ) : <span className="text-[13px] text-gray-300">--</span>}
                </span>
                <span className="col-span-2 text-right">
                  <div className="flex flex-col items-end">
                    <span className={`text-[13px] font-semibold tabular-nums ${h.pnl >= 0 ? 'text-red-500' : 'text-green-500'}`}>
                      {h.pnl >= 0 ? '+' : ''}{formatMoney(h.pnl)}
                    </span>
                    <span className={`text-[10px] tabular-nums ${h.pnlPct >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                      {h.pnlPct >= 0 ? '+' : ''}{h.pnlPct.toFixed(2)}%
                    </span>
                  </div>
                </span>
                <span className="col-span-1 text-right flex items-center justify-end gap-0.5">
                  <button onClick={() => startEdit(entries.find(e => e.id === h.id)!)}
                    className="p-1.5 rounded-lg text-gray-300 hover:text-blue-400 hover:bg-blue-50 transition-colors">
                    <Pencil size={13} />
                  </button>
                  <button onClick={() => removeHolding(h.id)}
                    className="p-1.5 rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors">
                    <Trash2 size={13} />
                  </button>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Analysis: 配置分析 + 持仓分析 */}
      <div className="grid grid-cols-2 gap-6">
        {/* 类型配置 */}
        <div className="bg-white rounded-2xl border border-black/[0.04] p-5">
          <h3 className="text-[15px] font-semibold mb-1">类型配置</h3>
          <p className="text-[11px] text-gray-400 mb-4">按基金类型分布</p>
          {typeDistribution.length > 0 ? (
            <ReactECharts option={typePieOption} style={{ height: 280 }} />
          ) : (
            <div className="h-[280px] flex items-center justify-center text-[13px] text-gray-400">暂无数据</div>
          )}
        </div>

        {/* 板块配置 */}
        <div className="bg-white rounded-2xl border border-black/[0.04] p-5">
          <h3 className="text-[15px] font-semibold mb-1">板块配置</h3>
          <p className="text-[11px] text-gray-400 mb-4">按行业/板块分布（Top 8）</p>
          {sectorDistribution.length > 0 ? (
            <ReactECharts option={sectorPieOption} style={{ height: 280 }} />
          ) : (
            <div className="h-[280px] flex items-center justify-center text-[13px] text-gray-400">暂无数据</div>
          )}
        </div>
      </div>

      {/* 集中度分析 */}
      <div className="bg-white rounded-2xl border border-black/[0.04] p-5">
        <h3 className="text-[15px] font-semibold mb-1">持仓集中度</h3>
        <p className="text-[11px] text-gray-400 mb-4">前三大持仓占比</p>
        <div className="space-y-3">
          {summaries.slice(0, 5).map((h, i) => (
            <div key={h.id} className="flex items-center gap-3">
              <span className="text-[12px] text-gray-400 w-5">{i + 1}</span>
              <span className="text-[13px] flex-1 truncate">{h.name}</span>
              <div className="w-48 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min(h.weight, 100)}%` }} />
              </div>
              <span className="text-[12px] text-gray-500 w-14 text-right tabular-nums">{h.weight.toFixed(1)}%</span>
            </div>
          ))}
          {summaries.length > 5 && (
            <p className="text-[12px] text-gray-400">...及其他 {summaries.length - 5} 只基金</p>
          )}
        </div>
      </div>

      {/* Add/Edit form modal */}
      {showForm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30" onClick={() => { resetForm(); setShowForm(false); }}>
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-[16px] font-semibold">{editingId ? '编辑持仓' : '添加持仓'}</h3>
              <button onClick={() => { resetForm(); setShowForm(false); }} className="p-1 rounded-lg hover:bg-gray-100"><X size={16} /></button>
            </div>
            <div className="space-y-3.5">
              <div>
                <label className="block text-[12px] text-gray-500 mb-1">基金代码</label>
                <input value={formCode} onChange={e => setFormCode(e.target.value)} placeholder="如 000001"
                  className="w-full px-3 py-2 text-[13px] rounded-lg border border-gray-200 focus:outline-none focus:border-blue-400" />
                {formName && <p className="text-[12px] text-blue-500 mt-0.5">{formName}</p>}
              </div>
              <div>
                <label className="block text-[12px] text-gray-500 mb-1">持有金额</label>
                <input value={formMarketValue} onChange={e => setFormMarketValue(e.target.value)} placeholder="如 10000"
                  className="w-full px-3 py-2 text-[13px] rounded-lg border border-gray-200 focus:outline-none focus:border-blue-400" />
              </div>
              <div>
                <label className="block text-[12px] text-gray-500 mb-1">持有收益 <span className="text-gray-300">（可负）</span></label>
                <input value={formPnl} onChange={e => setFormPnl(e.target.value)} placeholder="如 500 或 -200"
                  className="w-full px-3 py-2 text-[13px] rounded-lg border border-gray-200 focus:outline-none focus:border-blue-400" />
              </div>
              {formError && <p className="text-[12px] text-red-500">{formError}</p>}
              <button onClick={handleSave}
                className="w-full py-2.5 bg-blue-500 text-white text-[13px] font-medium rounded-xl hover:bg-blue-600 transition-colors">
                {editingId ? '保存修改' : '确认添加'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
