/* relatorio.js — resumo, gráficos, filtros e exportação */
(function () {
  const D = () => window.KERO.DB;
  const el = (id) => document.getElementById(id);

  function filtrar() {
    const de = el('f-de').value, ate = el('f-ate').value;
    const pag = el('f-pag').value, st = el('f-status').value, prod = el('f-prod').value, carne = el('f-carne').value;
    return D().load().pedidos.filter((p) => {
      if (de && p.data < de) return false;
      if (ate && p.data > ate) return false;
      if (pag && p.pagamento !== pag) return false;
      if (st && p.status !== st) return false;
      if (prod && !p.itens.some((i) => i.nome === prod)) return false;
      if (carne && !p.itens.some((i) => (i.carnes || []).some((c) => c.nome === carne))) return false;
      return true;
    });
  }

  function agregar(pedidos) {
    const r = {
      pedidos: pedidos.length, vendido: 0, recebido: 0, fiado: 0,
      porPagamento: {}, porProduto: {}, porCarne: {}, porCategoria: {}, fiados: []
    };
    D().PAGAMENTOS.forEach((p) => r.porPagamento[p] = { total: 0, qtd: 0 });
    pedidos.forEach((p) => {
      r.vendido += p.total;
      const bucket = r.porPagamento[p.pagamento] || (r.porPagamento[p.pagamento] = { total: 0, qtd: 0 });
      bucket.total += p.total; bucket.qtd++;
      if (p.status === 'PAGO') r.recebido += p.total; else r.fiado += p.total;
      if (p.pagamento === 'FIADO') r.fiados.push(p);
      p.itens.forEach((i) => {
        r.porProduto[i.nome] = (r.porProduto[i.nome] || 0) + i.qtd;
        r.porCategoria[i.categoria] = (r.porCategoria[i.categoria] || 0) + i.qtd;
        (i.carnes || []).forEach((c) => r.porCarne[c.nome] = (r.porCarne[c.nome] || 0) + i.qtd);
      });
    });
    return r;
  }

  const CORES = { DINHEIRO: '#1f9e6a', PIX: '#2f6fd0', PIX_MAQUINA: '#5c7fd0', CARTAO: '#7b5ad0', FIADO: '#d81f2a' };
  const PALETA = ['#e0202b', '#2f6fd0', '#1f9e6a', '#f2b53c', '#7b5ad0', '#c76b2e', '#1c9aa6', '#a4141d', '#5c7fd0', '#8a6412'];

  function trocoDoPeriodo(pedidos) {
    const datas = [...new Set(pedidos.map((p) => p.data))];
    return datas.reduce((t, d) => t + D().getTroco(d), 0);
  }

  function barChart(obj, testid) {
    const keys = Object.keys(obj).sort((a, b) => obj[b] - obj[a]);
    if (!keys.length) return '<p class="muted">Sem dados.</p>';
    const max = Math.max(1, ...keys.map((k) => obj[k]));
    return `<div class="chart" data-testid="${testid}">${keys.map((k, i) => `
      <div class="bar-row"><span>${k}</span>
        <div class="bar-track"><div class="bar-fill" style="width:${(obj[k] / max * 100).toFixed(1)}%;background:${PALETA[i % PALETA.length]}"></div></div>
        <span class="bar-val">${obj[k]}</span></div>`).join('')}</div>`;
  }

  function render() {
    const pedidos = filtrar();
    const r = agregar(pedidos);
    const div = D().cfg().divisor || 20;
    const trocoPeriodo = trocoDoPeriodo(pedidos);
    const vendidoAjustado = Math.max(0, r.vendido - trocoPeriodo);
    const refeicoes = vendidoAjustado / div;
    const maxPag = Math.max(1, ...Object.keys(r.porPagamento).map((k) => r.porPagamento[k].total));

    // troco do dia: só edita diretamente quando o período é um único dia
    const dataUnica = el('f-de').value && el('f-de').value === el('f-ate').value ? el('f-de').value : null;
    const trocoDeHoje = dataUnica ? D().getTroco(dataUnica) : trocoPeriodo;

    el('relatorio-body').innerHTML = `
      <div class="card">
        <div class="card-head"><h3>Troco inicial do caixa</h3>
          <span class="muted">${dataUnica ? 'para ' + D().isoToBR(dataUnica) : 'soma dos dias do período selecionado'}</span>
        </div>
        <div class="filter-row" style="align-items:flex-end">
          ${dataUnica ? `
            <label style="min-width:180px">Troco colocado de manhã (R$)
              <input type="number" step="0.01" min="0" class="inp" id="troco-input" data-testid="troco-input" value="${trocoDeHoje}" />
            </label>
            <button class="btn btn-primary" id="troco-save" data-testid="troco-save-btn">SALVAR TROCO DO DIA</button>
          ` : `<p class="muted">Selecione o mesmo dia em "De" e "Até" para editar o troco de um dia específico. Valor somado do período: <b>${D().money(trocoPeriodo)}</b></p>`}
        </div>
      </div>
      <div class="kpis">
        <div class="kpi"><span>Total de pedidos</span><b data-testid="kpi-pedidos">${r.pedidos}</b></div>
        <div class="kpi"><span>Total vendido</span><b data-testid="kpi-vendido">${D().money(r.vendido)}</b></div>
        <div class="kpi"><span>Total recebido</span><b data-testid="kpi-recebido">${D().money(r.recebido)}</b></div>
        <div class="kpi"><span>Total fiado/pendente</span><b data-testid="kpi-fiado">${D().money(r.fiado)}</b></div>
        <div class="kpi hi"><span>Refeições do dia (vendido − troco) ÷ ${div}</span><b data-testid="kpi-refeicoes">${refeicoes.toFixed(1)}</b></div>
      </div>
      <div class="kpis">
        <div class="kpi"><span>Marmitas</span><b data-testid="kpi-marmitas">${r.porCategoria['Marmitas'] || 0}</b></div>
        <div class="kpi"><span>Refrigerantes</span><b>${r.porCategoria['Refrigerantes'] || 0}</b></div>
        <div class="kpi"><span>Porções</span><b>${r.porCategoria['Porções'] || 0}</b></div>
        <div class="kpi"><span>Doces</span><b>${r.porCategoria['Doces'] || 0}</b></div>
        <div class="kpi"><span>Troco descontado</span><b>${D().money(trocoPeriodo)}</b></div>
      </div>
      <div class="card">
        <div class="card-head"><h3>Formas de pagamento</h3><span class="muted">gráfico de barras</span></div>
        <div class="chart" data-testid="grafico-pagamentos">
          ${D().PAGAMENTOS.map((k) => {
            const b = r.porPagamento[k];
            return `<div class="bar-row"><span>${D().PAG_LABEL[k]}</span>
              <div class="bar-track"><div class="bar-fill" style="width:${(b.total / maxPag * 100).toFixed(1)}%;background:${CORES[k]}"></div></div>
              <span class="bar-val">${D().money(b.total)}<br/><small class="muted">${b.qtd} ped.</small></span></div>`;
          }).join('')}
          <div class="tot-line total"><span>Total</span><b>${D().money(r.vendido)}</b></div>
        </div>
      </div>
      <div class="two-col">
        <div class="card"><div class="card-head"><h3>Vendas por produto</h3><span class="muted">gráfico de barras</span></div>${barChart(r.porProduto, 'rel-produtos')}</div>
        <div class="card"><div class="card-head"><h3>Vendas por carne</h3><span class="muted">gráfico de barras</span></div>${barChart(r.porCarne, 'rel-carnes')}</div>
      </div>
      <div class="card">
        <div class="card-head"><h3>Pedidos fiado</h3><span class="muted">${r.fiados.length} pedido(s) — ${D().money(r.fiados.reduce((t, p) => t + p.total, 0))}</span></div>
        <div class="list" data-testid="rel-fiados">${r.fiados.length ? r.fiados.map((p) => `
          <div class="row" data-testid="fiado-row-${p.numero}">
            <span class="rname">${p.cliente || '(sem nome)'} <span class="muted">#${p.numero}</span></span>
            <span class="rmeta">${D().isoToBR(p.data)}</span>
            <span class="rmeta">${p.itens.map((i) => i.qtd + 'x ' + i.nome).join(', ')}</span>
            <span class="rmeta">${D().money(p.total)}</span>
            <span class="tag ${p.assinado ? 'on' : 'offt'}">${p.assinado ? 'ASSINADO' : 'NÃO ASSINADO'}</span>
            <button class="btn btn-mini btn-ghost" data-as="${p.numero}" data-testid="toggle-assinado-${p.numero}">${p.assinado ? 'Desmarcar' : 'Marcar assinado'}</button>
          </div>`).join('') : '<p class="muted">Nenhum pedido fiado no período.</p>'}</div>
      </div>`;

    if (dataUnica) {
      el('troco-save').onclick = () => {
        D().setTroco(dataUnica, D().num(el('troco-input').value));
        window.KERO.UI.toast('Troco do dia salvo');
        render();
      };
    }
    el('relatorio-body').querySelectorAll('[data-as]').forEach((b) => b.onclick = () => {
      const p = D().pedidoByNumero(b.dataset.as);
      D().updatePedido(p.numero, { assinado: !p.assinado });
      render();
    });

    return { pedidos, r, refeicoes, div, trocoPeriodo };
  }

  function initFiltros() {
    const opts = (arr) => '<option value="">Todos</option>' + arr.map((v) => `<option value="${v.v}">${v.l}</option>`).join('');
    el('f-pag').innerHTML = opts(D().PAGAMENTOS.map((p) => ({ v: p, l: D().PAG_LABEL[p] })));
    el('f-status').innerHTML = opts(['PAGO', 'PENDENTE'].map((s) => ({ v: s, l: s })));
    el('f-prod').innerHTML = opts(D().produtos().map((p) => ({ v: p.nome, l: p.nome })));
    const carnes = [...new Set(D().load().carnes.map((c) => c.nome))];
    el('f-carne').innerHTML = opts(carnes.map((c) => ({ v: c, l: c })));
    if (!el('f-de').value) { el('f-de').value = D().hojeISO(); el('f-ate').value = D().hojeISO(); }
    el('aplicar-filtro').onclick = render;
    el('print-rel').onclick = printRel;
    el('exp-json').onclick = () => {
      download('kero-relatorio.json', JSON.stringify({ filtros: { de: el('f-de').value, ate: el('f-ate').value }, resumo: agregar(filtrar()), pedidos: filtrar() }, null, 2), 'application/json');
    };
    el('exp-csv').onclick = exportCsv;
  }

  function exportCsv() {
    const rows = [['numero', 'data', 'hora', 'cliente', 'item', 'qtd', 'preco_unit', 'carnes', 'acompanhamentos', 'observacao', 'total_pedido', 'pagamento', 'status']];
    filtrar().forEach((p) => p.itens.forEach((i) => rows.push([
      p.numero, p.data, p.hora, p.cliente || '', i.nome, i.qtd, i.precoUnit.toFixed(2),
      (i.carnes || []).map((c) => c.nome).join(' + '), (i.acompanhamentos || []).join(' / '), i.obs || '',
      p.total.toFixed(2), p.pagamento, p.status
    ])));
    const csv = rows.map((r) => r.map((c) => '"' + String(c).replace(/"/g, '""') + '"').join(';')).join('\n');
    download('kero-relatorio.csv', '\ufeff' + csv, 'text/csv');
  }

  function printRel() {
    const { r, refeicoes, div, trocoPeriodo } = render();
    const linhas = (obj) => Object.keys(obj).sort((a, b) => obj[b] - obj[a]).map((k) => `<div class="r"><span>${k}</span><span>${obj[k]}</span></div>`).join('');
    window.KERO.Print.relatorio(`
      <h1>RESTAURANTE KERO</h1>
      <div class="cen">RELATÓRIO</div>
      <div>Período: ${D().isoToBR(el('f-de').value) || '—'} a ${D().isoToBR(el('f-ate').value) || '—'}</div>
      <div class="sep"></div>
      <div class="r"><span>Pedidos</span><span>${r.pedidos}</span></div>
      <div class="r"><span>Total vendido</span><span>${D().money(r.vendido)}</span></div>
      <div class="r"><span>Recebido</span><span>${D().money(r.recebido)}</span></div>
      <div class="r"><span>Fiado/Pendente</span><span>${D().money(r.fiado)}</span></div>
      <div class="r"><span>Troco do período</span><span>${D().money(trocoPeriodo)}</span></div>
      <div class="r"><span>Refeições (÷${div})</span><span>${refeicoes.toFixed(1)}</span></div>
      <div class="sep"></div>
      ${D().PAGAMENTOS.map((k) => `<div class="r"><span>${D().PAG_LABEL[k]}</span><span>${D().money(r.porPagamento[k].total)}</span></div>`).join('')}
      <div class="r tot"><span>TOTAL</span><span>${D().money(r.vendido)}</span></div>
      <div class="sep"></div><div>POR PRODUTO</div>${linhas(r.porProduto)}
      <div class="sep"></div><div>POR CARNE</div>${linhas(r.porCarne)}
      <div class="sep"></div><div>FIADOS</div>
      ${r.fiados.map((p) => `<div class="r"><span>${p.cliente || '(sem nome)'} #${p.numero}</span><span>${D().money(p.total)} ${p.assinado ? '(assinado)' : '(pendente)'}</span></div>`).join('')}`);
  }

  function download(nome, conteudo, tipo) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
    a.download = nome; a.click(); URL.revokeObjectURL(a.href);
  }

  window.KERO = window.KERO || {};
  window.KERO.Relatorio = { render, initFiltros, download };
})();
