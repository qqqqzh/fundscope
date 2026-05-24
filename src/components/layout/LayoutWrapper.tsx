'use client';

import { usePathname } from 'next/navigation';

const FULL_WIDTH_LOCKED_PATHS = ['/academy', '/funds'];
const FULL_WIDTH_SCROLL_PATHS = ['/watchlist'];

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLockedFullWidth = FULL_WIDTH_LOCKED_PATHS.some(p => pathname.startsWith(p));
  const isScrollableFullWidth = FULL_WIDTH_SCROLL_PATHS.some(p => pathname.startsWith(p));

  if (isLockedFullWidth) {
    return <div className="w-full max-w-[1680px] mx-auto px-4 sm:px-6 lg:px-8 py-4 lg:py-6 min-h-screen md:h-screen md:overflow-hidden">{children}</div>;
  }

  if (isScrollableFullWidth) {
    return <div className="w-full max-w-[1680px] mx-auto px-4 sm:px-6 lg:px-8 py-4 lg:py-6 min-h-screen">{children}</div>;
  }

  return (
    <div className="max-w-6xl mx-auto px-10 py-10">
      {children}
    </div>
  );
}
