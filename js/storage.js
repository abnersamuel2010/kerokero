/* storage.js — camada única de persistência (LocalStorage hoje, SQL no futuro) */
(function () {
  const KEY = 'kero_db_v1';
  const DIAS = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
  const PAGAMENTOS = ['DINHEIRO', 'PIX', 'DEBITO', 'CREDITO', 'FIADO'];
  const PAG_LABEL = { DINHEIRO: 'Dinheiro', PIX: 'PIX', DEBITO: 'Cartão de Débito', CREDITO: 'Cartão de Crédito', FIADO: 'Fiado' };

  let uidSeq = 0;
  const uid = (p) => p + '_' + Date.now().toString(36) + '_' + (uidSeq++).toString(36);

  function seedCarnes() {
    const map = {
      1: [['Frango ao molho'], ['Panqueca'], ['Linguiça'], ['Picadinho']],
      2: [['Frango frito'], ['Porco no tacho'], ['Carne ao molho'], ['Picadinho']],
      3: [['Frango assado'], ['Picadinho'], ['Filé de frango grelhado'], ['Carne ao molho'], ['Lasanha de frango']],
      4: [['Frango frito'], ['Porco no tacho'], ['Carne ao molho'], ['Strogonoff'], ['Picadinho']],
      5: [['Frango frito'], ['Porco assado'], ['Linguiça'], ['Picadinho'], ['Strogonoff']],
      6: [['Frango assado'], ['Porco assado'], ['Linguiça'], ['Picadinho'], ['Strogonoff']]
    };
    const mistas = {
      5: ['Feijoada com porco', 'Feijoada com linguiça'],
      6: ['Costela com frango assado', 'Costela com porco assado', 'Costela com linguiça']
    };
    const out = [];
    Object.keys(map).forEach((d) => map[d].forEach(([nome]) =>
      out.push({ id: uid('c'), dia: +d, nome, adicional: 0, tipo: 'normal', ativo: true })));
    Object.keys(mistas).forEach((d) => mistas[d].forEach((nome) =>
      out.push({ id: uid('c'), dia: +d, nome, adicional: 2, tipo: 'mista', ativo: true })));
    return out;
  }

  function seedAcompanhamentos() {
    const todos = [0, 1, 2, 3, 4, 5, 6];
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
      p('Coca-Cola 1 L', 'Refrigerantes', 0),
      p('Coca-Cola 2 L', 'Refrigerantes', 0),
      p('Porção Pequena', 'Porções', 0),
      p('Porção Média', 'Porções', 15)
    ];
  }

  function defaults() {
    return {
      produtos: seedProdutos(),
      pedidos: [],
      carnes: seedCarnes(),
      acompanhamentos: seedAcompanhamentos(),
      configuracoes: {
        usuario: 'admin', senha: 'kero123', divisor: 20, maxCarnes: 2, proximoPedido: 1001,
        categorias: ['Marmitas', 'Refrigerantes', 'Porções', 'Saladas', 'Outros']
      }
    };
  }

  let state = null;

  function load() {
    if (state) return state;
    try {
      const raw = localStorage.getItem(KEY);
      state = raw ? JSON.parse(raw) : defaults();
    } catch (e) { state = defaults(); }
    const d = defaults();
    Object.keys(d).forEach((k) => { if (state[k] === undefined) state[k] = d[k]; });
    state.configuracoes = Object.assign({}, d.configuracoes, state.configuracoes);
    return state;
  }
  const save = () => localStorage.setItem(KEY, JSON.stringify(load()));
  const reset = () => { state = defaults(); save(); };

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
    DIAS, PAGAMENTOS, PAG_LABEL, uid, load, save, reset, defaults, cfg,
    produtos, produtoById, marmitas, carnesDoDia, acompDoDia,
    nextOrderNumber, addPedido, pedidoByNumero, pedidosPorData, updatePedido, removePedido,
    Produtos: crud('produtos'), Carnes: crud('carnes'), Acompanhamentos: crud('acompanhamentos'),
    money, num, hojeISO, isoToBR, horaAgora
  };
})();
