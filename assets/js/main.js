const supabaseUrl = 'https://itluckffjkbpkzorobwa.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml0bHVja2ZmamticGt6b3JvYndhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5MzE5MDMsImV4cCI6MjA4NjUwNzkwM30.xZfVUPFyGI9t5MoEO5oBssAp0spo-Ybf_WkK-b3b8q0';
window.supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

window.servicoAtual = '';

// Função do Carrossel (Motor Blindado contra Bugs e Spam de Cliques)
window.moverCarrossel = function(id, direcao) {
    const carrossel = document.getElementById(id);
    if (!carrossel) return;

    // 1. Trava anti-spam: se já estiver movendo, ignora o dedo nervoso do paciente
    if (carrossel.dataset.travado === 'true') return;
    carrossel.dataset.travado = 'true';
    setTimeout(() => { carrossel.dataset.travado = 'false'; }, 500); // Libera o clique após 0.5s

    // 2. Cálculo Matemático Absoluto (Impossível parar no meio do caminho)
    const larguraSlide = carrossel.clientWidth;
    const totalSlides = carrossel.children.length;
    
    // Descobre EXATAMENTE em qual foto estamos agora com base no pixel de rolagem
    let fotoAtual = Math.round(carrossel.scrollLeft / larguraSlide);
    let proximaFoto = fotoAtual + direcao;

    // 3. Sistema de Loop Infinito
    if (proximaFoto >= totalSlides) {
        proximaFoto = 0; // Se passou da última, volta para a primeira
    } else if (proximaFoto < 0) {
        proximaFoto = totalSlides - 1; // Se voltou na primeira, vai para a última
    }

    // 4. Manda o navegador ir diretamente para o pixel zero da foto exata
    carrossel.scrollTo({ left: proximaFoto * larguraSlide, behavior: 'smooth' });
    
    // 5. Reseta o timer automático para ele não passar a foto do nada logo após o paciente clicar
    window.iniciarCarrosselAuto();
};

// Função de Auto-Play Inteligente
window.iniciarCarrosselAuto = function() {
    // Limpa o timer anterior para não encavalar
    if(window.timerCarrossel) clearInterval(window.timerCarrossel);
    
    // Cria um relógio novo que passa a foto a cada 4 segundos
    window.timerCarrossel = setInterval(() => {
        if(document.getElementById('carrossel-sopa')) {
            window.moverCarrossel('carrossel-sopa', 1);
        }
    }, 4000); 
};

window.mostrarAlerta = function(titulo, mensagem, tipo = 'sucesso') {
    const existente = document.getElementById('modal-alerta-customizado');
    if (existente) {
        existente.remove();
    }

    const overlay = document.createElement('div');
    overlay.id = 'modal-alerta-customizado';
    overlay.className = 'fixed inset-0 z-[200] flex items-center justify-center bg-brand-blue/90 backdrop-blur-sm opacity-0 transition-opacity duration-300';
    
    const modal = document.createElement('div');
    modal.className = 'bg-white p-8 md:p-10 rounded-3xl shadow-2xl flex flex-col items-center text-center max-w-sm mx-4 transform scale-95 transition-all duration-300 border-t-8 ' + (tipo === 'sucesso' ? 'border-green-500' : 'border-red-500');
    
    const isSucesso = tipo === 'sucesso';
    const iconCor = isSucesso ? 'text-green-500 bg-green-50' : 'text-red-500 bg-red-50';
    const iconName = isSucesso ? 'check-circle-2' : 'alert-triangle';
    
    modal.innerHTML = `
        <div class="w-20 h-20 rounded-full flex items-center justify-center mb-6 shadow-inner ${iconCor}">
            <i data-lucide="${iconName}" class="w-10 h-10"></i>
        </div>
        <h3 class="text-2xl font-serif font-bold text-brand-blue mb-3">${titulo}</h3>
        <p class="text-gray-600 mb-8 leading-relaxed font-medium">${mensagem}</p>
        <button id="btn-fechar-alerta" class="w-full py-4 bg-brand-blue text-white rounded-xl font-bold hover:bg-brand-gold transition duration-300 shadow-md tracking-wide">
            ${isSucesso ? 'OK, ENTENDIDO' : 'TENTAR NOVAMENTE'}
        </button>
    `;
    
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    
    if(window.lucide) {
        lucide.createIcons();
    }
    
    setTimeout(() => {
        overlay.classList.remove('opacity-0');
        modal.classList.remove('scale-95');
    }, 10);
    
    document.getElementById('btn-fechar-alerta').addEventListener('click', () => {
        overlay.classList.add('opacity-0');
        modal.classList.add('scale-95');
        setTimeout(() => overlay.remove(), 300);
    });
};

