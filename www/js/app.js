// App bootstrap: detect page and initialize
document.addEventListener("DOMContentLoaded", () => {
  checkSDCardStatus();

  const page = detectPage();

  switch (page) {
    case "index":
      // Landing: list dimensions and recent characters
      loadDims();
      loadCharacters();
      break;
    case "dimension":
      initDimensionPage();
      break;
    case "character":
      initCharacterPage();
      break;
    case "add":
      // Build selects and wire forms
      loadDims();
      setupEventListeners();
      break;
    default:
      // Fallback to index behavior
      loadDims();
      loadCharacters();
  }

  // Optional toggle in legacy layout
  const tgl = document.getElementById("toggleNewDim");
  if (tgl) {
    tgl.addEventListener("click", () => {
      const box = document.getElementById("newDimForm");
      if (box)
        box.style.display = box.style.display === "none" ? "block" : "none";
    });
  }
});

function detectPage() {
  const p = (document.body?.dataset?.page || "").toLowerCase();
  if (p) return p;
  const path = (location.pathname || "").toLowerCase();
  if (path.endsWith("/dimension.html")) return "dimension";
  if (path.endsWith("/vistadim.html")) return "dimension"; // backward compatibility
  if (path.endsWith("/character.html")) return "character";
  if (path.endsWith("/vistachar.html")) return "character"; // backward compatibility
  if (path.endsWith("/add.html")) return "add";
  if (path.endsWith("/index.html") || path.endsWith("/")) return "index";
  return "index";
}

// Check if SD card is available
async function checkSDCardStatus() {
  try {
    const response = await fetch("/api/status");
    const data = await response.json();
    if (!data.sdAvailable) {
      const box = document.getElementById("sdcardError");
      if (box) box.style.display = "block";
    }
  } catch (error) {
    console.error("Error checking SD card status:", error);
    const box = document.getElementById("sdcardError");
    if (box) box.style.display = "block";
  }
}

// Setup all event listeners
function setupEventListeners() {
  // Dimension form submission
  document.getElementById("dimForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    await uploadFormData("/upload/dimension", e.target, "Dimensión creada");
  });

  // Character form submission
  document.getElementById("charForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    await uploadFormData("/upload/character", e.target, "Personaje creado");
  });
}

// Generic function to handle form submission with file upload
async function uploadFormData(url, formElement, successMessage) {
  // Rebuild FormData and optimize image inputs on the client (crop+compress)
  const formData = new FormData();
  const els = Array.from(formElement.elements || []);
  for (const el of els) {
    if (!el || !el.name) continue;
    if (el.type === "file" && el.files && el.files[0]) {
      const file = el.files[0];
      let processed = file;
      try {
        if (url.includes("dimension")) {
          // 16:9 cover, max 1280x720
          processed = await processImage(file, {
            ratio: 16 / 9,
            maxW: 1280,
            maxH: 720,
            quality: 0.82,
            fill: "#ffffff",
          });
        } else {
          // 1:1 avatar, max 800x800
          processed = await processImage(file, {
            ratio: 1,
            maxW: 800,
            maxH: 800,
            quality: 0.8,
            fill: "#ffffff",
          });
        }
      } catch (e) {
        console.warn("Image processing failed; sending original file.", e);
      }
      formData.append(el.name, processed, suggestJpegName(file.name));
    } else if (el.type === "checkbox") {
      if (el.checked) formData.append(el.name, el.value || "on");
    } else if (el.type === "radio") {
      if (el.checked) formData.append(el.name, el.value);
    } else {
      formData.append(el.name, el.value);
    }
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      body: formData,
    });

    if (response.ok) {
      alert(successMessage);
      formElement.reset();
      if (url.includes("dimension")) {
        const panel = document.getElementById("newDimForm");
        if (panel) panel.style.display = "none";
        await loadDims();
      } else {
        await loadCharacters();
      }
    } else {
      const error = await response.text();
      throw new Error(error || "Error en la solicitud");
    }
  } catch (error) {
    console.error("Error:", error);
    alert(`Error: ${error.message}`);
  }
}

