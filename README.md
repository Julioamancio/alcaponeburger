# Al Capone Burger - SaaS Delivery System

Este projeto é uma aplicação web Single Page Application (SPA) para uma hamburgueria temática, desenvolvida com React e TypeScript. O sistema possui duas interfaces distintas baseadas no nível de acesso do usuário: uma área para clientes realizarem pedidos e um painel administrativo para gestão do restaurante.

## 🔑 Credenciais de Acesso (Mock)

O sistema utiliza uma autenticação simulada para fins de demonstração. A senha é ignorada na validação.

### Acesso Administrativo (Painel de Gestão)
Para acessar o Dashboard, Pedidos e Produtos, o e-mail deve conter a palavra **"admin"**.
*   **E-mail:** `admin@alcapone.com`
*   **Senha:** `admin123` (ou qualquer outra senha)

### Acesso Cliente (Cardápio e Pedidos)
Para acessar a visão de compra, use qualquer outro e-mail.
*   **E-mail:** `cliente@email.com`
*   **Senha:** `123456` (ou qualquer outra senha)

---

## 🚀 Funcionalidades

### 👤 Área do Cliente
*   **Catálogo de Produtos:** Visualização de hambúrgueres, acompanhamentos e bebidas.
*   **Busca em Tempo Real:** Barra de pesquisa para filtrar itens por nome ou descrição.
*   **Carrinho de Compras:** Adição e remoção de itens, cálculo de subtotal e total com taxa de entrega.
*   **Checkout Simulado:** Finalização de pedidos (requer login).
*   **Histórico de Pedidos:** Acompanhamento do status dos pedidos realizados.

### 🛡️ Área Administrativa (Backoffice)
*   **Dashboard:** Métricas de vendas diárias, pedidos ativos e status das integrações.
*   **Gestão de Pedidos (Kanban):** Visualização de pedidos por colunas de status (Pendente, Preparo, Entrega, Concluído) com ação rápida para avançar o status.
*   **Catálogo de Produtos:** Listagem de itens cadastrados com status de disponibilidade.
*   **Integrações:** Tela de configuração simulada para iFood, Rappi e Uber Eats.

---

## 🛠️ Tecnologias Utilizadas

*   **React 19:** Biblioteca para construção da interface.
*   **TypeScript:** Tipagem estática para maior segurança e manutenibilidade.
*   **Tailwind CSS:** Framework de estilização utilitária (configurado via CDN no HTML).
*   **Lucide React:** Biblioteca de ícones.
*   **Vite/ESM:** Estrutura moderna de imports via ES Modules.

## 📂 Estrutura de Arquivos

*   `index.html`: Ponto de entrada da aplicação, contendo configurações do Tailwind e imports.
*   `index.tsx`: Contém toda a lógica da aplicação, componentes, rotas simuladas (state-based routing) e dados mockados.

## 🎨 Design System

O projeto utiliza um tema escuro ("Dark Mode") inspirado na estética "Speakeasy/Mafia":
*   **Cores Principais:** Preto (`#1a1a1a`), Cinza Chumbo (`#262626`) e Dourado (`#d4af37`).
*   **Tipografia:** 
    *   *Serif:* 'Playfair Display' para títulos e destaques.
    *   *Sans:* 'Inter' para textos corridos e interface.
