"""
Aplicação Flask principal.
"""

from flask import Flask, render_template
from pathlib import Path
import os

from data_processor import DataProcessor
from routes import api
from database import init_db
from config_routes import config_bp


def create_app():
    """Factory para criar e configurar a aplicação Flask."""
    app = Flask(
        __name__,
        template_folder='../templates',
        static_folder='../static'
    )

    app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev-secret-key-change-in-production')
    app.config['UPLOAD_FOLDER'] = Path('app/uploads')
    app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024

    app.config['UPLOAD_FOLDER'].mkdir(parents=True, exist_ok=True)

    # Inicializar banco de dados SQLite
    init_db(app)

    processor = DataProcessor()
    print("Inicializando sistema...")

    try:
        stats = processor.process_all(use_cache=True)
        print(f"\n{'='*50}")
        print("Sistema inicializado com sucesso!")
        print(f"Total de procedimentos: {stats['total_procedimentos']}")
        print(f"Procedimentos com match: {stats['procedimentos_com_match']}")
        print(f"Cobertura geral: {stats['cobertura_geral']}%")
        print(f"Parceiros disponíveis: {stats['parceiros_disponiveis']}")
        print(f"{'='*50}\n")
    except Exception as e:
        print(f"Erro ao inicializar dados: {e}")
        print("A aplicação continuará, mas os dados podem não estar disponíveis.")

    app.config['DATA_PROCESSOR'] = processor

    # Registrar blueprints
    app.register_blueprint(api)
    app.register_blueprint(config_bp)

    @app.route('/')
    def index():
        """Rota principal - renderiza dashboard."""
        return render_template('index.html')

    @app.errorhandler(404)
    def not_found(e):
        return {'error': 'Endpoint não encontrado'}, 404

    @app.errorhandler(500)
    def server_error(e):
        return {'error': 'Erro interno do servidor'}, 500

    return app


if __name__ == '__main__':
    app = create_app()
    print("Servidor Flask iniciando em http://localhost:5000")
    app.run(debug=True, host='0.0.0.0', port=5000)
