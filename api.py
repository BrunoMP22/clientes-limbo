# -*- coding: utf-8 -*-
"""API JSON consumida pelo front React.

DECISAO: Blueprint separado em vez de mais rotas no app.py, para o app.py
ficar so com o que nao e API: o export CSV, o link rastreavel e a entrega do
build. Todo SQL vem de consultas.py.

Formatacao (moeda, data) NAO acontece aqui: o JSON leva o valor cru e quem
formata e o front. Assim a mesma resposta serve para tela, export e teste.
"""
from datetime import date

from flask import Blueprint, jsonify, request

import apresentacao
import consultas
import database
import regras

api = Blueprint('api', __name__, url_prefix='/api')


def dic(row):
    return dict(row) if row is not None else None


def dics(rows):
    return [dict(r) for r in rows]


# ------------------------------------------------------------------ metadados

@api.get('/opcoes')
def opcoes():
    """Tudo que o front precisa para montar filtros e rotular eventos."""
    conn = database.get_conn()
    dados = consultas.opcoes_filtros(conn)
    conn.close()
    dados['batedores_fixos'] = apresentacao.BATEDORES
    dados['hoje'] = date.today().isoformat()
    dados['rotulos'] = {k: {'icone': v[0], 'rotulo': v[1], 'classe': v[2]}
                        for k, v in apresentacao.ROTULO_EVENTO.items()}
    dados['acoes_ficha'] = [{'tipo': t, 'rotulo': r} for t, r in apresentacao.ACOES_FICHA]
    dados['acao_etapa'] = {str(k): {'canal': v[0], 'rotulo': v[1]}
                           for k, v in regras.ACAO_ETAPA.items()}
    return jsonify(dados)


# ------------------------------------------------------------------ TELA 1: painel

@api.get('/painel')
def painel():
    conn = database.get_conn()
    d = consultas.painel(conn, request.args)
    d.update(consultas.opcoes_filtros(conn))
    conn.close()
    d['responderam'] = dics(d['responderam'])
    d['filtros'] = request.args.to_dict()
    return jsonify(d)


# ------------------------------------------------------------------ TELA 2: clientes

@api.get('/clientes')
def clientes():
    conn = database.get_conn()
    d = consultas.lista_clientes(conn, request.args)
    d.update(consultas.opcoes_filtros(conn))
    conn.close()
    d['clientes'] = dics(d['clientes'])
    d['filtros'] = request.args.to_dict()
    return jsonify(d)


# ------------------------------------------------------------------ TELA 3: ficha

@api.get('/cliente/<int:id_cliente>')
def cliente(id_cliente):
    conn = database.get_conn()
    cli, eventos, visitas = consultas.ficha(conn, id_cliente)
    conn.close()
    if cli is None:
        return jsonify({'erro': 'Cliente não encontrado.'}), 404
    return jsonify({'cliente': dic(cli), 'eventos': dics(eventos), 'visitas': dics(visitas)})


@api.post('/cliente/<int:id_cliente>/acao')
def cliente_acao(id_cliente):
    tipo = (request.json or {}).get('tipo_evento', '')
    conn = database.get_conn()
    res = regras.aplicar_evento(conn, id_cliente, tipo, origem='MANUAL',
                                detalhe='Registrado manualmente na ficha')
    cli, eventos, visitas = consultas.ficha(conn, id_cliente)
    conn.close()
    avisos = [{'categoria': c, 'texto': t} for c, t in apresentacao.avisos_acao(tipo, res)]
    return jsonify({'ok': bool(res.get('ok')), 'promovido': bool(res.get('promovido')),
                    'avisos': avisos, 'cliente': dic(cli),
                    'eventos': dics(eventos), 'visitas': dics(visitas)})


@api.post('/cliente/<int:id_cliente>/batedor')
def cliente_batedor(id_cliente):
    batedor = (request.json or {}).get('batedor', '')
    conn = database.get_conn()
    conn.execute('UPDATE clientes SET batedor = ? WHERE id_cliente = ?', (batedor, id_cliente))
    conn.commit()
    cli, _, _ = consultas.ficha(conn, id_cliente)
    conn.close()
    return jsonify({'ok': True, 'cliente': dic(cli),
                    'avisos': [{'categoria': 'ok',
                                'texto': f'Batedor {batedor} atribuído ao cliente.'}]})


