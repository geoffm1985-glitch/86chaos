import React from 'react';
import {
  BarChart3,
  Bell,
  BookOpen,
  Calendar,
  CalendarClock,
  ChefHat,
  ChevronRight,
  ClipboardCheck,
  HelpCircle,
  Home,
  MessageSquare,
  MoreHorizontal,
  Network,
  Package,
  Shield,
  Sparkles,
  Settings,
  Users,
  Wrench,
} from 'lucide-react';
import { CheersLogo } from './common';

const ICONS = {
  today: Home,
  ops: ChefHat,
  prep: ClipboardCheck,
  inventory: Package,
  recipes: BookOpen,
  schedule: CalendarClock,
  published: CalendarClock,
  team: Users,
  financials: BarChart3,
  messages: MessageSquare,
  events: Calendar,
  reminders: Bell,
  'ai-tools': Sparkles,
  'menu-intelligence': Network,
  'hr-training': BookOpen,
  maintenance: Wrench,
  sales: BarChart3,
  labor: BarChart3,
  'back-office': ClipboardCheck,
  audit: Shield,
  godmode: Settings,
  settings: Settings,
  help: HelpCircle,
};

const NavIcon = ({ id, size = 18 }) => {
  const Icon = ICONS[id] || ChevronRight;
  return <Icon size={size} aria-hidden="true" />;
};

export const Concept17Sidebar = ({
  items = [],
  activeTab = 'today',
  onNavigate,
  clientData,
  restaurantName = '',
  userName = '',
  userRole = '',
  onOpenWorkspaceSwitcher,
  workspaceSwitchEnabled = false,
  menuLabel = 'Navigation',
  currentRestaurantLabel = 'Current Restaurant',
}) => (
  <aside className="concept17-sidebar" data-testid="concept17-desktop-sidebar" aria-label={menuLabel}>
    <div className="concept17-sidebar-brand">
      <CheersLogo clientData={clientData} />
    </div>

    <nav className="concept17-sidebar-nav">
      {items.map(item => {
        const selected = activeTab === item.id || (item.id === 'published' && ['published', 'schedule'].includes(activeTab)) || (item.id === 'financials' && ['sales', 'labor', 'back-office'].includes(activeTab));
        return (
          <button
            key={item.id}
            type="button"
            className={`concept17-sidebar-item ${selected ? 'is-active' : ''}`}
            data-shell-route={item.id}
            aria-current={selected ? 'page' : undefined}
            onClick={() => onNavigate?.(item.id)}
          >
            <span className="concept17-sidebar-icon"><NavIcon id={item.id} /></span>
            <span className="concept17-sidebar-label">{item.label}</span>
            {item.alert && <span className="concept17-nav-alert" aria-label="New activity" />}
          </button>
        );
      })}
    </nav>

    <div className="concept17-sidebar-footer">
      <button
        type="button"
        className={`concept17-workspace-mini ${workspaceSwitchEnabled ? 'is-switchable' : ''}`}
        onClick={workspaceSwitchEnabled ? onOpenWorkspaceSwitcher : undefined}
        aria-label={workspaceSwitchEnabled ? `${currentRestaurantLabel}: ${restaurantName}.` : `${currentRestaurantLabel}: ${restaurantName}.`}
      >
        <span className="concept17-workspace-home"><Home size={15} aria-hidden="true" /></span>
        <span className="min-w-0">
          <strong>{restaurantName || currentRestaurantLabel}</strong>
          {workspaceSwitchEnabled && <small>{currentRestaurantLabel}</small>}
        </span>
        {workspaceSwitchEnabled && <ChevronRight size={14} aria-hidden="true" />}
      </button>
      <div className="concept17-user-mini">
        <span className="concept17-user-avatar" aria-hidden="true">
          {String(userName || '86').split(/\s+/).filter(Boolean).slice(0, 2).map(part => part.charAt(0)).join('').toUpperCase() || '86'}
        </span>
        <span className="min-w-0">
          <strong>{userName || '86 Chaos'}</strong>
          <small>{userRole || 'Restaurant team'}</small>
        </span>
      </div>
    </div>
  </aside>
);

