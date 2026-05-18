"""
Rotas e endpoints da API REST.
"""

from flask import Blueprint, jsonify, request, current_app
from werkzeug.utils import secure_filename
import os
from pathlib import Path

api = Blueprint('api', __name__, url_prefix='/api')


@api.route('/procedimentos', methods=['GET'])
def get_procedimentos():
    """
    GET /api/procedimentos
    Retorna lista de procedimentos com filtros opcionais.

    Query params:
        - categoria: filtrar por categoria
        - prioridade: filtrar por grau de importância
        - cidade: filtrar procedimentos disponíveis em uma cidade
        - bairro: filtrar procedimentos disponíveis em um bairro
        - limit: limitar número de resultados
        - search: busca por nome ou código
    """
    processor = current_app.config['DATA_PROCESSOR']

    if processor.procedimentos_df is None:
        return jsonify({'error': 'Dados não carregados'}), 500

    df = processor.procedimentos_df.copy()

    categoria = request.args.get('categoria')
    if categoria:
        df = df[df['Categoria'] == categoria]

    prioridade = request.args.get('prioridade')
    if prioridade:
        df = df[df['Grau de Importância'] == prioridade]

    search = request.args.get('search')
    if search:
        search_lower = search.lower()
        mask = (
            df['Procedimento'].str.lower().str.contains(search_lower, na=False) |
            df['Código Principal'].astype(str).str.contains(search_lower, na=False)
        )
        df = df[mask]

    cidade = request.args.get('cidade')
    bairro = request.args.get('bairro')

    if cidade or bairro:
        proc_ids_com_localizacao = set()

        for proc_id, matches in processor.matches.items():
            for match in matches:
                cidade_match = cidade and match.get('cidade') == cidade
                bairro_match = bairro and match.get('bairro') == bairro

                if cidade and not bairro:
                    if cidade_match:
                        proc_ids_com_localizacao.add(int(proc_id))
                        break
                elif cidade and bairro:
                    if cidade_match and bairro_match:
                        proc_ids_com_localizacao.add(int(proc_id))
                        break
                elif bairro:
                    if bairro_match:
                        proc_ids_com_localizacao.add(int(proc_id))
                        break

        df = df[df['id'].isin(proc_ids_com_localizacao)]

    limit = request.args.get('limit', type=int)
    if limit:
        df = df.head(limit)

    df_enriched = df.copy()
    df_enriched['num_parceiros'] = df_enriched['id'].apply(
        lambda x: len(processor.matches.get(str(x), []))
    )

    if cidade or bairro:
        df_enriched['num_parceiros_regiao'] = df_enriched['id'].apply(
            lambda x: len([
                m for m in processor.matches.get(str(x), [])
                if (not cidade or m.get('cidade') == cidade) and
                   (not bairro or m.get('bairro') == bairro)
            ])
        )

    result = df_enriched.to_dict(orient='records')

    return jsonify({
        'total': len(result),
        'procedimentos': result
    })


@api.route('/procedimentos/<int:proc_id>/parceiros', methods=['GET'])
def get_parceiros_by_procedimento(proc_id):
    """
    GET /api/procedimentos/:id/parceiros
    Retorna parceiros disponíveis para um procedimento específico.
    """
    processor = current_app.config['DATA_PROCESSOR']

    matches = processor.matches.get(str(proc_id), [])

    return jsonify({
        'procedimento_id': proc_id,
        'total_parceiros': len(matches),
        'parceiros': matches
    })


@api.route('/stats', methods=['GET'])
def get_stats():
    """
    GET /api/stats
    Retorna estatísticas gerais do sistema.
    """
    processor = current_app.config['DATA_PROCESSOR']

    if not processor.stats:
        processor.calculate_stats()

    return jsonify(processor.stats)


@api.route('/parceiros', methods=['GET'])
def get_parceiros():
    """
    GET /api/parceiros
    Retorna lista de parceiros únicos com contagem de procedimentos.
    """
    processor = current_app.config['DATA_PROCESSOR']

    if processor.parceiros_df is None:
        return jsonify({'error': 'Dados não carregados'}), 500

    parceiros_grouped = processor.parceiros_df.groupby('PARCEIRO').agg({
        'PROCEDIMENTO': 'count',
        'CIDADE': 'first',
        'BAIRRO': 'first'
    }).reset_index()

    parceiros_grouped.columns = ['parceiro', 'num_procedimentos', 'cidade', 'bairro']

    result = parceiros_grouped.to_dict(orient='records')

    return jsonify({
        'total': len(result),
        'parceiros': result
    })


@api.route('/categorias', methods=['GET'])
def get_categorias():
    """
    GET /api/categorias
    Retorna lista de categorias disponíveis.
    """
    processor = current_app.config['DATA_PROCESSOR']

    if processor.procedimentos_df is None:
        return jsonify({'error': 'Dados não carregados'}), 500

    categorias = processor.procedimentos_df['Categoria'].unique().tolist()

    return jsonify({'categorias': categorias})


@api.route('/prioridades', methods=['GET'])
def get_prioridades():
    """
    GET /api/prioridades
    Retorna lista de prioridades disponíveis.
    """
    processor = current_app.config['DATA_PROCESSOR']

    if processor.procedimentos_df is None:
        return jsonify({'error': 'Dados não carregados'}), 500

    prioridades = processor.procedimentos_df['Grau de Importância'].unique().tolist()

    return jsonify({'prioridades': prioridades})