@api.post('/cliente/<int:id_cliente>/visita')
def cliente_visita(id_cliente):
    dados = request.json or {}
    conn = database.get_conn()
    atual = conn.execute('SELECT batedor FROM clientes WHERE id_cliente = ?',
                         (id_cliente,)).fetchone()
    resultado = dados.get('resultado') or 'REMARCADO'
    conn.execute("""
        INSERT INTO visitas (id_cliente, batedor, dt_visita, resultado, motivo, observacao)
        VALUES (?,?,?,?,?,?)
    """, (id_cliente, dados.get('batedor') or (atual['batedor'] if atual else None),
          date.today().isoformat(), resultado,
          dados.get('motivo') or None, dados.get('observacao') or None))
    conn.commit()
    if resultado == 'COMPROU':
        regras.aplicar_evento(conn, id_cliente, 'NOTA_FISCAL', origem='MANUAL',
                              detalhe='Venda registrada na visita do batedor')
        aviso = {'categoria': 'promocao',
                 'texto': 'Visita registrada. Cliente comprou: reativado como ATIVO.'}
    else:
        aviso = {'categoria': 'ok', 'texto': 'Visita registrada.'}
    cli, eventos, visitas = consultas.ficha(conn, id_cliente)
    conn.close()
    return jsonify({'ok': True, 'avisos': [aviso], 'cliente': dic(cli),
                    'eventos': dics(eventos), 'visitas': dics(visitas)})


# ------------------------------------------------------------------ TELA 4: regua

@api.get('/regua')
def regua():
    conn = database.get_conn()
    d = consultas.regua(conn, base_url=request.url_root.rstrip('/'))
    conn.close()
    return jsonify({
        'urgentes': dics(d['urgentes']),
        # chaves viram string: JSON nao tem chave numerica
        'grupos': {str(etapa): dics(lista) for etapa, lista in d['grupos'].items()},
        'mensagens': {str(idc): msg for idc, msg in d['mensagens'].items()},
        'acao_etapa': {str(k): {'canal': v[0], 'rotulo': v[1]}
                       for k, v in regras.ACAO_ETAPA.items()},
    })


@api.post('/regua/<int:id_cliente>/contatado')
def regua_contatado(id_cliente):
    conn = database.get_conn()
    cli = conn.execute('SELECT etapa_regua FROM clientes WHERE id_cliente = ?',
                       (id_cliente,)).fetchone()
    etapa = cli['etapa_regua'] if cli else 0
    canal, _ = regras.ACAO_ETAPA.get(min(etapa, 5), ('EMAIL', ''))
    # DECISAO: etapa de telefone gera TENTATIVA_SEM_RETORNO; e-mail/whats geram *_ENVIADO
    tipo = {'EMAIL': 'EMAIL_ENVIADO', 'WHATSAPP': 'WHATSAPP_ENVIADO',
            'TELEFONE': 'TENTATIVA_SEM_RETORNO'}.get(canal, 'EMAIL_ENVIADO')
    res = regras.aplicar_evento(conn, id_cliente, tipo, canal=canal, origem='MANUAL',
                                detalhe=f'Contato da régua (etapa {etapa})')
    conn.close()
    msgs = res.get('mensagens', [])
    texto = ('Contato registrado: tentativa contada e próximo contato agendado.'
             + (' ' + ' | '.join(msgs) if msgs else ''))
    return jsonify({'ok': bool(res.get('ok')),
                    'avisos': [{'categoria': 'ok', 'texto': texto}]})


# ------------------------------------------------------------------ TELA 5: cidades

@api.get('/cidades')
def cidades():
    conn = database.get_conn()
    d = consultas.cidades(conn, request.args)
    conn.close()
    d['coloridas'] = dics(d['coloridas'])
    d['brancas'] = dics(d['brancas'])
    d['filtros'] = request.args.to_dict()
    return jsonify(d)


# ------------------------------------------------------------------ rastreio

@api.get('/rastreio/<token>')
def rastreio(token):
    """Registra o clique e devolve o cliente. Mesmo efeito da rota /r/<token>."""
    conn = database.get_conn()
    cli = conn.execute('SELECT * FROM clientes WHERE token_rastreio = ?', (token,)).fetchone()
    if cli is None:
        conn.close()
        return jsonify({'cliente': None, 'promovido': False}), 404
    res = regras.aplicar_evento(conn, cli['id_cliente'], 'EMAIL_CLICADO', canal='EMAIL',
                                origem='LINK', detalhe='Clique no link rastreável')
    cli = conn.execute('SELECT * FROM clientes WHERE id_cliente = ?',
                       (cli['id_cliente'],)).fetchone()
    conn.close()
    return jsonify({'cliente': dic(cli), 'promovido': bool(res.get('promovido'))})
