# Relatório de Auditoria Técnica e de Segurança

Este relatório consolida a auditoria estática e dinâmica realizada na base de código do aplicativo **Carrinho de Compras** (Flutter/Dart). A análise seguiu estritamente o protocolo de não modificação de código, leitura minuciosa e execução controlada de ferramentas de diagnóstico.

---

## 🏆 Top 5 Achados de Maior Risco (em ordem decrescente)

1. **[ALTO] Quebra de compilação da suíte de testes devido a arquivo de configuração ausente (`firebase_options.dart`)**  
   *Arquivo / Linha:* `lib/services/cloud_sync_service.dart:6`  
   *Impacto:* A suíte de testes inteira está impedida de compilar (`Compilation failed for testPath... No such file or directory: lib/firebase_options.dart`). Qualquer pipeline de CI/CD ou verificação regressiva falha imediatamente com 0 testes executados.

2. **[ALTO] Ausência total de Autenticação/Controle de Acesso em Nuvem e RLS/Rules não versionadas (Acesso Público Total via Firestore)**  
   *Arquivo / Linha:* `lib/services/cloud_sync_service.dart:60-64` e `lib/services/shopping_controller.dart:954-990`  
   *Impacto:* O app não implementa Firebase Auth (`FirebaseAuth`). Qualquer usuário com um código de 9 caracteres previsível (`PREFIX-9999`) pode sobrescrever, apagar ou extrair todo o carrinho, listas de compras e histórico de outro usuário sem qualquer verificação de identidade no servidor.

3. **[ALTO] Condição de Corrida Destrutiva (Lost Update) por substituição de estado monolítico (Snapshot Monolítico vs Operação Atômica)**  
   *Arquivo / Linha:* `lib/services/cloud_sync_service.dart:147-149` e `lib/services/shopping_controller.dart:1023-1039`  
   *Impacto:* A sincronização envia o mapa do estado local inteiro (`stateMap`) para o documento do Firestore via `.set(payload, SetOptions(merge: true))`. Se dois membros da família marcarem itens ao mesmo tempo, a última escrita sobrescreve integralmente a anterior, causando perda silenciosa de dados (sem transação Firestore, sem arrayUnion, sem locks).

4. **[MÉDIO] Monólito de UI, Lógica de Negócio e Cálculos Estatísticos em `history_screen.dart` (4.645 linhas)**  
   *Arquivo / Linha:* `lib/screens/history_screen.dart:1-4645`  
   *Impacto:* Violação severa de Separação de Responsabilidades. O arquivo concentra classes de agregação matemática, algoritmos de séries temporais para inflação pessoal, parsers de câmera/galeria, navegação Webview/QR Scanner e múltiplos `CustomPainter` de desenho de gráficos no Canvas. Alto acoplamento e altíssimo custo de manutenção/bugs colaterais.

5. **[MÉDIO] Persistência em disco insegura com caminhos frágeis e concorrência com Widget de Home Screen**  
   *Arquivo / Linha:* `lib/services/shopping_controller.dart:1102-1116` e `lib/services/shopping_controller.dart:1152-1175`  
   *Impacto:* O método `_resolveStorageFile()` navega por caminhos assumidos no sistema de arquivos (`Directory.systemTemp.parent/Documents` e `app_flutter`) sem usar `path_provider` padronizado. Além disso, `syncFromHomeWidget()` faz substituição incondicional do array `_items` caso detecte discrepância, podendo reverter edições locais sem merge de timestamps.

---

## 1. Testes de Integração

### Diagnóstico de Ferramentas e Execução

- **Ferramenta de teste configurada:** `flutter_test` (SDK Flutter) integrado no `pubspec.yaml`.
- **Banco de teste separado do de produção?** Não aplicável para backend próprio. O app é um cliente Flutter puro com integração ao Firebase Firestore. Nos testes existentes (`test/`), o controlador `ShoppingController` é instanciado com `enablePersistence: false`, isolando o disco e o Firebase em memória local para os testes de widgets.
- **Comando para rodar a suíte:** `flutter test`
- **Resultado da execução:**
  - **Comando executado:** `flutter test`
  - **Total de arquivos:** 3 arquivos de teste (`shopping_list_editor_widget_test.dart`, `widget_test.dart`, `smart_features_test.dart`).
  - **Passam:** 0
  - **Falham:** 3 (falha em compilação na inicialização da suíte antes do runner).
  - **Motivo da falha:** O arquivo `lib/services/cloud_sync_service.dart` importa `../firebase_options.dart` (gerado tipicamente via FlutterFire CLI), mas o arquivo não existe no repositório.

