# -*- coding: utf-8 -*-
"""Geracao dos dados ficticios. Seed fixo (42): resultado sempre igual.

Os eventos sao gerados via regras.aplicar_evento, garantindo que contadores,
classes e regua fiquem 100% coerentes com a tabela de eventos.
"""
import random
from datetime import date, datetime, timedelta

import regras

random.seed(42)

EMPRESAS = [
    ('MB', 'Matriz Belo Horizonte'), ('LM', 'LM Distribuidora'),
    ('WCO', 'Filial Centro-Oeste'), ('WSP', 'Filial São Paulo'),
    ('WSUL', 'Filial Sul'), ('WNE', 'Filial Nordeste'), ('WNO', 'Filial Norte'),
]

# DECISAO: codigos IBGE gerados sequencialmente com prefixo real da UF
# (31 MG, 29 BA, 42 SC, 35 SP, 52 GO, 32 ES) — sao ficticios, como os clientes.
MUNICIPIOS = {
    'MG': ['Belo Horizonte', 'Contagem', 'Betim', 'Uberlândia', 'Uberaba', 'Juiz de Fora',
           'Montes Claros', 'Governador Valadares', 'Ipatinga', 'Sete Lagoas', 'Divinópolis',
           'Santa Luzia', 'Ibirité', 'Poços de Caldas', 'Patos de Minas', 'Pouso Alegre',
           'Teófilo Otoni', 'Barbacena', 'Sabará', 'Varginha', 'Conselheiro Lafaiete',
           'Vespasiano', 'Itabira', 'Araguari', 'Ubá', 'Passos', 'Coronel Fabriciano',
           'Muriaé', 'Ituiutaba', 'Lavras', 'Nova Lima', 'Itaúna', 'Pará de Minas',
           'Paracatu', 'Caratinga', 'Nova Serrana', 'São João del-Rei', 'Patrocínio',
           'Timóteo', 'Manhuaçu', 'Unaí', 'Curvelo', 'Alfenas', 'João Monlevade',
           'Três Corações', 'Viçosa', 'Cataguases', 'Ouro Preto', 'Janaúba',
           'São Sebastião do Paraíso', 'Januária', 'Formiga', 'Esmeraldas',
           'Pedro Leopoldo', 'Ponte Nova', 'Mariana', 'Frutal', 'Três Pontas', 'Itajubá',
           'Pirapora', 'Lagoa Santa', 'Congonhas', 'Machado', 'Guaxupé', 'Diamantina',
           'Bocaiúva', 'Salinas', 'Oliveira', 'Bom Despacho', 'Almenara'],
    'BA': ['Salvador', 'Feira de Santana', 'Vitória da Conquista', 'Camaçari', 'Itabuna',
           'Juazeiro', 'Ilhéus', 'Jequié', 'Teixeira de Freitas', 'Barreiras',
           'Alagoinhas', 'Porto Seguro'],
    'SC': ['Florianópolis', 'Joinville', 'Blumenau', 'São José', 'Chapecó', 'Itajaí',
           'Criciúma', 'Jaraguá do Sul', 'Lages', 'Balneário Camboriú'],
    'SP': ['São Paulo', 'Campinas', 'Ribeirão Preto', 'Sorocaba', 'São José do Rio Preto',
           'Franca', 'Bauru', 'Araraquara', 'Piracicaba', 'Jundiaí', 'Limeira', 'Marília'],
    'GO': ['Goiânia', 'Anápolis', 'Aparecida de Goiânia', 'Rio Verde', 'Catalão',
           'Itumbiara', 'Jataí', 'Luziânia'],
    'ES': ['Vitória', 'Vila Velha', 'Serra', 'Cariacica', 'Cachoeiro de Itapemirim',
           'Linhares', 'Colatina', 'Guarapari'],
}
PREFIXO_IBGE = {'MG': '31', 'BA': '29', 'SC': '42', 'SP': '35', 'GO': '52', 'ES': '32'}
REGIAO_UF = {'MG': 'Sudeste', 'SP': 'Sudeste', 'ES': 'Sudeste',
             'BA': 'Nordeste', 'SC': 'Sul', 'GO': 'Centro-Oeste'}
