# Plano de Migração: Flutter → PWA em React (TypeScript)

Este documento estrutura o plano técnico completo para migrar o aplicativo **Carrinho de Compras Inteligente** (atualmente ~21.770 linhas em Flutter/Dart) para um **Progressive Web App (PWA) moderno em React + TypeScript**.

> **Regra de Isolamento Git:** Toda a execução desta migração é realizada na **branch separada `flutter_pwa_migration`**, mantendo a branch `main` intacta com o código Flutter nativo como referência e fallback.

---

## 1. Objetivos da Migração

1. **Independência de Lojas (Apple Store & Play Store):** Distribuir o aplicativo diretamente via URL com experiência instalável (*Standalone*) no iOS e Android, eliminando taxas anuais, revisões burocráticas e restrições de publicação.
2. **Paridade Funcional e de Dados:** Preservar 100% das regras de negócio inteligentes (classificação automática, comparação de preços entre mercados, inflação pessoal, histórico e sincronização familiar em tempo real no Firestore).
3. **Retrocompatibilidade de Nuvem:** Manter o mesmo schema da coleção `shared_spaces/{spaceCode}` no Cloud Firestore (`carrinho-de-compras-35ded`), permitindo que dispositivos no app Flutter antigo e usuários no novo PWA compartilhem a mesma família sem perda de dados.
4. **Refatoração Arquitetural:** Corrigir os débitos técnicos apontados em [`AUDITORIA.md`](./AUDITORIA.md), especialmente a quebra do monólito `history_screen.dart` (4.840 linhas), ausência de configuração Web do Firebase e condições de corrida na sincronização.

---

## 2. Stack Tecnológica Alvo (PWA React)

| Camada | Tecnologia Recomendada | Justificativa / Equivalência no Flutter |
| :--- | :--- | :--- |
| **Build & Bundler** | **Vite + React 19 + TypeScript** | Build rápido, tree-shaking agressivo e bundle inicial leve (< 200 KB gzipped contra ~2–4 MB do Flutter Web). |
| **PWA & Offline** | **`vite-plugin-pwa` (Workbox)** | Geração automática de Service Worker (`sw.js`), cache *offline-first* de assets e `manifest.webmanifest`. |
| **Estilização & Tema** | **Tailwind CSS v4** + CSS Variables | Reproduz com exatidão os tokens de `lib/theme/app_colors.dart` (Claro/Escuro) e responsividade mobile-first. |
| **Estado Global** | **Zustand** | Substitui `ShoppingController` (`ChangeNotifier`) com seletores granulares e zero boilerplate. |
| **Persistência Local** | **IndexedDB (`idb-keyval`)** | Substitui `dart:io` (`_resolveStorageFile()`), evitando o limite de 5 MB do `localStorage`. |
| **Nuvem & Tempo Real** | **Firebase JS SDK v11** (`firestore`, `auth`) | Mantém `shared_spaces` em tempo real com cache offline nativo (`persistentLocalCache`). |
| **Gráficos** | **Recharts** (ou **SVG customizado**) | Substitui `_PriceTrendLineChartPainter` e `_DualPriceComparisonChartPainter` com tooltips touch nativos. |
| **Ícones & Animação** | **`lucide-react`** + **`lottie-react`** | Equivalente aos Material Icons + reuso direto de `assets/lotties/shopping_cart.json`. |
| **Drag & Drop** | **`@dnd-kit/core` + `@dnd-kit/sortable`** | Substitui a reordenação de corredores/categorias em `market_config_screen.dart`. |
| **Scanner QR Code** | **`html5-qrcode`** (ou `@zxing/browser`) | Substitui `mobile_scanner` usando `getUserMedia` no Chrome Android e iOS Safari (HTTPS). |
| **OCR & SEFAZ Proxy** | **Firebase Cloud Functions (Node/TS)** *(opcional/híbrido)* | Contorna restrições de CORS/`X-Frame-Options` da SEFAZ e substitui o Google ML Kit on-device. |
| **Testes** | **Vitest + React Testing Library** | Substitui `flutter_test` para portar os testes de `test/` (similaridade, parser de lista e NFC-e). |

---

## 3. Estratégia de Git e Estrutura de Pastas (Branch `flutter_pwa_migration`)

### 3.1. Branch da Migração

A migração **não** altera a branch `main`. O desenvolvimento ocorre exclusivamente na branch `flutter_pwa_migration`:

