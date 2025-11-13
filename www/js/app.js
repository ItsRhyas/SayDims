// SayDim Frontend Main Script (clean rebuild)
// Multi-page initialization, data loading, uploads, and UI helpers.

// ---- Page Detection & Bootstrap ----
function detectPage() {
  // Prefer explicit data-page marker if present
  const bodyPage = document.body?.dataset?.page;
  if (bodyPage) return bodyPage;
  const p = location.pathname.toLowerCase();
  if (p.endsWith("index.html") || p === "/" || p === "") return "index";
  if (p.endsWith("dimension.html")) return "dimension";
  if (p.endsWith("character.html")) return "character";
  if (p.endsWith("add.html")) return "add";
  return "index";
}

document.addEventListener("DOMContentLoaded", () => {
  const page = detectPage();
  if (page === "index") {
    loadDims();
    loadRecentCharacters();
  } else if (page === "dimension") {
    initDimensionPage();
  } else if (page === "character") {
    initCharacterPage();
  } else if (page === "add") {
    setupAddPage();
  }
});

// Populate dimension dropdown and wire upload forms on add page
function setupAddPage() {
  // Spinner helpers
  function showSpinner(msg) {
    const ov = document.getElementById("spinnerOverlay");
    if (!ov) return;
    ov.style.display = "flex";
    const p = ov.querySelector("p");
    if (p && msg) p.textContent = msg;
  }
  function hideSpinner() {
    const ov = document.getElementById("spinnerOverlay");
    if (ov) ov.style.display = "none";
  }
  function parsePowers(raw) {
    if (!raw || !raw.trim()) return [];
    try {
      const data = JSON.parse(raw);
      return Array.isArray(data) ? data : [];
    } catch (e) {
      console.warn("Poderes JSON inválido", e);
      return [];
    }
  }
  const dimSelect = document.getElementById("charDim");
  // Powers modal elements
  const editBtn = document.getElementById("editPowersBtn");
  const modal = document.getElementById("powersModal");
  const rowsContainer = document.getElementById("powersRows");
  const addRowBtn = document.getElementById("addPowerRow");
  const cancelBtn = document.getElementById("cancelPowers");
  const saveBtn = document.getElementById("savePowers");
  const powersJson = document.getElementById("powersJson");
  const powersSummary = document.getElementById("powersSummary");
  let powerState = []; // array of {nombre, descripcion, daño, cooldown}

  function renderPowersRows() {
    if (!rowsContainer) return;
    rowsContainer.innerHTML = "";
    if (powerState.length === 0) {
      powerState.push({ nombre: "", descripcion: "", daño: "", cooldown: "" });
    }
    powerState.forEach((p, idx) => {
      const row = document.createElement("div");
      row.className = "PowerRow";
      row.innerHTML = `
        <input type="text" placeholder="Nombre" value="${escapeHTML(
          p.nombre
        )}" data-field="nombre" data-idx="${idx}" />
        <input type="text" placeholder="Daño" value="${escapeHTML(
          p.daño
        )}" data-field="daño" data-idx="${idx}" />
        <input type="text" placeholder="Usos/CoolDown" value="${escapeHTML(
          p.cooldown
        )}" data-field="cooldown" data-idx="${idx}" />
        <textarea placeholder="Descripción" data-field="descripcion" data-idx="${idx}">${escapeHTML(
        p.descripcion
      )}</textarea>
        <button type="button" class="RemovePowerBtn" data-action="remove" data-idx="${idx}">Eliminar</button>
      `;
      rowsContainer.appendChild(row);
    });
  }
  function openModal() {
    if (modal) {
      modal.style.display = "flex";
      renderPowersRows();
    }
  }
  function closeModal() {
    if (modal) modal.style.display = "none";
  }
  function syncSummary() {
    powersSummary.textContent = `(${
      powerState.filter((p) => p.nombre.trim() !== "").length
    } poderes)`;
  }
  function persistToTextarea() {
    // sanitize & filter empty
    const cleaned = powerState
      .map((p) => ({
        nombre: p.nombre.trim(),
        descripcion: p.descripcion.trim(),
        // keep daño and cooldown as strings when present
        daño:
          p.daño == null
            ? undefined
            : String(p.daño).trim() === ""
            ? undefined
            : String(p.daño),
        cooldown:
          p.cooldown == null
            ? undefined
            : String(p.cooldown).trim() === ""
            ? undefined
            : String(p.cooldown),
      }))
      .filter((p) => p.nombre.length > 0);
    powersJson.value = JSON.stringify(cleaned);
    syncSummary();
  }
  if (editBtn) {
    editBtn.addEventListener("click", openModal);
  }
  if (cancelBtn) {
    cancelBtn.addEventListener("click", () => {
      closeModal();
    });
  }
  if (addRowBtn) {
    addRowBtn.addEventListener("click", () => {
      powerState.push({ nombre: "", descripcion: "", daño: "", cooldown: "" });
      renderPowersRows();
    });
  }
  if (rowsContainer) {
    rowsContainer.addEventListener("input", (e) => {
      const t = e.target;
      const idx = t.getAttribute("data-idx");
      const field = t.getAttribute("data-field");
      if (idx != null && field) {
        powerState[idx][field] = t.value;
      }
    });
    rowsContainer.addEventListener("click", (e) => {
      const t = e.target;
      if (t.getAttribute("data-action") === "remove") {
        const idx = Number(t.getAttribute("data-idx"));
        powerState.splice(idx, 1);
        renderPowersRows();
      }
    });
  }
  if (saveBtn) {
    saveBtn.addEventListener("click", () => {
      persistToTextarea();
      closeModal();
    });
  }
  // Initialize summary from any pre-existing JSON (unlikely now)
  try {
    if (powersJson.value) {
      const arr = JSON.parse(powersJson.value);
      if (Array.isArray(arr)) {
        powerState = arr.map((x) => ({
          nombre: x.nombre || "",
          descripcion: x.descripcion || "",
          daño: x.daño != null ? String(x.daño) : "",
          cooldown: x.cooldown != null ? String(x.cooldown) : "",
        }));
      }
    }
  } catch {}
  syncSummary();
  if (dimSelect) {
    dimSelect.innerHTML = '<option value="">Cargando dimensiones...</option>';
    fetchJSON("/api/dimensions")
      .then((dims) => {
        if (!Array.isArray(dims) || dims.length === 0) {
          dimSelect.innerHTML =
            '<option value="">(No hay dimensiones)</option>';
          return;
        }
        dimSelect.innerHTML = "";
        dims.forEach((d) => {
          if (!d.id) return; // skip malformed
          const opt = document.createElement("option");
          opt.value = d.id;
          opt.textContent = d.nombre || d.name || d.id;
          dimSelect.appendChild(opt);
        });
      })
      .catch((err) => {
        console.error("Error cargando dimensiones", err);
        dimSelect.innerHTML = '<option value="">(Error)</option>';
      });
  }
  const charForm = document.getElementById("charForm");
  if (charForm) {
    charForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      try {
        const fd = new FormData();
        const nombre = charForm.nombre.value.trim();
        const dimension = charForm.dimension.value;
        if (!dimension) {
          alert("Selecciona una dimensión");
          return;
        }
        fd.append("nombre", nombre || "SinNombre");
        fd.append("dimension", dimension);
        if (charForm.vida.value) fd.append("vida", charForm.vida.value);
        fd.append("descripcion", charForm.descripcion.value.trim());
        fd.append("comentarios", charForm.comentarios.value.trim());
        // Usar powers desde el modal si existen
        let powersArr = [];
        try {
          if (powersJson && powersJson.value) {
            powersArr = JSON.parse(powersJson.value);
          }
        } catch {}
        if (!Array.isArray(powersArr) || powersArr.length === 0) {
          powersArr = parsePowers(charForm.powers.value);
        }
        fd.append("powers", JSON.stringify(powersArr));
        const fotoInput = charForm.foto;
        if (!fotoInput.files[0]) {
          alert("Selecciona una imagen");
          return;
        }
        showSpinner("Procesando imagen...");
        const processed = await processImage(fotoInput.files[0], {
          ratio: 1,
          maxW: 800,
          maxH: 800,
          quality: 0.85,
        });
        fd.append("foto", processed, processed.name);
        showSpinner("Subiendo personaje...");
        const res = await fetch("/upload/character", {
          method: "POST",
          body: fd,
        });
        if (!res.ok) {
          hideSpinner();
          if (res.status === 409) {
            alert("Este personaje ya existe en esta dimensión");
            return;
          }
          if (res.status === 400) {
            alert("La dimensión no existe o es inválida");
            return;
          }
          if (res.status === 503) {
            alert("La tarjeta SD no está disponible");
            return;
          }
          alert("Error creando personaje: HTTP " + res.status);
          return;
        }
        // Robust response parsing (JSON or text)
        let data = null,
          textBody = null;
        try {
          data = await res.clone().json();
        } catch {
          try {
            textBody = await res.text();
            data = JSON.parse(textBody);
          } catch {
            /* keep null */
          }
        }
        hideSpinner();
        // Accept 200 even if body couldn't be parsed; try to extract id from text
        const fallbackOk = res.ok && (!data || data.ok === undefined);
        if (!res.ok || (!fallbackOk && (!data || !data.ok))) {
          alert(
            "Error creando personaje: " +
              (data && data.error ? data.error : "HTTP " + res.status)
          );
          return;
        }
        const newId =
          data && data.id
            ? data.id
            : (() => {
                try {
                  const m = (textBody || "").match(/"id"\s*:\s*"([^"]+)"/);
                  return m ? m[1] : null;
                } catch {
                  return null;
                }
              })();
        alert("Personaje creado ✔" + (newId ? " ID: " + newId : ""));
        if (newId) {
          location.href = "character.html?id=" + encodeURIComponent(newId);
        } else {
          location.href = "index.html";
        }
      } catch (err) {
        hideSpinner();
        console.error("Char upload error", err);
        alert("Error inesperado creando personaje");
      }
    });
  }
  const dimForm = document.getElementById("dimForm");
  if (dimForm) {
    dimForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      try {
        const fd = new FormData();
        const name = dimForm.name.value.trim();
        fd.append("name", name || "Sin nombre");
        fd.append("description", dimForm.description.value.trim());
        fd.append("history", dimForm.history.value.trim());
        const imgInput = dimForm.image;
        if (!imgInput.files[0]) {
          alert("Selecciona una portada");
          return;
        }
        showSpinner("Procesando portada...");
        const processed = await processImage(imgInput.files[0], {
          ratio: 16 / 9,
          maxW: 1280,
          maxH: 720,
          quality: 0.85,
        });
        fd.append("image", processed, processed.name);
        showSpinner("Subiendo dimensión...");
        const res = await fetch("/upload/dimension", {
          method: "POST",
          body: fd,
        });
        if (!res.ok) {
          hideSpinner();
          if (res.status === 409) {
            alert("La dimensión ya existe");
            return;
          }
          if (res.status === 503) {
            alert("La tarjeta SD no está disponible");
            return;
          }
          alert("Error creando dimensión: HTTP " + res.status);
          return;
        }
        let data = null,
          textBody = null;
        try {
          data = await res.clone().json();
        } catch {
          try {
            textBody = await res.text();
            data = JSON.parse(textBody);
          } catch {}
        }
        hideSpinner();
        const fallbackOk = res.ok && (!data || data.ok === undefined);
        if (!res.ok || (!fallbackOk && (!data || !data.ok))) {
          alert(
            "Error creando dimensión: " +
              (data && data.error ? data.error : "HTTP " + res.status)
          );
          return;
        }
        const newDimId =
          data && data.id
            ? data.id
            : (() => {
                try {
                  const m = (textBody || "").match(/"id"\s*:\s*"([^"]+)"/);
                  return m ? m[1] : null;
                } catch {
                  return null;
                }
              })();
        alert("Dimensión creada ✔" + (newDimId ? " ID: " + newDimId : ""));
        if (dimSelect) {
          const opt = document.createElement("option");
          opt.value = newDimId || name || "";
          opt.textContent = name || newDimId || "";
          dimSelect.appendChild(opt);
        }
        if (newDimId) {
          location.href = "dimension.html?id=" + encodeURIComponent(newDimId);
        } else {
          location.href = "index.html";
        }
      } catch (err) {
        hideSpinner();
        console.error("Dim upload error", err);
        alert("Error inesperado creando dimensión");
      }
    });
  }
}

