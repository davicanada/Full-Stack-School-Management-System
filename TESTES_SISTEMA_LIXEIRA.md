# 🧪 Plano de Testes - Sistema de Lixeira

**Data:** 27 de Outubro de 2025
**Objetivo:** Validar funcionamento completo do sistema de lixeira antes de aplicar para alunos

---

## ⚙️ PRÉ-REQUISITOS

Antes de começar os testes, certifique-se que:

- [ ] Script `database-trash-system.sql` foi executado no Supabase
- [ ] Aplicação está rodando localmente (`npm run dev`)
- [ ] Você tem acesso como **Admin**
- [ ] Você tem acesso como **Master**
- [ ] Existe pelo menos 1 professor cadastrado

---

## 🧪 SUITE DE TESTES

### **TESTE 1: Verificar Estrutura do Banco** ✅

**Objetivo:** Confirmar que os campos foram criados corretamente

**Passos:**
1. Abra o Supabase → Table Editor
2. Selecione a tabela `users`
3. Verifique se existem as colunas:
   - `deleted_at` (timestamp, nullable)
   - `deleted_by` (uuid, nullable)

**Resultado Esperado:**
- ✅ Colunas existem e estão configuradas corretamente

**Status:** [ ] Passou  [ ] Falhou
**Observações:** _____________________

---

### **TESTE 2: Mover Professor para Lixeira (Admin)** 🗑️

**Objetivo:** Validar que admin pode mover professor para lixeira

**Passos:**
1. Login como **Admin**
2. Acesse "Gerenciar Professores"
3. Na lista de professores ativos, escolha um professor
4. Clique no botão 🗑️ (Mover para lixeira)
5. Confirme a ação

**Resultado Esperado:**
- ✅ Toast de sucesso: "Professor foi movido para a lixeira"
- ✅ Professor desaparece da lista "Professores Ativos"
- ✅ Contador de professores ativos diminui em 1
- ✅ Tab "🗑️ Lixeira" mostra badge com contador (1)

**Status:** [ ] Passou  [ ] Falhou
**Observações:** _____________________

---

### **TESTE 3: Visualizar Lixeira** 👁️

**Objetivo:** Validar que a tab de lixeira funciona corretamente

**Passos:**
1. Ainda logado como **Admin**
2. Clique na tab "🗑️ Lixeira"

**Resultado Esperado:**
- ✅ Tab abre corretamente
- ✅ Professor movido no TESTE 2 aparece na lista
- ✅ Mostra quantidade de turmas e ocorrências
- ✅ Mostra data de remoção
- ✅ Botão "Restaurar" está visível
- ✅ Botão "Deletar Permanentemente" **NÃO** está visível (apenas para Master)

**Status:** [ ] Passou  [ ] Falhou
**Observações:** _____________________

---

### **TESTE 4: Verificar Banco de Dados** 🔍

**Objetivo:** Confirmar que os dados foram marcados corretamente no banco

**Passos:**
1. Abra Supabase → SQL Editor
2. Execute a query:
```sql
SELECT id, name, email, deleted_at, deleted_by, is_active
FROM users
WHERE deleted_at IS NOT NULL
ORDER BY deleted_at DESC
LIMIT 5;
```

**Resultado Esperado:**
- ✅ Professor do TESTE 2 aparece na lista
- ✅ Campo `deleted_at` tem timestamp válido
- ✅ Campo `deleted_by` tem UUID do admin que executou a ação
- ✅ Campo `is_active` = `false`

**Status:** [ ] Passou  [ ] Falhou
**Observações:** _____________________

---

### **TESTE 5: Restaurar Professor da Lixeira** ↩️

**Objetivo:** Validar que admin pode restaurar professor

**Passos:**
1. Ainda logado como **Admin**
2. Na tab "🗑️ Lixeira"
3. Clique no botão "Restaurar" do professor
4. Confirme a ação

**Resultado Esperado:**
- ✅ Toast de sucesso: "Professor foi restaurado e está INATIVO"
- ✅ Professor desaparece da lixeira
- ✅ Contador da lixeira diminui em 1
- ✅ Professor aparece na tab "Professores Ativos"
- ✅ Professor está com status "Inativo" (badge vermelho)

**Status:** [ ] Passou  [ ] Falhou
**Observações:** _____________________

---

### **TESTE 6: Verificar Restauração no Banco** 🔍

**Objetivo:** Confirmar que restauração limpou os campos

**Passos:**
1. Execute no Supabase:
```sql
SELECT id, name, email, deleted_at, deleted_by, is_active
FROM users
WHERE name = 'NOME_DO_PROFESSOR_TESTADO'
LIMIT 1;
```

