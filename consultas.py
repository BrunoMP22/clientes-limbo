# -*- coding: utf-8 -*-
"""Consultas de cada tela, sem nada de HTTP nem de template.

DECISAO: extraido de app.py quando o front virou React. A API e o export CSV
precisam responder exatamente os mesmos numeros; manter o SQL em dois lugares
faria os dois divergirem em silencio. Aqui e a unica fonte.
"""
from datetime import date, datetime, timedelta

import regras


def opcoes_filtros(conn):
    """Valores que alimentam os selects de filtro das telas."""
    return {
        'ufs': [r[0] for r in conn.execute(
            'SELECT DISTINCT uf FROM clientes ORDER BY uf')],
        'empresas': [r[0] for r in conn.execute(
            'SELECT empresa FROM empresas ORDER BY empresa')],
        'batedores': [r[0] for r in conn.execute(
            'SELECT DISTINCT batedor FROM clientes WHERE batedor IS NOT NULL ORDER BY batedor')],
        'anos': [r[0] for r in conn.execute(
            "SELECT DISTINCT substr(dt_ultima_compra,1,4) FROM clientes "
            "WHERE dt_ultima_compra IS NOT NULL ORDER BY 1")],
    }


# ------------------------------------------------ filtros vindos de clique em grafico
# DECISAO: definidos uma vez so porque sao usados em dois lugares — o painel
# recalcula os numeros com eles e a lista de clientes usa os mesmos no
# drill-through. Se divergissem, clicar num grafico e depois em "ver os N
# clientes" levaria a um conjunto diferente do que o grafico mostrava.

# (chave, rotulo, condicao SQL). A carteira e a base: nao filtra nada.
FUNIL = [
    ('carteira', 'Carteira', None),
    # so conta e-mail e WhatsApp: tentativa por telefone nao incrementa envio
    ('contatados', 'Contatados', '(qtd_emails_enviados + qtd_whats_enviados) > 0'),
    ('visualizaram', 'Visualizaram', '(qtd_emails_abertos + qtd_whats_visualizados) > 0'),
    ('responderam', 'Responderam', '(respondeu_email = 1 OR respondeu_whatsapp = 1)'),
    ('reativados', 'Reativados', 'dt_reativacao IS NOT NULL'),
]
FUNIL_SQL = {chave: sql for chave, _, sql in FUNIL if sql}

# uma chave por barra do grafico de engajamento por canal (2 canais x 3 etapas)
SINAL_SQL = {
    'email_enviado': 'qtd_emails_enviados > 0',
    'email_visualizou': 'qtd_emails_abertos > 0',
    'email_respondeu': 'respondeu_email = 1',
    'whats_enviado': 'qtd_whats_enviados > 0',
    'whats_visualizou': 'qtd_whats_visualizados > 0',
    'whats_respondeu': 'respondeu_whatsapp = 1',
}


def aplicar_engajamento(args, where):
    """Adiciona a `where` os filtros de funil e de sinal, se vierem na URL."""
    if args.get('funil', '') in FUNIL_SQL:
        where.append(FUNIL_SQL[args['funil']])
    if args.get('sinal', '') in SINAL_SQL:
        where.append(SINAL_SQL[args['sinal']])


# ------------------------------------------------------------------ TELA 1: painel

