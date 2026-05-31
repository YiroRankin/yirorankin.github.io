(function () {
  const ENDPOINTS = {
    dashboard: 'https://script.google.com/macros/s/AKfycbwkW6DDAo7eeEd_6eDqlFzor1r5mRNtv-Ise9WZ9VINz4c-dsPgVjbt7LHpRQPLAK9_/exec',
    goals: 'https://yirorankin.github.io/sales/goals.json',
    records: 'https://yirorankin.github.io/sales/records.json',
    monthlyEnrollment: 'https://yirorankin.github.io/monthlyEnrollment.json'
  };

  const SPECIALISTS = {
    giuliana: 'Giuliana Quesada',
    natalia: 'Natalia Escalante',
    rosa: 'Rosa Tzec',
    susana: 'Susana Hipólito',
    mayte: 'Mayte Delgado',
    maru: 'Maru Ramírez'
  };

  const state = {
    specialist: document.body.dataset.specialist || '',
    payloads: {
      goals: null,
      records: null,
      monthlyEnrollment: null
    },
    errors: {}
  };

  const elements = {
    name: document.getElementById('specialist-name'),
    date: document.getElementById('today-label'),
    avatar: document.getElementById('avatar'),
    today: document.getElementById('today-block'),
    month: document.getElementById('month-block'),
    week: document.getElementById('week-block'),
    campus: document.getElementById('campus-block'),
    pipeline: document.getElementById('pipeline-block'),
    cycle: document.getElementById('cycle-block')
  };

  function currentSpecialistName() {
    return SPECIALISTS[state.specialist] || state.specialist || '';
  }

  function normalizeText(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toUpperCase();
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function formatNumber(value) {
    return new Intl.NumberFormat('es-MX', {
      maximumFractionDigits: 0
    }).format(Number(value) || 0);
  }

  function formatDecimal(value) {
    return new Intl.NumberFormat('es-MX', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1
    }).format(Number(value) || 0);
  }

  function formatPercent(value) {
    return new Intl.NumberFormat('es-MX', {
      style: 'percent',
      minimumFractionDigits: 1,
      maximumFractionDigits: 1
    }).format(Number(value) || 0);
  }

  function monthKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }

  function addMonths(key, amount) {
    const [year, month] = key.split('-').map(Number);
    const date = new Date(year, month - 1 + amount, 1);
    return monthKey(date);
  }

  function formatMonth(key) {
    const [year, month] = key.split('-').map(Number);
    return new Intl.DateTimeFormat('es-MX', {
      month: 'long',
      year: 'numeric'
    }).format(new Date(year, month - 1, 1));
  }

  function safeRatio(value, total) {
    return total ? (Number(value) || 0) / total : 0;
  }

  function statusClass(ratio) {
    if (ratio >= 0.8) return 'green';
    if (ratio >= 0.4) return 'yellow';
    return 'red';
  }

  function paceStatusClass(ratio) {
    if (ratio >= 1) return 'green';
    if (ratio >= 0.5) return 'yellow';
    return 'red';
  }

  function localDateKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  function isBusinessDay(date) {
    const day = date.getDay();
    return day !== 0 && day !== 6;
  }

  // Cuenta días hábiles de forma inclusiva para que "hoy" todavía cuente si es laboral.
  function businessDaysBetween(startDate, endDate) {
    const current = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
    const end = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
    let days = 0;

    while (current <= end) {
      if (isBusinessDay(current)) days += 1;
      current.setDate(current.getDate() + 1);
    }

    return days;
  }

  function businessDaysRemainingInMonth(today) {
    const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    return Math.max(1, businessDaysBetween(today, end));
  }

  function daysInCurrentMonth(today) {
    return new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  }

  function daysUntilMonthEnd(today) {
    const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    return Math.max(0, end.getDate() - today.getDate());
  }

  function rowsForSpecialist(rows, specialist) {
    const target = normalizeText(specialist);
    return (rows || []).filter((row) => normalizeText(row.specialist || row.owner) === target);
  }

  function rowsForMonth(rows, key) {
    return (rows || []).filter((row) => (row.inscriptionMonth || row.commercialMonth || row.createdMonth || '').slice(0, 7) === key);
  }

  function sumGoalRows(rows) {
    return rows.reduce((acc, row) => {
      acc.goal += Number(row.goal) || 0;
      acc.closed += Number(row.closed) || 0;
      return acc;
    }, { goal: 0, closed: 0 });
  }

  function salesRecords() {
    return state.payloads.records?.records || [];
  }

  function specialistSalesRows() {
    return rowsForSpecialist(salesRecords(), currentSpecialistName());
  }

  function dateFromRecord(row) {
    const value = row.closedDate || row.paymentDate || row.updatedDate || row.createdDate || '';
    return /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : '';
  }

  function isActiveProspect(row) {
    return !row.closed && !row.customer && !row.lossReason;
  }

  function currentMonthGoals() {
    const goals = rowsForSpecialist(state.payloads.goals?.specialistGoals || [], currentSpecialistName());
    return rowsForMonth(goals, monthKey(new Date()));
  }

  function cycleGoals() {
    return rowsForSpecialist(state.payloads.goals?.specialistGoals || [], currentSpecialistName());
  }

  function skeleton(count = 2) {
    return `<div class="skeleton">${Array.from({ length: count }).map(() => '<span></span>').join('')}</div>`;
  }

  function unavailable(message = 'Datos no disponibles. Intenta de nuevo más tarde.') {
    return `<p class="error-state">${escapeHtml(message)}</p>`;
  }

  function metricBox(label, value, className = '') {
    return `
      <div class="metric-box">
        <span>${escapeHtml(label)}</span>
        <strong class="${className}">${escapeHtml(value)}</strong>
      </div>
    `;
  }

  function progressHtml(ratio) {
    const className = statusClass(ratio);
    const width = Math.max(0, Math.min(100, ratio * 100));
    return `<div class="progress ${className}" style="--value: ${width}%"><i></i></div>`;
  }

  function renderHeader() {
    const specialist = currentSpecialistName();
    const today = new Date();

    elements.name.textContent = specialist || 'Mi meta';
    elements.avatar.textContent = specialist.trim().charAt(0) || '?';
    elements.date.textContent = new Intl.DateTimeFormat('es-MX', {
      weekday: 'long',
      day: 'numeric',
      month: 'long'
    }).format(today);
  }

  function renderTodayBlock() {
    if (state.errors.goals) {
      elements.today.innerHTML = unavailable();
      return;
    }

    const today = new Date();
    const monthly = sumGoalRows(currentMonthGoals());
    const gap = monthly.goal - monthly.closed;
    const businessDays = businessDaysRemainingInMonth(today);
    const neededToday = Math.max(0, Math.ceil(gap / businessDays));
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 6);
    const lastSevenClosed = specialistSalesRows()
      .filter((row) => row.closed)
      .filter((row) => {
        const date = dateFromRecord(row);
        return date && date >= localDateKey(sevenDaysAgo) && date <= localDateKey(today);
      }).length;
    const recentBusinessDays = Math.max(1, businessDaysBetween(sevenDaysAgo, today));
    const dailyPace = lastSevenClosed / recentBusinessDays;
    const className = neededToday <= 0 ? 'green' : paceStatusClass(safeRatio(dailyPace, neededToday));
    const title = neededToday <= 0
      ? '¡Meta del mes alcanzada!'
      : 'alumnos que necesitas inscribir hoy para llegar a tu meta del mes.';

    elements.today.innerHTML = `
      <article class="hero-number">
        <strong class="${className}">${formatNumber(neededToday)}</strong>
        <h2>${escapeHtml(title)}</h2>
        <p>Quedan ${formatNumber(businessDays)} días hábiles en el mes · Ritmo actual: ${formatDecimal(dailyPace)} inscritos/día</p>
      </article>
    `;
  }

  function renderMonthBlock() {
    if (state.errors.goals) {
      elements.month.innerHTML = unavailable();
      return;
    }

    const today = new Date();
    const currentKey = monthKey(today);
    const monthly = sumGoalRows(currentMonthGoals());
    const compliance = safeRatio(monthly.closed, monthly.goal);
    const gap = monthly.closed - monthly.goal;
    const nextKey = addMonths(currentKey, 1);
    const nextMonthGoals = rowsForMonth(cycleGoals(), nextKey);
    const nextTotal = sumGoalRows(nextMonthGoals);
    const nextPreview = daysUntilMonthEnd(today) <= 3 && nextTotal.goal > 0
      ? `<div class="next-month">Próximo mes: ${formatMonth(nextKey)} · Meta ${formatNumber(Math.round(nextTotal.goal))}</div>`
      : '';

    elements.month.innerHTML = `
      <article class="card soft">
        <h2 class="section-title">Mi meta del mes · ${escapeHtml(formatMonth(currentKey))}</h2>
        <div class="metric-grid">
          ${metricBox('Meta del mes', formatNumber(Math.round(monthly.goal)))}
          ${metricBox('Inscritos reales', formatNumber(monthly.closed), monthly.closed > 0 ? 'green' : '')}
          ${metricBox('Gap', `${gap > 0 ? '+' : ''}${formatNumber(Math.round(gap))}`, gap < 0 ? 'red' : 'green')}
          ${metricBox('% cumplimiento', formatPercent(compliance), statusClass(compliance))}
        </div>
        ${progressHtml(compliance)}
        ${nextPreview}
      </article>
    `;
  }

  function renderWeekBlock() {
    if (state.errors.goals || state.errors.records) {
      elements.week.innerHTML = unavailable();
      return;
    }

    const today = new Date();
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 6);
    const monthly = sumGoalRows(currentMonthGoals());
    const lastSevenClosed = specialistSalesRows()
      .filter((row) => row.closed)
      .filter((row) => {
        const date = dateFromRecord(row);
        return date && date >= localDateKey(sevenDaysAgo) && date <= localDateKey(today);
      }).length;
    const weeklyNeed = (monthly.goal / daysInCurrentMonth(today)) * 7;
    const ratio = safeRatio(lastSevenClosed, weeklyNeed);
    const className = paceStatusClass(ratio);
    let message = 'Ritmo insuficiente para llegar a la meta. Necesitas acelerar esta semana.';
    if (ratio >= 1) message = 'Vas al ritmo. Mantén el paso.';
    else if (ratio >= 0.5) message = 'Ligeramente por debajo del ritmo. Un inscrito extra esta semana marca la diferencia.';

    elements.week.innerHTML = `
      <section class="card">
        <h2 class="section-title">Mi ritmo esta semana</h2>
        <div class="week-grid">
          ${metricBox('Inscritos últimos 7 días', formatNumber(lastSevenClosed), lastSevenClosed > 0 ? 'green' : '')}
          ${metricBox('Necesitabas esta semana', formatNumber(Math.ceil(weeklyNeed)))}
        </div>
        <p class="diagnostic ${className}">${escapeHtml(message)}</p>
        <p class="card-note">Nota: por ahora se usa la mejor fecha disponible en SalesForce para estimar los últimos 7 días.</p>
      </section>
    `;
  }

  function renderCampusBlock() {
    if (state.errors.goals) {
      elements.campus.innerHTML = unavailable();
      return;
    }

    const rows = currentMonthGoals()
      .filter((row) => Number(row.goal) > 0)
      .map((row) => ({
        campus: row.campus || 'Sin campus',
        temario: row.temario || '',
        goal: Number(row.goal) || 0,
        closed: Number(row.closed) || 0,
        compliance: safeRatio(row.closed, row.goal)
      }))
      .sort((a, b) => a.compliance - b.compliance || b.goal - a.goal);

    if (!rows.length) {
      elements.campus.innerHTML = `
        <section>
          <h2 class="section-title">Mi avance por campus este mes</h2>
          <p class="empty-state">No hay metas por campus asignadas para este mes.</p>
        </section>
      `;
      return;
    }

    elements.campus.innerHTML = `
      <section>
        <h2 class="section-title">Mi avance por campus este mes</h2>
        <div class="campus-list">
          ${rows.map((row) => {
            const gap = row.closed - row.goal;
            const className = statusClass(row.compliance);
            return `
              <article class="campus-card">
                <div class="campus-head">
                  <div>
                    <h3>${escapeHtml(row.campus)}</h3>
                    ${row.temario ? `<small>${escapeHtml(row.temario)}</small>` : ''}
                  </div>
                  <span class="percent-pill ${className}">${formatPercent(row.compliance)}</span>
                </div>
                <div class="campus-metrics">
                  <div><span>Meta</span><strong>${formatNumber(Math.round(row.goal))}</strong></div>
                  <div><span>Inscritos</span><strong class="${row.closed > 0 ? 'green' : ''}">${formatNumber(row.closed)}</strong></div>
                  <div><span>Gap</span><strong class="${gap < 0 ? 'red' : 'green'}">${gap > 0 ? '+' : ''}${formatNumber(Math.round(gap))}</strong></div>
                </div>
                <div class="progress slim ${className}" style="--value: ${Math.max(0, Math.min(100, row.compliance * 100))}%"><i></i></div>
                ${row.closed === 0 ? '<p class="card-note red">Sin inscritos este mes</p>' : ''}
              </article>
            `;
          }).join('')}
        </div>
      </section>
    `;
  }

  function renderPipelineBlock() {
    if (state.errors.records) {
      elements.pipeline.innerHTML = unavailable();
      return;
    }

    const currentKey = monthKey(new Date());
    const rows = specialistSalesRows();
    const monthRows = rows.filter((row) => (row.commercialMonth || row.createdMonth || '').slice(0, 7) === currentKey);
    const prospectsMonth = monthRows.length;
    const closedMonth = monthRows.filter((row) => row.closed).length;
    const closeRateMonth = safeRatio(closedMonth, prospectsMonth);
    const active = rows.filter((row) => isActiveProspect(row)).length;
    const convertedOpen = rows.filter((row) => row.converted && !row.closed && !row.customer && !row.lossReason).length;
    const historicalRate = safeRatio(rows.filter((row) => row.closed).length, rows.length);
    const potential = convertedOpen * historicalRate;

    elements.pipeline.innerHTML = `
      <section class="card">
        <h2 class="section-title">Mi pipeline activo</h2>
        <div class="pipeline-grid">
          <div><span>Prospectos activos en SF</span><strong>${formatNumber(active)}</strong></div>
          <div><span>Convertidos sin cerrar</span><strong class="${convertedOpen > 0 ? 'yellow' : ''}">${formatNumber(convertedOpen)}</strong></div>
          <div><span>Tasa de cierre del mes</span><strong class="${statusClass(closeRateMonth)}">${formatPercent(closeRateMonth)}</strong></div>
        </div>
        <p class="card-note">Con ${formatNumber(convertedOpen)} convertidos sin cerrar, tienes potencial para ${formatNumber(Math.round(potential))} inscritos esta semana si los contactas hoy.</p>
      </section>
    `;
  }

  function renderCycleBlock() {
    if (state.errors.goals) {
      elements.cycle.innerHTML = unavailable();
      return;
    }

    const rows = cycleGoals();
    const totals = sumGoalRows(rows);
    const gap = totals.closed - totals.goal;
    const compliance = safeRatio(totals.closed, totals.goal);
    const updatedAt = state.payloads.goals?.meta?.updatedAt
      || state.payloads.goals?.meta?.exportedAt
      || state.payloads.monthlyEnrollment?.meta?.updatedAt
      || state.payloads.monthlyEnrollment?.meta?.exportedAt
      || 'sin fecha';
    const schoolYear = state.payloads.goals?.schoolYear || '2026-2027';

    elements.cycle.innerHTML = `
      <section class="card">
        <h2 class="section-title">Mi meta del ciclo</h2>
        <div class="cycle-grid">
          <div><span>Meta ciclo</span><strong>${formatNumber(Math.round(totals.goal))}</strong></div>
          <div><span>Inscritos ciclo</span><strong class="${totals.closed > 0 ? 'green' : ''}">${formatNumber(totals.closed)}</strong></div>
          <div><span>Gap ciclo</span><strong class="${gap < 0 ? 'red' : 'green'}">${gap > 0 ? '+' : ''}${formatNumber(Math.round(gap))}</strong></div>
        </div>
        ${progressHtml(compliance)}
        <p class="card-note">Ciclo ${escapeHtml(schoolYear)} · Actualizado ${escapeHtml(updatedAt)}</p>
      </section>
    `;
  }

  function renderAll() {
    renderHeader();
    renderTodayBlock();
    renderMonthBlock();
    renderWeekBlock();
    renderCampusBlock();
    renderPipelineBlock();
    renderCycleBlock();
  }

  function renderLoading() {
    renderHeader();
    elements.today.innerHTML = skeleton(1);
    elements.month.innerHTML = skeleton(2);
    elements.week.innerHTML = skeleton(2);
    elements.campus.innerHTML = skeleton(3);
    elements.pipeline.innerHTML = skeleton(2);
    elements.cycle.innerHTML = skeleton(2);
  }

  async function fetchJson(key, url) {
    try {
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      state.payloads[key] = await response.json();
    } catch (error) {
      state.errors[key] = error;
      state.payloads[key] = null;
    }
  }

  async function fetchLiveDashboard() {
    let payload;
    try {
      const response = await fetch(ENDPOINTS.dashboard, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      payload = await response.json();
    } catch (error) {
      payload = await fetchLiveDashboardJsonp();
    }

    state.payloads.goals = {
      meta: payload.meta || {},
      schoolYear: payload.sales?.schoolYear || '',
      specialistGoals: payload.sales?.specialistGoals || []
    };
    state.payloads.records = {
      meta: payload.meta || {},
      schoolYear: payload.sales?.schoolYear || '',
      records: payload.sales?.records || []
    };
    state.payloads.monthlyEnrollment = {
      meta: payload.meta || {},
      monthlyEnrollment: payload.monthlyEnrollment || []
    };
  }

  function fetchLiveDashboardJsonp() {
    return new Promise((resolve, reject) => {
      const callbackName = `miMetaDashboardCallback_${Date.now()}`;
      const script = document.createElement('script');
      const separator = ENDPOINTS.dashboard.includes('?') ? '&' : '?';

      window[callbackName] = (payload) => {
        resolve(payload);
        script.remove();
        delete window[callbackName];
      };

      script.onerror = () => {
        reject(new Error('JSONP load failed'));
        script.remove();
        delete window[callbackName];
      };

      script.src = `${ENDPOINTS.dashboard}${separator}callback=${callbackName}`;
      document.body.appendChild(script);
    });
  }

  async function init() {
    renderLoading();
    try {
      await fetchLiveDashboard();
    } catch (error) {
      await Promise.all([
        fetchJson('goals', ENDPOINTS.goals),
        fetchJson('records', ENDPOINTS.records),
        fetchJson('monthlyEnrollment', ENDPOINTS.monthlyEnrollment)
      ]);
    }
    renderAll();
  }

  init();
}());