// Dimension page with fallback
async function initDimensionPage() {
  try {
    const id = new URLSearchParams(location.search).get("id");
    const dims = await fetchJSON("/api/dimensions");
    const hero = document.getElementById("dim-hero");
    const dim = dims.find((d) => String(d.id) === String(id));
    if (hero) {
      hero.innerHTML = "";
      if (dim) {
        const section = document.createElement("section");
        section.className = "Banner";
        const a = document.createElement("a");
        a.href = "#";
        const p = document.createElement("p");
        p.className = "NombreDim";
        p.textContent = dim.nombre || dim.name || "Sin nombre";
        const img = document.createElement("img");
        img.className = "BannerImg";
        img.src = dim.image?.startsWith("http")
          ? dim.image
          : `/asset${dim.image}`;
        img.alt = p.textContent;
        img.onerror = () => {
          img.onerror = null;
          img.src = `https://picsum.photos/seed/dim-${dim.id}/800/450`;
        };
        a.appendChild(p);
        a.appendChild(img);
        section.appendChild(a);
        hero.appendChild(section);
      } else {
        const msg = document.createElement("p");
        msg.textContent = id
          ? "Dimensión no encontrada"
          : "Falta el parámetro id";
        hero.appendChild(msg);
      }
    }
    if (id) {
      await loadCharacters(id);
    } else {
      updateCharactersUI([]);
    }
  } catch (e) {
    console.error("Init dimension error", e);
  }
}

