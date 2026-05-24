'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { ArrowLeft, ArrowUpRight, ArrowDownRight, Star } from 'lucide-react';
import { useWatchlist } from '@/lib/useWatchlist';

const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false });

interface NavPoint { date: string; nav: number; accNav: number; }
interface StockHolding { name: string; weight: number; industry: string; }
interface FundInfo { [key: string]: string; }

export default function FundDetailPage() {
  const params = useParams();
  const code = params.code as string;
  const { toggleFund, isWatched } = useWatchlist();

  const [navHistory, setNavHistory] = useState<NavPoint[]>([]);
  const [info, setInfo] = useState<FundInfo>({});
  const [stocks, setStocks] = useState<StockHolding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`/api/fund/${code}/detail`).then(r => r.json()),
      fetch(`/api/fund/${code}/holding`).then(r => r.json()).catch(() => ({ topStocks: [] })),
    ]).then(([detail, holding]) => {
      if (detail.error) { setError(detail.error); return; }
      setNavHistory(detail.navHistory || []);
      setInfo(detail.info || {});
      setStocks(holding.topStocks || []);
      setLoading(false);
    }).catch(e => { setError(String(e)); setLoading(false); });
  }, [code]);

  if (loading) {
    return (
      <div className="space-y-6 page-enter">
        <div className="h-8 w-32 bg-gray-100 rounded-lg animate-pulse" />
        <div className="h-32 bg-gray-50 rounded-2xl animate-pulse" />
        <div className="h-96 bg-gray-50 rounded-2xl animate-pulse" />
      </div>
    );
  }

  if (error || navHistory.length === 0) {
    return (
      <div className="text-center py-20">
        <p className="text-[15px] text-gray-500 mb-4">{error || '基金数据加载失败'}</p>
        <Link href="/funds" className="text-[13px] text-blue-500 hover:text-blue-400">返回基金列表</Link>
      </div>
    );
  }

  const latestNav = navHistory[navHistory.length - 1];
  const prevNav = navHistory.length > 1 ? navHistory[navHistory.length - 2] : latestNav;
  const dailyChange = prevNav.nav > 0 ? ((latestNav.nav - prevNav.nav) / prevNav.nav * 100) : 0;

  // Calculate performance from nav history
  const calcReturn = (days: number) => {
    const idx = Math.max(0, navHistory.length - days - 1);
    const oldNav = navHistory[idx]?.nav ?? latestNav.nav;
    return oldNav > 0 ? ((latestNav.nav - oldNav) / oldNav * 100) : 0;
  };
  const perfItems = [
    { label: '近1周', days: 7 }, { label: '近1月', days: 30 },
    { label: '近3月', days: 90 }, { label: '近6月', days: 180 },
    { label: '近1年', days: 365 },
  ];

  const navOption = {
    tooltip: { trigger: 'axis' as const },
    grid: { left: '8%', right: '3%', top: '6%', bottom: '12%' } as Record<string, unknown>,
    xAxis: { type: 'category' as const, data: navHistory.map(d => d.date), axisLabel: { show: false } },
    yAxis: { scale: true, splitLine: { lineStyle: { type: 'dashed' as const, opacity: 0.08 } } },
    dataZoom: [{ type: 'inside' as const, start: 50, end: 100 }],
    series: [{
      name: '净值', type: 'line' as const, data: navHistory.map(d => d.nav), smooth: true, symbol: 'none',
      lineStyle: { width: 1.5, color: '#3b82f6' },
      areaStyle: { color: { type: 'linear' as const, x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(59,130,246,0.15)' }, { offset: 1, color: 'rgba(59,130,246,0)' }] } },
    }],
  };

  const holdingOption = stocks.length > 0 ? {
    tooltip: { trigger: 'axis' as const, axisPointer: { type: 'shadow' as const } },
    grid: { left: '20%', right: '5%', top: '5%', bottom: '5%' } as Record<string, unknown>,
    xAxis: { type: 'value' as const, splitLine: { lineStyle: { type: 'dashed' as const, opacity: 0.08 } } },
    yAxis: { type: 'category' as const, data: stocks.map(s => s.name).reverse() },
    series: [{
      type: 'bar' as const,
      data: stocks.map(s => s.weight).reverse(),
      itemStyle: {
        color: (p: { dataIndex: number }) => ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#a855f7', '#06b6d4', '#f97316', '#ec4899', '#6366f1', '#14b8a6'][p.dataIndex % 10],
        borderRadius: [0, 4, 4, 0],
      },
      barWidth: '55%',
    }],
  } : null;

  return (
    <div className="space-y-6 page-enter">
      <Link href="/funds" className="inline-flex items-center gap-1.5 text-[12px] text-gray-400 hover:text-gray-900 transition-colors">
        <ArrowLeft size={14} /> 返回基金列表
      </Link>

      <div className="bg-gray-50 rounded-2xl p-6 border border-black/[0.04]">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => toggleFund(code)}
              className={`p-2 rounded-lg transition-colors ${isWatched(code) ? 'text-amber-400 bg-amber-50' : 'text-gray-300 hover:text-amber-400 hover:bg-amber-50'}`}
              title={isWatched(code) ? '取消自选' : '加入自选'}
            >
              <Star size={20} fill={isWatched(code) ? 'currentColor' : 'none'} />
            </button>
            <div>
              <h1 className="text-[22px] font-semibold tracking-tight">{info['基金简称'] || info['基金名称'] || code}</h1>
              <p className="text-[12px] text-gray-400 mt-1">{code} {info['基金类型'] ? `· ${info['基金类型']}` : ''} {info['基金经理'] ? `· ${info['基金经理']}` : ''}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[28px] font-semibold tabular-nums tracking-tight">{latestNav.nav.toFixed(4)}</p>
            <div className={`flex items-center justify-end gap-1 mt-0.5 ${dailyChange >= 0 ? 'text-red-500' : 'text-green-500'}`}>
              {dailyChange >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
              <span className="text-[15px] font-semibold tabular-nums">{Math.abs(dailyChange).toFixed(2)}%</span>
            </div>
          </div>
        </div>
      </div>

      {Object.keys(info).length > 0 && (
        <div className="bg-gray-50 rounded-2xl border border-black/[0.04] p-5">
          <h2 className="text-[15px] font-semibold mb-4">基金信息</h2>
          <div className="grid grid-cols-3 gap-3">
            {Object.entries(info).slice(0, 9).map(([key, val]) => (
              <div key={key} className="p-3 bg-white rounded-xl border border-black/[0.04]">
                <p className="text-[10px] text-gray-400 mb-1">{key}</p>
                <p className="text-[13px] font-medium truncate">{val}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-gray-50 rounded-2xl border border-black/[0.04] p-5">
        <h2 className="text-[15px] font-semibold mb-4">净值走势</h2>
        <ReactECharts option={navOption} style={{ height: 380 }} />
      </div>

      <div className="bg-gray-50 rounded-2xl border border-black/[0.04] p-5">
        <h2 className="text-[15px] font-semibold mb-1">历史业绩</h2>
        <p className="text-[11px] text-gray-400 mb-4">基于净值数据计算，仅供参考</p>
        <div className="grid grid-cols-5 gap-2">
          {perfItems.map(item => {
            const val = calcReturn(item.days);
            return (
              <div key={item.label} className="text-center p-3 bg-white rounded-xl border border-black/[0.04]">
                <p className="text-[10px] text-gray-400 mb-1">{item.label}</p>
                <p className={`text-[14px] font-semibold tabular-nums ${val >= 0 ? 'text-red-500' : 'text-green-500'}`}>
                  {val >= 0 ? '+' : ''}{val.toFixed(2)}%
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {holdingOption && (
        <div className="bg-gray-50 rounded-2xl border border-black/[0.04] p-5">
          <h2 className="text-[15px] font-semibold mb-4">重仓股</h2>
          <ReactECharts option={holdingOption} style={{ height: Math.max(280, stocks.length * 36) }} />
        </div>
      )}
    </div>
  );
}
