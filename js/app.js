/* app.js — boot, login, navegação entre telas e utilitários de UI (toast/modal) */
(function () {
  const D = () => window.KERO.DB;
  const el = (id) => document.getElementById(id);

  /* ================= UI: toast & modal ================= */
  let toastTimer = null;
  function toast(msg) {
    const t = el('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
  }

  function modal(title, bodyHtml) {
    el('modal-title').textContent = title;
    el('modal-body').innerHTML = bodyHtml;
    el('modal-back').classList.remove('hidden');
  }
  function closeModal() {
    el('modal-back').classList.add('hidden');
    el('modal-body').innerHTML = '';
  }

  window.KERO = window.KERO || {};
  window.KERO.UI = { toast, modal, closeModal };

  /* ================= LOGIN ================= */
  function checkLogin() {
    return sessionStorage.getItem('kero_logado') === '1';
  }

  function doLogin(e) {
    e.preventDefault();
    const user = el('login-user').value.trim();
    const pass = el('login-pass').value;
    const c = D().cfg();
    if (user === c.usuario && pass === c.senha) {
      sessionStorage.setItem('kero_logado', '1');
      el('login-error').textContent = '';
      showApp();
    } else {
      el('login-error').textContent = 'Usuário ou senha inválidos.';
    }
  }

  function doLogout() {
    sessionStorage.removeItem('kero_logado');
    location.reload();
  }

  function showApp() {
    el('login-screen').classList.add('hidden');
    el('app-shell').classList.remove('hidden');
    bootApp();
  }

  /* ================= NAVEGAÇÃO ENTRE VIEWS ================= */
  const VIEW_TITLES = {
    caixa: 'Caixa / Novo Pedido',
    pedidos: 'Pedidos do Dia',
    cardapio: 'Cardápio do Dia',
    produtos: 'Produtos e Preços',
    historico: 'Histórico',
    relatorios: 'Relatórios',
    config: 'Configurações'
  };

  function goTo(view) {
    document.querySelectorAll('.nav-item').forEach((b) => b.classList.toggle('active', b.dataset.view === view));
    document.querySelectorAll('.view').forEach((s) => s.classList.toggle('active', s.id === 'view-' + view));
    el('view-title').textContent = VIEW_TITLES[view] || '';
    document.body.classList.remove('sidebar-open');

    switch (view) {
      case 'caixa': window.KERO.Caixa.refresh(); break;
      case 'pedidos': window.KERO.Config.renderPedidosDoDia(); break;
      case 'cardapio': window.KERO.Config.renderCardapio(); break;
      case 'produtos': window.KERO.Config.renderProdutos(); break;
      case 'historico': window.KERO.Config.renderHistorico(); break;
      case 'relatorios': window.KERO.Relatorio.render(); break;
      case 'config': window.KERO.Config.renderConfig(); break;
    }
  }

  function wireNav() {
    document.querySelectorAll('.nav-item').forEach((b) => b.onclick = () => goTo(b.dataset.view));
    el('logout-btn').onclick = doLogout;
    el('menu-toggle').onclick = () => document.body.classList.toggle('sidebar-open');
    el('modal-close').onclick = () => closeModal();
    el('modal-back').onclick = (e) => { if (e.target === el('modal-back')) closeModal(); };
  }

  /* ================= RELÓGIO / DATA ================= */
  function tickClock() {
    const d = new Date();
    el('clock').textContent = D().DIAS[d.getDay()] + ', ' + D().isoToBR(D().hojeISO()) + ' — ' +
      String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') + ':' + String(d.getSeconds()).padStart(2, '0');
  }

  /* ================= BOOT ================= */
  let booted = false;
  function bootApp() {
    if (booted) { goTo('caixa'); return; }
    booted = true;
    el('today-label').textContent = D().DIAS[new Date().getDay()];
    wireNav();
    window.KERO.Caixa.init();
    window.KERO.Relatorio.initFiltros();
    tickClock();
    setInterval(tickClock, 1000);
    goTo('caixa');
  }

  document.addEventListener('DOMContentLoaded', () => {
    el('login-form').addEventListener('submit', doLogin);
    if (checkLogin()) showApp();
  });
})();
