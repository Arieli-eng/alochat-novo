"""
Inicialização e configuração do banco de dados SQLite.
"""

from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()


def init_db(app):
    """
    Inicializa banco de dados SQLite e cria tabelas.

    Args:
        app: Instância Flask
    """
    import os
    basedir = os.path.abspath(os.path.dirname(__file__))
    db_path = os.path.join(basedir, 'database.db')
    app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{db_path}'
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

    db.init_app(app)

    with app.app_context():
        db.create_all()
        seed_initial_data()


def seed_initial_data():
    """
    Popula dados iniciais de SLA baseados nos graus de importância.

    SLA (Service Level Agreement):
    - Alta Prioridade: 1 dia
    - Média-Alta Prioridade: 2 dias
    - Média Prioridade: 3 dias
    - Baixa Prioridade: 5 dias
    """
    from models import SLAConfig

    slas_iniciais = [
        {
            'prioridade': 'Alta Prioridade',
            'tempo_dias': 1,
            'descricao': 'Procedimentos de alta demanda e urgência',
            'cor_badge': '#ef4444'
        },
        {
            'prioridade': 'Média-Alta Prioridade',
            'tempo_dias': 2,
            'descricao': 'Procedimentos com demanda significativa',
            'cor_badge': '#f59e0b'
        },
        {
            'prioridade': 'Média Prioridade',
            'tempo_dias': 3,
            'descricao': 'Procedimentos com demanda moderada',
            'cor_badge': '#fbbf24'
        },
        {
            'prioridade': 'Baixa Prioridade',
            'tempo_dias': 5,
            'descricao': 'Procedimentos com baixa demanda',
            'cor_badge': '#10b981'
        }
    ]

    for sla_data in slas_iniciais:
        existing = SLAConfig.query.filter_by(prioridade=sla_data['prioridade']).first()
        if not existing:
            sla = SLAConfig(**sla_data)
            db.session.add(sla)

    db.session.commit()
