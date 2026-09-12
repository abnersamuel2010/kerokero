/* caixa.js — tela principal do caixa */
(function () {
  const D = () => window.KERO.DB;
  const U = () => window.KERO.UI;

  const state = {
    itens: [], sel: null, categoria: 'Marmitas', pagamento: null, editIdx: null,
    numero: null, editingNumero: null
  };
  const el = (id) => document.getElementById(id);
  const isFrango = (nome) => /frango/i.test(nome || '');

  /* ---------- inicialização ---------- */
  function initCaixa() {
    state.numero = D().nextOrderNumber();
    el('order-number').textContent = '#' + state.numero;
    el('order-date').textContent = D().isoToBR(D().hojeISO());
    el('order-time').textContent = D().horaAgora();
    renderAvisoDomingo();
    renderCategorias();
    renderProdutos();
    renderPagamentos();
    renderItens();
    renderConfigVazio();
  }

  function renderAvisoDomingo() {
    let box = document.getElementById('aviso-domingo');
    const grid = document.querySelector('#view-caixa .caixa-grid');
    if (!grid) return;
    if (new Date().getDay() === 0) {
      if (!box) {
        box = document.createElement('div');
        box.id = 'aviso-domingo';
        box.className = 'aviso-fechado';
        box.innerHTML = '⚠ Hoje é domingo — o estabelecimento não abre aos domingos. Você ainda pode usar o sistema normalmente se precisar.';
        grid.before(box);
      }
    } else if (box) box.remove();
  }

  function renderCategorias() {
    const cats = D().cfg().categorias;
    el('cat-row').innerHTML = cats.map((c) =>
      `<button class="cat-btn ${c === state.categoria ? 'active' : ''}" data-cat="${c}" data-testid="cat-${slug(c)}">${c}</button>`).join('');
    el('cat-row').querySelectorAll('.cat-btn').forEach((b) => b.onclick = () => {
      state.categoria = b.dataset.cat; renderCategorias(); renderProdutos();
    });
  }

  function renderProdutos() {
    const list = D().produtos(state.categoria).filter((p) => p.ativo);
    el('prod-count').textContent = list.length + ' produto(s)';
    el('prod-grid').innerHTML = list.length ? list.map((p) =>
      `<button class="prod-btn" data-id="${p.id}" data-testid="prod-${slug(p.nome)}">
        <strong>${p.nome}</strong><span>${D().money(p.preco)}</span></button>`).join('')
      : `<p class="muted">Nenhum produto ativo nesta categoria. Cadastre em "Produtos e Preços".</p>`;
    el('prod-grid').querySelectorAll('.prod-btn').forEach((b) => b.onclick = () => selecionar(b.dataset.id));
  }

  const slug = (s) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  function renderConfigVazio() {
    el('config-title').textContent = 'Configuração do item';
    el('item-config').innerHTML = `<div class="empty-state"><div class="empty-icon">▣</div>
      <p>Selecione um produto à esquerda para montar o item.</p></div>`;
  }

  /* ---------- seleção / configuração ---------- */
  function selecionar(produtoId, item, idx) {
    const prod = D().produtoById(produtoId);
    if (!prod) return;
    const dia = new Date().getDay();
    if (prod.marmita) {
      const acomp = D().acompDoDia(dia, true);
      state.sel = {
        marmita: true,
        produtoId: prod.id,
        carnes: item ? (item.carnes || []).map((c) => c.id).filter(Boolean) : [],
        acomp: item ? acomp.filter((a) => (item.acompanhamentos || []).indexOf(a.nome) > -1).map((a) => a.id) : acomp.map((a) => a.id),
        obs: item ? item.obs : '',
        qtd: item ? item.qtd : 1,
        preco: item ? item.precoUnit : null
      };
    } else {
      state.sel = { marmita: false, produtoId: prod.id, qtd: item ? item.qtd : 1, obs: item ? item.obs : '', preco: item ? item.precoUnit : prod.preco };
    }
    state.editIdx = (idx === undefined) ? null : idx;
    renderConfig();
  }

  /* Carnes disponíveis para a marmita selecionada, já aplicando a regra da Marmita Pequena (só frango) */
  function carnesDisponiveis(dia) {
    const prod = D().produtoById(state.sel.produtoId);
    const todas = D().carnesDoDia(dia, true);
    if (prod && prod.nome === 'Marmita Pequena') return todas.filter((c) => isFrango(c.nome));
    return todas;
  }

  function precoAuto() {
    const s = state.sel; const prod = D().produtoById(s.produtoId);
    if (!s.marmita) return prod.preco;
    const dia = new Date().getDay();
    const add = D().carnesDoDia(dia).filter((c) => s.carnes.indexOf(c.id) > -1)
      .reduce((t, c) => t + (Number(c.adicional) || 0), 0);
    return (Number(prod.preco) || 0) + add;
  }

  function renderConfig() {
    const s = state.sel; if (!s) return renderConfigVazio();
    const prod = D().produtoById(s.produtoId);
    const dia = new Date().getDay();
    if (s.preco === null || s.preco === undefined) s.preco = precoAuto();
    el('config-title').textContent = (state.editIdx !== null ? 'Editar item — ' : '') + prod.nome;

    let html = '';
    if (s.marmita) {
      const tam = D().marmitas();
      html += `<div><span class="lbl">Tamanho</span><div class="opt-grid" id="tam-grid">${tam.map((t) =>
        `<button class="opt ${t.id === s.produtoId ? 'on' : ''}" data-id="${t.id}" data-testid="tam-${slug(t.nome)}">
          ${t.nome.replace('Marmita ', '')}<small>${D().money(t.preco)}</small></button>`).join('')}</div></div>`;

      const isPequena = prod.nome === 'Marmita Pequena';
      const carnes = carnesDisponiveis(dia);
      html += `<div><span class="lbl">Carne — ${D().DIAS[dia]} (máx. ${D().cfg().maxCarnes})${isPequena ? ' — só frango nesta marmita' : ''}</span>
        <div class="opt-grid" id="carne-grid">${carnes.length ? carnes.map((c) =>
        `<button class="opt ${s.carnes.indexOf(c.id) > -1 ? 'on' : ''}" data-id="${c.id}" data-testid="carne-${slug(c.nome)}">
          ${c.nome}<small>${c.tipo === 'mista' ? 'especial — precisa de outra carne junto' : (c.adicional > 0 ? '+' + D().money(c.adicional) : 'sem adicional')}</small></button>`).join('')
        : `<p class="muted">${isPequena ? 'Nenhuma opção de frango ativa hoje.' : 'Nenhuma carne ativa hoje.'} Configure em "Cardápio do Dia".</p>`}</div>
        ${isPequena ? '<p class="muted" style="margin-top:6px">A Marmita Pequena só acompanha frango (assado, ao molho ou frito). Filé de frango grelhado tem adicional.</p>' : ''}
      </div>`;

      const acomp = D().acompDoDia(dia, true);
      html += `<div><span class="lbl">Acompanhamentos (desmarque o que o cliente não quer)</span>
        <div class="opt-grid" id="acomp-grid">${acomp.map((a) => {
          const on = s.acomp.indexOf(a.id) > -1;
          return `<button class="chk ${on ? 'on' : ''}" data-id="${a.id}" data-testid="acomp-${slug(a.nome)}"><span class="box">✓</span>${a.nome}</button>`;
        }).join('')}</div></div>`;
    }

    html += `<div><label>Observação do item
      <input type="text" class="inp" id="obs-input" data-testid="obs-input" placeholder="Ex: sem macarrão, pouco arroz..." value="${(s.obs || '').replace(/"/g, '&quot;')}" /></label></div>`;

    html += `<div class="qty-row">
      <div><span class="lbl">Quantidade</span>
        <div class="stepper"><button id="q-minus" data-testid="qtd-menos">−</button><span id="q-val" data-testid="qtd-valor">${s.qtd}</span><button id="q-plus" data-testid="qtd-mais">+</button></div>
      </div>
      <div class="price-box">
        <div class="field"><label>Preço deste pedido
          <input type="number" step="0.01" min="0" class="inp" id="preco-input" data-testid="preco-input" value="${Number(s.preco).toFixed(2)}" /></label>
          <span class="std-price">Padrão: ${D().money(precoAuto())}</span></div>
      </div>
      <div style="flex:1;min-width:150px"><span class="lbl">Total do item</span><b style="font-family:var(--font-m);font-size:22px" id="item-total" data-testid="item-total">${D().money(s.preco * s.qtd)}</b></div>
    </div>`;

    html += `<button class="btn btn-primary btn-xl" id="add-item-btn" data-testid="add-item-btn">
      ${state.editIdx !== null ? 'SALVAR ALTERAÇÕES' : '+ ADICIONAR ITEM AO PEDIDO'}</button>`;

    el('item-config').innerHTML = html;
    wireConfig();
  }

  function wireConfig() {
    const s = state.sel;
    const g = (id) => el(id);
    if (g('tam-grid')) g('tam-grid').querySelectorAll('.opt').forEach((b) => b.onclick = () => {
      s.produtoId = b.dataset.id;
      const dia = new Date().getDay();
      // ao trocar de tamanho, remove carnes que não são mais válidas (ex: indo para Pequena, mantém só frango)
      const validas = carnesDisponiveis(dia).map((c) => c.id);
      s.carnes = s.carnes.filter((id) => validas.indexOf(id) > -1);
      s.preco = null; renderConfig();
    });
    if (g('carne-grid')) g('carne-grid').querySelectorAll('.opt').forEach((b) => b.onclick = () => {
      const dia = new Date().getDay();
      const disponiveis = carnesDisponiveis(dia);
      const carneClicada = disponiveis.find((c) => c.id === b.dataset.id);
      const id = b.dataset.id; const i = s.carnes.indexOf(id);
      if (i > -1) {
        s.carnes.splice(i, 1);
      } else {
        if (s.carnes.length >= D().cfg().maxCarnes) { U().toast('Máximo de ' + D().cfg().maxCarnes + ' carne(s) por marmita'); return; }
        // Costela/Feijoada (tipo mista) não podem se combinar entre si — precisam vir com uma carne normal
        if (carneClicada && carneClicada.tipo === 'mista') {
          const jaTemMista = s.carnes.some((cid) => {
            const c = disponiveis.find((x) => x.id === cid);
            return c && c.tipo === 'mista';
          });
          if (jaTemMista) { U().toast('Só é possível escolher uma opção especial (Costela ou Feijoada) por marmita'); return; }
        }
        s.carnes.push(id);
      }
      s.preco = null; renderConfig();
    });
    if (g('acomp-grid')) g('acomp-grid').querySelectorAll('.chk').forEach((b) => b.onclick = () => {
      const id = b.dataset.id; const i = s.acomp.indexOf(id);
      if (i > -1) s.acomp.splice(i, 1); else s.acomp.push(id);
      b.classList.toggle('on');
    });
    g('obs-input').oninput = (e) => s.obs = e.target.value;
    g('q-minus').onclick = () => { s.qtd = Math.max(1, s.qtd - 1); g('q-val').textContent = s.qtd; refreshItemTotal(); };
    g('q-plus').onclick = () => { s.qtd += 1; g('q-val').textContent = s.qtd; refreshItemTotal(); };
    g('preco-input').oninput = (e) => { s.preco = D().num(e.target.value); refreshItemTotal(); };
    g('add-item-btn').onclick = adicionarItem;
  }
  function refreshItemTotal() {
    el('item-total').textContent = D().money((Number(state.sel.preco) || 0) * state.sel.qtd);
  }

  /* ---------- itens do pedido ---------- */
  function adicionarItem() {
    const s = state.sel; if (!s) return;
    const prod = D().produtoById(s.produtoId);
    const preco = Number(s.preco);
    if (!(preco >= 0) || isNaN(preco)) return U().toast('Preço inválido');
    if (!(s.qtd >= 1)) return U().toast('Quantidade inválida');
    const dia = new Date().getDay();

    if (s.marmita) {
      const carnesSelecionadas = D().carnesDoDia(dia).filter((c) => s.carnes.indexOf(c.id) > -1);
      const mista = carnesSelecionadas.find((c) => c.tipo === 'mista');
      if (mista && carnesSelecionadas.length < 2) {
        return U().toast(mista.nome + ' precisa vir acompanhada de outra carne. Selecione mais uma opção.');
      }
    }

    const item = {
      uid: D().uid('i'), produtoId: prod.id, nome: prod.nome, categoria: prod.categoria,
      marmita: !!prod.marmita, qtd: s.qtd, precoUnit: preco, precoPadrao: prod.preco,
      obs: (s.obs || '').trim(),
      carnes: s.marmita ? D().carnesDoDia(dia).filter((c) => s.carnes.indexOf(c.id) > -1).map((c) => ({ id: c.id, nome: c.nome, adicional: c.adicional, tipo: c.tipo })) : [],
      acompanhamentos: s.marmita ? D().acompDoDia(dia).filter((a) => s.acomp.indexOf(a.id) > -1).map((a) => a.nome) : []
    };
    if (state.editIdx !== null) { state.itens[state.editIdx] = item; U().toast('Item atualizado'); }
    else { state.itens.push(item); U().toast(prod.nome + ' adicionado'); }
    state.sel = null; state.editIdx = null;
    renderConfigVazio(); renderItens();
  }

  function renderItens() {
    const c = el('order-items');
    if (!state.itens.length) {
      c.innerHTML = '<p class="muted">Nenhum item no pedido.</p>';
    } else {
      c.innerHTML = state.itens.map((it, i) => `
        <div class="oi" data-testid="order-item-${i}">
          <div class="oi-top">
            <strong>${it.qtd}x ${it.nome}</strong>
            <span class="oi-price">${D().money(it.precoUnit * it.qtd)}</span>
          </div>
          ${it.carnes.length ? `<p>Carne: <b>${it.carnes.map((x) => x.nome).join(' + ')}</b></p>` : ''}
          ${it.acompanhamentos.length ? `<p>Acomp.: ${it.acompanhamentos.join(', ')}</p>` : (it.marmita ? '<p>Sem acompanhamentos</p>' : '')}
          ${it.obs ? `<p>Obs.: <b>${it.obs}</b></p>` : ''}
          <div class="oi-acts">
            <div class="stepper" style="height:34px">
              <button data-act="dec" data-i="${i}" data-testid="item-dec-${i}" style="width:34px;height:34px;font-size:16px">−</button>
              <span style="min-width:34px;font-size:14px">${it.qtd}</span>
              <button data-act="inc" data-i="${i}" data-testid="item-inc-${i}" style="width:34px;height:34px;font-size:16px">+</button>
            </div>
            <button class="btn btn-mini btn-ghost" data-act="edit" data-i="${i}" data-testid="item-edit-${i}">Editar</button>
            <button class="btn btn-mini btn-ghost" data-act="del" data-i="${i}" data-testid="item-del-${i}">Excluir</button>
          </div>
        </div>`).join('');
      c.querySelectorAll('[data-act]').forEach((b) => b.onclick = () => {
        const i = +b.dataset.i, it = state.itens[i];
        if (b.dataset.act === 'inc') it.qtd++;
        else if (b.dataset.act === 'dec') it.qtd = Math.max(1, it.qtd - 1);
        else if (b.dataset.act === 'del') state.itens.splice(i, 1);
        else if (b.dataset.act === 'edit') return selecionar(it.produtoId, it, i);
        renderItens();
      });
    }
    calcular();
  }

  /* ---------- totais / pagamento ---------- */
  function subtotal() { return state.itens.reduce((t, i) => t + i.precoUnit * i.qtd, 0); }
  function total() { return Math.max(0, subtotal() - D().num(el('desconto').value) + D().num(el('acrescimo').value)); }

  function calcular() {
    el('subtotal').textContent = D().money(subtotal());
    el('total').textContent = D().money(total());
    const rec = D().num(el('recebido').value);
    el('troco').textContent = D().money(Math.max(0, rec - total()));
  }

  function renderPagamentos() {
    el('pay-grid').innerHTML = D().PAGAMENTOS.map((p) =>
      `<button class="pay-btn" data-p="${p}" data-testid="pay-${p.toLowerCase()}">${D().PAG_LABEL[p]}</button>`).join('');
    el('pay-grid').querySelectorAll('.pay-btn').forEach((b) => b.onclick = () => {
      state.pagamento = b.dataset.p;
      el('pay-grid').querySelectorAll('.pay-btn').forEach((x) => x.classList.toggle('on', x === b));
      el('dinheiro-block').classList.toggle('hidden', state.pagamento !== 'DINHEIRO');
      el('status-pag').value = state.pagamento === 'FIADO' ? 'PENDENTE' : 'PAGO';
      el('cliente-nome').placeholder = state.pagamento === 'FIADO' ? 'Nome do cliente (obrigatório p/ fiado)' : 'Nome do cliente (opcional)';
      el('cliente-nome').classList.toggle('fiado-required', state.pagamento === 'FIADO');
      calcular();
    });
  }

  /* ---------- finalizar ---------- */
  function finalizar() {
    if (!state.itens.length) return U().toast('Adicione pelo menos um item ao pedido');
    if (!state.pagamento) return U().toast('Selecione a forma de pagamento');
    const nomeCliente = el('cliente-nome').value.trim();
    if (state.pagamento === 'FIADO' && !nomeCliente) return U().toast('Informe o nome do cliente — obrigatório para pedidos fiado');
    const tot = total();
    const recebido = D().num(el('recebido').value);
    if (state.pagamento === 'DINHEIRO' && recebido < tot) return U().toast('Valor recebido menor que o total');

    const dadosPedido = {
      cliente: nomeCliente,
      itens: state.itens, subtotal: subtotal(),
      desconto: D().num(el('desconto').value), acrescimo: D().num(el('acrescimo').value),
      total: tot, pagamento: state.pagamento, status: el('status-pag').value,
      recebido: state.pagamento === 'DINHEIRO' ? recebido : tot,
      troco: state.pagamento === 'DINHEIRO' ? Math.max(0, recebido - tot) : 0
    };

    if (state.editingNumero !== null) {
      D().updatePedido(state.editingNumero, dadosPedido);
      U().toast('Pedido #' + state.editingNumero + ' atualizado');
      const numeroEditado = state.editingNumero;
      state.editingNumero = null;
      novoPedido();
      if (window.KERO.App) window.KERO.App.goTo('pedidos');
      return;
    }

    const pedido = Object.assign({
      numero: state.numero, data: D().hojeISO(), hora: D().horaAgora(),
      assinado: false, criadoEm: new Date().toISOString()
    }, dadosPedido);
    D().addPedido(pedido);
    U().modal('Pedido #' + pedido.numero + ' finalizado!', `
      <p style="font-size:15px">Total <b style="font-family:var(--font-m)">${D().money(pedido.total)}</b> — ${D().PAG_LABEL[pedido.pagamento]} (${pedido.status})
      ${pedido.troco ? '<br/>Troco: <b>' + D().money(pedido.troco) + '</b>' : ''}</p>
      <div class="btn-row">
        <button class="btn btn-outline" id="mi-print" data-testid="modal-imprimir-btn">IMPRIMIR PEDIDO</button>
        <button class="btn btn-primary" id="mi-new" data-testid="modal-novo-btn">NOVO PEDIDO</button>
      </div>`);
    el('mi-print').onclick = () => window.KERO.Print.pedido(pedido);
    el('mi-new').onclick = () => { U().closeModal(); novoPedido(); };
  }

  function novoPedido() {
    state.itens = []; state.sel = null; state.pagamento = null; state.editIdx = null; state.editingNumero = null;
    el('cliente-nome').value = ''; el('cliente-nome').placeholder = 'Nome do cliente (opcional)'; el('cliente-nome').classList.remove('fiado-required');
    el('desconto').value = 0; el('acrescimo').value = 0; el('recebido').value = '';
    el('dinheiro-block').classList.add('hidden');
    el('pay-grid').querySelectorAll('.pay-btn').forEach((x) => x.classList.remove('on'));
    el('finalizar-btn').textContent = 'FINALIZAR PEDIDO';
    initCaixa();
  }

  /* ---------- editar pedido já finalizado (chamado a partir de Pedidos do Dia / Histórico) ---------- */
  function editarPedidoExistente(p) {
    if (!p) return;
    state.itens = JSON.parse(JSON.stringify(p.itens));
    state.numero = p.numero;
    state.editingNumero = p.numero;
    state.sel = null; state.editIdx = null;
    state.pagamento = p.pagamento;

    renderAvisoDomingo();
    renderCategorias(); renderProdutos();
    renderPagamentos();
    el('order-number').textContent = '#' + p.numero + ' (editando)';
    el('order-date').textContent = D().isoToBR(p.data);
    el('order-time').textContent = p.hora;
    el('cliente-nome').value = p.cliente || '';
    el('cliente-nome').placeholder = p.pagamento === 'FIADO' ? 'Nome do cliente (obrigatório p/ fiado)' : 'Nome do cliente (opcional)';
    el('desconto').value = p.desconto || 0;
    el('acrescimo').value = p.acrescimo || 0;
    el('recebido').value = p.pagamento === 'DINHEIRO' ? (p.recebido || '') : '';
    el('dinheiro-block').classList.toggle('hidden', p.pagamento !== 'DINHEIRO');
    el('pay-grid').querySelectorAll('.pay-btn').forEach((b) => b.classList.toggle('on', b.dataset.p === p.pagamento));
    el('status-pag').value = p.status;
    el('finalizar-btn').textContent = 'SALVAR ALTERAÇÕES DO PEDIDO #' + p.numero;
    renderConfigVazio();
    renderItens();
    U().toast('Editando pedido #' + p.numero);
  }

  function bind() {
    el('desconto').oninput = calcular;
    el('acrescimo').oninput = calcular;
    el('recebido').oninput = calcular;
    el('finalizar-btn').onclick = finalizar;
    el('limpar-pedido').onclick = () => { state.itens = []; state.sel = null; renderConfigVazio(); renderItens(); };
  }

  window.KERO = window.KERO || {};
  window.KERO.Caixa = {
    init: () => { bind(); initCaixa(); },
    novoPedido,
    editar: editarPedidoExistente,
    refresh: () => { renderAvisoDomingo(); renderCategorias(); renderProdutos(); },
    slug
  };
})();