// Load dimensions from the server
async function loadDims() {
  try {
    const dims = await fetchJSON("/api/dimensions");
    updateDimensionsUI(dims);
  } catch (error) {
    console.error("Error loading dimensions:", error);
    alert("Error al cargar las dimensiones");
  }
}

// Update the UI with dimensions data
function updateDimensionsUI(dims) {
  const ddiv = document.getElementById("dims");
  const filter = document.getElementById("filterDim");
  const charDim = document.getElementById("charDim");

  // Clear existing content if present
  if (ddiv) ddiv.innerHTML = "";
  if (filter) filter.innerHTML = '<option value="">--Todas--</option>';
  if (charDim) charDim.innerHTML = "";

  // Add each dimension to the UI
  dims.forEach((d) => {
    const displayName = d.name || d.nombre || "Sin nombre";

    // Fill index/dimension lists as banners if container exists
    if (ddiv) {
      const section = document.createElement("section");
      section.className = "Banner";
      const a = document.createElement("a");
      a.href = `dimension.html?id=${encodeURIComponent(d.id)}`;
      a.setAttribute("aria-label", `Abrir dimensión ${displayName}`);
      const p = document.createElement("p");
      p.className = "NombreDim";
      p.textContent = displayName;
      const img = document.createElement("img");
      img.className = "BannerImg";
      img.src = d.image?.startsWith("http") ? d.image : `/asset${d.image}`;
      img.alt = displayName;
      img.onerror = () => {
        img.onerror = null;
        img.src = `https://picsum.photos/seed/dim-${d.id}/800/450`;
      };
      a.appendChild(p);
      a.appendChild(img);
      section.appendChild(a);
      ddiv.appendChild(section);
    }

    // Add to dropdowns if they exist
    [filter, charDim].forEach((select) => {
      if (!select) return;
      const option = document.createElement("option");
      option.value = d.id;
      option.textContent = displayName;
      select.appendChild(option);
    });
  });
}

// Load characters from the server
async function loadCharacters() {
  try {
    const filterEl = document.getElementById("filterDim");
    const sortEl = document.getElementById("sortField");
    const dirEl = document.getElementById("sortDir");
    const filter = filterEl ? filterEl.value : "";
    const sort = sortEl ? sortEl.value : "";
    const dir = dirEl ? dirEl.value : "asc";

    let url = "/api/characters?";
    if (filter) url += `dim=${filter}&`;
    if (sort) url += `sort=${sort}&dir=${dir}`;

    const chars = await fetchJSON(url);
    updateCharactersUI(chars);
  } catch (error) {
    console.error("Error loading characters:", error);
    alert("Error al cargar los personajes");
  }
}