**Resultado Esperado:**
- ✅ Campo `deleted_at` = `NULL`
- ✅ Campo `deleted_by` = `NULL`
- ✅ Campo `is_active` = `false` (restaura como inativo)

**Status:** [ ] Passou  [ ] Falhou
**Observações:** _____________________

---

### **TESTE 7: Reativar Professor Restaurado** ▶️

**Objetivo:** Validar que professor restaurado pode ser reativado

**Passos:**
1. Na lista de professores ativos
2. Encontre o professor restaurado (com badge "Inativo")
3. Clique no botão ▶️ (Play - Reativar)
4. Confirme

**Resultado Esperado:**
- ✅ Toast de sucesso: "Professor reativado com sucesso!"
- ✅ Badge muda de "Inativo" (vermelho) para "Ativo" (verde)
- ✅ Ícone do botão muda de ▶️ para ⏸️

**Status:** [ ] Passou  [ ] Falhou
**Observações:** _____________________

---

### **TESTE 8: Admin NÃO Pode Deletar Permanentemente** 🚫

**Objetivo:** Validar restrição de segurança

**Passos:**
1. Mova o professor para lixeira novamente (repetir TESTE 2)
2. Vá para tab "🗑️ Lixeira"
3. Observe os botões disponíveis

**Resultado Esperado:**
- ✅ Botão "Restaurar" está visível
- ✅ Botão "Deletar Permanentemente" **NÃO** está visível

**Status:** [ ] Passou  [ ] Falhou
**Observações:** _____________________

---

### **TESTE 9: Master Pode Ver Botão Deletar** 👑

**Objetivo:** Validar que Master tem permissões extras

**Passos:**
1. Logout do Admin
2. Login como **Master**
3. Acesse "Gerenciar Professores"
4. Vá para tab "🗑️ Lixeira"

**Resultado Esperado:**
- ✅ Botão "Restaurar" está visível
- ✅ Botão "Deletar Permanentemente" **ESTÁ VISÍVEL** (vermelho)

**Status:** [ ] Passou  [ ] Falhou
**Observações:** _____________________

---

### **TESTE 10: Avisos Antes de Deletar (Master)** ⚠️

**Objetivo:** Validar que sistema avisa sobre dados relacionados

**Passos:**
1. Logado como **Master**
2. Na lixeira, escolha um professor que tenha ocorrências
3. Clique em "Deletar Permanentemente"
4. Leia a primeira mensagem de confirmação
5. Clique em "Cancelar"

**Resultado Esperado:**
- ✅ Primeira confirmação mostra:
  - Nome do professor
  - Quantidade de turmas (se houver)
  - Quantidade de ocorrências (se houver)
  - Aviso que ocorrências ficarão sem autor
  - Recomendação para usar lixeira ao invés de deletar
- ✅ Professor NÃO é deletado ao cancelar

**Status:** [ ] Passou  [ ] Falhou
**Observações:** _____________________

---

### **TESTE 11: Deleção Permanente (Master)** ❌

**Objetivo:** Validar deleção permanente completa

**⚠️ ATENÇÃO:** Este teste é destrutivo! Use um professor de teste.

**Passos:**
1. Logado como **Master**
2. Na lixeira, escolha um professor de TESTE (sem dados importantes)
3. Clique em "Deletar Permanentemente"
4. Confirme a primeira mensagem
5. Confirme a segunda mensagem ("ÚLTIMA CONFIRMAÇÃO")

**Resultado Esperado:**
- ✅ Toast de sucesso: "Professor foi removido PERMANENTEMENTE do sistema"
- ✅ Professor desaparece da lixeira
- ✅ Contador da lixeira diminui

**Status:** [ ] Passou  [ ] Falhou
**Observações:** _____________________

---

### **TESTE 12: Verificar Deleção no Banco** 🔍

**Objetivo:** Confirmar que registro foi removido do banco

**Passos:**
1. Execute no Supabase:
```sql
SELECT id, name, email
FROM users
WHERE name = 'NOME_DO_PROFESSOR_DELETADO'
LIMIT 1;
```

**Resultado Esperado:**
- ✅ Nenhum registro encontrado (0 rows)
- ✅ Professor foi permanentemente removido

**Status:** [ ] Passou  [ ] Falhou
**Observações:** _____________________

---

### **TESTE 13: Queries Filtram Lixeira Corretamente** 🔍

**Objetivo:** Validar que professores na lixeira não aparecem em queries normais

