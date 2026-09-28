/* storage.js — camada única de persistência (LocalStorage hoje, SQL no futuro) */
(function () {
  const KEY = 'kero_db_v1';
  const DIAS = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
  const DIAS_UTEIS = [1, 2, 3, 4, 5, 6]; // não trabalhamos domingo
  const PAGAMENTOS = ['DINHEIRO', 'PIX', 'PIX_MAQUINA', 'CARTAO', 'FIADO'];
  const PAG_LABEL = { DINHEIRO: 'Dinheiro', PIX: 'PIX', PIX_MAQUINA: 'PIX Maquininha', CARTAO: 'Cartão (Débito/Crédito)', FIADO: 'Fiado', MULTIPLO: 'Pagamento dividido' };

  let uidSeq = 0;
  const uid = (p) => p + '_' + Date.now().toString(36) + '_' + (uidSeq++).toString(36);

  function seedCarnes() {
    const map = {
      1: [['Frango ao molho'], ['Panqueca'], ['Linguiça'], ['Picadinho']],
      2: [['Frango frito'], ['Porco no tacho'], ['Carne ao molho'], ['Picadinho']],
      3: [['Frango assado'], ['Picadinho'], ['Filé de frango grelhado', 1], ['Carne ao molho'], ['Lasanha de frango']],
      4: [['Frango frito'], ['Porco no tacho'], ['Carne ao molho'], ['Strogonoff'], ['Picadinho']],
      5: [['Frango frito'], ['Porco assado'], ['Linguiça'], ['Picadinho'], ['Strogonoff']],
      6: [['Frango assado'], ['Porco assado'], ['Linguiça'], ['Picadinho'], ['Strogonoff']]
    };
    // Carnes "mista/especial": exigem sempre vir acompanhadas de outra carne (ver regra em caixa.js).
    // Feijoada: sexta e sábado. Costela: só sábado. Nome simples — a combinação é escolhida à parte.
    const mistas = {
      5: ['Feijoada'],
      6: ['Costela', 'Feijoada']
    };
    const out = [];
    Object.keys(map).forEach((d) => map[d].forEach(([nome, adicional]) =>
      out.push({ id: uid('c'), dia: +d, nome, adicional: adicional || 0, tipo: 'normal', ativo: true })));
    Object.keys(mistas).forEach((d) => mistas[d].forEach((nome) =>
      out.push({ id: uid('c'), dia: +d, nome, adicional: 2, tipo: 'mista', ativo: true })));
    return out;
  }

  function seedAcompanhamentos() {
    const todos = DIAS_UTEIS.slice();
    return ['Arroz', 'Feijão', 'Macarrão', 'Salada', 'Farofa', 'Batata', 'Legumes']
      .map((nome, i) => ({ id: uid('a'), nome, ordem: i + 1, ativo: true, dias: todos.slice() }));
  }

  function seedProdutos() {
    const p = (nome, categoria, preco, marmita) => ({ id: uid('p'), nome, categoria, preco, ativo: true, marmita: !!marmita });
    return [
      p('Marmita Pequena', 'Marmitas', 16, true),
      p('Marmita Média', 'Marmitas', 20, true),
      p('Marmita Grande', 'Marmitas', 25, true),
      p('Coca-Cola Lata', 'Refrigerantes', 6),
      p('Coca-Cola 600 ml', 'Refrigerantes', 8),
      p('Coca-Cola 1 L', 'Refrigerantes', 10),
      p('Coca-Cola 2 L', 'Refrigerantes', 15),
      p('Tubaína (no local)', 'Refrigerantes', 6),
      p('Tubaína (para levar)', 'Refrigerantes', 7),
      p('Refri (diversos sabores)', 'Refrigerantes', 12),
      p('Água sem Gás', 'Refrigerantes', 5),
      p('Água com Gás', 'Refrigerantes', 6),
      p('Porção Pequena', 'Porções', 15),
      p('Porção Média', 'Porções', 30),
      p('BF Livre Inteiro', 'Porções', 30),
      p('BF Livre Meia', 'Porções', 20),
      p('Doce Canudo', 'Doces', 7),
      p('Doce Paçoca', 'Doces', 5),
      p('Doce (diversos sabores)', 'Doces', 5),
      p('Trufa', 'Doces', 6),
      p('Salada Pequena', 'Saladas', 8),
      p('Salada Média', 'Saladas', 12)
    ];
  }

  function defaults() {
    return {
      produtos: seedProdutos(),
      pedidos: [],
      carnes: seedCarnes(),
      acompanhamentos: seedAcompanhamentos(),
      trocos: {}, // { 'YYYY-MM-DD': valorTrocoInicialDoCaixa }
      saidas: [], // [{ id, nome, valor, data:'YYYY-MM-DD', hora }] — dinheiro que saiu do caixa
      configuracoes: {
        usuario: 'admin', senha: 'kero123', divisor: 20, maxCarnes: 2, proximoPedido: 1001,
        categorias: ['Marmitas', 'Refrigerantes', 'Porções', 'Doces', 'Saladas', 'Outros']
      }
    };
  }

  let state = null;
  let migrated = false;

  /* Correções e novos produtos para bases já existentes no navegador do cliente
     (quem já usava o sistema não deve perder pedidos/histórico ao atualizar). */
  function migrar() {
    if (migrated) return;
    migrated = true;
    let changed = false;
    const addSeMissing = (nome, categoria, preco, marmita) => {
      if (!state.produtos.some((p) => p.nome === nome)) {
        state.produtos.push({ id: uid('p'), nome, categoria, preco, ativo: true, marmita: !!marmita });
        changed = true;
      }
    };
    const peq = state.produtos.find((p) => p.nome === 'Marmita Pequena');
    if (peq && peq.preco === 15) { peq.preco = 16; changed = true; }
    const porcP = state.produtos.find((p) => p.nome === 'Porção Pequena' && p.categoria === 'Porções');
    if (porcP && porcP.preco === 0) { porcP.preco = 15; changed = true; }
    const porcM = state.produtos.find((p) => p.nome === 'Porção Média' && p.categoria === 'Porções');
    if (porcM && porcM.preco === 15) { porcM.preco = 30; changed = true; }
    addSeMissing('Refri (diversos sabores)', 'Refrigerantes', 12);
    addSeMissing('Água sem Gás', 'Refrigerantes', 5);
    addSeMissing('Água com Gás', 'Refrigerantes', 6);
    addSeMissing('Doce (diversos sabores)', 'Doces', 5);
    addSeMissing('Trufa', 'Doces', 6);
    addSeMissing('Salada Pequena', 'Saladas', 8);
    addSeMissing('Salada Média', 'Saladas', 12);
    if (!state.saidas) { state.saidas = []; changed = true; }
    if (changed) save();
  }

  function load() {
    if (state) return state;
    try {
      const raw = localStorage.getItem(KEY);
      state = raw ? JSON.parse(raw) : defaults();
    } catch (e) { state = defaults(); }
    const d = defaults();
    Object.keys(d).forEach((k) => { if (state[k] === undefined) state[k] = d[k]; });
    state.configuracoes = Object.assign({}, d.configuracoes, state.configuracoes);
    migrar();
    return state;
  }
  const save = () => localStorage.setItem(KEY, JSON.stringify(load()));
  const reset = () => { state = defaults(); migrated = true; save(); };

  /* ---------- helpers de domínio ---------- */
  const cfg = () => load().configuracoes;
  const produtos = (cat) => load().produtos.filter((p) => !cat || p.categoria === cat);
  const produtoById = (id) => load().produtos.find((p) => p.id === id);
  const marmitas = () => load().produtos.filter((p) => p.marmita && p.ativo);

  const carnesDoDia = (dia, somenteAtivas) => load().carnes
    .filter((c) => c.dia === dia && (!somenteAtivas || c.ativo));
  const acompDoDia = (dia, somenteAtivos) => load().acompanhamentos
    .filter((a) => (a.dias || []).indexOf(dia) > -1 && (!somenteAtivos || a.ativo))
    .sort((a, b) => a.ordem - b.ordem);

  function nextOrderNumber() { return cfg().proximoPedido; }

  const getTroco = (iso) => Number(load().trocos[iso]) || 0;
  function setTroco(iso, valor) {
    const db = load();
    db.trocos = db.trocos || {};
    db.trocos[iso] = Number(valor) || 0;
    save();
    return db.trocos[iso];
  }
  function addPedido(pedido) {
    const db = load();
    db.pedidos.push(pedido);
    db.configuracoes.proximoPedido = pedido.numero + 1;
    save();
    return pedido;
  }
  const pedidoByNumero = (n) => load().pedidos.find((p) => p.numero === +n);
  const pedidosPorData = (iso) => load().pedidos.filter((p) => p.data === iso);
  function updatePedido(numero, patch) {
    const p = pedidoByNumero(numero); if (!p) return null;
    Object.assign(p, patch); save(); return p;
  }
  function removePedido(numero) {
    const db = load();
    db.pedidos = db.pedidos.filter((p) => p.numero !== +numero); save();
  }

  /* ---------- saídas de caixa (dinheiro que sai: compras, motoboy, retirada, etc.) ---------- */
  const saidasPeriodo = (de, ate) => (load().saidas || []).filter((s) => (!de || s.data >= de) && (!ate || s.data <= ate));

  function crud(colecao) {
    return {
      all: () => load()[colecao],
      add: (obj) => { const o = Object.assign({ id: uid(colecao[0]) }, obj); load()[colecao].push(o); save(); return o; },
      update: (id, patch) => { const o = load()[colecao].find((x) => x.id === id); if (o) { Object.assign(o, patch); save(); } return o; },
      remove: (id) => { const db = load(); db[colecao] = db[colecao].filter((x) => x.id !== id); save(); }
    };
  }

  /* ---------- utilitários ---------- */
  const money = (n) => 'R$ ' + (Number(n) || 0).toFixed(2).replace('.', ',');
  const num = (v) => { const n = parseFloat(String(v).replace(',', '.')); return isNaN(n) ? 0 : n; };
  const hojeISO = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  const isoToBR = (iso) => iso ? iso.split('-').reverse().join('/') : '';
  const horaAgora = () => { const d = new Date(); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };

  window.KERO = window.KERO || {};
  window.KERO.DB = {
    DIAS, DIAS_UTEIS, PAGAMENTOS, PAG_LABEL, uid, load, save, reset, defaults, cfg,
    produtos, produtoById, marmitas, carnesDoDia, acompDoDia,
    nextOrderNumber, addPedido, pedidoByNumero, pedidosPorData, updatePedido, removePedido,
    getTroco, setTroco, saidasPeriodo,
    Produtos: crud('produtos'), Carnes: crud('carnes'), Acompanhamentos: crud('acompanhamentos'), Saidas: crud('saidas'),
    money, num, hojeISO, isoToBR, horaAgora
  };
})();
