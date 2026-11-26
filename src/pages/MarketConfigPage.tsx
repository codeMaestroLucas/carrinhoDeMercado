import { useState } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  Cloud,
  CloudOff,
  Copy,
  Edit3,
  GripVertical,
  Maximize2,
  Minimize2,
  Plus,
  RefreshCw,
  RotateCcw,
  Store,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import {
  PRODUCT_CATEGORIES,
  PRODUCT_CATEGORY_MAP,
  type ProductCategoryId,
} from '../types/shopping';
import { useShoppingStore } from '../store/useShoppingStore';
import { CategoryDot, CategoryIcon } from '../components/common/CategoryIcon';
import { GooeyMarketSelector } from '../components/common/GooeyMarketSelector';
import { ThemeToggleButton } from '../components/layout/ThemeToggleButton';

function SortableCategoryRow({
  id,
  index,
  total,
  onMoveUp,
  onMoveDown,
}: {
  id: ProductCategoryId;
  index: number;
  total: number;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  const info = PRODUCT_CATEGORY_MAP[id];
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`flex cursor-grab select-none items-center gap-3 rounded-2xl border px-3.5 py-3 transition-[background-color,border-color,box-shadow] duration-150 ease-ui active:cursor-grabbing ${
        isDragging
          ? 'z-10 border-[var(--accent)] bg-[var(--bg-surface)] shadow-lg'
          : 'border-[var(--border-hairline)] bg-[var(--bg-app)] hover:border-[var(--border-subtle)]'
      }`}
    >
      <span aria-hidden="true" className="text-[var(--text-muted)]">
        <GripVertical size={16} strokeWidth={1.7} />
      </span>
      <span className="font-mono-tabular w-6 text-center text-xs font-semibold text-[var(--text-muted)]">
        {String(index + 1).padStart(2, '0')}
      </span>
      <CategoryDot category={id} />
      <CategoryIcon category={id} size={17} />
      <span className="flex-1 text-sm font-medium text-[var(--text-primary)]">
        {info.label}
      </span>
      <div
        className="flex items-center gap-1"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          disabled={index === 0}
          onClick={onMoveUp}
          aria-label="Mover para cima"
          className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors duration-150 ease-ui hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)] disabled:opacity-25"
        >
          <ArrowUp size={15} strokeWidth={1.8} />
        </button>
        <button
          type="button"
          disabled={index === total - 1}
          onClick={onMoveDown}
          aria-label="Mover para baixo"
          className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors duration-150 ease-ui hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)] disabled:opacity-25"
        >
          <ArrowDown size={15} strokeWidth={1.8} />
        </button>
      </div>
    </div>
  );
}

