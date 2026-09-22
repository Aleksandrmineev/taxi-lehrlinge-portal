const state = {
  from: "2026-09-14",
  to: "2026-09-18",
  showPast: false,
  studentId: "oliver",
  trips: {},
  token: localStorage.getItem("lehrlinge_student_token") || "",
  mode: "student", // "student" | "shared" (gemeinsamer Testzugang)
  shared: null,
  holidays: [],
  changed: new Set(),
};

let scheduleData = null;
const GAS_URL = "https://script.google.com/macros/s/AKfycbwS88JTgj1NVqhGAaMKi3MXxTawF9zA6mkG6avgxmIj8c61_20EjNZdY0_0U6kKor29/exec";
const API_SECRET = "102030";

const loginView = document.getElementById("loginView");
const portalView = document.getElementById("portalView");
const tripList = document.getElementById("tripList");
const saveStatus = document.getElementById("saveStatus");
const loginStatus = document.getElementById("loginStatus");
const studentIdInput = document.getElementById("studentIdInput");
const pinInput = document.getElementById("pinInput");
const saveTrips = document.getElementById("saveTrips");
const loginStudentButton = document.getElementById("loginStudentButton");
const portalBoot = document.getElementById("portalBoot");
const portalBootText = document.getElementById("portalBootText");
const portalBootRetry = document.getElementById("portalBootRetry");
const portalToast = document.getElementById("portalToast");
const portalToastText = document.getElementById("portalToastText");
const showResetStudentButton = document.getElementById("showResetStudentButton");
const studentPinResetForm = document.getElementById("studentPinResetForm");
const closeResetStudentButton = document.getElementById("closeResetStudentButton");
const resetStudentButton = document.getElementById("resetStudentButton");
const resetStudentIdInput = document.getElementById("resetStudentIdInput");
const resetStudentIdFallbackInput = document.getElementById("resetStudentIdFallbackInput");
const resetStudentIdField = document.getElementById("resetStudentIdField");
const resetStudentCodeInput = document.getElementById("resetStudentCodeInput");
const resetStudentPinInput = document.getElementById("resetStudentPinInput");
const resetStudentCodeField = document.getElementById("resetStudentCodeField");
const resetStudentPinField = document.getElementById("resetStudentPinField");
const resetStudentHint = document.getElementById("resetStudentHint");
const resetStudentStatus = document.getElementById("resetStudentStatus");
const sharedTaxiInput = document.getElementById("sharedTaxiInput");
const sharedPinInput = document.getElementById("sharedPinInput");
const studentIdSelect = document.getElementById("studentIdSelect");
const pinLabel = document.getElementById("pinLabel");
const sharedHint = document.getElementById("sharedHint");
const sharedPickerView = document.getElementById("sharedPickerView");
const sharedPlanView = document.getElementById("sharedPlanView");
const planEditButton = document.getElementById("planEditButton");
const planFrom = document.getElementById("planFrom");
const planTo = document.getElementById("planTo");
const planRoute = document.getElementById("planRoute");
const planDirection = document.getElementById("planDirection");
const planReload = document.getElementById("planReload");
const planStatus = document.getElementById("planStatus");
const planSchedule = document.getElementById("planSchedule");
const checkChangesButton = document.getElementById("checkChangesButton");
const sharedNav = document.getElementById("sharedNav");
const navBack = document.getElementById("navBack");
const navPlan = document.getElementById("navPlan");
const navHome = document.getElementById("navHome");
const studentSearch = document.getElementById("studentSearch");
const studentPickList = document.getElementById("studentPickList");
const studentPickStatus = document.getElementById("studentPickStatus");
const sharedBanner = document.getElementById("sharedBanner");
const changeStudentButton = document.getElementById("changeStudentButton");
const helpDialog = document.getElementById("helpDialog");
const showHelpButton = document.getElementById("showHelpButton");
const closeHelpButton = document.getElementById("closeHelpButton");
let portalToastTimer = null;

function showPortalToast(message, type = "success", duration = 2600, action = null) {
  if (!portalToast || !portalToastText) return;
  clearTimeout(portalToastTimer);
  portalToastText.textContent = message;
  portalToast.className = `portal-toast portal-toast--${type}`;
  // Optionale Aktion (z. B. "Änderungen prüfen"): Plakette bleibt länger sichtbar
  const button = document.getElementById("portalToastAction");
  button.hidden = !action;
  button.onclick = action ? () => { portalToast.hidden = true; clearTimeout(portalToastTimer); action.onClick(); } : null;
  if (action) button.textContent = action.label;
  portalToast.hidden = false;
  portalToastTimer = setTimeout(() => { portalToast.hidden = true; }, duration);
}

