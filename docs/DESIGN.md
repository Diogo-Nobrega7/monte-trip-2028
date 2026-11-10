# Design system

## Direção
Bilhete de viagem + painel financeiro. A peça de identidade é o bilhete no topo do painel:
a trilha entre Natal e o destino é o progresso da arrecadação (dourado = real, marcador vazado = projeção).
Todo o resto é contido: superfícies claras, divisórias finas, um acento azul para ações.

## Cores (tokens em src/index.css, canais RGB)
| Token | Uso |
|---|---|
| navy | sidebar, bilhete, institucional |
| accent | ações, links, estado ativo, série "depositado" |
| gold | progresso, identidade, série "rendimento" |
| ok / warn / bad | situação (em dia, atenção, atraso) |
| bg / surface / raised / sunken / line | planos de profundidade |
| ink / muted / faint | texto principal, secundário, terciário |
Claro, escuro e automático via `data-theme` no `<html>`. Gráficos leem os mesmos tokens.

## Tipografia
- Display: Bricolage Grotesque (títulos, números grandes), tracking negativo.
- Texto: Schibsted Grotesk; números com `tabular-nums` (classe `num`).
- Escala: 11 / 12 / 13 / 14 / 15 / 20 / 30–34 / 44–64 px.

## Forma
Raios: sm 8, md 12, lg 16, xl 22. Sombras: sm (cartões), md (hover), lg (modais, bilhete).
Indicadores agrupados numa só superfície com divisórias, não um cartão por número.

## Componentes (src/components)
ui: Button, Card/CardHeader, Badge, Tooltip, Modal, Dropdown, Field/Input/Select, RangeField,
Segmented, Toolbar, DataTable (tabela no desktop, cartões no celular), Stat, AnimatedNumber,
ProgressBar, EmptyState, StageNotice, Skeleton, Toast.
charts: ProjectionChart, ChartTooltip, ChartLegend, tema.
patterns: ListPage, StatRow. layout: AppShell, Sidebar, UserMenu, MobileTabBar, Brand.

## Movimento
Entrada de página curta (320 ms), números que interpolam ao mudar, modal sobe da base no celular.
Tudo desativado com `prefers-reduced-motion`. Sem Framer Motion: CSS resolve sem peso extra.
