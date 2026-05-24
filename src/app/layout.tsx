import type { Metadata } from 'next';
import './globals.css';
import Sidebar from '@/components/layout/Sidebar';
import LayoutWrapper from '@/components/layout/LayoutWrapper';

export const metadata: Metadata = {
  title: 'FundScope',
  description: '基金投资学习平台',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className="h-full antialiased" suppressHydrationWarning>
      <body className="bg-white text-gray-900 min-h-full">
        <Sidebar />
        <main className="ml-56 min-h-screen max-md:ml-0">
          <LayoutWrapper>
            {children}
          </LayoutWrapper>
        </main>
      </body>
    </html>
  );
}