```bash
git checkout flutter_pwa_migration
```

### 3.2. Organização de Diretórios na Branch `flutter_pwa_migration`

Recomenda-se manter uma estrutura limpa voltada ao ecossistema Web/Node, preservando apenas os assets reaproveitáveis (`assets/imgs/`, `assets/lotties/shopping_cart.json`, `assets/icons/`) e o `firestore.rules`:

```text
/
├── public/
│   ├── icons/                  # Ícones PWA (192x192, 512x512, maskable, apple-touch-icon)
│   └── assets/                 # Imagens migradas (ListTop.jpg, gocery.jpg, cartoonIcons.jpg)
├── src/
│   ├── assets/
│   │   └── shopping_cart.json  # Lottie reaproveitado diretamente do Flutter
│   ├── types/
│   │   └── shopping.ts         # Equivalente a lib/models/shopping_models.dart
│   ├── theme/
│   │   └── tokens.css          # Equivalente a lib/theme/app_colors.dart
│   ├── utils/
│   │   ├── formatters.ts       # Equivalente a lib/utils/formatters.dart
│   │   └── listParser.ts       # Parser de colagem rápida de listas (2kg Arroz, 3x Leite)
│   ├── services/
│   │   ├── categoryClassifier.ts     # Port de lib/services/category_classifier.dart
│   │   ├── productHistoryService.ts  # Port de lib/services/product_history_service.dart
│   │   ├── nfceParserService.ts      # Port das regexes/HTML parser de nfce_scanner_service.dart
│   │   ├── receiptParserService.ts   # Port do parser de OCR de receipt_scanner_service.dart
│   │   ├── cloudSyncService.ts       # Port de cloud_sync_service.dart (Firebase Web SDK)
│   │   └── storageService.ts         # Persistência local em IndexedDB
│   ├── store/
│   │   └── useShoppingStore.ts       # Equivalente a ShoppingController
│   ├── components/
│   │   ├── layout/             # BottomNav, SplashScreen, PwaInstallBanner, ThemeToggle
│   │   ├── list/               # MarketBargainBanner, EditItemModal, FiltersSheet, PasteModal
│   │   ├── history/            # Charts (PriceTrend, DualComparison), ReceiptImportModal
│   │   └── common/             # Badges, CategoryIcon, EmptyState
│   ├── pages/
│   │   ├── HomePage.tsx              # Port de home_screen.dart
│   │   ├── ShoppingListPage.tsx      # Port de shopping_list_screen.dart
│   │   ├── HistoryPage.tsx           # Port modularizado de history_screen.dart
│   │   ├── ProductAnalyticsPage.tsx  # Extraído de history_screen.dart
│   │   ├── ProductComparisonPage.tsx # Extraído de history_screen.dart
│   │   └── MarketConfigPage.tsx      # Port de market_config_screen.dart
│   ├── App.tsx
│   └── main.tsx
├── functions/                  # (Fase 5) Cloud Functions para Proxy SEFAZ + OCR
├── tests/                      # Suíte Vitest portando test/*.dart
├── firestore.rules             # Mantido e evoluído na raiz
├── vite.config.ts              # Configuração Vite + vite-plugin-pwa
└── package.json
```

*(Nota: Durante as Fases 1 e 2, caso queira consultar o código Dart lado a lado na própria branch `pwa`, mantenha uma pasta temporária `legacy_flutter/` e remova-a na Fase 6 antes do merge/deploy final).*

---

## 4. Plano de Execução em Fases

### Fase 0 — Setup da Branch `pwa` e Fundação do Projeto
- [ ] Criar a branch `pwa` a partir da `main`.
- [ ] Inicializar projeto Vite + React + TypeScript (`npm create vite@latest`).
- [ ] Configurar Tailwind CSS v4 com suporte a `class="dark"` e variáveis de cor idênticas a `AppColors`:
  - `primaryGreen`: `#00C853`
  - `accentGreen`: `#10B981`
  - Light: background `#F8F9FA`, surface `#FFFFFF`, textPrimary `#111827`, textSecondary `#6B7280`, border `#E5E7EB`
  - Dark: background `#121417`, surface `#1E2229`, textPrimary `#F3F4F6`, textSecondary `#9CA3AF`, border `#2E3440`
