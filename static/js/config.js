// Estado global
let currentSection = 'credenciadores';
let todasCidades = [];
let allData = {
    credenciadores: [],
    responsaveis: [],
    cidades: [],
    sla: []
};

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    loadAllData();
    showSection('credenciadores');
});

// Trocar seção
function showSection(section) {
    currentSection = section;

    // Atualizar menu ativo
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    const activeItem = document.querySelector(`.nav-item[data-section="${section}"]`);
    if (activeItem) activeItem.classList.add('active');

    // Atualizar título
    const titles = {
        'credenciadores': 'Credenciadores',
        'responsaveis': 'Responsáveis',
        'cidades': 'Cidades',
        'sla': 'SLA'
    };
    document.getElementById('pageTitle').textContent = titles[section] || section;

    // Atualizar botão de adicionar
    const addButton = document.getElementById('addButton');
    if (section === 'sla') {
        addButton.style.display = 'none';
    } else {
        addButton.style.display = 'block';
    }

    // Renderizar conteúdo
    renderContent();
}

// Abrir modal de adicionar
function openAddModal() {
    switch (currentSection) {
        case 'credenciadores':
            openCredenciadorModal();
            break;
        case 'responsaveis':
            openResponsavelModal();
            break;
        case 'cidades':
            openCidadeModal();
            break;
    }
}

// Carregar todos os dados
async function loadAllData() {
    try {
        const [cred, resp, cid, slaData] = await Promise.all([
            fetch('/config/api/credenciadores').then(r => r.json()),
            fetch('/config/api/responsaveis').then(r => r.json()),
            fetch('/config/api/cidades-config').then(r => r.json()),
            fetch('/config/api/sla').then(r => r.json())
        ]);

        allData.credenciadores = cred;
        allData.responsaveis = resp;
        allData.cidades = cid;
        allData.sla = slaData;

        renderContent();
    } catch (error) {
        showNotification('Erro ao carregar dados: ' + error.message, 'error');
    }
}

