const form = document.querySelector("#todo-form");
const input = document.querySelector("#todo-input");
const prioritySelect = document.querySelector("#priority-select");
const list = document.querySelector("#todo-list");
const emptyState = document.querySelector("#empty-state");
const activeCount = document.querySelector("#active-count");
const completedCount = document.querySelector("#completed-count");
const clearCompletedButton = document.querySelector("#clear-completed");
const clearAllButton = document.querySelector("#clear-all");

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

let todos = loadTodos();
let editingId = null;
let enteringId = null;
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
      .map((todo) => ({
        id: todo.id || createId(),
        text: todo.text,
        completed: Boolean(todo.completed),
        priority: normalizePriority(todo.priority)
      }));
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

function createTodo(text, priority) {
  return {
    id: createId(),
    text,
    completed: false,
    priority: normalizePriority(priority)
  };
}

function addTodo(text) {
  const trimmedText = text.trim();

  if (!trimmedText) {
    input.focus();
    return;
  }

  const todo = createTodo(trimmedText, prioritySelect.value);
  todos.unshift(todo);
  enteringId = todo.id;
  input.value = "";
  prioritySelect.value = DEFAULT_PRIORITY;
  saveTodos();
  renderTodos();
}

function toggleTodo(id) {
  todos = todos.map((todo) =>
    todo.id === id ? { ...todo, completed: !todo.completed } : todo
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

  const confirmed = window.confirm("⚠️ 确定要清空所有任务吗？此操作无法撤销。");

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

function updateTodo(id, text, priority) {
  const trimmedText = text.trim();

  if (!trimmedText) {
    return;
  }

  todos = todos.map((todo) =>
    todo.id === id
      ? { ...todo, text: trimmedText, priority: normalizePriority(priority) }
      : todo
  );
  editingId = null;
  saveTodos();
  renderTodos();
}

function renderTodos() {
  list.innerHTML = "";

  todos.forEach((todo) => {
    const priority = normalizePriority(todo.priority);
    const isEditing = todo.id === editingId;
    const item = document.createElement("li");
    item.className = `todo-item priority-${priority}${todo.completed ? " completed" : ""}${isEditing ? " editing" : ""}`;
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
    checkbox.setAttribute("aria-label", `标记任务：${todo.text}`);
    checkbox.addEventListener("change", () => toggleTodo(todo.id));

    if (isEditing) {
      const editForm = document.createElement("form");
      editForm.className = "edit-form";

      const editInput = document.createElement("input");
      editInput.className = "edit-input";
      editInput.type = "text";
      editInput.value = todo.text;
      editInput.maxLength = 80;
      editInput.setAttribute("aria-label", "编辑任务内容");

      const editPrioritySelect = createPrioritySelect("edit-priority-select", priority);

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
      editForm.append(editInput, editPrioritySelect, editActions);
      editForm.addEventListener("submit", (event) => {
        event.preventDefault();
        updateTodo(todo.id, editInput.value, editPrioritySelect.value);
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

    const priorityBadge = document.createElement("span");
    priorityBadge.className = `priority-badge priority-${priority}`;
    priorityBadge.textContent = `${PRIORITY_EMOJIS[priority]} ${PRIORITIES[priority]}优先级`;

    const actions = document.createElement("div");
    actions.className = "item-actions";

    const editButton = document.createElement("button");
    editButton.className = "edit-button";
    editButton.type = "button";
    editButton.textContent = "✏️ 编辑";
    editButton.setAttribute("aria-label", `编辑任务：${todo.text}`);
    editButton.addEventListener("click", () => startEditing(todo.id));

    const deleteButton = document.createElement("button");
    deleteButton.className = "delete-button";
    deleteButton.type = "button";
    deleteButton.textContent = "🗑 删除";
    deleteButton.setAttribute("aria-label", `删除任务：${todo.text}`);
    deleteButton.addEventListener("click", () => deleteTodo(todo.id));

    content.append(text, priorityBadge);
    actions.append(editButton, deleteButton);
    item.append(checkbox, content, actions);
    list.append(item);
  });

  updateCounts();
  emptyState.classList.toggle("hidden", todos.length > 0);
}

function updateCounts() {
  const completed = todos.filter((todo) => todo.completed).length;
  const active = todos.length - completed;

  activeCount.textContent = active;
  completedCount.textContent = completed;
  clearCompletedButton.disabled = completed === 0;
  clearAllButton.disabled = todos.length === 0;
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  addTodo(input.value);
});

clearCompletedButton.addEventListener("click", clearCompletedTodos);
clearAllButton.addEventListener("click", clearAllTodos);

renderTodos();
