const form = document.querySelector("#todo-form");
const input = document.querySelector("#todo-input");
const prioritySelect = document.querySelector("#priority-select");
const dueDateInput = document.querySelector("#due-date-input");
const list = document.querySelector("#todo-list");
const emptyState = document.querySelector("#empty-state");
const activeCount = document.querySelector("#active-count");
const completedCount = document.querySelector("#completed-count");
const clearCompletedButton = document.querySelector("#clear-completed");
const clearAllButton = document.querySelector("#clear-all");
const filterButtons = document.querySelectorAll(".filter-tab");
const searchInput = document.querySelector("#search-input");
const sortSelect = document.querySelector("#sort-select");
const planSummary = document.querySelector("#plan-summary");

const STORAGE_KEY = "fresh-blue-todos";
const DEFAULT_PRIORITY = "medium";
const ENTER_ANIMATION_MS = 260;
const REMOVE_ANIMATION_MS = 260;
const PRIORITIES = {
  high: "高",
  medium: "中",
  low: "低"
};
const PRIORITY_EMOJIS = {
  high: "🔥",
  medium: "⭐",
  low: "🌱"
};
const PRIORITY_RANK = {
  high: 0,
  medium: 1,
  low: 2
};

let todos = loadTodos();
let editingId = null;
let enteringId = null;
let currentFilter = "all";
let currentSearch = "";
let currentSort = "smart";
const removingIds = new Set();

function loadTodos() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    const parsedTodos = saved ? JSON.parse(saved) : [];

    if (!Array.isArray(parsedTodos)) {
      return [];
    }

    return parsedTodos
      .filter((todo) => todo && typeof todo.text === "string")
      .map((todo) => {
        const createdAt = typeof todo.createdAt === "number" ? todo.createdAt : Date.now();

        return {
          id: todo.id || createId(),
          text: todo.text,
          completed: Boolean(todo.completed),
          priority: normalizePriority(todo.priority),
          dueDate: normalizeDueDate(todo.dueDate),
          createdAt,
          updatedAt: typeof todo.updatedAt === "number" ? todo.updatedAt : createdAt
        };
      });
  } catch {
    return [];
  }
}

function saveTodos() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
}

function createId() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizePriority(priority) {
  return Object.prototype.hasOwnProperty.call(PRIORITIES, priority) ? priority : DEFAULT_PRIORITY;
}

function normalizeDueDate(dueDate) {
  return typeof dueDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dueDate) ? dueDate : "";
}

function getTodayKey() {
  const today = new Date();
  today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
  return today.toISOString().slice(0, 10);
}

function getDayDiff(dateKey) {
  if (!dateKey) {
    return null;
  }

  const target = new Date(`${dateKey}T00:00:00`);
  const today = new Date(`${getTodayKey()}T00:00:00`);
  return Math.round((target - today) / 86400000);
}

function getDueState(todo) {
  if (!todo.dueDate) {
    return "none";
  }

  const diff = getDayDiff(todo.dueDate);

  if (!todo.completed && diff < 0) {
    return "overdue";
  }

  if (!todo.completed && diff === 0) {
    return "today";
  }

  return "scheduled";
}

function formatDueDate(todo) {
  if (!todo.dueDate) {
    return "";
  }

  const diff = getDayDiff(todo.dueDate);

  if (diff < 0 && !todo.completed) {
    return `⚠️ 逾期 ${Math.abs(diff)} 天`;
  }

  if (diff === 0) {
    return "📅 今天";
  }

  if (diff === 1) {
    return "📅 明天";
  }

  if (diff > 1 && diff <= 7) {
    return `📅 ${diff} 天后`;
  }

  return `📅 ${todo.dueDate.slice(5)}`;
}

function createPriorityOption(value, selectedValue) {
  const option = document.createElement("option");
  option.value = value;
  option.textContent = `${PRIORITY_EMOJIS[value]} ${PRIORITIES[value]}优先级`;
  option.selected = value === selectedValue;
  return option;
}

function createPrioritySelect(className, selectedValue) {
  const select = document.createElement("select");
  select.className = className;
  select.setAttribute("aria-label", "任务优先级");

  Object.keys(PRIORITIES).forEach((priority) => {
    select.append(createPriorityOption(priority, selectedValue));
  });

  return select;
}

function createDueDateInput(className, selectedValue) {
  const dateInput = document.createElement("input");
  dateInput.className = className;
  dateInput.type = "date";
  dateInput.value = normalizeDueDate(selectedValue);
  dateInput.setAttribute("aria-label", "截止日期");
  return dateInput;
}

function createTodo(text, priority, dueDate) {
  const now = Date.now();

  return {
    id: createId(),
    text,
    completed: false,
    priority: normalizePriority(priority),
    dueDate: normalizeDueDate(dueDate),
    createdAt: now,
    updatedAt: now
  };
}

function addTodo(text) {
  const trimmedText = text.trim();

  if (!trimmedText) {
    input.focus();
    return;
  }

  const todo = createTodo(trimmedText, prioritySelect.value, dueDateInput.value);
  todos.unshift(todo);
  enteringId = todo.id;
  input.value = "";
  prioritySelect.value = DEFAULT_PRIORITY;
  dueDateInput.value = "";
  saveTodos();
  renderTodos();
}

