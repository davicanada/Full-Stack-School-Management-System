# 🗑️ Sistema de Lixeira - Implementação Completa

**Data:** 27 de Outubro de 2025
**Status:** ✅ Implementado para Professores

---

## 📋 Resumo

Foi implementado um sistema completo de lixeira (soft delete avançado) para o gerenciamento de professores, permitindo que administradores removam professores da lista principal sem perder dados históricos, com possibilidade de restauração.

---

## ✅ O que foi Implementado

### **1. Banco de Dados**
📄 Arquivo: `database-trash-system.sql`

- ✅ Campos `deleted_at` e `deleted_by` adicionados nas tabelas `users` e `students`
- ✅ Índices criados para melhor performance
- ✅ Funções SQL auxiliares:
  - `move_user_to_trash()` - Move usuário para lixeira
  - `restore_user_from_trash()` - Restaura usuário da lixeira
  - `move_student_to_trash()` - Move aluno para lixeira
  - `restore_student_from_trash()` - Restaura aluno da lixeira
  - `cleanup_old_trash()` - Limpa registros antigos (opcional)
- ✅ Views criadas: `active_users`, `trashed_users`, `active_students`, `trashed_students`
- ✅ Políticas RLS atualizadas (apenas Master pode deletar permanentemente)

### **2. Tipos TypeScript**
📄 Arquivo: `types/index.ts`

- ✅ Interfaces `User`, `Usuario`, `Teacher` e `Student` atualizadas com:
  ```typescript
  deleted_at?: string | null;
  deleted_by?: string | null;
  ```

### **3. Página de Professores**
📄 Arquivo: `app/admin/professores/page.tsx`

#### **3.1 Estados e Queries**
- ✅ Estado `trashedTeachers` adicionado
- ✅ Query `fetchTeachers()` modificada para **excluir** lixeira (`.is('users.deleted_at', null)`)
- ✅ Nova query `fetchTrashedTeachers()` para buscar **apenas** lixeira

#### **3.2 Novas Funções**
```typescript
handleMoveToTrash()      // Move professor para lixeira
handleRestoreFromTrash() // Restaura professor da lixeira
```

#### **3.3 Função Modificada**
```typescript
handleRemoveFromInstitution() // APENAS Master pode deletar permanentemente
  - Verifica role do usuário
  - Conta ocorrências e turmas relacionadas
  - Mostra avisos sobre dados que serão afetados
  - Requer confirmação dupla
```

#### **3.4 Interface (UI)**
- ✅ **3 Tabs:** Ativos | Pendentes | 🗑️ Lixeira
- ✅ **Botões na Lista Ativa:**
  - ⏸️ Ativar/Desativar (todos)
  - 🗑️ Mover para Lixeira (todos)
  - ❌ Deletar Permanentemente (apenas Master)
- ✅ **Botões na Lixeira:**
  - ↩️ Restaurar (todos)
  - ❌ Deletar Permanentemente (apenas Master)

---

## 🎯 Fluxo de Uso

### **Para ADMINISTRADORES:**

1. **Professor ativo** na lista principal
   - Pode **Desativar** (professor continua visível, mas inativo)
   - Pode **Mover para Lixeira** (professor desaparece da lista)

2. **Professor na lixeira**
   - Pode **Restaurar** (volta para lista como INATIVO)
   - ❌ NÃO pode deletar permanentemente

### **Para MASTER:**

1. **Professor ativo** na lista principal
   - Pode **Desativar**
   - Pode **Mover para Lixeira**
   - Pode **Deletar Permanentemente** (com avisos)

2. **Professor na lixeira**
   - Pode **Restaurar**
   - Pode **Deletar Permanentemente** (com avisos duplos)

---

## 🔒 Segurança Implementada

### **1. Controle de Permissões**
- ✅ Deleção permanente **restrita a Master** (verificação no código)
- ✅ Política RLS no banco também restringe deleção permanente
- ✅ Admins tentando deletar permanentemente recebem mensagem de erro

### **2. Verificações Antes de Deletar**
```javascript
// Conta dados relacionados
const { count: occurrenceCount } = await supabase
  .from('occurrences')
  .select('*', { count: 'exact', head: true })
  .eq('recorded_by', userId);

const { count: classCount } = await supabase
  .from('classes')
  .select('*', { count: 'exact', head: true })
  .eq('teacher_id', userId);
```

