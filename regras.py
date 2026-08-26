# -*- coding: utf-8 -*-
"""Toda a logica de negocio do sistema Clientes Limbo.

Regras invioalveis:
1. aplicar_evento e o UNICO caminho para alterar a classe de um cliente.
2. A classe SO SOBE (C -> B -> A), nunca desce.
3. Reclassificacoes usam UPSERT pela chave natural (empresa, cod_cliente, loja).
"""
import hashlib
import re
import unicodedata
from datetime import date, datetime, timedelta

ORDEM_CLASSE = {'C': 0, 'B': 1, 'A': 2}

# Regua de contato (tabela 3.4): dia acumulado de cada etapa
DIAS_ETAPA = {0: 0, 1: 3, 2: 10, 3: 20, 4: 30, 5: 45}

ACAO_ETAPA = {
    0: ('EMAIL', 'E-mail de reaproximação'),
    1: ('WHATSAPP', 'WhatsApp'),
    2: ('EMAIL', 'E-mail com oferta e prazo'),
    3: ('WHATSAPP', 'WhatsApp de última chamada'),
    4: ('TELEFONE', 'Telefone'),
    5: ('SISTEMA', 'Encerrar o ciclo'),
}

# Eventos que valem como RESPOSTA (promovem para A)
EVENTOS_RESPOSTA = {'EMAIL_CLICADO', 'EMAIL_RESPONDIDO', 'WHATSAPP_RESPONDIDO',
                    'PEDIU_ORCAMENTO', 'ACEITOU_VISITA'}
# Eventos que valem como VISUALIZACAO (promovem C -> B)
EVENTOS_VISUALIZACAO = {'EMAIL_ABERTO', 'WHATSAPP_VISUALIZADO'}
# Eventos de tentativa de contato (incrementam tentativas e avancam a regua)
EVENTOS_TENTATIVA = {'EMAIL_ENVIADO', 'WHATSAPP_ENVIADO', 'TENTATIVA_SEM_RETORNO'}

TIPOS_EVENTO_VALIDOS = (EVENTOS_RESPOSTA | EVENTOS_VISUALIZACAO | EVENTOS_TENTATIVA |
                        {'EMAIL_DEVOLVIDO', 'NOTA_FISCAL', 'OPT_OUT'})

CANAL_PADRAO = {
    'EMAIL_ENVIADO': 'EMAIL', 'EMAIL_ABERTO': 'EMAIL', 'EMAIL_CLICADO': 'EMAIL',
    'EMAIL_RESPONDIDO': 'EMAIL', 'EMAIL_DEVOLVIDO': 'EMAIL',
    'WHATSAPP_ENVIADO': 'WHATSAPP', 'WHATSAPP_VISUALIZADO': 'WHATSAPP',
    'WHATSAPP_RESPONDIDO': 'WHATSAPP',
    'PEDIU_ORCAMENTO': 'SISTEMA', 'ACEITOU_VISITA': 'SISTEMA',
    'NOTA_FISCAL': 'SISTEMA', 'OPT_OUT': 'SISTEMA',
    'TENTATIVA_SEM_RETORNO': 'TELEFONE',
}

MESES_PT = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho',
            'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']


# ---------------------------------------------------------------- status

def calcular_status(dt_ultima_compra):
    """ATIVO >= 2025 | LIMBO 2019-2024 | MORTO < 2019."""
    # DECISAO: cliente sem data de ultima compra e tratado como MORTO
    if not dt_ultima_compra:
        return 'MORTO'
    ano = int(str(dt_ultima_compra)[:4])
    if ano >= 2025:
        return 'ATIVO'
    if 2019 <= ano <= 2024:
        return 'LIMBO'
    return 'MORTO'


# ---------------------------------------------------------------- classe

def classificar_por_engajamento(conn, id_cliente):
    """Classe A/B/C calculada exclusivamente a partir dos eventos registrados."""
    tipos = {r[0] for r in conn.execute(
        'SELECT DISTINCT tipo_evento FROM eventos WHERE id_cliente = ?', (id_cliente,))}
    if tipos & EVENTOS_RESPOSTA:
        return 'A'
    if tipos & EVENTOS_VISUALIZACAO:
        return 'B'
    return 'C'


# ---------------------------------------------------------------- regua

def proximo_contato(etapa_regua, data_base):
    """Retorna (nova_etapa, nova_data 'YYYY-MM-DD' ou None se ciclo encerrado)."""
    if isinstance(data_base, str):
        data_base = datetime.strptime(data_base[:10], '%Y-%m-%d').date()
    nova_etapa = etapa_regua + 1
    if nova_etapa > 5:
        return (6, None)  # ciclo encerrado
    delta = DIAS_ETAPA[nova_etapa] - DIAS_ETAPA.get(etapa_regua, 0)
    return (nova_etapa, (data_base + timedelta(days=max(delta, 1))).isoformat())


