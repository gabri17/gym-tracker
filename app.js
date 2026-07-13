// --- STATO DELL'APP ---
let appData = {
    startWeek: "",
    routine: [],
    progress: {}
};

// Routine in costruzione (copia di lavoro per il form builder)
let builderDays = [];

// Settimana selezionata per la visualizzazione allenamento
let selectedWeek = "";

// --- INIZIALIZZAZIONE ---
document.addEventListener("DOMContentLoaded", () => {
    loadData();
    selectedWeek = getCurrentWeekString();
    populateSetupForm();
    updateWorkoutView();
});

function switchTab(tabId) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.tabs button').forEach(b => b.classList.remove('active'));
    document.getElementById(`view-${tabId}`).classList.add('active');
    document.getElementById(`tab-${tabId}`).classList.add('active');
    if (tabId === 'workout') updateWorkoutView();
}

// --- LOGICA SETTIMANE ---
function getCurrentWeekString() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 4 - (d.getDay() || 7));
    const yearStart = new Date(d.getFullYear(), 0, 1);
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return `${d.getFullYear()}-W${weekNo.toString().padStart(2, '0')}`;
}

function formatWeekDisplay(weekStr) {
    const [year, w] = weekStr.split('-W').map(Number);
    const jan4 = new Date(year, 0, 4);
    const dayOfWeek = jan4.getDay() || 7;
    const mondayWeek1 = new Date(jan4);
    mondayWeek1.setDate(jan4.getDate() - dayOfWeek + 1);
    const monday = new Date(mondayWeek1);
    monday.setDate(mondayWeek1.getDate() + (w - 1) * 7);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const fmt = (d) => `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;
    return `W${w}-${year}: ${fmt(monday)} - ${fmt(sunday)}`;
}

function getWeekDiff(week1, week2) {
    if (!week1 || !week2) return 0;
    const [y1, w1] = week1.split('-W').map(Number);
    const [y2, w2] = week2.split('-W').map(Number);
    return ((y2 - y1) * 52) + (w2 - w1);
}

function addWeeks(weekStr, n) {
    const [year, w] = weekStr.split('-W').map(Number);
    let newW = w + n;
    let newYear = year;
    while (newW > 52) { newW -= 52; newYear += 1; }
    while (newW < 1) { newW += 52; newYear -= 1; }
    return `${newYear}-W${newW.toString().padStart(2, '0')}`;
}

function resetDaySelection() {
    document.querySelectorAll('.day-pill').forEach(p => p.classList.remove('active'));
    document.getElementById('exercises-container').innerHTML = '';
}

function prevWeek() {
    const startWeek = appData.startWeek || getCurrentWeekString();
    if (getWeekDiff(startWeek, selectedWeek) <= 0) return;
    selectedWeek = addWeeks(selectedWeek, -1);
    resetDaySelection();
    updateWeekDisplay();
    renderDayTabs();
}

function nextWeek() {
    selectedWeek = addWeeks(selectedWeek, 1);
    resetDaySelection();
    updateWeekDisplay();
    renderDayTabs();
}

function goToCurrentWeek() {
    selectedWeek = getCurrentWeekString();
    resetDaySelection();
    updateWeekDisplay();
    renderDayTabs();
}

function updateWeekDisplay() {
    const display = document.getElementById('current-week-display');
    const currentWeek = getCurrentWeekString();
    const diff = getWeekDiff(currentWeek, selectedWeek);
    const startWeek = appData.startWeek || currentWeek;
    const atStart = getWeekDiff(startWeek, selectedWeek) <= 0;
    let colorClass = 'week-current';
    if (diff < 0) colorClass = 'week-past';
    else if (diff > 0) colorClass = 'week-future';

    display.innerHTML = `
        <div class="week-nav-row">
            <button class="week-nav-btn" onclick="prevWeek()" title="Settimana precedente" ${atStart ? 'disabled' : ''}>&#8249;</button>
            <span class="week-label ${colorClass}">${formatWeekDisplay(selectedWeek)}</span>
            <button class="week-nav-btn" onclick="nextWeek()" title="Settimana successiva">&#8250;</button>
        </div>
        ${diff !== 0 ? '<div class="week-today-row"><button class="week-today-btn" onclick="goToCurrentWeek()" title="Torna a oggi">Oggi</button></div>' : ''}
    `;
}

// --- CALCOLO PESO TARGET ---
function calculateTargetWeight(exId, baseKg, deltaKg) {
    const diff = getWeekDiff(appData.startWeek, selectedWeek);
    if (diff <= 0) return baseKg;

    let target = baseKg;
    const [startY, startW] = appData.startWeek.split('-W').map(Number);

    for (let i = 0; i <= diff; i++) {
        let iterWeekNum = startW + i;
        let iterYear = startY;
        if (iterWeekNum > 52) { iterWeekNum -= 52; iterYear += 1; }
        let iterWeekStr = `${iterYear}-W${iterWeekNum.toString().padStart(2, '0')}`;

        if (appData.progress[iterWeekStr] && appData.progress[iterWeekStr][exId]) {
            target = appData.progress[iterWeekStr][exId];
        }
        if (i < diff) {
            target += deltaKg;
        }
    }
    return target;
}

// --- GESTIONE DATI ---
function loadData() {
    const stored = localStorage.getItem('gymTrackerData');
    if (stored) {
        try {
            appData = JSON.parse(stored);
            if (!appData.progress) appData.progress = {};
        } catch (e) {
            appData = { startWeek: "", routine: [], progress: {} };
        }
    }
}

function saveToLocalStorage() {
    localStorage.setItem('gymTrackerData', JSON.stringify(appData));
}

// --- BUILDER: GESTIONE GIORNI ---
function generateId() {
    return 'ex_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 5);
}

function addDay() {
    const name = prompt('Nome del nuovo giorno:', `Giorno ${builderDays.length + 1}`);
    if (!name) return;
    builderDays.push({ nomeGiorno: name, esercizi: [] });
    renderBuilder();
}

function renameDay(dayIndex) {
    const current = builderDays[dayIndex].nomeGiorno;
    const newName = prompt('Rinomina giorno:', current);
    if (!newName) return;
    builderDays[dayIndex].nomeGiorno = newName;
    renderBuilder();
}

function removeDay(dayIndex) {
    if (!confirm(`Eliminare "${builderDays[dayIndex].nomeGiorno}" e tutti i suoi esercizi?`)) return;
    builderDays.splice(dayIndex, 1);
    renderBuilder();
}

// --- BUILDER: GESTIONE ESERCIZI ---
function addExercise(dayIndex) {
    builderDays[dayIndex].esercizi.push({
        id: generateId(),
        nome: '',
        serieRip: '',
        baseKg: 0,
        deltaKg: 1
    });
    renderBuilder();
    // Focus sul campo nome del nuovo esercizio
    setTimeout(() => {
        const cards = document.querySelectorAll(`.builder-exercise[data-day="${dayIndex}"]`);
        const last = cards[cards.length - 1];
        if (last) {
            const input = last.querySelector('.ex-name-input');
            if (input) input.focus();
        }
    }, 50);
}

function updateExerciseField(dayIndex, exIndex, field, value) {
    if (field === 'baseKg' || field === 'deltaKg') {
        value = parseFloat(value) || 0;
    }
    builderDays[dayIndex].esercizi[exIndex][field] = value;
}

function removeExercise(dayIndex, exIndex) {
    builderDays[dayIndex].esercizi.splice(exIndex, 1);
    renderBuilder();
}

// --- BUILDER: RENDER ---
function renderBuilder() {
    const container = document.getElementById('builder-days');
    container.innerHTML = '';

    if (builderDays.length === 0) {
        container.innerHTML = '<p class="builder-empty">Nessun giorno configurato. Clicca "Aggiungi Giorno" per iniziare.</p>';
        return;
    }

    builderDays.forEach((giorno, dIdx) => {
        const dayCard = document.createElement('div');
        dayCard.className = 'builder-day-card';

        let exercisesHtml = '';
        if (giorno.esercizi.length === 0) {
            exercisesHtml = '<p class="builder-ex-empty">Nessun esercizio. Aggiungine uno!</p>';
        } else {
            giorno.esercizi.forEach((ex, eIdx) => {
                exercisesHtml += `
                    <div class="builder-exercise" data-day="${dIdx}" data-ex="${eIdx}">
                        <div class="builder-ex-fields">
                            <div class="builder-ex-row">
                                <input type="text" class="ex-name-input" placeholder="Nome esercizio"
                                    value="${escapeHtml(ex.nome)}"
                                    onchange="updateExerciseField(${dIdx}, ${eIdx}, 'nome', this.value)">
                                <input type="text" class="ex-serierip-input" placeholder="SxR"
                                    value="${escapeHtml(ex.serieRip)}"
                                    onchange="updateExerciseField(${dIdx}, ${eIdx}, 'serieRip', this.value)">
                            </div>
                            <div class="builder-ex-row">
                                <div class="builder-ex-num">
                                    <label>Base (kg)</label>
                                    <input type="number" step="0.5" min="0" value="${ex.baseKg}"
                                        onchange="updateExerciseField(${dIdx}, ${eIdx}, 'baseKg', this.value)">
                                </div>
                                <div class="builder-ex-num">
                                    <label>Delta (kg)</label>
                                    <input type="number" step="0.5" min="0" value="${ex.deltaKg}"
                                        onchange="updateExerciseField(${dIdx}, ${eIdx}, 'deltaKg', this.value)">
                                </div>
                                <button class="btn-icon btn-remove-ex" onclick="removeExercise(${dIdx}, ${eIdx})" title="Rimuovi esercizio">&times;</button>
                            </div>
                        </div>
                    </div>
                `;
            });
        }

        dayCard.innerHTML = `
            <div class="builder-day-header">
                <span class="builder-day-name">${escapeHtml(giorno.nomeGiorno)}</span>
                <div class="builder-day-actions">
                    <button class="btn-icon btn-rename" onclick="renameDay(${dIdx})" title="Rinomina">&#9998;</button>
                    <button class="btn-icon btn-remove-day" onclick="removeDay(${dIdx})" title="Elimina giorno">&times;</button>
                </div>
            </div>
            <div class="builder-day-exercises">
                ${exercisesHtml}
            </div>
            <button class="btn-add-ex" onclick="addExercise(${dIdx})">+ Aggiungi Esercizio</button>
        `;
        container.appendChild(dayCard);
    });
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

// --- SETUP: POPOLA E SALVA ---
function populateSetupForm() {
    document.getElementById('start-week').value = appData.startWeek || getCurrentWeekString();

    // Copia routine nel builder
    if (appData.routine.length > 0) {
        builderDays = JSON.parse(JSON.stringify(appData.routine));
    } else {
        builderDays = [
            {
                nomeGiorno: "Giorno 1 - Petto e Tricipiti",
                esercizi: [
                    { id: generateId(), nome: "Panca Piana", serieRip: "5x10", baseKg: 80, deltaKg: 1 },
                    { id: generateId(), nome: "Spinte Manubri", serieRip: "4x8", baseKg: 24, deltaKg: 1 }
                ]
            },
            {
                nomeGiorno: "Giorno 2 - Gambe e Dorso",
                esercizi: [
                    { id: generateId(), nome: "Squat", serieRip: "5x5", baseKg: 100, deltaKg: 2.5 }
                ]
            }
        ];
    }
    renderBuilder();
}

function saveSetup() {
    // Validazione
    for (const giorno of builderDays) {
        if (!giorno.nomeGiorno.trim()) {
            alert('Ogni giorno deve avere un nome!');
            return;
        }
        for (const ex of giorno.esercizi) {
            if (!ex.nome.trim()) {
                alert(`Esercizio senza nome nel giorno "${giorno.nomeGiorno}". Compila tutti i nomi.`);
                return;
            }
            if (!ex.serieRip.trim()) {
                alert(`Esercizio "${ex.nome}" senza indicazione serie/ripetizioni.`);
                return;
            }
        }
    }

    appData.routine = JSON.parse(JSON.stringify(builderDays));
    appData.startWeek = document.getElementById('start-week').value;
    if (!appData.progress) appData.progress = {};

    saveToLocalStorage();
    const msg = document.getElementById('setup-msg');
    msg.innerText = 'Scheda salvata con successo!';
    msg.classList.add('visible');
    setTimeout(() => { msg.innerText = ''; msg.classList.remove('visible'); }, 3000);

    // Passa automaticamente alla tab Allenamento
    switchTab('workout');
}

// --- IMPORT / EXPORT JSON ---
function importJsonFile() {
    const input = document.getElementById('file-import');
    input.click();
}

function handleFileImport(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const data = JSON.parse(e.target.result);

            // Accetta sia array diretto sia oggetto con routine
            let routine = Array.isArray(data) ? data : (data.routine || null);
            if (!routine || !Array.isArray(routine)) {
                alert('Il file JSON non contiene una scheda valida.');
                return;
            }

            // Validazione struttura
            for (const giorno of routine) {
                if (!giorno.nomeGiorno || !Array.isArray(giorno.esercizi)) {
                    alert('Struttura JSON non valida: ogni giorno deve avere "nomeGiorno" e "esercizi".');
                    return;
                }
                for (const ex of giorno.esercizi) {
                    if (!ex.id || !ex.nome || !ex.serieRip || ex.baseKg === undefined || ex.deltaKg === undefined) {
                        alert(`Esercizio mancante di campi obbligatori: ${JSON.stringify(ex)}`);
                        return;
                    }
                }
            }

            builderDays = routine;
            renderBuilder();
            const msg = document.getElementById('setup-msg');
            msg.innerText = `Importati ${routine.length} giorni dal file.`;
            msg.classList.add('visible');
            setTimeout(() => { msg.innerText = ''; msg.classList.remove('visible'); }, 3000);
        } catch (err) {
            alert('Errore nel parsing del file JSON: ' + err.message);
        }
    };
    reader.readAsText(file);
    event.target.value = '';
}

function exportJsonFile() {
    if (builderDays.length === 0) {
        alert('Nessuna scheda da esportare.');
        return;
    }
    const json = JSON.stringify(builderDays, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gym-scheda-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// --- WORKOUT: VISUALIZZAZIONE ---
function updateWorkoutView() {
    updateWeekDisplay();
    renderDayTabs();
}

function renderDayTabs() {
    const container = document.getElementById('day-tabs');
    container.innerHTML = '';

    if (appData.routine.length === 0) {
        container.innerHTML = '<p class="placeholder-text">Nessuna scheda configurata. Vai su "Scheda & Setup" per crearne una.</p>';
        return;
    }

    appData.routine.forEach((giorno, index) => {
        const pill = document.createElement('button');
        pill.className = 'day-pill';
        pill.dataset.index = index;
        pill.innerText = giorno.nomeGiorno;
        pill.onclick = () => selectDay(index);
        container.appendChild(pill);
    });
}

function selectDay(index) {
    document.querySelectorAll('.day-pill').forEach(p => p.classList.remove('active'));
    document.querySelector(`.day-pill[data-index="${index}"]`).classList.add('active');
    renderWorkoutDay(index);
}

function renderWorkoutDay(dayIndex) {
    const container = document.getElementById('exercises-container');
    container.innerHTML = '';

    const giorno = appData.routine[dayIndex];

    const startWeek = appData.startWeek || getCurrentWeekString();
    const isFirstWeek = getWeekDiff(startWeek, selectedWeek) <= 0;
    const prevWeekStr = addWeeks(selectedWeek, -1);

    giorno.esercizi.forEach(ex => {
        const targetKg = calculateTargetWeight(ex.id, ex.baseKg, ex.deltaKg);

        // Peso effettivo della settimana precedente (o base per la prima settimana)
        let prevWeight = ex.baseKg;
        if (!isFirstWeek && appData.progress[prevWeekStr] && appData.progress[prevWeekStr][ex.id]) {
            prevWeight = appData.progress[prevWeekStr][ex.id];
        } else if (!isFirstWeek) {
            prevWeight = calculateTargetWeight(ex.id, ex.baseKg, ex.deltaKg);
            // Ricavalo calcolando il target della settimana prima
            const prevDiff = getWeekDiff(appData.startWeek, prevWeekStr);
            if (prevDiff <= 0) {
                prevWeight = ex.baseKg;
            } else {
                let t = ex.baseKg;
                const [startY, startW] = appData.startWeek.split('-W').map(Number);
                for (let i = 0; i <= prevDiff; i++) {
                    let iterWeekNum = startW + i;
                    let iterYear = startY;
                    if (iterWeekNum > 52) { iterWeekNum -= 52; iterYear += 1; }
                    let iterWeekStr = `${iterYear}-W${iterWeekNum.toString().padStart(2, '0')}`;
                    if (appData.progress[iterWeekStr] && appData.progress[iterWeekStr][ex.id]) {
                        t = appData.progress[iterWeekStr][ex.id];
                    }
                    if (i < prevDiff) t += ex.deltaKg;
                }
                prevWeight = t;
            }
        }

        let currentActual = '';
        if (appData.progress[selectedWeek] && appData.progress[selectedWeek][ex.id]) {
            currentActual = appData.progress[selectedWeek][ex.id];
        } else {
            currentActual = targetKg;
        }

        const isLogged = appData.progress[selectedWeek] && appData.progress[selectedWeek][ex.id] !== undefined;

        const card = document.createElement('div');
        card.className = 'exercise-card' + (isLogged ? ' logged' : '');
        card.innerHTML = `
            <div class="ex-header">
                <div class="ex-title-group">
                    <span class="ex-title">${escapeHtml(ex.nome)}</span>
                    <span class="ex-reps">${escapeHtml(ex.serieRip)}</span>
                </div>
                ${isLogged ? '<span class="ex-badge-logged">OK</span>' : ''}
            </div>
            <div class="ex-details">
                <div class="ex-detail">
                    <span class="ex-detail-label">Target</span>
                    <span class="ex-detail-value">${targetKg} kg</span>
                </div>
                <div class="ex-detail">
                    <span class="ex-detail-label">${isFirstWeek ? 'Base' : 'Prec.'}</span>
                    <span class="ex-detail-value">${prevWeight} kg</span>
                </div>
                <div class="ex-detail">
                    <span class="ex-detail-label">Delta</span>
                    <span class="ex-detail-value">+${ex.deltaKg} kg</span>
                </div>
            </div>
            <div class="action-area">
                <input type="number" step="0.5" min="0" id="input-${ex.id}" value="${currentActual}">
                <button class="btn-confirm" onclick="saveExerciseProgress('${ex.id}')">Conferma</button>
            </div>
        `;
        container.appendChild(card);
    });
}

function saveExerciseProgress(exId) {
    const val = parseFloat(document.getElementById(`input-${exId}`).value);
    if (isNaN(val) || val < 0) {
        alert('Inserisci un numero valido non negativo.');
        return;
    }

    if (!appData.progress[selectedWeek]) {
        appData.progress[selectedWeek] = {};
    }
    appData.progress[selectedWeek][exId] = val;
    saveToLocalStorage();

    // Aggiorna subito la card
    const btn = document.querySelector(`button[onclick="saveExerciseProgress('${exId}')"]`);
    const card = btn.closest('.exercise-card');
    card.classList.add('logged');
    if (!card.querySelector('.ex-badge-logged')) {
        const badge = document.createElement('span');
        badge.className = 'ex-badge-logged';
        badge.textContent = 'OK';
        card.querySelector('.ex-header').appendChild(badge);
    }

    // Feedback sul bottone
    const oldText = btn.innerText;
    btn.innerText = 'Salvato!';
    btn.style.backgroundColor = '#059669';
    setTimeout(() => {
        btn.innerText = oldText;
        btn.style.backgroundColor = '';
    }, 1500);
}
