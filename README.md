# 🛒 Carrinho de Compras Inteligente

Um aplicativo Flutter completo para gerenciamento inteligente de listas de supermercado, comparação de preços entre mercados, controle de gastos mensais, leitura de cupons fiscais via QR Code/NFC-e e sincronização familiar na nuvem.

---

## ✨ Principais Funcionalidades

### 🏠 1. Tela Inicial (Início)
- **Resumo de Gastos do Mês**: Acompanhamento automático do total gasto no mês atual, quantidade de compras realizadas e comparativo percentual em relação ao mês anterior.
- **Maiores Variações Recentes**: Carrossel destacando os produtos que mais caíram ou subiram de preço nas suas últimas compras.
- **Análise por Produto**: Busca e listagem de todos os itens já comprados com:
  - Menor preço histórico e em qual mercado foi encontrado.
  - Preço médio e último preço pago.
  - Gráfico interativo de evolução de preços por data e mercado.

### 📝 2. Lista de Compras
- **Adição Rápida e Inteligente**:
  - Digite um único item ou **cole uma lista inteira** (várias linhas ou separada por vírgulas) de uma só vez.
  - Reconhecimento automático de quantidades e unidades (ex.: `2kg Arroz`, `3x Leite`) e categorização automática (Hortifruti, Laticínios, Açougue, Limpeza, etc.).
  - Sugestões automáticas baseadas no seu histórico de compras enquanto você digita.
- **Onde Comprar Mais Barato (Guia de Economia)**:
  - O app cruza os itens da sua lista atual com o histórico de preços e agrupa intuitivamente **quais produtos estão mais baratos em cada mercado**, exibindo o percentual de economia.
- **Configuração Rápida por Item**:
  - Toque em qualquer item da lista para abrir o painel de edição de preço unitário, quantidade, unidade, categoria, mercado e visualizar o comparativo histórico daquele produto em outros mercados.
- **Finalização de Compra**:
  - Salva os itens precificados diretamente no histórico do mercado selecionado e limpa ou atualiza a lista para a próxima compra.

### 🧾 3. Histórico de Compras e Scanner de Nota Fiscal
- **Histórico por Mercado**: Visualize todas as compras passadas filtradas por supermercado, com data, valor total e detalhamento completo dos itens comprados.
- **Importação via QR Code da NFC-e (SEFAZ com In-App WebView e Extração Automática)**:
  - Escaneie o QR Code impresso no cupom com a câmera do celular (com mira laser e lanterna) ou cole o link / chave de 44 dígitos.
  - O portal oficial da Fazenda do estado correspondente é aberto em um **In-App WebView seguro** (`webview_flutter`).
  - **Suporte Nativo a Captcha**: Caso a SEFAZ exija verificação anti-robô (*"Não sou um robô"* / reCAPTCHA / Cloudflare), o usuário confirma diretamente na tela.
  - Um canal JavaScript injetado (`MutationObserver` + `JavaScriptChannel`) monitora o carregamento da tabela de produtos no DOM. No instante em que os itens são exibidos, o app extrai automaticamente nomes, preços e mercado, fechando o navegador e preenchendo a compra sem esforço manual.
- **Scanner de Cupom Fiscal por Foto (OCR com Google ML Kit)**:
  - Fotografe ou selecione a imagem do cupom impresso para ler produtos e preços por visão computacional direto no chip do celular (100% offline, dispensando conexão com portais da SEFAZ).
- **Integração com a Despensa**: Envie com um clique todos os itens comprados diretamente para a sua Despensa Inteligente para controle de estoque e consumo.
- **Reaproveitamento de Compras**: Adicione itens de compras anteriores de volta para sua lista atual com um toque.

### 🏪 4. Mercados e Família (Sincronização)
- **Gerenciamento de Mercados**: Cadastre, edite, reordene ou remova os supermercados que você frequenta, com suporte a localização (GPS) e endereço.
- **Compartilhamento em Família (Supabase)**:
  - Crie ou entre em um grupo familiar usando um código de convite.
  - Sincronize em tempo real a lista de compras, mercados cadastrados e histórico de preços entre todos os membros da família.

### 🎨 5. Experiência Visual e Personalização
- **Splash Screen Animada**: Animação vetorial fluida na inicialização do aplicativo.
- **Modo Claro e Modo Escuro (Dark/Light Mode)**: Alternância rápida de tema disponível no canto superior direito de todas as telas, com persistência automática da preferência do usuário.

---

## 🛠️ Tecnologias Utilizadas

- **Flutter & Dart** (Material 3)
- **Webview Flutter** (`webview_flutter`) — Consulta oficial da SEFAZ com resolução de Captchas e extração DOM
- **Mobile Scanner** (`mobile_scanner`) — Leitura de QR Code de notas fiscais (NFC-e)
- **Google ML Kit Text Recognition** (`google_mlkit_text_recognition`) — OCR offline de cupons impressos
- **Firebase Core & Firestore** (`cloud_firestore`, `firebase_core`) — Sincronização em nuvem e persistência
- **Geolocator** (`geolocator`) — Localização de supermercados
- **Shared Preferences** (`shared_preferences`) — Persistência local offline-first

---

## 🚀 Como Executar o Projeto

1. Certifique-se de ter o [Flutter SDK](https://docs.flutter.dev/get-started/install) instalado.
2. Instale as dependências do projeto:
   ```bash
   flutter pub get
   ```
3. Execute o aplicativo em um dispositivo ou emulador conectado:
   ```bash
   flutter run
   ```
