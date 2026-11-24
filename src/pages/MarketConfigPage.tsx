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
      className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-[background-color,border-color,box-shadow] duration-150 ease-ui ${
        isDragging
          ? 'z-10 border-[var(--accent)] bg-[var(--bg-surface)] shadow-md'
          : 'border-[var(--border-hairline)] bg-[var(--bg-app)]'
      }`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Arrastar ${info.label}`}
        className="cursor-grab touch-none text-[var(--text-muted)] active:cursor-grabbing"
      >
        <GripVertical size={16} strokeWidth={1.5} />
      </button>
      <span className="font-mono-tabular w-5 text-center text-xs font-medium text-[var(--text-muted)]">
        {index + 1}
      </span>
      <CategoryDot category={id} />
      <CategoryIcon category={id} size={16} />
      <span className="flex-1 text-xs font-medium text-[var(--text-primary)]">
        {info.label}
      </span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={index === 0}
          onClick={onMoveUp}
          aria-label="Mover para cima"
          className="rounded-lg p-1.5 text-[var(--text-muted)] transition-colors duration-150 ease-ui hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)] disabled:opacity-25"
        >
          <ArrowUp size={15} strokeWidth={1.5} />
        </button>
        <button
          type="button"
          disabled={index === total - 1}
          onClick={onMoveDown}
          aria-label="Mover para baixo"
          className="rounded-lg p-1.5 text-[var(--text-muted)] transition-colors duration-150 ease-ui hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)] disabled:opacity-25"
        >
          <ArrowDown size={15} strokeWidth={1.5} />
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
  const [newKeywordInput, setNewKeywordInput] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(
    typeof document !== 'undefined' ? Boolean(document.fullscreenElement) : false,
  );

  const notify = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 3000);
  };

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        if (document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen();
          setIsFullscreen(true);
          notify('Modo tela cheia ativado');
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
          setIsFullscreen(false);
          notify('Modo tela cheia desativado');
        }
      }
    } catch (_) {
      notify('Tela cheia não suportada neste navegador');
    }
  };

  const selectedMarket =
    markets.find((m) => m.id === selectedMarketId) ?? markets[0];

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
    <div className="min-h-screen bg-[var(--bg-app)] pb-24 pt-safe">
      <header className="sticky top-0 z-20 border-b border-[var(--border-hairline)] bg-[var(--bg-surface)]/95 px-4 py-3 backdrop-blur-md">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-medium tracking-tight text-[var(--text-primary)]">
              Mercados &amp; Ajustes
            </h1>
            <p className="text-xs text-[var(--text-secondary)]">
              Corredores, dicionário de classificação e nuvem
            </p>
          </div>
          <ThemeToggleButton />
        </div>
      </header>

      <div className="mx-auto max-w-2xl space-y-4 px-4 pt-4 animate-enter">
        {/* Cloud Sync */}
        <section className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-4 shadow-2xs">
          <div className="mb-3 flex items-start gap-2.5">
            <span className="mt-0.5 text-[var(--text-muted)]">
              {sharedSpaceCode ? (
                <Cloud size={18} strokeWidth={1.5} className="text-[var(--accent-fg)]" />
              ) : (
                <CloudOff size={18} strokeWidth={1.5} />
              )}
            </span>
            <div>
              <h2 className="text-sm font-medium text-[var(--text-primary)]">
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
                  : 'Compartilhe listas e preços entre celulares'}
              </p>
            </div>
          </div>

          {cloudError && (
            <div className="mb-3 rounded-xl border border-[var(--negative)]/25 bg-[var(--negative-soft)] p-3 text-xs font-medium text-[var(--negative)]">
              {cloudError}
            </div>
          )}

          {sharedSpaceCode ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-app)] px-4 py-3">
                <div>
                  <span className="text-xs text-[var(--text-muted)]">
                    Código da família
                  </span>
                  <p className="font-mono-tabular mt-0.5 text-lg font-medium tracking-wider text-[var(--accent-fg)]">
                    {sharedSpaceCode}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard?.writeText(sharedSpaceCode);
                    notify('Código copiado');
                  }}
                  className="flex h-9 items-center gap-1.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3 text-xs font-medium text-[var(--text-primary)] transition-colors duration-150 ease-ui hover:bg-[var(--bg-subtle)]"
                >
                  <Copy size={15} strokeWidth={1.5} />
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
                  className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-subtle)] text-xs font-medium text-[var(--text-primary)] transition-colors duration-150 ease-ui hover:bg-[var(--bg-app)]"
                >
                  <RefreshCw size={15} strokeWidth={1.5} />
                  Atualizar agora
                </button>
                <button
                  type="button"
                  onClick={() => void disconnectSharedSpace()}
                  className="h-9 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-4 text-xs font-medium text-[var(--negative)] transition-colors duration-150 ease-ui hover:bg-[var(--negative-soft)]"
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
                className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[var(--accent)] text-xs font-medium text-[var(--accent-ink)] transition-[background-color,opacity,transform] duration-150 ease-ui hover:bg-[var(--accent-hover)] active:scale-[0.98] disabled:opacity-50"
              >
                <Users size={16} strokeWidth={1.5} />
                {isSyncingCloud ? 'Conectando' : 'Criar novo código familiar'}
              </button>

              <form onSubmit={handleJoinSpace} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Digite um código (ex: CASA-4829)"
                  value={joinCodeInput}
                  onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                  className="font-mono-tabular h-9 flex-1 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-subtle)] px-3 text-xs font-medium text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:border-[var(--accent)]"
                />
                <button
                  type="submit"
                  disabled={isSyncingCloud || !joinCodeInput.trim()}
                  className="h-9 rounded-lg bg-[var(--text-primary)] px-4 text-xs font-medium text-[var(--bg-app)] transition-opacity duration-150 ease-ui disabled:opacity-40"
                >
                  Entrar
                </button>
              </form>
            </div>
          )}
        </section>

        {/* Market Profile & Aisle Order */}
        <section className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-4 shadow-2xs">
          <div className="mb-3 flex items-start justify-between gap-2">
            <div className="flex items-start gap-2.5">
              <span className="mt-0.5 text-[var(--text-muted)]">
                <Store size={18} strokeWidth={1.5} />
              </span>
              <div>
                <h2 className="text-sm font-medium text-[var(--text-primary)]">
                  Ordem dos corredores por mercado
                </h2>
                <p className="text-xs text-[var(--text-muted)]">
                  Arraste para definir o trajeto dentro da loja
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowAddMarket((v) => !v)}
              className="flex h-8 items-center gap-1 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-subtle)] px-2.5 text-xs font-medium text-[var(--text-primary)] transition-colors duration-150 ease-ui hover:bg-[var(--bg-app)]"
            >
              <Plus size={14} strokeWidth={1.5} />
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
              className="mb-3 flex gap-2"
            >
              <input
                type="text"
                placeholder="Nome do mercado (ex: Carrefour)"
                value={newMarketName}
                onChange={(e) => setNewMarketName(e.target.value)}
                className="h-9 flex-1 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-subtle)] px-3 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:border-[var(--accent)]"
              />
              <button
                type="submit"
                className="h-9 rounded-lg bg-[var(--accent)] px-3.5 text-xs font-medium text-[var(--accent-ink)]"
              >
                Criar
              </button>
            </form>
          )}

          <div className="no-scrollbar mb-3 flex items-center gap-2 overflow-x-auto pb-1">
            {markets.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  selectMarket(m.id);
                  setEditingMarketName(null);
                }}
                className={`h-8 shrink-0 rounded-lg border px-3 text-xs font-medium transition-[background-color,color,border-color] duration-150 ease-ui ${
                  m.id === selectedMarket.id
                    ? 'border-[var(--text-primary)] bg-[var(--text-primary)] text-[var(--bg-app)]'
                    : 'border-[var(--border-hairline)] bg-[var(--bg-app)] text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]'
                }`}
              >
                {m.name}
              </button>
            ))}
          </div>

          <div className="mb-3 flex items-center justify-between rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-subtle)] px-3 py-2">
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
                  className="h-8 flex-1 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-2.5 text-xs font-medium text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
                />
                <button
                  type="submit"
                  className="h-8 rounded-lg bg-[var(--accent)] px-3 text-xs font-medium text-[var(--accent-ink)]"
                >
                  Salvar
                </button>
              </form>
            ) : (
              <>
                <span className="text-xs font-medium text-[var(--text-primary)]">
                  {selectedMarket.name}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setEditingMarketName(selectedMarket.name)}
                    className="rounded-lg p-1.5 text-[var(--text-muted)] transition-colors duration-150 ease-ui hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]"
                    title="Renomear mercado"
                  >
                    <Edit3 size={15} strokeWidth={1.5} />
                  </button>
                  {markets.length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        deleteMarket(selectedMarket.id);
                        notify('Mercado removido');
                      }}
                      className="rounded-lg p-1.5 text-[var(--negative)] transition-colors duration-150 ease-ui hover:bg-[var(--negative-soft)]"
                      title="Excluir mercado"
                    >
                      <Trash2 size={15} strokeWidth={1.5} />
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
        </section>

        {/* Fullscreen Mode */}
        <section className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-4 shadow-2xs">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <span className="mt-0.5 text-[var(--text-muted)]">
                <Maximize2 size={18} strokeWidth={1.5} />
              </span>
              <div>
                <h2 className="text-sm font-medium text-[var(--text-primary)]">
                  Modo tela cheia
                </h2>
                <p className="text-xs text-[var(--text-muted)]">
                  Oculta barras do navegador durante as compras
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={toggleFullscreen}
              className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-subtle)] px-3 text-xs font-medium text-[var(--text-primary)] transition-[background-color,transform] duration-150 ease-ui hover:bg-[var(--bg-app)] active:scale-[0.98]"
            >
              {isFullscreen ? (
                <Minimize2 size={15} strokeWidth={1.5} />
              ) : (
                <Maximize2 size={15} strokeWidth={1.5} />
              )}
              <span>{isFullscreen ? 'Sair' : 'Ativar'}</span>
            </button>
          </div>
        </section>

        {/* Smart Category Dictionary */}
        <section className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-4 shadow-2xs">
          <div className="mb-3 flex items-start justify-between gap-2">
            <div className="flex items-start gap-2.5">
              <span className="mt-0.5 text-[var(--text-muted)]">
                <BookOpen size={18} strokeWidth={1.5} />
              </span>
              <div>
                <h2 className="text-sm font-medium text-[var(--text-primary)]">
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
              className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-[var(--border-hairline)] px-2.5 text-xs font-medium text-[var(--text-secondary)] transition-colors duration-150 ease-ui hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]"
            >
              <RotateCcw size={13} strokeWidth={1.5} />
              Resetar
            </button>
          </div>

          <div className="space-y-2">
            {PRODUCT_CATEGORIES.filter((c) => c.id !== 'diversos').map((cat) => {
              const keywords = categoryDictionary[cat.id] ?? [];
              const isOpen = expandedCategory === cat.id;

              return (
                <div
                  key={cat.id}
                  className="overflow-hidden rounded-xl border border-[var(--border-hairline)]"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setExpandedCategory(isOpen ? null : cat.id);
                      setNewKeywordInput('');
                    }}
                    className="flex w-full items-center justify-between bg-[var(--bg-app)] px-3 py-2.5 text-left transition-colors duration-150 ease-ui hover:bg-[var(--bg-subtle)]"
                  >
                    <span className="flex items-center gap-2 text-xs font-medium text-[var(--text-primary)]">
                      <CategoryDot category={cat.id} />
                      <CategoryIcon category={cat.id} size={16} />
                      {cat.label}
                    </span>
                    <span className="font-mono-tabular text-xs text-[var(--text-muted)]">
                      {keywords.length} termos
                    </span>
                  </button>

                  {isOpen && (
                    <div className="space-y-3 border-t border-[var(--border-hairline)] bg-[var(--bg-surface)] p-3">
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          if (addKeywordToCategory(cat.id, newKeywordInput)) {
                            setNewKeywordInput('');
                          }
                        }}
                        className="flex gap-2"
                      >
                        <input
                          type="text"
                          placeholder="Nova palavra-chave"
                          value={newKeywordInput}
                          onChange={(e) => setNewKeywordInput(e.target.value)}
                          className="h-9 flex-1 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-subtle)] px-3 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:border-[var(--accent)]"
                        />
                        <button
                          type="submit"
                          className="h-9 rounded-lg bg-[var(--accent)] px-3 text-xs font-medium text-[var(--accent-ink)]"
                        >
                          Adicionar
                        </button>
                      </form>

                      <div className="flex flex-wrap gap-1.5">
                        {keywords.slice(0, 40).map((kw) => (
                          <span
                            key={kw}
                            className="inline-flex items-center gap-1 rounded-md border border-[var(--border-hairline)] bg-[var(--bg-subtle)] px-2 py-1 text-xs text-[var(--text-primary)]"
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
                              <X size={12} strokeWidth={1.5} />
                            </button>
                          </span>
                        ))}
                        {keywords.length > 40 && (
                          <span className="font-mono-tabular px-2 py-1 text-xs text-[var(--text-muted)]">
                            +{keywords.length - 40} termos
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {feedback && (
        <div className="fixed bottom-20 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-[var(--border-hairline)] bg-[var(--text-primary)] px-4 py-2 text-xs font-medium text-[var(--bg-app)] shadow-lg">
          {feedback}
        </div>
      )}
    </div>
  );
}
