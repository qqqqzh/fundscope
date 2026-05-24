'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { ArrowUpRight, ArrowDownRight, ChevronLeft, ChevronRight, TrendingUp, Star, Search } from 'lucide-react';
import { useWatchlist } from '@/lib/useWatchlist';

interface ApiFund {
  code: string; name: string; type: string; sectors: string[];
  nav: number; accNav: number; dailyChange: number;
  weekChange: number; monthChange: number; month3Change: number;
  month6Change: number; yearChange: number; date: string;
}

interface ApiIndex {
  name: string; code: string; market: string;
}

interface ApiEtf {
  code: string; name: string; price: number; change: number;
}

type SortKey = 'dailyChange' | 'weekChange' | 'monthChange' | 'yearChange' | 'nav';

const TYPE_OPTIONS = ['全部', '股票型', '混合型', '债券型', '指数型', '货币型', 'ETF联接', 'QDII'];

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'yearChange', label: '近1年' },
  { key: 'monthChange', label: '近1月' },
  { key: 'weekChange', label: '近1周' },
  { key: 'dailyChange', label: '日涨跌' },
  { key: 'nav', label: '净值' },
];

const PAGE_SIZE = 20;

// 模块级搜索缓存，跨页面导航保持状态
let _searchCache: {
  query: string;
  funds: ApiFund[];
  indices: ApiIndex[];
  etfs: ApiEtf[];
} | null = null;

