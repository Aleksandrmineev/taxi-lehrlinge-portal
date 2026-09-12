const state = {
  from: "2026-09-14",
  to: "2026-09-18",
  showPast: false,
  studentId: "oliver",
  trips: {},
  token: localStorage.getItem("lehrlinge_student_token") || "",
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
const resetStudentIdField = document.getElementById("resetStudentIdField");
const resetStudentPhoneInput = document.getElementById("resetStudentPhoneInput");
const resetStudentPhoneField = document.getElementById("resetStudentPhoneField");
const resetStudentCodeInput = document.getElementById("resetStudentCodeInput");
const resetStudentPinInput = document.getElementById("resetStudentPinInput");
const resetStudentCodeField = document.getElementById("resetStudentCodeField");
const resetStudentPinField = document.getElementById("resetStudentPinField");
const resetStudentHint = document.getElementById("resetStudentHint");
const resetStudentStatus = document.getElementById("resetStudentStatus");
const showStudentIdRecovery = document.getElementById("showStudentIdRecovery");
let portalToastTimer = null;
let studentResetMode = "pin";

function showPortalToast(message, type = "success", duration = 2600) {
  if (!portalToast || !portalToastText) return;
  clearTimeout(portalToastTimer);
  portalToastText.textContent = message;
  portalToast.className = `portal-toast portal-toast--${type}`;
  portalToast.hidden = false;
  portalToastTimer = setTimeout(() => { portalToast.hidden = true; }, duration);
}

function openStudentPinReset() {
  studentResetMode = "pin";
  document.getElementById("loginForm").hidden = true;
  showResetStudentButton.hidden = true;
  studentPinResetForm.hidden = false;
  resetStudentIdInput.value = studentIdInput.value.trim().toLowerCase();
  resetStudentIdField.hidden = false;
  resetStudentIdInput.disabled = false;
  resetStudentPhoneField.hidden = true;
  resetStudentPhoneInput.disabled = true;
  resetStudentCodeInput.value = "";
  resetStudentPinInput.value = "";
  resetStudentCodeInput.disabled = true;
  resetStudentPinInput.disabled = true;
  resetStudentCodeField.hidden = true;
  resetStudentPinField.hidden = true;
  resetStudentButton.textContent = "SMS-Code anfordern";
  resetStudentStatus.textContent = "";
  resetStudentStatus.className = "reset-status";
  showStudentIdRecovery.hidden = false;
  resetStudentHint.textContent = "Zuerst SMS-Code anfordern. Danach Code und neuen PIN eingeben.";
  resetStudentIdInput.focus();
}

function openStudentIdRecovery() {
  studentResetMode = "id";
  resetStudentIdField.hidden = true;
  resetStudentIdInput.disabled = true;
  resetStudentPhoneField.hidden = false;
  resetStudentPhoneInput.disabled = false;
  resetStudentPhoneInput.value = "";
  resetStudentCodeInput.disabled = true;
  resetStudentPinInput.disabled = true;
  resetStudentCodeField.hidden = true;
  resetStudentPinField.hidden = true;
  resetStudentButton.textContent = "SMS-Code anfordern";
  resetStudentStatus.textContent = "";
  resetStudentHint.textContent = "Die SMS enthält deine Lehrling-ID und den SMS-Code.";
  showStudentIdRecovery.hidden = true;
  resetStudentPhoneInput.focus();
}

function closeStudentPinReset() {
  studentPinResetForm.hidden = true;
  document.getElementById("loginForm").hidden = false;
  showResetStudentButton.hidden = false;
  resetStudentStatus.textContent = "";
  resetStudentIdInput.disabled = false;
  resetStudentPhoneInput.disabled = true;
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
  const result = await apiGet({ fn: "student_plan", studentToken: state.token, from: state.from, to: state.to });
  scheduleData = { items: Object.fromEntries((result.items || []).map((item) => [item.date, item])) };
  state.trips = {};
  if (result.student) {
    document.getElementById("studentName").textContent = result.student.name;
    document.getElementById("studentRoute").textContent = result.student.route ? `Route ${result.student.route}` : "—";
    document.getElementById("studentAddress").textContent = result.student.address || "—";
    document.getElementById("studentTime").textContent = result.student.arrivalTime ? `Abholung ${result.student.arrivalTime}` : "";
  }
}

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
          <button class="trip-toggle ${backOpen ? (item.back ? "active" : "inactive") : "locked"}" data-date="${date}" data-direction="back" type="button" ${backOpen ? "" : "disabled"} title="${backOpen ? "Bis 12:00 änderbar" : "Änderungsfrist für die Rückfahrt abgelaufen"}">${backOpen ? (item.back ? "✓" : "×") : "🔒"} <span class="trip-label-long">Zurück</span><span class="trip-label-short">Back</span></button>
        </div>
      </div>`;
  }).join("");

  tripList.querySelectorAll("[data-date]").forEach((button) => {
    button.addEventListener("click", () => {
      const { date, direction } = button.dataset;
      ensureTrip(date)[direction] = !ensureTrip(date)[direction];
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
  if (state.token) refreshPeriod();
});
periodTo.addEventListener("change", async () => {
  state.to = periodTo.value;
  renderTrips();
  if (state.token) refreshPeriod();
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
    if (state.token) refreshPeriod();
  });
});

showResetStudentButton.addEventListener("click", openStudentPinReset);
showStudentIdRecovery.addEventListener("click", openStudentIdRecovery);
closeResetStudentButton.addEventListener("click", closeStudentPinReset);

studentPinResetForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!studentPinResetForm.reportValidity()) return;
  resetStudentButton.disabled = true;
  resetStudentButton.classList.add("is-saving");
  try {
    const requestingCode = resetStudentCodeInput.disabled;
    const action = requestingCode ? (studentResetMode === "id" ? "student_id_request" : "student_pin_request") : "student_pin_reset";
    const payload = { action };
    if (requestingCode && studentResetMode === "id") payload.phone = resetStudentPhoneInput.value.trim();
    if (studentResetMode === "pin" || !requestingCode) payload.studentId = resetStudentIdInput.value.trim().toLowerCase();
    if (!requestingCode) {
      payload.code = resetStudentCodeInput.value.trim();
      payload.pin = resetStudentPinInput.value;
    }
    const result = await apiPost(payload);
    if (action === "student_pin_request" || action === "student_id_request") {
      resetStudentCodeInput.disabled = false;
      resetStudentPinInput.disabled = false;
      resetStudentCodeField.hidden = false;
      resetStudentPinField.hidden = false;
      if (studentResetMode === "id") {
        resetStudentPhoneField.hidden = true;
        resetStudentPhoneInput.disabled = true;
        resetStudentIdField.hidden = false;
        resetStudentIdInput.disabled = false;
        resetStudentIdInput.value = "";
        resetStudentHint.textContent = "Lehrling-ID und SMS-Code aus der SMS eingeben und neuen PIN festlegen.";
      } else {
        resetStudentIdField.hidden = true;
        resetStudentIdInput.disabled = true;
        resetStudentHint.textContent = "SMS-Code eingeben und neuen PIN festlegen.";
      }
      resetStudentButton.textContent = "PIN ersetzen";
      const sentMessage = "SMS-Code wurde an " + (result.maskedPhone || "die hinterlegte Nummer") + " gesendet.";
      resetStudentStatus.textContent = sentMessage;
      resetStudentStatus.className = "reset-status is-success";
      showPortalToast(sentMessage, "success");
      if (studentResetMode === "id") resetStudentIdInput.focus();
      else resetStudentCodeInput.focus();
    } else {
      const recoveredStudentId = resetStudentIdInput.value.trim().toLowerCase();
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
  loginStatus.textContent = "Anmeldung wird geprüft…";
  try {
    await loginStudent(studentIdInput.value.trim(), pinInput.value.trim());
    await loadStudentPlan();
    loginView.hidden = true;
    portalView.hidden = false;
    renderTrips();
    loginStatus.textContent = "";
  } catch (error) {
    loginStatus.textContent = "Anmeldung fehlgeschlagen. Bitte ID und PIN prüfen.";
  }
});

document.getElementById("logoutBtn").addEventListener("click", () => {
  if (state.token) {
    apiGet({ fn: "student_logout", studentToken: state.token }).catch(() => {});
  }
  portalView.hidden = true;
  loginView.hidden = false;
  state.token = "";
  localStorage.removeItem("lehrlinge_student_token");
  studentIdInput.value = "";
  pinInput.value = "";
});

saveTrips.addEventListener("click", async () => {
  saveTrips.disabled = true;
  saveTrips.classList.add("is-saving");
  saveTrips.textContent = "Speichere…";
  saveStatus.textContent = "Speichere Änderungen…";
  try {
    await apiPost({
      action: "student_plan_save",
      studentToken: state.token,
      rows: JSON.stringify(Object.entries(state.trips).map(([date, item]) => ({ date, out: item.out, back: item.back }))),
    });
    saveStatus.textContent = "Änderungen gespeichert.";
    showPortalToast("Änderungen gespeichert", "success");
    await loadStudentPlan();
    renderTrips();
  } catch (error) {
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

restoreStudentSession();
