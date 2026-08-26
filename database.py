# -*- coding: utf-8 -*-
"""Conexao SQLite e criacao do schema."""
import os
import sqlite3

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, 'clientes_limbo.db')

SCHEMA = """
CREATE TABLE IF NOT EXISTS municipios (
    cod_ibge      TEXT PRIMARY KEY,
    cidade        TEXT NOT NULL,
    cidade_norm   TEXT NOT NULL,
    uf            TEXT NOT NULL,
    regiao        TEXT
);

CREATE TABLE IF NOT EXISTS empresas (
    empresa   TEXT PRIMARY KEY,
    descricao TEXT,
    ativo     INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS clientes (
    id_cliente          INTEGER PRIMARY KEY AUTOINCREMENT,
    empresa             TEXT NOT NULL,
    cod_cliente         TEXT NOT NULL,
    loja                TEXT NOT NULL,
    razao_social        TEXT,
    nome_contato        TEXT,
    cod_ibge            TEXT,
    cidade              TEXT,
    uf                  TEXT,

    email               TEXT,
    email_valido        INTEGER DEFAULT 1,
    whatsapp            TEXT,
    whatsapp_e164       TEXT,
    whatsapp_valido     INTEGER DEFAULT 1,
    canal_pref          TEXT,

    dt_ultima_compra    TEXT,
    anos_inativo        INTEGER,
    vlr_historico       REAL DEFAULT 0,
    qtd_notas           INTEGER DEFAULT 0,
    linhas_compradas    TEXT,

    status              TEXT NOT NULL,
    classe              TEXT NOT NULL,
    dt_mudanca_classe   TEXT,

    qtd_emails_enviados       INTEGER DEFAULT 0,
    qtd_emails_abertos        INTEGER DEFAULT 0,
    qtd_emails_respondidos    INTEGER DEFAULT 0,
    qtd_whats_enviados        INTEGER DEFAULT 0,
    qtd_whats_visualizados    INTEGER DEFAULT 0,
    qtd_whats_respondidos     INTEGER DEFAULT 0,
    respondeu_email     INTEGER DEFAULT 0,
    respondeu_whatsapp  INTEGER DEFAULT 0,
    dt_ultima_resposta  TEXT,

    etapa_regua         INTEGER DEFAULT 0,
    dt_ultimo_contato   TEXT,
    dt_proximo_contato  TEXT,
    qtd_tentativas      INTEGER DEFAULT 0,
    dt_fim_quarentena   TEXT,
    opt_out             INTEGER DEFAULT 0,
    dt_opt_out          TEXT,

    token_rastreio      TEXT UNIQUE,
    batedor             TEXT,
    na_fila_batedor     INTEGER DEFAULT 0,
    dt_reativacao       TEXT,

    UNIQUE (empresa, cod_cliente, loja)
);

CREATE TABLE IF NOT EXISTS eventos (
    id_evento     INTEGER PRIMARY KEY AUTOINCREMENT,
    id_cliente    INTEGER NOT NULL,
    tipo_evento   TEXT NOT NULL,
    canal         TEXT,
    dt_evento     TEXT NOT NULL,
    detalhe       TEXT,
    origem        TEXT,
    hash_evento   TEXT UNIQUE,
    dt_importacao TEXT
);

CREATE TABLE IF NOT EXISTS visitas (
    id_visita     INTEGER PRIMARY KEY AUTOINCREMENT,
    id_cliente    INTEGER NOT NULL,
    batedor       TEXT,
    dt_visita     TEXT,
    resultado     TEXT,
    motivo        TEXT,
    observacao    TEXT
);

CREATE TABLE IF NOT EXISTS cidades (
    id_cidade             INTEGER PRIMARY KEY AUTOINCREMENT,
    cod_ibge              TEXT UNIQUE,
    qtd_clientes          INTEGER DEFAULT 0,
    qtd_ativos            INTEGER DEFAULT 0,
    qtd_limbo             INTEGER DEFAULT 0,
    qtd_mortos            INTEGER DEFAULT 0,
    qtd_classe_a          INTEGER DEFAULT 0,
    qtd_classe_b          INTEGER DEFAULT 0,
    vlr_historico         REAL DEFAULT 0,
    dt_ultimo_faturamento TEXT,
    cor_semaforo          TEXT NOT NULL,
    batedor_regiao        TEXT
);

CREATE INDEX IF NOT EXISTS idx_eventos_cliente ON eventos (id_cliente);
CREATE INDEX IF NOT EXISTS idx_clientes_status ON clientes (status);
CREATE INDEX IF NOT EXISTS idx_clientes_classe ON clientes (classe);
"""


def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute('PRAGMA foreign_keys = ON')
    return conn


def criar_schema(conn):
    conn.executescript(SCHEMA)
    conn.commit()


def banco_vazio(conn):
    try:
        return conn.execute('SELECT COUNT(*) FROM clientes').fetchone()[0] == 0
    except sqlite3.OperationalError:
        return True