export default function FundsPage() {
  const { toggleFund, isWatched } = useWatchlist();
  const [allFunds, setAllFunds] = useState<ApiFund[]>([]);
  const [searchResults, setSearchResults] = useState<ApiFund[] | null>(_searchCache?.funds ?? null);
  const [searchIndices, setSearchIndices] = useState<ApiIndex[]>(_searchCache?.indices ?? []);
  const [searchEtfs, setSearchEtfs] = useState<ApiEtf[]>(_searchCache?.etfs ?? []);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [typeFilter, setTypeFilter] = useState('全部');
  const [search, setSearch] = useState(_searchCache?.query ?? '');
  const [sortKey, setSortKey] = useState<SortKey>('yearChange');
  const [sortAsc, setSortAsc] = useState(false);
  const [page, setPage] = useState(1);

  // Fetch all funds on mount
  useEffect(() => {
    fetch('/api/funds?page=1&size=10000&sort=yearChange&order=desc')
      .then(r => r.json())
      .then(data => { setAllFunds(data.funds || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  // Execute search
  const executeSearch = useCallback(() => {
    const q = search.trim();
    if (!q) {
      setSearchResults(null);
      setSearchIndices([]);
      setSearchEtfs([]);
      _searchCache = null;
      return;
    }
    // Hit cache
    if (_searchCache && _searchCache.query === q) {
      setSearchResults(_searchCache.funds);
      setSearchIndices(_searchCache.indices);
      setSearchEtfs(_searchCache.etfs);
      return;
    }
    setSearching(true);
    fetch(`/api/search?q=${encodeURIComponent(q)}`)
      .then(r => r.json())
      .then(data => {
        const funds = data.funds || [];
        const indices = data.indices || [];
        const etfs = data.etfs || [];
        _searchCache = { query: q, funds, indices, etfs };
        setSearchResults(funds);
        setSearchIndices(indices);
        setSearchEtfs(etfs);
        setSearching(false);
      })
      .catch(() => setSearching(false));
  }, [search]);

  // Clear search when input is emptied
  useEffect(() => {
    if (!search.trim()) {
      setSearchResults(null);
      setSearchIndices([]);
      setSearchEtfs([]);
      _searchCache = null;
    }
  }, [search]);

  // Use search results or all funds
  const baseFunds = searchResults !== null ? searchResults : allFunds;

  const filtered = useMemo(() => {
    let list = [...baseFunds];
    // Only apply type filter when not searching (search already returns filtered results)
    if (searchResults === null && typeFilter !== '全部') {
      list = list.filter(f => f.type === typeFilter);
    }
    list.sort((a, b) => {
      const av = a[sortKey] ?? 0, bv = b[sortKey] ?? 0;
      return sortAsc ? av - bv : bv - av;
    });
    return list;
  }, [baseFunds, typeFilter, sortKey, sortAsc, searchResults]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageData = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleSort = useCallback((key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
    setPage(1);
  }, [sortKey, sortAsc]);

  const handleFilter = useCallback((t: string) => {
    setTypeFilter(t);
    setPage(1);
  }, []);

  const isSearching = search.trim().length > 0;

  return (
    <div className="flex flex-col h-full gap-4 page-enter">
      {/* Filters */}
      <div className="bg-gray-50 rounded-2xl p-4 border border-black/[0.04] space-y-3">
        <div className="relative">
          <input
            type="text"
            placeholder="搜索基金名称、代码或指数..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            onKeyDown={e => { if (e.key === 'Enter') executeSearch(); }}
            className="w-full pl-4 pr-10 py-2.5 rounded-xl bg-white border border-black/[0.06] focus:border-blue-500 text-[13px] transition-colors"
          />
          <button
            onClick={executeSearch}
            disabled={searching}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-gray-300 hover:text-blue-500 hover:bg-blue-50 transition-colors disabled:opacity-50"
          >
            {searching ? (
              <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <Search size={16} />
            )}
          </button>
        </div>

        {!isSearching && (
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex flex-wrap gap-1.5">
              {TYPE_OPTIONS.map(t => (
                <button key={t} onClick={() => handleFilter(t)}
                  className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all duration-150 ${
                    typeFilter === t
                      ? 'bg-blue-500 text-white'
                      : 'bg-white text-gray-500 hover:bg-gray-100 border border-black/[0.04]'
                  }`}
                >{t}</button>
              ))}
            </div>

            <div className="h-4 w-px bg-black/[0.06]" />

            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-gray-400">排序</span>
              {SORT_OPTIONS.map(opt => (
                <button key={opt.key} onClick={() => handleSort(opt.key)}
                  className={`px-2.5 py-1 rounded-md text-[11px] transition-all duration-150 ${
                    sortKey === opt.key
                      ? 'bg-blue-50 text-blue-600 font-medium'
                      : 'text-gray-500 hover:bg-gray-100'
                  }`}
                >{opt.label} {sortKey === opt.key && (sortAsc ? '↑' : '↓')}</button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Index results */}
      {isSearching && searchIndices.length > 0 && (
        <div className="bg-gray-50 rounded-2xl border border-black/[0.04] p-4">
          <p className="text-[11px] text-gray-400 uppercase tracking-wider mb-3">指数</p>
          <div className="flex flex-wrap gap-2">
            {searchIndices.map(idx => (
              <div key={idx.code}
                className="flex items-center gap-2 px-4 py-2.5 bg-white rounded-xl border border-black/[0.04]">
                <TrendingUp size={14} className="text-blue-500" />
                <span className="text-[13px] font-medium">{idx.name}</span>
                <span className="text-[11px] text-gray-400">{idx.code}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                  idx.market === 'cn' ? 'bg-red-50 text-red-500' :
                  idx.market === 'hk' ? 'bg-yellow-50 text-yellow-600' :
                  'bg-blue-50 text-blue-500'
                }`}>
                  {idx.market === 'cn' ? 'A股' : idx.market === 'hk' ? '港股' : '美股'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ETF results */}
      {isSearching && searchEtfs.length > 0 && (
        <div className="bg-gray-50 rounded-2xl border border-black/[0.04] p-4">
          <p className="text-[11px] text-gray-400 uppercase tracking-wider mb-3">ETF</p>
          <div className="flex flex-wrap gap-2">
            {searchEtfs.map(etf => (
              <div key={etf.code}
                className="flex items-center gap-2 px-4 py-2.5 bg-white rounded-xl border border-black/[0.04]">
                <TrendingUp size={14} className="text-purple-500" />
                <span className="text-[13px] font-medium">{etf.name}</span>
                <span className="text-[11px] text-gray-400">{etf.code}</span>
                <span className={`text-[12px] font-medium tabular-nums ${etf.change >= 0 ? 'text-red-500' : 'text-green-500'}`}>
                  {etf.change >= 0 ? '+' : ''}{etf.change.toFixed(2)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
            <ChevronLeft size={14} />
          </button>
          <span className="text-[11px] text-gray-500 tabular-nums">{page} / {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
            <ChevronRight size={14} />
          </button>
        </div>
      )}

      {/* Table — scrollable area */}
      <div className="flex-1 min-h-0 overflow-y-auto rounded-2xl">
        {loading || searching ? (
          <div className="space-y-1.5">
            {Array.from({ length: 10 }, (_, i) => <div key={i} className="h-14 bg-gray-50 rounded-xl animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-gray-50 rounded-2xl border border-black/[0.04] p-12 text-center">
            <p className="text-[13px] text-gray-400">
              {isSearching ? '未找到匹配的基金' : '该类型暂无基金'}
            </p>
          </div>
        ) : (
          <div className="bg-gray-50 rounded-2xl border border-black/[0.04] overflow-hidden">
            <div className="grid grid-cols-12 gap-4 px-5 py-2.5 border-b border-black/[0.04] text-[11px] text-gray-400 uppercase tracking-wider sticky top-0 bg-gray-50 z-10">
              <span className="col-span-4">基金</span>
              <span className="col-span-1 text-center">类型</span>
              <span className="col-span-1 text-right">净值</span>
              <span className="col-span-1 text-right">日涨跌</span>
              <span className="col-span-1 text-right">近1周</span>
              <span className="col-span-1 text-right">近1月</span>
              <span className="col-span-1 text-right">近1年</span>
              <span className="col-span-2 text-right">累计净值</span>
            </div>

            <div className="divide-y divide-black/[0.04]">
              {pageData.map((fund, i) => (
                <Link key={fund.code} href={`/fund/${fund.code}`}
                  className="grid grid-cols-12 gap-4 px-5 py-3 hover:bg-black/[0.02] transition-colors duration-150 items-center"
                >
                  <div className="col-span-4 flex items-center gap-2">
                    <button
                      onClick={e => { e.preventDefault(); e.stopPropagation(); toggleFund(fund.code, fund); }}
                      className={`p-1 rounded-md transition-colors flex-shrink-0 ${isWatched(fund.code) ? 'text-amber-400' : 'text-gray-300 hover:text-amber-400'}`}
                      title={isWatched(fund.code) ? '取消自选' : '加入自选'}
                    >
                      <Star size={14} fill={isWatched(fund.code) ? 'currentColor' : 'none'} />
                    </button>
                    <span className="w-5 text-center text-[11px] text-gray-300 font-medium flex-shrink-0">
                      {(page - 1) * PAGE_SIZE + i + 1}
                    </span>
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
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-black/[0.04] text-gray-500">
                      {fund.type}
                    </span>
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
                  <span className="col-span-2 text-right text-[13px] text-gray-500 tabular-nums">{fund.accNav.toFixed(4)}</span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Bottom pagination — fixed */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 flex-shrink-0">
          <button onClick={() => setPage(1)} disabled={page <= 1}
            className="px-3 py-1.5 rounded-lg text-[12px] text-gray-500 hover:bg-gray-50 disabled:opacity-30 transition-all">
            首页
          </button>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-50 disabled:opacity-30 transition-all">
            <ChevronLeft size={14} />
          </button>
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            const p = Math.max(1, Math.min(page - 2, totalPages - 4)) + i;
            if (p > totalPages) return null;
            return (
              <button key={p} onClick={() => setPage(p)}
                className={`w-8 h-8 rounded-lg text-[12px] transition-all ${
                  p === page ? 'bg-blue-500 text-white' : 'text-gray-500 hover:bg-gray-50'
                }`}>
                {p}
              </button>
            );
          })}
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-50 disabled:opacity-30 transition-all">
            <ChevronRight size={14} />
          </button>
          <button onClick={() => setPage(totalPages)} disabled={page >= totalPages}
            className="px-3 py-1.5 rounded-lg text-[12px] text-gray-500 hover:bg-gray-50 disabled:opacity-30 transition-all">
            末页
          </button>
        </div>
      )}
    </div>
  );
}
