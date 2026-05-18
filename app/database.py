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
    - Alta Prioridade: 24 horas
    - Média-Alta Prioridade: 48 horas
    - Média Prioridade: 72 horas
    - Baixa Prioridade: 120 horas
    """
    from models import SLAConfig

    slas_iniciais = [
        {
            'prioridade': 'Alta Prioridade',
            'tempo_horas': 24,
            'descricao': 'Procedimentos de alta demanda e urgência',
            'cor_badge': '#ef4444'
        },
        {
            'prioridade': 'Média-Alta Prioridade',
            'tempo_horas': 48,
            'descricao': 'Procedimentos com demanda significativa',
            'cor_badge': '#f59e0b'
        },
        {
            'prioridade': 'Média Prioridade',
            'tempo_horas': 72,
            'descricao': 'Procedimentos com demanda moderada',
            'cor_badge': '#fbbf24'
        },
        {
            'prioridade': 'Baixa Prioridade',
            'tempo_horas': 120,
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
