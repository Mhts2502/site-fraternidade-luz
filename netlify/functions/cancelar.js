exports.handler = async (event) => {
    // Liberação de CORS
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' } };
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    try {
        // === PARTE 1: QUANDO A PÁGINA CARREGA (BUSCAR DADOS PARA EXIBIR NA TELA) ===
        if (event.httpMethod === 'GET') {
            const token = event.queryStringParameters.token;
            if (!token) throw new Error("Token ausente");

            // No banco de dados não existe data_limpa, existe data_agendada
            const buscaResponse = await fetch(`${supabaseUrl}/rest/v1/agendamentos_pacientes?token_cancelamento=eq.${token}&select=nome_paciente,servico_nome,data_agendada`, {
                method: 'GET',
                headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
            });
            
            const dados = await buscaResponse.json();

            if (!dados || dados.length === 0) {
                return { statusCode: 404, headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ erro: "Agendamento não encontrado ou já cancelado." }) };
            }

            return { statusCode: 200, headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ paciente: dados[0] }) };
        }

        // === PARTE 2: QUANDO A PESSOA CLICA EM CANCELAR (DELETAR E AVISAR) ===
        if (event.httpMethod === 'POST') {
            const { token } = JSON.parse(event.body);
            if (!token) throw new Error("Token ausente");

            // 1. Busca os dados completos para saber a qual dia pertence
            const buscaResponse = await fetch(`${supabaseUrl}/rest/v1/agendamentos_pacientes?token_cancelamento=eq.${token}&select=*`, {
                method: 'GET',
                headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
            });
            const dadosPaciente = await buscaResponse.json();

            if (dadosPaciente && dadosPaciente.length > 0) {
                const p = dadosPaciente[0];
                const atendimentoId = p.atendimento_id;
                
                // Formata a data de (AAAA-MM-DD) para o padrão brasileiro (DD/MM/AAAA)
                let dataBR = p.data_agendada;
                if(p.data_agendada) {
                    dataBR = p.data_agendada.split('-').reverse().join('/');
                }
                
                // 2. Deleta a linha do Supabase (A trigger do banco vai devolver a vaga automaticamente)
                await fetch(`${supabaseUrl}/rest/v1/agendamentos_pacientes?token_cancelamento=eq.${token}`, {
                    method: 'DELETE',
                    headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
                });

                // 3. Lê como as vagas ficaram após a exclusão
                const buscaDia = await fetch(`${supabaseUrl}/rest/v1/atendimentos_disponiveis?id=eq.${atendimentoId}&select=vagas_totais,vagas_ocupadas`, {
                    method: 'GET',
                    headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
                });
                const dadosDia = await buscaDia.json();

                let vagasRestantes = 0;
                if (dadosDia && dadosDia.length > 0) {
                    vagasRestantes = dadosDia[0].vagas_totais - dadosDia[0].vagas_ocupadas;
                }

                // 4. Avisa o Telegram (Agora com a data correta)
                const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
                const telegramChatId = process.env.TELEGRAM_CHAT_ID;
                const msg = `❌ *AGENDAMENTO CANCELADO*\n\n👤 *Nome:* ${p.nome_paciente}\n📱 *WhatsApp:* ${p.telefone}\n🗓 *Serviço:* ${p.servico_nome} (${dataBR})\n\n🟢 *${vagasRestantes} vaga(s)* disponíveis para este dia.`;

                await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ chat_id: telegramChatId, text: msg, parse_mode: 'Markdown' })
                }).catch(err => console.error("Erro Telegram:", err));
            }

            return { statusCode: 200, headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ sucesso: true }) };
        }

        return { statusCode: 405, body: 'Método não permitido' };

    } catch (error) {
        return { statusCode: 500, headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ sucesso: false, erro: error.message }) };
    }
};