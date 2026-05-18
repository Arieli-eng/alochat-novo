"""
Modelos de dados para o painel de configurações.

Entidades:
- Credenciador: Quem executa os procedimentos
- Responsavel: Quem cria os chamados
- CidadeConfig: Cidades que estão subindo
- SLAConfig: Tempo de processamento por prioridade
"""

from database import db
from datetime import datetime


# Tabela de relacionamento N:N entre Credenciadores e Cidades
cidades_credenciadores = db.Table(
    'cidades_credenciadores',
    db.Column('credenciador_id', db.Integer, db.ForeignKey('credenciadores.id', ondelete='CASCADE'), primary_key=True),
    db.Column('cidade_id', db.Integer, db.ForeignKey('cidades_config.id', ondelete='CASCADE'), primary_key=True)
)


class Credenciador(db.Model):
    """
    Credenciadores que executam procedimentos.

    Podem atuar em múltiplas cidades (relacionamento N:N).
    """
    __tablename__ = 'credenciadores'

    id = db.Column(db.Integer, primary_key=True)
    nome = db.Column(db.String(200), nullable=False)
    cidade = db.Column(db.String(100), nullable=False)
    ativo = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    cidades_vinculadas = db.relationship(
        'CidadeConfig',
        secondary=cidades_credenciadores,
        backref=db.backref('credenciadores', lazy='dynamic')
    )

    def to_dict(self):
        """Serializa para JSON."""
        return {
            'id': self.id,
            'nome': self.nome,
            'cidade': self.cidade,
            'ativo': self.ativo,
            'cidades_vinculadas': [c.nome for c in self.cidades_vinculadas],
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }


class Responsavel(db.Model):
    """
    Responsáveis que criam os chamados no sistema.
    """
    __tablename__ = 'responsaveis'

    id = db.Column(db.Integer, primary_key=True)
    nome = db.Column(db.String(200), nullable=False)
    email = db.Column(db.String(200), unique=True)
    ativo = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        """Serializa para JSON."""
        return {
            'id': self.id,
            'nome': self.nome,
            'email': self.email,
            'ativo': self.ativo,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }


class CidadeConfig(db.Model):
    """
    Cidades configuradas no sistema.

    Podem ser vinculadas a múltiplos credenciadores.
    """
    __tablename__ = 'cidades_config'

    id = db.Column(db.Integer, primary_key=True)
    nome = db.Column(db.String(100), nullable=False, unique=True)
    estado = db.Column(db.String(2), nullable=False)
    ativa = db.Column(db.Boolean, default=True)
    observacoes = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        """Serializa para JSON."""
        return {
            'id': self.id,
            'nome': self.nome,
            'estado': self.estado,
            'ativa': self.ativa,
            'observacoes': self.observacoes,
            'num_credenciadores': len(self.credenciadores.all()),
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class SLAConfig(db.Model):
    """
    Configuração de SLA (tempo de processamento) por prioridade.

    Define quanto tempo cada grau de importância deve levar
    para ser processado.
    """
    __tablename__ = 'sla_config'

    id = db.Column(db.Integer, primary_key=True)
    prioridade = db.Column(db.String(50), nullable=False, unique=True)
    tempo_horas = db.Column(db.Integer, nullable=False)
    descricao = db.Column(db.Text)
    cor_badge = db.Column(db.String(20))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        """Serializa para JSON."""
        return {
            'id': self.id,
            'prioridade': self.prioridade,
            'tempo_horas': self.tempo_horas,
            'descricao': self.descricao,
            'cor_badge': self.cor_badge,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
