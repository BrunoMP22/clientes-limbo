/* =============================================================================
   CLIENTES LIMBO — procedures de carga e regra (material de apoio)

   Regras invioalveis reproduzidas aqui:
     1. sp_aplicar_evento e o UNICO caminho que altera a classe.
     2. A classe SO SOBE. Recalculo menor que a classe atual e descartado.
     3. A carga usa MERGE (UPSERT) pela chave natural (empresa, cod_cliente,
        loja). NUNCA apagar e reinserir cliente: eventos e visitas referenciam
        id_cliente.
   ============================================================================= */
USE BI_LIMBO;
GO

/* ---------------------------------------------------------------------------
   sp_carregar_clientes — le o Protheus e faz UPSERT na tabela clientes.
   Roda todo dia de madrugada. Nao mexe em classe nem em engajamento:
   esses campos pertencem a regua, nao ao ERP.
   --------------------------------------------------------------------------- */
CREATE OR ALTER PROCEDURE dbo.sp_carregar_clientes AS
BEGIN
    SET NOCOUNT ON;

    ;WITH origem AS (
        SELECT cad.empresa, cad.cod_cliente, cad.loja, cad.razao_social,
               cad.nome_contato, cad.cidade, cad.uf, cad.email,
               '55' + cad.ddd + REPLACE(REPLACE(REPLACE(REPLACE(cad.telefone,
                    '(',''), ')',''), '-',''), ' ','') AS whatsapp_e164,
               m.cod_ibge,
               fat.dt_ultima_compra, fat.vlr_historico, fat.qtd_notas
          FROM dbo.vw_protheus_clientes cad
          LEFT JOIN dbo.vw_protheus_faturamento fat
                 ON fat.empresa = cad.empresa
                AND fat.cod_cliente = cad.cod_cliente
                AND fat.loja = cad.loja
          /* amarracao por nome normalizado quando o Protheus nao tem IBGE */
          LEFT JOIN dbo.municipios m
                 ON m.uf = cad.uf
                AND m.cidade_norm = UPPER(cad.cidade) COLLATE Latin1_General_CI_AI
    )
    MERGE dbo.clientes AS destino
    USING origem AS o
       ON destino.empresa     = o.empresa
      AND destino.cod_cliente = o.cod_cliente
      AND destino.loja        = o.loja
    WHEN MATCHED THEN UPDATE SET
        destino.razao_social     = o.razao_social,
        destino.nome_contato     = o.nome_contato,
        destino.cidade           = o.cidade,
        destino.uf               = o.uf,
        destino.cod_ibge         = ISNULL(o.cod_ibge, destino.cod_ibge),
        destino.email            = o.email,
        destino.whatsapp_e164    = o.whatsapp_e164,
        destino.dt_ultima_compra = o.dt_ultima_compra,
        destino.vlr_historico    = ISNULL(o.vlr_historico, 0),
        destino.qtd_notas        = ISNULL(o.qtd_notas, 0),
        destino.anos_inativo     = DATEDIFF(YEAR, o.dt_ultima_compra, GETDATE())
    WHEN NOT MATCHED BY TARGET THEN
        INSERT (empresa, cod_cliente, loja, razao_social, nome_contato, cidade, uf,
                cod_ibge, email, whatsapp_e164, dt_ultima_compra, vlr_historico,
                qtd_notas, anos_inativo, status, classe)
        VALUES (o.empresa, o.cod_cliente, o.loja, o.razao_social, o.nome_contato,
                o.cidade, o.uf, o.cod_ibge, o.email, o.whatsapp_e164,
                o.dt_ultima_compra, ISNULL(o.vlr_historico, 0), ISNULL(o.qtd_notas, 0),
                DATEDIFF(YEAR, o.dt_ultima_compra, GETDATE()), 'MORTO', 'C');
    /* Sem WHEN NOT MATCHED BY SOURCE THEN DELETE: cliente nunca e apagado. */

    /* token de rastreio para quem ainda nao tem */
    UPDATE dbo.clientes
       SET token_rastreio = LEFT(CONVERT(VARCHAR(64),
            HASHBYTES('SHA2_256', 'limbo-clientes-' + CAST(id_cliente AS VARCHAR(12))), 2), 10)
     WHERE token_rastreio IS NULL;
END;
GO