### Cobertura de Fluxos Críticos

| Fluxo Crítico | Status de Teste | Detalhes |
| :--- | :--- | :--- |
| **Cadastro** | Não possui | Não há tela/serviço de cadastro no app; o app opera em modo local anônimo. |
| **Login / Autenticação** | Não possui | Não há tela de login nem autenticação implementada. |
| **Checkout / Pagamento** | Não possui | O app é um assistente de carrinho e comparador de notas; não transaciona gateways de pagamento. |
| **Assinatura / Planos** | Não possui | O app não possui planos nem cobrança in-app implementada. |
| **Webhooks** | Não possui | Não atua como servidor nem recebe webhooks. |
| **Edição e Gestão de Lista** | Teste de Widget (em memória) | Coberto em `test/shopping_list_editor_widget_test.dart` e `test/widget_test.dart` (não roda devido ao erro de compilação). |
| **Leitura / Parser de Cupom Fiscal (NFC-e / OCR)** | Teste Unitário | Coberto em `test/smart_features_test.dart` e `test/widget_test.dart` (testa regexes de HTML SEFAZ e OCR). |
| **Sincronização em Nuvem (Cloud Firestore)** | **Nenhum teste** | Não há testes unitários, de integração ou com emulador Firebase para o fluxo de sincronização remota (`CloudSyncService`). |

### Tabela de Achados da Etapa 1

| Achado | Risco | Arquivo e Linha | Correção Sugerida |
| :--- | :---: | :--- | :--- |
| Import quebrado de `firebase_options.dart` impede compilação dos testes | **Alto** | `lib/services/cloud_sync_service.dart:6, 22` | Gerar `lib/firebase_options.dart` via `flutterfire configure` ou isolar a dependência em um wrapper condicional/mockável para que os testes rodem sem o arquivo físico. |
| Ausência de testes de integração com Firebase Emulator | **Médio** | `test/` | Configurar o Firestore Emulator Suite e testes de integração com `integration_test` cobrindo o envio e escuta do `shared_spaces`. |

---

## 2. Confiança no Cliente (Client Trust) & Segurança

### Análise de Regras, Permissões e Chaves

1. **Regras de preço, desconto e permissão que existem só no front:**
   - **Toda a regra de negócio existe exclusivamente no cliente.**
   - O aplicativo não possui um backend intermediário (Node.js, Go, Python, etc.). O cálculo de menor preço entre mercados (`calculateMarketSavings`), cálculo de inflação/cesta de preços (`calculatePriceIndex`) e definição do nome/preço dos itens ocorrem 100% no código Dart rodando no aparelho.
   - Não há validação de integridade nos valores submetidos: qualquer cliente pode enviar valores monetários negativos ou arbitrários para o Firebase.

2. **Chaves e Tokens em código de front / variáveis expostas:**
   - **`android/app/google-services.json`:** Contém API Key Firebase `AIzaSyCIYnU_4dW56K3xjJ_2DAw0UpMn2h8sJvE`.  
     *Classificação:* **Pública por design** (padrão de apps Android para comunicação com Firebase API Gateway).
   - **`ios/Runner/GoogleService-Info.plist`:** Contém API Key Firebase `AIzaSyBkNMK7NdA3aQFxy9A2LsrgqJr0tggnzig`.  
     *Classificação:* **Pública por design**.
   - Não foram encontrados tokens secretos de backend (ex: chaves privadas de serviço Firebase Admin SDK, chaves Stripe Secret `sk_live_...`).

3. **Supabase / Firebase Firestore & Regras de Acesso (RLS / Security Rules):**
   - **Supabase:** Não utilizado no projeto.
   - **Firebase Firestore:**
     - O app utiliza a coleção `shared_spaces/{spaceCode}`.
     - **Não há arquivo `firestore.rules` no repositório.**
     - Conforme mensagem no próprio código (`lib/services/cloud_sync_service.dart:169` e `lib/screens/market_config_screen.dart:1384`), a sincronização depende de um banco Firestore aberto onde o usuário autentica-se apenas informando o código da sala.
     - Como não há `FirebaseAuth.instance.currentUser` sendo associado nas regras, qualquer pessoa que consulte a API do Firestore do projeto `carrinho-de-compras-35ded` tem permissão de leitura e escrita (`read, write: if true`) irrestrita se o Firestore estiver configurado em modo de teste, permitindo enumeração ou modificação de dados de qualquer família.

