"""
Rotas e endpoints da API REST para o painel de configurações.

Endpoints para gerenciar:
- Credenciadores
- Responsáveis
- Cidades
- SLA
"""

from flask import Blueprint, jsonify, request, render_template
from database import db
from models import Credenciador, Responsavel, CidadeConfig, SLAConfig

config_bp = Blueprint('config', __name__, url_prefix='/config')


# ==== PÁGINA PRINCIPAL ====

@config_bp.route('/')
def index():
    """Renderiza página de configurações."""
    return render_template('config.html')


# ==== CREDENCIADORES ====

@config_bp.route('/api/credenciadores', methods=['GET'])
def get_credenciadores():
    """Lista todos os credenciadores."""
    credenciadores = Credenciador.query.all()
    return jsonify([c.to_dict() for c in credenciadores])


@config_bp.route('/api/credenciadores', methods=['POST'])
def create_credenciador():
    """Cria novo credenciador."""
    data = request.json

    if not data.get('nome') or not data.get('cidade'):
        return jsonify({'error': 'Nome e cidade são obrigatórios'}), 400

    credenciador = Credenciador(
        nome=data['nome'],
        cidade=data['cidade']
    )

    # Vincular cidades se fornecidas
    if data.get('cidades_ids'):
        cidades = CidadeConfig.query.filter(
            CidadeConfig.id.in_(data['cidades_ids'])
        ).all()
        credenciador.cidades_vinculadas = cidades

    db.session.add(credenciador)
    db.session.commit()

    return jsonify(credenciador.to_dict()), 201


@config_bp.route('/api/credenciadores/<int:id>', methods=['PUT'])
def update_credenciador(id):
    """Atualiza credenciador existente."""
    credenciador = Credenciador.query.get_or_404(id)
    data = request.json

    credenciador.nome = data.get('nome', credenciador.nome)
    credenciador.cidade = data.get('cidade', credenciador.cidade)
    credenciador.ativo = data.get('ativo', credenciador.ativo)

    # Atualizar cidades vinculadas
    if 'cidades_ids' in data:
        cidades = CidadeConfig.query.filter(
            CidadeConfig.id.in_(data['cidades_ids'])
        ).all()
        credenciador.cidades_vinculadas = cidades

    db.session.commit()
    return jsonify(credenciador.to_dict())


@config_bp.route('/api/credenciadores/<int:id>', methods=['DELETE'])
def delete_credenciador(id):
    """Remove credenciador."""
    credenciador = Credenciador.query.get_or_404(id)
    db.session.delete(credenciador)
    db.session.commit()
    return '', 204


# ==== RESPONSÁVEIS ====

@config_bp.route('/api/responsaveis', methods=['GET'])
def get_responsaveis():
    """Lista todos os responsáveis."""
    responsaveis = Responsavel.query.all()
    return jsonify([r.to_dict() for r in responsaveis])


@config_bp.route('/api/responsaveis', methods=['POST'])
def create_responsavel():
    """Cria novo responsável."""
    data = request.json

    if not data.get('nome'):
        return jsonify({'error': 'Nome é obrigatório'}), 400

    # Verificar email único se fornecido
    if data.get('email'):
        existing = Responsavel.query.filter_by(email=data['email']).first()
        if existing:
            return jsonify({'error': 'Email já cadastrado'}), 400

    responsavel = Responsavel(
        nome=data['nome'],
        email=data.get('email')
    )

    db.session.add(responsavel)
    db.session.commit()

    return jsonify(responsavel.to_dict()), 201


@config_bp.route('/api/responsaveis/<int:id>', methods=['PUT'])
def update_responsavel(id):
    """Atualiza responsável existente."""
    responsavel = Responsavel.query.get_or_404(id)
    data = request.json

    responsavel.nome = data.get('nome', responsavel.nome)
    responsavel.ativo = data.get('ativo', responsavel.ativo)

    # Verificar email único se alterado
    if 'email' in data and data['email'] != responsavel.email:
        existing = Responsavel.query.filter_by(email=data['email']).first()
        if existing:
            return jsonify({'error': 'Email já cadastrado'}), 400
        responsavel.email = data['email']

    db.session.commit()
    return jsonify(responsavel.to_dict())


@config_bp.route('/api/responsaveis/<int:id>', methods=['DELETE'])
def delete_responsavel(id):
    """Remove responsável."""
    responsavel = Responsavel.query.get_or_404(id)
    db.session.delete(responsavel)
    db.session.commit()
    return '', 204


# ==== CIDADES ====

@config_bp.route('/api/cidades-config', methods=['GET'])
def get_cidades_config():
    """Lista todas as cidades configuradas."""
    cidades = CidadeConfig.query.all()
    return jsonify([c.to_dict() for c in cidades])


@config_bp.route('/api/cidades-config', methods=['POST'])
def create_cidade_config():
    """Cria nova cidade configurada."""
    data = request.json

    if not data.get('nome') or not data.get('estado'):
        return jsonify({'error': 'Nome e estado são obrigatórios'}), 400

    # Verificar nome único
    existing = CidadeConfig.query.filter_by(nome=data['nome']).first()
    if existing:
        return jsonify({'error': 'Cidade já cadastrada'}), 400

    cidade = CidadeConfig(
        nome=data['nome'],
        estado=data['estado'].upper(),
        observacoes=data.get('observacoes')
    )

    db.session.add(cidade)
    db.session.commit()

    return jsonify(cidade.to_dict()), 201


@config_bp.route('/api/cidades-config/<int:id>', methods=['PUT'])
def update_cidade_config(id):
    """Atualiza cidade configurada."""
    cidade = CidadeConfig.query.get_or_404(id)
    data = request.json

    # Verificar nome único se alterado
    if 'nome' in data and data['nome'] != cidade.nome:
        existing = CidadeConfig.query.filter_by(nome=data['nome']).first()
        if existing:
            return jsonify({'error': 'Nome de cidade já cadastrado'}), 400
        cidade.nome = data['nome']

    if 'estado' in data:
        cidade.estado = data['estado'].upper()

    cidade.ativa = data.get('ativa', cidade.ativa)
    cidade.observacoes = data.get('observacoes', cidade.observacoes)

    db.session.commit()
    return jsonify(cidade.to_dict())


@config_bp.route('/api/cidades-config/<int:id>', methods=['DELETE'])
def delete_cidade_config(id):
    """Remove cidade configurada."""
    cidade = CidadeConfig.query.get_or_404(id)
    db.session.delete(cidade)
    db.session.commit()
    return '', 204


# ==== SLA ====

@config_bp.route('/api/sla', methods=['GET'])
def get_sla():
    """Lista todas as configurações de SLA."""
    slas = SLAConfig.query.all()
    return jsonify([s.to_dict() for s in slas])


@config_bp.route('/api/sla/<int:id>', methods=['PUT'])
def update_sla(id):
    """Atualiza configuração de SLA."""
    sla = SLAConfig.query.get_or_404(id)
    data = request.json

    if 'tempo_dias' in data:
        if not isinstance(data['tempo_dias'], int) or data['tempo_dias'] <= 0:
            return jsonify({'error': 'Tempo deve ser um número inteiro positivo'}), 400
        sla.tempo_dias = data['tempo_dias']

    sla.descricao = data.get('descricao', sla.descricao)

    db.session.commit()
    return jsonify(sla.to_dict())