function openStudentPinReset() {
  document.getElementById("loginForm").hidden = true;
  showResetStudentButton.hidden = true;
  studentPinResetForm.hidden = false;
  const preset = currentLoginId();
  resetStudentIdInput.value = preset;
  resetStudentIdFallbackInput.value = preset;
  resetStudentIdField.hidden = false;
  resetStudentIdInput.disabled = false;
  resetStudentIdFallbackInput.disabled = false;
  resetStudentCodeInput.value = "";
  resetStudentPinInput.value = "";
  resetStudentCodeInput.disabled = true;
  resetStudentPinInput.disabled = true;
  resetStudentCodeField.hidden = true;
  resetStudentPinField.hidden = true;
  resetStudentButton.textContent = "SMS-Code anfordern";
  resetStudentStatus.textContent = "";
  resetStudentStatus.className = "reset-status";
  resetStudentHint.textContent = "Namen wählen, dann SMS-Code anfordern. Danach Code und neuen PIN eingeben.";
  activeResetIdEl().focus();
}

function closeStudentPinReset() {
  studentPinResetForm.hidden = true;
  document.getElementById("loginForm").hidden = false;
  showResetStudentButton.hidden = false;
  resetStudentStatus.textContent = "";
  resetStudentIdInput.disabled = false;
  resetStudentIdFallbackInput.disabled = false;
}
const periodFrom = document.getElementById("periodFrom");
const periodTo = document.getElementById("periodTo");
const showPast = document.getElementById("showPast");
const periodStatus = document.getElementById("periodStatus");

function setPeriodLoading(loading) {
  tripList.classList.toggle("is-loading", loading);
  periodStatus.hidden = !loading;
}

async function refreshPeriod() {
  setPeriodLoading(true);
  try {
    await loadStudentPlan();
    renderTrips();
  } catch (error) {
    if (error instanceof SharedAuthError) {
      handleSharedError(error);
      return;
    }
    periodStatus.textContent = "Daten konnten nicht geladen werden.";
    showPortalToast("Daten konnten nicht geladen werden", "error", 4500);
  } finally {
    setPeriodLoading(false);
  }
}

function dateKey(date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Vienna",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function localDate(key) {
  return new Date(`${key}T12:00:00`);
}

function viennaNow() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Vienna",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    date: `${values.year}-${values.month}-${values.day}`,
    hour: Number(values.hour),
    minute: Number(values.minute),
  };
}

function directionOpen(date, direction) {
  const now = viennaNow();
  if (date > now.date) return true;
  if (date < now.date) return false;
  if (direction === "out") return now.hour < 3;
  return now.hour < 12;
}

function dateVisible(date) {
  const now = viennaNow();
  if (date < now.date) return state.showPast;
  if (date > now.date) return true;
  return directionOpen(date, "out") || directionOpen(date, "back");
}

function getWeekdays(fromKey, toKey) {
  const from = localDate(fromKey);
  const to = localDate(toKey);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) return [];

  const result = [];
  for (const date = new Date(from); date <= to; date.setDate(date.getDate() + 1)) {
    const key = dateKey(date);
    if (date.getDay() !== 0 && date.getDay() !== 6 && dateVisible(key)) result.push(key);
  }
  return result;
}

function ensureTrip(date) {
  if (!state.trips[date]) {
    const item = scheduleData?.items?.[date];
    if (item) {
      state.trips[date] = {
        out: item.status === "both" || item.status === "out",
        back: item.status === "both" || item.status === "back",
      };
    } else {
      const baseline = scheduleData?.days?.find((day) => day.date === date);
      const active = baseline ? baseline.active.includes(state.studentId) : true;
      state.trips[date] = { out: active, back: active };
    }
  }
  return state.trips[date];
}

async function loadScheduleData() {
  if (scheduleData) return;
  const response = await fetch("./data/schedule.json", { cache: "no-store" });
  scheduleData = await response.json();
}

async function apiGet(params) {
  const url = new URL(GAS_URL);
  Object.entries({ ...params, secret: API_SECRET, _ts: Date.now() }).forEach(([key, value]) => url.searchParams.set(key, value));
  const response = await fetch(url, { cache: "no-store" });
  const data = await response.json();
  if (!response.ok || data.ok === false) throw new Error(data.error || "API-Fehler");
  return data;
}

