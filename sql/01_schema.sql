/* =============================================================================
   CLIENTES LIMBO — schema equivalente em SQL Server (material de apoio)
   Clientes Limbo · BI
   Este script NAO e usado pela demonstracao (que roda em SQLite). Ele mostra
   como o mesmo modelo ficaria em producao, lendo o Protheus/TOTVS.
   ============================================================================= */

IF DB_ID('BI_LIMBO') IS NULL
    CREATE DATABASE BI_LIMBO;
GO
USE BI_LIMBO;
GO

/* ---------------------------------------------------------------- municipios
   Tabela de referencia. E ela que permite a cor BRANCA do semaforo: sem uma
   base de municipios, cidade sem cliente jamais apareceria em relatorio. */
IF OBJECT_ID('dbo.municipios') IS NULL
CREATE TABLE dbo.municipios (
    cod_ibge     VARCHAR(7)   NOT NULL PRIMARY KEY,
    cidade       VARCHAR(120) NOT NULL,
    cidade_norm  VARCHAR(120) NOT NULL,
    uf           CHAR(2)      NOT NULL,
    regiao       VARCHAR(20)  NULL
);
GO

IF OBJECT_ID('dbo.empresas') IS NULL
CREATE TABLE dbo.empresas (
    empresa   VARCHAR(6)   NOT NULL PRIMARY KEY,
    descricao VARCHAR(120) NULL,
    ativo     BIT          NOT NULL DEFAULT 1
);
GO

/* ---------------------------------------------------------------- clientes
   Chave natural: (empresa, cod_cliente, loja). O id_cliente e substituto e
   NUNCA pode ser reemitido — eventos e visitas apontam para ele. */
IF OBJECT_ID('dbo.clientes') IS NULL
CREATE TABLE dbo.clientes (
    id_cliente             INT IDENTITY(1,1) PRIMARY KEY,
    empresa                VARCHAR(6)   NOT NULL,
    cod_cliente            VARCHAR(6)   NOT NULL,
    loja                   VARCHAR(2)   NOT NULL,
    razao_social           VARCHAR(200) NULL,
    nome_contato           VARCHAR(120) NULL,
    cod_ibge               VARCHAR(7)   NULL,
    cidade                 VARCHAR(120) NULL,
    uf                     CHAR(2)      NULL,

    email                  VARCHAR(300) NULL,
    email_valido           BIT          NOT NULL DEFAULT 1,
    whatsapp               VARCHAR(30)  NULL,
    whatsapp_e164          VARCHAR(20)  NULL,
    whatsapp_valido        BIT          NOT NULL DEFAULT 1,
    canal_pref             VARCHAR(10)  NULL,

    dt_ultima_compra       DATE         NULL,
    anos_inativo           INT          NULL,
    vlr_historico          DECIMAL(18,2) NOT NULL DEFAULT 0,
    qtd_notas              INT          NOT NULL DEFAULT 0,
    linhas_compradas       VARCHAR(300) NULL,

    status                 VARCHAR(10)  NOT NULL,
    classe                 CHAR(1)      NOT NULL,
    dt_mudanca_classe      DATE         NULL,

    qtd_emails_enviados    INT NOT NULL DEFAULT 0,
    qtd_emails_abertos     INT NOT NULL DEFAULT 0,
    qtd_emails_respondidos INT NOT NULL DEFAULT 0,
    qtd_whats_enviados     INT NOT NULL DEFAULT 0,
    qtd_whats_visualizados INT NOT NULL DEFAULT 0,
    qtd_whats_respondidos  INT NOT NULL DEFAULT 0,
    respondeu_email        BIT NOT NULL DEFAULT 0,
    respondeu_whatsapp     BIT NOT NULL DEFAULT 0,
    dt_ultima_resposta     DATETIME NULL,

    etapa_regua            INT  NOT NULL DEFAULT 0,
    dt_ultimo_contato      DATE NULL,
    dt_proximo_contato     DATE NULL,
    qtd_tentativas         INT  NOT NULL DEFAULT 0,
    dt_fim_quarentena      DATE NULL,
    opt_out                BIT  NOT NULL DEFAULT 0,
    dt_opt_out             DATE NULL,

    token_rastreio         VARCHAR(16) NULL UNIQUE,
    batedor                VARCHAR(60) NULL,
    na_fila_batedor        BIT  NOT NULL DEFAULT 0,
    dt_reativacao          DATE NULL,

    CONSTRAINT uq_clientes_natural UNIQUE (empresa, cod_cliente, loja),
    CONSTRAINT ck_clientes_status  CHECK (status IN ('ATIVO','LIMBO','MORTO')),
    CONSTRAINT ck_clientes_classe  CHECK (classe IN ('A','B','C'))
);
GO

