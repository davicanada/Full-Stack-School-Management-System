# 🧪 Guia Completo de Testes - Sistema de Gestão Escolar

**Data:** 2025-12-10
**Status:** Atualizado com segurança de senhas e testes automatizados

---

## 📋 **Índice**

1. [Configuração Inicial](#1-configuração-inicial)
2. [Testes Automatizados](#2-testes-automatizados)
3. [Testes Manuais da Aplicação](#3-testes-manuais-da-aplicação)
4. [Migração de Senhas](#4-migração-de-senhas)
5. [Verificação de Segurança](#5-verificação-de-segurança)
6. [Troubleshooting](#6-troubleshooting)

---

## 1. Configuração Inicial

### 1.1 Configurar Variáveis de Ambiente

**Criar arquivo `.env.local`:**

```bash
# Copiar o exemplo
cp .env.example .env.local
```

**Editar `.env.local`** com suas credenciais do Supabase:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-chave-anon-aqui

# Para migração de senhas (opcional)
SUPABASE_SERVICE_ROLE_KEY=sua-chave-service-role-aqui
```

**Como obter as credenciais:**
1. Acesse https://supabase.com/dashboard
2. Selecione seu projeto
3. Vá em Settings → API
4. Copie:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon/public key` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role key` → `SUPABASE_SERVICE_ROLE_KEY` (apenas para migração)

### 1.2 Instalar Dependências

```bash
npm install
```

**Verificar instalação:**
```bash
npm list bcryptjs jest ts-jest @testing-library/react
```

Deve mostrar:
```
├── bcryptjs@3.0.3
├── jest@30.2.0
├── ts-jest@29.4.6
└── @testing-library/react@16.3.0
```

---

## 2. Testes Automatizados

### 2.1 Rodar Todos os Testes

```bash
npm test
```

**Output esperado:**
```
PASS lib/auth/__tests__/password.test.ts
  Password Utilities
    hashPassword
      ✓ should hash a password successfully
      ✓ should generate different hashes for the same password
      ...

Test Suites: 1 passed, 1 total
Tests:       42 passed, 42 total
Snapshots:   0 total
Time:        17.026 s
```

### 2.2 Testes com Cobertura

```bash
npm run test:coverage
```

**Ver relatório de cobertura:**
```bash
# Abre o relatório HTML no navegador
open coverage/lcov-report/index.html   # macOS
xdg-open coverage/lcov-report/index.html   # Linux
start coverage/lcov-report/index.html  # Windows
```

### 2.3 Modo Watch (Desenvolvimento)

```bash
npm run test:watch
```

**Comandos no watch mode:**
- `a` - Rodar todos os testes
- `f` - Rodar apenas testes que falharam
- `p` - Filtrar por nome do arquivo
- `t` - Filtrar por nome do teste
- `q` - Sair

### 2.4 Testes Específicos

**Rodar apenas testes de senha:**
```bash
npm test password.test.ts
```

**Rodar teste específico:**
```bash
npm test -- -t "should hash a password successfully"
```

---

## 3. Testes Manuais da Aplicação

### 3.1 Iniciar o Servidor de Desenvolvimento

```bash
npm run dev
```

**Output esperado:**
```
▲ Next.js 14.2.32
- Local:        http://localhost:3000
- Network:      http://192.168.x.x:3000

✓ Ready in 2.3s
```

### 3.2 Acessar a Aplicação

Abra no navegador: **http://localhost:3000**

---

### 3.3 Teste 1: Landing Page

**URL:** `http://localhost:3000`

**Verificar:**
- [ ] Página carrega sem erros
- [ ] Botões de login visíveis
- [ ] Modais de registro funcionam
- [ ] Design responsivo

**Ações:**
1. Clique em "Login"
2. Clique em "Solicitar Acesso como Admin"
3. Clique em "Solicitar Acesso como Professor"
4. Verifique que modais abrem/fecham corretamente

---

### 3.4 Teste 2: Login como Master

**Usuário Master Padrão:**
- Email: `master@sistema.com`
- Senha: `senha123`

**Passos:**
1. Acesse `http://localhost:3000`
2. Clique em "Login"
3. Digite as credenciais acima
4. Clique em "Entrar"

**Verificar:**
- [ ] Login bem-sucedido
- [ ] Redirecionado para `/master`
- [ ] Dashboard master carrega
- [ ] Menu de navegação visível
- [ ] Sem erros no console

**⚠️ IMPORTANTE:**
- Se o login **NÃO funcionar**, a senha pode estar em texto plano no banco
- Neste caso, você precisa rodar a migração (ver seção 4)

---

### 3.5 Teste 3: Criar Novo Usuário (Master)

**Como Master, aprovar uma solicitação:**

1. Vá para "Solicitações de Acesso"
2. Verifique se há solicitações pendentes
3. Clique em "Aprovar" em uma solicitação

**Verificar no Banco de Dados:**
```sql
SELECT email, password_hash
FROM users
WHERE email = 'email-do-novo-usuario@escola.com';
```

**✅ Deve mostrar:**
```
email                          | password_hash
-------------------------------|------------------------------------------
novo@usuario.com               | $2b$12$KIXQQk5Y8gJ5kF5Y8gJ5kO...
```

**❌ Se mostrar:**
```
password_hash: senha123  (texto plano)
```
→ **Problema!** O código não está usando hash. Verifique o commit fa3b8d4.

---

### 3.6 Teste 4: Login com Usuário Novo

**Após criar um novo admin/professor:**

1. Faça logout (ou abra janela anônima)
2. Tente fazer login com:
   - Email: email do novo usuário
   - Senha: `senha123` (senha padrão)

**Verificar:**
- [ ] Login funciona
- [ ] Redirecionado para dashboard correto
- [ ] Sem erros no console

---

### 3.7 Teste 5: Funcionalidades por Role

#### **Como Master:**
- [ ] Ver todas as solicitações
- [ ] Aprovar/rejeitar admins
- [ ] Aprovar/rejeitar professores
- [ ] Ver todos os usuários
- [ ] Ver todas as instituições

#### **Como Admin:**
- [ ] Ver dashboard da instituição
- [ ] Gerenciar alunos (CRUD)
- [ ] Gerenciar turmas (CRUD)
- [ ] Gerenciar professores
- [ ] Aprovar professores da sua instituição
- [ ] Ver/Criar tipos de ocorrências
- [ ] Ver dashboard de ocorrências

#### **Como Professor:**
- [ ] Ver dashboard
- [ ] Registrar ocorrências
- [ ] Ver ocorrências registradas por ele
- [ ] Filtrar ocorrências (turma, tipo, data)
- [ ] ❌ NÃO pode gerenciar alunos/turmas

---

### 3.8 Teste 6: Fluxo Completo de Registro

**Registrar um novo professor:**

1. **Como usuário não autenticado:**
   - Clique em "Solicitar Acesso como Professor"
   - Preencha o formulário:
     - Nome: "João Silva"
     - Email: "joao@escola.com"
     - Instituição: Selecione uma existente
   - Envie o formulário

2. **Como Admin da instituição:**
   - Faça login
   - Vá para "Professores" → aba "Pendentes"
   - Veja a solicitação de "João Silva"
   - Clique em "Aprovar"

3. **Como João Silva:**
   - Faça login com:
     - Email: joao@escola.com
     - Senha: senha123
   - Verifique acesso ao dashboard de professor

**Verificar:**
- [ ] Solicitação criada
- [ ] Admin vê solicitação pendente
- [ ] Aprovação cria usuário
- [ ] Senha é hashada (`$2b$12$...`)
- [ ] Login funciona
- [ ] Redirecionamento correto

---

### 3.9 Teste 7: Gestão de Alunos

**Como Admin:**

1. Vá para "Alunos"
2. Clique em "Adicionar Aluno"
3. Preencha o formulário
4. Salve

**Verificar:**
- [ ] Aluno criado
- [ ] Aparece na lista
- [ ] Pode editar
- [ ] Pode transferir de turma
- [ ] Pode mover para lixeira
- [ ] Pode restaurar da lixeira

**Testar Importação Excel:**
1. Clique em "Importar Excel"
2. Selecione um arquivo .xlsx com colunas:
   - nome
   - data_nascimento (YYYY-MM-DD)
   - numero_matricula
   - turma_id (opcional)
3. Importe

**Verificar:**
- [ ] Alunos importados
- [ ] Dados corretos
- [ ] Sem duplicatas

---

### 3.10 Teste 8: Dashboard de Ocorrências

**Como Admin:**

1. Vá para "Dashboard"
2. Selecione ano letivo

**Verificar:**
- [ ] Gráficos carregam
- [ ] KPIs mostram números corretos
- [ ] Filtros funcionam (por turma, tipo, data)
- [ ] Gráficos responsivos (mobile/desktop)

**Tipos de Gráficos:**
- [ ] Ocorrências por turma (barras)
- [ ] Ocorrências por aluno (top 10)
- [ ] Ocorrências por tipo/gravidade
- [ ] Tendência mensal (waterfall)
- [ ] Distribuição por dia da semana

---

### 3.11 Teste 9: Registro de Ocorrências

**Como Professor:**

1. Vá para "Registrar Ocorrência"
2. Selecione:
   - Turma
   - Tipo de ocorrência
   - Data/Hora
   - Alunos (pode selecionar múltiplos)
   - Descrição
3. Salve

**Verificar:**
- [ ] Ocorrência criada
- [ ] Aparece em "Minhas Ocorrências"
- [ ] Aparece no dashboard do admin
- [ ] Notificações funcionam (toast)

---

## 4. Migração de Senhas

**⚠️ IMPORTANTE:** Execute apenas se tiver usuários com senhas em texto plano!

### 4.1 Verificar se Precisa Migrar

**Consulta SQL:**
```sql
SELECT
  email,
  password_hash,
  CASE
    WHEN password_hash ~ '^\$2[aby]\$\d{2}\$.{53}$' THEN 'Hashed ✓'
    ELSE 'Plain Text ✗'
  END as status
FROM users
LIMIT 10;
```

**Se ver "Plain Text ✗", você precisa migrar!**

### 4.2 Dry-Run (Testar Sem Alterar)

```bash
npm run migrate:passwords:dry-run
```

**Output esperado:**
```
🔍 DRY RUN MODE - No changes will be made

📊 Current State:
   Total users: 5
   ✅ Already hashed: 0
   📝 Need migration: 5
   ⚠️  No password: 0

📋 Users that would be migrated:
   1. master@sistema.com
   2. admin@escola.com
   3. professor@escola.com
   ...
```

### 4.3 Executar Migração REAL

**⚠️ ATENÇÃO:** Isso altera o banco de dados!

```bash
npm run migrate:passwords
```

**Output esperado:**
```
🔐 Starting password migration...
✅ Connected to Supabase

📊 Found 5 users
📝 Users needing migration: 5

🔄 Processing batch 1 (5 users)...
  🔐 Hashing password for master@sistema.com...
  ✅ master@sistema.com - migrated successfully
  ✅ admin@escola.com - migrated successfully
  ...

============================================================
📊 MIGRATION SUMMARY
✅ Successfully migrated: 5 users
❌ Failed migrations: 0 users
🎉 Migration completed successfully!
```

### 4.4 Verificar Pós-Migração

**Consulta SQL:**
```sql
SELECT
  email,
  LEFT(password_hash, 20) as hash_preview,
  CASE
    WHEN password_hash ~ '^\$2[aby]\$\d{2}\$.{53}$' THEN 'OK ✓'
    ELSE 'ERROR ✗'
  END as status
FROM users;
```

**Todos devem mostrar "OK ✓"**

**Testar Login:**
1. Tente fazer login com todos os usuários
2. Use a mesma senha de antes (ex: `senha123`)
3. Login deve funcionar normalmente

---

## 5. Verificação de Segurança

### 5.1 Verificar Hashing

**Console do navegador (F12):**
```javascript
// Isso NÃO deve mostrar senhas em texto plano
console.log(localStorage.getItem('user'))
```

**Deve mostrar:**
```json
{
  "id": "...",
  "email": "user@escola.com",
  "role": "admin"
  // SEM campo de senha!
}
```

### 5.2 Verificar no Banco de Dados

**Todas as senhas devem estar hashadas:**
```sql
SELECT
  COUNT(*) as total,
  SUM(CASE WHEN password_hash ~ '^\$2[aby]\$' THEN 1 ELSE 0 END) as hashed,
  SUM(CASE WHEN password_hash !~ '^\$2[aby]\$' THEN 1 ELSE 0 END) as plain_text
FROM users;
```

**Resultado esperado:**
```
total | hashed | plain_text
------|--------|------------
  10  |   10   |     0
```

**❌ Se plain_text > 0:** Você tem senhas inseguras! Execute a migração.

### 5.3 Verificar Network Tab

**Ao fazer login:**
1. Abra DevTools (F12)
2. Vá na aba "Network"
3. Faça login
4. Verifique as requisições

**✅ A senha NÃO deve aparecer hashada na requisição** (só no banco)
**✅ A senha deve ser enviada em texto plano via HTTPS**
**✅ O response NÃO deve incluir password_hash**

---

## 6. Troubleshooting

### Problema: Login não funciona após migração

**Causa:** Senha incorreta ou migração falhou

**Solução:**
1. Verificar no banco se senha está hashada:
   ```sql
   SELECT email, password_hash FROM users WHERE email = 'seu@email.com';
   ```
2. Se não estiver hashada, rodar migração novamente
3. Se estiver hashada mas login falha, verificar console do browser

### Problema: "Module not found" ao rodar testes

**Causa:** Dependências não instaladas

**Solução:**
```bash
npm install
```

### Problema: "SUPABASE_URL is required"

**Causa:** Variáveis de ambiente não configuradas

**Solução:**
1. Criar `.env.local` baseado no `.env.example`
2. Adicionar credenciais do Supabase
3. Reiniciar servidor (`npm run dev`)

### Problema: Testes falham com "bcrypt error"

**Causa:** Usando `bcrypt` ao invés de `bcryptjs`

**Solução:**
```bash
npm uninstall bcrypt
npm install bcryptjs
```

### Problema: "Cannot read property 'password_hash'"

**Causa:** Usuário não existe no banco

**Solução:**
1. Verificar se usuário existe:
   ```sql
   SELECT * FROM users WHERE email = 'email@teste.com';
   ```
2. Se não existir, criar manualmente ou via interface

### Problema: Build falha com erro TypeScript

**Causa:** Tipos incorretos

**Solução:**
```bash
npm run build -- --no-lint
```

---

## 📊 Checklist de Testes Completo

### Configuração ✓
- [ ] `.env.local` criado e configurado
- [ ] `npm install` executado com sucesso
- [ ] Servidor dev inicia sem erros
- [ ] Testes automatizados passam (42/42)

### Segurança ✓
- [ ] Senhas hashadas no banco ($2b$12$...)
- [ ] Login funciona com senhas hashadas
- [ ] Novos usuários criados com hash
- [ ] Migração executada (se necessário)

### Funcionalidades ✓
- [ ] Login master/admin/professor funciona
- [ ] CRUD de alunos funciona
- [ ] CRUD de turmas funciona
- [ ] CRUD de professores funciona
- [ ] Registro de ocorrências funciona
- [ ] Dashboard de ocorrências funciona
- [ ] Sistema de lixeira funciona
- [ ] Importação Excel funciona

### Performance ✓
- [ ] Páginas carregam em < 2s
- [ ] Sem erros no console
- [ ] Sem warnings críticos
- [ ] Responsivo mobile/desktop

---

## 🎯 Resumo Rápido

**Para começar a testar AGORA:**

```bash
# 1. Configurar ambiente
cp .env.example .env.local
# Edite .env.local com suas credenciais Supabase

# 2. Instalar dependências
npm install

# 3. Rodar testes automatizados
npm test

# 4. Iniciar aplicação
npm run dev

# 5. Acessar no navegador
# http://localhost:3000

# 6. Login como master
# Email: master@sistema.com
# Senha: senha123

# 7. Se login não funcionar, migrar senhas
npm run migrate:passwords
```

---

**Última atualização:** 2025-12-10
**Versão:** 2.0 (com segurança de senhas e testes)
**Status:** ✅ Pronto para uso