// ---- Fetch & Utility Helpers ----
async function fetchJSON(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

function escapeHTML(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ---- Dimensions (Index) ----
async function loadDims() {
  try {
    updateDimensionsUI(await fetchJSON("/api/dimensions"));
  } catch (e) {
    console.error("Dims error", e);
  }
}

function updateDimensionsUI(dims) {
  const container = document.getElementById("dims");
  if (!container) return;
  container.innerHTML = "";
  if (!Array.isArray(dims) || !dims.length) {
    container.innerHTML = "<p>No hay dimensiones.</p>";
    return;
  }
  dims.forEach((dim) => {
    const banner = document.createElement("section");
    banner.className = "Banner";
    const link = document.createElement("a");
    link.href = `dimension.html?id=${encodeURIComponent(dim.id)}`;
    link.setAttribute(
      "aria-label",
      `Abrir dimensión ${escapeHTML(dim.nombre || dim.name || "")}`
    );
    const p = document.createElement("p");
    p.className = "NombreDim";
    p.textContent = dim.nombre || dim.name || "(Sin nombre)";
    const img = document.createElement("img");
    img.className = "BannerImg";
    img.src = dim.image?.startsWith("http") ? dim.image : `/asset${dim.image}`;
    img.alt = p.textContent;
    img.onerror = () => {
      img.onerror = null;
      img.src = `https://picsum.photos/seed/dim-${dim.id}/800/450`;
    };
    link.appendChild(p);
    link.appendChild(img);
    banner.appendChild(link);
    container.appendChild(banner);
  });
}

// ---- Characters (Index & Dimension) ----
async function loadRecentCharacters() {
  try {
    updateCharactersUI(await fetchJSON("/api/characters"));
  } catch (e) {
    console.error("Chars error", e);
  }
}

async function loadCharacters(dimId) {
  try {
    updateCharactersUI(
      await fetchJSON(`/api/characters?dim=${encodeURIComponent(dimId || "")}`)
    );
  } catch (e) {
    console.error("Chars by dim error", e);
  }
}

// Render list of characters into #characters
function updateCharactersUI(chars) {
  const container = document.getElementById("characters");
  if (!container) return;
  container.innerHTML = "";
  if (!Array.isArray(chars) || !chars.length) {
    container.innerHTML = "<p>No se encontraron personajes.</p>";
    return;
  }
  const list = document.createElement("section");
  list.className = "CharList";
  chars.forEach((char) => {
    const a = document.createElement("a");
    a.className = "CharacterInList";
    a.href = `character.html?id=${encodeURIComponent(char.id)}`;
    a.setAttribute(
      "aria-label",
      `Ver personaje ${escapeHTML(char.nombre || "")}`
    );
    const img = document.createElement("img");
    img.className = "CharImg";
    img.src = char.foto?.startsWith("http") ? char.foto : `/asset${char.foto}`;
    img.alt = char.nombre || "Personaje";
    img.onerror = () => {
      img.onerror = null;
      img.src = `https://picsum.photos/seed/char-${char.id}/80/80`;
    };
    const p = document.createElement("p");
    p.className = "CharName";
    p.textContent = char.nombre || "Sin nombre";
    a.appendChild(img);
    a.appendChild(p);
    list.appendChild(a);
  });
  container.appendChild(list);
}

async function initCharacterPage() {
  try {
    const id = new URLSearchParams(location.search).get("id");
    const chars = await fetchJSON("/api/characters");
    const char = chars.find((c) => String(c.id) === String(id));
    if (!char) return;
    let dimName = char.dimensionName || "Sin dimensión";
    if ((!dimName || dimName === "") && char.dimension) {
      try {
        const dims = await fetchJSON("/api/dimensions");
        const dim = dims.find((d) => String(d.id) === String(char.dimension));
        if (dim) dimName = dim.nombre || dim.name || dimName;
      } catch {}
    }
    let powersRows =
      '<tr><td colspan="3" class="PowerDescription">Sin poderes definidos</td></tr>';
    if (Array.isArray(char.powers) && char.powers.length) {
      powersRows = char.powers
        .map((p) => {
          const name = escapeHTML(p.nombre || "Poder");
          const dmg = p.daño != null ? escapeHTML(String(p.daño)) : "-";
          const cd = p.cooldown != null ? escapeHTML(String(p.cooldown)) : "-";
          const desc = escapeHTML(p.descripcion || "");
          return (
            '<tr><td class="PowerName">' +
            name +
            "</td><td>" +
            dmg +
            "</td><td>" +
            cd +
            '</td></tr><tr><td class="PowerDescription" colspan="3">' +
            desc +
            "</td></tr>"
          );
        })
        .join("");
    }
    let createdDisplay = "";
    if (char.created) {
      const ts = parseInt(String(char.created), 10);
      if (!isNaN(ts)) {
        const d = new Date(ts * 1000);
        createdDisplay = d.toLocaleDateString() + " " + d.toLocaleTimeString();
      } else createdDisplay = escapeHTML(String(char.created));
    }
    const otherVersions = chars.filter(
      (c) =>
        c.id !== char.id &&
        ((char.multiverseId && c.multiverseId === char.multiverseId) ||
          (!char.multiverseId &&
            c.nombre === char.nombre &&
            c.dimension !== char.dimension))
    );
    let versionsHTML = "";
    if (otherVersions.length) {
      versionsHTML =
        '<h3>Otras versiones</h3><div class="CharList">' +
        otherVersions
          .map((ov) => {
            const ovDim = escapeHTML(
              ov.dimensionName || ov.dimension || "Otra dimensión"
            );
            const foto = ov.foto?.startsWith("http")
              ? ov.foto
              : `/asset${ov.foto}`;
            return (
              '<a class="CharacterInList" href="character.html?id=' +
              encodeURIComponent(ov.id) +
              '" aria-label="Ver versión ' +
              escapeHTML(ov.nombre) +
              ' en otra dimensión"><img class="CharImg" src="' +
              foto +
              '" alt="' +
              escapeHTML(ov.nombre || "Personaje") +
              '" onerror="this.onerror=null;this.src=\'https://picsum.photos/seed/char-' +
              ov.id +
              '/80/80\'" /><p class="CharName">' +
              ovDim +
              "</p></a>"
            );
          })
          .join("") +
        "</div>";
    }
    const foto = char.foto?.startsWith("http")
      ? char.foto
      : `/asset${char.foto}`;
    const container = document.getElementById("character-detail");
    if (!container) return;
    const statsRows = [
      '<tr><th scope="row">Vida</th><td>' +
        (char.vida != null ? escapeHTML(String(char.vida)) + " ❤️" : "N/A") +
        "</td></tr>",
      '<tr><th scope="row">Dimensión</th><td>' +
        escapeHTML(dimName) +
        "</td></tr>",
    ];
    if (createdDisplay)
      statsRows.push(
        "<tr><th>Creado</th><td>" + escapeHTML(createdDisplay) + "</td></tr>"
      );
    if (char.comentarios)
      statsRows.push(
        "<tr><th>Comentarios</th><td>" +
          escapeHTML(char.comentarios) +
          "</td></tr>"
      );
    const html = `
      <section class="CharDetails" aria-labelledby="char-name" data-id="${escapeHTML(
        String(char.id)
      )}">
        <img class="CharMainImg" src="${foto}" alt="${escapeHTML(
      char.nombre || "Personaje"
    )}" onerror="this.onerror=null;this.src='https://picsum.photos/seed/char-${
      char.id
    }/300/300'" />
        <h2 id="char-name" class="CharName">${escapeHTML(
          char.nombre || "Sin nombre"
        )}</h2>
        <p class="CharDescription">${escapeHTML(
          char.descripcion || "Sin descripción"
        )}</p>
        <table class="CharStats" aria-label="Detalles del personaje"><tbody>${statsRows.join(
          ""
        )}</tbody></table>
        <h3>Habilidades ⚡</h3>
        <table class="Powers" aria-label="Poderes del personaje"><thead><tr><th>Nombre</th><th>Daño</th><th>Usos/CoolDown</th></tr></thead><tbody>${powersRows}</tbody></table>
        ${versionsHTML}
      </section>`;
    container.innerHTML = html;
  } catch (e) {
    console.error("Init character error", e);
  }
}
// (Removed duplicate escapeHTML + global exposures earlier)

// --- Image processing utilities (client-side optimization) ---
function suggestJpegName(name) {
  const idx = name.lastIndexOf(".");
  return (idx > 0 ? name.slice(0, idx) : name) + ".jpg";
}

async function processImage(
  file,
  { ratio = 1, maxW = 800, maxH = 800, quality = 0.8, fill = "#ffffff" } = {}
) {
  const img = await blobToImage(file);
  // Determine target size respecting ratio and bounds
  let targetW = maxW;
  let targetH = Math.round(targetW / ratio);
  if (targetH > maxH) {
    targetH = maxH;
    targetW = Math.round(targetH * ratio);
  }
  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = fill;
  ctx.fillRect(0, 0, targetW, targetH);
  // Cover scaling
  const scale = Math.max(targetW / img.width, targetH / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;
  const dx = (targetW - dw) / 2;
  const dy = (targetH - dh) / 2;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, dx, dy, dw, dh);
  const blob = await canvasToBlob(canvas, "image/jpeg", quality);
  return new File([blob], suggestJpegName(file.name), { type: "image/jpeg" });
}

function blobToImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}

// Convert canvas to Blob with broad browser support
function canvasToBlob(canvas, type = "image/jpeg", quality = 0.85) {
  return new Promise((resolve, reject) => {
    try {
      if (canvas.toBlob) {
        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else reject(new Error("canvas.toBlob returned null"));
          },
          type,
          quality
        );
      } else {
        // Fallback via dataURL
        const dataURL = canvas.toDataURL(type, quality);
        const parts = dataURL.split(",");
        const mimeMatch = parts[0].match(/:(.*?);/);
        const mime = mimeMatch ? mimeMatch[1] : type;
        const bstr = atob(parts[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) u8arr[n] = bstr.charCodeAt(n);
        resolve(new Blob([u8arr], { type: mime }));
      }
    } catch (e) {
      reject(e);
    }
  });
}
