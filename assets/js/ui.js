/* Shared small UI helpers: toasts, mobile nav toggles, score ring rendering */

function ensureToastContainer() {
  let el = document.getElementById("toast-container");
  if (!el) {
    el = document.createElement("div");
    el.id = "toast-container";
    document.body.appendChild(el);
  }
  return el;
}

function showToast(message, type = "success") {
  const container = ensureToastContainer();
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

function toggleNavbar() {
  const nav = document.querySelector(".navbar nav");
  if (nav) nav.classList.toggle("open");
}

function toggleSidebar() {
  const sb = document.querySelector(".sidebar");
  if (sb) sb.classList.toggle("open");
}

function scoreColor(score) {
  if (score >= 80) return "#00ffb3";
  if (score >= 55) return "#ffb020";
  return "#ff4d6d";
}

function renderScoreRing(canvasSelector, score) {
  const el = document.querySelector(canvasSelector);
  if (!el) return;
  const color = scoreColor(score);
  const circumference = 2 * Math.PI * 60;
  const offset = circumference - (score / 100) * circumference;
  el.innerHTML = `
    <svg width="160" height="160" viewBox="0 0 160 160">
      <circle cx="80" cy="80" r="60" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="12"/>
      <circle cx="80" cy="80" r="60" fill="none" stroke="${color}" stroke-width="12"
        stroke-linecap="round" stroke-dasharray="${circumference}" stroke-dashoffset="${offset}"
        transform="rotate(-90 80 80)" style="filter:drop-shadow(0 0 8px ${color}); transition: stroke-dashoffset 1s ease;"/>
    </svg>
    <div class="score-ring-value">
      <div class="num" style="color:${color}">${score}</div>
      <div class="lbl">Authenticity</div>
    </div>`;
}

function statusBadge(status) {
  const map = {
    verified: "badge-verified", rejected: "badge-rejected",
    pending: "badge-pending", processing: "badge-processing",
  };
  return `<span class="badge ${map[status] || "badge-pending"}">${status}</span>`;
}

function initNavbarUser() {
  const user = typeof getUser === "function" ? getUser() : null;
  const chip = document.querySelector("[data-user-chip]");
  if (chip && user) {
    chip.innerHTML = `
      <div class="avatar">${user.full_name.charAt(0).toUpperCase()}</div>
      <div>
        <div style="font-weight:700;font-size:0.9rem;">${user.full_name}</div>
        <div class="text-dim small" style="text-transform:capitalize;">${user.role.replace("_"," ")}</div>
      </div>`;
  }
}
