(() => {
  "use strict";

  const API = (window.MLD_API_URL || "").replace(/\/$/, "") || "";
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;",
      '"': "&quot;", "'": "&#39;"
    })[char]);
  }

  function api(path, options = {}) {
    const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
    const token = localStorage.getItem("mld_token");
    if (token) headers.Authorization = `Bearer ${token}`;
    return fetch((API || "") + path, { ...options, headers }).then(async (response) => {
      let data = {};
      try { data = await response.json(); } catch {}
      if (!response.ok) throw new Error(data.error || "تعذر تنفيذ الطلب");
      return data;
    });
  }

  function renderSearchResults(items) {
    const widget = $("#globalSearchResults");
    if (!widget) return;
    if (!items.length) {
      widget.innerHTML = '<div class="empty">لا توجد نتائج</div>';
      widget.classList.add("open");
      return;
    }
    widget.innerHTML = items.map((member) => `
      <button class="search-result" type="button" data-member="${escapeHtml(member.id)}">
        <img src="${escapeHtml(member.avatar || "logo.svg.JPG")}" alt="${escapeHtml(member.name || member.username)}">
        <span><strong>${escapeHtml(member.name || member.username)}</strong><small>@${escapeHtml(member.username || "")}</small></span>
      </button>
    `).join("");
    widget.classList.add("open");
  }

  function attachSearch() {
    const input = $("#globalSearch");
    const results = $("#globalSearchResults");
    if (!input || !results) return;

    let timer;
    input.addEventListener("input", () => {
      const query = input.value.trim();
      clearTimeout(timer);
      if (!query) {
        results.classList.remove("open");
        return;
      }
      timer = setTimeout(async () => {
        try {
          const data = await api(`/api/public/suggestions?q=${encodeURIComponent(query)}`);
          renderSearchResults(data.suggestions || []);
        } catch {
          results.classList.remove("open");
        }
      }, 200);
    });

    document.addEventListener("click", (event) => {
      if (!event.target.closest("#globalSearch") && !event.target.closest("#globalSearchResults")) {
        results.classList.remove("open");
      }
    });
  }

  function revealOnScroll() {
    const elements = $$(".reveal");
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) entry.target.classList.add("visible");
      });
    }, { threshold: .12 });
    elements.forEach((element) => observer.observe(element));
  }

  function attachAuthActions() {
    document.addEventListener("click", (event) => {
      const tab = event.target.closest("[data-auth-tab]");
      if (tab) {
        $$(".auth-tab").forEach((button) => button.classList.toggle("active", button === tab));
        $$(".auth-form").forEach((form) => form.classList.toggle("active", form.id === `${tab.dataset.authTab}Form`));
      }
    });
  }

  function attachMemberPreview() {
    document.addEventListener("click", async (event) => {
      const memberButton = event.target.closest("[data-member]");
      if (!memberButton) return;
      try {
        const data = await api(`/api/public/member/${encodeURIComponent(memberButton.dataset.member)}`);
        const payload = `
          <div class="dialog">
            <div class="dialogHead"><h2>${escapeHtml(data.name)}</h2><button class="close" type="button" data-close>×</button></div>
            <img class="profileAvatar" src="${escapeHtml(data.avatar || "logo.svg.JPG")}" alt="${escapeHtml(data.name)}">
            <p class="muted" style="text-align:center">@${escapeHtml(data.username)}</p>
            <div class="stats" style="margin-top:15px">
              <div class="panel stat"><b>${Number(data.stats?.messages || 0)}</b><small>الرسائل</small></div>
              <div class="panel stat"><b>${Number(data.stats?.voiceMinutes || 0)}</b><small>دقائق الصوت</small></div>
            </div>
          </div>`;
        $("#modal").innerHTML = payload;
        $("#modal").classList.add("open");
      } catch (error) {
        window.mldToast?.(error.message);
      }
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    attachSearch();
    attachAuthActions();
    attachMemberPreview();
    revealOnScroll();
    window.mldToast = (message) => {
      const toast = $("#toast");
      if (!toast) return;
      toast.textContent = message;
      toast.classList.add("show");
      clearTimeout(toast.dataset.timer);
      toast.dataset.timer = setTimeout(() => toast.classList.remove("show"), 2800);
    };
    if (!window.MLD_API_URL) window.MLD_API_URL = API;
  });
})();
