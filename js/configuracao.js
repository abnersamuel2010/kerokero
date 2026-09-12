/* configuracao.js — cardápio do dia, carnes, acompanhamentos, produtos, pedidos, histórico, configurações */
(function () {
  const D = () => window.KERO.DB;
  const U = () => window.KERO.UI;
  const el = (id) => document.getElementById(id);
  let diaSel = new Date().getDay() || 1;

  /* ================= CARDÁPIO ================= */
  function renderCardapio() {
    const sel = el('dia-select');
    sel.innerHTML = D().DIAS_UTEIS.map((i) => `<option value="${i}" ${i === diaSel ? 'selected' : ''}>${D().DIAS[i]}</option>`).join('');
    sel.onchange = () => { diaSel = +sel.value; renderCardapio(); };

    const rows = (list, testid) => list.length ? list.map((c) => `
      <div class="row ${c.ativo ? '' : 'off'}" data-testid="${testid}-${c.id}">
        <span class="rname">${c.nome}</span>
        <span class="rmeta">adicional ${D().money(c.adicional)}</span>
        <span class="tag ${c.ativo ? 'on' : 'offt'}">${c.ativo ? 'ATIVO' : 'DESATIVADO'}</span>
        <button class="btn btn-mini btn-ghost" data-t="${c.id}" data-testid="toggle-carne-${c.id}">${c.ativo ? 'Desativar' : 'Ativar'}</button>
        <button class="btn btn-mini btn-ghost" data-e="${c.id}" data-testid="edit-carne-${c.id}">Editar</button>
        <button class="btn btn-mini btn-ghost" data-x="${c.id}" data-testid="del-carne-${c.id}">Excluir</button>
      </div>`).join('') : '<p class="muted">Nenhuma carne cadastrada para este dia.</p>';

    const todas = D().carnesDoDia(diaSel);
    el('carnes-list').innerHTML = rows(todas.filter((c) => c.tipo === 'normal'), 'carne');
    el('mistas-list').innerHTML = rows(todas.filter((c) => c.tipo === 'mista'), 'mista');

    [el('carnes-list'), el('mistas-list')].forEach((box) => {
      box.querySelectorAll('[data-t]').forEach((b) => b.onclick = () => {
        const c = D().Carnes.all().find((x) => x.id === b.dataset.t);
        D().Carnes.update(c.id, { ativo: !c.ativo }); renderCardapio(); window.KERO.Caixa.refresh();
      });
      box.querySelectorAll('[data-e]').forEach((b) => b.onclick = () => formCarne(D().Carnes.all().find((x) => x.id === b.dataset.e)));
      box.querySelectorAll('[data-x]').forEach((b) => b.onclick = () => {
        if (confirm('Excluir esta carne?')) { D().Carnes.remove(b.dataset.x); renderCardapio(); }
      });
    });

    el('add-carne').onclick = () => formCarne(null, 'normal');
    el('add-mista').onclick = () => formCarne(null, 'mista');
    renderAcomp();
  }

  function formCarne(carne, tipo) {
    const c = carne || { nome: '', adicional: tipo === 'mista' ? 2 : 0, tipo: tipo || 'normal', ativo: true, dia: diaSel };
    U().modal(carne ? 'Editar carne' : 'Nova carne', `
      <label>Nome <input class="inp" id="k-nome" data-testid="carne-nome-input" value="${c.nome}" /></label>
      <label>Preço adicional (R$) <input type="number" step="0.01" min="0" class="inp" id="k-add" data-testid="carne-adicional-input" value="${c.adicional}" /></label>
      <label>Tipo <select class="inp" id="k-tipo" data-testid="carne-tipo-select">
        <option value="normal" ${c.tipo === 'normal' ? 'selected' : ''}>Carne normal</option>
        <option value="mista" ${c.tipo === 'mista' ? 'selected' : ''}>Mista / especial</option></select></label>
      <label>Dia <select class="inp" id="k-dia" data-testid="carne-dia-select">${D().DIAS_UTEIS.map((i) => `<option value="${i}" ${i === c.dia ? 'selected' : ''}>${D().DIAS[i]}</option>`).join('')}</select></label>
      <label>Status <select class="inp" id="k-ativo" data-testid="carne-status-select">
        <option value="1" ${c.ativo ? 'selected' : ''}>Ativo</option><option value="0" ${!c.ativo ? 'selected' : ''}>Desativado</option></select></label>
      <div class="btn-row"><button class="btn btn-primary" id="k-save" data-testid="carne-save-btn">SALVAR</button></div>`);
    el('k-save').onclick = () => {
      const nome = el('k-nome').value.trim(); if (!nome) return U().toast('Informe o nome');
      const patch = { nome, adicional: D().num(el('k-add').value), tipo: el('k-tipo').value, dia: +el('k-dia').value, ativo: el('k-ativo').value === '1' };
      if (carne) D().Carnes.update(carne.id, patch); else D().Carnes.add(patch);
      U().closeModal(); renderCardapio(); U().toast('Carne salva');
    };
  }

  /* ================= ACOMPANHAMENTOS ================= */
  function renderAcomp() {
    const list = D().Acompanhamentos.all().slice().sort((a, b) => a.ordem - b.ordem);
    el('acomp-list').innerHTML = list.length ? list.map((a) => `
      <div class="row ${a.ativo ? '' : 'off'}" data-testid="acomp-row-${a.id}">
        <span class="rname">${a.ordem}. ${a.nome}</span>
        <span class="rmeta">${(a.dias || []).length >= 6 ? 'todos os dias' : (a.dias || []).map((d) => D().DIAS[d].slice(0, 3)).join(', ')}</span>
        <span class="tag ${a.ativo ? 'on' : 'offt'}">${a.ativo ? 'ATIVO' : 'INATIVO'}</span>
        <button class="btn btn-mini btn-ghost" data-t="${a.id}" data-testid="toggle-acomp-${a.id}">${a.ativo ? 'Desativar' : 'Ativar'}</button>
        <button class="btn btn-mini btn-ghost" data-e="${a.id}" data-testid="edit-acomp-${a.id}">Editar</button>
        <button class="btn btn-mini btn-ghost" data-x="${a.id}" data-testid="del-acomp-${a.id}">Excluir</button>
      </div>`).join('') : '<p class="muted">Nenhum acompanhamento cadastrado.</p>';
    el('acomp-list').querySelectorAll('[data-t]').forEach((b) => b.onclick = () => {
      const a = D().Acompanhamentos.all().find((x) => x.id === b.dataset.t);
      D().Acompanhamentos.update(a.id, { ativo: !a.ativo }); renderAcomp();
    });
    el('acomp-list').querySelectorAll('[data-e]').forEach((b) => b.onclick = () => formAcomp(D().Acompanhamentos.all().find((x) => x.id === b.dataset.e)));
    el('acomp-list').querySelectorAll('[data-x]').forEach((b) => b.onclick = () => {
      if (confirm('Excluir acompanhamento?')) { D().Acompanhamentos.remove(b.dataset.x); renderAcomp(); }
    });
    el('add-acomp').onclick = () => formAcomp(null);
  }

  function formAcomp(a) {
    const it = a || { nome: '', ordem: D().Acompanhamentos.all().length + 1, ativo: true, dias: D().DIAS_UTEIS.slice() };
    U().modal(a ? 'Editar acompanhamento' : 'Novo acompanhamento', `
      <label>Nome <input class="inp" id="a-nome" data-testid="acomp-nome-input" value="${it.nome}" /></label>
      <label>Ordem <input type="number" min="1" class="inp" id="a-ordem" data-testid="acomp-ordem-input" value="${it.ordem}" /></label>
      <span class="lbl">Dias em que aparece</span>
      <div class="opt-grid" id="a-dias">${D().DIAS_UTEIS.map((i) =>
        `<button class="chk ${(it.dias || []).indexOf(i) > -1 ? 'on' : ''}" data-d="${i}" data-testid="acomp-dia-${i}"><span class="box">✓</span>${D().DIAS[i].slice(0, 3)}</button>`).join('')}</div>
      <label>Status <select class="inp" id="a-ativo" data-testid="acomp-status-select">
        <option value="1" ${it.ativo ? 'selected' : ''}>Ativo</option><option value="0" ${!it.ativo ? 'selected' : ''}>Inativo</option></select></label>
      <div class="btn-row"><button class="btn btn-primary" id="a-save" data-testid="acomp-save-btn">SALVAR</button></div>`);
    el('a-dias').querySelectorAll('.chk').forEach((b) => b.onclick = () => b.classList.toggle('on'));
    el('a-save').onclick = () => {
      const nome = el('a-nome').value.trim(); if (!nome) return U().toast('Informe o nome');
      const dias = Array.from(el('a-dias').querySelectorAll('.chk.on')).map((b) => +b.dataset.d);
      const patch = { nome, ordem: parseInt(el('a-ordem').value, 10) || 1, ativo: el('a-ativo').value === '1', dias };
      if (a) D().Acompanhamentos.update(a.id, patch); else D().Acompanhamentos.add(patch);
      U().closeModal(); renderAcomp(); U().toast('Acompanhamento salvo');
    };
  }

  /* ================= PRODUTOS ================= */
  function renderProdutos() {
    const cats = D().cfg().categorias;
    el('produtos-groups').innerHTML = cats.map((cat) => {
      const list = D().produtos(cat);
      return `<h4 class="sub" style="margin-top:18px">${cat}</h4>
      <div class="list">${list.length ? list.map((p) => `
        <div class="row ${p.ativo ? '' : 'off'}" data-testid="prod-row-${p.id}">
          <span class="rname">${p.nome}${p.marmita ? ' <span class="tag on">MARMITA</span>' : ''}</span>
          <span class="rmeta">${D().money(p.preco)}</span>
          <span class="tag ${p.ativo ? 'on' : 'offt'}">${p.ativo ? 'ATIVO' : 'INATIVO'}</span>
          <button class="btn btn-mini btn-ghost" data-t="${p.id}" data-testid="toggle-prod-${p.id}">${p.ativo ? 'Desativar' : 'Ativar'}</button>
          <button class="btn btn-mini btn-ghost" data-e="${p.id}" data-testid="edit-prod-${p.id}">Editar</button>
          <button class="btn btn-mini btn-ghost" data-x="${p.id}" data-testid="del-prod-${p.id}">Excluir</button>
        </div>`).join('') : '<p class="muted">Nenhum produto nesta categoria.</p>'}</div>`;
    }).join('');
    el('produtos-groups').querySelectorAll('[data-t]').forEach((b) => b.onclick = () => {
      const p = D().produtoById(b.dataset.t); D().Produtos.update(p.id, { ativo: !p.ativo }); renderProdutos(); window.KERO.Caixa.refresh();
    });
    el('produtos-groups').querySelectorAll('[data-e]').forEach((b) => b.onclick = () => formProduto(D().produtoById(b.dataset.e)));
    el('produtos-groups').querySelectorAll('[data-x]').forEach((b) => b.onclick = () => {
      if (confirm('Excluir produto?')) { D().Produtos.remove(b.dataset.x); renderProdutos(); window.KERO.Caixa.refresh(); }
    });
    el('add-produto').onclick = () => formProduto(null);
  }

  function formProduto(p) {
    const it = p || { nome: '', categoria: 'Outros', preco: 0, ativo: true, marmita: false };
    U().modal(p ? 'Editar produto' : 'Novo produto', `
      <label>Nome <input class="inp" id="p-nome" data-testid="produto-nome-input" value="${it.nome}" /></label>
      <label>Categoria <select class="inp" id="p-cat" data-testid="produto-cat-select">${D().cfg().categorias.map((c) =>
        `<option ${c === it.categoria ? 'selected' : ''}>${c}</option>`).join('')}</select></label>
      <label>Preço (R$) <input type="number" step="0.01" min="0" class="inp" id="p-preco" data-testid="produto-preco-input" value="${it.preco}" /></label>
      <label>É marmita (abre carnes e acompanhamentos)? <select class="inp" id="p-marm" data-testid="produto-marmita-select">
        <option value="0" ${!it.marmita ? 'selected' : ''}>Não</option><option value="1" ${it.marmita ? 'selected' : ''}>Sim</option></select></label>
      <label>Status <select class="inp" id="p-ativo" data-testid="produto-status-select">
        <option value="1" ${it.ativo ? 'selected' : ''}>Ativo</option><option value="0" ${!it.ativo ? 'selected' : ''}>Inativo</option></select></label>
      <div class="btn-row"><button class="btn btn-primary" id="p-save" data-testid="produto-save-btn">SALVAR</button></div>`);
    el('p-save').onclick = () => {
      const nome = el('p-nome').value.trim(); if (!nome) return U().toast('Informe o nome');
      const patch = { nome, categoria: el('p-cat').value, preco: D().num(el('p-preco').value), marmita: el('p-marm').value === '1', ativo: el('p-ativo').value === '1' };
      if (p) D().Produtos.update(p.id, patch); else D().Produtos.add(patch);
      U().closeModal(); renderProdutos(); window.KERO.Caixa.refresh(); U().toast('Produto salvo');
    };
  }

  /* ================= PEDIDOS DO DIA / HISTÓRICO ================= */
  function pedidoRow(p) {
    return `<div class="row" data-testid="pedido-row-${p.numero}">
      <span class="rname">#${p.numero} ${p.cliente ? '— ' + p.cliente : ''}</span>
      <span class="rmeta">${p.hora}</span>
      <span class="rmeta">${D().money(p.total)}</span>
      <span class="rmeta">${D().PAG_LABEL[p.pagamento]}</span>
      <span class="tag ${p.status.toLowerCase()}">${p.status}</span>
      <button class="btn btn-mini btn-ghost" data-v="${p.numero}" data-testid="ver-pedido-${p.numero}">Ver pedido</button>
      <button class="btn btn-mini btn-ghost" data-ed="${p.numero}" data-testid="editar-pedido-${p.numero}">Editar</button>
      <button class="btn btn-mini btn-ghost" data-p="${p.numero}" data-testid="imprimir-pedido-${p.numero}">Imprimir</button>
    </div>`;
  }

  function wirePedidoRows(box) {
    box.querySelectorAll('[data-v]').forEach((b) => b.onclick = () => verPedido(D().pedidoByNumero(b.dataset.v)));
    box.querySelectorAll('[data-p]').forEach((b) => b.onclick = () => window.KERO.Print.pedido(D().pedidoByNumero(b.dataset.p)));
    box.querySelectorAll('[data-ed]').forEach((b) => b.onclick = () => {
      window.KERO.Caixa.editar(D().pedidoByNumero(b.dataset.ed));
      if (window.KERO.App) window.KERO.App.goTo('caixa');
    });
  }

  function renderPedidosDoDia() {
    const list = D().pedidosPorData(D().hojeISO()).slice().reverse();
    const tot = list.reduce((t, p) => t + p.total, 0);
    el('pedidos-resumo').textContent = list.length + ' pedido(s) — ' + D().money(tot);
    el('pedidos-list').innerHTML = list.length ? list.map(pedidoRow).join('') : '<p class="muted">Nenhum pedido registrado hoje.</p>';
    wirePedidoRows(el('pedidos-list'));
  }

  function verPedido(p) {
    if (!p) return;
    U().modal('Pedido #' + p.numero, `
      <div class="muted">${D().isoToBR(p.data)} às ${p.hora}${p.cliente ? ' — Cliente: ' + p.cliente : ''}</div>
      ${p.itens.map((it) => `<div class="oi">
        <div class="oi-top"><strong>${it.qtd}x ${it.nome}</strong><span class="oi-price">${D().money(it.precoUnit * it.qtd)}</span></div>
        ${it.carnes.length ? `<p>Carne: <b>${it.carnes.map((c) => c.nome).join(' + ')}</b></p>` : ''}
        ${it.acompanhamentos.length ? `<p>Acomp.: ${it.acompanhamentos.join(', ')}</p>` : ''}
        ${it.obs ? `<p>Obs.: <b>${it.obs}</b></p>` : ''}</div>`).join('')}
      <div class="tot-line total"><span>Total</span><b>${D().money(p.total)}</b></div>
      <div class="muted">Pagamento: ${D().PAG_LABEL[p.pagamento]} — Status: ${p.status}${p.troco ? ' — Troco: ' + D().money(p.troco) : ''}</div>
      <label>Alterar status <select class="inp" id="vp-status" data-testid="ver-status-select">
        ${['PAGO', 'PENDENTE'].map((s) => `<option ${s === p.status ? 'selected' : ''}>${s}</option>`).join('')}</select></label>
      <div class="btn-row">
        <button class="btn btn-outline" id="vp-print" data-testid="ver-imprimir-btn">IMPRIMIR</button>
        <button class="btn btn-outline" id="vp-edit" data-testid="ver-editar-btn">EDITAR PEDIDO</button>
        <button class="btn btn-danger" id="vp-del" data-testid="ver-excluir-btn">EXCLUIR PEDIDO</button>
        <button class="btn btn-primary" id="vp-save" data-testid="ver-salvar-btn">SALVAR STATUS</button>
      </div>`);
    el('vp-print').onclick = () => window.KERO.Print.pedido(p);
    el('vp-edit').onclick = () => { U().closeModal(); window.KERO.Caixa.editar(p); if (window.KERO.App) window.KERO.App.goTo('caixa'); };
    el('vp-save').onclick = () => { D().updatePedido(p.numero, { status: el('vp-status').value }); U().closeModal(); renderPedidosDoDia(); U().toast('Status atualizado'); };
    el('vp-del').onclick = () => { if (confirm('Excluir pedido #' + p.numero + '?')) { D().removePedido(p.numero); U().closeModal(); renderPedidosDoDia(); renderHistorico(); } };
  }

  function renderHistorico() {
    const grupos = {};
    D().load().pedidos.forEach((p) => { (grupos[p.data] = grupos[p.data] || []).push(p); });
    const datas = Object.keys(grupos).sort().reverse();
    el('historico-list').innerHTML = datas.length ? datas.map((d) => {
      const g = grupos[d];
      return `<div><div class="row" data-testid="hist-row-${d}">
        <span class="rname">${D().isoToBR(d)}</span>
        <span class="rmeta">${g.length} pedido(s)</span>
        <span class="rmeta">${D().money(g.reduce((t, p) => t + p.total, 0))}</span>
        <button class="btn btn-mini btn-ghost" data-h="${d}" data-testid="hist-abrir-${d}">Ver pedidos</button>
      </div><div class="list" id="h-${d}" style="margin-left:14px"></div></div>`;
    }).join('') : '<p class="muted">Nenhum pedido no histórico.</p>';
    el('historico-list').querySelectorAll('[data-h]').forEach((b) => b.onclick = () => {
      const box = el('h-' + b.dataset.h);
      if (box.innerHTML) { box.innerHTML = ''; return; }
      box.innerHTML = grupos[b.dataset.h].slice().reverse().map(pedidoRow).join('');
      wirePedidoRows(box);
    });
  }

  /* ================= CONFIGURAÇÕES ================= */
  function renderConfig() {
    const c = D().cfg();
    el('cfg-user').value = c.usuario; el('cfg-pass').value = c.senha;
    el('cfg-divisor').value = c.divisor;
    el('cfg-save').onclick = () => {
      const c2 = D().cfg();
      c2.usuario = el('cfg-user').value.trim() || 'admin';
      c2.senha = el('cfg-pass').value || 'kero123';
      c2.divisor = D().num(el('cfg-divisor').value) || 20;
      D().save(); U().toast('Configurações salvas'); window.KERO.Caixa.novoPedido();
    };
    el('cfg-export').onclick = () => window.KERO.Relatorio.download('kero-base.json', JSON.stringify(D().load(), null, 2), 'application/json');
    el('cfg-reset').onclick = () => { if (confirm('Restaurar dados padrão? Todos os pedidos serão apagados.')) { D().reset(); location.reload(); } };
  }

  window.KERO = window.KERO || {};
  window.KERO.Config = { renderCardapio, renderProdutos, renderPedidosDoDia, renderHistorico, renderConfig };
})();