export const Concept17MobileNav = ({
  items = [],
  activeTab = 'today',
  onNavigate,
  onMore,
  moreLabel = 'More',
}) => (
  <nav className="concept17-mobile-nav" data-testid="concept17-mobile-bottom-nav" aria-label="Primary navigation">
    <div className="concept17-mobile-nav-voice-slot" aria-hidden="true" />
    {items.slice(0, 4).map(item => {
      const selected = activeTab === item.id || (item.id === 'published' && ['published', 'schedule'].includes(activeTab)) || (item.id === 'financials' && ['sales', 'labor', 'back-office'].includes(activeTab));
      return (
        <button
          key={item.id}
          type="button"
          className={`concept17-mobile-nav-item ${selected ? 'is-active' : ''}`}
          data-shell-route={item.id}
          aria-current={selected ? 'page' : undefined}
          onClick={() => onNavigate?.(item.id)}
        >
          <span className="concept17-mobile-nav-icon"><NavIcon id={item.id} size={19} /></span>
          <span>{item.mobileLabel || item.label}</span>
          {item.alert && <i className="concept17-nav-alert" aria-label="New activity" />}
        </button>
      );
    })}
    <button type="button" className="concept17-mobile-nav-item" onClick={onMore} aria-label={moreLabel}>
      <span className="concept17-mobile-nav-icon"><MoreHorizontal size={20} aria-hidden="true" /></span>
      <span>{moreLabel}</span>
    </button>
  </nav>
);


const ROUTE_COPY = {
  published: ['People • Process • Profit', 'Time Clock & Schedule', 'Punches, published schedules, requests, availability, trades, and schedule-building in one command surface.'],
  schedule: ['People • Process • Profit', 'Time Clock & Schedule', 'Build, review, publish, and manage the restaurant schedule without leaving the command surface.'],
  today: ['Restaurant Command', 'Manager Brief', 'Your restaurant at a glance.'],
  ops: ['Kitchen Operations', 'Kitchen Command Center', 'Live operational signals, staffing, service flow, and kitchen priorities.'],
  prep: ['Kitchen Operations', 'Prep & Tasks', 'Prep lists, recurring tasks, line checks, labels, and daily execution.'],
  inventory: ['Food Cost & Supply', 'Inventory', 'Counts, ordering, vendors, invoices, waste, and purchasing intelligence.'],
  recipes: ['Food Cost & Standards', 'Recipes', 'Standardize recipes, yields, batches, costing, and kitchen execution.'],
  team: ['People', 'Staff Roster', 'People, roles, permissions, contacts, availability, and roster management.'],
  financials: ['Profit', 'Financials', 'Sales, labor, daily close, timesheets, and operating performance.'],
  sales: ['Profit', 'Financials', 'Sales ledger and daily operating performance.'],
  labor: ['People • Profit', 'Financials', 'Labor, punches, hours, tips, and payroll review.'],
  'back-office': ['Profit • Process', 'Back Office', 'Owner controls, approvals, deposits, documents, and administrative workflows.'],
  messages: ['People', 'Message Board', 'Restaurant communication, 86 alerts, and team updates.'],
  events: ['People • Process', 'Event Calendar', 'Restaurant events and scheduling context.'],
  reminders: ['Personal Workflow', 'My Reminders', 'Private and shared reminders with notification controls.'],
  'ai-tools': ['Process', 'Kitchen Tools', 'Assisted workflows that accelerate restaurant operations while preserving human authority.'],
  'menu-intelligence': ['Food Cost • Profit', 'Menu Intelligence', 'Menu relationships, costing signals, and operational menu insight.'],
  'hr-training': ['People', 'HR & Training', 'Onboarding, manuals, certifications, performance, and training records.'],
  maintenance: ['Process', 'Maintenance', 'Repair tracking, preventative maintenance, equipment history, and follow-up.'],
  settings: ['System', 'Settings', 'Profile, preferences, alerts, integrations, and workspace configuration.'],
  help: ['Support', 'Help Center', 'Plain-language help, guided troubleshooting, tours, and support.'],
  godmode: ['System', 'System Administrator', 'Platform security, permissions, backup, deployment, diagnostics, and administration.'],
  audit: ['System', 'System Audit', 'Auditable operational and administrative activity.'],
};

