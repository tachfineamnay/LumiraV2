---
name: Expert Desk (Admin Dashboard)
description: Interface admin sur desk.oraclelumira.com — routing par sous-domaine, architecture, rôles, et gestion des commandes expert.
---

# Expert Desk (Admin Dashboard)

## Context

Le **Desk** est l'interface d'administration accessible uniquement aux **experts** et **admins** de Lumira. Il est servi via le sous-domaine `desk.oraclelumira.com` (ou `desk.localhost:3000` en dev).

---

## Architecture & Routing

### Détection du sous-domaine

```typescript
// apps/web/middleware.ts
export function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || '';

  if (hostname.startsWith('desk.')) {
    // Injecter le header brand pour la détection côté app
    const response = NextResponse.rewrite(
      new URL('/admin' + request.nextUrl.pathname, request.url)
    );
    response.headers.set('x-brand', 'desk');
    return response;
  }
}
```

### Structure des pages admin

```
apps/web/app/admin/
├── layout.tsx              # Layout desk avec sidebar
├── page.tsx                # Dashboard principal (KPIs)
├── orders/                 # Gestion des commandes
│   ├── page.tsx            # Liste des commandes
│   └── [id]/page.tsx       # Détail + validation commande
├── clients/                # Liste des clients
│   └── [id]/page.tsx       # Profil client complet
├── experts/                # Gestion des experts
└── settings/               # Configuration admin
```

---

## Authentification Expert

### Login

```typescript
// POST /api/auth/expert/login (ou /api/auth/login avec role check)
const response = await api.post('/auth/login', {
  email: credentials.email,
  password: credentials.password,
});

// Stocker dans le localStorage expert
localStorage.setItem('expert_token', response.data.accessToken);
```

### Context Expert

```typescript
'use client';
import { useExpertAuth } from '@/context/ExpertAuthContext';

function DeskComponent() {
  const {
    expert,          // { id, email, role: 'EXPERT' | 'ADMIN' }
    isAdmin,         // expert.role === 'ADMIN'
    isAuthenticated,
    logout,
  } = useExpertAuth();
}
```

---

## Gestion des Commandes (Workflow Expert)

### Cycle de vie d'une commande

```
PENDING → PAID → PROCESSING → AWAITING_VALIDATION → COMPLETED
                                       ↑
                              Expert review requis ici
```

### Endpoints utiles

```typescript
// Lister les commandes en attente de validation
GET /api/expert/orders/pending

// Commande complète avec contenu AI
GET /api/expert/orders/:id

// Valider une commande (déclenche la livraison au client)
POST /api/expert/orders/:id/validate
// body: { modifications?: Partial<GeneratedContent> }

// Régénérer le contenu AI pour une commande
POST /api/expert/orders/:id/regenerate

// Tester la génération audio pour une commande (ADMIN uniquement)
POST /api/expert/test-audio/:orderId
// Appelle directement AudioGenerationService.generateAllAudio(orderId)
```

### Processus de validation

```typescript
// Workflow côté expert
async function validateOrder(orderId: string, review: ExpertReview) {
  // 1. Consulter le contenu généré par l'AI
  const order = await api.get(`/expert/orders/${orderId}`);
  const content = order.data.generatedContent;

  // 2. Optionnel : modifier le contenu
  const modifications = {
    synthesis: { ...content.synthesis, key_blockage: 'Correction expert...' },
  };

  // 3. Valider
  await api.post(`/expert/orders/${orderId}/validate`, { modifications });
  // → Déclenche notification email au client
  // → Statut passe à COMPLETED
}
```

---

## Dashboard KPIs

### Endpoint stats

```typescript
GET /api/expert/stats

// Réponse
interface AdminStats {
  totalOrders: number;
  pendingOrders: number;
  completedOrders: number;
  totalRevenue: number;          // En centimes
  revenueThisMonth: number;
  totalClients: number;
  newClientsThisMonth: number;
  aiGenerationSuccess: number;   // % succès génération AI
}
```

---

## Interface UI — Admin Design System

Le Desk utilise le **même** design system Sublime Celestial mais avec des composants orientés data :

```typescript
// Composants spécifiques au Desk
apps/web/components/admin/
├── OrdersTable.tsx         // Tableau de commandes filtrable
├── ClientProfile.tsx       // Vue complète profil client
├── ReadingReviewer.tsx     // Interface de review AI content
├── StatsCards.tsx          // KPI cards glassmorphism
└── ExpertSidebar.tsx       // Navigation admin
```

### Pattern de tableau admin

```tsx
'use client';

export function OrdersTable() {
  const [orders, setOrders] = useState([]);
  const [filter, setFilter] = useState<OrderStatus>('AWAITING_VALIDATION');

  return (
    <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl">
      <FilterBar
        options={['ALL', 'AWAITING_VALIDATION', 'COMPLETED']}
        value={filter}
        onChange={setFilter}
      />
      <DataTable
        data={orders}
        columns={orderColumns}
        onRowClick={(order) => router.push(`/admin/orders/${order.id}`)}
      />
    </div>
  );
}
```

---

## Rôles et permissions

| Action | EXPERT | ADMIN |
|--------|--------|-------|
| Voir commandes en attente | ✅ | ✅ |
| Valider commandes | ✅ | ✅ |
| Modifier contenu AI | ✅ | ✅ |
| Voir tous les clients | ✅ | ✅ |
| Gérer les experts | ❌ | ✅ |
| Voir les stats globales | Partiel | ✅ |
| Configurer les produits | ❌ | ✅ |
| Accéder aux webhooks logs | ❌ | ✅ |

---

## Configuration des rôles backend

```typescript
// ExpertModule imports ServicesModule for DI
@Module({
  imports: [ConfigModule, ServicesModule, JwtModule, ThrottlerModule],
  controllers: [ExpertController],
  providers: [ExpertService],
})
export class ExpertModule {}

// ExpertService uses DI-injected services (not manual instantiation)
@Injectable()
export class ExpertService {
  constructor(
    private prisma: PrismaService,
    private digitalSoulService: DigitalSoulService,  // via ServicesModule
    private vertexOracle: VertexOracle,              // via ServicesModule
    // ...
  ) {}
}

// Protéger les routes expert
@Roles(Role.EXPERT, Role.ADMIN)
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('expert')
export class ExpertController {
  // ...
}

// Protéger les routes admin uniquement
@Roles(Role.ADMIN)
@UseGuards(JwtAuthGuard, RolesGuard)
@Delete('expert/:id')
async removeExpert(@Param('id') id: string) { ... }
```

---

## URLs importantes

| Environnement | URL |
|--------------|-----|
| Dev (subdomain) | `http://desk.localhost:3000` |
| Dev (direct) | `http://localhost:3000/admin` |
| Production | `https://desk.oraclelumira.com` |
| API (dev) | `http://localhost:3001/api/expert` |
| API (prod) | `https://api.oraclelumira.com/api/expert` |

---

## Best Practices

| ✅ DO | ❌ DON'T |
|-------|----------|
| Stocker le token sous `expert_token` | Partager le token client/expert |
| Vérifier `isAdmin` avant les actions destructives | Afficher les actions admin à tous les experts |
| Confirmer avant de valider une commande | Valider sans review du contenu AI |
| Paginer les listes de commandes | Charger toutes les commandes en une fois |
| Logger toutes les validations avec l'ID de l'expert | Valider anonymement |