/* ---------------------------------------------------------------------------
   sp_recalcular_status — o corte roda 1x por ano, em 01/jan.
   EXCECAO: cliente LIMBO que emite nota fiscal volta a ATIVO imediatamente,
   e isso e tratado em sp_aplicar_evento, nao aqui.
   --------------------------------------------------------------------------- */
CREATE OR ALTER PROCEDURE dbo.sp_recalcular_status AS
BEGIN
    SET NOCOUNT ON;
    UPDATE c
       SET c.status = v.status_calculado,
           c.anos_inativo = DATEDIFF(YEAR, c.dt_ultima_compra, GETDATE())
      FROM dbo.clientes c
      JOIN dbo.vw_status_cliente v ON v.id_cliente = c.id_cliente
     WHERE c.status <> v.status_calculado
       AND c.dt_reativacao IS NULL;  /* reativado no ano nao volta para LIMBO */
END;
GO

/* ---------------------------------------------------------------------------
   sp_aplicar_evento — UNICO caminho que altera classe/status/regua.
   --------------------------------------------------------------------------- */
CREATE OR ALTER PROCEDURE dbo.sp_aplicar_evento
    @id_cliente  INT,
    @tipo_evento VARCHAR(30),
    @canal       VARCHAR(15)  = NULL,
    @dt_evento   DATETIME     = NULL,
    @detalhe     VARCHAR(300) = NULL,
    @origem      VARCHAR(20)  = 'MANUAL'
