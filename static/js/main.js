// Estado da aplicação
let allProcedimentos = [];
let currentPage = 1;
let itemsPerPage = 50;
let filteredProcedimentos = [];

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    loadInitialData();
    setupEventListeners();
});

// Event listeners
function setupEventListeners() {
    document.getElementById('searchInput').addEventListener('input', debounce(applyFilters, 500));
    document.getElementById('cidadeFilter').addEventListener('change', onCidadeChange);
}

// Utility: Debounce
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Carrega dados iniciais
async function loadInitialData() {
    showLoading(true);

    try {
        await Promise.all([
            loadStats(),
            loadCategorias(),
            loadPrioridades(),
            loadCidades(),
            loadProcedimentos()
        ]);
    } catch (error) {
        showNotification('Erro ao carregar dados: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

// Carrega estatísticas
async function loadStats() {
    const response = await fetch('/api/stats');
    const data = await response.json();

    document.getElementById('statTotalProc').textContent = data.total_procedimentos || 0;
    document.getElementById('statComMatch').textContent = data.procedimentos_com_match || 0;
    document.getElementById('statCobertura').textContent = `${data.cobertura_geral || 0}%`;
    document.getElementById('statParceiros').textContent = data.parceiros_disponiveis || 0;
}

// Carrega categorias para o filtro
async function loadCategorias() {
    const response = await fetch('/api/categorias');
    const data = await response.json();

    const select = document.getElementById('categoriaFilter');
    select.innerHTML = '<option value="">Todas as Categorias</option>';

    data.categorias.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat;
        option.textContent = cat;
        select.appendChild(option);
    });
}

// Carrega prioridades para o filtro
async function loadPrioridades() {
    const response = await fetch('/api/prioridades');
    const data = await response.json();

    const select = document.getElementById('prioridadeFilter');
    select.innerHTML = '<option value="">Todas as Prioridades</option>';

    data.prioridades.forEach(prio => {
        const option = document.createElement('option');
        option.value = prio;
        option.textContent = prio;
        select.appendChild(option);
    });
}

// Carrega cidades para o filtro
async function loadCidades() {
    const response = await fetch('/api/cidades');
    const data = await response.json();

    const select = document.getElementById('cidadeFilter');
    select.innerHTML = '<option value="">Todas as Cidades</option>';

    data.cidades.forEach(cidade => {
        const option = document.createElement('option');
        option.value = cidade.cidade;
        option.textContent = `${cidade.cidade} (${cidade.num_parceiros} parceiros)`;
        select.appendChild(option);
    });
}

// Carrega bairros quando cidade é selecionada
async function onCidadeChange() {
    const cidade = document.getElementById('cidadeFilter').value;
    const bairroSelect = document.getElementById('bairroFilter');

    bairroSelect.innerHTML = '<option value="">Todos os Bairros</option>';

    if (!cidade) {
        bairroSelect.disabled = true;
        return;
    }

    bairroSelect.disabled = false;

    try {
        const response = await fetch(`/api/bairros?cidade=${encodeURIComponent(cidade)}`);
        const data = await response.json();

        data.bairros.forEach(bairro => {
            const option = document.createElement('option');
            option.value = bairro.bairro;
            option.textContent = `${bairro.bairro} (${bairro.num_parceiros} parceiros)`;
            bairroSelect.appendChild(option);
        });
    } catch (error) {
        showNotification('Erro ao carregar bairros: ' + error.message, 'error');
    }
}

// Carrega procedimentos
async function loadProcedimentos() {
    const params = new URLSearchParams();

    const categoria = document.getElementById('categoriaFilter').value;
    if (categoria) params.append('categoria', categoria);

    const prioridade = document.getElementById('prioridadeFilter').value;
    if (prioridade) params.append('prioridade', prioridade);

    const search = document.getElementById('searchInput').value;
    if (search) params.append('search', search);

    const cidade = document.getElementById('cidadeFilter').value;
    if (cidade) params.append('cidade', cidade);

    const bairro = document.getElementById('bairroFilter').value;
    if (bairro) params.append('bairro', bairro);

    const response = await fetch(`/api/procedimentos?${params.toString()}`);
    const data = await response.json();

    allProcedimentos = data.procedimentos;
    filteredProcedimentos = allProcedimentos;
    currentPage = 1;

    renderTable();
    renderPagination();
}

// Renderiza tabela
function renderTable() {
    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = '';

    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const items = filteredProcedimentos.slice(start, end);

    if (items.length === 0) {
        tbody.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">○</div>
                <div class="empty-text">Nenhum procedimento encontrado</div>
                <div class="empty-subtext">Ajuste os filtros para ver os resultados</div>
            </div>
        `;
        return;
    }

    items.forEach(proc => {
        const card = document.createElement('div');
        card.className = 'procedimento-card';

        const prioridadeClass = getPrioridadeClass(proc['Grau de Importância']);

        const numParceiros = proc.num_parceiros_regiao !== undefined
            ? proc.num_parceiros_regiao
            : proc.num_parceiros;

        const parceirosClass = numParceiros > 0 ? 'status-active' : 'status-inactive';
        const parceirosText = numParceiros > 0
            ? `${numParceiros} parceiro(s)`
            : 'Sem parceiros';

        card.innerHTML = `
            <div class="proc-code">${proc['Código Principal']}</div>
            <div class="proc-info">
                <div class="proc-name">${proc['Procedimento']}</div>
                <div class="proc-meta">
                    <span>${proc['Categoria']}</span>
                    <span>•</span>
                    <span>Demanda: ${proc['Contagem'].toLocaleString('pt-BR')}</span>
                </div>
            </div>
            <span class="badge ${prioridadeClass}">${proc['Grau de Importância']}</span>
            <span class="status-badge ${parceirosClass}">${parceirosText}</span>
            <button
                class="btn-icon btn-edit"
                onclick="viewParceiros(${proc.id})"
                ${numParceiros === 0 ? 'disabled' : ''}
                title="Ver Parceiros"
            >→</button>
        `;

        tbody.appendChild(card);
    });
}

// Renderiza paginação
function renderPagination() {
    const pagination = document.getElementById('pagination');
    pagination.innerHTML = '';

    const totalPages = Math.ceil(filteredProcedimentos.length / itemsPerPage);

    if (totalPages <= 1) return;

    const prevBtn = document.createElement('button');
    prevBtn.textContent = '← Anterior';
    prevBtn.disabled = currentPage === 1;
    prevBtn.onclick = () => goToPage(currentPage - 1);
    pagination.appendChild(prevBtn);

    const startPage = Math.max(1, currentPage - 2);
    const endPage = Math.min(totalPages, currentPage + 2);

    if (startPage > 1) {
        const btn = document.createElement('button');
        btn.textContent = '1';
        btn.onclick = () => goToPage(1);
        pagination.appendChild(btn);

        if (startPage > 2) {
            const dots = document.createElement('span');
            dots.textContent = '...';
            dots.style.padding = '0 8px';
            pagination.appendChild(dots);
        }
    }

    for (let i = startPage; i <= endPage; i++) {
        const btn = document.createElement('button');
        btn.textContent = i;
        btn.className = i === currentPage ? 'active' : '';
        btn.onclick = () => goToPage(i);
        pagination.appendChild(btn);
    }

    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            const dots = document.createElement('span');
            dots.textContent = '...';
            dots.style.padding = '0 8px';
            pagination.appendChild(dots);
        }

        const btn = document.createElement('button');
        btn.textContent = totalPages;
        btn.onclick = () => goToPage(totalPages);
        pagination.appendChild(btn);
    }

    const nextBtn = document.createElement('button');
    nextBtn.textContent = 'Próximo →';
    nextBtn.disabled = currentPage === totalPages;
    nextBtn.onclick = () => goToPage(currentPage + 1);
    pagination.appendChild(nextBtn);
}

// Navegar para página
function goToPage(page) {
    currentPage = page;
    renderTable();
    renderPagination();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Aplicar filtros
async function applyFilters() {
    showLoading(true);
    try {
        await loadProcedimentos();
    } catch (error) {
        showNotification('Erro ao aplicar filtros: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

// Limpar filtros
function clearFilters() {
    document.getElementById('searchInput').value = '';
    document.getElementById('categoriaFilter').value = '';
    document.getElementById('prioridadeFilter').value = '';
    document.getElementById('cidadeFilter').value = '';
    document.getElementById('bairroFilter').value = '';
    document.getElementById('bairroFilter').disabled = true;
    applyFilters();
}

// Visualizar parceiros
async function viewParceiros(procId) {
    showLoading(true);

    try {
        const params = new URLSearchParams();

        const cidade = document.getElementById('cidadeFilter').value;
        if (cidade) params.append('cidade', cidade);

        const bairro = document.getElementById('bairroFilter').value;
        if (bairro) params.append('bairro', bairro);

        const url = `/api/procedimentos/${procId}/parceiros${params.toString() ? '?' + params.toString() : ''}`;
        const response = await fetch(url);
        const data = await response.json();

        const modalBody = document.getElementById('modalBody');

        const filtroAtivo = cidade || bairro;

        let headerInfo = '';
        if (filtroAtivo) {
            const localizacao = bairro ? `${cidade} - ${bairro}` : cidade;
            headerInfo = `
                <div style="background: #e8f5e9; padding: 12px 16px; border-radius: 8px; margin-bottom: 16px; border-left: 4px solid var(--primary);">
                    <strong>⌘ Filtrado por localização:</strong> ${localizacao}
                </div>
            `;
        }

        if (data.parceiros.length === 0) {
            const mensagem = filtroAtivo
                ? `Nenhum parceiro disponível nesta região para este procedimento`
                : `Nenhum parceiro disponível para este procedimento`;

            modalBody.innerHTML = headerInfo + `
                <div class="empty-state">
                    <div class="empty-icon">○</div>
                    <div class="empty-text">${mensagem}</div>
                </div>
            `;
        } else {
            modalBody.innerHTML = headerInfo + data.parceiros.map(parc => {
                const matchLabel = getMatchLabel(parc.match_type, parc.score);
                const scoreClass = parc.score >= 90 ? 'status-active' : parc.score >= 70 ? 'badge-warning' : 'badge-info';

                return `
                    <div class="parceiro-card-modern">
                        <div class="parceiro-header-modern">
                            <div class="parceiro-nome-modern">${parc.parceiro}</div>
                            <span class="status-badge ${scoreClass}">${matchLabel}</span>
                        </div>
                        <div class="parceiro-info-modern">
                            <div class="parceiro-info-item">
                                <strong>Procedimento</strong>
                                ${parc.procedimento_nome}
                            </div>
                            <div class="parceiro-info-item">
                                <strong>Código Interno</strong>
                                ${parc.cod_interno}
                            </div>
                            <div class="parceiro-info-item">
                                <strong>Localização</strong>
                                ${parc.cidade} - ${parc.bairro}
                            </div>
                            ${parc.similaridade_nome ? `
                                <div class="parceiro-info-item">
                                    <strong>Similaridade</strong>
                                    ${parc.similaridade_nome}%
                                </div>
                            ` : ''}
                            ${parc.repasse ? `
                                <div class="parceiro-info-item">
                                    <strong>Repasse</strong>
                                    R$ ${parc.repasse.toFixed(2)}
                                </div>
                            ` : ''}
                            ${parc.final ? `
                                <div class="parceiro-info-item">
                                    <strong>Final</strong>
                                    R$ ${parc.final.toFixed(2)}
                                </div>
                            ` : ''}
                        </div>
                    </div>
                `;
            }).join('');
        }

        openModal();
    } catch (error) {
        showNotification('Erro ao carregar parceiros: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

// Upload de arquivo
async function uploadFile(type) {
    const inputId = type === 'procedimentos' ? 'uploadProcedimentos' : 'uploadParceiros';
    const input = document.getElementById(inputId);
    const file = input.files[0];

    if (!file) {
        showNotification('Selecione um arquivo primeiro', 'warning');
        return;
    }

    const formData = new FormData();
    formData.append('file', file);

    showLoading(true);

    try {
        const response = await fetch(`/api/upload/${type}`, {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (response.ok) {
            showNotification(data.message, 'success');
            input.value = '';
            await loadInitialData();
        } else {
            showNotification(data.error, 'error');
        }
    } catch (error) {
        showNotification('Erro ao fazer upload: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

// Helpers
function getPrioridadeClass(prioridade) {
    const map = {
        'Alta Prioridade': 'badge-prioridade-alta',
        'Média-Alta Prioridade': 'badge-prioridade-media-alta',
        'Média Prioridade': 'badge-prioridade-media',
        'Baixa Prioridade': 'badge-prioridade-baixa'
    };
    return map[prioridade] || 'badge-info';
}

function getMatchLabel(matchType, score) {
    if (matchType === 'exact_code_with_name_validation') {
        if (score >= 90) return 'Match Exato (Código + Nome)';
        if (score >= 70) return 'Match por Código';
        return 'Match Parcial';
    }
    if (matchType === 'fuzzy') {
        return 'Match por Nome';
    }
    return 'Match';
}

function showLoading(show) {
    document.getElementById('loading').style.display = show ? 'block' : 'none';
}

function openModal() {
    document.getElementById('modalParceiros').classList.add('active');
}

function closeModal() {
    document.getElementById('modalParceiros').classList.remove('active');
}

function showNotification(message, type = 'info') {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.className = `notification ${type} show`;

    setTimeout(() => {
        notification.classList.remove('show');
    }, 4000);
}

// Fechar modal ao clicar fora
window.onclick = function(event) {
    const modal = document.getElementById('modalParceiros');
    if (event.target === modal) {
        closeModal();
    }
};
