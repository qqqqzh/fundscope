'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, BookOpen, Search, Star, Wallet, TrendingUp } from 'lucide-react';

const NAV_ITEMS = [
  { href: '/', label: '仪表盘', icon: LayoutDashboard },
  { href: '/academy', label: 'K线学院', icon: BookOpen },
  { href: '/funds', label: '基金筛选', icon: Search },
  { href: '/watchlist', label: '自选', icon: Star },
  { href: '/holdings', label: '持仓', icon: Wallet },
  { href: '/backtest', label: '投资模拟', icon: TrendingUp },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 h-full w-56 bg-white/70 backdrop-blur-2xl border-r border-black/[0.06] flex flex-col z-50 max-md:hidden">
      <div className="px-6 pt-8 pb-6">
        <h1 className="text-[17px] font-semibold tracking-tight text-gray-900">
          FundScope
        </h1>
        <p className="text-[11px] text-gray-400 mt-0.5 tracking-wide">
          投资学习平台
        </p>
      </div>

      <nav className="flex-1 px-3 space-y-0.5">
        {NAV_ITEMS.map(item => {
          const Icon = item.icon;
          const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-150 ${
                active
                  ? 'bg-black/[0.05] text-gray-900'
                  : 'text-gray-500 hover:text-gray-900 hover:bg-black/[0.03]'
              }`}
            >
              <Icon size={16} strokeWidth={1.8} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