window.carregarDatas = async function(servicoModal) {
    const select = document.getElementById('dataAgendamento');
    if(!select) return;

    select.innerHTML = '<option value="" disabled selected>Buscando dias disponíveis...</option>';
    select.disabled = true;

    const tipoNoBanco = servicoModal === 'Foto Kirlian' ? 'Foto Kirlian' : 'Psicologico';
    const hoje = new Date().toISOString().split('T')[0];

    try {
        const { data, error } = await window.supabaseClient
            .from('atendimentos_disponiveis')
            .select('*')
            .eq('tipo_servico', tipoNoBanco)
            .eq('status', 'aberto')
            .gte('data_atendimento', hoje)
            .order('data_atendimento', { ascending: true });

        if (error) throw error;

        select.innerHTML = '<option value="" disabled selected>Selecione um dia livre...</option>';
        const diasComVaga = data.filter(d => d.vagas_ocupadas < d.vagas_totais);

        if (diasComVaga.length > 0) {
            diasComVaga.forEach(d => {
                const partes = d.data_atendimento.split('-');
                const dataFormatada = `${partes[2]}/${partes[1]}/${partes[0]}`;
                const vagasRestantes = d.vagas_totais - d.vagas_ocupadas;
                select.innerHTML += `<option value="${d.id}">${dataFormatada} (${vagasRestantes} vagas restantes)</option>`;
            });
            select.disabled = false;
        } else {
            select.innerHTML = '<option value="" disabled selected>Nenhuma vaga disponível :(</option>';
        }
    } catch (err) {
        console.error("Erro ao buscar datas:", err);
        select.innerHTML = '<option value="" disabled selected>Erro ao carregar datas</option>';
    }
};

window.abrirModal = function(servico) {
    const modal = document.getElementById('modalAgendamento');
    const caixa = document.getElementById('caixaModal');
    const titulo = document.getElementById('nomeServicoModal');
    
    if (!modal) return; 

    // Trava absoluta de scroll (resolve o bug no iPhone e Android)
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    window.servicoAtual = servico;
    if(titulo) {
        titulo.textContent = servico;
    }
    
    window.limparErros();
    window.carregarDatas(servico); 
    
    modal.classList.remove('hidden');
    setTimeout(() => {
        caixa.classList.remove('scale-95', 'opacity-0');
        caixa.classList.add('scale-100', 'opacity-100');
        caixa.scrollTop = 0;
    }, 10);
};

window.fecharModal = function() {
    const modal = document.getElementById('modalAgendamento');
    const caixa = document.getElementById('caixaModal');
    if (!modal || !caixa) return;

    caixa.classList.remove('scale-100', 'opacity-100');
    caixa.classList.add('scale-95', 'opacity-0');
    
    setTimeout(() => {
        modal.classList.add('hidden');
        // Destrava o scroll quando fechar
        document.body.style.overflow = '';
        document.documentElement.style.overflow = '';
        const form = document.getElementById('formPaciente');
        if(form) {
            form.reset(); 
        }
        window.limparErros();
    }, 300); 
};

window.limparErros = function() {
    const campos = ['nome', 'email', 'whatsapp', 'cpf', 'dataAgendamento'];
    campos.forEach(id => {
        const input = document.getElementById(id);
        const msgErro = document.getElementById(`erro-${id}`);
        if(input) {
            input.classList.remove('border-red-500', 'ring-red-200');
        }
        if(msgErro) {
            msgErro.classList.add('hidden');
        }
    });
};

window.mostrarErro = function(id) {
    const input = document.getElementById(id);
    const msgErro = document.getElementById(`erro-${id}`);
    if(input && msgErro) {
        input.classList.add('border-red-500', 'ring-red-200');
        msgErro.classList.remove('hidden');
        input.classList.add('animate-pulse');
        setTimeout(() => {
            input.classList.remove('animate-pulse');
        }, 500);
    }
};

