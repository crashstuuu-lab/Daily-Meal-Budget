const ACCESS_PASSWORD = "chifan2026";
const ACCESS_SESSION_KEY = "meal-budget-access-granted";
const STORAGE_KEY = "meal-budget-tracker-v2";
const BASE_DAILY_BUDGET = 50;
const EMPTY_STATE = { entries: [], indulgenceDays: {} };
const MAX_INDULGENCE_DAYS_PER_WEEK = 2;

const elements = {
  authGate: document.querySelector("#authGate"),
  authForm: document.querySelector("#authForm"),
  authError: document.querySelector("#authError"),
  passwordInput: document.querySelector("#passwordInput"),
  appShell: document.querySelector("#appShell"),
  todayBudget: document.querySelector("#todayBudget"),
  todaySpent: document.querySelector("#todaySpent"),
  remainingAmount: document.querySelector("#remainingAmount"),
  tomorrowBudget: document.querySelector("#tomorrowBudget"),
  weekRemaining: document.querySelector("#weekRemaining"),
  todayDateText: document.querySelector("#todayDateText"),
  syncStatus: document.querySelector("#syncStatus"),
  weekHint: document.querySelector("#weekHint"),
  indulgenceToggle: document.querySelector("#indulgenceToggle"),
  expenseForm: document.querySelector("#expenseForm"),
  calculatorPanel: document.querySelector("#calculatorPanel"),
  calculatorPreview: document.querySelector("#calculatorPreview"),
  amountInput: document.querySelector("#amountInput"),
  noteInput: document.querySelector("#noteInput"),
  todayList: document.querySelector("#todayList"),
  emptyState: document.querySelector("#emptyState"),
  clearToday: document.querySelector("#clearToday"),
  calcKeys: document.querySelectorAll(".calc-key"),
  calcPresets: document.querySelectorAll(".calc-preset"),
};

let state = loadState();

function hasAccess() {
  return sessionStorage.getItem(ACCESS_SESSION_KEY) === "yes";
}

function unlockApp() {
  sessionStorage.setItem(ACCESS_SESSION_KEY, "yes");
  document.body.classList.remove("auth-locked");
  elements.authGate.hidden = true;
  elements.appShell.hidden = false;
}

function lockApp() {
  document.body.classList.add("auth-locked");
  elements.authGate.hidden = false;
  elements.appShell.hidden = true;
}

function normalizeState(raw) {
  const indulgenceDays = raw?.indulgenceDays && typeof raw.indulgenceDays === "object" ? raw.indulgenceDays : {};
  const normalizedIndulgenceDays = Object.fromEntries(
    Object.entries(indulgenceDays).map(([weekStart, value]) => {
      if (Array.isArray(value)) {
        return [weekStart, [...new Set(value)].sort()];
      }
      if (typeof value === "string" && value) {
        return [weekStart, [value]];
      }
      return [weekStart, []];
    }),
  );

  return {
    entries: Array.isArray(raw?.entries) ? raw.entries : [],
    indulgenceDays: normalizedIndulgenceDays,
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return normalizeState(EMPTY_STATE);
    }
    return normalizeState(JSON.parse(raw));
  } catch (error) {
    console.error("Failed to load local data:", error);
    return normalizeState(EMPTY_STATE);
  }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    setStorageStatus(true);
  } catch (error) {
    console.error("Failed to save local data:", error);
    setStorageStatus(false);
    window.alert("本地保存失败，请检查浏览器是否开启了本地存储权限。");
  }
}

function setStorageStatus(saved) {
  elements.syncStatus.textContent = saved ? "本机保存" : "未保存";
  elements.syncStatus.classList.toggle("is-online", saved);
  elements.syncStatus.classList.toggle("is-offline", !saved);
}

function getTodayString() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getWeekStart(dateString) {
  const date = new Date(`${dateString}T12:00:00`);
  const day = date.getDay();
  const offset = day === 0 ? 6 : day - 1;
  date.setDate(date.getDate() - offset);
  return toDateString(date);
}

function toDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatMoney(amount) {
  return `¥${amount.toFixed(2)}`;
}

