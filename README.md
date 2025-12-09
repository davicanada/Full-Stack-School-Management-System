# Sistema de Gestão de Ocorrências Escolares

Sistema completo desenvolvido em Next.js 14 com TypeScript para gerenciar ocorrências disciplinares, pedagógicas e administrativas em instituições de ensino.

## 🚀 Tecnologias Utilizadas

- **Next.js 14** - Framework React com App Router
- **TypeScript** - Tipagem estática para JavaScript
- **Tailwind CSS** - Framework de CSS utilitário
- **Supabase** - Backend-as-a-Service (autenticação e banco de dados)
- **ESLint** - Linter para qualidade de código

## 📦 Instalação

```bash
# Clone o repositório
cd gestao-escolar

# Instale as dependências
npm install

# Configure as variáveis de ambiente
# As credenciais do Supabase já estão configuradas no .env.local

# Execute em modo de desenvolvimento
npm run dev
```

## 🌐 Acesso

O sistema estará disponível em: http://localhost:3000

## 🎨 Funcionalidades da Interface

### Página Inicial
- **Header responsivo** com nome do sistema e ícone educacional
- **Botão de Login** - Abre modal para autenticação
- **Botão Solicitar Acesso** - Formulário para novos usuários
- **Cards informativos** sobre funcionalidades do sistema
- **Design responsivo** que adapta a diferentes dispositivos
- **Modo escuro** suportado

### Modais Interativos
- **Modal de Login** - Formulário com email e senha
- **Modal de Solicitação** - Cadastro completo com validações

## 📁 Estrutura do Projeto

```
gestao-escolar/
├── app/                    # Páginas do App Router
│   ├── page.tsx           # Página inicial
│   ├── layout.tsx         # Layout base
│   └── globals.css        # Estilos globais
├── components/             # Componentes reutilizáveis
├── lib/                   # Utilitários e configurações
│   └── supabase/          # Configuração do Supabase
│       └── client.ts      # Cliente Supabase
├── database/              # 🗄️ Database architecture & SQL
│   ├── README.md         # Complete database documentation
│   ├── schema.sql        # Full database schema
│   ├── migrations/       # Versioned database migrations
│   │   ├── 001_database_architecture_fixes.sql
│   │   └── 002_trash_system.sql
│   └── examples/         # SQL query examples
│       └── queries.sql   # Advanced analytics & reporting queries
├── types/                 # Tipos TypeScript
│   └── index.ts          # Interfaces do sistema
├── .env.local            # Variáveis de ambiente
└── package.json          # Dependências do projeto
```

## 🗄️ Database Architecture

This project features a **production-ready PostgreSQL database** with advanced features:

### Key Features
- **Multi-tenant architecture** supporting multiple institutions
- **Row Level Security (RLS)** for data isolation and security
- **Soft delete system** (trash/recycle bin) with audit trails
- **23 strategic indexes** for optimal query performance
- **Advanced SQL patterns**: CTEs, window functions, complex joins

### Database Highlights
- 9 core tables with comprehensive relationships
- 20+ RLS policies for role-based access control
- Helper functions for common operations
- Materialized views for analytics
- Full audit trail system

### SQL Skills Demonstrated
- Complex JOIN operations and aggregations
- Window functions (RANK, LAG, PERCENT_RANK)
- Common Table Expressions (CTEs)
- Subqueries and derived tables
- Index optimization strategies
- Query performance tuning
- Data validation and quality checks

**📖 Full Documentation**: See [database/README.md](./database/README.md) for complete schema documentation, ER diagrams, and example queries.

## 🔧 Scripts Disponíveis

```bash
# Desenvolvimento
npm run dev

# Build de produção
npm run build

# Iniciar produção
npm start

# Linting
npm run lint
```

## 📋 Próximos Passos

1. **Implementar autenticação** com Supabase Auth
2. **Criar dashboard** para diferentes tipos de usuários
3. **Desenvolver CRUD** de ocorrências
4. **Implementar sistema de notificações**
5. **Criar relatórios e analytics**
6. **Adicionar testes unitários**

## 🎯 Tipos de Usuários

- **Admin** - Controle total do sistema
- **Coordenador** - Gestão de ocorrências e relatórios
- **Professor** - Registro de ocorrências dos alunos

## 🔐 Segurança

- Autenticação JWT via Supabase
- Controle de acesso baseado em roles
- Validação de dados no frontend e backend
- Proteção contra ataques CSRF

## 📱 Responsividade

O sistema foi desenvolvido com design mobile-first, garantindo uma experiência otimizada em:
- **Desktop** (1024px+)
- **Tablet** (768px - 1023px)  
- **Mobile** (até 767px)

---

Desenvolvido com ❤️ usando as melhores práticas de desenvolvimento web moderno.