// Máscaras Blindadas: Removem letras primeiro, cortam o excesso e depois formatam
window.mascaraTelefone = function(v) {
    v = v.replace(/\D/g, "").slice(0, 11);
    v = v.replace(/^(\d{2})(\d)/g, "($1) $2");
    v = v.replace(/(\d)(\d{4})$/, "$1-$2");
    return v;
};

window.mascaraCPF = function(v) {
    v = v.replace(/\D/g, "").slice(0, 11);
    v = v.replace(/(\d{3})(\d)/, "$1.$2");
    v = v.replace(/(\d{3})(\d)/, "$1.$2");
    v = v.replace(/(\d{3})(\d{1,2})$/, "$1-$2");
    return v;
};

window.mascaraCEP = function(v) {
    v = v.replace(/\D/g, "").slice(0, 8);
    v = v.replace(/^(\d{5})(\d)/, "$1-$2");
    return v;
};

function reconfigurarInterface() {
    // 1. Pega o caminho atual
    let path = window.location.pathname;
    
    // 2. Se for a raiz do site (/) ou vazio, forçamos para 'index'. Se não, limpamos a URL.
    if (path === '/' || path === '') {
        path = 'index';
    } else {
        path = path.split('/').filter(Boolean).pop().replace('.html', '');
    }
    
    // 3. Função interna inteligente para limpar os botões do menu
    const limparHref = (href) => {
        if (!href || href === '/' || href === 'index.html' || href === 'index') return 'index';
        return href.split('/').filter(Boolean).pop().replace('.html', '');
    };

    // Aplica no Desktop
    document.querySelectorAll('#nav-desktop-links a').forEach(link => {
        let hrefLimpo = limparHref(link.getAttribute('href'));
        
        if (hrefLimpo === path) {
            link.className = "text-brand-gold border-b-2 border-brand-gold pb-1 transition-all duration-300 font-medium text-sm tracking-wide";
        } else {
            link.className = "text-white border-b-2 border-transparent pb-1 hover:text-brand-gold transition-all duration-300 font-medium text-sm tracking-wide";
        }
    });

    // Aplica no Mobile
    document.querySelectorAll('#mobile-menu a').forEach(link => {
        let hrefLimpo = limparHref(link.getAttribute('href'));
        
        link.className = "block text-white hover:text-brand-gold font-medium border-b border-white/10 pb-2 transition-all duration-300";
        if (hrefLimpo === path) {
            link.classList.remove('text-white', 'font-medium');
            link.classList.add('text-brand-gold', 'font-bold', 'border-l-4', 'border-brand-gold', 'pl-3', 'bg-brand-blue/50');
        }
    });

    const btn = document.getElementById('mobile-menu-btn');
    const menu = document.getElementById('mobile-menu');
    
    if(btn && menu) {
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        
        const iconMenu = newBtn.querySelector('#icon-menu');
        const iconClose = newBtn.querySelector('#icon-close');

        menu.classList.add('hidden');
        if(iconMenu && iconClose) {
            iconMenu.classList.remove('rotate-90', 'scale-50', 'opacity-0');
            iconMenu.classList.add('rotate-0', 'scale-100', 'opacity-100');
            iconClose.classList.remove('rotate-0', 'scale-100', 'opacity-100');
            iconClose.classList.add('-rotate-90', 'scale-50', 'opacity-0');
        }

        const toggleMenu = () => {
            const isOpening = menu.classList.contains('hidden');
            menu.classList.toggle('hidden');

            if (isOpening) {
                iconMenu.classList.remove('rotate-0', 'scale-100', 'opacity-100');
                iconMenu.classList.add('rotate-90', 'scale-50', 'opacity-0');
                iconClose.classList.remove('-rotate-90', 'scale-50', 'opacity-0');
                iconClose.classList.add('rotate-0', 'scale-100', 'opacity-100');
            } else {
                iconMenu.classList.remove('rotate-90', 'scale-50', 'opacity-0');
                iconMenu.classList.add('rotate-0', 'scale-100', 'opacity-100');
                iconClose.classList.remove('rotate-0', 'scale-100', 'opacity-100');
                iconClose.classList.add('-rotate-90', 'scale-50', 'opacity-0');
            }
        };

        newBtn.addEventListener('click', (e) => {
            e.stopPropagation(); 
            toggleMenu();
        });

        menu.querySelectorAll('a').forEach(l => l.addEventListener('click', () => {
            if(!menu.classList.contains('hidden')) {
                toggleMenu();
            }
        }));

        document.addEventListener('click', (e) => {
            if (!menu.contains(e.target) && !newBtn.contains(e.target) && !menu.classList.contains('hidden')) {
                toggleMenu();
            }
        });
    }

    const inWhatsapp = document.getElementById('whatsapp');
    const inCpf = document.getElementById('cpf');
    const inCep = document.getElementById('cep');
    const inNascimento = document.getElementById('nascimento');
    const form = document.getElementById('formPaciente');

    if(inWhatsapp) {
        inWhatsapp.oninput = (e) => e.target.value = window.mascaraTelefone(e.target.value);
    }
    if(inCpf) {
        inCpf.oninput = (e) => e.target.value = window.mascaraCPF(e.target.value);
    }
    if(inCep) {
        inCep.oninput = (e) => e.target.value = window.mascaraCEP(e.target.value);
    }

    

    if(form) {
        form.onsubmit = async function(e) {
            e.preventDefault(); 
            window.limparErros(); 
            let valido = true;
            
            if(!document.getElementById('nome').value.trim()) { window.mostrarErro('nome'); valido = false; }
            if(!document.getElementById('email').value.trim()) { window.mostrarErro('email'); valido = false; }
            if(!document.getElementById('whatsapp').value.trim()) { window.mostrarErro('whatsapp'); valido = false; }
            if(!document.getElementById('cpf').value.trim()) { window.mostrarErro('cpf'); valido = false; }
            if(!document.getElementById('dataAgendamento').value) { window.mostrarErro('dataAgendamento'); valido = false; }

            if(valido) {
                const btn = document.getElementById('btnConfirmar');
                const textoOriginal = btn.innerHTML;
                btn.innerHTML = '<i data-lucide="loader-2" class="w-5 h-5 animate-spin"></i> PROCESSANDO...';
                
                const selectEl = document.getElementById('dataAgendamento');
                const textoOpcao = selectEl.options[selectEl.selectedIndex].text;
                const dataLimpa = textoOpcao.split(' ')[0];

                const dadosPaciente = {
                    atendimento_id: document.getElementById('dataAgendamento').value,
                    nome_paciente: document.getElementById('nome').value.trim(),
                    email: document.getElementById('email').value.trim(),
                    telefone: document.getElementById('whatsapp').value.trim(),
                    cpf: document.getElementById('cpf').value.trim(),
                    servico_nome: window.servicoAtual,
                    data_limpa: dataLimpa
                };

                try {
                    const response = await fetch('/.netlify/functions/agendar', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(dadosPaciente)
                    });

                    const resultado = await response.json();

                    if(response.ok && resultado.sucesso) {
                        window.fecharModal();
                        setTimeout(() => {
                            window.mostrarAlerta(
                                "Agendamento Confirmado!", 
                                "Sua vaga foi reservada com sucesso. Enviamos a confirmação e as orientações para o seu e-mail."
                            );
                        }, 300);
                    } else {
                        window.fecharModal();
                        setTimeout(() => {
                            window.mostrarAlerta("Aviso", resultado.erro || "Ocorreu um erro no servidor.", "erro");
                        }, 300);
                    }
                } catch(error) {
                    console.error(error);
                    window.mostrarAlerta(
                        "Erro de Conexão", 
                        "Verifique sua internet ou tente novamente em alguns instantes.", 
                        "erro"
                    );
                } finally {
                    btn.innerHTML = textoOriginal;
                    if(window.lucide) {
                        lucide.createIcons();
                    }
                }
            } else {
                document.getElementById('caixaModal').scrollTop = 0;
            }
        };
    }
}

function initApp() {
    if(window.lucide) {
        lucide.createIcons();
    }
    reconfigurarInterface(); 
    window.iniciarCarrosselAuto();
}

if(!window.swupInstancia) {
    window.swupInstancia = new Swup({ 
        containers: ["#swup"],
        animateHistoryBrowsing: true 
    });
    
    window.swupInstancia.hooks.on('content:replace', () => { 
        initApp(); 
        window.scrollTo({ top: 0, behavior: 'smooth' }); 
    });
}

initApp();