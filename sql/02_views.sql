/* =============================================================================
   CLIENTES LIMBO — views de leitura do Protheus/TOTVS (material de apoio)

   Convencoes do Protheus tratadas aqui:
     - Uma tabela por empresa: SA1010 (MB), SA1020 (LM), ... com UNION ALL
     - Campos CHAR com padding a direita  -> RTRIM em tudo
     - Datas em CHAR(8) 'YYYYMMDD'        -> CONVERT(DATE, campo, 112)
     - Data '19000101' significa NULO     -> NULLIF antes de converter
     - Registro logicamente excluido      -> D_E_L_E_T_ <> '*'
   ============================================================================= */
USE BI_LIMBO;
GO

/* ---------------------------------------------------------------- cadastro
   SA1010 = cadastro de clientes. Uma tabela por empresa, unidas por UNION ALL.
   Ajuste os sufixos conforme o ambiente (010 = MB, 020 = LM, ...). */
CREATE OR ALTER VIEW dbo.vw_protheus_clientes AS
SELECT 'MB'   AS empresa, RTRIM(A1_COD) AS cod_cliente, RTRIM(A1_LOJA) AS loja,
       RTRIM(A1_NOME)  AS razao_social, RTRIM(A1_CONTATO) AS nome_contato,
       RTRIM(A1_EST)   AS uf,           RTRIM(A1_MUN)     AS cidade,
       RTRIM(A1_COD_MUN) AS cod_mun_protheus,
       RTRIM(A1_EMAIL) AS email,        RTRIM(A1_DDD)     AS ddd,
       RTRIM(A1_TEL)   AS telefone
  FROM PROTHEUS.dbo.SA1010 WITH (NOLOCK)
 WHERE D_E_L_E_T_ <> '*'
UNION ALL
SELECT 'LM', RTRIM(A1_COD), RTRIM(A1_LOJA), RTRIM(A1_NOME), RTRIM(A1_CONTATO),
       RTRIM(A1_EST), RTRIM(A1_MUN), RTRIM(A1_COD_MUN), RTRIM(A1_EMAIL),
       RTRIM(A1_DDD), RTRIM(A1_TEL)
  FROM PROTHEUS.dbo.SA1020 WITH (NOLOCK)
 WHERE D_E_L_E_T_ <> '*'
UNION ALL
SELECT 'WCO', RTRIM(A1_COD), RTRIM(A1_LOJA), RTRIM(A1_NOME), RTRIM(A1_CONTATO),
       RTRIM(A1_EST), RTRIM(A1_MUN), RTRIM(A1_COD_MUN), RTRIM(A1_EMAIL),
       RTRIM(A1_DDD), RTRIM(A1_TEL)
  FROM PROTHEUS.dbo.SA1030 WITH (NOLOCK)
 WHERE D_E_L_E_T_ <> '*';
/* ... repetir o bloco UNION ALL para WSP, WSUL, WNE, WNO ... */
GO

/* ---------------------------------------------------------------- faturamento
   SD2010 = itens de nota fiscal de saida. Agrega valor historico, qtd de notas,
   ultima compra e as linhas de produto que o cliente costumava levar.
   D2_TIPO = 'N' exclui devolucoes/complementos. */
CREATE OR ALTER VIEW dbo.vw_protheus_faturamento AS
SELECT 'MB' AS empresa, RTRIM(D2_CLIENTE) AS cod_cliente, RTRIM(D2_LOJA) AS loja,
       MAX(CONVERT(DATE, NULLIF(D2_EMISSAO, '19000101'), 112)) AS dt_ultima_compra,
       SUM(D2_TOTAL)                    AS vlr_historico,
       COUNT(DISTINCT RTRIM(D2_DOC))    AS qtd_notas
  FROM PROTHEUS.dbo.SD2010 WITH (NOLOCK)
 WHERE D_E_L_E_T_ <> '*'
   AND D2_TIPO = 'N'
   AND D2_EMISSAO <> '19000101'
 GROUP BY RTRIM(D2_CLIENTE), RTRIM(D2_LOJA)
UNION ALL
SELECT 'LM', RTRIM(D2_CLIENTE), RTRIM(D2_LOJA),
       MAX(CONVERT(DATE, NULLIF(D2_EMISSAO, '19000101'), 112)),
       SUM(D2_TOTAL), COUNT(DISTINCT RTRIM(D2_DOC))
  FROM PROTHEUS.dbo.SD2020 WITH (NOLOCK)
 WHERE D_E_L_E_T_ <> '*' AND D2_TIPO = 'N' AND D2_EMISSAO <> '19000101'
 GROUP BY RTRIM(D2_CLIENTE), RTRIM(D2_LOJA);
/* ... repetir para as demais empresas ... */
GO