- [ ] Configurar `vite-plugin-pwa` com manifesto inicial (`name`, `short_name`, `start_url`, `display: "standalone"`, `theme_color: "#00C853"`).
- [ ] Copiar assets reutilizáveis de `assets/` (`shopping_cart.json`, `ListTop.jpg`, `gocery.jpg`, `cartoonIcons.jpg`, `cart.png`, `grocery-cart.png`) e gerar ícones PWA 192px, 512px e `apple-touch-icon` (180px).
- [ ] Configurar Vitest + Testing Library + ESLint/Prettier.

**Critério de Aceite:** App base compila, abre no navegador mobile em modo claro/escuro e `vitest run` executa sem erros.

---

### Fase 1 — Portabilidade do Domínio Puro e Testes Unitários (Lógica 100% Portável)

Todo o núcleo inteligente do app é Dart puro e deve ser traduzido para TypeScript tipado com **paridade matemática e comportamental exata**, antes mesmo de construir telas.

- [ ] **Modelos (`src/types/shopping.ts`):**
  - Portar `ProductCategory` (11 categorias com `id`, `label`, `color`, aliases legados em `fromId`).
  - Portar `ShoppingItem`, `MarketProfile`, `PurchaseHistoryItem`, `PurchaseRecord`, `ProductVariationItem`, `PriceIndexSummary`, `CategorySpendingSummary`, `ProductHistoryOccurrence`, `MarketProductStats`, `MarketPriceRecommendation`.
  - Garantir `effectiveTotalAmount` e `effectiveUnitPrice` idênticos aos getters do Dart.
- [ ] **Formatadores (`src/utils/formatters.ts`):**
  - Portar formatação de moeda (`R$ 0,00`), datas e unidades de `lib/utils/formatters.dart`.
- [ ] **Classificador e Similaridade (`src/services/categoryClassifier.ts`):**
  - Portar todas as regras de `lib/services/category_classifier.dart` (1.419 linhas):
    - `_stripDiacritics`, `normalize`, `singularize`.
    - `normalizeForComparison` (remoção de `cod`, `ref`, `plu`, `ean`, `gtin`, `sku`, códigos numéricos de 3+ dígitos e tokens de ruído).
    - `productSimilarity` (usado na busca e comparação de similares).
    - Classificação por dicionário base + `_learnedCategories` + `_categoryDictionary` customizado.
- [ ] **Histórico & Agregação (`src/services/productHistoryService.ts`):**
  - Portar `ProductHistoryAggregate` (`buildAllFromRecords`, `variationPercentFromLastTime`, `marketRanking`, `marketComparisonInsight`, `findSimilarProducts`, `matchesSearchQuery`).
  - Extrair de `home_screen.dart` e `history_screen.dart` os cálculos de **Resumo Mensal**, **Índice de Inflação Pessoal (`PriceIndexSummary`)** e **Gastos por Categoria** para funções puras testáveis.
- [ ] **Parsers de Lista e Cupom (`listParser.ts`, `nfceParserService.ts`, `receiptParserService.ts`):**
  - Portar parsing de texto colado (ex.: `"2kg Arroz"`, `"3x Leite"`).
  - Portar validação Módulo 11 da chave de 44 dígitos (`verifyCheckDigit`), `_scoreAccessKey`, `_ufByCode` e parsers HTML/texto de cupom fiscal.
- [ ] **Portar Suíte de Testes (`tests/`):**
  - Traduzir os casos de `test/smart_features_test.dart` (929 linhas) e `test/product_comparison_similarity_test.dart` (196 linhas) para Vitest.

**Critério de Aceite:** 100% dos testes unitários portados passando no Vitest com resultados idênticos aos do Dart.

---

### Fase 2 — Gerenciamento de Estado, Persistência Offline e Firebase Sync

Substitui `ShoppingController` (`1.464` linhas) e `CloudSyncService` (`195` linhas) removendo qualquer dependência de `dart:io` e `home_widget`.

- [ ] **Persistência Local (`src/services/storageService.ts`):**
  - Salvar estado completo em **IndexedDB** (`idb-keyval`), eliminando `File`/`Directory.systemTemp` da versão Flutter.
- [ ] **Store Global (`src/store/useShoppingStore.ts`):**
  - Gerenciar `items`, `markets`, `selectedMarketId`, `filterBySelectedMarket`, `history`, `learnedCategories`, `categoryDictionary`, `categoryFilter`, `showCheckedItems`, `isDarkMode`, `sharedSpaceCode`, `clientId`.
  - Implementar ações com debounce automático (300–500ms) para gravação local e push em nuvem.