AS
BEGIN
    SET NOCOUNT ON;
    SET @dt_evento = ISNULL(@dt_evento, GETDATE());
    SET @canal = ISNULL(@canal, CASE
        WHEN @tipo_evento LIKE 'EMAIL%'    THEN 'EMAIL'
        WHEN @tipo_evento LIKE 'WHATSAPP%' THEN 'WHATSAPP'
        ELSE 'SISTEMA' END);

    DECLARE @hash CHAR(64) = CONVERT(CHAR(64), HASHBYTES('SHA2_256',
        CAST(@id_cliente AS VARCHAR(12)) + '|' + @tipo_evento + '|' +
        CONVERT(VARCHAR(19), @dt_evento, 120) + '|' + @canal), 2);

    IF EXISTS (SELECT 1 FROM dbo.eventos WHERE hash_evento = @hash)
        RETURN;  /* deduplicacao: reimportar o mesmo arquivo nao duplica nada */

    DECLARE @classe_antes CHAR(1) =
        (SELECT classe FROM dbo.clientes WHERE id_cliente = @id_cliente);

    INSERT INTO dbo.eventos (id_cliente, tipo_evento, canal, dt_evento, detalhe,
                             origem, hash_evento)
    VALUES (@id_cliente, @tipo_evento, @canal, @dt_evento, @detalhe, @origem, @hash);

    /* ---- contadores de engajamento */
    UPDATE dbo.clientes SET
        qtd_emails_enviados    = qtd_emails_enviados    + CASE WHEN @tipo_evento = 'EMAIL_ENVIADO' THEN 1 ELSE 0 END,
        qtd_emails_abertos     = qtd_emails_abertos     + CASE WHEN @tipo_evento = 'EMAIL_ABERTO' THEN 1 ELSE 0 END,
        qtd_emails_respondidos = qtd_emails_respondidos + CASE WHEN @tipo_evento = 'EMAIL_RESPONDIDO' THEN 1 ELSE 0 END,
        qtd_whats_enviados     = qtd_whats_enviados     + CASE WHEN @tipo_evento = 'WHATSAPP_ENVIADO' THEN 1 ELSE 0 END,
        qtd_whats_visualizados = qtd_whats_visualizados + CASE WHEN @tipo_evento = 'WHATSAPP_VISUALIZADO' THEN 1 ELSE 0 END,
        qtd_whats_respondidos  = qtd_whats_respondidos  + CASE WHEN @tipo_evento = 'WHATSAPP_RESPONDIDO' THEN 1 ELSE 0 END,
        respondeu_email        = CASE WHEN @tipo_evento IN ('EMAIL_RESPONDIDO','EMAIL_CLICADO') THEN 1 ELSE respondeu_email END,
        respondeu_whatsapp     = CASE WHEN @tipo_evento = 'WHATSAPP_RESPONDIDO' THEN 1 ELSE respondeu_whatsapp END,
        dt_ultima_resposta     = CASE WHEN @tipo_evento IN ('EMAIL_RESPONDIDO','EMAIL_CLICADO',
                                     'WHATSAPP_RESPONDIDO','PEDIU_ORCAMENTO','ACEITOU_VISITA')
                                      THEN @dt_evento ELSE dt_ultima_resposta END,
        email_valido           = CASE WHEN @tipo_evento = 'EMAIL_DEVOLVIDO' THEN 0 ELSE email_valido END,
        na_fila_batedor        = CASE WHEN @tipo_evento IN ('PEDIU_ORCAMENTO','ACEITOU_VISITA') THEN 1 ELSE na_fila_batedor END,
        opt_out                = CASE WHEN @tipo_evento = 'OPT_OUT' THEN 1 ELSE opt_out END,
        dt_opt_out             = CASE WHEN @tipo_evento = 'OPT_OUT' THEN CAST(@dt_evento AS DATE) ELSE dt_opt_out END,
        /* EXCECAO da secao 3.1: nota fiscal tira do LIMBO na hora */
        status                 = CASE WHEN @tipo_evento = 'NOTA_FISCAL' THEN 'ATIVO' ELSE status END,
        dt_reativacao          = CASE WHEN @tipo_evento = 'NOTA_FISCAL' THEN CAST(@dt_evento AS DATE) ELSE dt_reativacao END
    WHERE id_cliente = @id_cliente;

    /* ---- regua: tentativas avancam a etapa e agendam o proximo contato */
    IF @tipo_evento IN ('EMAIL_ENVIADO','WHATSAPP_ENVIADO','TENTATIVA_SEM_RETORNO')
    BEGIN
        UPDATE dbo.clientes
           SET qtd_tentativas     = qtd_tentativas + 1,
               dt_ultimo_contato  = CAST(@dt_evento AS DATE),
               etapa_regua        = etapa_regua + 1,
               dt_proximo_contato = DATEADD(DAY, CASE etapa_regua
                                        WHEN 0 THEN 3 WHEN 1 THEN 7 WHEN 2 THEN 10
                                        WHEN 3 THEN 10 WHEN 4 THEN 15 ELSE NULL END,
                                        CAST(@dt_evento AS DATE))
         WHERE id_cliente = @id_cliente;

        /* 3 tentativas sem nenhum sinal -> 90 dias de quarentena */
        UPDATE dbo.clientes
           SET dt_fim_quarentena = DATEADD(DAY, 90, CAST(@dt_evento AS DATE)),
               qtd_tentativas    = 0
         WHERE id_cliente = @id_cliente AND qtd_tentativas >= 3 AND classe = 'C';
    END

    /* sinal do cliente zera o contador de tentativas sem retorno */
    IF @tipo_evento IN ('EMAIL_ABERTO','EMAIL_CLICADO','EMAIL_RESPONDIDO',
                        'WHATSAPP_VISUALIZADO','WHATSAPP_RESPONDIDO',
                        'PEDIU_ORCAMENTO','ACEITOU_VISITA')
        UPDATE dbo.clientes SET qtd_tentativas = 0 WHERE id_cliente = @id_cliente;

    /* ---- recalculo da classe: SO SOBE */
    UPDATE c
       SET c.classe = v.classe_calculada,
           c.dt_mudanca_classe = CAST(@dt_evento AS DATE)
      FROM dbo.clientes c
      JOIN dbo.vw_classe_engajamento v ON v.id_cliente = c.id_cliente
     WHERE c.id_cliente = @id_cliente
       AND CASE v.classe_calculada WHEN 'A' THEN 3 WHEN 'B' THEN 2 ELSE 1 END
         > CASE c.classe             WHEN 'A' THEN 3 WHEN 'B' THEN 2 ELSE 1 END;

    SELECT @classe_antes AS classe_anterior,
           (SELECT classe FROM dbo.clientes WHERE id_cliente = @id_cliente) AS classe_nova;
END;
GO

/* ---------------------------------------------------------------------------
   sp_atualizar_cidades — regenera o semaforo a partir da view.
   --------------------------------------------------------------------------- */
