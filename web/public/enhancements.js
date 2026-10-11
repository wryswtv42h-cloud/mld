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
        const site = data.siteProfile || null;
        const siteRole = site?.is_owner ? "الأونر" : (String(site?.role || "").toLowerCase() === "admin" ? "إدارة" : (site ? "عضو MLD" : ""));
        const payload = `
          <div class="dialog member-profile-dialog">
            <div class="dialogHead"><div><h2>${escapeHtml(data.name || data.username || "عضو")}</h2><small class="muted">ملف عضو مجتمع ملاذ</small></div><button class="close" type="button" data-close aria-label="إغلاق">×</button></div>
            <div class="member-profile-identity">
              <img class="profileAvatar" src="${escapeHtml(data.avatar || "logo.svg.JPG")}" alt="${escapeHtml(data.name || data.username)}">
              <div><strong>${escapeHtml(data.name || data.username)}</strong><p class="muted">@${escapeHtml(data.username || "")}</p><span class="tag">${escapeHtml(data.rank || "عضو Discord")}</span></div>
            </div>
            ${site ? `<section class="member-site-profile"><h3>حساب MLD المرتبط</h3><div class="member-profile-identity"><img class="profileAvatar" src="${escapeHtml(site.avatar || data.avatar || "logo.svg.JPG")}" alt=""><div><strong>${escapeHtml(site.username || "عضو MLD")}</strong><p class="muted">${escapeHtml(siteRole)}</p>${site.occupation ? `<p>${escapeHtml(site.occupation)}</p>` : ""}</div></div>${site.bio ? `<p class="member-profile-bio">${escapeHtml(site.bio)}</p>` : '<p class="muted">لم يضف العضو نبذة شخصية بعد.</p>'}</section>` : '<section class="member-site-profile"><h3>حساب MLD</h3><p class="muted">لم يربط هذا العضو حسابًا في الموقع بعد.</p></section>'}
            <h3>نشاط Discord</h3>
            <div class="stats member-profile-stats" style="margin-top:12px">
              <div class="panel stat"><b>${Number(data.stats?.messages || 0).toLocaleString("ar-SA")}</b><small>الرسائل</small></div>
              <div class="panel stat"><b>${Number(data.stats?.mentionsReceived || 0).toLocaleString("ar-SA")}</b><small>منشنات مستلمة</small></div>
              <div class="panel stat"><b>${Number(data.stats?.voiceMinutes || 0).toLocaleString("ar-SA")}</b><small>دقائق الصوت</small></div>
              <div class="panel stat"><b>${Number(data.stats?.voiceJoins || 0).toLocaleString("ar-SA")}</b><small>دخول صوتي</small></div>
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
