import { Button } from "@packages/ui";
import { CATALOG_CATEGORIES } from "@packages/shared";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-brand-light">
      <div className="z-10 max-w-5xl w-full items-center justify-center font-mono text-sm flex flex-col gap-8 text-center">
        <h1 className="text-6xl font-extrabold text-brand-dark tracking-tighter">
          LUMIRA <span className="text-brand">V2</span>
        </h1>
        <p className="text-xl text-gray-600 max-w-2xl">
          La nouvelle fondation de la cartographie vibratoire spirituelle.
          Architecture Monorepo Turborepo haute performance.
        </p>

        <div className="flex gap-4">
          <Button variant="primary" className="shadow-lg transform hover:scale-105 transition-all">
            Lancer l&apos;Application
          </Button>
          <Button variant="secondary" className="hover:bg-gray-200">
            Documentation Dev
          </Button>
        </div>

        <div className="mt-12 w-full max-w-3xl border border-gray-200 p-8 rounded-2xl bg-white shadow-xl">
          <h2 className="text-xl font-bold mb-6 text-brand-dark">Catalogue Vibratoire</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {CATALOG_CATEGORIES.map((cat) => (
              <div
                key={cat.id}
                className="bg-brand-light/30 border border-brand/10 p-4 rounded-xl flex flex-col items-center gap-2"
                data-testid={`level-${cat.id.toLowerCase()}`}
              >
                <span className="font-semibold text-brand-dark">{cat.name}</span>
                <span className="text-xs text-gray-500 uppercase tracking-widest">{cat.id}</span>
              </div>
            ))}
          </div>
        </div>

        <footer className="mt-16 text-gray-400 text-xs uppercase tracking-widest">
          Propulsé par Turborepo • Next.js 14 • NestJS 10
        </footer>
      </div>
    </main>
  );
}
