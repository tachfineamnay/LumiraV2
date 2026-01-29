'use client';

import { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { CommandPalette } from './CommandPalette';

interface DeskLayoutProps {
  children: ReactNode;
}

export function DeskLayout({ children }: DeskLayoutProps) {
  return (
    <div className="flex h-screen bg-slate-950 text-white overflow-hidden">
      {/* Command Palette (⌘K) */}
      <CommandPalette />
      
      {/* Sidebar */}
      <Sidebar />
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