const ROUTE_COPY_ES = {
  published: ['Personas • Proceso • Ganancia', 'Reloj y Horario', 'Marcajes, horarios publicados, solicitudes, disponibilidad, intercambios y creación del horario en un solo centro de mando.'],
  schedule: ['Personas • Proceso • Ganancia', 'Reloj y Horario', 'Crea, revisa, publica y administra el horario del restaurante sin salir del centro de mando.'],
  today: ['Mando del Restaurante', 'Resumen del Gerente', 'Tu restaurante de un vistazo.'],
  ops: ['Operaciones de Cocina', 'Centro de Mando de Cocina', 'Señales operativas, personal, flujo de servicio y prioridades de cocina.'],
  prep: ['Operaciones de Cocina', 'Preparación y Tareas', 'Listas de preparación, tareas recurrentes, controles de línea, etiquetas y ejecución diaria.'],
  inventory: ['Costo de Alimentos y Suministro', 'Inventario', 'Conteos, pedidos, proveedores, facturas, desperdicio e inteligencia de compras.'],
  recipes: ['Costo y Estándares', 'Recetas', 'Estandariza recetas, rendimientos, lotes, costos y ejecución de cocina.'],
  team: ['Personas', 'Plantilla de Personal', 'Personas, roles, permisos, contactos, disponibilidad y gestión de plantilla.'],
  financials: ['Ganancia', 'Finanzas', 'Ventas, mano de obra, cierre diario, hojas de tiempo y rendimiento operativo.'],
  sales: ['Ganancia', 'Finanzas', 'Libro de ventas y rendimiento operativo diario.'],
  labor: ['Personas • Ganancia', 'Finanzas', 'Mano de obra, marcajes, horas, propinas y revisión de nómina.'],
  'back-office': ['Ganancia • Proceso', 'Oficina Administrativa', 'Controles del propietario, aprobaciones, depósitos, documentos y flujos administrativos.'],
  messages: ['Personas', 'Tablero de Mensajes', 'Comunicación del restaurante, alertas 86 y actualizaciones del equipo.'],
  events: ['Personas • Proceso', 'Calendario de Eventos', 'Eventos del restaurante y contexto de programación.'],
  reminders: ['Flujo Personal', 'Mis Recordatorios', 'Recordatorios privados y compartidos con controles de notificación.'],
  'ai-tools': ['Proceso', 'Herramientas de Cocina', 'Flujos asistidos que aceleran operaciones manteniendo la autoridad humana.'],
  'menu-intelligence': ['Costo • Ganancia', 'Inteligencia de Menú', 'Relaciones del menú, señales de costo e información operativa.'],
  'hr-training': ['Personas', 'RR. HH. y Capacitación', 'Incorporación, manuales, certificaciones, rendimiento y registros de capacitación.'],
  maintenance: ['Proceso', 'Mantenimiento', 'Reparaciones, mantenimiento preventivo, historial de equipo y seguimiento.'],
  settings: ['Sistema', 'Configuración', 'Perfil, preferencias, alertas, integraciones y configuración del espacio de trabajo.'],
  help: ['Soporte', 'Centro de Ayuda', 'Ayuda en lenguaje claro, solución guiada de problemas, recorridos y soporte.'],
  godmode: ['Sistema', 'Administrador del Sistema', 'Seguridad, permisos, respaldos, despliegue, diagnósticos y administración de plataforma.'],
  audit: ['Sistema', 'Auditoría del Sistema', 'Actividad operativa y administrativa auditable.'],
};

const SUBROUTE_LABELS = {
  'my-schedule': 'My Schedule',
  'full-schedule': 'Full Schedule',
  'month-view': 'Month View',
  'trade-board': 'Trade Board',
  'time-off': 'Request Off',
  availability: 'Availability',
  'schedule-builder': 'Schedule Builder',
};

export const Concept17RouteFrame = ({ route = 'today', subroute = '', restaurantName = '86 Chaos', language = 'en', children }) => {
  const copyCatalog = String(language || '').toLowerCase().startsWith('es') ? ROUTE_COPY_ES : ROUTE_COPY;
  const [eyebrow, title, description] = copyCatalog[route] || ['86 Chaos', String(route || 'Workspace').replace(/[-_]/g, ' '), String(language || '').toLowerCase().startsWith('es') ? 'Espacio de gestión del restaurante.' : 'Restaurant management workspace.'];
  const Icon = ICONS[route] || ICONS.today;
  const isToday = route === 'today';
  return (
    <section className={`concept17-route-frame concept17-route-frame-${route} ${isToday ? 'is-today' : ''}`} data-testid="concept17-route-frame" data-route-frame={route} lang={language || 'en'}>
      {!isToday && (
        <header className="concept17-route-heading" data-testid="concept17-route-heading">
          <div className="concept17-route-heading-icon"><Icon size={22} aria-hidden="true" /></div>
          <div className="concept17-route-heading-copy">
            <div className="concept17-route-eyebrow">{eyebrow}</div>
            <div className="concept17-route-title-row">
              <h1>{title}</h1>
              {subroute && <span className="concept17-route-subroute">{SUBROUTE_LABELS[subroute] || String(subroute).replace(/[-_]/g, ' ')}</span>}
            </div>
            <p>{description}</p>
          </div>
          <div className="concept17-route-restaurant" aria-label={`${String(language || '').toLowerCase().startsWith('es') ? 'Restaurante actual' : 'Current restaurant'} ${restaurantName}`}>
            <Home size={15} aria-hidden="true" />
            <span>{restaurantName}</span>
          </div>
        </header>
      )}
      <div className="concept17-route-body" data-testid="concept17-route-body">{children}</div>
    </section>
  );
};