DDD_UF = {'MG': ['31', '32', '34', '37', '38'], 'BA': ['71', '73', '75', '77'],
          'SC': ['47', '48', '49'], 'SP': ['11', '14', '16', '19'],
          'GO': ['62', '64'], 'ES': ['27', '28']}

NOMES_A = ['MOTO PEÇAS', 'BIKE CENTER', 'AUTO MOTO', 'CASA DO MOTOCICLISTA',
           'PNEUS E ACESSÓRIOS', 'COMERCIAL DUAS RODAS', 'DISTRIBUIDORA MOTOMAX',
           'CICLO PEÇAS', 'MOTO SHOP', 'OFICINA E PEÇAS', 'MOTO CENTER',
           'ACESSÓRIOS E CIA', 'PEÇAS E MOTOS', 'BICICLETARIA', 'MOTO MIL']
NOMES_B = ['SANTA RITA', 'DO VALE', 'SUL', 'CENTRAL', 'UNIÃO', 'PROGRESSO',
           'NACIONAL', 'POPULAR', 'IDEAL', 'MODELO', 'PLANALTO', 'SERRA AZUL',
           'BOA VISTA', 'SÃO JORGE', 'ALIANÇA', 'HORIZONTE', 'MINEIRA', 'REAL']
SUFIXOS = ['LTDA', 'ME', 'EIRELI', 'COM. DE PEÇAS', 'LTDA ME', 'COMÉRCIO LTDA']
CONTATOS = ['Carlos', 'Fernanda', 'João', 'Mariana', 'Ricardo', 'Patrícia', 'André',
            'Juliana', 'Marcos', 'Camila', 'Sérgio', 'Renata', 'Paulo', 'Adriana',
            'Eduardo', 'Simone', 'Rogério', 'Vanessa', 'Luiz', 'Cristina']
SOBRENOMES = ['Silva', 'Souza', 'Oliveira', 'Santos', 'Pereira', 'Costa', 'Almeida',
              'Ferreira', 'Ribeiro', 'Martins', 'Gomes', 'Barbosa']
LINHAS = ['Freios', 'Pneus', 'Transmissão', 'Elétrica', 'Acessórios', 'Capacetes', 'Óleos']
DOMINIOS = ['gmail.com', 'hotmail.com', 'uol.com.br', 'yahoo.com.br', 'outlook.com']


def _dt(d, hora=True):
    if hora:
        return d.strftime('%Y-%m-%d %H:%M:%S')
    return d.strftime('%Y-%m-%d')