### Tabela de Achados da Etapa 2

| Achado | Risco | Arquivo e Linha | Correção Sugerida |
| :--- | :---: | :--- | :--- |
| Ausência de autenticação do usuário e dependência de Security Rules abertas no Firestore | **Alto** | `lib/services/cloud_sync_service.dart:60-64` | Implementar autenticação anônima (`FirebaseAuth.instance.signInAnonymously()`) ou por email/social e vincular os documentos aos UIDs dos membros autorizados no `firestore.rules`. |
| Falta do arquivo de regras de segurança `firestore.rules` versionado no projeto | **Médio** | Raiz do projeto | Criar e versionar `firestore.rules` com validação de esquema de dados (tamanho de payload, tipos de campos) para impedir inserção de payloads corrompidos no Firestore. |

---

## 3. Condição de Corrida (Race Condition)

### Análise de Recursos e Concorrência

1. **Recurso de Espaço Compartilhado (`shared_spaces`):**
   - **Trecho de código:** `lib/services/shopping_controller.dart:1177-1207` e `lib/services/cloud_sync_service.dart:147-149`.
   - **Comportamento sob concorrência:**
     - O modelo lê o estado local, monta um JSON completo com toda a lista (`_buildStateMap()`) e dispara um `.set(payload, SetOptions(merge: true))`.
     - Se o Usuário A (marcando o produto "Leite" como comprado) e o Usuário B (adicionando "Café" à lista) salvarem em instâncias de segundo próximas, **a requisição que chegar por último no servidor sobrescreverá o array `items` inteiro da primeira requisição**.
     - **Não existe Lock, nem Transação Firestore (`runTransaction`), nem `FieldValue.arrayUnion`**. O resultado é o clássico problema de **Lost Update** em colaboração concorrente.
2. **Concorrência entre Home Widget e App Principal:**
   - **Trecho de código:** `lib/services/shopping_controller.dart:1152-1175` (`syncFromHomeWidget`).
   - Se o usuário interagir com o widget do iOS/Android enquanto o aplicativo em segundo plano recebe uma atualização da nuvem, os dados do widget podem sobrepor o estado recebido da nuvem antes de terem sido mesclados por timestamp.

### Tabela de Achados da Etapa 3

| Achado | Risco | Arquivo e Linha | Correção Sugerida |
| :--- | :---: | :--- | :--- |
| Sincronização monolítica sobrescreve estado concorrente (Lost Update) | **Alto** | `lib/services/shopping_controller.dart:1180-1200` | Mudar a modelagem do Firestore de "um documento único com arrays" para subcoleções (ex: `shared_spaces/{spaceCode}/items/{itemId}`), permitindo que cada item seja atualizado individualmente de forma atômica. |
| Ausência de lock ou debounce em escritas rápidas em disco/nuvem | **Médio** | `lib/services/shopping_controller.dart:1177-1207` | Implementar mecanismo de debounce no `_saveToDisk()` para evitar dezenas de I/Os e requisições concorrentes em digitações rápidas ou marcações múltiplas. |

---

## 4. Idempotência

### Análise de Webhooks e Gateways

1. **Webhooks Recebidos:**
   - **Status:** **Não verificado (Inexistente por design da arquitetura).**
   - **Motivo:** O projeto é estritamente uma aplicação cliente Flutter sem servidor backend intermediário que exponha portas HTTP para escuta de webhooks de pagamento ou de terceiros.
2. **Chamadas a Gateways de Pagamento e Idempotency Keys:**
   - **Status:** **Não verificado (Inexistente no aplicativo).**
   - **Motivo:** O aplicativo não efetua pagamentos, não possui gateways (como Stripe, Mercado Pago ou Pagar.me) e não cobra assinaturas. Sua função financeira limita-se ao escaneamento de NFC-e (leitura fiscal da SEFAZ para registro de despesas).
3. **Idempotência no Consumo de Eventos de Nuvem (Firestore Realtime):**
   - **Trecho de código:** `lib/services/shopping_controller.dart:1007-1010`
   - O controlador implementa um filtro básico de idempotência para o autor:
     ```dart
     if (data['updatedByClientId'] == _clientId) {
       return;
     }
     ```
   - No entanto, eventos repetidos ou reordenados de outros clientes não possuem controle de versão vetorial ou timestamp monótono: se um snapshot antigo chegar atrasado devido a oscilações de rede móvel, ele será aplicado cegamente sobre alterações mais novas.

### Tabela de Achados da Etapa 4

