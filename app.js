"use strict";
const App = (() => {
  const STORE = "passnote.web.vault.v1",
    LAST_ACTIVE = "passnote.web.lastActive",
    TIMEOUT_PREF = "passnote.web.timeoutMinutes",
    ALLOWED_TIMEOUTS = [2, 5, 10, 15, 30],
    $ = (id) => document.getElementById(id);
  let timeoutMinutes = Number(localStorage.getItem(TIMEOUT_PREF) || 5);
  if (!ALLOWED_TIMEOUTS.includes(timeoutMinutes)) timeoutMinutes = 5;
  let state = { passwords: [], notes: [] },
    sessionPassword = "",
    currentNoteId = null,
    saveTimer,
    fileAction = null,
    authMode = null,
    pendingEntryVault = null,
    expiryTimer = null,
    lastActivityWrite = 0,
    expiryWarned = false;
  if (localStorage.getItem(STORE)) {
    sessionStorage.setItem(STORE, localStorage.getItem(STORE));
    localStorage.removeItem(STORE);
    sessionStorage.setItem(LAST_ACTIVE, String(Date.now()));
  }
  const hasVault = () => Boolean(sessionStorage.getItem(STORE));
  const uid = () =>
    crypto.randomUUID ? crypto.randomUUID() : Date.now() + "-" + Math.random();
  const safe = (value) =>
    String(value ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const timeoutMs = () => timeoutMinutes * 60 * 1000;
  function setupAuth(message = "") {
    const last = Number(sessionStorage.getItem(LAST_ACTIVE) || 0);
    if (hasVault() && last && Date.now() - last >= timeoutMs()) {
      sessionStorage.removeItem(STORE);
      sessionStorage.removeItem(LAST_ACTIVE);
      message =
        message ||
        `Your previous vault expired after ${timeoutMinutes} minutes of inactivity. Unexported data was deleted.`;
    }
    authMode = null;
    pendingEntryVault = null;
    $("authChoices").classList.remove("hidden");
    $("authForm").classList.add("hidden");
    $("resumeVault").classList.toggle("hidden", !hasVault());
    $("authForm").reset();
    $("authError").textContent = "";
    $("entryNotice").textContent = message;
    $("authTitle").textContent = "Your Temporary Web Vault";
    $("authMessage").textContent =
      "Create a new vault or open an existing encrypted iOS backup.";
  }
  function showAuthForm(mode) {
    authMode = mode;
    $("authChoices").classList.add("hidden");
    $("authForm").classList.remove("hidden");
    const create = mode === "create";
    $("confirmWrap").classList.toggle("hidden", !create);
    $("authFormTitle").textContent = create
      ? "Create New Vault"
      : mode === "import"
        ? "Open Existing Vault"
        : "Resume Current Session";
    $("authSubmit").textContent = create
      ? "Create Temporary Vault"
      : mode === "import"
        ? "Open Vault"
        : "Unlock Session";
    $("authError").textContent = "";
    $("masterPassword").focus();
  }
  async function persist() {
    if (!sessionPassword) return;
    const payload = {
      payloadVersion: 1,
      passwords: state.passwords.map(
        ({ accountName, password, createdAt }) => ({
          accountName,
          password,
          createdAt,
        }),
      ),
      notes: state.notes.map(
        ({ title, content, isTitleManuallyRenamed, createdAt, updatedAt }) => ({
          title,
          content,
          isTitleManuallyRenamed,
          createdAt,
          updatedAt,
        }),
      ),
    };
    sessionStorage.setItem(
      STORE,
      JSON.stringify(
        await PassNoteCrypto.encrypt(payload, "fullVault", sessionPassword),
      ),
    );
    touchActivity(true);
  }
  function normalize(payload) {
    return {
      passwords: (payload.passwords || []).map((x) => ({ ...x, id: uid() })),
      notes: (payload.notes || []).map((x) => ({ ...x, id: uid() })),
    };
  }
  async function authenticate(event) {
    event.preventDefault();
    const password = $("masterPassword").value,
      error = $("authError");
    error.textContent = "";
    if (!password) return (error.textContent = "Enter your master password.");
    try {
      let opened;
      if (authMode === "create") {
        if (password.length < 8) throw Error("Use at least 8 characters.");
        if (password !== $("confirmMasterPassword").value)
          throw Error("Passwords do not match.");
        state = { passwords: [], notes: [] };
        sessionPassword = password;
        await persist();
      } else if (authMode === "import") {
        if (!pendingEntryVault) throw Error("Choose a .pnvault file first.");
        opened = await PassNoteCrypto.decrypt(
          pendingEntryVault,
          password,
          "fullVault",
        );
        state = normalize(opened.payload);
        sessionPassword = password;
        await persist();
      } else {
        const last = Number(sessionStorage.getItem(LAST_ACTIVE) || 0);
        if (hasVault() && last && Date.now() - last >= timeoutMs()) {
          sessionStorage.removeItem(STORE);
          sessionStorage.removeItem(LAST_ACTIVE);
          setupAuth(
            `Your vault expired after ${timeoutMinutes} minutes of inactivity. Unexported data was deleted.`,
          );
          return;
        }
        if (!hasVault()) throw Error("This temporary session has expired.");
        opened = await PassNoteCrypto.decrypt(
          sessionStorage.getItem(STORE),
          password,
          "fullVault",
        );
        state = normalize(opened.payload);
        sessionPassword = password;
      }
      openSession();
    } catch (e) {
      error.textContent = e.message;
    }
  }
  function openSession() {
    expiryWarned = false;
    $("authView").classList.add("hidden");
    $("vaultView").classList.remove("hidden");
    $("authForm").reset();
    touchActivity(true);
    startExpiryTimer();
    route("home");
    render();
  }
  function lock(
    reason = "Session ended. Unexported temporary data was deleted.",
  ) {
    clearInterval(expiryTimer);
    sessionStorage.removeItem(STORE);
    sessionStorage.removeItem(LAST_ACTIVE);
    sessionPassword = "";
    state = { passwords: [], notes: [] };
    currentNoteId = null;
    $("vaultView").classList.add("hidden");
    $("authView").classList.remove("hidden");
    setupAuth(reason);
  }
  function privacyLock() {
    if (!sessionPassword) return;
    clearInterval(expiryTimer);
    clearTimeout(saveTimer);
    sessionPassword = "";
    state = { passwords: [], notes: [] };
    currentNoteId = null;
    $("vaultView").classList.add("hidden");
    $("authView").classList.remove("hidden");
    setupAuth(
      "Privacy Lock activated because Pass & Note went to the background. Enter your Master Password to continue.",
    );
    showAuthForm("resume");
  }
  function touchActivity(force = false) {
    if (!sessionPassword) return;
    const now = Date.now();
    if (force || now - lastActivityWrite > 1000) {
      sessionStorage.setItem(LAST_ACTIVE, String(now));
      lastActivityWrite = now;
    }
  }
  function startExpiryTimer() {
    clearInterval(expiryTimer);
    updateTimer();
    expiryTimer = setInterval(updateTimer, 1000);
  }
  function updateTimer() {
    if (!sessionPassword) return;
    const last = Number(sessionStorage.getItem(LAST_ACTIVE) || Date.now()),
      remaining = timeoutMs() - (Date.now() - last);
    if (remaining <= 0) {
      lock(
        `Your vault expired after ${timeoutMinutes} minutes of inactivity. Unexported data was deleted for your safety.`,
      );
      return;
    }
    if (remaining <= 60000 && !expiryWarned) {
      expiryWarned = true;
      toast("Vault expires in 1 minute — interact to continue or export now");
    }
    if (remaining > 60000) expiryWarned = false;
    const seconds = Math.ceil(remaining / 1000),
      el = $("sessionTimer");
    el.textContent = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
    el.classList.toggle("warning", remaining <= 60000);
  }
  function route(name) {
    const target = $(`${name}Screen`);
    if (!target) {
      console.warn(`Unknown route: ${name}`);
      return;
    }
    document
      .querySelectorAll(".screen")
      .forEach((x) => x.classList.add("hidden"));
    target.classList.remove("hidden");
    document
      .querySelectorAll("nav [data-route]")
      .forEach((x) =>
        x.classList.toggle(
          "active",
          x.dataset.route === name ||
            (name === "editor" && x.dataset.route === "notes"),
        ),
      );
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function render() {
    renderPasswords();
    renderNotes();
  }
  function renderPasswords() {
    const rows = $("passwordRows");
    rows.innerHTML = state.passwords
      .map(
        (p) =>
          `<div class="password-row" data-id="${p.id}"><span class="account">${safe(p.accountName)}</span><span class="password-value" data-secret="${safe(p.password)}">${"•".repeat(Math.min(Math.max(p.password.length, 8), 16))}</span><span class="row-actions"><button data-do="view" title="Show password">◉</button><button data-do="copy" title="Copy password">▣</button><button data-do="edit" title="Edit password">✎</button><button data-do="delete" class="delete" title="Delete password">⌫</button></span></div>`,
      )
      .join("");
    $("passwordEmpty").classList.toggle("hidden", state.passwords.length > 0);
    $("passwordTable").classList.toggle("hidden", !state.passwords.length);
  }
  function renderNotes() {
    $("noteList").innerHTML = state.notes
      .map(
        (n) =>
          `<button class="note-card" data-id="${n.id}"><h3>${safe(n.title || titleFrom(n.content))}</h3><p>${safe(n.content || "Empty note")}</p><small>Updated ${new Date(n.updatedAt).toLocaleString()}</small><span class="note-menu"><button data-delete="${n.id}" title="Delete note">⌫</button></span></button>`,
      )
      .join("");
    $("noteEmpty").classList.toggle("hidden", state.notes.length > 0);
  }
  function titleFrom(content) {
    return (
      content.trim().split(/\r?\n/)[0].trim().slice(0, 60) || "Untitled Note"
    );
  }
  function modal(html) {
    $("modalContent").innerHTML = html;
    $("modalLayer").classList.remove("hidden");
  }
  function closeModal() {
    $("modalLayer").classList.add("hidden");
    $("modalContent").innerHTML = "";
  }
  function toast(message) {
    const el = $("toast");
    el.textContent = message;
    el.classList.add("show");
    setTimeout(() => el.classList.remove("show"), 1800);
  }
  function passwordForm(existing) {
    modal(
      `<h2>${existing ? "Update Password" : "Add Password"}</h2><p>Store an account name and password securely.</p><form id="entryForm"><label>Account Name</label><input id="accountInput" value="${safe(existing?.accountName || "")}" required><label>Password</label><input id="passwordInput" type="password" value="${safe(existing?.password || "")}" required><div class="modal-actions"><button type="button" class="secondary-button" id="cancelEntry">Cancel</button><button class="primary-button">${existing ? "Save Changes" : "Save Password"}</button></div></form>`,
    );
    $("cancelEntry").onclick = closeModal;
    $("entryForm").onsubmit = async (e) => {
      e.preventDefault();
      const accountName = $("accountInput").value.trim(),
        password = $("passwordInput").value;
      if (existing) {
        existing.accountName = accountName;
        existing.password = password;
      } else
        state.passwords.unshift({
          id: uid(),
          accountName,
          password,
          createdAt: PassNoteCrypto.iosDate(),
        });
      await persist();
      renderPasswords();
      closeModal();
      toast(existing ? "Password updated" : "Password saved");
    };
  }
  function openNote(id) {
    const note = state.notes.find((x) => x.id === id);
    if (!note) return;
    currentNoteId = id;
    $("noteEditor").value = note.content;
    $("editorTitle").textContent = note.title || titleFrom(note.content);
    route("editor");
  }
  async function saveNote() {
    const note = state.notes.find((x) => x.id === currentNoteId);
    if (!note) return;
    note.content = $("noteEditor").value;
    if (!note.isTitleManuallyRenamed) note.title = titleFrom(note.content);
    note.updatedAt = PassNoteCrypto.iosDate();
    $("editorTitle").textContent = note.title;
    await persist();
    renderNotes();
    $("saveStatus").textContent = "Saved";
  }
  function confirmPassword(title, message, onValid) {
    modal(
      `<h2>${title}</h2><p>${message}</p><form id="confirmForm"><label>Master Password</label><input id="modalPassword" type="password" required autofocus><p id="modalError" class="error-text"></p><div class="modal-actions"><button type="button" class="secondary-button" id="cancelConfirm">Cancel</button><button class="primary-button">Continue</button></div></form>`,
    );
    $("cancelConfirm").onclick = closeModal;
    $("confirmForm").onsubmit = async (e) => {
      e.preventDefault();
      try {
        await PassNoteCrypto.decrypt(
          sessionStorage.getItem(STORE),
          $("modalPassword").value,
          "fullVault",
        );
        await onValid($("modalPassword").value);
        closeModal();
      } catch (err) {
        $("modalError").textContent = err.message;
      }
    };
  }
  function payload(type, items) {
    if (type === "passwords")
      return { payloadVersion: 1, passwords: items || state.passwords };
    if (type === "notes")
      return { payloadVersion: 1, notes: items || state.notes };
    return {
      payloadVersion: 1,
      passwords: state.passwords,
      notes: state.notes,
    };
  }
  function cleanPayload(type, items) {
    const p = payload(type, items);
    if (p.passwords)
      p.passwords = p.passwords.map(({ accountName, password, createdAt }) => ({
        accountName,
        password,
        createdAt,
      }));
    if (p.notes)
      p.notes = p.notes.map(
        ({ title, content, isTitleManuallyRenamed, createdAt, updatedAt }) => ({
          title,
          content,
          isTitleManuallyRenamed,
          createdAt,
          updatedAt,
        }),
      );
    return p;
  }
  function exportData(type, items) {
    confirmPassword(
      "Confirm Master Password",
      "Enter your Master Password to export this data.",
      async (password) => {
        const data = await PassNoteCrypto.encrypt(
            cleanPayload(type, items),
            type,
            password,
          ),
          stamp = new Date().toISOString().slice(0, 10),
          count = PassNoteCrypto.count(type, data),
          names = {
            passwords: `PassNote_Passwords_${stamp}.pnpass`,
            notes: `PassNote_Notes_${(items || state.notes).length}_${stamp}.pnnote`,
            fullVault: `PassAndNote_Backup_${stamp}.pnvault`,
          };
        download(JSON.stringify(data), names[type]);
        toast("Encrypted export created");
      },
    );
  }
  function download(value, name, type = "application/octet-stream") {
    const url = URL.createObjectURL(new Blob([value], { type })),
      a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function askImport(expected) {
    fileAction = { expected };
    $("filePicker").value = "";
    $("filePicker").click();
  }
  async function fileChosen(file) {
    if (!file || file.size > 25 * 1024 * 1024)
      return toast("Choose a file smaller than 25 MB");
    const text = await file.text();
    modal(
      `<h2>Backup Password</h2><p>Enter the Master Password used when this backup was created.</p><form id="importForm"><label>Backup Password</label><input id="importPassword" type="password" required><p id="importError" class="error-text"></p><div class="modal-actions"><button type="button" class="secondary-button" id="cancelImport">Cancel</button><button class="primary-button">Decipher</button></div></form>`,
    );
    $("cancelImport").onclick = closeModal;
    $("importForm").onsubmit = async (e) => {
      e.preventDefault();
      try {
        const opened = await PassNoteCrypto.decrypt(
            text,
            $("importPassword").value,
            fileAction.expected,
          ),
          incoming = normalize(opened.payload);
        showImportPreview(incoming, opened.container.contentType);
      } catch (err) {
        $("importError").textContent = err.message;
      }
    };
  }
  function showImportPreview(incoming, type) {
    const passwordItems = incoming.passwords
        .map(
          (p) =>
            `<div class="preview-item"><strong>${safe(p.accountName)}</strong><span>${safe(p.password)}</span></div>`,
        )
        .join(""),
      noteItems = incoming.notes
        .map(
          (n) =>
            `<div class="preview-item"><strong>${safe(n.title)}</strong><span>${safe(n.content)}</span></div>`,
        )
        .join("");
    modal(
      `<h2>Import Preview</h2><p>Review the deciphered values before adding them to your vault.</p><div class="preview-list">${passwordItems}${noteItems}</div><div class="modal-actions"><button class="secondary-button" id="cancelPreview">Cancel</button><button class="primary-button" id="acceptImport">Import ${incoming.passwords.length + incoming.notes.length} Items</button></div>`,
    );
    $("cancelPreview").onclick = closeModal;
    $("acceptImport").onclick = async () => {
      state.passwords.unshift(...incoming.passwords);
      state.notes.unshift(...incoming.notes);
      await persist();
      render();
      closeModal();
      route(
        type === "notes"
          ? "notes"
          : type === "passwords"
            ? "passwords"
            : "home",
      );
      toast("Vault data imported successfully");
    };
  }
  function noteExportChoices(note) {
    modal(
      `<h2>Export Note</h2><p>Choose an export format for this note.</p><div class="choice-list"><button class="choice" id="encryptedNote"><strong>Export Encrypted (.pnnote)</strong><small>Protected by your master password.</small></button><button class="choice" id="textNote"><strong>Export Unencrypted (.txt)</strong><small>Readable text with no encryption.</small></button></div>`,
    );
    $("encryptedNote").onclick = () => exportData("notes", [note]);
    $("textNote").onclick = () =>
      confirmPassword(
        "Unencrypted Export",
        "This creates a readable file. Anyone with access can read it.",
        async () => {
          download(
            note.content,
            `${note.title.replace(/[/\\?%*|"<>:]/g, "-")}_${new Date().toISOString().slice(0, 10)}.txt`,
            "text/plain",
          );
          toast("Text note exported");
        },
      );
  }
  function renderTimeoutSetting() {
    const select = $("sessionTimeout");
    if (select) select.value = String(timeoutMinutes);
    $("entryTimeoutText").textContent =
      `${timeoutMinutes} minute${timeoutMinutes === 1 ? "" : "s"}`;
    const guidance = $("timeoutGuidance");
    if (guidance) {
      const label =
        timeoutMinutes === 2
          ? "Safest"
          : timeoutMinutes === 5
            ? "Default"
            : "Extended";
      guidance.querySelector("strong").textContent =
        `${timeoutMinutes}-minute session · ${label}`;
      guidance.querySelector("p").textContent =
        timeoutMinutes === 2
          ? "Best for shared devices. The countdown resets whenever you interact with the vault."
          : timeoutMinutes <= 5
            ? "A balanced timeout. The countdown resets whenever you interact with the vault."
            : "More convenient, but unlocked data remains available longer on an unattended device.";
    }
  }
  function bind() {
    $("authForm").onsubmit = authenticate;
    $("lockButton").onclick = lock;
    document
      .querySelectorAll("[data-route]")
      .forEach((x) => (x.onclick = () => route(x.dataset.route)));
    document.querySelectorAll("[data-eye]").forEach(
      (x) =>
        (x.onclick = () => {
          const input = $(x.dataset.eye);
          input.type = input.type === "password" ? "text" : "password";
        }),
    );
    $("closeModal").onclick = closeModal;
    $("modalLayer").onclick = (e) => {
      if (e.target === $("modalLayer")) closeModal();
    };
    $("addPassword").onclick = () => passwordForm();
    $("passwordRows").onclick = async (e) => {
      const action = e.target.dataset.do,
        row = e.target.closest(".password-row");
      if (!action || !row) return;
      const item = state.passwords.find((x) => x.id === row.dataset.id);
      if (action === "view") {
        const value = row.querySelector(".password-value");
        value.textContent = value.dataset.visible
          ? "•".repeat(Math.min(Math.max(item.password.length, 8), 16))
          : item.password;
        value.dataset.visible = value.dataset.visible ? "" : "yes";
      }
      if (action === "copy") {
        await navigator.clipboard.writeText(item.password);
        toast("Password copied");
      }
      if (action === "edit") passwordForm(item);
      if (
        action === "delete" &&
        confirm(`Delete the password for ${item.accountName}?`)
      ) {
        state.passwords = state.passwords.filter((x) => x.id !== item.id);
        await persist();
        renderPasswords();
      }
    };
    $("addNote").onclick = async () => {
      const now = PassNoteCrypto.iosDate(),
        note = {
          id: uid(),
          title: "Untitled Note",
          content: "",
          isTitleManuallyRenamed: false,
          createdAt: now,
          updatedAt: now,
        };
      state.notes.unshift(note);
      await persist();
      renderNotes();
      openNote(note.id);
    };
    $("noteList").onclick = async (e) => {
      const deleteId = e.target.dataset.delete;
      if (deleteId) {
        e.stopPropagation();
        if (confirm("Delete this note?")) {
          state.notes = state.notes.filter((x) => x.id !== deleteId);
          await persist();
          renderNotes();
        }
        return;
      }
      const card = e.target.closest(".note-card");
      if (card) openNote(card.dataset.id);
    };
    $("noteEditor").oninput = () => {
      $("saveStatus").textContent = "Saving…";
      clearTimeout(saveTimer);
      saveTimer = setTimeout(saveNote, 700);
    };
    $("deleteCurrentNote").onclick = async () => {
      if (confirm("Delete this note?")) {
        state.notes = state.notes.filter((x) => x.id !== currentNoteId);
        await persist();
        renderNotes();
        route("notes");
      }
    };
    $("exportCurrentNote").onclick = () =>
      noteExportChoices(state.notes.find((x) => x.id === currentNoteId));
    $("exportPasswords").onclick = () => exportData("passwords");
    $("exportNotes").onclick = () => exportData("notes");
    $("exportVaultButton").onclick = () => exportData("fullVault");
    $("importVaultButton").onclick = () => askImport("fullVault");
    $("importPasswords").onclick = () => askImport("passwords");
    $("importNotes").onclick = () => askImport("notes");
    $("filePicker").onchange = (e) => fileChosen(e.target.files[0]);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && currentNoteId) saveNote();
    });
  }
  function bindTemporarySession() {
    $("lockButton").onclick = () => {
      if (
        confirm(
          "End this temporary session? Any changes not exported as a .pnvault file will be permanently deleted.",
        )
      )
        lock();
    };
    $("createVault").onclick = () => showAuthForm("create");
    $("resumeVault").onclick = () => showAuthForm("resume");
    $("backToChoices").onclick = () => setupAuth();
    $("openVault").onclick = () => {
      $("entryVaultPicker").value = "";
      $("entryVaultPicker").click();
    };
    $("entryVaultPicker").onchange = async (event) => {
      const file = event.target.files[0];
      if (!file) return;
      if (file.size > 25 * 1024 * 1024) {
        setupAuth("Choose a .pnvault file smaller than 25 MB.");
        return;
      }
      try {
        pendingEntryVault = await file.text();
        const box = JSON.parse(pendingEntryVault);
        if (box.magic !== "PASSNOTE" || box.contentType !== "fullVault")
          throw Error();
        showAuthForm("import");
        $("authFormTitle").textContent = `Open ${file.name}`;
      } catch {
        setupAuth("That is not a valid .pnvault file.");
      }
    };
    $("sessionTimeout").onchange = (event) => {
      const selected = Number(event.target.value);
      if (!ALLOWED_TIMEOUTS.includes(selected)) return;
      timeoutMinutes = selected;
      localStorage.setItem(TIMEOUT_PREF, String(selected));
      touchActivity(true);
      expiryWarned = false;
      renderTimeoutSetting();
      updateTimer();
      toast(`Session timeout changed to ${selected} minutes`);
    };
    ["pointerdown", "keydown", "touchstart", "scroll"].forEach((name) =>
      document.addEventListener(name, () => touchActivity(), { passive: true }),
    );
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && sessionPassword) privacyLock();
    });
  }
  setupAuth();
  bind();
  bindTemporarySession();
  renderTimeoutSetting();
  return {};
})();
