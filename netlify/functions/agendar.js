exports.handler = async (event, context) => {
    // 1. Liberação de CORS
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' } };
    }

    if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Método não permitido' };

    try {
        const dadosPaciente = JSON.parse(event.body);
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        // ==========================================
        // A0: TRAVA ANTI-DUPLICIDADE (MESMO CPF E SERVIÇO)
        // ==========================================
        const hoje = new Date().toISOString().split('T')[0];
        
        // O Pulo do Gato: Converter o nome bonito do front-end para o nome técnico do banco
        const nomeServicoBanco = dadosPaciente.servico_nome === 'Foto Kirlian' ? 'Foto Kirlian' : 'Psicologico';
        
        const servicoEncoded = encodeURIComponent(nomeServicoBanco);
        const cpfEncoded = encodeURIComponent(dadosPaciente.cpf);
        
        // Pergunta ao banco se existe esse CPF, nesse serviço, em uma data >= hoje
        const buscaDuplicata = await fetch(`${supabaseUrl}/rest/v1/agendamentos_pacientes?cpf=eq.${cpfEncoded}&servico_nome=eq.${servicoEncoded}&data_agendada=gte.${hoje}&select=id`, {
            method: 'GET',
            headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
        });
        
        const dadosDuplicata = await buscaDuplicata.json();
        
        // Se achou, barra a inscrição e devolve o erro customizado!
        if (dadosDuplicata && dadosDuplicata.length > 0) {
            return { 
                statusCode: 400, 
                headers: { 'Access-Control-Allow-Origin': '*' }, 
                body: JSON.stringify({ 
                    sucesso: false, 
                    erro: `O CPF ${dadosPaciente.cpf} já possui um agendamento ativo para ${dadosPaciente.servico_nome}. Aguarde a data passar ou cancele o atual para marcar novamente.` 
                }) 
            };
        }

        // ==========================================
        // A: SALVAR NO SUPABASE
        // ==========================================
        const supabaseResponse = await fetch(`${supabaseUrl}/rest/v1/agendamentos_pacientes`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
                'Prefer': 'return=representation'
            },
            body: JSON.stringify({
                atendimento_id: dadosPaciente.atendimento_id,
                nome_paciente: dadosPaciente.nome_paciente,
                email: dadosPaciente.email,
                telefone: dadosPaciente.telefone,
                cpf: dadosPaciente.cpf
            })
        });

        if (!supabaseResponse.ok) {
            const erroSupabase = await supabaseResponse.text();
            throw new Error(`Erro no Supabase: ${erroSupabase}`);
        }

        const pacienteSalvo = await supabaseResponse.json();
        const tokenCancelamento = pacienteSalvo[0].token_cancelamento;

        // ==========================================
        // B: BUSCAR VAGAS RESTANTES (O BANCO JÁ SUBTRAIU VIA TRIGGER)
        // ==========================================
        const buscaDia = await fetch(`${supabaseUrl}/rest/v1/atendimentos_disponiveis?id=eq.${dadosPaciente.atendimento_id}&select=vagas_totais,vagas_ocupadas`, {
            method: 'GET',
            headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
        });
        const dadosDia = await buscaDia.json();

        let vagasRestantes = 0;
        if (dadosDia && dadosDia.length > 0) {
            vagasRestantes = dadosDia[0].vagas_totais - dadosDia[0].vagas_ocupadas;
        }

        // ==========================================
        // C: AVISO NO TELEGRAM
        // ==========================================
        const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
        const telegramChatId = process.env.TELEGRAM_CHAT_ID;
        
        const mensagemTelegram = `
✅ *NOVO AGENDAMENTO!*
👤 *Nome:* ${dadosPaciente.nome_paciente}
📱 *WhatsApp:* ${dadosPaciente.telefone}
🛠 *Serviço:* ${dadosPaciente.servico_nome}
📅 *Data:* ${dadosPaciente.data_limpa}

🟢 *${vagasRestantes} vaga(s)* restantes para este dia.
        `;

        await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: telegramChatId, text: mensagemTelegram, parse_mode: 'Markdown' })
        }).catch(err => console.error("Falha no Telegram:", err));

        // ==========================================
        // D: ENVIO DE E-MAIL VIA RESEND
        // ==========================================
        const linkCancelamento = `https://gsfraternidadedaluz.com.br/cancelar.html?token=${tokenCancelamento}`;
        
        const htmlEmail = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px;">
            <div style="background-color: #1a3673; color: #ffffff; padding: 20px; text-align: center;">
                <h1 style="margin: 0; font-size: 24px;">Fraternidade da Luz</h1>
                <p style="margin: 5px 0 0; font-size: 14px; text-transform: uppercase; color: #d4af37;">Confirmação de Agendamento</p>
            </div>
            <div style="padding: 30px; color: #333333;">
                <p>Olá <strong>${dadosPaciente.nome_paciente}</strong>,</p>
                <p>Sua vaga está garantida!</p>
                <div style="background-color: #f9f9f9; border-left: 4px solid #1a3673; padding: 15px; margin: 20px 0;">
                    <p><strong>Serviço:</strong> ${dadosPaciente.servico_nome}</p>
                    <p><strong>Data:</strong> ${dadosPaciente.data_limpa}</p>
                    <p><strong>Horário:</strong> Das 18h30 às 20h30 (ordem de chegada)</p>
                    <p><strong>Local:</strong> Rua Alaíde, 307 - Cordeiro, Recife - PE</p>
                </div>
                <div style="background-color: #ffebee; border: 1px solid #ffcdd2; color: #c62828; padding: 15px; margin: 20px 0;">
                    <p style="margin: 0;"><strong>⚠️ Importante:</strong> Lembre-se das nossas regras de vestimenta (não é permitido bermuda, shorts, regata, decote, roupas transparentes ou coladas). O descumprimento impede o acesso ao local.</p>
                </div>
                <p style="margin-top: 30px; font-size: 14px;">Se ocorreu algum imprevisto e você não puder comparecer, por favor, clique no link abaixo para cancelar sua vaga e dar oportunidade a outro irmão:</p>
                <a href="${linkCancelamento}" style="display: inline-block; margin-top: 10px; background-color: #c62828; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">CANCELAR MEU AGENDAMENTO</a>
            </div>
        </div>
        `;

        await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                from: 'Fraternidade da Luz <agendamentos@gsfraternidadedaluz.com.br>',
                to: dadosPaciente.email,
                reply_to: 'gsfraternidadedaluz@gmail.com',
                subject: 'Confirmação de Agendamento - Fraternidade da Luz',
                html: htmlEmail
            })
        }).catch(err => console.error("Falha no Resend:", err));

        // ==========================================
        // E: RESPOSTA DE SUCESSO PARA O SITE
        // ==========================================
        return { statusCode: 200, headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ sucesso: true }) };

    } catch (error) {
        console.error("Erro geral no fluxo:", error);
        return { statusCode: 500, headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ sucesso: false, erro: error.message }) };
    }
};