function toggleTodo(id) {
  todos = todos.map((todo) =>
    todo.id === id
      ? { ...todo, completed: !todo.completed, updatedAt: Date.now() }
      : todo
  );
  saveTodos();
  renderTodos();
}

function deleteTodo(id) {
  if (removingIds.has(id)) {
    return;
  }

  const item = list.querySelector(`[data-todo-id="${id}"]`);

  if (!item || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    completeDeleteTodo(id);
    return;
  }

  removingIds.add(id);
  item.classList.add("removing");
  window.setTimeout(() => {
    if (removingIds.has(id)) {
      completeDeleteTodo(id);
    }
  }, REMOVE_ANIMATION_MS + 80);

  item.addEventListener("animationend", () => completeDeleteTodo(id), { once: true });
}

function completeDeleteTodo(id) {
  todos = todos.filter((todo) => todo.id !== id);
  editingId = editingId === id ? null : editingId;
  removingIds.delete(id);
  saveTodos();
  renderTodos();
}

function clearCompletedTodos() {
  todos = todos.filter((todo) => !todo.completed);
  editingId = todos.some((todo) => todo.id === editingId) ? editingId : null;
  saveTodos();
  renderTodos();
}

function clearAllTodos() {
  if (todos.length === 0) {
    return;
  }

  const confirmed = window.confirm("⚠️ 确定要清空所有计划吗？此操作无法撤销。");

  if (!confirmed) {
    return;
  }

  todos = [];
  editingId = null;
  saveTodos();
  renderTodos();
}

function startEditing(id) {
  editingId = id;
  renderTodos();
}

function cancelEditing() {
  editingId = null;
  renderTodos();
}

function updateTodo(id, text, priority, dueDate) {
  const trimmedText = text.trim();

  if (!trimmedText) {
    return;
  }

  todos = todos.map((todo) =>
    todo.id === id
      ? {
          ...todo,
          text: trimmedText,
          priority: normalizePriority(priority),
          dueDate: normalizeDueDate(dueDate),
          updatedAt: Date.now()
        }
      : todo
  );
  editingId = null;
  saveTodos();
  renderTodos();
}

function matchesFilter(todo) {
  if (currentFilter === "active") {
    return !todo.completed;
  }

  if (currentFilter === "today") {
    return !todo.completed && todo.dueDate === getTodayKey();
  }

  if (currentFilter === "completed") {
    return todo.completed;
  }

  return true;
}

function matchesSearch(todo) {
  if (!currentSearch) {
    return true;
  }

  const haystack = [
    todo.text,
    PRIORITIES[normalizePriority(todo.priority)],
    formatDueDate(todo)
  ].join(" ").toLowerCase();

  return haystack.includes(currentSearch);
}

function getVisibleTodos() {
  return [...todos]
    .filter((todo) => matchesFilter(todo) && matchesSearch(todo))
    .sort(compareTodos);
}

function compareTodos(a, b) {
  if (currentSort === "newest") {
    return b.createdAt - a.createdAt;
  }

  if (currentSort === "priority") {
    return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || b.createdAt - a.createdAt;
  }

  if (currentSort === "due") {
    return compareDueDate(a, b) || PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || b.createdAt - a.createdAt;
  }

  return compareSmart(a, b);
}

function compareSmart(a, b) {
  if (a.completed !== b.completed) {
    return Number(a.completed) - Number(b.completed);
  }

  return compareDueDate(a, b) || PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || b.createdAt - a.createdAt;
}

function compareDueDate(a, b) {
  const aDue = a.dueDate || "9999-12-31";
  const bDue = b.dueDate || "9999-12-31";
  return aDue.localeCompare(bDue);
}