export function MarketConfigPage() {
  const markets = useShoppingStore((s) => s.markets);
  const selectedMarketId = useShoppingStore((s) => s.selectedMarketId);
  const categoryDictionary = useShoppingStore((s) => s.categoryDictionary);
  const sharedSpaceCode = useShoppingStore((s) => s.sharedSpaceCode);
  const isSyncingCloud = useShoppingStore((s) => s.isSyncingCloud);
  const hasPendingCloudPush = useShoppingStore((s) => s.hasPendingCloudPush);
  const lastSyncedAtIso = useShoppingStore((s) => s.lastSyncedAtIso);
  const cloudError = useShoppingStore((s) => s.cloudError);

  const selectMarket = useShoppingStore((s) => s.selectMarket);
  const addMarket = useShoppingStore((s) => s.addMarket);
  const renameMarket = useShoppingStore((s) => s.renameMarket);
  const deleteMarket = useShoppingStore((s) => s.deleteMarket);
  const moveMarketCategory = useShoppingStore((s) => s.moveMarketCategory);
  const addKeywordToCategory = useShoppingStore((s) => s.addKeywordToCategory);
  const removeKeywordFromCategory = useShoppingStore(
    (s) => s.removeKeywordFromCategory,
  );
  const resetCategoryDictionary = useShoppingStore(
    (s) => s.resetCategoryDictionary,
  );
  const createNewSharedSpace = useShoppingStore((s) => s.createNewSharedSpace);
  const joinExistingSharedSpace = useShoppingStore(
    (s) => s.joinExistingSharedSpace,
  );
  const disconnectSharedSpace = useShoppingStore(
    (s) => s.disconnectSharedSpace,
  );
  const refreshCloudSync = useShoppingStore((s) => s.refreshCloudSync);

  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [newMarketName, setNewMarketName] = useState('');
  const [showAddMarket, setShowAddMarket] = useState(false);
  const [editingMarketName, setEditingMarketName] = useState<string | null>(
    null,
  );
  const [expandedCategory, setExpandedCategory] =
    useState<ProductCategoryId | null>(null);
  const [showAllKeywords, setShowAllKeywords] = useState(false);
  const [newKeywordInput, setNewKeywordInput] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [marketDirection, setMarketDirection] = useState<'forward' | 'backward'>('forward');
  const [isFullscreen, setIsFullscreen] = useState(
    typeof document !== 'undefined' && Boolean(document.fullscreenElement),
  );

  const notify = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 3000);
  };

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch {
      notify('Tela cheia não suportada neste navegador');
    }
  };

  const selectedMarket =
    markets.find((m) => m.id === selectedMarketId) ?? markets[0];

  const handleSelectMarket = (nextId: string) => {
    if (nextId === selectedMarket.id) return;
    const curIdx = markets.findIndex((m) => m.id === selectedMarket.id);
    const nextIdx = markets.findIndex((m) => m.id === nextId);
    setMarketDirection(nextIdx >= curIdx ? 'forward' : 'backward');
    selectMarket(nextId);
    setEditingMarketName(null);
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 150, tolerance: 5 },
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = selectedMarket.categoryOrder.indexOf(
      active.id as ProductCategoryId,
    );
    const newIndex = selectedMarket.categoryOrder.indexOf(
      over.id as ProductCategoryId,
    );
    if (oldIndex !== -1 && newIndex !== -1) {
      moveMarketCategory(selectedMarket.id, oldIndex, newIndex);
    }
  };

  const handleCreateSpace = async () => {
    try {
      const code = await createNewSharedSpace();
      notify(`Espaço ${code} criado`);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Erro ao criar espaço');
    }
  };

  const handleJoinSpace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCodeInput.trim()) return;
    try {
      await joinExistingSharedSpace(joinCodeInput);
      setJoinCodeInput('');
      notify('Conectado ao espaço familiar');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Erro ao conectar');
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-app)] pb-28 pt-safe md:pb-16">
      {/* Page Header Band */}
      <section className="border-b border-[var(--border-hairline)] bg-[var(--bg-surface)]">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6 sm:py-5 lg:px-8">
          <h1 className="font-display text-2xl font-semibold tracking-tight text-[var(--text-primary)] sm:text-3xl">
            Mercados &amp; Ajustes
          </h1>
          <div className="md:hidden">
            <ThemeToggleButton />
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-4 pt-6 animate-enter sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
          {/* Left Column: Market Profiles & Aisle Order */}
          <div className="space-y-6 md:col-span-7">
            <section className="surface-card p-5 sm:p-6">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--bg-app)] text-[var(--text-secondary)]">
                    <Store size={19} strokeWidth={1.75} />
                  </div>
                  <div>
                    <h2 className="font-display text-lg font-semibold text-[var(--text-primary)]">
                      Ordem dos corredores por mercado
                    </h2>
                    <p className="text-xs text-[var(--text-muted)]">
                      Arraste ou use as setas para definir o trajeto dentro da loja
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddMarket((v) => !v)}
                  className="btn-secondary hidden h-9 shrink-0 px-3.5 text-xs md:inline-flex"
                >
                  <Plus size={14} strokeWidth={2} />
                  Novo
                </button>
              </div>

              {showAddMarket && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!newMarketName.trim()) return;
                    addMarket(newMarketName);
                    setNewMarketName('');
                    setShowAddMarket(false);
                    notify('Mercado adicionado');
                  }}
                  className="mb-4 flex gap-2"
                >
                  <input
                    type="text"
                    placeholder="Nome do mercado (ex: Carrefour)"
                    value={newMarketName}
                    onChange={(e) => setNewMarketName(e.target.value)}
                    className="h-10 flex-1 rounded-full border border-[var(--border-hairline)] bg-[var(--bg-app)] px-4 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:border-[var(--accent)] focus:bg-[var(--bg-surface)]"
                  />
                  <button
                    type="submit"
                    className="btn-primary h-10 px-5 text-xs"
                  >
                    Criar
                  </button>
                </form>
              )}

              <div className="mb-4">
                <GooeyMarketSelector
                  options={markets.map((m) => ({ id: m.id, label: m.name }))}
                  selectedId={selectedMarket.id}
                  onSelect={handleSelectMarket}
                  trailing={
                    <button
                      type="button"
                      onClick={() => setShowAddMarket((v) => !v)}
                      className="btn-secondary inline-flex h-10 shrink-0 px-4 text-xs md:hidden"
                    >
                      <Plus size={14} strokeWidth={2} />
                      Novo
                    </button>
                  }
                />
              </div>

              <div
                key={`market-panel-${selectedMarket.id}`}
                className={
                  marketDirection === 'forward'
                    ? 'animate-slide-forward'
                    : 'animate-slide-backward'
                }
              >
              <div className="mb-4 flex items-center justify-between rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-subtle)] px-4 py-2.5">
                {editingMarketName !== null ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      renameMarket(selectedMarket.id, editingMarketName);
                      setEditingMarketName(null);
                    }}
                    className="flex flex-1 gap-2"
                  >
                    <input
                      type="text"
                      value={editingMarketName}
                      onChange={(e) => setEditingMarketName(e.target.value)}
                      className="h-9 flex-1 rounded-full border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3.5 text-sm font-medium text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
                    />
                    <button
                      type="submit"
                      className="btn-primary h-9 px-4 text-xs"
                    >
                      Salvar
                    </button>
                  </form>
                ) : (
                  <>
                    <span className="text-sm font-semibold text-[var(--text-primary)]">
                      {selectedMarket.name}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setEditingMarketName(selectedMarket.name)}
                        className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--text-secondary)] transition-colors duration-150 ease-ui hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]"
                        title="Renomear mercado"
                        aria-label="Renomear mercado"
                      >
                        <Edit3 size={15} strokeWidth={1.8} />
                      </button>
                      {markets.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            deleteMarket(selectedMarket.id);
                            notify('Mercado removido');
                          }}
                          className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--negative)] transition-colors duration-150 ease-ui hover:bg-[var(--negative-soft)]"
                          title="Excluir mercado"
                          aria-label="Excluir mercado"
                        >
                          <Trash2 size={15} strokeWidth={1.8} />
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>

              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={selectedMarket.categoryOrder}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2">
                    {selectedMarket.categoryOrder.map((catId, index) => (
                      <SortableCategoryRow
                        key={catId}
                        id={catId}
                        index={index}
                        total={selectedMarket.categoryOrder.length}
                        onMoveUp={() =>
                          moveMarketCategory(selectedMarket.id, index, index - 1)
                        }
                        onMoveDown={() =>
                          moveMarketCategory(selectedMarket.id, index, index + 1)
                        }
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
              </div>
            </section>
          </div>

          {/* Right Column: Cloud Sync, Display & Category Dictionary */}
          <div className="space-y-6 md:col-span-5">
            {/* Cloud Sync */}
            <section className="surface-card p-5 sm:p-6">
              <div className="mb-4 flex items-start gap-3">
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                    sharedSpaceCode
                      ? 'bg-[var(--positive-soft)] text-[var(--positive)]'
                      : 'bg-[var(--bg-app)] text-[var(--text-secondary)]'
                  }`}
                >
                  {sharedSpaceCode ? (
                    <Cloud size={19} strokeWidth={1.8} />
                  ) : (
                    <CloudOff size={19} strokeWidth={1.75} />
                  )}
                </div>
                <div>
                  <h2 className="font-display text-lg font-semibold text-[var(--text-primary)]">
                    Sincronização em família
                  </h2>
                  <p className="text-xs text-[var(--text-muted)]">
                    {sharedSpaceCode
                      ? hasPendingCloudPush
                        ? 'Alterações locais pendentes de envio'
                        : isSyncingCloud
                          ? 'Sincronizando com a nuvem'
                          : lastSyncedAtIso
                            ? `Sincronizado às ${new Date(lastSyncedAtIso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
                            : 'Conectado em tempo real'
                      : 'Compartilhe listas e histórico entre celulares'}
                  </p>
                </div>
              </div>

              {cloudError && (
                <div className="animate-shake mb-4 rounded-2xl border border-[var(--negative)]/25 bg-[var(--negative-soft)] p-3 text-xs font-medium text-[var(--negative)]">
                  {cloudError}
                </div>
              )}

              {sharedSpaceCode ? (
                <div className="space-y-3">
                  {/* Luminous Apple Mint Family Code Pass (Chunked monospaced code) */}
                  <div className="flex items-center justify-between rounded-2xl border border-[var(--accent)]/20 bg-gradient-to-br from-[var(--accent-soft)] to-[var(--bg-surface)] px-4 py-4">
                    <div>
                      <span className="text-[11px] font-semibold text-[var(--accent-fg)]">
                        Código da família
                      </span>
                      <p className="font-mono-tabular mt-0.5 text-xl font-semibold tracking-[0.14em] text-[var(--text-primary)]">
                        {sharedSpaceCode}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        void navigator.clipboard?.writeText(sharedSpaceCode);
                        notify('Código copiado');
                      }}
                      className="btn-secondary h-9 px-3.5 text-xs font-semibold text-[var(--accent-fg)]"
                    >
                      <Copy size={14} strokeWidth={1.9} />
                      Copiar
                    </button>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        void refreshCloudSync();
                        notify('Sincronizado');
                      }}
                      className="btn-secondary h-10 flex-1 text-xs"
                    >
                      <RefreshCw size={15} strokeWidth={1.8} />
                      Atualizar agora
                    </button>
                    <button
                      type="button"
                      onClick={() => void disconnectSharedSpace()}
                      className="inline-flex h-10 items-center justify-center rounded-full border border-[var(--border-hairline)] bg-[var(--bg-app)] px-4 text-xs font-semibold text-[var(--negative)] transition-colors duration-150 ease-ui hover:bg-[var(--negative-soft)]"
                    >
                      Desconectar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <button
                    type="button"
                    disabled={isSyncingCloud}
                    onClick={() => void handleCreateSpace()}
                    className="btn-primary h-11 w-full text-sm disabled:opacity-50"
                  >
                    <Users size={16} strokeWidth={1.9} />
                    {isSyncingCloud ? 'Conectando' : 'Criar novo código familiar'}
                  </button>

                  <form onSubmit={handleJoinSpace} className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Código (ex: CASA-4829)"
                      value={joinCodeInput}
                      onChange={(e) =>
                        setJoinCodeInput(e.target.value.toUpperCase())
                      }
                      className="font-mono-tabular h-10 flex-1 rounded-full border border-[var(--border-hairline)] bg-[var(--bg-app)] px-4 text-xs font-semibold text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:border-[var(--accent)] focus:bg-[var(--bg-surface)]"
                    />
                    <button
                      type="submit"
                      disabled={isSyncingCloud || !joinCodeInput.trim()}
                      className="btn-tinted h-10 px-5 text-xs disabled:opacity-40"
                    >
                      Entrar
                    </button>
                  </form>
                </div>
              )}
            </section>

            {/* Fullscreen Mode */}
            <section className="surface-card p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--bg-app)] text-[var(--text-secondary)]">
                    <Maximize2 size={18} strokeWidth={1.75} />
                  </div>
                  <div>
                    <h2 className="font-display text-base font-semibold text-[var(--text-primary)]">
                      Modo tela cheia
                    </h2>
                    <p className="text-xs text-[var(--text-muted)]">
                      Oculta barras do navegador no mercado
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={toggleFullscreen}
                  className="btn-secondary h-9 shrink-0 px-3.5 text-xs"
                >
                  {isFullscreen ? (
                    <Minimize2 size={14} strokeWidth={1.8} />
                  ) : (
                    <Maximize2 size={14} strokeWidth={1.8} />
                  )}
                  <span>{isFullscreen ? 'Sair' : 'Ativar'}</span>
                </button>
              </div>
            </section>

            {/* Smart Category Dictionary */}
            <section className="surface-card p-5 sm:p-6">
              <div className="mb-4 flex items-start justify-between gap-2">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--bg-app)] text-[var(--text-secondary)]">
                    <BookOpen size={18} strokeWidth={1.75} />
                  </div>
                  <div>
                    <h2 className="font-display text-base font-semibold text-[var(--text-primary)]">
                      Dicionário de categorias
                    </h2>
                    <p className="text-xs text-[var(--text-muted)]">
                      Palavras usadas na classificação automática
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    resetCategoryDictionary();
                    notify('Dicionário restaurado ao padrão');
                  }}
                  className="btn-secondary h-8 shrink-0 px-3 text-xs"
                >
                  <RotateCcw size={13} strokeWidth={1.8} />
                  Resetar
                </button>
              </div>

              <div className="space-y-2">
                {PRODUCT_CATEGORIES.filter((c) => c.id !== 'diversos').map(
                  (cat) => {
                    const keywords = categoryDictionary[cat.id] ?? [];
                    const isOpen = expandedCategory === cat.id;

                    return (
                      <div
                        key={cat.id}
                        className="overflow-hidden rounded-2xl border border-[var(--border-hairline)]"
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setExpandedCategory(isOpen ? null : cat.id);
                            setShowAllKeywords(false);
                            setNewKeywordInput('');
                          }}
                          className="flex w-full items-center justify-between bg-[var(--bg-app)] px-3.5 py-3 text-left transition-colors duration-150 ease-ui hover:bg-[var(--bg-subtle)]"
                        >
                          <span className="flex items-center gap-2 text-xs font-semibold text-[var(--text-primary)]">
                            <CategoryDot category={cat.id} />
                            <CategoryIcon category={cat.id} size={15} />
                            {cat.label}
                          </span>
                          <span className="font-mono-tabular text-xs text-[var(--text-muted)]">
                            {keywords.length} termos
                          </span>
                        </button>

                        <div className="accordion-grid" data-open={isOpen}>
                          <div className="accordion-inner">
                            <div className="space-y-3 border-t border-[var(--border-hairline)] bg-[var(--bg-surface)] p-3.5">
                              <form
                                onSubmit={(e) => {
                                  e.preventDefault();
                                  if (
                                    addKeywordToCategory(cat.id, newKeywordInput)
                                  ) {
                                    setNewKeywordInput('');
                                  }
                                }}
                                className="flex gap-2"
                              >
                                <input
                                  type="text"
                                  placeholder="Nova palavra-chave"
                                  value={newKeywordInput}
                                  onChange={(e) =>
                                    setNewKeywordInput(e.target.value)
                                  }
                                  className="h-9 flex-1 rounded-full border border-[var(--border-hairline)] bg-[var(--bg-app)] px-3.5 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:border-[var(--accent)]"
                                />
                                <button
                                  type="submit"
                                  className="btn-primary h-9 px-3.5 text-xs"
                                >
                                  Adicionar
                                </button>
                              </form>

                              <div className="flex flex-wrap gap-1.5">
                                {(showAllKeywords
                                  ? keywords
                                  : keywords.slice(0, 40)
                                ).map((kw) => (
                                  <span
                                    key={kw}
                                    className="inline-flex items-center gap-1 rounded-full border border-[var(--border-hairline)] bg-[var(--bg-app)] px-2.5 py-1 text-xs text-[var(--text-primary)]"
                                  >
                                    {kw}
                                    <button
                                      type="button"
                                      onClick={() =>
                                        removeKeywordFromCategory(cat.id, kw)
                                      }
                                      aria-label={`Remover ${kw}`}
                                      className="text-[var(--text-muted)] transition-colors duration-150 ease-ui hover:text-[var(--negative)]"
                                    >
                                      <X size={12} strokeWidth={1.8} />
                                    </button>
                                  </span>
                                ))}
                                {keywords.length > 40 && !showAllKeywords && (
                                  <button
                                    type="button"
                                    onClick={() => setShowAllKeywords(true)}
                                    className="font-mono-tabular rounded-full border border-[var(--border-hairline)] bg-[var(--bg-subtle)] px-3 py-1 text-xs font-semibold text-[var(--accent-fg)] transition-colors hover:bg-[var(--bg-app)]"
                                  >
                                    +{keywords.length - 40} termos
                                  </button>
                                )}
                                {keywords.length > 40 && showAllKeywords && (
                                  <button
                                    type="button"
                                    onClick={() => setShowAllKeywords(false)}
                                    className="rounded-full border border-[var(--border-hairline)] bg-[var(--bg-subtle)] px-3 py-1 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
                                  >
                                    Mostrar menos
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  },
                )}
              </div>
            </section>
          </div>
        </div>
      </div>

      {feedback && (
        <div className="apple-glass-strong fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full border border-[var(--border-subtle)] px-4 py-2 text-xs font-medium text-[var(--text-primary)] shadow-[var(--shadow-float)] md:bottom-8">
          {feedback}
        </div>
      )}
    </div>
  );
}
