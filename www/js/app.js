// Check SD card status on page load
document.addEventListener("DOMContentLoaded", () => {
  checkSDCardStatus();
  loadDims();
  loadCharacters();
  setupEventListeners();
});

// Check if SD card is available
async function checkSDCardStatus() {
  try {
    const response = await fetch("/api/status");
    const data = await response.json();
    if (!data.sdAvailable) {
      document.getElementById("sdcardError").style.display = "block";
    }
  } catch (error) {
    console.error("Error checking SD card status:", error);
    document.getElementById("sdcardError").style.display = "block";
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
  const formData = new FormData(formElement);

  try {
    const response = await fetch(url, {
      method: "POST",
      body: formData,
    });

    if (response.ok) {
      alert(successMessage);
      formElement.reset();
      if (url.includes("dimension")) {
        document.getElementById("newDimForm").style.display = "none";
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
  const sb = document.getElementById("sidebarList");
  const filter = document.getElementById("filterDim");
  const charDim = document.getElementById("charDim");

  // Clear existing content
  ddiv.innerHTML = "";
  sb.innerHTML = "";
  filter.innerHTML = '<option value="">--Todas--</option>';
  charDim.innerHTML = "";

  // Add each dimension to the UI
  dims.forEach((d) => {
    // Create dimension card
    const card = document.createElement("div");
    card.className = "dim-card";
    card.onclick = () => showDimension(d.id);

    const img = document.createElement("img");
    img.src = d.image.startsWith("http") ? d.image : `/asset${d.image}`;
    img.alt = d.name;
    img.onerror = () => {
      img.src = "img/placeholder.jpg";
    };

    const overlay = document.createElement("div");
    overlay.className = "overlay";
    overlay.textContent = d.name;

    card.appendChild(img);
    card.appendChild(overlay);
    ddiv.appendChild(card);

    // Add to sidebar
    const sidebarItem = document.createElement("div");
    sidebarItem.className = "sidebar-item";
    sidebarItem.textContent = d.name;
    sidebarItem.onclick = () => showDimension(d.id);
    sb.appendChild(sidebarItem);

    // Add to filter dropdowns
    [filter, charDim].forEach((select) => {
      const option = document.createElement("option");
      option.value = d.id;
      option.textContent = d.name;
      select.appendChild(option);
    });
  });
}

// Load characters from the server
async function loadCharacters() {
  try {
    const filter = document.getElementById("filterDim").value;
    const sort = document.getElementById("sortField").value;
    const dir = document.getElementById("sortDir").value;

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
  container.innerHTML = "";

  if (chars.length === 0) {
    container.innerHTML = "<p>No se encontraron personajes.</p>";
    return;
  }

  chars.forEach((char) => {
    const charElement = document.createElement("div");
    charElement.className = "character-card";
    charElement.onclick = () => showCharacter(char.id);

    charElement.innerHTML = `
      <div class="character-header">
          <img src="${
            char.foto.startsWith("http") ? char.foto : `/asset${char.foto}`
          }" 
             alt="${char.nombre}" 
               onerror="this.src='img/placeholder.jpg';">
        <div class="character-info">
          <h3>${escapeHTML(char.nombre)}</h3>
          <div class="character-stats">
            <span class="stat">Vida: ${char.vida || "N/A"}</span>
            <span class="dimension">${escapeHTML(
              char.dimensionName || "Sin dimensión"
            )}</span>
          </div>
        </div>
      </div>
      <div class="character-description">
        ${escapeHTML(char.descripcion || "Sin descripción")}
      </div>
    `;

    container.appendChild(charElement);
  });
}

// Show new dimension form
function showNewDimension() {
  document.getElementById("newDimForm").style.display = "block";
}

// Show dimension details
async function showDimension(id) {
  try {
    const dims = await fetchJSON("/api/dimensions");
    const dim = dims.find((d) => d.id === id);
    if (dim) {
      // Create a modal or update the main view to show dimension details
      const html = `
        <div class="dimension-detail">
          <h2>${escapeHTML(dim.name)}</h2>
            <img src="${
              dim.image.startsWith("http") ? dim.image : `/asset${dim.image}`
            }" 
               alt="${dim.name}"
                 onerror="this.src='img/placeholder.jpg';">
          <div class="dimension-description">
            <h3>Descripción</h3>
            <p>${escapeHTML(dim.description || "Sin descripción")}</p>
            <h3>Historia</h3>
            <p>${escapeHTML(dim.history || "Sin historia")}</p>
          </div>
          <button onclick="window.history.back()">Volver</button>
        </div>
      `;

      // Update the main content
      document.querySelector(".main").innerHTML = html;
    }
  } catch (error) {
    console.error("Error showing dimension:", error);
    alert("Error al cargar la dimensión");
  }
}

// Show character details
async function showCharacter(id) {
  try {
    const chars = await fetchJSON("/api/characters");
    const char = chars.find((c) => c.id === id);

    if (char) {
      // Get dimension name
      let dimName = "Sin dimensión";
      try {
        const dims = await fetchJSON("/api/dimensions");
        const dim = dims.find((d) => d.id === char.dimension);
        if (dim) dimName = dim.name;
      } catch (e) {
        console.error("Error loading dimension name:", e);
      }

      // Format powers if they exist
      let powersHTML = "<p>Sin poderes definidos.</p>";
      try {
        if (char.powers && char.powers.length > 0) {
          powersHTML = '<div class="powers-list">';
          char.powers.forEach((power) => {
            powersHTML += `
              <div class="power-item">
                <h4>${escapeHTML(power.nombre || "Poder sin nombre")}</h4>
                <p>${escapeHTML(power.descripcion || "Sin descripción")}</p>
                ${
                  power.daño
                    ? `<div class="power-damage">Daño: ${power.daño}</div>`
                    : ""
                }
              </div>
            `;
          });
          powersHTML += "</div>";
        }
      } catch (e) {
        console.error("Error parsing powers:", e);
      }

      // Create the character detail view
      const html = `
        <div class="character-detail">
          <button class="back-button" onclick="window.history.back()">← Volver</button>
          
          <div class="character-header">
            <img src="${
              char.foto.startsWith("http") ? char.foto : `/asset${char.foto}`
            }" 
                 alt="${char.nombre}"
                 onerror="this.src='/img/placeholder.jpg';">
            <div class="character-info">
              <h1>${escapeHTML(char.nombre)}</h1>
              <div class="character-meta">
                <span class="dimension">${escapeHTML(dimName)}</span>
                ${
                  char.vida
                    ? `<span class="health">❤️ ${char.vida} HP</span>`
                    : ""
                }
              </div>
            </div>
          </div>
          
          <div class="character-content">
            <section class="character-description">
              <h2>Descripción</h2>
              <p>${char.descripcion || "Sin descripción"}</p>
            </section>
            
            <section class="character-powers">
              <h2>Poderes</h2>
              ${powersHTML}
            </section>
            
            ${
              char.comentarios
                ? `
              <section class="character-notes">
                <h2>Notas adicionales</h2>
                <p>${escapeHTML(char.comentarios)}</p>
              </section>
            `
                : ""
            }
          </div>
        </div>
      `;

      // Update the main content
      document.querySelector(".main").innerHTML = html;
    }
  } catch (error) {
    console.error("Error showing character:", error);
    alert("Error al cargar el personaje");
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