function renderTodos() {
  list.innerHTML = "";

  const visibleTodos = getVisibleTodos();

  visibleTodos.forEach((todo) => {
    const priority = normalizePriority(todo.priority);
    const dueState = getDueState(todo);
    const isEditing = todo.id === editingId;
    const item = document.createElement("li");
    item.className = `todo-item priority-${priority} due-${dueState}${todo.completed ? " completed" : ""}${isEditing ? " editing" : ""}`;
    item.dataset.todoId = todo.id;

    if (todo.id === enteringId) {
      item.classList.add("entering");
      window.setTimeout(() => {
        if (enteringId === todo.id) {
          enteringId = null;
        }
      }, ENTER_ANIMATION_MS);
    }

    const checkbox = document.createElement("input");
    checkbox.className = "todo-checkbox";
    checkbox.type = "checkbox";
    checkbox.checked = todo.completed;
    checkbox.disabled = isEditing;
    checkbox.setAttribute("aria-label", `标记计划：${todo.text}`);
    checkbox.addEventListener("change", () => toggleTodo(todo.id));

    if (isEditing) {
      const editForm = document.createElement("form");
      editForm.className = "edit-form";

      const editInput = document.createElement("input");
      editInput.className = "edit-input";
      editInput.type = "text";
      editInput.value = todo.text;
      editInput.maxLength = 120;
      editInput.setAttribute("aria-label", "编辑计划内容");

      const editPrioritySelect = createPrioritySelect("edit-priority-select", priority);
      const editDueDateInput = createDueDateInput("edit-due-date-input", todo.dueDate);

      const editActions = document.createElement("div");
      editActions.className = "edit-actions";

      const saveButton = document.createElement("button");
      saveButton.className = "save-button";
      saveButton.type = "submit";
      saveButton.textContent = "💾 保存";

      const cancelButton = document.createElement("button");
      cancelButton.className = "cancel-button";
      cancelButton.type = "button";
      cancelButton.textContent = "↩ 取消";
      cancelButton.addEventListener("click", cancelEditing);

      editActions.append(saveButton, cancelButton);
      editForm.append(editInput, editPrioritySelect, editDueDateInput, editActions);
      editForm.addEventListener("submit", (event) => {
        event.preventDefault();
        updateTodo(todo.id, editInput.value, editPrioritySelect.value, editDueDateInput.value);
      });

      item.append(checkbox, editForm);
      list.append(item);
      requestAnimationFrame(() => editInput.focus());
      return;
    }

    const content = document.createElement("div");
    content.className = "todo-content";

    const text = document.createElement("span");
    text.className = "todo-text";
    text.textContent = todo.text;

    const meta = document.createElement("div");
    meta.className = "todo-meta";

    const priorityBadge = document.createElement("span");
    priorityBadge.className = `priority-badge priority-${priority}`;
    priorityBadge.textContent = `${PRIORITY_EMOJIS[priority]} ${PRIORITIES[priority]}优先级`;
    meta.append(priorityBadge);

    if (todo.dueDate) {
      const dueBadge = document.createElement("span");
      dueBadge.className = `due-badge ${dueState}`;
      dueBadge.textContent = formatDueDate(todo);
      meta.append(dueBadge);
    }

    const actions = document.createElement("div");
    actions.className = "item-actions";

    const editButton = document.createElement("button");
    editButton.className = "edit-button";
    editButton.type = "button";
    editButton.textContent = "✏️ 编辑";
    editButton.setAttribute("aria-label", `编辑计划：${todo.text}`);
    editButton.addEventListener("click", () => startEditing(todo.id));

    const deleteButton = document.createElement("button");
    deleteButton.className = "delete-button";
    deleteButton.type = "button";
    deleteButton.textContent = "🗑 删除";
    deleteButton.setAttribute("aria-label", `删除计划：${todo.text}`);
    deleteButton.addEventListener("click", () => deleteTodo(todo.id));

    content.append(text, meta);
    actions.append(editButton, deleteButton);
    item.append(checkbox, content, actions);
    list.append(item);
  });

  updateCounts(visibleTodos.length);
  updateEmptyState(visibleTodos.length);
}

function updateCounts(visibleCount) {
  const today = getTodayKey();
  const completed = todos.filter((todo) => todo.completed).length;
  const active = todos.length - completed;
  const todayCount = todos.filter((todo) => !todo.completed && todo.dueDate === today).length;
  const overdueCount = todos.filter((todo) => getDueState(todo) === "overdue").length;

  activeCount.textContent = active;
  completedCount.textContent = completed;
  planSummary.textContent = `今日 ${todayCount} · 逾期 ${overdueCount} · 进行中 ${active}`;
  clearCompletedButton.disabled = completed === 0;
  clearAllButton.disabled = todos.length === 0;
  list.setAttribute("aria-label", `计划列表，当前显示 ${visibleCount} 条`);
}

function updateEmptyState(visibleCount) {
  const isHidden = visibleCount > 0;
  emptyState.classList.toggle("hidden", isHidden);

  if (isHidden) {
    return;
  }

  if (todos.length === 0) {
    emptyState.textContent = "✨ 暂无计划。先写下一个今天可以推进的小目标。";
    return;
  }

  if (currentSearch) {
    emptyState.textContent = "🔎 没有找到匹配的计划，换个关键词试试。";
    return;
  }

  const messages = {
    all: "🗂 当前没有可显示的计划。",
    active: "✅ 没有进行中的计划，状态不错。",
    today: "🌤 今天没有截止计划，可以从容安排。",
    completed: "⏳ 还没有完成记录，完成一项后会出现在这里。"
  };
  emptyState.textContent = messages[currentFilter];
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  addTodo(input.value);
});

filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    currentFilter = button.dataset.filter;
    filterButtons.forEach((filterButton) => {
      const isActive = filterButton === button;
      filterButton.classList.toggle("active", isActive);
      filterButton.setAttribute("aria-pressed", String(isActive));
    });
    renderTodos();
  });
});

searchInput.addEventListener("input", () => {
  currentSearch = searchInput.value.trim().toLowerCase();
  renderTodos();
});

sortSelect.addEventListener("change", () => {
  currentSort = sortSelect.value;
  renderTodos();
});

clearCompletedButton.addEventListener("click", clearCompletedTodos);
clearAllButton.addEventListener("click", clearAllTodos);

renderTodos();
