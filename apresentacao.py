# -*- coding: utf-8 -*-
"""Rotulos de evento e traducao de resultado em avisos.

Toda acao que grava um evento devolve avisos ao front no mesmo formato
{categoria, texto}. As categorias batem com as classes de flash do CSS
(ok, aviso, erro, promocao), reaproveitadas pelo componente <Avisos>.
"""

# (icone, rotulo, classe CSS)
ROTULO_EVENTO = {
    'EMAIL_ENVIADO': ('✉', 'E-mail enviado', 'text-cinza'),
    'EMAIL_ABERTO': ('✉', 'E-mail aberto', 'text-classeb'),
    'EMAIL_CLICADO': ('🔗', 'Clique no link', 'text-classea'),
    'EMAIL_RESPONDIDO': ('✉', 'E-mail respondido', 'text-classea'),
    'EMAIL_DEVOLVIDO': ('⚠', 'E-mail devolvido', 'text-alerta'),
    'WHATSAPP_ENVIADO': ('💬', 'WhatsApp enviado', 'text-cinza'),
    'WHATSAPP_VISUALIZADO': ('💬', 'WhatsApp visualizado', 'text-classeb'),
    'WHATSAPP_RESPONDIDO': ('💬', 'WhatsApp respondido', 'text-classea'),
    'PEDIU_ORCAMENTO': ('📋', 'Pediu orçamento', 'text-classea'),
    'ACEITOU_VISITA': ('🤝', 'Aceitou visita', 'text-classea'),
    'NOTA_FISCAL': ('🧾', 'Nota fiscal emitida', 'text-classea'),
    'OPT_OUT': ('🚫', 'Opt-out', 'text-alerta'),
    'TENTATIVA_SEM_RETORNO': ('📞', 'Tentativa sem retorno', 'text-cinza'),
}

ACOES_FICHA = [
    ('EMAIL_ENVIADO', 'Registrar e-mail enviado'),
    ('EMAIL_ABERTO', 'Registrar abertura'),
    ('EMAIL_CLICADO', 'Registrar clique'),
    ('EMAIL_RESPONDIDO', 'Registrar resposta de e-mail'),
    ('WHATSAPP_ENVIADO', 'Registrar WhatsApp enviado'),
    ('WHATSAPP_VISUALIZADO', 'Registrar visualização'),
    ('WHATSAPP_RESPONDIDO', 'Registrar resposta de WhatsApp'),
    ('PEDIU_ORCAMENTO', 'Registrar pedido de orçamento'),
    ('ACEITOU_VISITA', 'Registrar visita aceita'),
    ('NOTA_FISCAL', 'Registrar venda'),
    ('OPT_OUT', 'Registrar opt-out'),
]

BATEDORES = ['R. Souza', 'L. Andrade', 'M. Teixeira', 'P. Vasques']


def avisos_acao(tipo, res):
    """Resultado de regras.aplicar_evento -> lista de (categoria, texto).

    As categorias sao as mesmas classes de flash ja usadas no CSS:
    ok, aviso, erro e promocao.
    """
    if not res.get('ok'):
        return [('erro', res.get('motivo', 'Falha ao registrar evento.'))]
    if res.get('duplicado'):
        return [('aviso', 'Evento idêntico já registrado neste instante (ignorado).')]

    rotulo = ROTULO_EVENTO.get(tipo, ('', tipo, ''))[1]
    avisos = []
    if res.get('promovido'):
        avisos.append(('promocao', f"{rotulo}: cliente promovido de {res['classe_anterior']} "
                                   f"para {res['classe_nova']}!"))
    else:
        avisos.append(('ok', f'{rotulo} registrado.'))
    for m in res.get('mensagens', []):
        if 'promovido' not in m:
            avisos.append(('aviso' if 'quarentena' in m or 'Opt-out' in m else 'ok', m))
    return avisos
