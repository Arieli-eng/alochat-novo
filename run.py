"""
Script de inicialização da aplicação AloChat.
Execute este arquivo para iniciar o servidor.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent / 'app'))

from app import create_app

if __name__ == '__main__':
    app = create_app()
    print("\n" + "="*60)
    print("  AloChat - Sistema de Procedimentos")
    print("  Servidor iniciando em http://localhost:5000")
    print("="*60 + "\n")
    app.run(debug=True, host='0.0.0.0', port=5000)
