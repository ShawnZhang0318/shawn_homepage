(function () {
  "use strict";

  var root = document.documentElement;
  var languageButtons = Array.from(document.querySelectorAll("[data-lang-btn]"));
  var languageStorageKey = "room-language";
  var musicToggle = document.getElementById("musicToggle");

  function syncMusicToggle(unavailable) {
    if (!musicToggle) return;
    var playing = !!(window.RoomMusic && window.RoomMusic.isPlaying);
    var english = root.lang === "en";
    var label = unavailable ?
      (english ? "Background music is unavailable" : "背景音乐暂不可用") :
      (playing ? (english ? "Turn room music off" : "关闭房间背景音乐") :
        (english ? "Turn room music on" : "开启房间背景音乐"));
    musicToggle.setAttribute("aria-pressed", String(playing));
    musicToggle.setAttribute("aria-label", label);
    musicToggle.title = label;
  }

  function setLanguage(language) {
    var selected = language === "en" ? "en" : "zh";
    root.lang = selected === "en" ? "en" : "zh-CN";
    languageButtons.forEach(function (button) {
      var active = button.getAttribute("data-lang-btn") === selected;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    syncMusicToggle(false);
    try {
      localStorage.setItem(languageStorageKey, selected);
    } catch (error) {
      // Language switching remains available when local storage is disabled.
    }
  }

  languageButtons.forEach(function (button) {
    button.addEventListener("click", function () {
      setLanguage(button.getAttribute("data-lang-btn"));
    });
  });
  try {
    setLanguage(localStorage.getItem(languageStorageKey) || "zh");
  } catch (error) {
    setLanguage("zh");
  }

  var openerForDialog = new WeakMap();
  var dialogOpeners = Array.from(document.querySelectorAll("[data-open]"));

  function openDialog(dialog, opener) {
    if (!dialog || typeof dialog.show !== "function") return;
    openerForDialog.set(dialog, opener);
    dialog.show();
    var room = document.getElementById("room");
    var topbar = document.querySelector(".topbar");
    if (room) room.inert = true;
    if (topbar) topbar.inert = true;
    var closeButton = dialog.querySelector("[data-close]");
    if (closeButton) closeButton.focus();
  }

  dialogOpeners.forEach(function (opener) {
    opener.addEventListener("click", function () {
      openDialog(document.getElementById(opener.getAttribute("data-open")), opener);
    });
  });

  document.querySelectorAll(".scene-dialog").forEach(function (dialog) {
    dialog.querySelectorAll("[data-close]").forEach(function (button) {
      button.addEventListener("click", function () {
        dialog.close();
      });
    });
    dialog.addEventListener("click", function (event) {
      if (event.target === dialog) dialog.close();
    });
    dialog.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        event.preventDefault();
        dialog.close();
        return;
      }
      if (event.key !== "Tab") return;
      var focusable = Array.from(dialog.querySelectorAll("a[href], button:not([disabled]), [tabindex]:not([tabindex='-1'])"))
        .filter(function (element) {
          return !element.hidden && !element.closest("[inert], [aria-hidden='true']");
        });
      if (!focusable.length) return;
      var first = focusable[0];
      var last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });
    dialog.addEventListener("close", function () {
      var room = document.getElementById("room");
      var topbar = document.querySelector(".topbar");
      if (room) room.inert = false;
      if (topbar) topbar.inert = false;
      var opener = openerForDialog.get(dialog);
      if (opener && document.contains(opener)) opener.focus({ preventScroll: true });
      var roomCanvas = document.querySelector(".room-canvas");
      if (roomCanvas) roomCanvas.scrollTop = 0;
    });
  });

  var cardDialog = document.getElementById("cardDialog");
  var flipCard = document.getElementById("flipCard");
  var flipToggle = document.getElementById("flipToggle");
  var frontFace = document.querySelector(".flip-face--front");
  var backFace = document.querySelector(".flip-face--back");

  function setCardSide(isFlipped) {
    if (!flipCard || !flipToggle) return;
    flipCard.classList.toggle("is-flipped", isFlipped);
    flipToggle.setAttribute("aria-pressed", String(isFlipped));
    if (frontFace) {
      frontFace.setAttribute("aria-hidden", String(isFlipped));
      frontFace.inert = isFlipped;
    }
    if (backFace) {
      backFace.setAttribute("aria-hidden", String(!isFlipped));
      backFace.inert = !isFlipped;
    }
  }

  if (flipToggle) {
    flipToggle.addEventListener("click", function () {
      setCardSide(flipToggle.getAttribute("aria-pressed") !== "true");
    });
  }
  if (cardDialog) {
    cardDialog.addEventListener("close", function () {
      setCardSide(false);
    });
  }
  setCardSide(false);

  var cvPreview = document.getElementById("cvPagePreview");
  var openPdf = document.getElementById("openPdf");
  var downloadPdf = document.getElementById("downloadPdf");
  var cvButtons = Array.from(document.querySelectorAll("[data-cv-lang]"));
  var cvStorageKey = "cv-pdf-language";
  var pdfVersion = "20261027";

  function setCv(button, persist) {
    if (!button || !cvPreview || !openPdf || !downloadPdf) return;
    var file = button.getAttribute("data-file");
    var downloadName = button.getAttribute("data-download");
    var previewImage = button.getAttribute("data-preview");
    var language = button.getAttribute("data-cv-lang");
    var url = "CV/" + encodeURIComponent(file) + "?v=" + pdfVersion;
    cvButtons.forEach(function (item) {
      var active = item === button;
      item.classList.toggle("is-active", active);
      item.setAttribute("aria-pressed", String(active));
    });
    cvPreview.src = "CV/" + previewImage;
    cvPreview.alt = language === "en" ? "Yitong Zhang's CV, English edition" :
      language === "zh-Hant" ? "張藝桐履歷繁體中文版頁面" : "张艺桐简历的简体中文版页面";
    openPdf.href = url;
    downloadPdf.href = url;
    downloadPdf.setAttribute("download", downloadName);
    if (persist) {
      try {
        localStorage.setItem(cvStorageKey, button.getAttribute("data-cv-lang"));
      } catch (error) {
        // The selected file still changes when storage is unavailable.
      }
    }
  }

  cvButtons.forEach(function (button) {
    button.addEventListener("click", function () {
      setCv(button, true);
    });
  });

  try {
    var savedCvLanguage = localStorage.getItem(cvStorageKey);
    var savedButton = cvButtons.find(function (button) {
      return button.getAttribute("data-cv-lang") === savedCvLanguage;
    });
    if (savedButton) setCv(savedButton, false);
  } catch (error) {
    // The simplified Chinese PDF is the initial version when storage is disabled.
  }

  var roomViewport = document.getElementById("roomViewport");
  var roomScene = document.getElementById("roomScene");
  var wallViewButtons = Array.from(document.querySelectorAll("[data-wall-view]"));
  var zoomReadout = document.getElementById("zoomReadout");
  var rotationReadout = document.getElementById("rotationReadout");
  var resetView = document.getElementById("resetView");
  var roomYaw = 0;
  var roomZoom = 1;
  var pointers = new Map();
  var dragStart = null;
  var pinchStart = null;

  function renderRoomView() {
    if (!roomScene) return;
    var activeWall = roomYaw > 43 ? "personal" : roomYaw < -43 ? "window" : "work";
    roomScene.dataset.wall = activeWall;
    wallViewButtons.forEach(function (button) {
      var active = button.getAttribute("data-wall-view") === activeWall;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    window.room3DState = { yaw: roomYaw, zoom: roomZoom };
    if (window.Room3D && window.Room3D.setView) window.Room3D.setView(roomYaw, roomZoom);
    if (zoomReadout) zoomReadout.textContent = Math.round(roomZoom * 100) + "%";
    if (rotationReadout) rotationReadout.textContent = Math.round(roomYaw) + "°";
  }

  function setRoomZoom(value) {
    roomZoom = Math.max(1, Math.min(2.4, value));
    renderRoomView();
  }

  function setRoomYaw(value) {
    roomYaw = Math.max(-90, Math.min(90, value));
    renderRoomView();
  }

  function resetRoomView() {
    roomYaw = 0;
    roomZoom = 1;
    renderRoomView();
  }

  if (roomViewport) {
    roomViewport.addEventListener("pointerdown", function (event) {
      if (event.target.closest("button, a, .topbar")) return;
      if (event.pointerType === "mouse" && event.button !== 0) return;
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      try { roomViewport.setPointerCapture(event.pointerId); } catch (error) {}
      if (pointers.size === 1) {
        dragStart = { x: event.clientX, yaw: roomYaw };
        pinchStart = null;
        roomViewport.classList.add("is-dragging");
        roomViewport.classList.remove("is-zooming");
      } else if (pointers.size === 2) {
        var points = Array.from(pointers.values());
        var dx = points[0].x - points[1].x;
        var dy = points[0].y - points[1].y;
        pinchStart = { distance: Math.hypot(dx, dy), zoom: roomZoom };
        dragStart = null;
        roomViewport.classList.remove("is-dragging");
        roomViewport.classList.add("is-zooming");
      }
      event.preventDefault();
    });

    roomViewport.addEventListener("pointermove", function (event) {
      if (!pointers.has(event.pointerId)) return;
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pointers.size >= 2) {
        var points = Array.from(pointers.values());
        var dx = points[0].x - points[1].x;
        var dy = points[0].y - points[1].y;
        var distance = Math.hypot(dx, dy);
        if (pinchStart && pinchStart.distance > 0) {
          setRoomZoom(pinchStart.zoom * distance / pinchStart.distance);
        }
        event.preventDefault();
        return;
      }
      if (dragStart) {
        var delta = event.clientX - dragStart.x;
        if (Math.abs(delta) > 2) {
          setRoomYaw(dragStart.yaw + delta * 220 / Math.max(1, roomViewport.clientWidth));
        }
        event.preventDefault();
      }
    });

    function finishRoomPointer(event) {
      if (!pointers.has(event.pointerId)) return;
      pointers.delete(event.pointerId);
      try {
        if (roomViewport.hasPointerCapture(event.pointerId)) roomViewport.releasePointerCapture(event.pointerId);
      } catch (error) {}
      if (pointers.size === 1) {
        var remaining = Array.from(pointers.entries())[0];
        dragStart = { x: remaining[1].x, yaw: roomYaw };
        pinchStart = null;
        roomViewport.classList.remove("is-zooming");
        roomViewport.classList.add("is-dragging");
      } else if (pointers.size === 0) {
        dragStart = null;
        pinchStart = null;
        roomViewport.classList.remove("is-dragging", "is-zooming");
      }
    }
    roomViewport.addEventListener("pointerup", finishRoomPointer);
    roomViewport.addEventListener("pointercancel", finishRoomPointer);
    roomViewport.addEventListener("lostpointercapture", finishRoomPointer);
    roomViewport.addEventListener("wheel", function (event) {
      event.preventDefault();
      setRoomZoom(roomZoom * (event.deltaY < 0 ? 1.09 : 0.92));
    }, { passive: false });
    roomViewport.addEventListener("keydown", function (event) {
      if (event.key === "ArrowLeft") { event.preventDefault(); setRoomYaw(roomYaw - 6); }
      else if (event.key === "ArrowRight") { event.preventDefault(); setRoomYaw(roomYaw + 6); }
      else if (event.key === "+" || event.key === "=") { event.preventDefault(); setRoomZoom(roomZoom + .1); }
      else if (event.key === "-" || event.key === "_") { event.preventDefault(); setRoomZoom(roomZoom - .1); }
      else if (event.key === "0" || event.key === "Home") { event.preventDefault(); resetRoomView(); }
    });
  }

  wallViewButtons.forEach(function (button) {
    button.addEventListener("click", function () {
      var view = button.getAttribute("data-wall-view");
      var targetYaw = view === "personal" ? 90 : view === "window" ? -90 : 0;
      if (roomViewport) {
        roomViewport.classList.add("is-transitioning");
        window.setTimeout(function () { roomViewport.classList.remove("is-transitioning"); }, 680);
      }
      setRoomYaw(targetYaw);
    });
  });

  document.querySelectorAll("[data-zoom-step]").forEach(function (button) {
    button.addEventListener("click", function () {
      setRoomZoom(roomZoom + Number(button.getAttribute("data-zoom-step")));
    });
  });
  if (resetView) resetView.addEventListener("click", resetRoomView);
  if (musicToggle) {
    musicToggle.addEventListener("click", function () {
      if (!window.RoomMusic) {
        syncMusicToggle(true);
        return;
      }
      if (window.RoomMusic.isPlaying) {
        musicToggle.disabled = true;
        window.RoomMusic.stop().then(function () {
          musicToggle.disabled = false;
          syncMusicToggle(false);
        });
        return;
      }
      musicToggle.disabled = true;
      window.RoomMusic.start().then(function (started) {
        musicToggle.disabled = false;
        syncMusicToggle(!started);
      }).catch(function () {
        musicToggle.disabled = false;
        syncMusicToggle(true);
      });
    });
    syncMusicToggle(false);
  }
  renderRoomView();

})();
