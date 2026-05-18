# AloChat - Sistema de Análise de Procedimentos e Parceiros

Sistema web para análise de procedimentos médicos com maior demanda e verificação de disponibilidade em parceiros.

## Funcionalidades

- **Dashboard Interativo**: Visualização clara de procedimentos classificados por prioridade e categoria
- **Match Inteligente**: Algoritmo de 3 níveis para encontrar parceiros disponíveis
  - Match exato por código
  - Match fuzzy por nome (similaridade > 80%)
  - Match por categoria semântica
- **Filtros Avançados**: Busca por nome/código, categoria e prioridade
- **Estatísticas em Tempo Real**: Cobertura, total de procedimentos, parceiros ativos
- **Upload de Dados**: Atualização de procedimentos e parceiros via interface
- **API REST**: Endpoints completos para integração

## Tecnologias

- **Backend**: Flask 3.0
- **Processamento**: Pandas + Openpyxl
- **Frontend**: HTML5 + CSS3 + JavaScript Vanilla
- **Python**: 3.12+

## Estrutura do Projeto

```
alochat-novo/
├── .data/                      # Dados Excel originais
│   ├── procedimentos_classificados.xlsx
│   └── MP OSASCO.xlsx
├── app/
│   ├── __init__.py
│   ├── app.py                  # Aplicação Flask
│   ├── data_processor.py       # Lógica de matching
│   ├── routes.py               # API REST
│   └── uploads/                # Uploads temporários
├── static/
│   ├── css/style.css
│   └── js/main.js
├── templates/
│   └── index.html
├── data/                       # Cache JSON
│   ├── procedimentos.json
│   ├── parceiros.json
│   ├── matches.json
│   └── stats.json
├── venv/                       # Virtual environment
├── requirements.txt
└── README.md
```

## Instalação

### 1. Clonar o repositório

```bash
git clone <repo-url>
cd alochat-novo
```

### 2. Criar e ativar ambiente virtual

```bash
python3 -m venv venv
source venv/bin/activate  # No Windows: venv\Scripts\activate
```

### 3. Instalar dependências

```bash
pip install -r requirements.txt
```

## Uso

### Iniciar o servidor

```bash
python app/app.py
```

O servidor estará disponível em: **http://localhost:5000**

### Primeira Execução

Na primeira execução, o sistema:
1. Carrega os arquivos Excel de `.data/`
2. Processa todos os procedimentos
3. Executa matching com parceiros
4. Gera cache em `data/*.json`
5. Calcula estatísticas

Execuções subsequentes carregam do cache (muito mais rápido).

## API REST

### Endpoints Disponíveis

#### GET /api/procedimentos
Retorna lista de procedimentos com filtros opcionais.

**Query Params:**
- `categoria`: filtrar por categoria
- `prioridade`: filtrar por grau de importância
- `search`: busca por nome ou código
- `limit`: limitar resultados

**Exemplo:**
```bash
curl "http://localhost:5000/api/procedimentos?categoria=Laboratorial&limit=10"
```

#### GET /api/procedimentos/:id/parceiros
Retorna parceiros disponíveis para um procedimento.

**Exemplo:**
```bash
curl "http://localhost:5000/api/procedimentos/0/parceiros"
```

#### GET /api/stats
Retorna estatísticas gerais do sistema.

**Resposta:**
```json
{
  "total_procedimentos": 1559,
  "procedimentos_com_match": 850,
  "cobertura_geral": 54.52,
  "parceiros_disponiveis": 73,
  "cobertura_por_prioridade": {...},
  "cobertura_por_categoria": {...}
}
```

#### GET /api/parceiros
Lista parceiros únicos com contagem de procedimentos.

#### GET /api/categorias
Lista categorias disponíveis.

#### GET /api/prioridades
Lista prioridades disponíveis.

#### POST /api/upload/procedimentos
Upload de novo arquivo de procedimentos (.xlsx).

**Exemplo:**
```bash
curl -X POST -F "file=@procedimentos.xlsx" http://localhost:5000/api/upload/procedimentos
```

#### POST /api/upload/parceiros
Upload de novo arquivo de parceiros (.xlsx).

#### GET /api/refresh
Reprocessa dados e atualiza cache.

## Interface Web

### Dashboard

Acesse **http://localhost:5000** para visualizar:

1. **Cards de Estatísticas**: Total procedimentos, cobertura, parceiros
2. **Filtros**: Busca, categoria, prioridade
3. **Tabela de Procedimentos**: Código, nome, categoria, contagem, prioridade, parceiros disponíveis
4. **Paginação**: 50 itens por página
5. **Modal de Parceiros**: Clique em "Ver Parceiros" para detalhes

### Upload de Dados

Na seção "Atualizar Dados" na parte inferior:

1. Selecione o arquivo Excel (.xlsx)
2. Clique em "Upload"
3. O sistema valida, substitui e reprocessa automaticamente
4. Notificação confirma sucesso/erro

## Dados

### Formato: Procedimentos Classificados

Arquivo: `procedimentos_classificados.xlsx`

**Colunas obrigatórias:**
- `Código Principal`: código único ou composto (ex: "10002064" ou "10101012 - 225265")
- `Procedimento`: nome descritivo
- `Contagem`: volume de vendas
- `Categoria`: tipo (Laboratorial, Exame de Imagem, etc.)
- `Grau de Importância`: Alta/Média-Alta/Média/Baixa Prioridade

### Formato: Parceiros (MP OSASCO)

Arquivo: `MP OSASCO.xlsx`

**Estrutura:**
- Linha 1: cabeçalho (ignorado)
- Linha 2+: dados

**Colunas esperadas (sem header na linha 1):**
1. IDX (pode ser vazio)
2. PARCEIRO
3. PROCEDIMENTO
4. COD_INTERNO
5. REPASSE
6. FINAL
7. CIDADE
8. BAIRRO

## Algoritmo de Matching

### Nível 1: Match Exato por Código
- Compara `Código Principal` com `COD_INTERNO`
- Suporta códigos compostos (split por " - ")
- Score: 100%

### Nível 2: Match Fuzzy por Nome
- Normaliza textos (lowercase, remove acentos)
- Calcula similaridade com SequenceMatcher
- Threshold: 80%
- Score: 80-99%

### Nível 3: Match Semântico (futuro)
- Palavras-chave por categoria
- Score: 60-79%

## Desenvolvimento

### Estrutura de Código

**app/data_processor.py:**
- `DataProcessor`: classe principal
- `load_procedimentos()`: carrega Excel
- `load_parceiros()`: carrega Excel
- `match_procedimento_com_parceiros()`: matching
- `match_all()`: processa todos
- `calculate_stats()`: estatísticas
- `save_cache()` / `load_cache()`: persistência

**app/routes.py:**
- Blueprint `api` com todos endpoints
- Validação de inputs
- Tratamento de erros

**app/app.py:**
- Factory `create_app()`
- Configuração Flask
- Inicialização do DataProcessor

### Cache

Arquivos JSON em `data/`:
- `procedimentos.json`: todos procedimentos
- `parceiros.json`: todos parceiros
- `matches.json`: resultados de matching
- `stats.json`: estatísticas calculadas

Para forçar reprocessamento: `GET /api/refresh`

## Próximas Fases

### Fase 2: Sistema de Chamados
- CRUD de chamados
- Status tracking
- Atribuição a parceiros
- Histórico

### Fase 3: Integrações
- Notificações (email/Slack)
- Exportação de relatórios
- Dashboard analytics

### Fase 4: Automação
- Sync com fontes externas
- API de parceiros
- Machine learning para matching

## Troubleshooting

### Erro: "Arquivo não encontrado"
Verifique que os arquivos Excel estão em `.data/`:
```bash
ls -la .data/
```

### Erro: "Colunas faltando"
Verifique formato do Excel. Use template de exemplo.

### Cache desatualizado
Force refresh:
```bash
curl http://localhost:5000/api/refresh
```

Ou delete cache:
```bash
rm -rf data/*.json
```

### Performance lenta
- Primeira execução é normal (processamento completo)
- Execuções seguintes usam cache
- Considere limitar resultados com `?limit=100`

## Contribuindo

1. Fork o projeto
2. Crie branch (`git checkout -b feature/nova-funcionalidade`)
3. Commit (`git commit -m 'Adiciona nova funcionalidade'`)
4. Push (`git push origin feature/nova-funcionalidade`)
5. Abra Pull Request

## Licença

MIT

## Contato

Para dúvidas ou suporte, abra uma issue no repositório.