- [ ] **Integração Firebase Web (`src/services/cloudSyncService.ts`):**
  - Criar App Web no projeto Firebase `carrinho-de-compras-35ded` e armazenar credenciais em `.env` (`VITE_FIREBASE_*`).
  - Inicializar Firestore com `initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) })` para sincronização offline-first entre múltiplas abas do navegador.
  - **Manter schema compatível com o Flutter:** ler e escrever exatamente o payload esperado em `shared_spaces/{spaceCode}`:
    ```json
    {
      "spaceCode": "CASA-4829",
      "updatedByClientId": "client_...",
      "updatedAtMs": 1730000000000,
      "updatedAtIso": "2026-...",
      "items": [],
      "markets": [],
      "selectedMarketId": "mercado_padrao",
      "history": [],
      "learnedCategories": {},
      "categoryDictionary": {},
      "showCheckedItems": true
    }
    ```
  - **Correções de Concorrência (`AUDITORIA.md`):**
    - Ignorar snapshots onde `data.updatedAtMs < lastAppliedRemoteTimestampMs` (evita sobrescrita por pacotes atrasados de rede móvel).
    - Atualizar `firestore.rules` (sem quebrar o Flutter) preparando autenticação anônima opcional (`signInAnonymously()`) para evoluir a segurança nas próximas versões.

**Critério de Aceite:** Criar um código de família no app Flutter (ou via Firestore Console) e entrar no mesmo código pelo PWA React — alterações na lista e mercados sincronizam em tempo real nos dois sentidos.

---

### Fase 3 — UI Core: Design System, Splash, Lista de Compras e Configurações

Foco em UX móvel fluida (toque, safe areas do iPhone com notch/Dynamic Island, feedback tátil visual e carregamento instantâneo).

- [ ] **Shell do App e Navegação (`App.tsx`):**
  - Splash screen opcional e ultra-rápida usando `lottie-react` com `shopping_cart.json` (apenas na primeira carga ou enquanto IndexedDB hidrata, max ~400ms para não prejudicar UX web).
  - `BottomNavigation` fixa com suporte a `env(safe-area-inset-bottom)` e as 4 abas: **Início**, **Lista** (com badge verde de `pendingItemsCount`), **Histórico**, **Configurações**.
  - Alternância de Tema Claro/Escuro persistente e sincronizada com `<meta name="theme-color">`.
- [ ] **Aba Lista de Compras (`ShoppingListPage.tsx`):**
  - Cabeçalho estilizado com onda SVG + imagem `ListTop.jpg` e botões glassmorphism.
  - Banner **"Onde Comprar Mais Barato"** (`MarketBargainBanner`) agrupando economia por mercado.
  - Input rápido com autocomplete baseado no histórico + Modal **"Colar Lista Inteira"** (`PasteListModal`).
  - Lista agrupada conforme a ordem de corredores do `selectedMarket` e seções expansíveis/colapsáveis.
  - Checkbox de item no carrinho + cálculo de subtotal em tempo real (pendentes vs no carrinho).
  - **Modal de Edição de Item (`EditItemModal`):** Preço unitário vs total (`isPriceTotal`), quantidade, unidade (`un`, `kg`, `g`, `dz`, `cx`, `L`), categoria, mercado e card comparativo de preços históricos por mercado.
  - **Bottom Sheet de Filtros (`FiltersSheet`):** Filtro por categoria, ocultar/mostrar marcados, filtrar por mercado selecionado.
  - **Dialog de Finalizar Compra:** Gera um `PurchaseRecord`, salva no histórico e limpa/atualiza a lista.
- [ ] **Aba Configurações e Mercados (`MarketConfigPage.tsx`):**
  - CRUD de mercados + reordenação arrastável (`@dnd-kit`) da ordem de corredores (`categoryOrder`).
  - Gerenciador do Dicionário de Palavras-Chave por categoria.
  - Painel de **Sincronização em Família** (gerar código `CASA-XXXX`, entrar com código existente, desconectar, status da conexão).

**Critério de Aceite:** Fluxo completo de adicionar, colar lista, editar preços, checar itens, finalizar compra e configurar mercados funcionando perfeitamente em viewport mobile (375px–430px) e desktop.

