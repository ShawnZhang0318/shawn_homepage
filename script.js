(function () {
  "use strict";

  var root = document.documentElement;
  var languageButtons = document.querySelectorAll("[data-lang-btn]");
  var storageKey = "site-lang";

  function applyLanguage(language) {
    var isChinese = language !== "en";
    root.lang = isChinese ? "zh-CN" : "en";

    languageButtons.forEach(function (button) {
      var isActive = button.getAttribute("data-lang-btn") === (isChinese ? "zh" : "en");
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-pressed", String(isActive));
    });

    try {
      localStorage.setItem(storageKey, isChinese ? "zh-CN" : "en");
    } catch (error) {
      // The page remains fully usable when storage is unavailable.
    }
  }

  languageButtons.forEach(function (button) {
    button.addEventListener("click", function () {
      applyLanguage(button.getAttribute("data-lang-btn") === "en" ? "en" : "zh-CN");
    });
  });

  try {
    applyLanguage(localStorage.getItem(storageKey) === "en" ? "en" : "zh-CN");
  } catch (error) {
    applyLanguage("zh-CN");
  }

  var siteNav = document.getElementById("site-nav");
  var menuButton = document.querySelector(".greedy-nav__toggle");
  var visibleLinks = document.querySelectorAll(".visible-links .masthead__menu-item:not(.masthead__menu-item--lg)");
  var hiddenLinks = document.querySelector(".hidden-links");

  if (hiddenLinks) {
    visibleLinks.forEach(function (item) {
      hiddenLinks.appendChild(item.cloneNode(true));
    });
  }

  function closeMenu() {
    if (!menuButton || !hiddenLinks || !siteNav) return;
    menuButton.classList.remove("close");
    menuButton.setAttribute("aria-expanded", "false");
    hiddenLinks.classList.add("hidden");
    siteNav.classList.remove("is-open");
  }

  if (menuButton && hiddenLinks && siteNav) {
    menuButton.addEventListener("click", function () {
      var willOpen = hiddenLinks.classList.contains("hidden");
      hiddenLinks.classList.toggle("hidden", !willOpen);
      menuButton.classList.toggle("close", willOpen);
      menuButton.setAttribute("aria-expanded", String(willOpen));
      siteNav.classList.toggle("is-open", willOpen);
    });

    hiddenLinks.addEventListener("click", function (event) {
      if (event.target.closest("a")) closeMenu();
    });

    document.addEventListener("click", function (event) {
      if (!siteNav.contains(event.target)) closeMenu();
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") closeMenu();
    });
  }

  var navItems = Array.from(document.querySelectorAll(".visible-links .masthead__menu-item:not(.masthead__menu-item--lg)"));
  var anchorItems = navItems.filter(function (item) {
    var link = item.querySelector("a");
    return link && link.getAttribute("href").charAt(0) === "#";
  });

  if ("IntersectionObserver" in window) {
    var targets = anchorItems.map(function (item) {
      return document.querySelector(item.querySelector("a").getAttribute("href"));
    }).filter(Boolean);

    var observer = new IntersectionObserver(function (entries) {
      var visible = entries.filter(function (entry) { return entry.isIntersecting; });
      if (!visible.length) return;
      visible.sort(function (a, b) { return b.intersectionRatio - a.intersectionRatio; });
      var currentId = "#" + visible[0].target.id;

      navItems.forEach(function (item) {
        var link = item.querySelector("a");
        item.classList.toggle("current", link && link.getAttribute("href") === currentId);
      });
    }, { rootMargin: "-20% 0px -65% 0px", threshold: [0, 0.1, 0.5] });

    targets.forEach(function (target) { observer.observe(target); });
  }

  var preview = document.querySelector(".preview-image");
  var modal = document.getElementById("imageModal");
  var modalImage = document.getElementById("modalImage");
  var modalClose = document.getElementById("imageModalClose");
  var modalOverlay = document.querySelector(".image-modal-overlay");

  function closeModal() {
    if (!modal) return;
    modal.classList.remove("active");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  if (preview && modal && modalImage) {
    preview.addEventListener("click", function () {
      modalImage.src = preview.getAttribute("data-full-src") || preview.src;
      modalImage.alt = preview.alt;
      modal.classList.add("active");
      modal.setAttribute("aria-hidden", "false");
      document.body.style.overflow = "hidden";
      if (modalClose) modalClose.focus();
    });
  }

  if (modalClose) modalClose.addEventListener("click", closeModal);
  if (modalOverlay) modalOverlay.addEventListener("click", closeModal);
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && modal && modal.classList.contains("active")) closeModal();
  });

  var year = document.getElementById("year");
  if (year) year.textContent = String(new Date().getFullYear());
})();
