// Desk V2 - Modern Expert Dashboard
// Components exported from this module

// Core Layout
export { DeskLayout } from './layout/DeskLayout';
export { Sidebar } from './layout/Sidebar';
export { Header } from './layout/Header';
export { CommandPalette } from './layout/CommandPalette';

// Kanban Board
export { KanbanBoard } from './kanban/KanbanBoard';
export { KanbanColumn } from './kanban/KanbanColumn';
export { OrderCard } from './kanban/OrderCard';

// Studio Editor
export { StudioEditor } from './studio/StudioEditor';
export { TiptapEditor } from './studio/TiptapEditor';
export { AIAssistant } from './studio/AIAssistant';
export { ClientPanel } from './studio/ClientPanel';

// Dashboard
export { StatsGrid } from './dashboard/StatsGrid';
export { ActivityFeed } from './dashboard/ActivityFeed';
export { QuickActions } from './dashboard/QuickActions';

// Shared
export { Badge } from './shared/Badge';
export { StatusBadge } from './shared/StatusBadge';
export { LevelBadge } from './shared/LevelBadge';
export { Avatar } from './shared/Avatar';
export { Tooltip } from './shared/Tooltip';

// Hooks
export { useSocket } from './hooks/useSocket';
export { useOrders } from './hooks/useOrders';
export { useStats } from './hooks/useStats';

// Types
export * from './types';