async function apiPost(body) {
  const response = await fetch(`${GAS_URL}?_ts=${Date.now()}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
    body: new URLSearchParams({ ...body, secret: API_SECRET }),
  });
  const data = await response.json();
  if (!response.ok || data.ok === false) throw new Error(data.error || "API-Fehler");
  return data;
}

async function loginStudent(studentId, pin) {
  const result = await apiGet({ fn: "student_login", studentId, pin });
  state.token = result.token;
  state.studentId = result.studentId;
  localStorage.setItem("lehrlinge_student_token", state.token);
}

async function loadStudentPlan() {
  let result;
  if (state.mode === "shared") {
    result = await sharedApi("student-plan", { query: { studentId: state.studentId, from: state.from, to: state.to } });
    if (result.student) result.student = { ...result.student, arrivalTime: result.student.arrivalTime || result.student.time };
    state.holidays = result.holidays || [];
  } else {
    result = await apiGet({ fn: "student_plan", studentToken: state.token, from: state.from, to: state.to });
  }
  scheduleData = { items: Object.fromEntries((result.items || []).map((item) => [item.date, item])) };
  state.trips = {};
  state.changed.clear();
  if (result.student) {
    document.getElementById("studentName").textContent = result.student.name;
    document.getElementById("studentRoute").textContent = result.student.route ? `Route ${result.student.route}` : "—";
    document.getElementById("studentAddress").textContent = result.student.address || "—";
    document.getElementById("studentTime").textContent = result.student.arrivalTime ? `Abholung ${result.student.arrivalTime}` : "";
  }
}

/* ===== Gemeinsamer Zugang (Testphase) =====
 * Login "lehrlinge" + gemeinsames Passwort, ohne persönliche Registrierung. Der Server prüft das Passwort,
 * vergibt ein eingeschränktes Token, zeigt keine Adressen und erzwingt die Änderungsfristen.
 * Daten laufen über die MurtalTaxi-API (Redis). */
const MAIN_ORIGIN = "https://taxi-murtal.vercel.app";
const SHARED_KEY = "mt:portal-shared-session";

class SharedAuthError extends Error { constructor() { super("shared_auth_required"); } }

function readSharedSession() {
  try {
    const session = JSON.parse(localStorage.getItem(SHARED_KEY) || "null");
    return session && session.jwt && session.expiresAt > Date.now() ? session : null;
  } catch (_) { return null; }
}

function hasAccess() { return state.mode === "shared" ? Boolean(state.shared) : Boolean(state.token); }

async function loginShared(login, password) {
  let response;
  try {
    response = await fetch(`${MAIN_ORIGIN}/api/lehrlinge/shared-login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ login, password }),
    });
  } catch (_) { throw new Error("unavailable"); }
  const data = await response.json().catch(() => ({}));
  if (response.status === 429) throw new Error("too_many_attempts");
  if (response.status === 503) throw new Error("shared_access_disabled");
  if (!response.ok || !data.jwt) throw new Error(response.status >= 500 ? "unavailable" : "invalid_credentials");
  state.shared = { jwt: data.jwt, expiresAt: Date.now() + (Number(data.expiresInSec) || 86400) * 1000 };
  localStorage.setItem(SHARED_KEY, JSON.stringify(state.shared));
}