// Update the UI with characters data
function updateCharactersUI(chars) {
  const container = document.getElementById("characters");
  if (!container) return;
  container.innerHTML = "";

  if (!chars || chars.length === 0) {
    container.innerHTML = "<p>No se encontraron personajes.</p>";
    return;
  }

  const list = document.createElement("section");
  list.className = "CharList";

  chars.forEach((char) => {
    const a = document.createElement("a");
    a.href = `character.html?id=${encodeURIComponent(char.id)}`;
    a.className = "CharacterInList";
    a.setAttribute("aria-label", `Abrir personaje ${char.nombre}`);

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

// Show new dimension form
function showNewDimension() {
  // Redirect to add page where forms live now
  location.href = "add.html#dimension";
}

// Show dimension details
function showDimension(id) {
  location.href = `dimension.html?id=${encodeURIComponent(id)}`;
}

// Show character details
function showCharacter(id) {
  location.href = `character.html?id=${encodeURIComponent(id)}`;
}

// Page initializers for multi-page layout
async function initDimensionPage() {
  try {
    const id = new URLSearchParams(location.search).get("id");
    const dims = await fetchJSON("/api/dimensions");
    const dim = dims.find((d) => String(d.id) === String(id));
    const hero = document.getElementById("dim-hero");
    if (dim && hero) {
      hero.innerHTML = "";
      const section = document.createElement("section");
      section.className = "Banner";
      const p = document.createElement("p");
      p.className = "NombreDim";
      p.textContent = dim.name || dim.nombre || "Sin nombre";
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
      const a = document.createElement("a");
      a.href = "#";
      a.appendChild(p);
      a.appendChild(img);
      section.appendChild(a);
      hero.appendChild(section);
    }
    // List characters for this dimension
    const chars = await fetchJSON(
      `/api/characters?dim=${encodeURIComponent(id || "")}`
    );
    updateCharactersUI(chars);
  } catch (error) {
    console.error("Error initializing dimension page:", error);
  }
}

async function initCharacterPage() {
  try {
    const id = new URLSearchParams(location.search).get("id");
    const chars = await fetchJSON("/api/characters");
    const char = chars.find((c) => String(c.id) === String(id));
    if (!char) return;

    // Get dimension name if missing
    let dimName = char.dimensionName || "Sin dimensión";
    if (!dimName && char.dimension) {
      try {
        const dims = await fetchJSON("/api/dimensions");
        const dim = dims.find((d) => String(d.id) === String(char.dimension));
        if (dim) dimName = dim.name || dim.nombre || dimName;
      } catch {}
    }

    const container = document.getElementById("character-detail");
    if (!container) return;

    // Powers table rows
    let powersRows =
      "<tr><td colspan=3 class=PowerDescription>Sin poderes definidos</td></tr>";
    if (Array.isArray(char.powers) && char.powers.length) {
      powersRows = char.powers
        .map((p) => {
          const name = escapeHTML(p.nombre || "Poder");
          const dmg = p.daño != null ? String(p.daño) : "-";
          const cd = p.cooldown != null ? String(p.cooldown) : "-";
          const desc = escapeHTML(p.descripcion || "");
          return `
            <tr>
              <td class="PowerName">${name}</td>
              <td>${dmg}</td>
              <td>${cd}</td>
            </tr>
            <tr>
              <td class="PowerDescription" colspan="3">${desc}</td>
            </tr>`;
        })
        .join("");
    }

    container.innerHTML = `
      <section class="CharDetails" aria-labelledby="char-name" data-id="${escapeHTML(
        String(char.id)
      )}">
        <img class="CharMainImg" src="${
          char.foto?.startsWith("http") ? char.foto : `/asset${char.foto}`
        }" alt="${escapeHTML(
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

        <table class="CharStats" aria-label="Detalles del personaje">
          <tbody>
            <tr><th scope="row">Vida</th><td>${
              char.vida != null ? `${char.vida} ❤️` : "N/A"
            }</td></tr>
            <tr><th scope="row">Dimensión</th><td>${escapeHTML(
              dimName
            )}</td></tr>
            ${
              char.created
                ? `<tr><th>Creado</th><td>${escapeHTML(
                    String(char.created)
                  )}</td></tr>`
                : ""
            }
            ${
              char.comentarios
                ? `<tr><th>Comentarios</th><td>${escapeHTML(
                    char.comentarios
                  )}</td></tr>`
                : ""
            }
          </tbody>
        </table>

        <h3>Habilidades ⚡</h3>
        <table class="Powers" aria-label="Poderes del personaje">
          <thead>
            <tr><th>Nombre</th><th>Daño</th><th>Cooldown</th></tr>
          </thead>
          <tbody>${powersRows}</tbody>
        </table>
      </section>`;
  } catch (error) {
    console.error("Error initializing character page:", error);
  }
}

// Helper function to fetch JSON
async function fetchJSON(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return await response.json();
}

// Helper function to escape HTML
function escapeHTML(str) {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Expose functions to global scope for HTML event handlers
window.showNewDimension = showNewDimension;
window.loadCharacters = loadCharacters;
window.showDimension = showDimension;
window.showCharacter = showCharacter;

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

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}
