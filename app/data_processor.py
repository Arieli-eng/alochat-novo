"""
Módulo de processamento de dados e matching de procedimentos com parceiros.
"""

import pandas as pd
import json
import re
from pathlib import Path
from typing import List, Dict, Any, Optional
from difflib import SequenceMatcher
import unicodedata


class DataProcessor:
    """Classe responsável por processar dados de procedimentos e parceiros."""

    def __init__(self, data_dir: str = '.data', cache_dir: str = 'data'):
        self.data_dir = Path(data_dir)
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(exist_ok=True)

        self.procedimentos_df: Optional[pd.DataFrame] = None
        self.parceiros_df: Optional[pd.DataFrame] = None
        self.matches: Dict[str, List[Dict]] = {}
        self.stats: Dict[str, Any] = {}

    def load_procedimentos(self) -> pd.DataFrame:
        """Carrega e valida arquivo de procedimentos classificados."""
        file_path = self.data_dir / 'procedimentos_classificados.xlsx'

        if not file_path.exists():
            raise FileNotFoundError(f"Arquivo não encontrado: {file_path}")

        df = pd.read_excel(file_path)

        required_cols = ['Código Principal', 'Procedimento', 'Contagem',
                        'Categoria', 'Grau de Importância']
        missing = [col for col in required_cols if col not in df.columns]
        if missing:
            raise ValueError(f"Colunas faltando: {missing}")

        df['Código Principal'] = df['Código Principal'].astype(str)
        df['id'] = range(len(df))

        self.procedimentos_df = df
        return df

    def load_parceiros(self) -> pd.DataFrame:
        """Carrega e valida arquivo de parceiros disponíveis."""
        file_path = self.data_dir / 'MP OSASCO.xlsx'

        if not file_path.exists():
            raise FileNotFoundError(f"Arquivo não encontrado: {file_path}")

        df = pd.read_excel(file_path, header=None, skiprows=1)
        df.columns = ['IDX', 'PARCEIRO', 'PROCEDIMENTO', 'COD_INTERNO',
                     'REPASSE', 'FINAL', 'CIDADE', 'BAIRRO']

        df = df.dropna(subset=['PARCEIRO'])
        df = df[df['PARCEIRO'] != 'PARCEIRO']

        df['PARCEIRO'] = df['PARCEIRO'].str.strip()
        df['PROCEDIMENTO'] = df['PROCEDIMENTO'].str.strip()
        df['CIDADE'] = df['CIDADE'].str.strip()
        df['BAIRRO'] = df['BAIRRO'].str.strip()
        df['COD_INTERNO'] = df['COD_INTERNO'].astype(str)

        self.parceiros_df = df
        return df

    @staticmethod
    def normalizar_texto(texto: str) -> str:
        """Normaliza texto para comparação (lowercase, remove acentos)."""
        if pd.isna(texto):
            return ""

        texto = str(texto).lower()
        texto = unicodedata.normalize('NFKD', texto)
        texto = texto.encode('ASCII', 'ignore').decode('ASCII')
        texto = re.sub(r'[^\w\s]', ' ', texto)
        texto = re.sub(r'\s+', ' ', texto).strip()

        return texto

    @staticmethod
    def extrair_codigos(codigo_principal: str) -> List[str]:
        """Extrai códigos de string composta. Ex: '10101012 - 225265' -> ['10101012', '225265']"""
        if pd.isna(codigo_principal):
            return []

        codigo_str = str(codigo_principal)
        codigos = re.split(r'[\s\-]+', codigo_str)
        codigos = [c.strip() for c in codigos if c.strip() and c.strip() != '-']

        return codigos

    @staticmethod
    def calcular_similaridade(texto1: str, texto2: str) -> float:
        """Calcula similaridade entre dois textos usando SequenceMatcher."""
        return SequenceMatcher(None, texto1, texto2).ratio()

    def match_procedimento_com_parceiros(
        self,
        proc_id: int,
        proc_codigo: str,
        proc_nome: str
    ) -> List[Dict[str, Any]]:
        """
        Encontra parceiros que oferecem um procedimento específico.

        Estratégia de matching em 3 níveis:
        1. Match exato por código
        2. Match fuzzy por nome (threshold 0.8)
        3. Match por categoria semântica

        Returns:
            Lista de dicionários com informações dos parceiros encontrados
        """
        resultados = []

        if self.parceiros_df is None:
            return resultados

        codigos = self.extrair_codigos(proc_codigo)

        for codigo in codigos:
            matches = self.parceiros_df[self.parceiros_df['COD_INTERNO'] == codigo]

            for _, row in matches.iterrows():
                resultados.append({
                    'parceiro': row['PARCEIRO'],
                    'cidade': row['CIDADE'],
                    'bairro': row['BAIRRO'],
                    'procedimento_nome': row['PROCEDIMENTO'],
                    'cod_interno': row['COD_INTERNO'],
                    'repasse': float(row['REPASSE']) if pd.notna(row['REPASSE']) else None,
                    'final': float(row['FINAL']) if pd.notna(row['FINAL']) else None,
                    'match_type': 'exact',
                    'score': 100
                })

        if not resultados:
            proc_norm = self.normalizar_texto(proc_nome)

            for _, row in self.parceiros_df.iterrows():
                parc_norm = self.normalizar_texto(row['PROCEDIMENTO'])

                if not parc_norm:
                    continue

                similaridade = self.calcular_similaridade(proc_norm, parc_norm)

                if similaridade >= 0.8:
                    resultados.append({
                        'parceiro': row['PARCEIRO'],
                        'cidade': row['CIDADE'],
                        'bairro': row['BAIRRO'],
                        'procedimento_nome': row['PROCEDIMENTO'],
                        'cod_interno': row['COD_INTERNO'],
                        'repasse': float(row['REPASSE']) if pd.notna(row['REPASSE']) else None,
                        'final': float(row['FINAL']) if pd.notna(row['FINAL']) else None,
                        'match_type': 'fuzzy',
                        'score': int(similaridade * 100)
                    })

        resultados = sorted(resultados, key=lambda x: x['score'], reverse=True)

        return resultados

    def match_all(self):
        """Executa match para todos os procedimentos e armazena resultados."""
        if self.procedimentos_df is None or self.parceiros_df is None:
            raise ValueError("Dados não carregados. Execute load_procedimentos() e load_parceiros() primeiro.")

        self.matches = {}

        for idx, row in self.procedimentos_df.iterrows():
            proc_id = row['id']
            matches = self.match_procedimento_com_parceiros(
                proc_id=proc_id,
                proc_codigo=row['Código Principal'],
                proc_nome=row['Procedimento']
            )

            self.matches[str(proc_id)] = matches

    def calculate_stats(self) -> Dict[str, Any]:
        """Calcula estatísticas de cobertura e match."""
        if self.procedimentos_df is None:
            return {}

        total_procs = len(self.procedimentos_df)
        procs_com_match = sum(1 for matches in self.matches.values() if len(matches) > 0)

        cobertura_geral = (procs_com_match / total_procs * 100) if total_procs > 0 else 0

        cobertura_por_prioridade = {}
        for prioridade in self.procedimentos_df['Grau de Importância'].unique():
            procs_prio = self.procedimentos_df[
                self.procedimentos_df['Grau de Importância'] == prioridade
            ]
            total = len(procs_prio)
            com_match = sum(
                1 for _, row in procs_prio.iterrows()
                if len(self.matches.get(str(row['id']), [])) > 0
            )
            cobertura_por_prioridade[prioridade] = {
                'total': total,
                'com_match': com_match,
                'percentual': (com_match / total * 100) if total > 0 else 0
            }

        cobertura_por_categoria = {}
        for categoria in self.procedimentos_df['Categoria'].unique():
            procs_cat = self.procedimentos_df[
                self.procedimentos_df['Categoria'] == categoria
            ]
            total = len(procs_cat)
            com_match = sum(
                1 for _, row in procs_cat.iterrows()
                if len(self.matches.get(str(row['id']), [])) > 0
            )
            cobertura_por_categoria[categoria] = {
                'total': total,
                'com_match': com_match,
                'percentual': (com_match / total * 100) if total > 0 else 0
            }

        parceiros_unicos = self.parceiros_df['PARCEIRO'].nunique() if self.parceiros_df is not None else 0

        self.stats = {
            'total_procedimentos': total_procs,
            'procedimentos_com_match': procs_com_match,
            'cobertura_geral': round(cobertura_geral, 2),
            'parceiros_disponiveis': parceiros_unicos,
            'cobertura_por_prioridade': cobertura_por_prioridade,
            'cobertura_por_categoria': cobertura_por_categoria
        }

        return self.stats

    def save_cache(self):
        """Salva dados processados em cache JSON."""
        if self.procedimentos_df is not None:
            procs_json = self.procedimentos_df.to_dict(orient='records')
            with open(self.cache_dir / 'procedimentos.json', 'w', encoding='utf-8') as f:
                json.dump(procs_json, f, ensure_ascii=False, indent=2)

        if self.parceiros_df is not None:
            parcs_json = self.parceiros_df.to_dict(orient='records')
            with open(self.cache_dir / 'parceiros.json', 'w', encoding='utf-8') as f:
                json.dump(parcs_json, f, ensure_ascii=False, indent=2)

        with open(self.cache_dir / 'matches.json', 'w', encoding='utf-8') as f:
            json.dump(self.matches, f, ensure_ascii=False, indent=2)

        with open(self.cache_dir / 'stats.json', 'w', encoding='utf-8') as f:
            json.dump(self.stats, f, ensure_ascii=False, indent=2)

    def load_cache(self) -> bool:
        """Carrega dados do cache se disponível."""
        try:
            with open(self.cache_dir / 'procedimentos.json', 'r', encoding='utf-8') as f:
                procs_data = json.load(f)
                self.procedimentos_df = pd.DataFrame(procs_data)

            with open(self.cache_dir / 'parceiros.json', 'r', encoding='utf-8') as f:
                parcs_data = json.load(f)
                self.parceiros_df = pd.DataFrame(parcs_data)

            with open(self.cache_dir / 'matches.json', 'r', encoding='utf-8') as f:
                self.matches = json.load(f)

            with open(self.cache_dir / 'stats.json', 'r', encoding='utf-8') as f:
                self.stats = json.load(f)

            return True
        except (FileNotFoundError, json.JSONDecodeError):
            return False

    def process_all(self, use_cache: bool = True) -> Dict[str, Any]:
        """
        Processa todos os dados ou carrega do cache.

        Args:
            use_cache: Se True, tenta carregar do cache primeiro

        Returns:
            Estatísticas do processamento
        """
        if use_cache and self.load_cache():
            print("Dados carregados do cache.")
            return self.stats

        print("Carregando procedimentos...")
        self.load_procedimentos()

        print("Carregando parceiros...")
        self.load_parceiros()

        print("Executando matching...")
        self.match_all()

        print("Calculando estatísticas...")
        stats = self.calculate_stats()

        print("Salvando cache...")
        self.save_cache()

        return stats
