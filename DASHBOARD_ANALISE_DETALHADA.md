# Análise Completa do Dashboard de Ocorrências

## 1. LOCALIZAÇÃO E ESTRUTURA

**Arquivo Principal**: `app/admin/dashboard/page.tsx` (38.608 tokens)

Componentes-chave:
- Cliente React ('use client')
- Gráficos com ECharts
- Supabase para dados
- Sistema de filtros Cross-Filter
- Exportação Excel

---

## 2. GRÁFICO "OCORRÊNCIAS POR SEMANA"

### 2.1 Modo de Visualização
```typescript
const [weekViewMode, setWeekViewMode] = useState<'week' | 'average'>('week');

// MODO SEMANA: dados de uma semana específica (seg-sexta)
// MODO MÉDIA: média de ocorrências por dia (todas as semanas)
```

### 2.2 Dados Armazenados
```typescript
interface DayOfWeekData {
  day: string;           // "Segunda", "Terça", "Quarta", "Quinta", "Sexta"
  count: number;         // Número de ocorrências
  percentChange?: number; // Variação % em relação ao dia anterior
  date?: string;         // Data no formato YYYY-MM-DD
}

const [dayOfWeekData, setDayOfWeekData] = useState<DayOfWeekData[]>([]);
```

### 2.3 Navegação de Semanas
```typescript
const [selectedWeekStart, setSelectedWeekStart] = useState<Date>(() => {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(today);
  monday.setDate(today.getDate() + diff);
  return monday;
});

goToPreviousWeek()  // Semana anterior -7 dias
goToNextWeek()      // Próxima semana +7 dias
goToCurrentWeek()   // Volta semana atual
```

---

## 3. CARREGAMENTO DE DADOS

### 3.1 Função loadDayOfWeekData (Linhas 1161-1317)

**Modo Semana Específica:**
```typescript
if (weekViewMode === 'week') {
  // 1. Define intervalo: segunda a sexta
  const weekStart = selectedWeekStart;  
  const weekEnd = selectedWeekStart + 4 dias;
  
  // 2. Query Supabase: occurrences na semana
  SELECT occurred_at 
  FROM occurrences 
  WHERE institution_id = ID
    AND class_id IN (classIds)
    AND occurred_at BETWEEN weekStart AND weekEnd;
  
  // 3. Processa resultados:
  - Inicializa dayCount[YYYY-MM-DD] = 0 para todos 5 dias
  - Incrementa contadores para cada ocorrência
  - Calcula percentChange = ((count - prev) / prev) * 100
  
  // 4. Cria array DayOfWeekData com datas para filtro ao clicar
  dayData.push({
    day: "Segunda",
    count: 15,
    percentChange: 20,
    date: "2025-10-27"  // ← Usado para filtro specificDate
  });
}
```

**Modo Média (Linhas 1231-1312):**
```typescript
} else {
  // 1. Query TODA ocorrências do período (ano/personalizado)
  SELECT occurred_at FROM occurrences WHERE ...
  
  // 2. Para CADA ocorrência:
  - Extrai dayOfWeek (0=domingo até 6=sábado)
  - Se fim de semana, pula
  - Incrementa dayCount["Quinta"]++
  - Rastreia semana única em Set (formato: "2025-W44")
  
  // 3. Calcula MÉDIA:
  average = totalOccurrences[dia] / numeroDeSemanasUnicas[dia]
  
  // 4. Exemplo:
  - "Quinta" teve 120 ocorrências em 10 semanas
  - Média = 120 / 10 = 12 ocorrências por quinta
}
```

---

## 4. PROCESSAMENTO COM FILTROS

### 4.1 Filtros Ativos
```typescript
activeFilters = {
  month?: { value: "2025-01", label: "Janeiro" },
  class?: { value: "uuid-xxx", label: "8A" },
  student?: { value: "uuid-yyy", label: "João Silva" },
  occurrenceType?: { value: "uuid-zzz", label: "Atraso" },
  teacher?: { value: "uuid-www", label: "Prof. Maria" },
  specificDate?: { value: "2025-10-30", label: "30/10/2025" },
  dayOfWeek?: { value: "4", label: "Quinta" }
}
```