/* ---------------------------------------------------------------- eventos
   hash_evento = SHA2_256(id_cliente|tipo|dt|canal). Chave de deduplicacao:
   reimportar o mesmo arquivo nao duplica nada. */
IF OBJECT_ID('dbo.eventos') IS NULL
CREATE TABLE dbo.eventos (
    id_evento     INT IDENTITY(1,1) PRIMARY KEY,
    id_cliente    INT          NOT NULL,
    tipo_evento   VARCHAR(30)  NOT NULL,
    canal         VARCHAR(15)  NULL,
    dt_evento     DATETIME     NOT NULL,
    detalhe       VARCHAR(300) NULL,
    origem        VARCHAR(20)  NULL,
    hash_evento   CHAR(64)     NULL UNIQUE,
    dt_importacao DATETIME     NOT NULL DEFAULT GETDATE(),
    CONSTRAINT fk_eventos_cliente FOREIGN KEY (id_cliente) REFERENCES dbo.clientes(id_cliente)
);
GO
CREATE INDEX ix_eventos_cliente ON dbo.eventos (id_cliente, dt_evento DESC);
GO

IF OBJECT_ID('dbo.eventos_rejeitados') IS NULL
CREATE TABLE dbo.eventos_rejeitados (
    id_rejeitado   INT IDENTITY(1,1) PRIMARY KEY,
    email_original VARCHAR(300) NULL,
    tipo_evento    VARCHAR(30)  NULL,
    dt_evento      VARCHAR(30)  NULL,
    motivo         VARCHAR(200) NOT NULL,
    arquivo_origem VARCHAR(200) NULL,
    dt_importacao  DATETIME     NOT NULL DEFAULT GETDATE()
);
GO

IF OBJECT_ID('dbo.visitas') IS NULL
CREATE TABLE dbo.visitas (
    id_visita  INT IDENTITY(1,1) PRIMARY KEY,
    id_cliente INT          NOT NULL,
    batedor    VARCHAR(60)  NULL,
    dt_visita  DATE         NULL,
    resultado  VARCHAR(15)  NULL,
    motivo     VARCHAR(200) NULL,
    observacao VARCHAR(400) NULL,
    CONSTRAINT fk_visitas_cliente FOREIGN KEY (id_cliente) REFERENCES dbo.clientes(id_cliente),
    CONSTRAINT ck_visitas_resultado CHECK (resultado IN ('COMPROU','NAO_COMPROU','REMARCADO'))
);
GO

IF OBJECT_ID('dbo.cidades') IS NULL
CREATE TABLE dbo.cidades (
    id_cidade             INT IDENTITY(1,1) PRIMARY KEY,
    cod_ibge              VARCHAR(7) NOT NULL UNIQUE,
    qtd_clientes          INT NOT NULL DEFAULT 0,
    qtd_ativos            INT NOT NULL DEFAULT 0,
    qtd_limbo             INT NOT NULL DEFAULT 0,
    qtd_mortos            INT NOT NULL DEFAULT 0,
    qtd_classe_a          INT NOT NULL DEFAULT 0,
    qtd_classe_b          INT NOT NULL DEFAULT 0,
    vlr_historico         DECIMAL(18,2) NOT NULL DEFAULT 0,
    dt_ultimo_faturamento DATE NULL,
    cor_semaforo          VARCHAR(10) NOT NULL,
    batedor_regiao        VARCHAR(60) NULL,
    CONSTRAINT fk_cidades_municipio FOREIGN KEY (cod_ibge) REFERENCES dbo.municipios(cod_ibge)
);
GO
