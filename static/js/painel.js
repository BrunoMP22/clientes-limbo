// Graficos do painel (Chart.js). Dados vem do backend em window.DADOS_PAINEL.
// DECISAO: o canvas nao herda CSS, entao as cores sao lidas dos tokens do tema
// na hora de desenhar e os graficos sao refeitos quando o tema muda.
(function () {
  const d = window.DADOS_PAINEL;
  if (!d || typeof Chart === 'undefined') return;

  const tok = (nome) =>
    getComputedStyle(document.documentElement).getPropertyValue(nome).trim();

  function paleta() {
    return {
      a: tok('--classe-a'),
      b: tok('--classe-b'),
      c: tok('--classe-c'),
      azul: tok('--azul-inst'),
      azulSec: tok('--azul-sec'),
      whats: tok('--whats'),
      texto2: tok('--texto2'),
      texto3: tok('--texto3'),
      destaque: tok('--destaque'),
      card: tok('--card'),
      grade: tok('--grafico-grade')
    };
  }

  const FONTE = '-apple-system, "Segoe UI", Roboto, sans-serif';
  const total = d.classes.a + d.classes.b + d.classes.c;
  let graficos = [];

  // total no centro da rosca; le os tokens a cada pintura para seguir o tema
  const centro = {
    id: 'centro',
    afterDraw(chart) {
      const { ctx, chartArea } = chart;
      if (!chartArea) return;
      const x = (chartArea.left + chartArea.right) / 2;
      const y = (chartArea.top + chartArea.bottom) / 2;
      ctx.save();
      ctx.textAlign = 'center';
      ctx.fillStyle = tok('--destaque');
      ctx.font = '700 28px ' + FONTE;
      ctx.fillText(total, x, y + 4);
      ctx.fillStyle = tok('--texto2');
      ctx.font = '600 11px ' + FONTE;
      ctx.fillText('CLIENTES', x, y + 22);
      ctx.restore();
    }
  };

  function desenhar() {
    graficos.forEach((g) => g.destroy());
    graficos = [];

    const COR = paleta();
    Chart.defaults.font.family = FONTE;
    Chart.defaults.color = COR.texto2;

    // ---- 1. rosca de classes, com total no centro
    graficos.push(new Chart(document.getElementById('g_classe'), {
      type: 'doughnut',
      data: {
        labels: ['Classe A', 'Classe B', 'Classe C'],
        datasets: [{
          data: [d.classes.a, d.classes.b, d.classes.c],
          backgroundColor: [COR.a, COR.b, COR.c],
          borderWidth: 2, borderColor: COR.card
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '68%',
        plugins: { legend: { display: false } }
      },
      plugins: [centro]
    }));

    const legenda = document.getElementById('legenda_classe');
    if (legenda) {
      const itens = [
        ['A', d.classes.a, 'responderam'],
        ['B', d.classes.b, 'só visualizaram'],
        ['C', d.classes.c, 'sem sinal']
      ];
      legenda.innerHTML = itens.map(([letra, qtd, txt]) => {
        const pct = total ? ((qtd / total) * 100).toFixed(1) : '0.0';
        return `<div class="flex items-center justify-between text-[.78rem]">
          <span class="flex items-center gap-2">
            <span class="pill-classe pill-${letra}" style="width:20px;height:20px;font-size:.66rem">${letra}</span>
            <span style="color:var(--texto2)">${txt}</span>
          </span>
          <span class="font-semibold">${qtd} <span style="color:var(--texto3)">(${pct}%)</span></span>
        </div>`;
      }).join('');
    }

    // ---- 2. engajamento por canal (barras agrupadas)
    graficos.push(new Chart(document.getElementById('g_canal'), {
      type: 'bar',
      data: {
        labels: ['Enviados', 'Visualizados', 'Respondidos'],
        datasets: [
          { label: 'E-mail', data: d.canais.email, backgroundColor: COR.azul, borderRadius: 4 },
          { label: 'WhatsApp', data: d.canais.whats, backgroundColor: COR.whats, borderRadius: 4 }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, usePointStyle: true, pointStyle: 'circle' } } },
        scales: {
          y: { beginAtZero: true, grid: { color: COR.grade }, ticks: { precision: 0 } },
          x: { grid: { display: false } }
        }
      }
    }));

    // ---- 3. clientes por ano da ultima compra
    graficos.push(new Chart(document.getElementById('g_anos'), {
      type: 'bar',
      data: {
        labels: d.anos.labels,
        datasets: [{ label: 'Clientes', data: d.anos.valores, backgroundColor: COR.azulSec, borderRadius: 4 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, grid: { color: COR.grade }, ticks: { precision: 0 } },
          x: { grid: { display: false } }
        }
      }
    }));
  }

  desenhar();
  document.addEventListener('temamudou', desenhar);
})();