**Passos:**
1. Mova 2 professores para lixeira
2. Execute no Supabase:
```sql
-- Deve retornar apenas ativos (sem lixeira)
SELECT COUNT(*) as ativos
FROM users u
JOIN user_institutions ui ON u.id = ui.user_id
WHERE ui.role = 'professor'
AND u.deleted_at IS NULL;

-- Deve retornar apenas lixeira
SELECT COUNT(*) as na_lixeira
FROM users u
JOIN user_institutions ui ON u.id = ui.user_id
WHERE ui.role = 'professor'
AND u.deleted_at IS NOT NULL;
```

**Resultado Esperado:**
- ✅ Query 1 retorna apenas professores ativos (não conta lixeira)
- ✅ Query 2 retorna apenas professores na lixeira
- ✅ Soma das duas = total de professores

**Status:** [ ] Passou  [ ] Falhou
**Observações:** _____________________

---

### **TESTE 14: Performance com Índices** 🚀

**Objetivo:** Validar que índices foram criados

**Passos:**
1. Execute no Supabase:
```sql
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'users'
AND indexname LIKE '%deleted%';
```

**Resultado Esperado:**
- ✅ Índice `idx_users_deleted_at` existe
- ✅ Índice `idx_users_institution_deleted` existe (se aplicável)

**Status:** [ ] Passou  [ ] Falhou
**Observações:** _____________________

---

### **TESTE 15: Cenário Completo de Fluxo** 🔄

**Objetivo:** Validar fluxo completo do ciclo de vida

**Passos:**
1. Crie um novo professor "João Teste" (via solicitação/aprovação)
2. Registre 2 ocorrências com esse professor
3. Como Admin: Desative o professor
4. Como Admin: Mova para lixeira
5. Como Admin: Restaure da lixeira
6. Como Admin: Reative o professor
7. Como Admin: Mova para lixeira novamente
8. Como Master: Delete permanentemente

**Resultado Esperado:**
- ✅ Todas as etapas funcionam sem erros
- ✅ Status e badges atualizam corretamente
- ✅ Ocorrências ficam órfãs após deleção
- ✅ Toasts de sucesso em cada ação

**Status:** [ ] Passou  [ ] Falhou
**Observações:** _____________________

---

## 📊 RESUMO DOS TESTES

| # | Teste | Passou | Falhou |
|---|-------|--------|--------|
| 1 | Estrutura do Banco | [ ] | [ ] |
| 2 | Mover para Lixeira (Admin) | [ ] | [ ] |
| 3 | Visualizar Lixeira | [ ] | [ ] |
| 4 | Verificar Banco (Mover) | [ ] | [ ] |
| 5 | Restaurar da Lixeira | [ ] | [ ] |
| 6 | Verificar Banco (Restaurar) | [ ] | [ ] |
| 7 | Reativar Professor | [ ] | [ ] |
| 8 | Admin NÃO Deleta | [ ] | [ ] |
| 9 | Master Vê Botão Deletar | [ ] | [ ] |
| 10 | Avisos de Deleção | [ ] | [ ] |
| 11 | Deleção Permanente | [ ] | [ ] |
| 12 | Verificar Banco (Deletado) | [ ] | [ ] |
| 13 | Queries Filtradas | [ ] | [ ] |
| 14 | Performance/Índices | [ ] | [ ] |
| 15 | Fluxo Completo | [ ] | [ ] |

---

## ✅ CRITÉRIO DE APROVAÇÃO

Para aprovar o sistema e aplicar para alunos:
- **Mínimo:** 13/15 testes passando (86%)
- **Ideal:** 15/15 testes passando (100%)

**Testes CRÍTICOS** (não podem falhar):
- TESTE 2: Mover para lixeira
- TESTE 5: Restaurar
- TESTE 8: Restrição Admin
- TESTE 11: Deleção permanente

---

## 🐛 RELATÓRIO DE BUGS

Se algum teste falhar, documente aqui:

### Bug #1
- **Teste:** _______
- **Descrição:** _______
- **Passos para reproduzir:** _______
- **Erro exibido:** _______

### Bug #2
- **Teste:** _______
- **Descrição:** _______
- **Passos para reproduzir:** _______
- **Erro exibido:** _______

---

## 🎯 PRÓXIMOS PASSOS

- [ ] Execute todos os 15 testes
- [ ] Documente resultados
- [ ] Se ≥13 testes passarem → **Aplicar sistema para Alunos**
- [ ] Se <13 testes passarem → Corrigir bugs primeiro

---

**Testador:** _______________
**Data:** _______________
**Resultado Final:** [ ] Aprovado  [ ] Reprovado
**Observações Finais:** _______________________