---

### Fase 4 — UI Analítica: Início (Dashboard) e Histórico Modularizado

Aqui resolvemos o maior débito técnico do projeto Flutter: dividir as 4.840 linhas de `history_screen.dart` em componentes pequenos, testáveis e fáceis de manter.

- [ ] **Aba Início (`HomePage.tsx`):**
  - Card de **Resumo de Gastos do Mês** (total gasto, quantidade de compras, comparativo percentual vs mês anterior).
  - Carrossel horizontal de **Maiores Variações Recentes** (quedas e altas).
  - Card de **Índice de Inflação Pessoal** (`PriceIndexCard`) com seletor de período.
  - Card de **Gastos por Categoria** (`CategorySpendingCard`) com barras de progresso e percentuais.
- [ ] **Aba Histórico (`HistoryPage.tsx`):**
  - Listagem de compras passadas agrupadas/filtráveis por mercado, expansão de itens, edição de item no histórico e botão "Reaproveitar compra na lista atual".
  - **Busca por Produto** com matching fuzzy (`matchesSearchQuery`).
- [ ] **Analytics por Produto (`ProductAnalyticsPage.tsx`):**
  - Menor preço histórico (com mercado e data), preço médio, último preço pago, ranking de mercados e insight textual.
  - **Gráfico Interativo de Evolução de Preços (`PriceTrendChart`):** Implementado com Recharts/SVG responsivo e tooltip ao tocar/arrastar.
- [ ] **Comparador de Produtos Similares (`ProductComparisonPage.tsx`):**
  - Seleção de Produto A e Produto B (com sugestões automáticas via `findSimilarProducts`).
  - Veredito de melhor custo-benefício, métricas lado a lado, ranking dos melhores mercados e gráfico dual (`DualPriceComparisonChart`).

**Critério de Aceite:** Todos os cálculos financeiros e gráficos interativos batem com o comportamento da versão Flutter, sem travamentos de scroll no Safari mobile.

---

### Fase 5 — Estratégia Web para Recursos Nativos (Câmera, NFC-e/SEFAZ e OCR)

Esta é a fase mais crítica da adaptação para a Web, pois envolve limitações reais dos navegadores.

| Recurso Flutter Atual | Limitação na Web / PWA | Solução Arquitetural no PWA React |
| :--- | :--- | :--- |
| **`mobile_scanner`** (QR Code) | Requer HTTPS e permissão explícita da câmera no browser | **`html5-qrcode`** (ou `@zxing/browser`) com seleção de câmera traseira (`facingMode: "environment"`), suporte a lanterna onde disponível e **input manual para colar URL/chave de 44 dígitos**. |
| **`webview_flutter`** (SEFAZ + JS Injection) | **Impossível em browser:** `X-Frame-Options` e *Same-Origin Policy* bloqueiam iframes e injeção de JS em sites da SEFAZ | **Estratégia Híbrida em 2 Camadas:**<br>1. **Cloud Function Proxy (`fetchNfce`):** Recebe a URL/chave no backend Node.js, faz o fetch HTML no servidor e retorna os itens extraídos usando o `nfceParserService.ts`.<br>2. **Fallback para SEFAZ com Captcha/Cloudflare:** Abre o portal da SEFAZ em nova aba (`window.open`) + área no PWA para **colar o conteúdo copiado da página ou upload do XML/HTML**. |
| **`google_mlkit_text_recognition`** (OCR Foto) | ML Kit não existe na Web | **Estratégia em 2 Opções:**<br>- **Recomendada (Leve e precisa):** `<input type="file" accept="image/*" capture="environment">` envia foto comprimida (Canvas JPEG max 1200px) para Cloud Function (Gemini Flash / Cloud Vision) → retorna texto/JSON para o `receiptParserService`.<br>- **Alternativa 100% Offline:** `tesseract.js` rodando em Web Worker com modelo `por.traineddata`. |
| **`home_widget`** (Widget Tela Inicial) | Não existe em PWAs (nem Android nem iOS) | Substituído por **App Shortcuts no `manifest.webmanifest`** (segurar o ícone do app no Android abre direto `"/?action=quick-add"` para adicionar item rápido). |