### **3. Confirmações em Cascata**
1. **Primeira confirmação:** Mostra quantidade de dados relacionados
2. **Segunda confirmação:** Aviso final de irreversibilidade
3. **Execução:** Deleção permanente

---

## 📊 Diferenças Entre Estados

| Estado | Visível na Lista | Pode Fazer Login | Pode Restaurar | Dados Preservados |
|--------|------------------|------------------|----------------|-------------------|
| **Ativo** ✅ | Sim | Sim | - | Sim |
| **Inativo** ⏸️ | Sim (com badge) | Não | - | Sim |
| **Lixeira** 🗑️ | Não (tab separada) | Não | Sim | Sim |
| **Deletado** ❌ | Não | Não | **Não** | **Não** |

---

## 🚀 Próximos Passos

### **IMPORTANTE - Execute ANTES de usar:**
1. ✅ Executar `database-trash-system.sql` no Supabase
   - Vá no Supabase → SQL Editor
   - Cole o conteúdo do arquivo
   - Execute

### **Pendente de Implementação:**
1. ⏳ Sistema de lixeira para **Alunos** (mesma lógica)
2. ⏳ Verificação de email duplicado com opção de restaurar
3. ⏳ Testes completos do fluxo

---

## 📝 Casos de Uso

### **Caso 1: Professor sai da escola**
```
1. Admin clica em "Mover para Lixeira"
2. Professor desaparece da lista principal
3. Professor aparece na aba "Lixeira"
4. Dados (ocorrências, turmas) preservados
```

### **Caso 2: Professor volta à escola**
```
1. Admin acessa aba "Lixeira"
2. Encontra o professor
3. Clica em "Restaurar"
4. Professor volta para lista como INATIVO
5. Admin ativa o professor
```

### **Caso 3: Master precisa deletar permanentemente**
```
1. Master move professor para lixeira (recomendado)
2. Acessa aba "Lixeira"
3. Clica em "Deletar Permanentemente"
4. Sistema avisa sobre X ocorrências relacionadas
5. Confirmação dupla necessária
6. Dados removidos definitivamente
```

---

## 🎨 Interface Visual

### **Tab de Lixeira**
```
┌────────────────────────────────────────────────────────┐
│ 🗑️ Lixeira                                      (3)    │
├────────────────────────────────────────────────────────┤
│ ℹ️ Professores removidos mas que podem ser restaurados │
├────────────────────────────────────────────────────────┤
│                                                         │
│ Professor      | Turmas | Ocorrências | Removido em    │
│ ─────────────────────────────────────────────────────  │
│ João Silva     | 2      | 15          | 15/10/2025    │
│                            [↩️ Restaurar] [❌ Deletar]  │
│                                                         │
└────────────────────────────────────────────────────────┘
```

---

## 🔧 Manutenção

### **Limpeza Automática (Opcional)**
Para deletar automaticamente registros na lixeira há mais de 90 dias:

```sql
SELECT * FROM cleanup_old_trash(90);
```

### **Consultas Úteis**

```sql
-- Ver quantidade na lixeira
SELECT COUNT(*) FROM users WHERE deleted_at IS NOT NULL;

-- Ver quem deletou
SELECT u.name, u.email, d.name as deleted_by_name, u.deleted_at
FROM users u
LEFT JOIN users d ON u.deleted_by = d.id
WHERE u.deleted_at IS NOT NULL;

-- Ver professores com muitas ocorrências na lixeira
SELECT u.name, COUNT(o.id) as ocorrencias
FROM users u
LEFT JOIN occurrences o ON o.recorded_by = u.id
WHERE u.deleted_at IS NOT NULL
GROUP BY u.id, u.name
HAVING COUNT(o.id) > 0
ORDER BY ocorrencias DESC;
```

---

## ✅ Checklist Final

- [x] Script SQL criado
- [x] Tipos TypeScript atualizados
- [x] Queries modificadas
- [x] Funções de lixeira implementadas
- [x] Função de restaurar implementada
- [x] Restrição Master implementada
- [x] Interface de 3 tabs criada
- [x] Botões condicionais por role
- [x] Avisos e confirmações
- [ ] **Script SQL executado no Supabase** ⚠️ PENDENTE
- [ ] Testes de fluxo completo
- [ ] Aplicar mesma lógica para Alunos

---

## 📞 Suporte

Se tiver dúvidas ou problemas:
1. Verifique se o script SQL foi executado
2. Verifique permissões RLS no Supabase
3. Confira logs no console do navegador

---

**Implementado com ❤️ pela Claude Code**