def painel(conn, args):
    where, vals = [], []
    for campo, coluna in [('classe', 'classe'), ('status', 'status'), ('uf', 'uf'),
                          ('batedor', 'batedor'), ('empresa', 'empresa')]:
        v = args.get(campo, '')
        if v:
            where.append(f'{coluna} = ?')
            vals.append(v)
    ano = args.get('ano', '')
    if ano:
        where.append("substr(dt_ultima_compra,1,4) = ?")
        vals.append(ano)
    aplicar_engajamento(args, where)
    w = ('WHERE ' + ' AND '.join(where)) if where else ''

    def um(sql):
        return conn.execute(sql, vals).fetchone()[0]

    extra = ' AND ' if where else ' WHERE '
    kpis = {
        'limbo': um(f"SELECT COUNT(*) FROM clientes {w}{extra}status = 'LIMBO'"),
        'a': um(f"SELECT COUNT(*) FROM clientes {w}{extra}classe = 'A'"),
        'b': um(f"SELECT COUNT(*) FROM clientes {w}{extra}classe = 'B'"),
        'c': um(f"SELECT COUNT(*) FROM clientes {w}{extra}classe = 'C'"),
        'responderam': um(f"SELECT COUNT(*) FROM clientes {w}{extra}"
                          f"(respondeu_email = 1 OR respondeu_whatsapp = 1)"),
        'reativados': um(f"SELECT COUNT(*) FROM clientes {w}{extra}dt_reativacao IS NOT NULL"),
    }

    classes = dict(conn.execute(
        f'SELECT classe, COUNT(*) FROM clientes {w} GROUP BY classe', vals).fetchall())
    canais = conn.execute(f"""
        SELECT COALESCE(SUM(qtd_emails_enviados),0), COALESCE(SUM(qtd_emails_abertos),0),
               COALESCE(SUM(qtd_emails_respondidos),0), COALESCE(SUM(qtd_whats_enviados),0),
               COALESCE(SUM(qtd_whats_visualizados),0), COALESCE(SUM(qtd_whats_respondidos),0)
        FROM clientes {w}""", vals).fetchone()
    # funil de reativacao: cada etapa e um subconjunto da carteira filtrada
    funil = [{'chave': chave, 'rotulo': rotulo,
              'valor': um(f'SELECT COUNT(*) FROM clientes {w}' if cond is None
                          else f'SELECT COUNT(*) FROM clientes {w}{extra}{cond}')}
             for chave, rotulo, cond in FUNIL]

    dados_graficos = {
        'classes': {'a': classes.get('A', 0), 'b': classes.get('B', 0), 'c': classes.get('C', 0)},
        'canais': {'email': [canais[0], canais[1], canais[2]],
                   'whats': [canais[3], canais[4], canais[5]]},
        'funil': funil,
    }

    responderam = conn.execute(f"""
        SELECT * FROM clientes {w}{extra}(respondeu_email = 1 OR respondeu_whatsapp = 1)
        ORDER BY dt_ultima_resposta DESC LIMIT 30""", vals).fetchall()

    # o botao de drill-through precisa saber quantos clientes o filtro atual pega
    total = um(f'SELECT COUNT(*) FROM clientes {w}')

    return {'kpis': kpis, 'dados_graficos': dados_graficos,
            'responderam': responderam, 'total': total}


# ------------------------------------------------------------------ TELA 2: clientes

COLUNAS_ORDENACAO = {
    'cod': 'cod_cliente', 'razao': 'razao_social', 'cidade': 'cidade',
    'classe': 'classe', 'ultima': 'dt_ultima_compra', 'valor': 'vlr_historico',
    'tentativas': 'qtd_tentativas', 'batedor': 'batedor',
}

POR_PAGINA = 50


def where_clientes(args):
    where, vals = [], []
    q = args.get('q', '').strip()
    if q:
        where.append('(razao_social LIKE ? OR cod_cliente LIKE ? OR email LIKE ? '
                     'OR whatsapp LIKE ? OR nome_contato LIKE ?)')
        vals.extend([f'%{q}%'] * 5)
    for campo in ('classe', 'status', 'uf', 'batedor', 'empresa'):
        v = args.get(campo, '')
        if v:
            where.append(f'{campo} = ?')
            vals.append(v)
    if args.get('canal', ''):
        where.append('canal_pref = ?')
        vals.append(args['canal'])
    rapido = args.get('rapido', '')
    mapa_rapido = {
        'resp_email': 'respondeu_email = 1',
        'resp_whats': 'respondeu_whatsapp = 1',
        'so_visualizou': ("classe = 'B'"),
        'sem_sinal': ("classe = 'C' AND opt_out = 0"),
        'sem_email': '(email IS NULL OR email = "")',
        'opt_out': 'opt_out = 1',
    }
    if rapido in mapa_rapido:
        where.append(mapa_rapido[rapido])
    # mesmos filtros que o painel aplica no clique do grafico, para o
    # drill-through cair exatamente no conjunto que o grafico mostrava
    aplicar_engajamento(args, where)
    w = ('WHERE ' + ' AND '.join(where)) if where else ''
    coluna = COLUNAS_ORDENACAO.get(args.get('sort', ''), 'razao_social')
    direcao = 'DESC' if args.get('dir') == 'desc' else 'ASC'
    return w, vals, f'ORDER BY {coluna} {direcao}'