### 4.2 Aplicação dos Filtros
```typescript
// SERVIDOR (Supabase)
const applyActiveFilters = (query) => {
  if (activeFilters.month) {
    query = query.gte('occurred_at', startOfMonth)
                 .lte('occurred_at', endOfMonth);
  }
  if (activeFilters.class) {
    query = query.eq('class_id', value);
  }
  if (activeFilters.student) {
    query = query.eq('student_id', value);
  }
  // ... demais filtros
  return query;
};

// CLIENTE (JavaScript)
const filterByDayOfWeek = (data) => {
  // Para evitar problemas de timezone
  if (activeFilters.specificDate) {
    return data.filter(item => {
      const itemDate = formatDateToYYYYMMDD(item.occurred_at);
      return itemDate === activeFilters.specificDate.value;
    });
  }
  if (activeFilters.dayOfWeek) {
    const targetDay = parseInt(activeFilters.dayOfWeek.value);
    return data.filter(item => {
      return new Date(item.occurred_at).getDay() === targetDay;
    });
  }
  return data;
};
```

---

## 5. RENDERIZAÇÃO DO GRÁFICO (ECharts)

### 5.1 Configuração do Gráfico (Linhas 1797-1974)
```typescript
const dayOfWeekOption: EChartsOption = useMemo(() => {
  // 1. CORES DINÂMICAS (ranking baseado)
  const counts = dayOfWeekData.map(d => d.count);
  const sortedCounts = [...counts].sort((a, b) => a - b);
  
  const getColorForValue = (value) => {
    const percentile = sortedCounts.indexOf(value) / (length - 1);
    if (percentile >= 0.75) return '#ef4444';    // Vermelho (top 25%)
    else if (percentile >= 0.5) return '#f97316';  // Laranja
    else if (percentile >= 0.25) return '#fbbf24'; // Amarelo
    else return '#10b981';                         // Verde
  };
  
  // 2. TÍTULO
  title: {
    text: weekViewMode === 'week' 
      ? `Ocorrências da Semana (27/10 - 31/10)`
      : 'Média de Ocorrências por Dia da Semana'
  }
  
  // 3. TOOLTIP (hover)
  tooltip: {
    formatter: (params) => {
      return `<strong>Quinta</strong><br/>
              Ocorrências: 18<br/>
              <span style="color: #ef4444">Variação: +25%</span><br/>
              Data: 31/10/2025`;
    }
  }
  
  // 4. EIXOS
  xAxis: { type: 'category', data: ['Seg', 'Ter', 'Qua', 'Qui', 'Sex'] }
  yAxis: { type: 'value', name: 'Ocorrências' }
  
  // 5. BARRAS COM CORES E LABELS
  series: [{
    type: 'bar',
    data: dayOfWeekData.map((d) => ({
      value: d.count,
      itemStyle: {
        color: getColorForValue(d.count),
        borderRadius: [8, 8, 0, 0]
      },
      label: {
        show: true,
        formatter: `15\n↑ +25%`  // Valor + variação
      }
    }))
  }]
}, [dayOfWeekData, weekViewMode, selectedWeekStart]);
```

### 5.2 Renderização JSX (Linhas 2773-2889)
```jsx
<div className="bg-white rounded-lg p-6">
  {/* Toggle Semana / Média */}
  <button onClick={() => setWeekViewMode('week')}>Semana</button>
  <button onClick={() => setWeekViewMode('average')}>Média</button>
  
  {/* Controles navegação semana */}
  {weekViewMode === 'week' && (
    <>
      <button onClick={goToPreviousWeek}>← Anterior</button>
      <button onClick={goToCurrentWeek}>Semana Atual</button>
      <button onClick={goToNextWeek}>Próxima →</button>
      <input type="date" onChange={handleDateSelect} />
    </>
  )}
  
  {/* Legenda de cores */}
  🟢 Menos  🟡 Baixo  🟠 Médio  🔴 Mais
  
  {/* Gráfico ECharts */}
  <ReactECharts
    option={dayOfWeekOption}
    style={{ height: '400px' }}
    onEvents={{ click: onDayOfWeekChartClick }}
  />
</div>
```

---

## 6. INTERATIVIDADE (Clique no Gráfico)

### 6.1 Função onDayOfWeekChartClick (Linhas 426-465)
```typescript
const onDayOfWeekChartClick = useCallback((params) => {
  const dayName = params.name;      // "Quinta"
  const dataIndex = params.dataIndex; // 3 (índice no array)
  
  if (weekViewMode === 'week') {
    // MODO SEMANA: Filtrar por data específica
    const clickedDayData = dayOfWeekData[dataIndex];
    if (clickedDayData?.date) {  // "2025-10-30"
      if (activeFilters.dayOfWeek) {
        removeFilter('dayOfWeek');  // Remove dia genérico se houver
      }
      addFilter('specificDate', "2025-10-30", "30/10/2025");
      // Agora activeFilters.specificDate está definido
    }
  } else {
    // MODO MÉDIA: Filtrar por dia da semana genérico
    const dayMap = { 'Segunda': 1, 'Terça'
