/* impressao.js — comanda e relatório para impressora comum ou térmica */
(function () {
  const D = () => window.KERO.DB;
  const area = () => document.getElementById('print-area');

  function linhaItem(it) {
    let s = `<div class="r"><b>${it.qtd}x ${it.nome.toUpperCase()}</b><span>${D().money(it.precoUnit * it.qtd)}</span></div>`;
    if (it.carnes && it.carnes.length) s += `<div>Carne: ${it.carnes.map((c) => c.nome).join(' + ')}</div>`;
    if (it.acompanhamentos && it.acompanhamentos.length) s += `<div>Acompanhamentos:<br/>${it.acompanhamentos.join('<br/>')}</div>`;
    else if (it.marmita) s += `<div>Sem acompanhamentos</div>`;
    if (it.obs) s += `<div>Observação:<br/>${it.obs}</div>`;
    return s + '<div style="height:6px"></div>';
  }

  function pedido(p) {
    area().innerHTML = `<div class="recibo">
      <h1>RESTAURANTE KERO</h1>
      <div>Pedido: #${p.numero}</div>
      <div>Data: ${D().isoToBR(p.data)}</div>
      <div>Hora: ${p.hora}</div>
      ${p.cliente ? `<div>Cliente: ${p.cliente}</div>` : ''}
      <div class="sep"></div>
      ${p.itens.map(linhaItem).join('')}
      <div class="sep"></div>
      ${p.desconto ? `<div class="r"><span>Desconto</span><span>- ${D().money(p.desconto)}</span></div>` : ''}
      ${p.acrescimo ? `<div class="r"><span>Acréscimo</span><span>+ ${D().money(p.acrescimo)}</span></div>` : ''}
      <div class="r tot"><span>TOTAL</span><span>${D().money(p.total)}</span></div>
      <div>Pagamento: ${D().PAG_LABEL[p.pagamento]}</div>
      <div>Status: ${p.status}</div>
      ${p.troco ? `<div>Recebido: ${D().money(p.recebido)}<br/>Troco: ${D().money(p.troco)}</div>` : ''}
      <div class="sep"></div>
      <div class="cen">Obrigado pela preferência!</div>
    </div>`;
    window.print();
  }

  function relatorio(html) {
    area().innerHTML = `<div class="recibo" style="width:auto">${html}</div>`;
    window.print();
  }

  window.KERO = window.KERO || {};
  window.KERO.Print = { pedido, relatorio };
})();