async function sharedApi(path, { method = "GET", query = {}, body } = {}) {
  if (!state.shared?.jwt) throw new SharedAuthError();
  const url = new URL(`${MAIN_ORIGIN}/api/lehrlinge/${path}`);
  Object.entries(query).forEach(([key, value]) => url.searchParams.set(key, value));
  let response;
  try {
    response = await fetch(url, {
      method,
      headers: { Authorization: `Bearer ${state.shared.jwt}`, ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });
  } catch (_) { throw new Error("Server nicht erreichbar"); }
  const data = await response.json().catch(() => ({}));
  if (response.status === 401) throw new SharedAuthError();
  if (response.status >= 500 || response.status === 404) throw new Error("Server nicht erreichbar");
  if (!response.ok || data.ok === false) throw new Error(data.error || "API-Fehler");
  return data;
}

function tripStatus(item) {
  return item.out && item.back ? "both" : item.out ? "out" : item.back ? "back" : "none";
}

async function saveSharedChanges() {
  const rows = [...state.changed].filter((date) => state.trips[date]).map((date) => ({
    date,
    student_id: state.studentId,
    status: tripStatus(state.trips[date]),
    note: scheduleData?.items?.[date]?.note || "",
  }));
  if (!rows.length) return 0;
  await sharedApi("plan-save", { method: "POST", body: { rows, holidays: state.holidays } });
  return rows.length;
}

function showOnly(view) {
  loginView.hidden = view !== "login";
  sharedPickerView.hidden = view !== "picker";
  sharedPlanView.hidden = view !== "plan";
  portalView.hidden = view !== "portal";
  portalBoot.hidden = true;
  updateSharedNav(view);
}

// Navigationsleiste nur im gemeinsamen Zugang: Auswahl, Fahrtenplan, Bearbeiten
function updateSharedNav(view) {
  const inShared = state.mode === "shared" && (view === "picker" || view === "plan" || view === "portal");
  sharedNav.hidden = !inShared;
  document.body.classList.toggle("has-shared-nav", inShared);
  navBack.hidden = view === "picker"; // eine Ebene höher von der Auswahl ist die Anmeldung = Start
  navPlan.hidden = view === "plan";
}

// System-Zurück (Android/iOS) folgt den Bildschirmen des Portals
function pushView(view, extra = {}) {
  try { history.pushState({ view, ...extra }, ""); } catch (_) {}
}

// Ungespeicherte Änderungen im Bearbeiten-Bildschirm nicht stillschweigend verwerfen
function confirmLeaveEdit() {
  const editing = state.mode === "shared" && !portalView.hidden && state.changed.size > 0;
  return !editing || window.confirm("Ungespeicherte Änderungen verwerfen?");
}
function guarded(action) {
  return () => { if (confirmLeaveEdit()) action(); };
}

function leaveSharedMode() {
  state.mode = "student";
  state.shared = null;
  localStorage.removeItem(SHARED_KEY);
  portalView.classList.remove("is-shared");
  sharedBanner.hidden = true;
  showOnly("login");
  pinInput.value = "";
}

function handleSharedError(error, target) {
  if (error instanceof SharedAuthError) {
    leaveSharedMode();
    showPortalToast("Anmeldung abgelaufen. Bitte erneut anmelden.", "error", 4500);
    return true;
  }
  const message = /nicht erreichbar/i.test(error?.message || "") ? "Server nicht erreichbar. Bitte später erneut versuchen." : "Daten konnten nicht geladen werden.";
  if (target) target.textContent = message;
  showPortalToast(message, "error", 4500);
  return false;
}

let pickerStudents = [];

function escapeText(value) {
  return String(value ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
}
function escapeAttr(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function renderStudentPicker() {
  const query = studentSearch.value.trim().toLowerCase();
  const shown = pickerStudents.filter((student) => !query || String(student.name).toLowerCase().includes(query));
  studentPickList.innerHTML = shown.map((student) => `
    <button class="student-pick" type="button" data-student="${escapeAttr(student.id)}"><span>${escapeText(student.name)}</span></button>`).join("");
  studentPickStatus.hidden = shown.length > 0 || !pickerStudents.length;
  if (!shown.length && pickerStudents.length) studentPickStatus.textContent = "Kein Lehrling gefunden.";
}

async function showSharedPicker(options = {}) {
  state.mode = "shared";
  studentSearch.value = "";
  studentPickList.innerHTML = "";
  studentPickStatus.hidden = false;
  studentPickStatus.textContent = "Lehrlinge werden geladen…";
  showOnly("picker");
  if (!options.fromPop) pushView("picker");
  try {
    const data = await sharedApi("students");
    pickerStudents = (data.students || []).slice().sort((a, b) => String(a.name).localeCompare(String(b.name), "de"));
    if (!pickerStudents.length) studentPickStatus.textContent = "Keine Lehrlinge gefunden.";
    renderStudentPicker();
  } catch (error) {
    handleSharedError(error, studentPickStatus);
  }
}

async function openSharedStudent(studentId, options = {}) {
  state.studentId = studentId;
  state.mode = "shared";
  studentPickStatus.hidden = false;
  studentPickStatus.textContent = "Plan wird geladen…";
  try {
    await loadStudentPlan();
    portalView.classList.add("is-shared");
    sharedBanner.hidden = false;
    showOnly("portal");
    if (!options.fromPop) pushView("portal", { studentId });
    renderTrips();
    saveStatus.textContent = "";
  } catch (error) {
    handleSharedError(error, studentPickStatus);
  }
}

/* ----- Login: Lehrling per Auswahlliste, dort auch der gemeinsame Zugang ----- */
const SHARED_OPTION = "__shared__";
const LAST_STUDENT_KEY = "mt:portal-last-student";
let usingIdInput = false;
let usingResetIdInput = false;

function isSharedSelected() { return !usingIdInput && studentIdSelect.value === SHARED_OPTION; }
function currentLoginId() {
  const value = usingIdInput ? studentIdInput.value.trim().toLowerCase() : studentIdSelect.value;
  return value === SHARED_OPTION ? "" : value;
}
// PIN erstellen/zurücksetzen: gleiche Namensliste wie beim Login, mit Fallback auf ein Textfeld
function activeResetIdEl() { return usingResetIdInput ? resetStudentIdFallbackInput : resetStudentIdInput; }
function currentResetId() { return activeResetIdEl().value.trim().toLowerCase(); }

function syncLoginMode() {
  const shared = isSharedSelected();
  pinLabel.textContent = shared ? "Passwort" : "PIN";
  pinInput.maxLength = shared ? 32 : 4;
  pinInput.placeholder = shared ? "Passwort" : "••••";
  sharedHint.hidden = !shared;
  pinInput.value = "";
}
studentIdSelect.addEventListener("change", syncLoginMode);

async function loadPortalStudents() {
  try {
    const response = await fetch(`${MAIN_ORIGIN}/api/lehrlinge/portal-students`, {
      signal: typeof AbortSignal.timeout === "function" ? AbortSignal.timeout(6000) : undefined,
    });
    const data = await response.json();
    if (!response.ok || !Array.isArray(data.students) || !data.students.length) throw new Error("no list");
    const nameOptions = data.students.map((student) => `<option value="${escapeAttr(student.id)}">${escapeText(student.name)}</option>`).join("");
    studentIdSelect.innerHTML =
      `<option value="" disabled selected>Bitte wählen…</option>` +
      (data.sharedEnabled ? `<option value="${SHARED_OPTION}">Gemeinsamer Zugang (alle Lehrlinge)</option><option disabled>──────────</option>` : "") +
      nameOptions;
    resetStudentIdInput.innerHTML = `<option value="" disabled selected>Bitte wählen…</option>` + nameOptions;
    const last = localStorage.getItem(LAST_STUDENT_KEY);
    if (last && data.students.some((student) => student.id === last)) studentIdSelect.value = last;
  } catch (_) {
    // Liste nicht erreichbar: wie bisher die ID eintippen (Login und PIN-Formular)
    usingIdInput = true;
    studentIdSelect.hidden = true;
    studentIdSelect.required = false;
    studentIdInput.hidden = false;
    studentIdInput.required = true;
    document.querySelector('label[for="studentIdSelect"]').setAttribute("for", "studentIdInput");
    document.querySelector('label[for="studentIdInput"]').textContent = "Lehrling-ID";

    usingResetIdInput = true;
    resetStudentIdInput.hidden = true;
    resetStudentIdInput.required = false;
    resetStudentIdFallbackInput.hidden = false;
    resetStudentIdFallbackInput.required = true;
    document.querySelector('label[for="resetStudentIdInput"]').setAttribute("for", "resetStudentIdFallbackInput");
  }
}

/* ----- Fahrtenplan (Ansicht wie bei den Fahrern) ----- */
function setPlanDefaults() {
  const today = dateKey(new Date());
  const end = localDate(today);
  end.setDate(end.getDate() + 4);
  planFrom.value = today;
  planTo.value = dateKey(end);
}

function mapsUrl(address) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address || "")}`;
}

function formatChangedAt(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString("de-AT", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function renderPlanSchedule(days) {
  const today = dateKey(new Date());
  const visible = days.filter((day) => day.date >= today);
  const nearest = visible[0]?.date;
  planSchedule.innerHTML = visible.map((day) => `
    <section class="plan-day">
      <h2 class="plan-day-title">${escapeText(localDate(day.date).toLocaleDateString("de-AT", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" }))}</h2>
      ${day.routes.map((route) => `
        <details class="plan-route"${day.date === nearest ? " open" : ""}>
          <summary>Route ${escapeText(route.route)} · ${route.direction === "evening" ? "Rückfahrt" : "Hinfahrt"} · ${route.count ?? route.points.reduce((total, point) => total + point.students.length, 0)} Lehrlinge</summary>
          <div class="plan-points">
            ${(route.direction === "evening" ? [...route.points].reverse() : route.points).map((point) => `
              <div class="plan-stop">
                <a class="plan-address" href="${escapeAttr(point.url && /^https?:\/\//i.test(point.url) ? point.url : mapsUrl(point.address))}" target="_blank" rel="noopener">${escapeText(point.address || "—")}</a>
                <div class="plan-students">${point.students.map((student) => `<span class="plan-student"><strong>${escapeText(student.name)}</strong>${student.updatedBy ? `<small>Geändert von ${escapeText(student.updatedBy)}${student.note ? ` · ${escapeText(student.note)}` : ""}</small>` : ""}</span>`).join("")}</div>
              </div>`).join("")}
          </div>
          ${route.cancellations?.length ? `<div class="plan-cancellations"><strong>Absagen / Änderungen</strong>${route.cancellations.map((item) => `<div class="plan-cancelled"><span><b>${escapeText(item.name)}</b> ${escapeText(item.address)}</span><small>Geändert von ${escapeText(item.updatedBy)}${item.updatedAt ? ` · ${escapeText(formatChangedAt(item.updatedAt))}` : ""}${item.note ? ` · ${escapeText(item.note)}` : ""}</small></div>`).join("")}</div>` : ""}
        </details>`).join("")}
    </section>`).join("") || '<div class="empty-state">Keine zukünftigen Fahrten.</div>';
  return visible.length;
}

let planSeq = 0;
async function loadSharedPlan() {
  const seq = ++planSeq;
  planStatus.hidden = false;
  planStatus.textContent = "Daten werden geladen…";
  planReload.disabled = true;
  try {
    const data = await sharedApi("schedule", { query: { from: planFrom.value, to: planTo.value, route: planRoute.value, direction: planDirection.value } });
    if (seq !== planSeq) return;
    const shown = renderPlanSchedule(data.days || []);
    planStatus.textContent = shown ? "" : "Für diesen Zeitraum sind keine zukünftigen Fahrten geplant.";
    planStatus.hidden = Boolean(shown);
  } catch (error) {
    if (seq === planSeq) handleSharedError(error, planStatus);
  } finally {
    if (seq === planSeq) planReload.disabled = false;
  }
}

async function showSharedPlan(options = {}) {
  state.mode = "shared";
  if (!planFrom.value) setPlanDefaults();
  showOnly("plan");
  if (!options.fromPop) pushView("plan");
  await loadSharedPlan();
}

planEditButton.addEventListener("click", () => showSharedPicker());
checkChangesButton.addEventListener("click", guarded(() => showSharedPlan()));
navBack.addEventListener("click", guarded(() => showSharedPicker()));
navPlan.addEventListener("click", guarded(() => showSharedPlan()));
navHome.addEventListener("click", guarded(leaveSharedMode));
planReload.addEventListener("click", loadSharedPlan);
[planFrom, planTo, planRoute, planDirection].forEach((element) => element.addEventListener("change", loadSharedPlan));
studentSearch.addEventListener("input", renderStudentPicker);
studentPickList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-student]");
  if (button) openSharedStudent(button.dataset.student);
});
changeStudentButton.addEventListener("click", guarded(() => showSharedPicker()));

function formatDate(key) {
  return localDate(key).toLocaleDateString("de-AT", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });
}

function renderTrips() {
  const days = getWeekdays(state.from, state.to);
  if (!days.length) {
    tripList.innerHTML = `<div class="empty-state">Bitte einen gültigen Zeitraum mit mindestens einem Werktag auswählen.</div>`;
    return;
  }

  tripList.innerHTML = days.map((date) => {
    const item = ensureTrip(date);
    const weekday = localDate(date).toLocaleDateString("de-AT", { weekday: "long" });
    const outOpen = directionOpen(date, "out");
    const backOpen = directionOpen(date, "back");
    return `
      <div class="trip-row">
        <div class="trip-date"><strong>${weekday}</strong><small>${formatDate(date)}</small></div>
        <div class="trip-actions">
          <button class="trip-toggle ${outOpen ? (item.out ? "active" : "inactive") : "locked"}" data-date="${date}" data-direction="out" type="button" ${outOpen ? "" : "disabled"} title="${outOpen ? "Bis 03:00 änderbar" : "Änderungsfrist für die Hinfahrt abgelaufen"}">${outOpen ? (item.out ? "✓" : "×") : "🔒"} <span class="trip-label-long">Hin zu Zelstoff</span><span class="trip-label-short">Hin</span></button>
          <button class="trip-toggle ${backOpen ? (item.back ? "active" : "inactive") : "locked"}" data-date="${date}" data-direction="back" type="button" ${backOpen ? "" : "disabled"} title="${backOpen ? "Bis 12:00 änderbar" : "Änderungsfrist für die Rückfahrt abgelaufen"}">${backOpen ? (item.back ? "✓" : "×") : "🔒"} <span class="trip-label-long">Zurück</span><span class="trip-label-short">Rück</span></button>
        </div>
      </div>`;
  }).join("");

  tripList.querySelectorAll("[data-date]").forEach((button) => {
    button.addEventListener("click", () => {
      const { date, direction } = button.dataset;
      ensureTrip(date)[direction] = !ensureTrip(date)[direction];
      state.changed.add(date);
      renderTrips();
      saveStatus.textContent = "";
    });
  });
}

function setPeriod(from, to) {
  state.from = from;
  state.to = to;
  periodFrom.value = from;
  periodTo.value = to;
  renderTrips();
}

function weekStarting(date) {
  const result = new Date(date);
  const day = result.getDay() || 7;
  result.setDate(result.getDate() - day + 1);
  return result;
}

periodFrom.addEventListener("change", async () => {
  state.from = periodFrom.value;
  renderTrips();
  if (hasAccess()) refreshPeriod();
});
periodTo.addEventListener("change", async () => {
  state.to = periodTo.value;
  renderTrips();
  if (hasAccess()) refreshPeriod();
});
showPast.addEventListener("change", () => {
  state.showPast = showPast.checked;
  renderTrips();
});

document.querySelectorAll("[data-period]").forEach((button) => {
  button.addEventListener("click", () => {
    const monday = weekStarting(new Date());
    if (button.dataset.period === "next") monday.setDate(monday.getDate() + 7);
    const end = new Date(monday);
    end.setDate(end.getDate() + (button.dataset.period === "four" ? 27 : 6));
    setPeriod(dateKey(monday), dateKey(end));
    if (hasAccess()) refreshPeriod();
  });
});

// Standardzeitraum: aktuelle Woche (am Wochenende die nächste), damit beim Öffnen sofort kommende Fahrten sichtbar sind.
function setDefaultPeriod() {
  const day = localDate(dateKey(new Date()));
  const weekday = day.getDay();
  if (weekday === 0) day.setDate(day.getDate() + 1);
  else if (weekday === 6) day.setDate(day.getDate() + 2);
  else day.setDate(day.getDate() - weekday + 1);
  const end = new Date(day);
  end.setDate(end.getDate() + 6);
  state.from = dateKey(day);
  state.to = dateKey(end);
  periodFrom.value = state.from;
  periodTo.value = state.to;
}

showResetStudentButton.addEventListener("click", openStudentPinReset);
closeResetStudentButton.addEventListener("click", closeStudentPinReset);
showHelpButton.addEventListener("click", () => helpDialog.showModal());
closeHelpButton.addEventListener("click", () => helpDialog.close());

studentPinResetForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!studentPinResetForm.reportValidity()) return;
  resetStudentButton.disabled = true;
  resetStudentButton.classList.add("is-saving");
  try {
    const requestingCode = resetStudentCodeInput.disabled;
    const action = requestingCode ? "student_pin_request" : "student_pin_reset";
    const payload = { action, studentId: currentResetId() };
    if (!requestingCode) {
      payload.code = resetStudentCodeInput.value.trim();
      payload.pin = resetStudentPinInput.value;
    }
    const result = await apiPost(payload);
    if (action === "student_pin_request") {
      resetStudentCodeInput.disabled = false;
      resetStudentPinInput.disabled = false;
      resetStudentCodeField.hidden = false;
      resetStudentPinField.hidden = false;
      resetStudentIdField.hidden = true;
      resetStudentIdInput.disabled = true;
      resetStudentIdFallbackInput.disabled = true;
      resetStudentHint.textContent = "SMS-Code eingeben und neuen PIN festlegen.";
      resetStudentButton.textContent = "PIN ersetzen";
      const sentMessage = "SMS-Code wurde an " + (result.maskedPhone || "die hinterlegte Nummer") + " gesendet.";
      resetStudentStatus.textContent = sentMessage;
      resetStudentStatus.className = "reset-status is-success";
      showPortalToast(sentMessage, "success");
      resetStudentCodeInput.focus();
    } else {
      const recoveredStudentId = currentResetId();
      await loginStudent(recoveredStudentId, resetStudentPinInput.value);
      await loadStudentPlan();
      studentPinResetForm.hidden = true;
      loginView.hidden = true;
      portalView.hidden = false;
      renderTrips();
      resetStudentStatus.textContent = "PIN wurde erfolgreich ersetzt.";
      resetStudentStatus.className = "reset-status is-success";
      showPortalToast("PIN wurde erfolgreich ersetzt.", "success");
    }
  } catch (error) {
    const code = String(error.message || "").replace(/^Error:\s*/i, "");
    const messages = {
      invalid_reset_data: "Bitte Lehrling-ID, Telefonnummer und PIN prüfen.",
      phone_not_registered: "Diese Telefonnummer ist nicht hinterlegt.",
      phone_not_unique: "Diese Telefonnummer ist mehreren Lehrlingen zugeordnet. Bitte Support kontaktieren.",
      sms_not_configured: "SMS-Versand ist noch nicht eingerichtet. Bitte Support kontaktieren.",
      invalid_reset_code: "Der SMS-Code ist nicht korrekt.",
      reset_code_expired: "Der SMS-Code ist abgelaufen. Bitte einen neuen Code anfordern.",
      reset_code_locked: "Zu viele falsche Versuche. Bitte einen neuen Code anfordern.",
    };
    const errorMessage = messages[code] || "Wiederherstellung nicht möglich: " + code;
    resetStudentStatus.textContent = errorMessage;
    resetStudentStatus.className = "reset-status is-error";
    showPortalToast(errorMessage, "error", 4500);
  } finally {
    resetStudentButton.disabled = false;
    resetStudentButton.classList.remove("is-saving");
  }
});

document.getElementById("loginForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const shared = isSharedSelected();
  loginStudentButton.disabled = true;
  loginStudentButton.classList.add("is-saving");
  loginStudentButton.textContent = "Anmeldung…";
  loginStatus.textContent = "Anmeldung wird geprüft…";
  try {
    if (shared) {
      await loginShared("lehrlinge", pinInput.value.trim());
      pinInput.value = "";
      loginStatus.textContent = "";
      await showSharedPicker();
      return;
    }
    await loginStudent(currentLoginId(), pinInput.value.trim());
    localStorage.setItem(LAST_STUDENT_KEY, state.studentId);
    await loadStudentPlan();
    loginView.hidden = true;
    portalView.hidden = false;
    renderTrips();
    loginStatus.textContent = "";
  } catch (error) {
    const messages = {
      too_many_attempts: "Zu viele Versuche. Bitte in einigen Minuten erneut versuchen.",
      shared_access_disabled: "Der gemeinsame Zugang ist derzeit nicht verfügbar.",
      unavailable: "Server nicht erreichbar. Bitte später erneut versuchen.",
    };
    loginStatus.textContent = shared
      ? (messages[error.message] || "Passwort falsch.")
      : "Anmeldung fehlgeschlagen. Bitte Auswahl und PIN prüfen.";
  } finally {
    loginStudentButton.disabled = false;
    loginStudentButton.classList.remove("is-saving");
    loginStudentButton.textContent = "Einloggen";
  }
});

document.getElementById("logoutBtn").addEventListener("click", () => {
  if (state.mode === "shared") {
    leaveSharedMode();
    return;
  }
  if (state.token) {
    apiGet({ fn: "student_logout", studentToken: state.token }).catch(() => {});
  }
  portalView.hidden = true;
  loginView.hidden = false;
  studentPinResetForm.hidden = true;
  showResetStudentButton.hidden = false;
  state.token = "";
  localStorage.removeItem("lehrlinge_student_token");
  studentIdInput.value = "";
  studentIdSelect.value = "";
  syncLoginMode();
});

saveTrips.addEventListener("click", async () => {
  saveTrips.disabled = true;
  saveTrips.classList.add("is-saving");
  saveTrips.textContent = "Speichere…";
  saveStatus.textContent = "Speichere Änderungen…";
  try {
    if (state.mode === "shared") {
      if (!(await saveSharedChanges())) {
        saveStatus.textContent = "Keine Änderungen vorhanden.";
        showPortalToast("Keine Änderungen vorhanden", "error");
        return;
      }
    } else {
      await apiPost({
        action: "student_plan_save",
        studentToken: state.token,
        rows: JSON.stringify(Object.entries(state.trips).map(([date, item]) => ({ date, out: item.out, back: item.back }))),
      });
    }
    saveStatus.textContent = "Änderungen gespeichert.";
    if (state.mode === "shared") {
      // Gemeinsamer Zugang: länger sichtbar, mit Sprung zum Fahrtenplan
      showPortalToast("Änderungen gespeichert", "success", 8000, { label: "Änderungen prüfen", onClick: () => showSharedPlan() });
    } else {
      showPortalToast("Änderungen gespeichert", "success");
    }
    await loadStudentPlan();
    renderTrips();
  } catch (error) {
    if (error instanceof SharedAuthError) { handleSharedError(error); return; }
    saveStatus.textContent = error.message === "morning_cutoff_passed" || error.message === "evening_cutoff_passed"
      ? "Die Änderungsfrist für diese Fahrt ist bereits abgelaufen."
      : `Speichern fehlgeschlagen: ${error.message}`;
    showPortalToast("Speichern fehlgeschlagen", "error", 4500);
  } finally {
    saveTrips.disabled = false;
    saveTrips.classList.remove("is-saving");
    saveTrips.textContent = "Änderungen speichern";
  }
});

document.getElementById("saveNote").addEventListener("click", () => {
  saveStatus.textContent = "Nachricht lokal vorgemerkt — noch nicht mit dem Server verbunden.";
});

async function restoreStudentSession() {
  loginView.hidden = true;
  portalView.hidden = true;
  portalBoot.hidden = false;
  portalBootRetry.hidden = true;
  const sharedSession = !state.token && readSharedSession();
  if (sharedSession) {
    state.shared = sharedSession;
    await showSharedPicker();
    return;
  }
  if (!state.token) {
    portalBoot.hidden = true;
    loginView.hidden = false;
    return;
  }
  try {
    portalBootText.textContent = "Deine Daten werden geladen…";
    await loadStudentPlan();
    portalBoot.hidden = true;
    loginView.hidden = true;
    portalView.hidden = false;
    renderTrips();
  } catch (error) {
    const authError = /student_auth_required|invalid_credentials|student_not_found/i.test(error.message || "");
    if (authError) {
      state.token = "";
      localStorage.removeItem("lehrlinge_student_token");
      portalBoot.hidden = true;
      loginView.hidden = false;
      return;
    }
    portalBootText.textContent = "Verbindung wird gerade hergestellt. Bitte erneut versuchen.";
    portalBootRetry.hidden = false;
  }
}

portalBootRetry.addEventListener("click", () => {
  restoreStudentSession();
});

window.addEventListener("popstate", (event) => {
  if (state.mode !== "shared") return;
  if (!confirmLeaveEdit()) { pushView("portal", { studentId: state.studentId }); return; } // Bearbeiten nicht verlassen
  const view = event.state?.view;
  if (!view || !readSharedSession()) { leaveSharedMode(); return; }
  if (view === "picker") showSharedPicker({ fromPop: true });
  else if (view === "plan") showSharedPlan({ fromPop: true });
  else if (view === "portal" && event.state.studentId) openSharedStudent(event.state.studentId, { fromPop: true });
});

setDefaultPeriod();
loadPortalStudents();
restoreStudentSession();