function formatClock(iso) {
  return new Date(iso).toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatTodayLabel(dateString) {
  const date = new Date(`${dateString}T12:00:00`);
  const weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${dateString} ${weekdays[date.getDay()]} · ${month}月${day}日`;
}

function getDatesOfWeek(weekStart) {
  const start = new Date(`${weekStart}T12:00:00`);
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return toDateString(date);
  });
}

function sumEntries(entries) {
  return entries.reduce((total, entry) => total + entry.amount, 0);
}

function groupEntriesByDate(entries) {
  return entries.reduce((map, entry) => {
    if (!map[entry.date]) {
      map[entry.date] = [];
    }
    map[entry.date].push(entry);
    return map;
  }, {});
}

function createEntryId() {
  if (window.crypto && "randomUUID" in window.crypto) {
    return window.crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function evaluateAmountExpression(input) {
  const expression = input.replace(/\s+/g, "");
  if (!expression) {
    return NaN;
  }

  if (!/^[\d.+\-*/()]+$/.test(expression)) {
    return NaN;
  }

  try {
    const result = Function(`"use strict"; return (${expression})`)();
    if (!Number.isFinite(result)) {
      return NaN;
    }
    return Math.round(result * 100) / 100;
  } catch (error) {
    return NaN;
  }
}

function updateCalculatorPreview() {
  const amount = evaluateAmountExpression(elements.amountInput.value);
  elements.calculatorPreview.textContent = Number.isFinite(amount) && amount >= 0
    ? formatMoney(amount)
    : "等待输入";
}

function showCalculator() {
  elements.calculatorPanel.hidden = false;
  updateCalculatorPreview();
}

function hideCalculator() {
  window.setTimeout(() => {
    const active = document.activeElement;
    const insideCalculator = active && elements.calculatorPanel.contains(active);
    const insideAmount = active === elements.amountInput;
    if (!insideCalculator && !insideAmount) {
      elements.calculatorPanel.hidden = true;
    }
  }, 120);
}

function getIndulgenceDaysOfWeek(weekStart) {
  return state.indulgenceDays[weekStart] || [];
}

function getWeekSummary(todayString) {
  const weekStart = getWeekStart(todayString);
  const weekDates = getDatesOfWeek(weekStart);
  const indulgenceDates = getIndulgenceDaysOfWeek(weekStart);
  const indulgenceSet = new Set(indulgenceDates);
  const entriesByDate = groupEntriesByDate(state.entries);

  let carryPenalty = 0;
  const dayMap = {};

  weekDates.forEach((date) => {
    const dayEntries = entriesByDate[date] || [];
    const spent = sumEntries(dayEntries);
    const isIndulgenceDay = indulgenceSet.has(date);
    const startBudget = Math.max(0, BASE_DAILY_BUDGET - carryPenalty);
    const endBudget = isIndulgenceDay ? startBudget : startBudget - spent;

    dayMap[date] = {
      date,
      spent,
      startBudget,
      endBudget,
      isIndulgenceDay,
      entries: dayEntries,
    };

    carryPenalty = isIndulgenceDay ? 0 : Math.max(0, spent - startBudget);
  });

  return { weekStart, weekDates, indulgenceDates, dayMap };
}

function render() {
  const todayString = getTodayString();
  const summary = getWeekSummary(todayString);
  const todayData = summary.dayMap[todayString];
  const todayRemaining = todayData.endBudget;
  const todayList = [...todayData.entries].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const weekRemaining = summary.weekDates
    .filter((date) => date >= todayString)
    .reduce((total, date) => {
      const day = summary.dayMap[date];
      if (day.isIndulgenceDay) {
        return total;
      }
      if (date === todayString) {
        return total + day.endBudget;
      }
      return total + day.startBudget;
    }, 0);
  const indulgenceLeft = MAX_INDULGENCE_DAYS_PER_WEEK - summary.indulgenceDates.length;

  elements.todayDateText.textContent = formatTodayLabel(todayString);
  elements.todayBudget.textContent = todayData.isIndulgenceDay ? "放纵日" : formatMoney(todayData.startBudget);
  elements.todaySpent.textContent = formatMoney(todayData.spent);
  elements.remainingAmount.textContent = todayData.isIndulgenceDay ? "不计" : formatMoney(todayRemaining);
  elements.remainingAmount.classList.toggle("danger", !todayData.isIndulgenceDay && todayRemaining < 0);
  elements.tomorrowBudget.textContent = formatMoney(Math.max(0, BASE_DAILY_BUDGET - Math.max(0, -todayRemaining)));
  elements.weekRemaining.textContent = formatMoney(weekRemaining);

  if (todayData.isIndulgenceDay) {
    elements.weekHint.textContent = `今天是本周放纵日，今天预算不计入，本周放纵日还剩 ${indulgenceLeft} 天。`;
  } else {
    elements.weekHint.textContent = `本周放纵日还剩 ${indulgenceLeft} 天。明天默认还是 ¥${BASE_DAILY_BUDGET.toFixed(0)}，只有今天超支才会扣掉明天预算。`;
  }

  elements.indulgenceToggle.textContent = todayData.isIndulgenceDay ? "取消放纵日" : "设为放纵日";
  elements.indulgenceToggle.classList.toggle("is-active", todayData.isIndulgenceDay);

  elements.todayList.innerHTML = "";

  todayList.forEach((entry) => {
    const item = document.createElement("li");
    item.className = "expense-item";
    item.innerHTML = `
      <div class="expense-meta">
        <span class="expense-note">${entry.note || "餐饮消费"}</span>
        <span class="expense-time">${formatClock(entry.createdAt)}</span>
      </div>
      <strong class="expense-amount">${formatMoney(entry.amount)}</strong>
    `;
    elements.todayList.appendChild(item);
  });

  const hasEntries = todayList.length > 0;
  elements.emptyState.hidden = hasEntries;
  elements.clearToday.hidden = !hasEntries;
}

function addExpense(amount, note) {
  const todayString = getTodayString();
  state.entries.push({
    id: createEntryId(),
    date: todayString,
    amount,
    note: note.trim(),
    createdAt: new Date().toISOString(),
  });
  saveState();
  render();
}

function toggleIndulgenceDay() {
  const todayString = getTodayString();
  const weekStart = getWeekStart(todayString);
  const currentIndulgence = getIndulgenceDaysOfWeek(weekStart);
  const hasToday = currentIndulgence.includes(todayString);

  if (!hasToday && currentIndulgence.length >= MAX_INDULGENCE_DAYS_PER_WEEK) {
    window.alert(`本周最多只能设置 ${MAX_INDULGENCE_DAYS_PER_WEEK} 天放纵日。`);
    return;
  }

  if (hasToday) {
    const next = currentIndulgence.filter((date) => date !== todayString);
    if (next.length === 0) {
      delete state.indulgenceDays[weekStart];
    } else {
      state.indulgenceDays[weekStart] = next;
    }
  } else {
    state.indulgenceDays[weekStart] = [...currentIndulgence, todayString].sort();
  }

  saveState();
  render();
}

function clearTodayEntries() {
  const todayString = getTodayString();
  const shouldClear = window.confirm("确定要清空今天的消费记录吗？");
  if (!shouldClear) return;

  state.entries = state.entries.filter((entry) => entry.date !== todayString);
  saveState();
  render();
}

elements.expenseForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const amount = evaluateAmountExpression(elements.amountInput.value);
  const note = elements.noteInput.value;

  if (!Number.isFinite(amount) || amount <= 0) {
    window.alert("请输入正确的金额或算式，例如 18.5、12+18、25*0.8。");
    return;
  }

  addExpense(amount, note);
  elements.expenseForm.reset();
  elements.calculatorPanel.hidden = true;
  updateCalculatorPreview();
  elements.amountInput.focus();
});

elements.amountInput.addEventListener("focus", showCalculator);
elements.amountInput.addEventListener("input", updateCalculatorPreview);
elements.amountInput.addEventListener("blur", hideCalculator);
elements.noteInput.addEventListener("focus", hideCalculator);

elements.calcPresets.forEach((button) => {
  button.addEventListener("click", () => {
    const amount = button.dataset.amount;
    const current = elements.amountInput.value.trim();
    elements.amountInput.value = current ? `${current}+${amount}` : amount;
    updateCalculatorPreview();
    elements.amountInput.focus();
  });
});

elements.calcKeys.forEach((button) => {
  button.addEventListener("click", () => {
    const { value, action } = button.dataset;

    if (action === "clear") {
      elements.amountInput.value = "";
    } else if (action === "backspace") {
      elements.amountInput.value = elements.amountInput.value.slice(0, -1);
    } else if (action === "apply") {
      const amount = evaluateAmountExpression(elements.amountInput.value);
      if (!Number.isFinite(amount) || amount < 0) {
        window.alert("请输入正确的金额或算式，例如 18.5、12+18、25*0.8。");
        return;
      }
      elements.amountInput.value = String(amount);
      elements.calculatorPanel.hidden = true;
      elements.noteInput.focus();
    } else if (value) {
      elements.amountInput.value += value;
    }

    updateCalculatorPreview();
    if (action !== "apply") {
      elements.amountInput.focus();
    }
  });
});

elements.indulgenceToggle.addEventListener("click", toggleIndulgenceDay);
elements.clearToday.addEventListener("click", clearTodayEntries);
elements.authForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const password = elements.passwordInput.value;

  if (password === ACCESS_PASSWORD) {
    elements.authError.hidden = true;
    elements.authForm.reset();
    unlockApp();
    return;
  }

  elements.authError.hidden = false;
  elements.passwordInput.select();
});

window.addEventListener("storage", (event) => {
  if (event.key === STORAGE_KEY) {
    state = loadState();
    render();
  }
});

setStorageStatus(true);
updateCalculatorPreview();
render();

if (hasAccess()) {
  unlockApp();
} else {
  lockApp();
  elements.passwordInput.focus();
}