# ---------------------------------------------------------------- evento

def hash_evento(id_cliente, tipo_evento, dt_evento, canal):
    base = f'{id_cliente}|{tipo_evento}|{dt_evento}|{canal or ""}'
    return hashlib.sha256(base.encode('utf-8')).hexdigest()


def aplicar_evento(conn, id_cliente, tipo_evento, canal=None, dt=None,
                   detalhe=None, origem='MANUAL'):
    """UNICO caminho para alterar classe/status/regua de um cliente.

    Grava o evento (deduplicado por hash), atualiza contadores, recalcula a
    classe (que so sobe), avanca a regua e retorna um dict com o que mudou.
    """
    agora = datetime.now()
    dt = dt or agora.strftime('%Y-%m-%d %H:%M:%S')
    canal = canal or CANAL_PADRAO.get(tipo_evento, 'SISTEMA')

    cli = conn.execute('SELECT * FROM clientes WHERE id_cliente = ?', (id_cliente,)).fetchone()
    if cli is None:
        return {'ok': False, 'motivo': 'Cliente não encontrado'}
    if tipo_evento not in TIPOS_EVENTO_VALIDOS:
        return {'ok': False, 'motivo': f'Tipo de evento desconhecido: {tipo_evento}'}

    h = hash_evento(id_cliente, tipo_evento, dt, canal)
    cur = conn.execute(
        'INSERT OR IGNORE INTO eventos (id_cliente, tipo_evento, canal, dt_evento, '
        'detalhe, origem, hash_evento, dt_importacao) VALUES (?,?,?,?,?,?,?,?)',
        (id_cliente, tipo_evento, canal, dt, detalhe, origem, h,
         agora.strftime('%Y-%m-%d %H:%M:%S')))
    if cur.rowcount == 0:
        return {'ok': True, 'duplicado': True, 'promovido': False,
                'classe_anterior': cli['classe'], 'classe_nova': cli['classe']}

    res = {'ok': True, 'duplicado': False, 'classe_anterior': cli['classe'],
           'classe_nova': cli['classe'], 'promovido': False,
           'status_anterior': cli['status'], 'status_novo': cli['status'],
           'mensagens': []}

    dia = dt[:10]
    sets, vals = [], []

    def upd(expr, *v):
        sets.append(expr)
        vals.extend(v)

    # ------- contadores por tipo de evento
    if tipo_evento == 'EMAIL_ENVIADO':
        upd('qtd_emails_enviados = qtd_emails_enviados + 1')
    elif tipo_evento == 'EMAIL_ABERTO':
        upd('qtd_emails_abertos = qtd_emails_abertos + 1')
    elif tipo_evento in ('EMAIL_RESPONDIDO', 'EMAIL_CLICADO'):
        if tipo_evento == 'EMAIL_RESPONDIDO':
            upd('qtd_emails_respondidos = qtd_emails_respondidos + 1')
        upd('respondeu_email = 1')
        upd('dt_ultima_resposta = ?', dt)
    elif tipo_evento == 'WHATSAPP_ENVIADO':
        upd('qtd_whats_enviados = qtd_whats_enviados + 1')
    elif tipo_evento == 'WHATSAPP_VISUALIZADO':
        upd('qtd_whats_visualizados = qtd_whats_visualizados + 1')
    elif tipo_evento == 'WHATSAPP_RESPONDIDO':
        upd('qtd_whats_respondidos = qtd_whats_respondidos + 1')
        upd('respondeu_whatsapp = 1')
        upd('dt_ultima_resposta = ?', dt)
    elif tipo_evento in ('PEDIU_ORCAMENTO', 'ACEITOU_VISITA'):
        upd('dt_ultima_resposta = ?', dt)
        upd('na_fila_batedor = 1')
        res['mensagens'].append('Cliente entrou na fila do batedor')
    elif tipo_evento == 'EMAIL_DEVOLVIDO':
        upd('email_valido = 0')
        res['mensagens'].append('E-mail marcado como inválido')
    elif tipo_evento == 'NOTA_FISCAL':
        upd('status = ?', 'ATIVO')
        upd('dt_reativacao = ?', dia)
        res['status_novo'] = 'ATIVO'
        res['mensagens'].append('Cliente reativado: saiu do LIMBO e voltou a ATIVO')
    elif tipo_evento == 'OPT_OUT':
        upd('opt_out = 1')
        upd('dt_opt_out = ?', dia)
        res['mensagens'].append('Opt-out registrado: cliente sai da régua definitivamente')

    # ------- regua: tentativas de contato avancam etapa e agendam o proximo
    entra_em_quarentena = False
    if tipo_evento in EVENTOS_TENTATIVA:
        upd('qtd_tentativas = qtd_tentativas + 1')
        upd('dt_ultimo_contato = ?', dia)
        nova_etapa, nova_data = proximo_contato(cli['etapa_regua'], dia)
        upd('etapa_regua = ?', nova_etapa)
        upd('dt_proximo_contato = ?', nova_data)
        entra_em_quarentena = cli['qtd_tentativas'] + 1 >= 3 and cli['classe'] == 'C'

    # ------- sinal do cliente zera o contador de tentativas sem retorno
    if tipo_evento in (EVENTOS_RESPOSTA | EVENTOS_VISUALIZACAO):
        upd('qtd_tentativas = 0')

    if sets:
        conn.execute(f'UPDATE clientes SET {", ".join(sets)} WHERE id_cliente = ?',
                     (*vals, id_cliente))

    # 3 tentativas sem nenhum sinal -> 90 dias de quarentena. Em UPDATE proprio
    # para nao atribuir qtd_tentativas duas vezes no mesmo comando.
    if entra_em_quarentena:
        fim = (datetime.strptime(dia, '%Y-%m-%d').date() + timedelta(days=90)).isoformat()
        conn.execute('UPDATE clientes SET dt_fim_quarentena = ?, qtd_tentativas = 0 '
                     'WHERE id_cliente = ?', (fim, id_cliente))
        res['mensagens'].append(f'3 tentativas sem sinal: quarentena até {fim}')

    # ------- recalculo da classe: SO SOBE
    classe_calc = classificar_por_engajamento(conn, id_cliente)
    if ORDEM_CLASSE[classe_calc] > ORDEM_CLASSE[cli['classe']]:
        conn.execute('UPDATE clientes SET classe = ?, dt_mudanca_classe = ? WHERE id_cliente = ?',
                     (classe_calc, dia, id_cliente))
        res['classe_nova'] = classe_calc
        res['promovido'] = True
        res['mensagens'].insert(0, f"Cliente promovido de {cli['classe']} para {classe_calc}")

    conn.commit()
    return res


