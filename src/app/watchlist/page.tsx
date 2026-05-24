'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Star, ArrowUpRight, ArrowDownRight, Trash2, TrendingUp } from 'lucide-react';
import { getWatchlistMeta, saveWatchlistMeta, useWatchlist, type WatchlistFundMeta } from '@/lib/useWatchlist';
import { getLocalWatchlistSnapshot } from '@/lib/localFundData';

interface FundInfo {
  code: string; name: string; type: string; sectors: string[];
  nav: number; dailyChange: number; weekChange: number; monthChange: number; yearChange: number;
}

function metaToFundInfo(meta: WatchlistFundMeta): FundInfo {
  return {
    code: meta.code,
    name: meta.name,
    type: meta.type,
    sectors: meta.sectors ?? [],
    nav: meta.nav,
    dailyChange: meta.dailyChange,
    weekChange: meta.weekChange ?? 0,
    monthChange: meta.monthChange ?? 0,
    yearChange: meta.yearChange ?? 0,
  };
}

function snapshotForCode(code: string): FundInfo {
  const meta = getWatchlistMeta(code);
  return meta ? metaToFundInfo(meta) : getLocalWatchlistSnapshot(code);
}

export default function WatchlistPage() {
  const { codes, removeFund } = useWatchlist();
  const localFunds = useMemo<FundInfo[]>(() => codes.map(snapshotForCode), [codes]);
  const [funds, setFunds] = useState<FundInfo[]>(localFunds);

  useEffect(() => {
    setFunds(localFunds);
  }, [localFunds]);

  useEffect(() => {
    if (!codes.length) return;

    let cancelled = false;

    fetch('/api/funds?page=1&size=10000&sort=yearChange&order=desc')
      .then(r => r.json())
      .then(data => {
        if (cancelled) return;
        if (data.error) return;

        const byCode = new Map<string, WatchlistFundMeta>(
          (data.funds ?? []).map((fund: WatchlistFundMeta) => [fund.code, fund])
        );

        const resolved: FundInfo[] = [];
        const missing: string[] = [];

        codes.forEach(code => {
          const remote = byCode.get(code);
          if (remote) {
            const remoteRaw = remote as unknown as Record<string, unknown>;
          const remoteSectors = remoteRaw.sectors;
          const meta: WatchlistFundMeta = {
            ...remote,
            sectors: Array.isArray(remoteSectors) ? remoteSectors : [],
            navDate: (remoteRaw.date as string) ?? remote.navDate,
          };
          saveWatchlistMeta(meta);
            resolved.push(metaToFundInfo(meta));
          } else {
            missing.push(code);
            resolved.push(snapshotForCode(code));
          }
        });

        setFunds(resolved);

        // For funds missing from the bulk API, fetch individually
        missing.forEach(code => {
          fetch(`/api/fund/${code}/analyze`)
            .then(r => r.json())
            .then(detail => {
              if (cancelled || detail.error) return;
              const meta: WatchlistFundMeta = {
                code,
                name: detail.name ?? code,
                type: detail.type ?? '未知',
                sectors: Array.isArray(detail.sectors) ? detail.sectors : [],
                nav: detail.nav ?? 0,
                dailyChange: detail.dailyChange ?? 0,
                navDate: detail.navDate ?? '',
                weekChange: detail.weekChange ?? 0,
                monthChange: detail.monthChange ?? 0,
                yearChange: detail.yearChange ?? 0,
              };
              saveWatchlistMeta(meta);
              setFunds(prev => prev.map(f => f.code === code ? metaToFundInfo(meta) : f));
            })
            .catch(() => {});
        });
      })
      .catch(() => {});

    return () => { cancelled = true; };
  }, [codes]);

  if (codes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] page-enter">
        <Star size={48} className="text-gray-200 mb-4" />
        <h2 className="text-[18px] font-semibold text-gray-700 mb-2">暂无自选基金</h2>
        <p className="text-[13px] text-gray-400 mb-6">在基金筛选页面点击星标添加自选</p>
        <Link href="/funds" className="px-5 py-2 bg-blue-500 text-white text-[13px] rounded-xl hover:bg-blue-600 transition-colors">
          去添加
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5 page-enter">
      <div>
        <h1 className="text-[28px] font-semibold tracking-tight">自选基金</h1>
        <p className="text-[13px] text-gray-400 mt-1">共 {codes.length} 只基金，点击进入分析</p>
      </div>

      <div className="bg-gray-50 rounded-2xl border border-black/[0.04] overflow-hidden">
        <div className="grid grid-cols-12 gap-4 px-5 py-2.5 border-b border-black/[0.04] text-[11px] text-gray-400 uppercase tracking-wider">
          <span className="col-span-4">基金</span>
          <span className="col-span-1 text-center">类型</span>
          <span className="col-span-1 text-right">净值</span>
          <span className="col-span-1 text-right">日涨跌</span>
          <span className="col-span-1 text-right">近1周</span>
          <span className="col-span-1 text-right">近1月</span>
          <span className="col-span-1 text-right">近1年</span>
          <span className="col-span-2 text-right">操作</span>
        </div>

        <div className="divide-y divide-black/[0.04]">
          {funds.map((fund, i) => (
            <div key={fund.code}
              className="grid grid-cols-12 gap-4 px-5 py-3 hover:bg-black/[0.02] transition-colors duration-150 items-center">
              <Link href={`/watchlist/${fund.code}`} className="col-span-10 grid grid-cols-10 gap-4 items-center">
                <div className="col-span-4 flex items-center gap-3">
                  <span className="w-5 text-center text-[11px] text-gray-300 font-medium flex-shrink-0">{i + 1}</span>
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium truncate">{fund.name}</p>
                    <div className="flex items-center gap-1 flex-wrap">
                      <span className="text-[11px] text-gray-400">{fund.code}</span>
                      {fund.sectors && fund.sectors.length > 0 && fund.sectors.slice(0, 3).map((sector, si) => {
                        const colors = ['bg-blue-50 text-blue-500', 'bg-amber-50 text-amber-500', 'bg-purple-50 text-purple-500', 'bg-green-50 text-green-500', 'bg-red-50 text-red-500'];
                        return <span key={sector} className={`text-[9px] px-1 py-0.5 rounded font-medium ${colors[si % colors.length]}`}>{sector}</span>;
                      })}
                    </div>
                  </div>
                </div>
                <span className="col-span-1 text-center">
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-black/[0.04] text-gray-500">{fund.type}</span>
                </span>
                <span className="col-span-1 text-right text-[13px] font-mono tabular-nums">{fund.nav.toFixed(4)}</span>
                <span className={`col-span-1 text-right text-[13px] font-semibold tabular-nums flex items-center justify-end gap-0.5 ${fund.dailyChange >= 0 ? 'text-red-500' : 'text-green-500'}`}>
                  {fund.dailyChange >= 0 ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
                  {Math.abs(fund.dailyChange).toFixed(2)}%
                </span>
                <span className={`col-span-1 text-right text-[12px] tabular-nums ${fund.weekChange >= 0 ? 'text-red-500' : 'text-green-500'}`}>
                  {fund.weekChange >= 0 ? '+' : ''}{fund.weekChange.toFixed(2)}%
                </span>
                <span className={`col-span-1 text-right text-[12px] tabular-nums ${fund.monthChange >= 0 ? 'text-red-500' : 'text-green-500'}`}>
                  {fund.monthChange >= 0 ? '+' : ''}{fund.monthChange.toFixed(2)}%
                </span>
                <span className={`col-span-1 text-right text-[12px] font-semibold tabular-nums ${fund.yearChange >= 0 ? 'text-red-500' : 'text-green-500'}`}>
                  {fund.yearChange >= 0 ? '+' : ''}{fund.yearChange.toFixed(2)}%
                </span>
              </Link>
              <span className="col-span-2 text-right flex items-center justify-end gap-2">
                <Link href={`/watchlist/${fund.code}`}
                  className="text-[11px] px-3 py-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors">
                  <TrendingUp size={12} className="inline mr-1" />分析
                </Link>
                <button onClick={() => removeFund(fund.code)}
                  className="p-1.5 rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors"
                  title="取消自选">
                  <Trash2 size={13} />
                </button>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