CREATE OR ALTER PROCEDURE dbo.sp_atualizar_cidades AS
BEGIN
    SET NOCOUNT ON;
    MERGE dbo.cidades AS destino
    USING dbo.vw_semaforo_cidades AS o ON destino.cod_ibge = o.cod_ibge
    WHEN MATCHED THEN UPDATE SET
        qtd_clientes = o.qtd_clientes, qtd_ativos = o.qtd_ativos,
        qtd_limbo = o.qtd_limbo, qtd_mortos = o.qtd_mortos,
        qtd_classe_a = o.qtd_classe_a, qtd_classe_b = o.qtd_classe_b,
        vlr_historico = o.vlr_historico, dt_ultimo_faturamento = o.dt_ultimo_faturamento,
        cor_semaforo = o.cor_semaforo
    WHEN NOT MATCHED BY TARGET THEN
        INSERT (cod_ibge, qtd_clientes, qtd_ativos, qtd_limbo, qtd_mortos,
                qtd_classe_a, qtd_classe_b, vlr_historico, dt_ultimo_faturamento, cor_semaforo)
        VALUES (o.cod_ibge, o.qtd_clientes, o.qtd_ativos, o.qtd_limbo, o.qtd_mortos,
                o.qtd_classe_a, o.qtd_classe_b, o.vlr_historico,
                o.dt_ultimo_faturamento, o.cor_semaforo);
END;
GO

/* ---------------------------------------------------------------------------
   sp_importar_eventos_csv — casa por e-mail. Um cadastro pode ter varios
   e-mails no mesmo campo separados por ';' ou '/': STRING_SPLIT resolve.
   O que nao casar vai para eventos_rejeitados — nada some em silencio.
   Requer @stg_eventos_csv previamente carregada (BULK INSERT / SSIS).
   --------------------------------------------------------------------------- */
CREATE OR ALTER PROCEDURE dbo.sp_importar_eventos_csv
    @arquivo VARCHAR(200)
AS
BEGIN
    SET NOCOUNT ON;

    ;WITH emails_cliente AS (
        SELECT c.id_cliente, LTRIM(RTRIM(LOWER(s.value))) AS email
          FROM dbo.clientes c
         CROSS APPLY STRING_SPLIT(REPLACE(c.email, '/', ';'), ';') s
         WHERE c.email IS NOT NULL AND LTRIM(RTRIM(s.value)) <> ''
    )
    INSERT INTO dbo.eventos_rejeitados (email_original, tipo_evento, dt_evento, motivo, arquivo_origem)
    SELECT stg.email, stg.evento, stg.data,
           CASE WHEN ec.id_cliente IS NULL THEN 'E-mail nao encontrado em nenhum cliente'
                WHEN stg.data IS NULL      THEN 'Data ausente'
                ELSE 'Tipo de evento desconhecido' END,
           @arquivo
      FROM dbo.stg_eventos_csv stg
      LEFT JOIN emails_cliente ec ON ec.email = LOWER(LTRIM(RTRIM(stg.email)))
     WHERE ec.id_cliente IS NULL
        OR stg.data IS NULL
        OR stg.evento NOT IN ('EMAIL_ENVIADO','EMAIL_ABERTO','EMAIL_CLICADO','EMAIL_RESPONDIDO',
             'EMAIL_DEVOLVIDO','WHATSAPP_ENVIADO','WHATSAPP_VISUALIZADO','WHATSAPP_RESPONDIDO',
             'PEDIU_ORCAMENTO','ACEITOU_VISITA','NOTA_FISCAL','OPT_OUT','TENTATIVA_SEM_RETORNO');

    /* aplica os que casaram, um a um, para passar pela regra de classe */
    DECLARE @id INT, @tipo VARCHAR(30), @dt DATETIME;
    DECLARE cur CURSOR LOCAL FAST_FORWARD FOR
        WITH emails_cliente AS (
            SELECT c.id_cliente, LTRIM(RTRIM(LOWER(s.value))) AS email
              FROM dbo.clientes c
             CROSS APPLY STRING_SPLIT(REPLACE(c.email, '/', ';'), ';') s
             WHERE c.email IS NOT NULL AND LTRIM(RTRIM(s.value)) <> ''
        )
        SELECT ec.id_cliente, stg.evento, stg.data
          FROM dbo.stg_eventos_csv stg
          JOIN emails_cliente ec ON ec.email = LOWER(LTRIM(RTRIM(stg.email)))
         WHERE stg.data IS NOT NULL;
    OPEN cur;
    FETCH NEXT FROM cur INTO @id, @tipo, @dt;
    WHILE @@FETCH_STATUS = 0
    BEGIN
        EXEC dbo.sp_aplicar_evento @id_cliente = @id, @tipo_evento = @tipo,
                                   @dt_evento = @dt, @origem = 'IMPORT_CSV';
        FETCH NEXT FROM cur INTO @id, @tipo, @dt;
    END
    CLOSE cur; DEALLOCATE cur;
END;
GO