| Achado | Risco | Arquivo e Linha | Correção Sugerida |
| :--- | :---: | :--- | :--- |
| Falta de timestamp/versão lógica para descartar eventos remotos defasados | **Médio** | `lib/services/shopping_controller.dart:1004-1019` | Incluir um campo de controle de versão (ou timestamp do servidor) em cada mutação e descartar eventos recebidos cujo timestamp seja anterior ao último aplicado localmente. |

---

## 5. Separação de Responsabilidades (Arquitetura)

### Arquivos Mais Longos do Projeto

| Arquivo | Linhas | Responsabilidades Misturadas |
| :--- | :---: | :--- |
| `lib/screens/history_screen.dart` | **4.645** | **Tela (Widgets), Regras de Negócio (Estatísticas, Inflação, Comparações), Renderização Gráfica (`CustomPainter`), Câmera/OCR e Navegação Webview.** |
| `lib/screens/shopping_list_screen.dart` | **2.035** | Interface de lista, agrupamentos de ofertas (`_MarketBargainGroup`), modais de configuração de preços e animações customizadas de cabeçalho (`_WaveHeaderClipper`). |
| `lib/screens/home_screen.dart` | **1.625** | Painel analítico de métricas financeiras, gráficos de variação de preços e regras de filtro por mercado embutidas na view. |
| `lib/screens/market_config_screen.dart` | **1.399** | Configurações de mercados, interface de gerenciamento de categorias/corredores e lógica de conexão/sincronização Firebase Firestore. |
| `lib/services/shopping_controller.dart` | **1.214** | Gerenciamento de estado global, persistência de arquivo local, sincronização de background com Firestore e bridge com HomeWidget. |

### 🎯 Candidato Número 1 para Refatoração: `lib/screens/history_screen.dart`

**Diagnóstico Detalhado:**  
O arquivo possui **4.645 linhas** e é um dos casos mais extremos de arquivo monólito:
1. **Regras de Negócio / Estatística (Linhas 26-182):** A classe `ProductHistoryAggregate` realiza cálculos estatísticos avançados (médias ponderadas, rankings de mercados mais baratos, índices de variação percentual entre compras).
2. **Pintura e Gráficos de Baixo Nível (Linhas 2521-2888 e 4161-4645):** Contém estados de gráficos interativos com detecção de toque (`GestureDetector`), projeção de coordenadas e dois `CustomPainter` inteiros (`_PriceTrendLineChartPainter` e `_DualPriceComparisonChartPainter`).
3. **Telas Múltiplas no Mesmo Arquivo:** Contém `HistoryScreen`, `ProductAnalyticsScreen` e `ProductComparisonScreen` todas definidas no mesmo arquivo.
4. **Manipulação de Hardware:** Lida diretamente com chamadas de `ImagePicker`, acionamento de `ReceiptScannerService` e navegação para scanner de QR Code NFC-e.

### Tabela de Achados da Etapa 5

| Achado | Risco | Arquivo e Linha | Correção Sugerida |
| :--- | :---: | :--- | :--- |
| `history_screen.dart` com 4.645 linhas violando o princípio de responsabilidade única (SRP) | **Médio** | `lib/screens/history_screen.dart:1-4645` | Decompor o arquivo em: (1) pasta `screens/history/` com telas filhas; (2) pasta `widgets/charts/` para os painters; (3) domínio `models/` ou `services/` para o `ProductHistoryAggregate`. |
| Manipulação de arquivos locais através de caminhos manuais temporários em vez do `path_provider` | **Médio** | `lib/services/shopping_controller.dart:1102-1116` | Substituir a busca manual por pastas do sistema operacional pelo pacote oficial `path_provider` (`getApplicationDocumentsDirectory()`). |

---

## 🚀 Recomendação de Início: Qual Prompt Rodar Primeiro?

**Prompt recomendado para rodar primeiro:**  
👉 **Correção do Achado 1: Resolução do import quebrado de `firebase_options.dart` e restauração da suíte de testes.**

**Por que começar por este prompt?**  
1. **Garantia de Não-Regressão:** Na engenharia de software, qualquer refatoração estrutural (como dividir um monólito de 4.645 linhas) ou alteração de segurança/concorrência exige que a suíte de testes existente esteja ativa e verde para garantir que nada foi quebrado durante as modificações.
2. **Desbloqueio de Verificação:** Atualmente, os 3 arquivos de teste existentes sequer conseguem ser compilados. Ao isolar ou gerar o `firebase_options.dart`, você obtém imediatamente um mecanismo de validação automatizado para os passos seguintes.