// Renderizar conteúdo da seção atual
function renderContent() {
    const contentArea = document.getElementById('contentArea');
    const searchInput = document.getElementById('searchInput');
    const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';

    let data = allData[currentSection] || [];

    // Filtrar por busca
    if (searchTerm) {
        data = data.filter(item => {
            const nome = item.nome || item.prioridade || '';
            return nome.toLowerCase().includes(searchTerm);
        });
    }

    if (data.length === 0) {
        contentArea.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📋</div>
                <div class="empty-text">Nenhum registro encontrado</div>
                <div class="empty-subtext">Clique em "+ Novo Cadastro" para adicionar</div>
            </div>
        `;
        return;
    }

    const itemsList = document.createElement('div');
    itemsList.className = 'items-list';

    data.forEach(item => {
        const card = document.createElement('div');
        card.className = 'item-card';

        switch (currentSection) {
            case 'credenciadores':
                card.innerHTML = renderCredenciadorCard(item);
                break;
            case 'responsaveis':
                card.innerHTML = renderResponsavelCard(item);
                break;
            case 'cidades':
                card.innerHTML = renderCidadeCard(item);
                break;
            case 'sla':
                card.innerHTML = renderSLACard(item);
                break;
        }

        itemsList.appendChild(card);
    });

    contentArea.innerHTML = '';
    contentArea.appendChild(itemsList);
}

function renderCredenciadorCard(cred) {
    const statusClass = cred.ativo ? 'status-active' : 'status-inactive';
    const statusText = cred.ativo ? 'Ativo' : 'Inativo';

    let cidadesHtml = '<span style="color: var(--text-light); font-size: 0.85rem;">Nenhuma cidade vinculada</span>';
    if (cred.cidades_vinculadas && cred.cidades_vinculadas.length > 0) {
        cidadesHtml = '<div class="cidade-tags">' +
            cred.cidades_vinculadas.map(c => `<span class="cidade-tag">${c.nome} - ${c.estado}</span>`).join('') +
            '</div>';
    }

    return `
        <div class="item-info">
            <div class="item-name">${cred.nome}</div>
            <div class="item-details">
                ${cidadesHtml}
            </div>
        </div>
        <span class="status-badge ${statusClass}">${statusText}</span>
        <div class="item-actions">
            <button class="btn-icon btn-edit" onclick="editCredenciador(${cred.id})" title="Editar">✏️</button>
            <button class="btn-icon btn-delete" onclick="deleteCredenciador(${cred.id}, '${cred.nome}')" title="Excluir">🗑️</button>
        </div>
    `;
}

function renderResponsavelCard(resp) {
    const statusClass = resp.ativo ? 'status-active' : 'status-inactive';
    const statusText = resp.ativo ? 'Ativo' : 'Inativo';

    return `
        <div class="item-info">
            <div class="item-name">${resp.nome}</div>
            <div class="item-details">
                <span class="item-detail">${resp.email || 'Sem email'}</span>
            </div>
        </div>
        <span class="status-badge ${statusClass}">${statusText}</span>
        <div class="item-actions">
            <button class="btn-icon btn-edit" onclick="editResponsavel(${resp.id})" title="Editar">✏️</button>
            <button class="btn-icon btn-delete" onclick="deleteResponsavel(${resp.id}, '${resp.nome}')" title="Excluir">🗑️</button>
        </div>
    `;
}

function renderCidadeCard(cidade) {
    const statusClass = cidade.ativa ? 'status-active' : 'status-inactive';
    const statusText = cidade.ativa ? 'Ativa' : 'Inativa';

    return `
        <div class="item-info">
            <div class="item-name">${cidade.nome} - ${cidade.estado}</div>
            <div class="item-details">
                <span class="item-detail">${cidade.num_credenciadores || 0} credenciador(es)</span>
                ${cidade.observacoes ? `<span class="item-detail">${cidade.observacoes}</span>` : ''}
            </div>
        </div>
        <span class="status-badge ${statusClass}">${statusText}</span>
        <div class="item-actions">
            <button class="btn-icon btn-edit" onclick="editCidade(${cidade.id})" title="Editar">✏️</button>
            <button class="btn-icon btn-delete" onclick="deleteCidade(${cidade.id}, '${cidade.nome}')" title="Excluir">🗑️</button>
        </div>
    `;
}

function renderSLACard(sla) {
    const badgeStyle = sla.cor_badge ? `background: ${sla.cor_badge}; width: 20px; height: 20px; border-radius: 50%; display: inline-block; margin-right: 8px;` : '';

    return `
        <div class="item-info">
            <div class="item-name">
                <span style="${badgeStyle}"></span>
                ${sla.prioridade}
            </div>
            <div class="item-details">
                <span class="item-detail"><strong>${sla.tempo_dias} ${sla.tempo_dias === 1 ? 'dia' : 'dias'}</strong></span>
                <span class="item-detail">${sla.descricao || ''}</span>
            </div>
        </div>
        <div class="item-actions">
            <button class="btn-icon btn-edit" onclick="editSLA(${sla.id})" title="Editar">✏️</button>
        </div>
    `;
}

// Event listener para busca
document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', debounce(() => {
            renderContent();
        }, 300));
    }
});

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
    };
}

// ==== CREDENCIADORES ====

async function openCredenciadorModal(id = null) {
    document.getElementById('credenciadorModalTitle').textContent = id ? 'Editar Credenciador' : 'Novo Credenciador';
    document.getElementById('formCredenciador').reset();
    document.getElementById('credenciadorId').value = id || '';
    document.getElementById('credenciadorAtivo').checked = true;

    await populateCidadesSelect();

    if (id) {
        const cred = allData.credenciadores.find(c => c.id === id);
        if (cred) {
            document.getElementById('credenciadorNome').value = cred.nome;
            document.getElementById('credenciadorAtivo').checked = cred.ativo;

            const select = document.getElementById('credenciadorCidadesVinculadas');
            const vinculadasIds = (cred.cidades_vinculadas || []).map(c => c.id);
            Array.from(select.options).forEach(option => {
                option.selected = vinculadasIds.includes(parseInt(option.value));
            });
        }
    }

    openModal('modalCredenciador');
}

async function populateCidadesSelect() {
    const select = document.getElementById('credenciadorCidadesVinculadas');
    select.innerHTML = '';

    allData.cidades.filter(c => c.ativa).forEach(cidade => {
        const option = document.createElement('option');
        option.value = cidade.id;
        option.textContent = `${cidade.nome} - ${cidade.estado}`;
        select.appendChild(option);
    });
}

function editCredenciador(id) {
    openCredenciadorModal(id);
}

async function saveCredenciador(event) {
    event.preventDefault();
    showLoading(true);

    const id = document.getElementById('credenciadorId').value;
    const select = document.getElementById('credenciadorCidadesVinculadas');
    const cidadesSelecionadas = Array.from(select.selectedOptions).map(opt => parseInt(opt.value));

    const data = {
        nome: document.getElementById('credenciadorNome').value,
        ativo: document.getElementById('credenciadorAtivo').checked,
        cidades_ids: cidadesSelecionadas
    };

    try {
        const url = id ? `/config/api/credenciadores/${id}` : '/config/api/credenciadores';
        const method = id ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (response.ok) {
            showNotification('Credenciador salvo com sucesso!', 'success');
            closeModal('modalCredenciador');
            await loadAllData();
        } else {
            const error = await response.json();
            showNotification(error.error || 'Erro ao salvar credenciador', 'error');
        }
    } catch (error) {
        showNotification('Erro ao salvar credenciador: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

async function deleteCredenciador(id, nome) {
    if (!confirm(`Tem certeza que deseja excluir o credenciador "${nome}"?`)) return;

    showLoading(true);
    try {
        const response = await fetch(`/config/api/credenciadores/${id}`, { method: 'DELETE' });
        if (response.ok) {
            showNotification('Credenciador excluído com sucesso!', 'success');
            await loadAllData();
        } else {
            showNotification('Erro ao excluir credenciador', 'error');
        }
    } catch (error) {
        showNotification('Erro ao excluir credenciador: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

// ==== RESPONSÁVEIS ====

function openResponsavelModal(id = null) {
    document.getElementById('responsavelModalTitle').textContent = id ? 'Editar Responsável' : 'Novo Responsável';
    document.getElementById('formResponsavel').reset();
    document.getElementById('responsavelId').value = id || '';
    document.getElementById('responsavelAtivo').checked = true;

    if (id) {
        const resp = allData.responsaveis.find(r => r.id === id);
        if (resp) {
            document.getElementById('responsavelNome').value = resp.nome;
            document.getElementById('responsavelEmail').value = resp.email || '';
            document.getElementById('responsavelAtivo').checked = resp.ativo;
        }
    }

    openModal('modalResponsavel');
}

function editResponsavel(id) {
    openResponsavelModal(id);
}

async function saveResponsavel(event) {
    event.preventDefault();
    showLoading(true);

    const id = document.getElementById('responsavelId').value;
    const data = {
        nome: document.getElementById('responsavelNome').value,
        email: document.getElementById('responsavelEmail').value || null,
        ativo: document.getElementById('responsavelAtivo').checked
    };

    try {
        const url = id ? `/config/api/responsaveis/${id}` : '/config/api/responsaveis';
        const method = id ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (response.ok) {
            showNotification('Responsável salvo com sucesso!', 'success');
            closeModal('modalResponsavel');
            await loadAllData();
        } else {
            const error = await response.json();
            showNotification(error.error || 'Erro ao salvar responsável', 'error');
        }
    } catch (error) {
        showNotification('Erro ao salvar responsável: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

async function deleteResponsavel(id, nome) {
    if (!confirm(`Tem certeza que deseja excluir o responsável "${nome}"?`)) return;

    showLoading(true);
    try {
        const response = await fetch(`/config/api/responsaveis/${id}`, { method: 'DELETE' });
        if (response.ok) {
            showNotification('Responsável excluído com sucesso!', 'success');
            await loadAllData();
        } else {
            showNotification('Erro ao excluir responsável', 'error');
        }
    } catch (error) {
        showNotification('Erro ao excluir responsável: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

// ==== CIDADES ====

function openCidadeModal(id = null) {
    document.getElementById('cidadeModalTitle').textContent = id ? 'Editar Cidade' : 'Nova Cidade';
    document.getElementById('formCidade').reset();
    document.getElementById('cidadeId').value = id || '';
    document.getElementById('cidadeAtiva').checked = true;

    if (id) {
        const cidade = allData.cidades.find(c => c.id === id);
        if (cidade) {
            document.getElementById('cidadeNome').value = cidade.nome;
            document.getElementById('cidadeEstado').value = cidade.estado;
            document.getElementById('cidadeObservacoes').value = cidade.observacoes || '';
            document.getElementById('cidadeAtiva').checked = cidade.ativa;
        }
    }

    openModal('modalCidade');
}

function editCidade(id) {
    openCidadeModal(id);
}

async function saveCidade(event) {
    event.preventDefault();
    showLoading(true);

    const id = document.getElementById('cidadeId').value;
    const data = {
        nome: document.getElementById('cidadeNome').value,
        estado: document.getElementById('cidadeEstado').value.toUpperCase(),
        observacoes: document.getElementById('cidadeObservacoes').value || null,
        ativa: document.getElementById('cidadeAtiva').checked
    };

    try {
        const url = id ? `/config/api/cidades-config/${id}` : '/config/api/cidades-config';
        const method = id ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (response.ok) {
            showNotification('Cidade salva com sucesso!', 'success');
            closeModal('modalCidade');
            await loadAllData();
        } else {
            const error = await response.json();
            showNotification(error.error || 'Erro ao salvar cidade', 'error');
        }
    } catch (error) {
        showNotification('Erro ao salvar cidade: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

async function deleteCidade(id, nome) {
    if (!confirm(`Tem certeza que deseja excluir a cidade "${nome}"?`)) return;

    showLoading(true);
    try {
        const response = await fetch(`/config/api/cidades-config/${id}`, { method: 'DELETE' });
        if (response.ok) {
            showNotification('Cidade excluída com sucesso!', 'success');
            await loadAllData();
        } else {
            showNotification('Erro ao excluir cidade', 'error');
        }
    } catch (error) {
        showNotification('Erro ao excluir cidade: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

// ==== SLA ====

function editSLA(id) {
    const sla = allData.sla.find(s => s.id === id);
    if (sla) {
        document.getElementById('slaId').value = sla.id;
        document.getElementById('slaPrioridade').value = sla.prioridade;
        document.getElementById('slaTempo').value = sla.tempo_dias;
        document.getElementById('slaDescricao').value = sla.descricao || '';
        openModal('modalSLA');
    }
}

async function saveSLA(event) {
    event.preventDefault();
    showLoading(true);

    const id = document.getElementById('slaId').value;
    const data = {
        tempo_dias: parseInt(document.getElementById('slaTempo').value),
        descricao: document.getElementById('slaDescricao').value || null
    };

    try {
        const response = await fetch(`/config/api/sla/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (response.ok) {
            showNotification('SLA atualizado com sucesso!', 'success');
            closeModal('modalSLA');
            await loadAllData();
        } else {
            const error = await response.json();
            showNotification(error.error || 'Erro ao atualizar SLA', 'error');
        }
    } catch (error) {
        showNotification('Erro ao atualizar SLA: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

// ==== UTILIDADES ====

function openModal(modalId) {
    document.getElementById(modalId).classList.add('active');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

function showLoading(show) {
    document.getElementById('loading').style.display = show ? 'flex' : 'none';
}

function showNotification(message, type = 'info') {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.className = `notification ${type} show`;

    setTimeout(() => {
        notification.classList.remove('show');
    }, 4000);
}

window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.classList.remove('active');
    }
};