# ---------------------------------------------------------------- semaforo

def cor_semaforo(qtd_ativos, qtd_limbo, qtd_mortos, qtd_clientes):
    if not qtd_clientes:
        return 'BRANCA'
    if qtd_ativos > 0:
        return 'VERDE'
    if qtd_limbo > 0:
        return 'AMARELA'
    return 'VERMELHA'


def recalcular_cidades(conn):
    """Regenera a tabela `cidades` com LEFT JOIN a partir de `municipios`."""
    conn.execute('DELETE FROM cidades')
    rows = conn.execute("""
        SELECT m.cod_ibge, m.uf,
               COUNT(c.id_cliente)                                    AS qtd_clientes,
               SUM(CASE WHEN c.status = 'ATIVO' THEN 1 ELSE 0 END)    AS qtd_ativos,
               SUM(CASE WHEN c.status = 'LIMBO' THEN 1 ELSE 0 END)    AS qtd_limbo,
               SUM(CASE WHEN c.status = 'MORTO' THEN 1 ELSE 0 END)    AS qtd_mortos,
               SUM(CASE WHEN c.classe = 'A' THEN 1 ELSE 0 END)        AS qtd_a,
               SUM(CASE WHEN c.classe = 'B' THEN 1 ELSE 0 END)        AS qtd_b,
               COALESCE(SUM(c.vlr_historico), 0)                      AS vlr,
               MAX(c.dt_ultima_compra)                                AS dt_fat
        FROM municipios m
        LEFT JOIN clientes c ON c.cod_ibge = m.cod_ibge
        GROUP BY m.cod_ibge, m.uf
    """).fetchall()
    for r in rows:
        cor = cor_semaforo(r['qtd_ativos'] or 0, r['qtd_limbo'] or 0,
                           r['qtd_mortos'] or 0, r['qtd_clientes'] or 0)
        conn.execute("""
            INSERT INTO cidades (cod_ibge, qtd_clientes, qtd_ativos, qtd_limbo, qtd_mortos,
                                 qtd_classe_a, qtd_classe_b, vlr_historico,
                                 dt_ultimo_faturamento, cor_semaforo, batedor_regiao)
            VALUES (?,?,?,?,?,?,?,?,?,?,?)
        """, (r['cod_ibge'], r['qtd_clientes'] or 0, r['qtd_ativos'] or 0,
              r['qtd_limbo'] or 0, r['qtd_mortos'] or 0, r['qtd_a'] or 0,
              r['qtd_b'] or 0, r['vlr'] or 0, r['dt_fat'],
              cor, batedor_por_uf(r['uf'])))
    conn.commit()


