// Estado global
let currentTab = 'credenciadores';
let todasCidades = [];

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    setupTabs();
    loadAllData();
});

// Setup de tabs
function setupTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabName = btn.dataset.tab;
            switchTab(tabName);
        });
    });
}

// Trocar tab
function switchTab(tabName) {
    currentTab = tabName;

    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });

    const activeBtn = document.querySelector(`.tab-btn[data-tab="${tabName}"]`);
    const activeContent = document.getElementById(`tab-${tabName}`);

    if (activeBtn) activeBtn.classList.add('active');
    if (activeContent) activeContent.classList.add('active');
}

// Carregar todos os dados
async function loadAllData() {
    await Promise.all([
        loadCredenciadores(),
        loadResponsaveis(),
        loadCidades(),
        loadSLA()
    ]);
}

// ==== CREDENCIADORES ====

async function loadCredenciadores() {
    try {
        const response = await fetch('/config/api/credenciadores');
        const data = await response.json();

        const tbody = document.getElementById('credenciadoresTable');
        tbody.innerHTML = '';

        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 40px; color: var(--text-light);">Nenhum credenciador cadastrado</td></tr>';
            return;
        }

        data.forEach(cred => {
            const row = document.createElement('tr');
            const statusClass = cred.ativo ? 'status-active' : 'status-inactive';
            const statusText = cred.ativo ? 'Ativo' : 'Inativo';

            // Criar tags visuais para cidades vinculadas
            let cidadesHtml = '-';
            if (cred.cidades_vinculadas && cred.cidades_vinculadas.length > 0) {
                cidadesHtml = '<div class="cidade-tags">' +
                    cred.cidades_vinculadas.map(c => `<span class="cidade-tag">${c}</span>`).join('') +
                    '</div>';
            }

            row.innerHTML = `
                <td><strong>${cred.nome}</strong></td>
                <td>${cred.cidade}</td>
                <td>${cidadesHtml}</td>
                <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                <td class="table-actions">
                    <button class="btn-edit" onclick="editCredenciador(${cred.id})">Editar</button>
                    <button class="btn-delete" onclick="deleteCredenciador(${cred.id}, '${cred.nome}')">Excluir</button>
                </td>
            `;
            tbody.appendChild(row);
        });
    } catch (error) {
        showNotification('Erro ao carregar credenciadores: ' + error.message, 'error');
    }
}

async function openCredenciadorModal(id = null) {
    document.getElementById('credenciadorModalTitle').textContent = id ? 'Editar Credenciador' : 'Novo Credenciador';
    document.getElementById('formCredenciador').reset();
    document.getElementById('credenciadorId').value = id || '';
    document.getElementById('credenciadorAtivo').checked = true;

    // Carregar lista de cidades no select
    await populateCidadesSelect();

    if (id) {
        fetch(`/config/api/credenciadores`)
            .then(res => res.json())
            .then(data => {
                const cred = data.find(c => c.id === id);
                if (cred) {
                    document.getElementById('credenciadorNome').value = cred.nome;
                    document.getElementById('credenciadorCidade').value = cred.cidade;
                    document.getElementById('credenciadorAtivo').checked = cred.ativo;

                    // Selecionar cidades vinculadas
                    const select = document.getElementById('credenciadorCidadesVinculadas');
                    const vinculadas = cred.cidades_vinculadas || [];
                    Array.from(select.options).forEach(option => {
                        option.selected = vinculadas.includes(option.text);
                    });
                }
            });
    }

    openModal('modalCredenciador');
}

