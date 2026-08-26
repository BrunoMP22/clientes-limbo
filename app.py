# -*- coding: utf-8 -*-
"""Plataforma de gestao de clientes limbo (demonstracao).

Rodar: python app.py  ->  http://localhost:5000
Na primeira execucao o banco e criado e populado automaticamente.

O front e um SPA React que mora em web/ e consome /api/* (ver api.py).
O Flask serve o build de web/dist, o export CSV e a pagina publica do link
rastreavel, que continua em Jinja de proposito: ela precisa funcionar sozinha,
num clique vindo do e-mail, sem depender do bundle.
"""
import csv
import io
import os
import socket
from datetime import date

from flask import (Flask, Response, jsonify, render_template, request,
                   send_from_directory)

import api
import consultas
import database
import regras

app = Flask(__name__)
app.register_blueprint(api.api)   # rotas /api/* consumidas pelo front React

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DIST = os.path.join(BASE_DIR, 'web', 'dist')


def init_db():
    conn = database.get_conn()
    database.criar_schema(conn)
    if database.banco_vazio(conn):
        import seed
        print('Banco nao encontrado: criando schema e populando dados ficticios...')
        seed.popular(conn)
        n = conn.execute('SELECT COUNT(*) FROM clientes').fetchone()[0]
        print(f'Seed concluido: {n} clientes gerados.')
    conn.close()


@app.context_processor
def inject_globals():
    """Unico contexto que sobrou no Jinja: a pagina do catalogo usa `hoje`."""
    return {'hoje': date.today().isoformat()}


# ------------------------------------------------------------------ export

@app.route('/clientes/export')
def clientes_export():
    """Fica no Flask porque o CSV precisa do BOM para o Excel abrir os acentos
    certos — algo que nao ganha nada indo para o navegador."""
    conn = database.get_conn()
    rows = consultas.todos_clientes(conn, request.args)
    conn.close()
    buf = io.StringIO()
    escritor = csv.writer(buf, delimiter=';')
    escritor.writerow(['Empresa', 'Codigo', 'Loja', 'Razao Social', 'Contato', 'Cidade', 'UF',
                       'Classe', 'Status', 'E-mail', 'WhatsApp', 'Ultima compra',
                       'Valor historico', 'Tentativas', 'Batedor'])
    for c in rows:
        escritor.writerow([c['empresa'], c['cod_cliente'], c['loja'], c['razao_social'],
                           c['nome_contato'], c['cidade'], c['uf'], c['classe'], c['status'],
                           c['email'] or '', c['whatsapp'] or '', c['dt_ultima_compra'] or '',
                           f"{c['vlr_historico']:.2f}".replace('.', ','),
                           c['qtd_tentativas'], c['batedor'] or ''])
    saida = '﻿' + buf.getvalue()  # BOM para o Excel abrir acentos certos
    return Response(saida, mimetype='text/csv; charset=utf-8',
                    headers={'Content-Disposition':
                             'attachment; filename=clientes_limbo.csv'})


# ------------------------------------------------------------------ link rastreavel

@app.route('/r/<token>')
def rastreio(token):
    """Pagina publica do clique. Continua em Jinja: precisa abrir direto do
    e-mail, sem depender do bundle do React ter carregado."""
    conn = database.get_conn()
    cli = conn.execute('SELECT * FROM clientes WHERE token_rastreio = ?', (token,)).fetchone()
    if cli is None:
        conn.close()
        return render_template('catalogo.html', cliente=None, promovido=False), 404
    res = regras.aplicar_evento(conn, cli['id_cliente'], 'EMAIL_CLICADO', canal='EMAIL',
                                origem='LINK', detalhe='Clique no link rastreável')
    cli = conn.execute('SELECT * FROM clientes WHERE id_cliente = ?',
                       (cli['id_cliente'],)).fetchone()
    conn.close()
    return render_template('catalogo.html', cliente=cli, promovido=res.get('promovido', False))


# ------------------------------------------------------------------ SPA React

AVISO_SEM_BUILD = """<!doctype html><meta charset="utf-8">
<title>Build do front ausente</title>
<body style="font-family:Segoe UI,sans-serif;max-width:640px;margin:60px auto;padding:0 20px">
<h1 style="font-size:1.2rem">O front React ainda nao foi compilado</h1>
<p>A pasta <code>web/dist</code> nao existe. Gere o build uma vez:</p>
<pre style="background:#f2f4f7;padding:12px;border-radius:8px">cd web
npm install
npm run build</pre>
<p>Para desenvolver com recarga automatica, deixe o Flask rodando e suba o Vite
em outro terminal com <code>npm run dev</code>, acessando
<a href="http://localhost:5173">http://localhost:5173</a>.</p>
<p>A API continua no ar: <a href="/api/painel">/api/painel</a>.</p>
</body>"""


@app.route('/')
@app.route('/<path:caminho>')
def spa(caminho=''):
    """Entrega o build do React e deixa o roteamento com o react-router.

    Qualquer caminho que nao seja um arquivo do build cai no index.html, senao
    recarregar a pagina em /clientes daria 404. As rotas registradas acima
    (/api/*, /clientes/export, /r/<token>) tem prioridade sobre esta regra.
    """
    # /api/ inexistente tem que responder 404 em JSON. Sem isso o catch-all
    # devolveria o index.html com status 200 e quem chamou receberia HTML no
    # lugar do erro, que e bem mais dificil de diagnosticar.
    if caminho == 'api' or caminho.startswith('api/'):
        return jsonify({'erro': f'Endpoint inexistente: /{caminho}'}), 404
    if not os.path.isdir(DIST):
        return Response(AVISO_SEM_BUILD, mimetype='text/html', status=503)
    if caminho and os.path.isfile(os.path.join(DIST, caminho)):
        return send_from_directory(DIST, caminho)
    return send_from_directory(DIST, 'index.html')


def ip_da_rede():
    """IP da maquina na rede local, para imprimir o link que outra pessoa usa.

    Nao abre conexao de verdade: so pergunta ao sistema qual interface ele
    usaria para sair, que e a que os colegas enxergam.
    """
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('10.255.255.255', 1))
        return s.getsockname()[0]
    except OSError:
        return '127.0.0.1'
    finally:
        s.close()


init_db()

if __name__ == '__main__':
    # DECISAO: mensagens do console sem acento nem travessao, porque o terminal
    # padrao do Windows usa cp1252 e embaralharia os caracteres.
    #
    # Por padrao escuta so em 127.0.0.1. Para outra pessoa da rede abrir, rode
    # com LIMBO_HOST=0.0.0.0 - fica explicito quando o sistema esta exposto.
    host = os.environ.get('LIMBO_HOST', '127.0.0.1')
    porta = int(os.environ.get('LIMBO_PORT', '5000'))

    print('Plataforma Clientes Limbo')
    if not os.path.isdir(DIST):
        print('AVISO: web/dist nao existe. Rode "cd web && npm install && npm run build".')
    if host == '0.0.0.0':
        print(f'Neste PC:        http://localhost:{porta}')
        print(f'Mande este link: http://{ip_da_rede()}:{porta}')
        print('Visivel para a rede local. O PC precisa ficar ligado e conectado.')
    else:
        print(f'Abra no navegador: http://localhost:{porta}')
    app.run(host=host, port=porta, debug=False)
