'use client';

import React from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Star } from 'lucide-react';
import { MANDALA_NAV, isNavActive } from '@/lib/sanctuaireNav';

function ProgressRing({ progress, size = 88 }: { progress: number; size?: number }) {
  const strokeWidth = 2;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progress / 100) * circumference;

  if (progress <= 0) return null;

  return (
    <svg width={size} height={size} className="absolute inset-0">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="rgba(255, 255, 255, 0.05)"
        strokeWidth={strokeWidth}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="url(#progressGradient)"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        className="transition-all duration-1000"
      />
      <defs>
        <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#E8A838" />
          <stop offset="100%" stopColor="#F4B942" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function MandalaNav() {
  const pathname = usePathname();
  const radius = 150;
  const containerSize = 400;
  const center = containerSize / 2;
  const navItems = MANDALA_NAV;

  return (
    <div className="w-full flex items-center justify-center overflow-hidden px-2">
      <div
        className="relative mx-auto flex-shrink-0 scale-[0.72] sm:scale-90 md:scale-100 origin-center"
        style={{ width: containerSize, height: containerSize, maxWidth: '100%' }}
      >
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-serenity-600/5 to-transparent blur-3xl" />
        <div className="absolute inset-8 rounded-full bg-gradient-to-br from-white/[0.02] to-transparent backdrop-blur-sm border border-white/[0.04]" />

        <svg
          className="absolute inset-0 w-full h-full"
          viewBox={`0 0 ${containerSize} ${containerSize}`}
          fill="none"
        >
          <circle
            cx={center}
            cy={center}
            r={180}
            stroke="url(#ringGradient)"
            strokeWidth="0.5"
            opacity="0.1"
            strokeDasharray="2 6"
          />
          <circle
            cx={center}
            cy={center}
            r={radius}
            stroke="url(#ringGradient)"
            strokeWidth="0.5"
            opacity="0.08"
          />
          <circle
            cx={center}
            cy={center}
            r={56}
            stroke="url(#ringGradient)"
            strokeWidth="1"
            opacity="0.15"
          />

          {navItems.map((item) => {
            const angleRad = ((item.angle ?? 0) - 90) * (Math.PI / 180);
            const x2 = center + radius * Math.cos(angleRad);
            const y2 = center + radius * Math.sin(angleRad);
            return (
              <line
                key={item.key}
                x1={center}
                y1={center}
                x2={x2}
                y2={y2}
                stroke="url(#ringGradient)"
                strokeWidth="0.5"
                opacity="0.05"
              />
            );
          })}

          <defs>
            <linearGradient id="ringGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#E8A838" />
              <stop offset="50%" stopColor="#F4B942" />
              <stop offset="100%" stopColor="#E8A838" />
            </linearGradient>
          </defs>
        </svg>

        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.2, type: 'spring', stiffness: 100 }}
          className="absolute z-20"
          style={{
            left: center,
            top: center,
            transform: 'translate(-50%, -50%)',
          }}
        >
          <Link href="/sanctuaire">
            <div className="relative group cursor-pointer">
              <div className="absolute -inset-6 rounded-full bg-gradient-to-br from-horizon-400/20 to-horizon-500/10 blur-2xl group-hover:blur-3xl transition-all duration-700 opacity-50 group-hover:opacity-80" />
              <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br from-horizon-300 via-horizon-400 to-horizon-500 flex items-center justify-center shadow-lg shadow-horizon-400/20 group-hover:shadow-horizon-400/40 transition-all duration-500 border border-horizon-200/30">
                <Star className="w-8 h-8 sm:w-10 sm:h-10 text-abyss-800 fill-abyss-800" />
              </div>
              <div className="absolute -bottom-9 left-1/2 -translate-x-1/2 text-center whitespace-nowrap">
                <span className="text-sm font-semibold text-horizon-300 tracking-wide">
                  Sanctuaire
                </span>
              </div>
            </div>
          </Link>
        </motion.div>

        {navItems.map((item, index) => {
          const Icon = item.icon;
          const angleRad = ((item.angle ?? 0) - 90) * (Math.PI / 180);
          const x = center + radius * Math.cos(angleRad);
          const y = center + radius * Math.sin(angleRad);
          const active = isNavActive(pathname, item.route);

          return (
            <motion.div
              key={item.key}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{
                duration: 0.5,
                delay: 0.4 + index * 0.1,
                type: 'spring',
                stiffness: 80,
              }}
              className="absolute z-10"
              style={{
                left: `${x}px`,
                top: `${y}px`,
                transform: 'translate(-50%, -50%)',
              }}
            >
              <Link href={item.route}>
                <div className="relative group cursor-pointer">
                  <ProgressRing progress={0} size={72} />
                  <div
                    className={`absolute inset-0 w-[72px] h-[72px] rounded-full transition-all duration-500 ${
                      active
                        ? 'bg-horizon-400/15 blur-xl'
                        : 'bg-transparent group-hover:bg-serenity-400/10 blur-lg'
                    }`}
                  />
                  <div
                    className={`relative w-[72px] h-[72px] rounded-full flex items-center justify-center transition-all duration-500 border ${
                      active
                        ? 'bg-gradient-to-br from-horizon-400/15 to-horizon-500/5 border-horizon-400/30'
                        : 'bg-abyss-500/30 border-white/[0.06] group-hover:bg-abyss-400/40 group-hover:border-serenity-400/20'
                    }`}
                  >
                    <Icon
                      className={`w-7 h-7 transition-all duration-500 ${
                        active
                          ? 'text-horizon-300'
                          : 'text-stellar-400 group-hover:text-stellar-200'
                      }`}
                    />
                  </div>
                  <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-center whitespace-nowrap">
                    <span
                      className={`text-xs font-medium transition-colors duration-300 ${
                        active
                          ? 'text-horizon-300'
                          : 'text-stellar-500 group-hover:text-stellar-300'
                      }`}
                    >
                      {item.label}
                    </span>
                    {item.sublabel && (
                      <span
                        className={`block text-[9px] transition-colors duration-300 ${
                          active ? 'text-horizon-400/60' : 'text-stellar-600'
                        }`}
                      >
                        {item.sublabel}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