@api.route('/cidades', methods=['GET'])
def get_cidades():
    """
    GET /api/cidades
    Retorna lista de cidades disponíveis com contagem de parceiros.
    """
    processor = current_app.config['DATA_PROCESSOR']

    if processor.parceiros_df is None:
        return jsonify({'error': 'Dados não carregados'}), 500

    cidades_grouped = processor.parceiros_df.groupby('CIDADE').agg({
        'PARCEIRO': 'nunique',
        'PROCEDIMENTO': 'count'
    }).reset_index()

    cidades_grouped.columns = ['cidade', 'num_parceiros', 'num_procedimentos']
    cidades_grouped = cidades_grouped.sort_values('num_procedimentos', ascending=False)

    result = cidades_grouped.to_dict(orient='records')

    return jsonify({
        'total': len(result),
        'cidades': result
    })


@api.route('/bairros', methods=['GET'])
def get_bairros():
    """
    GET /api/bairros
    Retorna lista de bairros disponíveis, opcionalmente filtrados por cidade.

    Query params:
        - cidade: filtrar bairros de uma cidade específica
    """
    processor = current_app.config['DATA_PROCESSOR']

    if processor.parceiros_df is None:
        return jsonify({'error': 'Dados não carregados'}), 500

    df = processor.parceiros_df.copy()

    cidade = request.args.get('cidade')
    if cidade:
        df = df[df['CIDADE'] == cidade]

    bairros_grouped = df.groupby(['CIDADE', 'BAIRRO']).agg({
        'PARCEIRO': 'nunique',
        'PROCEDIMENTO': 'count'
    }).reset_index()

    bairros_grouped.columns = ['cidade', 'bairro', 'num_parceiros', 'num_procedimentos']
    bairros_grouped = bairros_grouped.sort_values('num_procedimentos', ascending=False)

    result = bairros_grouped.to_dict(orient='records')

    return jsonify({
        'total': len(result),
        'bairros': result
    })


@api.route('/upload/procedimentos', methods=['POST'])
def upload_procedimentos():
    """
    POST /api/upload/procedimentos
    Upload de novo arquivo Excel de procedimentos.
    """
    if 'file' not in request.files:
        return jsonify({'error': 'Nenhum arquivo enviado'}), 400

    file = request.files['file']

    if file.filename == '':
        return jsonify({'error': 'Nome de arquivo vazio'}), 400

    if not file.filename.endswith(('.xlsx', '.xls')):
        return jsonify({'error': 'Formato inválido. Use .xlsx ou .xls'}), 400

    filename = secure_filename(file.filename)
    filepath = Path(current_app.config['UPLOAD_FOLDER']) / filename

    file.save(filepath)

    try:
        import pandas as pd
        df = pd.read_excel(filepath)

        required_cols = ['Código Principal', 'Procedimento', 'Contagem',
                        'Categoria', 'Grau de Importância']
        missing = [col for col in required_cols if col not in df.columns]

        if missing:
            os.remove(filepath)
            return jsonify({'error': f'Colunas faltando: {missing}'}), 400

        import shutil
        dest = Path('.data') / 'procedimentos_classificados.xlsx'
        shutil.copy(filepath, dest)

        processor = current_app.config['DATA_PROCESSOR']
        processor.process_all(use_cache=False)

        os.remove(filepath)

        return jsonify({
            'success': True,
            'message': 'Arquivo de procedimentos atualizado com sucesso',
            'stats': processor.stats
        })

    except Exception as e:
        if filepath.exists():
            os.remove(filepath)
        return jsonify({'error': f'Erro ao processar arquivo: {str(e)}'}), 500


@api.route('/upload/parceiros', methods=['POST'])
def upload_parceiros():
    """
    POST /api/upload/parceiros
    Upload de novo arquivo Excel de parceiros.
    """
    if 'file' not in request.files:
        return jsonify({'error': 'Nenhum arquivo enviado'}), 400

    file = request.files['file']

    if file.filename == '':
        return jsonify({'error': 'Nome de arquivo vazio'}), 400

    if not file.filename.endswith(('.xlsx', '.xls')):
        return jsonify({'error': 'Formato inválido. Use .xlsx ou .xls'}), 400

    filename = secure_filename(file.filename)
    filepath = Path(current_app.config['UPLOAD_FOLDER']) / filename

    file.save(filepath)

    try:
        import pandas as pd
        df = pd.read_excel(filepath, header=None, skiprows=1)

        if df.shape[1] < 8:
            os.remove(filepath)
            return jsonify({'error': 'Formato de arquivo inválido'}), 400

        import shutil
        dest = Path('.data') / 'MP OSASCO.xlsx'
        shutil.copy(filepath, dest)

        processor = current_app.config['DATA_PROCESSOR']
        processor.process_all(use_cache=False)

        os.remove(filepath)

        return jsonify({
            'success': True,
            'message': 'Arquivo de parceiros atualizado com sucesso',
            'stats': processor.stats
        })

    except Exception as e:
        if filepath.exists():
            os.remove(filepath)
        return jsonify({'error': f'Erro ao processar arquivo: {str(e)}'}), 500


@api.route('/refresh', methods=['GET'])
def refresh_data():
    """
    GET /api/refresh
    Reprocessa dados e atualiza cache.
    """
    try:
        processor = current_app.config['DATA_PROCESSOR']
        stats = processor.process_all(use_cache=False)

        return jsonify({
            'success': True,
            'message': 'Dados reprocessados com sucesso',
            'stats': stats
        })

    except Exception as e:
        return jsonify({'error': f'Erro ao reprocessar dados: {str(e)}'}), 500