def popular(conn):
    hoje = date.today()

    # ---------------- empresas
    for emp, desc in EMPRESAS:
        conn.execute('INSERT OR IGNORE INTO empresas (empresa, descricao) VALUES (?,?)',
                     (emp, desc))

    # ---------------- municipios (120)
    municipios = []
    for uf, cidades in MUNICIPIOS.items():
        for i, cid in enumerate(cidades):
            cod = f'{PREFIXO_IBGE[uf]}{i + 1:05d}'
            municipios.append((cod, cid, uf))
            conn.execute('INSERT OR IGNORE INTO municipios VALUES (?,?,?,?,?)',
                         (cod, cid, regras.normalizar_cidade(cid), uf, REGIAO_UF[uf]))

    # ~40 municipios ficam SEM cliente (cor BRANCA / territorio virgem).
    # Outros 6 recebem SOMENTE clientes mortos, para a cor VERMELHA existir.
    com_cliente = {uf: [] for uf in MUNICIPIOS}
    so_mortos = []
    virgens = set()
    for idx, (cod, cid, uf) in enumerate(municipios):
        if idx % 3 == 2 and len(virgens) < 40:
            virgens.add(cod)          # sem nenhum cliente -> BRANCA
        elif idx % 11 == 5 and len(so_mortos) < 6:
            so_mortos.append((cod, cid, uf))  # so clientes mortos -> VERMELHA
        else:
            com_cliente[uf].append((cod, cid))

    # ---------------- clientes (500)
    # Composicao exata: 400 LIMBO (80%) + 60 ATIVO (12%) + 40 MORTO (8%).
    # Dentro do limbo, por ano: 2019 10% | 2020 12% | 2021 15% | 2022 18% |
    # 2023 21% | 2024 24%.
    uf_pool = (['MG'] * 65 + ['SP'] * 10 + ['BA'] * 8 + ['SC'] * 7 + ['GO'] * 5 + ['ES'] * 5)
    plano = []
    for ano, qtd in [(2019, 40), (2020, 48), (2021, 60), (2022, 72), (2023, 84), (2024, 96)]:
        plano += [(ano, None)] * qtd
    plano += [(random.choice([2025, 2025, 2026]), None) for _ in range(60)]
    plano += [(random.randint(2014, 2018), None) for _ in range(20)]
    # 20 clientes mortos concentrados nas 6 cidades exclusivas -> semaforo VERMELHO
    for k in range(20):
        plano.append((random.randint(2013, 2018), so_mortos[k % len(so_mortos)]))
    random.shuffle(plano)

    seq_por_empresa = {e: 0 for e, _ in EMPRESAS}
    ids = []

    for i, (ano, cidade_fixa) in enumerate(plano):
        if cidade_fixa:
            cod_ibge, cidade, uf = cidade_fixa
        else:
            uf = random.choice(uf_pool)
            cod_ibge, cidade = random.choice(com_cliente[uf])
        empresa = random.choice([e for e, _ in EMPRESAS])
        seq_por_empresa[empresa] += 1
        cod_cliente = f'{seq_por_empresa[empresa] * 7 + 100:06d}'
        loja = '01' if random.random() < 0.85 else '02'

        razao = f'{random.choice(NOMES_A)} {random.choice(NOMES_B)} {random.choice(SUFIXOS)}'
        contato = f'{random.choice(CONTATOS)} {random.choice(SOBRENOMES)}'

        dt_compra = date(ano, random.randint(1, 12), random.randint(1, 28))
        if dt_compra > hoje:
            dt_compra = hoje - timedelta(days=random.randint(5, 120))
        status = regras.calcular_status(_dt(dt_compra, hora=False))
        anos_inativo = max(0, hoje.year - dt_compra.year)

        # e-mail: ~15% sem; ~5% com multiplos e-mails no mesmo campo
        email = None
        if random.random() >= 0.15:
            slug = regras.normalizar_cidade(razao).lower().replace(' ', '.')[:20].strip('.')
            email = f'{slug}{i}@{random.choice(DOMINIOS)}'
            if random.random() < 0.05:
                email = f'{email}; contato{i}@{random.choice(DOMINIOS)}'

        # whatsapp: ~10% invalido
        ddd = random.choice(DDD_UF[uf])
        numero = f'9{random.randint(6000, 9999)}{random.randint(1000, 9999):04d}'[:9]
        whats_fmt = f'({ddd}) {numero[:5]}-{numero[5:]}'
        whats_e164 = regras.normalizar_telefone(ddd, numero)
        whats_valido = 0 if random.random() < 0.10 else 1

        # ~20 clientes com cod_ibge NULL (cadastro sem amarracao ao IBGE).
        # Nao aplicado as cidades exclusivas de mortos, que precisam do vinculo
        # para o semaforo VERMELHO aparecer.
        ibge_final = None if (i % 25 == 13 and not cidade_fixa) else cod_ibge

        vlr = round(3000 * (100000 / 3000) ** random.random() ** 1.6, 2)  # cauda longa
        linhas = '; '.join(random.sample(LINHAS, random.randint(1, 4)))

        cur = conn.execute("""
            INSERT INTO clientes (empresa, cod_cliente, loja, razao_social, nome_contato,
                cod_ibge, cidade, uf, email, email_valido, whatsapp, whatsapp_e164,
                whatsapp_valido, canal_pref, dt_ultima_compra, anos_inativo, vlr_historico,
                qtd_notas, linhas_compradas, status, classe, batedor)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        """, (empresa, cod_cliente, loja, razao, contato, ibge_final, cidade, uf,
              email, 1, whats_fmt, whats_e164, whats_valido,
              random.choice(['EMAIL', 'WHATSAPP']), _dt(dt_compra, hora=False),
              anos_inativo, vlr, random.randint(1, 60), linhas, status, 'C',
              regras.batedor_por_uf(uf)))
        id_cliente = cur.lastrowid
        conn.execute('UPDATE clientes SET token_rastreio = ? WHERE id_cliente = ?',
                     (regras.gerar_token(id_cliente), id_cliente))
        ids.append((id_cliente, status))
    conn.commit()

    # ---------------- eventos coerentes com a classe alvo (~1500)
    # Campanha em andamento sobre os clientes LIMBO: C ~60% | B ~28% | A ~12%
    limbo_rows = conn.execute(
        "SELECT id_cliente, cod_ibge FROM clientes WHERE status = 'LIMBO'").fetchall()
    limbo_ids = [r['id_cliente'] for r in limbo_rows]
    random.shuffle(limbo_ids)
    n = len(limbo_ids)
    # Os alvos de A e B sao levemente maiores que a meta final porque ~10
    # clientes classe A emitem nota fiscal adiante e saem do LIMBO para ATIVO.
    n_a, n_b = int(n * 0.145), int(n * 0.28)

    # Parte da classe A e concentrada nas cidades de maior carteira: e assim que
    # surgem cidades com 5+ clientes A, que ganham o selo "viagem justificada".
    # Escolhe a maior cidade de cada UF (duas em MG) para que os quatro batedores
    # tenham roteiro, em vez de concentrar tudo em Minas.
    por_cidade, uf_da_cidade = {}, {}
    for r in conn.execute("""
        SELECT c.id_cliente, c.cod_ibge, m.uf FROM clientes c
        JOIN municipios m ON m.cod_ibge = c.cod_ibge
        WHERE c.status = 'LIMBO'"""):
        por_cidade.setdefault(r['cod_ibge'], []).append(r['id_cliente'])
        uf_da_cidade[r['cod_ibge']] = r['uf']
    polos = []
    for uf in ['MG', 'SP', 'BA', 'SC', 'GO', 'ES']:
        candidatas = sorted((k for k in por_cidade if uf_da_cidade[k] == uf),
                            key=lambda k: -len(por_cidade[k]))
        polos += candidatas[:2 if uf == 'MG' else 1]
    alvo_a = []
    for cod in polos:
        alvo_a += random.sample(por_cidade[cod], min(7, len(por_cidade[cod])))
    escolhidos = set(alvo_a)
    # o restante da classe A vem espalhado; os ultimos da lista sao os que
    # emitirao nota fiscal, por isso nunca saem dos polos
    resto = [i for i in limbo_ids if i not in escolhidos]
    alvo_a += resto[:max(0, n_a - len(alvo_a))]
    escolhidos = set(alvo_a)
    resto = [i for i in limbo_ids if i not in escolhidos]
    alvo_b = resto[:n_b]
    alvo_c = resto[n_b:]

    def dt_aleatoria(dias_atras_max=50, dias_atras_min=1):
        d = hoje - timedelta(days=random.randint(dias_atras_min, dias_atras_max))
        return datetime(d.year, d.month, d.day, random.randint(8, 18),
                        random.randint(0, 59), random.randint(0, 59))

    def ev(idc, tipo, quando, origem='SEED'):
        regras.aplicar_evento(conn, idc, tipo, dt=_dt(quando), origem=origem)

    # classe C: so envios, sem nenhum sinal de volta
    for idc in alvo_c:
        base = dt_aleatoria(50, 6)
        for k in range(random.choice([1, 2, 2, 3])):
            ev(idc, random.choice(['EMAIL_ENVIADO', 'WHATSAPP_ENVIADO']),
               base + timedelta(days=k * 6))

    # classe B: envios + abertura/visualizacao, nunca resposta
    for idc in alvo_b:
        base = dt_aleatoria(45, 8)
        for k in range(random.randint(2, 3)):
            ev(idc, 'EMAIL_ENVIADO', base + timedelta(days=k * 4))
        ev(idc, 'EMAIL_ABERTO', base + timedelta(days=1, hours=2))
        if random.random() < 0.55:
            ev(idc, 'WHATSAPP_ENVIADO', base + timedelta(days=3))
            ev(idc, 'WHATSAPP_VISUALIZADO', base + timedelta(days=3, hours=4))
        if random.random() < 0.35:
            ev(idc, 'EMAIL_ABERTO', base + timedelta(days=9, hours=1))

    # classe A: envios + abertura + resposta
    respostas = ['EMAIL_RESPONDIDO', 'WHATSAPP_RESPONDIDO', 'EMAIL_CLICADO']
    recentes = alvo_a[:3]  # respostas nas ultimas 48h -> secao "ATENDER HOJE"
    for idc in alvo_a:
        base = dt_aleatoria(40, 10)
        ev(idc, 'EMAIL_ENVIADO', base)
        ev(idc, 'EMAIL_ABERTO', base + timedelta(hours=5))
        if random.random() < 0.65:
            ev(idc, 'WHATSAPP_ENVIADO', base + timedelta(days=2))
            ev(idc, 'WHATSAPP_VISUALIZADO', base + timedelta(days=2, hours=1))
        if idc in recentes:
            quando = datetime.now() - timedelta(hours=random.randint(2, 40))
        else:
            quando = base + timedelta(days=random.randint(1, 5))
        ev(idc, random.choice(respostas), quando)
        if random.random() < 0.45:
            ev(idc, random.choice(respostas), quando + timedelta(days=2, hours=6))
        if random.random() < 0.35:
            ev(idc, random.choice(['PEDIU_ORCAMENTO', 'ACEITOU_VISITA']),
               quando + timedelta(hours=3))

    # ~10 reativados: classe A que emitiu nota fiscal (LIMBO -> ATIVO na hora)
    for idc in alvo_a[-10:]:
        ev(idc, 'NOTA_FISCAL', dt_aleatoria(15, 1))

    # ~8 opt-outs e ~6 e-mails devolvidos
    for idc in random.sample(alvo_c, 8):
        ev(idc, 'OPT_OUT', dt_aleatoria(30, 2))
    for idc in random.sample(alvo_c, 6):
        ev(idc, 'EMAIL_DEVOLVIDO', dt_aleatoria(30, 2))

    # clientes LIMBO nunca contatados entram na fila de hoje (etapa 0)
    conn.execute("""
        UPDATE clientes SET dt_proximo_contato = ?
        WHERE status = 'LIMBO' AND opt_out = 0 AND etapa_regua = 0
          AND dt_proximo_contato IS NULL
    """, (_dt(hoje, hora=False),))

    # ---------------- visitas (~30) para clientes classe A
    motivos_nao = ['Preço acima do concorrente', 'Estoque cheio', 'Trocou de fornecedor',
                   'Loja fechada no horário', 'Aguardando capital de giro']
    classe_a = [r[0] for r in conn.execute(
        "SELECT id_cliente FROM clientes WHERE classe = 'A'").fetchall()]
    for idc in random.sample(classe_a, min(30, len(classe_a))):
        cli = conn.execute('SELECT batedor FROM clientes WHERE id_cliente = ?', (idc,)).fetchone()
        resultado = random.choice(['COMPROU', 'COMPROU', 'NAO_COMPROU', 'REMARCADO'])
        conn.execute("""
            INSERT INTO visitas (id_cliente, batedor, dt_visita, resultado, motivo, observacao)
            VALUES (?,?,?,?,?,?)
        """, (idc, cli['batedor'],
              _dt(hoje - timedelta(days=random.randint(1, 25)), hora=False), resultado,
              random.choice(motivos_nao) if resultado == 'NAO_COMPROU' else None,
              'Visita registrada pelo batedor' if random.random() < 0.5 else None))
    conn.commit()

    # ---------------- tabela de cidades (semaforo)
    regras.recalcular_cidades(conn)
