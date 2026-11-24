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
import { CategoryIcon } from '../components/common/CategoryIcon';
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
      className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 transition ${
        isDragging
          ? 'z-10 border-[#00C853] bg-white shadow-lg dark:bg-[#1E2229]'
          : 'border-[#E5E7EB] bg-[#F8F9FA] dark:border-[#2E3440] dark:bg-[#181B20]'
      }`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Arrastar ${info.label}`}
        className="cursor-grab touch-none text-[#6B7280] active:cursor-grabbing dark:text-[#9CA3AF]"
      >
        <GripVertical size={17} />
      </button>
      <span className="w-5 text-center text-xs font-bold text-[#6B7280] dark:text-[#9CA3AF]">
        {index + 1}
      </span>
      <CategoryIcon category={id} size={17} />
      <span className="flex-1 text-xs font-semibold text-[#111827] dark:text-[#F3F4F6]">
        {info.label}
      </span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={index === 0}
          onClick={onMoveUp}
          aria-label="Mover para cima"
          className="rounded-lg p-1 text-[#6B7280] hover:bg-black/5 disabled:opacity-25 dark:text-[#9CA3AF] dark:hover:bg-white/10"
        >
          <ArrowUp size={14} />
        </button>
        <button
          type="button"
          disabled={index === total - 1}
          onClick={onMoveDown}
          aria-label="Mover para baixo"
          className="rounded-lg p-1 text-[#6B7280] hover:bg-black/5 disabled:opacity-25 dark:text-[#9CA3AF] dark:hover:bg-white/10"
        >
          <ArrowDown size={14} />
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

  const selectedMarket =
    markets.find((m) => m.id === selectedMarketId) ?? markets[0];

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 150, tolerance: 5 },
    }),
  );

  const notify = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 3000);
  };

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
      notify(`Espaço ${code} criado!`);
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
      notify('Conectado ao espaço familiar!');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Erro ao conectar');
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] pb-24 pt-safe dark:bg-[#121417]">
      <header className="sticky top-0 z-20 border-b border-[#E5E7EB] bg-white/90 px-4 py-3.5 backdrop-blur-md dark:border-[#2E3440] dark:bg-[#1E2229]/90">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <div>
            <h1 className="text-lg font-extrabold text-[#111827] dark:text-[#F3F4F6]">
              Mercados &amp; Ajustes
            </h1>
            <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">
              Corredores, dicionário inteligente e nuvem
            </p>
          </div>
          <ThemeToggleButton />
        </div>
      </header>

      <div className="mx-auto max-w-2xl space-y-5 px-4 pt-4">
        {/* Cloud Sync Section */}
        <section className="rounded-3xl border border-[#E5E7EB] bg-white p-4 shadow-2xs dark:border-[#2E3440] dark:bg-[#1E2229]">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                  sharedSpaceCode
                    ? 'bg-[#00C853]/12 text-[#00C853]'
                    : 'bg-[#F3F4F6] text-[#6B7280] dark:bg-[#181B20] dark:text-[#9CA3AF]'
                }`}
              >
                {sharedSpaceCode ? <Cloud size={19} /> : <CloudOff size={19} />}
              </div>
              <div>
                <h2 className="text-sm font-bold text-[#111827] dark:text-[#F3F4F6]">
                  Sincronização em Família
                </h2>
                <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">
                  {sharedSpaceCode
                    ? hasPendingCloudPush
                      ? 'Alterações locais pendentes de envio (aguardando rede)'
                      : isSyncingCloud
                        ? 'Sincronizando com a nuvem...'
                        : lastSyncedAtIso
                          ? `Sincronizado às ${new Date(lastSyncedAtIso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
                          : 'Conectado ao Firestore em tempo real'
                    : 'Compartilhe listas e preços entre celulares'}
                </p>
              </div>
            </div>
          </div>

          {cloudError && (
            <div className="mb-3 rounded-xl bg-red-500/10 p-3 text-xs font-medium text-red-600 dark:text-red-400">
              {cloudError}
            </div>
          )}

          {sharedSpaceCode ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-2xl border border-[#00C853]/30 bg-[#00C853]/8 px-4 py-3">
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#6B7280] dark:text-[#9CA3AF]">
                    Código da Família
                  </span>
                  <p className="text-lg font-extrabold tracking-widest text-[#00C853]">
                    {sharedSpaceCode}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard?.writeText(sharedSpaceCode);
                    notify('Código copiado!');
                  }}
                  className="flex items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-xs font-bold text-[#111827] shadow-2xs dark:bg-[#181B20] dark:text-[#F3F4F6]"
                >
                  <Copy size={14} />
                  Copiar
                </button>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    void refreshCloudSync();
                    notify('Sincronizado!');
                  }}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-[#E5E7EB] bg-[#F8F9FA] py-2.5 text-xs font-bold text-[#111827] dark:border-[#2E3440] dark:bg-[#181B20] dark:text-[#F3F4F6]"
                >
                  <RefreshCw size={14} />
                  Atualizar agora
                </button>
                <button
                  type="button"
                  onClick={() => void disconnectSharedSpace()}
                  className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-xs font-bold text-red-600 dark:text-red-400"
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
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#00C853] py-2.5 text-xs font-bold text-white transition active:scale-98 disabled:opacity-50"
              >
                <Users size={16} />
                {isSyncingCloud ? 'Conectando...' : 'Criar Novo Código Familiar'}
              </button>

              <form onSubmit={handleJoinSpace} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Ou digite um código (ex: CASA-4829)"
                  value={joinCodeInput}
                  onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                  className="flex-1 rounded-xl border border-[#E5E7EB] bg-[#F3F4F6] px-3 py-2 text-xs font-bold uppercase text-[#111827] outline-none focus:border-[#00C853] dark:border-[#2E3440] dark:bg-[#181B20] dark:text-[#F3F4F6]"
                />
                <button
                  type="submit"
                  disabled={isSyncingCloud || !joinCodeInput.trim()}
                  className="rounded-xl bg-[#111827] px-4 py-2 text-xs font-bold text-white disabled:opacity-40 dark:bg-[#F3F4F6] dark:text-[#111827]"
                >
                  Entrar
                </button>
              </form>
            </div>
          )}
        </section>

        {/* Market Profile & Aisle Order Section */}
        <section className="rounded-3xl border border-[#E5E7EB] bg-white p-4 shadow-2xs dark:border-[#2E3440] dark:bg-[#1E2229]">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#00C853]/12 text-[#00C853]">
                <Store size={19} />
              </div>
              <div>
                <h2 className="text-sm font-bold text-[#111827] dark:text-[#F3F4F6]">
                  Ordem dos Corredores por Mercado
                </h2>
                <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">
                  Arraste para definir o trajeto dentro da loja
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowAddMarket((v) => !v)}
              className="flex items-center gap-1 rounded-xl bg-[#00C853]/12 px-2.5 py-1.5 text-xs font-bold text-[#00C853]"
            >
              <Plus size={14} />
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
                notify('Mercado adicionado!');
              }}
              className="mb-3 flex gap-2"
            >
              <input
                type="text"
                placeholder="Nome do mercado (ex: Carrefour)"
                value={newMarketName}
                onChange={(e) => setNewMarketName(e.target.value)}
                className="flex-1 rounded-xl border border-[#E5E7EB] bg-[#F3F4F6] px-3 py-2 text-xs font-medium text-[#111827] outline-none focus:border-[#00C853] dark:border-[#2E3440] dark:bg-[#181B20] dark:text-[#F3F4F6]"
              />
              <button
                type="submit"
                className="rounded-xl bg-[#00C853] px-3.5 py-2 text-xs font-bold text-white"
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
                className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
                  m.id === selectedMarket.id
                    ? 'bg-[#00C853] text-white'
                    : 'border border-[#E5E7EB] bg-[#F8F9FA] text-[#6B7280] dark:border-[#2E3440] dark:bg-[#181B20] dark:text-[#9CA3AF]'
                }`}
              >
                {m.name}
              </button>
            ))}
          </div>

          {/* Edit/Delete selected market bar */}
          <div className="mb-3 flex items-center justify-between rounded-xl bg-[#F3F4F6] px-3 py-2 dark:bg-[#181B20]">
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
                  className="flex-1 rounded-lg bg-white px-2.5 py-1 text-xs font-semibold text-[#111827] outline-none dark:bg-[#1E2229] dark:text-[#F3F4F6]"
                />
                <button
                  type="submit"
                  className="rounded-lg bg-[#00C853] px-2.5 py-1 text-xs font-bold text-white"
                >
                  Salvar
                </button>
              </form>
            ) : (
              <>
                <span className="text-xs font-bold text-[#111827] dark:text-[#F3F4F6]">
                  {selectedMarket.name}
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setEditingMarketName(selectedMarket.name)}
                    className="rounded-lg p-1.5 text-[#6B7280] hover:bg-black/5 dark:text-[#9CA3AF]"
                    title="Renomear mercado"
                  >
                    <Edit3 size={14} />
                  </button>
                  {markets.length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        deleteMarket(selectedMarket.id);
                        notify('Mercado removido.');
                      }}
                      className="rounded-lg p-1.5 text-red-500 hover:bg-red-500/10"
                      title="Excluir mercado"
                    >
                      <Trash2 size={14} />
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
              <div className="space-y-1.5">
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

        {/* Smart Category Dictionary */}
        <section className="rounded-3xl border border-[#E5E7EB] bg-white p-4 shadow-2xs dark:border-[#2E3440] dark:bg-[#1E2229]">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#00C853]/12 text-[#00C853]">
                <BookOpen size={19} />
              </div>
              <div>
                <h2 className="text-sm font-bold text-[#111827] dark:text-[#F3F4F6]">
                  Dicionário de Categorias
                </h2>
                <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">
                  Palavras-chave usadas na classificação automática
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                resetCategoryDictionary();
                notify('Dicionário restaurado ao padrão.');
              }}
              className="flex items-center gap-1 rounded-xl border border-[#E5E7EB] px-2.5 py-1.5 text-[11px] font-bold text-[#6B7280] dark:border-[#2E3440] dark:text-[#9CA3AF]"
            >
              <RotateCcw size={12} />
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
                  className="overflow-hidden rounded-2xl border border-[#E5E7EB] dark:border-[#2E3440]"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setExpandedCategory(isOpen ? null : cat.id);
                      setNewKeywordInput('');
                    }}
                    className="flex w-full items-center justify-between bg-[#F8F9FA] px-3.5 py-2.5 text-left dark:bg-[#181B20]"
                  >
                    <span className="flex items-center gap-2 text-xs font-bold text-[#111827] dark:text-[#F3F4F6]">
                      <CategoryIcon category={cat.id} size={15} />
                      {cat.label}
                    </span>
                    <span className="text-[11px] font-semibold text-[#6B7280] dark:text-[#9CA3AF]">
                      {keywords.length} termos
                    </span>
                  </button>

                  {isOpen && (
                    <div className="space-y-2.5 bg-white p-3 dark:bg-[#1E2229]">
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
                          placeholder="Nova palavra-chave..."
                          value={newKeywordInput}
                          onChange={(e) => setNewKeywordInput(e.target.value)}
                          className="flex-1 rounded-xl border border-[#E5E7EB] bg-[#F3F4F6] px-3 py-1.5 text-xs text-[#111827] outline-none focus:border-[#00C853] dark:border-[#2E3440] dark:bg-[#181B20] dark:text-[#F3F4F6]"
                        />
                        <button
                          type="submit"
                          className="rounded-xl bg-[#00C853] px-3 py-1.5 text-xs font-bold text-white"
                        >
                          Adicionar
                        </button>
                      </form>

                      <div className="flex flex-wrap gap-1.5">
                        {keywords.slice(0, 40).map((kw) => (
                          <span
                            key={kw}
                            className="inline-flex items-center gap-1 rounded-full bg-[#F3F4F6] px-2.5 py-1 text-[11px] font-medium text-[#111827] dark:bg-[#181B20] dark:text-[#F3F4F6]"
                          >
                            {kw}
                            <button
                              type="button"
                              onClick={() =>
                                removeKeywordFromCategory(cat.id, kw)
                              }
                              aria-label={`Remover ${kw}`}
                              className="text-[#6B7280] hover:text-red-500"
                            >
                              <X size={11} />
                            </button>
                          </span>
                        ))}
                        {keywords.length > 40 && (
                          <span className="px-2 py-1 text-[11px] text-[#6B7280] dark:text-[#9CA3AF]">
                            +{keywords.length - 40} termos...
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
        <div className="fixed bottom-20 left-1/2 z-50 -translate-x-1/2 rounded-full bg-[#111827] px-4 py-2 text-xs font-semibold text-white shadow-xl dark:bg-[#F3F4F6] dark:text-[#111827]">
          {feedback}
        </div>
      )}
    </div>
  );
}