def batedor_por_uf(uf):
    return {'MG': 'R. Souza', 'SP': 'L. Andrade', 'GO': 'L. Andrade',
            'BA': 'M. Teixeira', 'ES': 'M. Teixeira', 'SC': 'P. Vasques'}.get(uf, 'R. Souza')


# ---------------------------------------------------------------- utilidades

def normalizar_telefone(ddd, telefone):
    """(31) 99999-9999 -> 5531999999999"""
    numero = re.sub(r'\D', '', str(telefone or ''))
    ddd = re.sub(r'\D', '', str(ddd or ''))
    if not numero:
        return ''
    return f'55{ddd}{numero}'


def normalizar_cidade(texto):
    """Maiuscula, sem acento, sem pontuacao."""
    if not texto:
        return ''
    nfd = unicodedata.normalize('NFD', texto)
    sem_acento = ''.join(ch for ch in nfd if unicodedata.category(ch) != 'Mn')
    return re.sub(r'[^A-Z0-9 ]', '', sem_acento.upper()).strip()


def gerar_token(id_cliente):
    return hashlib.sha256(f'limbo-clientes-{id_cliente}'.encode()).hexdigest()[:10]


# ---------------------------------------------------------------- mensagens

MODELOS = {
    1: ("Assunto: {razao_social}, sentimos sua falta por aqui\n\n"
        "Olá, {nome}, tudo bem?\n"
        "Sou o Bruno, da distribuidora. Vi que sua última compra com a gente foi em {mes_ano} "
        "e queria entender se houve algo que deixamos a desejar.\n"
        "Nesse tempo nosso mix mudou bastante e revisamos as condições de prazo e frete "
        "para a região de {cidade}.\n"
        "Separei uma condição de retorno para você. É só clicar aqui: {link}\n"
        "Se preferir, é só responder este e-mail.\n"
        "Para não receber mais nossos contatos, clique aqui."),
    2: ("Olá, {nome}! Aqui é o Bruno, da distribuidora.\n"
        "Vi que a {razao_social} comprava com a gente até {mes_ano} e queria saber o que "
        "mudou por aí.\n"
        "Atualizamos as condições para a região de {cidade} e separei uma tabela com as "
        "linhas que vocês mais levavam.\n"
        "Posso te mandar?"),
    3: ("Oi, {nome}! Bruno aqui, da distribuidora.\n"
        "Levantei aqui o que a {razao_social} mais comprava com a gente: {linhas}.\n"
        "Consegui uma condição melhor nessas linhas para a região de {cidade}, válida até "
        "{data_limite}.\n"
        "Te mando a tabela para dar uma olhada?"),
    4: ("Que bom te ver por aqui, {nome}!\n"
        "Vou passar seu contato para o {batedor}, que atende a região de {cidade}. Ele "
        "conhece bem o perfil de compra de vocês.\n"
        "Ele te chama ainda hoje. Prefere ligação ou continua por aqui mesmo?"),
}


def mes_ano_pt(dt_iso):
    if not dt_iso:
        return 'algum tempo atrás'
    d = datetime.strptime(str(dt_iso)[:10], '%Y-%m-%d')
    return f'{MESES_PT[d.month - 1]} de {d.year}'


def montar_mensagem(conn, id_cliente, modelo, base_url='http://localhost:5000'):
    cli = conn.execute('SELECT * FROM clientes WHERE id_cliente = ?', (id_cliente,)).fetchone()
    if cli is None:
        return ''
    nome = (cli['nome_contato'] or 'tudo bem').split()[0]
    data_limite = (date.today() + timedelta(days=7)).strftime('%d/%m/%Y')
    return MODELOS[int(modelo)].format(
        nome=nome,
        razao_social=cli['razao_social'] or '',
        cidade=cli['cidade'] or 'sua região',
        mes_ano=mes_ano_pt(cli['dt_ultima_compra']),
        link=f"{base_url}/r/{cli['token_rastreio']}",
        batedor=cli['batedor'] or batedor_por_uf(cli['uf']),
        data_limite=data_limite,
        linhas=cli['linhas_compradas'] or 'peças em geral',
    )


def modelo_para_cliente(cli):
    """Escolhe o modelo de mensagem conforme a classe / situacao."""
    if cli['na_fila_batedor']:
        return 4
    return {'C': 1, 'B': 2, 'A': 3}.get(cli['classe'], 1)