#### Tarefas da Fase 5:
- [ ] Implementar `QrScannerModal.tsx` usando câmera web + fallback para colar link/chave.
- [ ] Criar Firebase Cloud Function (`functions/src/fetchNfce.ts`) com rate limiting e parsing HTML (Cheerio) reutilizando a lógica de `nfceParserService.ts`.
- [ ] Implementar fluxo de fallback manual (colar texto/HTML da nota ou importar foto via `<input capture="environment">`).
- [ ] Configurar endpoint de OCR (Cloud Function ou Web Worker Tesseract.js) conectado ao `receiptParserService.ts`.
- [ ] Implementar handler de URL shortcut (`/?action=quick-add`) ao abrir o PWA pelo atalho do ícone.

**Critério de Aceite:** Usuário consegue importar uma compra via QR Code (câmera no Chrome Android e iOS Safari), colando link/chave de 44 dígitos ou fotografando o cupom impresso.

---

### Fase 6 — Polimento PWA (iOS & Android), Qualidade e Deploy

- [ ] **Experiência Instalável no iOS Safari e Android Chrome:**
  - Configurar meta tags Apple em `index.html`:
    - `apple-mobile-web-app-capable="yes"`
    - `apple-mobile-web-app-status-bar-style="black-translucent"`
    - `viewport-fit=cover`
    - `<link rel="apple-touch-icon" href="/icons/apple-touch-icon-180.png">`
  - Criar componente `PwaInstallPrompt.tsx`:
    - **Android/Desktop Chrome:** Captura `beforeinstallprompt` e exibe botão discreto *"Instalar App"*.
    - **iOS Safari:** Detecta Safari iOS não-standalone e exibe guia visual simples (*"Toque em Compartilhar ⎋ e depois em Adicionar à Tela de Início"*).
  - Criar banner de atualização do Service Worker (*"Nova versão disponível — Atualizar agora"*).
- [ ] **Auditoria Lighthouse & Performance:**
  - Alcançar pontuação **PWA / Best Practices / Accessibility >= 95** no Lighthouse.
  - Garantir funcionamento **100% offline** para consultar lista, marcar itens no supermercado (onde frequentemente falta sinal 4G) e enfileirar sincronização para quando voltar online.
- [ ] **Deploy Contínuo (Custo Zero):**
  - Configurar **Firebase Hosting** (ou Cloudflare Pages / Vercel) com HTTPS obrigatório (exigido para PWA e câmera) e headers de cache adequados (`sw.js` com `no-cache`, assets com hash imutáveis).
  - Atualizar `PRIVACY_POLICY.md` com eventual menção ao processamento de imagem/OCR caso utilize endpoint em nuvem.

---

## 5. Riscos Conhecidos e Mitigações

| Risco | Impacto | Mitigação |
| :--- | :--- | :--- |
| **Bloqueio de Scraping na SEFAZ por estado (Captcha/Cloudflare)** | Alto | Alguns estados exigem reCAPTCHA que um backend proxy não consegue resolver sozinho. Mitigado com o fluxo de fallback (abrir em nova aba + colar conteúdo / foto OCR / entrada manual). |
| **Evicção de Cache no iOS Safari** | Médio | O iOS pode limpar dados locais de PWAs não abertos por várias semanas. Mitigado incentivando o usuário a ativar o **Código de Família (Firestore)** logo no onboarding para backup contínuo na nuvem. |
| **Permissão de Câmera no iOS PWA Standalone** | Médio | Versões antigas do iOS tinham bugs de câmera no modo standalone. Testar explicitamente em iOS 16.4+ e sempre manter `<input type="file" capture="environment">` como fallback nativo garantido do Safari. |
| **Sobrescrita Concorrente no Firestore (`Lost Update`)** | Médio | Herdar o mecanismo de `clientId` + validação de `updatedAtMs` monótono; planejar migração futura de documento único para subcoleções caso famílias maiores editem simultaneamente. |

---

## 6. Checklist Resumido para Início Imediato

1. [ ] `git checkout main && git checkout -b pwa`
2. [ ] Criar app Vite + React + TS + Tailwind + `vite-plugin-pwa`
3. [ ] Portar `types`, `categoryClassifier`, `productHistoryService` e suíte Vitest
4. [ ] Conectar Firestore compatível com `shared_spaces`
5. [ ] Construir as 4 abas (Lista, Início, Histórico, Configurações)
6. [ ] Implementar Scanner QR / Cloud Function NFC-e / OCR
7. [ ] Testar instalação PWA em Android e iOS + Deploy no Firebase Hosting