def lista_clientes(conn, args):
    w, vals, order = where_clientes(args)
    total = conn.execute(f'SELECT COUNT(*) FROM clientes {w}', vals).fetchone()[0]
    pagina = max(1, int(args.get('page', 1) or 1))
    rows = conn.execute(f'SELECT * FROM clientes {w} {order} LIMIT ? OFFSET ?',
                        (*vals, POR_PAGINA, (pagina - 1) * POR_PAGINA)).fetchall()
    return {'clientes': rows, 'total': total, 'pagina': pagina,
            'paginas': max(1, -(-total // POR_PAGINA))}


def todos_clientes(conn, args):
    """Sem paginacao: usada pelo export CSV, que respeita os filtros ativos."""
    w, vals, order = where_clientes(args)
    return conn.execute(f'SELECT * FROM clientes {w} {order}', vals).fetchall()


# ------------------------------------------------------------------ TELA 3: ficha

def ficha(conn, id_cliente):
    """Retorna (cliente, eventos, visitas). cliente e None se nao existir."""
    cli = conn.execute('SELECT * FROM clientes WHERE id_cliente = ?', (id_cliente,)).fetchone()
    if cli is None:
        return None, [], []
    eventos = conn.execute(
        'SELECT * FROM eventos WHERE id_cliente = ? ORDER BY dt_evento DESC, id_evento DESC',
        (id_cliente,)).fetchall()
    visitas = conn.execute(
        'SELECT * FROM visitas WHERE id_cliente = ? ORDER BY dt_visita DESC',
        (id_cliente,)).fetchall()
    return cli, eventos, visitas


# ------------------------------------------------------------------ TELA 4: regua

def clientes_regua(conn):
    hoje_s = date.today().isoformat()
    return conn.execute("""
        SELECT * FROM clientes
        WHERE status = 'LIMBO' AND opt_out = 0 AND etapa_regua <= 5
          AND qtd_tentativas < 3
          AND (dt_fim_quarentena IS NULL OR dt_fim_quarentena <= ?)
          AND (dt_proximo_contato IS NULL OR substr(dt_proximo_contato,1,10) <= ?)
        ORDER BY etapa_regua, dt_proximo_contato
    """, (hoje_s, hoje_s)).fetchall()


def regua(conn, base_url):
    regras.manter_exemplos_urgentes(conn)
    limite_48h = (datetime.now() - timedelta(hours=48)).strftime('%Y-%m-%d %H:%M:%S')
    urgentes = conn.execute("""
        SELECT * FROM clientes
        WHERE status = 'LIMBO' AND opt_out = 0 AND dt_ultima_resposta >= ?
        ORDER BY dt_ultima_resposta DESC
    """, (limite_48h,)).fetchall()

    grupos = {e: [] for e in range(6)}
    ids_urgentes = {c['id_cliente'] for c in urgentes}
    for c in clientes_regua(conn):
        if c['id_cliente'] not in ids_urgentes:
            grupos[c['etapa_regua']].append(c)

    mensagens = {}
    for c in list(urgentes) + [c for lst in grupos.values() for c in lst]:
        mensagens[c['id_cliente']] = regras.montar_mensagem(
            conn, c['id_cliente'], regras.modelo_para_cliente(c), base_url=base_url)
    return {'urgentes': urgentes, 'grupos': grupos, 'mensagens': mensagens}


# ------------------------------------------------------------------ TELA 5: cidades

def cidades(conn, args):
    regras.recalcular_cidades(conn)
    where, vals = [], []
    if args.get('cor'):
        where.append('c.cor_semaforo = ?')
        vals.append(args['cor'])
    if args.get('uf'):
        where.append('m.uf = ?')
        vals.append(args['uf'])
    w = ('WHERE ' + ' AND '.join(where)) if where else ''
    rows = conn.execute(f"""
        SELECT c.*, m.cidade, m.uf FROM cidades c
        JOIN municipios m ON m.cod_ibge = c.cod_ibge
        {w}
        ORDER BY c.qtd_classe_a DESC, c.qtd_clientes DESC, m.cidade
    """, vals).fetchall()
    resumo = dict(conn.execute(
        'SELECT cor_semaforo, COUNT(*) FROM cidades GROUP BY cor_semaforo').fetchall())
    ufs = [r[0] for r in conn.execute('SELECT DISTINCT uf FROM municipios ORDER BY uf')]
    sem_ibge = conn.execute(
        'SELECT COUNT(*) FROM clientes WHERE cod_ibge IS NULL').fetchone()[0]
    return {'coloridas': [r for r in rows if r['cor_semaforo'] != 'BRANCA'],
            'brancas': [r for r in rows if r['cor_semaforo'] == 'BRANCA'],
            'resumo': resumo, 'ufs': ufs, 'sem_ibge': sem_ibge}


