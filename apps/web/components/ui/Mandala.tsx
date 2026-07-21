/**
 * Decorative mandala — CSS-only (no framer-motion) for zero JS cost on LCP.
 */
export function Mandala() {
  return (
    <div
      className="relative w-full h-full flex items-center justify-center overflow-hidden pointer-events-none select-none"
      aria-hidden
    >
      <div className="relative w-[min(800px,120vw)] h-[min(800px,120vw)] opacity-[0.15] motion-safe:animate-mandala-rotate">
        <svg
          viewBox="0 0 200 200"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full stroke-gold"
        >
          <circle cx="100" cy="100" r="90" strokeWidth="0.5" />
          <circle cx="100" cy="100" r="70" strokeWidth="0.3" />
          <circle cx="100" cy="100" r="50" strokeWidth="0.2" />

          <path d="M100 10V190" strokeWidth="0.2" />
          <path d="M10 100H190" strokeWidth="0.2" />
          <path d="M36.4 36.4L163.6 163.6" strokeWidth="0.2" />
          <path d="M36.4 163.6L163.6 36.4" strokeWidth="0.2" />

          <path d="M100 30L160.6 65V135L100 170L39.4 135V65L100 30Z" strokeWidth="0.4" />

          <circle
            className="motion-safe:animate-twinkle origin-[100px_10px]"
            cx="100"
            cy="10"
            r="3"
            fill="#FFD700"
          />
          <circle
            className="motion-safe:animate-twinkle origin-[190px_100px] [animation-delay:1s]"
            cx="190"
            cy="100"
            r="3"
            fill="#8B5CF6"
          />
          <circle
            className="motion-safe:animate-twinkle origin-[100px_190px] [animation-delay:2s]"
            cx="100"
            cy="190"
            r="3"
            fill="#FFFFFF"
          />
          <circle
            className="motion-safe:animate-twinkle origin-[10px_100px] [animation-delay:3s]"
            cx="10"
            cy="100"
            r="3"
            fill="#F0E6FF"
          />

          {Array.from({ length: 12 }, (_, i) => (
            <ellipse
              key={i}
              cx="100"
              cy="100"
              rx="60"
              ry="15"
              transform={`rotate(${i * 30} 100 100)`}
              strokeWidth="0.2"
            />
          ))}
        </svg>
      </div>
    </div>
  );
}