/* ---------------------------------------------------------------- status
   ATIVO >= 2025 | LIMBO 2019-2024 | MORTO < 2019.
   O corte e recalculado 1x por ano, em 01/jan (ver 03_procedures.sql). */
CREATE OR ALTER VIEW dbo.vw_status_cliente AS
SELECT c.id_cliente, c.empresa, c.cod_cliente, c.loja, c.dt_ultima_compra,
       CASE WHEN c.dt_ultima_compra IS NULL              THEN 'MORTO'
            WHEN YEAR(c.dt_ultima_compra) >= 2025        THEN 'ATIVO'
            WHEN YEAR(c.dt_ultima_compra) BETWEEN 2019 AND 2024 THEN 'LIMBO'
            ELSE 'MORTO' END AS status_calculado
  FROM dbo.clientes c;
GO

/* ---------------------------------------------------------------- classe
   Classificacao A/B/C SOMENTE por engajamento. Sem score, sem RFV, sem
   percentil, sem recencia. A classe so sobe — ver o CASE em 03_procedures. */
CREATE OR ALTER VIEW dbo.vw_classe_engajamento AS
SELECT c.id_cliente,
       CASE WHEN EXISTS (SELECT 1 FROM dbo.eventos e
                          WHERE e.id_cliente = c.id_cliente
                            AND e.tipo_evento IN ('EMAIL_CLICADO','EMAIL_RESPONDIDO',
                                'WHATSAPP_RESPONDIDO','PEDIU_ORCAMENTO','ACEITOU_VISITA'))
            THEN 'A'
            WHEN EXISTS (SELECT 1 FROM dbo.eventos e
                          WHERE e.id_cliente = c.id_cliente
                            AND e.tipo_evento IN ('EMAIL_ABERTO','WHATSAPP_VISUALIZADO'))
            THEN 'B'
            ELSE 'C' END AS classe_calculada
  FROM dbo.clientes c;
GO

/* ---------------------------------------------------------------- semaforo
   LEFT JOIN a partir de municipios: e o que faz a cor BRANCA existir. */
CREATE OR ALTER VIEW dbo.vw_semaforo_cidades AS
SELECT m.cod_ibge, m.cidade, m.uf,
       COUNT(c.id_cliente)                                           AS qtd_clientes,
       SUM(CASE WHEN c.status = 'ATIVO' THEN 1 ELSE 0 END)           AS qtd_ativos,
       SUM(CASE WHEN c.status = 'LIMBO' THEN 1 ELSE 0 END)           AS qtd_limbo,
       SUM(CASE WHEN c.status = 'MORTO' THEN 1 ELSE 0 END)           AS qtd_mortos,
       SUM(CASE WHEN c.classe = 'A' THEN 1 ELSE 0 END)               AS qtd_classe_a,
       SUM(CASE WHEN c.classe = 'B' THEN 1 ELSE 0 END)               AS qtd_classe_b,
       ISNULL(SUM(c.vlr_historico), 0)                               AS vlr_historico,
       MAX(c.dt_ultima_compra)                                       AS dt_ultimo_faturamento,
       CASE WHEN COUNT(c.id_cliente) = 0                       THEN 'BRANCA'
            WHEN SUM(CASE WHEN c.status='ATIVO' THEN 1 ELSE 0 END) > 0 THEN 'VERDE'
            WHEN SUM(CASE WHEN c.status='LIMBO' THEN 1 ELSE 0 END) > 0 THEN 'AMARELA'
            ELSE 'VERMELHA' END                                      AS cor_semaforo
  FROM dbo.municipios m
  LEFT JOIN dbo.clientes c ON c.cod_ibge = m.cod_ibge
 GROUP BY m.cod_ibge, m.cidade, m.uf;
GO

/* ---------------------------------------------------------------- fila do batedor
   SOMENTE classe A. Cliente C nunca e entregue ao campo. */
CREATE OR ALTER VIEW dbo.vw_fila_batedor AS
SELECT c.batedor, c.cidade, c.uf, c.id_cliente, c.empresa, c.cod_cliente, c.loja,
       c.razao_social, c.nome_contato, c.whatsapp, c.email, c.dt_ultima_compra,
       c.vlr_historico, c.linhas_compradas, c.dt_ultima_resposta
  FROM dbo.clientes c
 WHERE c.classe = 'A' AND c.opt_out = 0;
GO

/* ---------------------------------------------------------------- contatos do dia */
CREATE OR ALTER VIEW dbo.vw_contatos_do_dia AS
SELECT c.*
  FROM dbo.clientes c
 WHERE c.status = 'LIMBO'
   AND c.opt_out = 0
   AND c.qtd_tentativas < 3
   AND (c.dt_fim_quarentena IS NULL OR c.dt_fim_quarentena <= CAST(GETDATE() AS DATE))
   AND (c.dt_proximo_contato IS NULL OR c.dt_proximo_contato <= CAST(GETDATE() AS DATE));
GO