async function populateCidadesSelect() {
    try {
        const response = await fetch('/config/api/cidades-config');
        const cidades = await response.json();
        todasCidades = cidades;

        const select = document.getElementById('credenciadorCidadesVinculadas');
        select.innerHTML = '';

        cidades.filter(c => c.ativa).forEach(cidade => {
            const option = document.createElement('option');
            option.value = cidade.id;
            option.textContent = `${cidade.nome} - ${cidade.estado}`;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Erro ao carregar cidades:', error);
    }
}

function editCredenciador(id) {
    openCredenciadorModal(id);
}

async function saveCredenciador(event) {
    event.preventDefault();
    showLoading(true);

    const id = document.getElementById('credenciadorId').value;

    // Pegar IDs das cidades selecionadas
    const select = document.getElementById('credenciadorCidadesVinculadas');
    const cidadesSelecionadas = Array.from(select.selectedOptions).map(opt => parseInt(opt.value));

    const data = {
        nome: document.getElementById('credenciadorNome').value,
        cidade: document.getElementById('credenciadorCidade').value,
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
            await loadCredenciadores();
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
    if (!confirm(`Tem certeza que deseja excluir o credenciador "${nome}"?`)) {
        return;
    }

    showLoading(true);

    try {
        const response = await fetch(`/config/api/credenciadores/${id}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            showNotification('Credenciador excluído com sucesso!', 'success');
            await loadCredenciadores();
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

async function loadResponsaveis() {
    try {
        const response = await fetch('/config/api/responsaveis');
        const data = await response.json();

        const tbody = document.getElementById('responsaveisTable');
        tbody.innerHTML = '';

        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 40px; color: var(--text-light);">Nenhum responsável cadastrado</td></tr>';
            return;
        }

        data.forEach(resp => {
            const row = document.createElement('tr');
            const statusClass = resp.ativo ? 'status-active' : 'status-inactive';
            const statusText = resp.ativo ? 'Ativo' : 'Inativo';

            row.innerHTML = `
                <td><strong>${resp.nome}</strong></td>
                <td>${resp.email || '-'}</td>
                <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                <td class="table-actions">
                    <button class="btn-edit" onclick="editResponsavel(${resp.id})">Editar</button>
                    <button class="btn-delete" onclick="deleteResponsavel(${resp.id}, '${resp.nome}')">Excluir</button>
                </td>
            `;
            tbody.appendChild(row);
        });
    } catch (error) {
        showNotification('Erro ao carregar responsáveis: ' + error.message, 'error');
    }
}

function openResponsavelModal(id = null) {
    document.getElementById('responsavelModalTitle').textContent = id ? 'Editar Responsável' : 'Novo Responsável';
    document.getElementById('formResponsavel').reset();
    document.getElementById('responsavelId').value = id || '';
    document.getElementById('responsavelAtivo').checked = true;

    if (id) {
        fetch(`/config/api/responsaveis`)
            .then(res => res.json())
            .then(data => {
                const resp = data.find(r => r.id === id);
                if (resp) {
                    document.getElementById('responsavelNome').value = resp.nome;
                    document.getElementById('responsavelEmail').value = resp.email || '';
                    document.getElementById('responsavelAtivo').checked = resp.ativo;
                }
            });
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
            await loadResponsaveis();
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
    if (!confirm(`Tem certeza que deseja excluir o responsável "${nome}"?`)) {
        return;
    }

    showLoading(true);

    try {
        const response = await fetch(`/config/api/responsaveis/${id}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            showNotification('Responsável excluído com sucesso!', 'success');
            await loadResponsaveis();
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

async function loadCidades() {
    try {
        const response = await fetch('/config/api/cidades-config');
        const data = await response.json();

        const tbody = document.getElementById('cidadesTable');
        tbody.innerHTML = '';

        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 40px; color: var(--text-light);">Nenhuma cidade cadastrada</td></tr>';
            return;
        }

        data.forEach(cidade => {
            const row = document.createElement('tr');
            const statusClass = cidade.ativa ? 'status-active' : 'status-inactive';
            const statusText = cidade.ativa ? 'Ativa' : 'Inativa';

            row.innerHTML = `
                <td><strong>${cidade.nome}</strong></td>
                <td>${cidade.estado}</td>
                <td>${cidade.num_credenciadores || 0}</td>
                <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                <td><small>${cidade.observacoes || '-'}</small></td>
                <td class="table-actions">
                    <button class="btn-edit" onclick="editCidade(${cidade.id})">Editar</button>
                    <button class="btn-delete" onclick="deleteCidade(${cidade.id}, '${cidade.nome}')">Excluir</button>
                </td>
            `;
            tbody.appendChild(row);
        });
    } catch (error) {
        showNotification('Erro ao carregar cidades: ' + error.message, 'error');
    }
}

function openCidadeModal(id = null) {
    document.getElementById('cidadeModalTitle').textContent = id ? 'Editar Cidade' : 'Nova Cidade';
    document.getElementById('formCidade').reset();
    document.getElementById('cidadeId').value = id || '';
    document.getElementById('cidadeAtiva').checked = true;

    if (id) {
        fetch(`/config/api/cidades-config`)
            .then(res => res.json())
            .then(data => {
                const cidade = data.find(c => c.id === id);
                if (cidade) {
                    document.getElementById('cidadeNome').value = cidade.nome;
                    document.getElementById('cidadeEstado').value = cidade.estado;
                    document.getElementById('cidadeObservacoes').value = cidade.observacoes || '';
                    document.getElementById('cidadeAtiva').checked = cidade.ativa;
                }
            });
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
            await loadCidades();
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
    if (!confirm(`Tem certeza que deseja excluir a cidade "${nome}"?`)) {
        return;
    }

    showLoading(true);

    try {
        const response = await fetch(`/config/api/cidades-config/${id}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            showNotification('Cidade excluída com sucesso!', 'success');
            await loadCidades();
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

async function loadSLA() {
    try {
        const response = await fetch('/config/api/sla');
        const data = await response.json();

        const tbody = document.getElementById('slaTable');
        tbody.innerHTML = '';

        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 40px; color: var(--text-light);">Nenhuma configuração de SLA</td></tr>';
            return;
        }

        data.forEach(sla => {
            const row = document.createElement('tr');

            row.innerHTML = `
                <td>
                    <span class="sla-badge" style="background: ${sla.cor_badge || '#ccc'}"></span>
                    <strong>${sla.prioridade}</strong>
                </td>
                <td><strong>${sla.tempo_dias} ${sla.tempo_dias === 1 ? 'dia' : 'dias'}</strong></td>
                <td><small>${sla.descricao || '-'}</small></td>
                <td class="table-actions">
                    <button class="btn-edit" onclick="editSLA(${sla.id})">Editar</button>
                </td>
            `;
            tbody.appendChild(row);
        });
    } catch (error) {
        showNotification('Erro ao carregar SLA: ' + error.message, 'error');
    }
}

function editSLA(id) {
    fetch(`/config/api/sla`)
        .then(res => res.json())
        .then(data => {
            const sla = data.find(s => s.id === id);
            if (sla) {
                document.getElementById('slaId').value = sla.id;
                document.getElementById('slaPrioridade').value = sla.prioridade;
                document.getElementById('slaTempo').value = sla.tempo_dias;
                document.getElementById('slaDescricao').value = sla.descricao || '';

                openModal('modalSLA');
            }
        });
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
            await loadSLA();
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
    document.getElementById('loading').style.display = show ? 'block' : 'none';
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
    if (event.target.classList.contains('modal')) {
        event.target.classList.remove('active');
    }
};
