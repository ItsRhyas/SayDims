// Simple mock layer for offline development.
// Activate by opening index.html with ?mock=1 or setting window.SAYDIM_MOCK = true before this script.
(function () {
  const params = new URLSearchParams(window.location.search);
  const active = params.get("mock") === "1" || window.SAYDIM_MOCK === true;
  if (!active) {
    console.log("[SayDim Mock] Modo mock desactivado");
    return;
  }
  console.log("%c[SayDim Mock] Activo - usando datos simulados", "color:#0a0");

  // Fake datasets
  const mockDimensions = [
    {
      id: "d1",
      name: "Bosque Arcano",
      description: "Una dimensión verde llena de energía mística.",
      history: "Antaño hogar de druidas antiguos.",
      image: "https://picsum.photos/seed/d1/800/400",
    },
    {
      id: "d2",
      name: "Ciudad Neón",
      description: "Megápolis futurista repleta de luces y gente.",
      history: "Nació de una colonia minera orbital.",
      image: "https://picsum.photos/seed/d2/800/400",
    },
  ];

  const mockCharacters = [
    {
      id: "c1",
      nombre: "Aria",
      dimension: "d1",
      dimensionName: "Bosque Arcano",
      vida: 120,
      descripcion: "Guardiana de los secretos del bosque.",
      foto: "https://picsum.photos/seed/c1/300/300",
      powers: [
        {
          nombre: "Raíces vivas",
          descripcion: "Controla raíces para inmovilizar.",
          daño: 15,
        },
        { nombre: "Curación verde", descripcion: "Regenera vida lentamente." },
      ],
      created: "1670000100",
    },
    {
      id: "c2",
      nombre: "Volt",
      dimension: "d2",
      dimensionName: "Ciudad Neón",
      vida: 90,
      descripcion: "Hacker con implantes eléctricos.",
      foto: "https://picsum.photos/seed/c2/300/300",
      powers: [
        {
          nombre: "Descarga",
          descripcion: "Emite un rayo eléctrico.",
          daño: 25,
        },
      ],
      created: "1670000200",
    },
  ];

  // Helper to build filtered/sorted characters like the real API
  function getCharactersFromQuery(url) {
    const u = new URL(url, window.location.origin);
    let list = mockCharacters.slice();
    const dim = u.searchParams.get("dim");
    let sort = u.searchParams.get("sort");
    const dir = (u.searchParams.get("dir") || "asc").toLowerCase();
    if (dim) {
      list = list.filter((c) => c.dimension === dim);
    }
    if (sort) {
      // Map UI sort alias to field names
      if (sort === "name") sort = "nombre";
      list.sort((a, b) => {
        let av = a[sort];
        let bv = b[sort];
        // numeric if possible
        const an = Number(av);
        const bn = Number(bv);
        if (!isNaN(an) && !isNaN(bn)) {
          return dir === "asc" ? an - bn : bn - an;
        }
        av = String(av).toLowerCase();
        bv = String(bv).toLowerCase();
        if (av < bv) return dir === "asc" ? -1 : 1;
        if (av > bv) return dir === "asc" ? 1 : -1;
        return 0;
      });
    }
    return list;
  }

  // Patch global fetch
  const realFetch = window.fetch.bind(window);
  window.fetch = async function (url, options) {
    // Normalize URL to string
    const urlStr =
      typeof url === "string"
        ? url
        : url instanceof Request
        ? url.url
        : String(url);

    // Mocked endpoints
    if (urlStr.startsWith("/api/status")) {
      return mockResponse({ sdAvailable: true });
    }
    if (urlStr.startsWith("/api/dimensions")) {
      return mockResponse(mockDimensions);
    }
    if (urlStr.startsWith("/api/characters")) {
      return mockResponse(getCharactersFromQuery(urlStr));
    }
    if (urlStr.startsWith("/upload/dimension")) {
      // Simulate adding dimension
      const id = "d" + (mockDimensions.length + 1);
      mockDimensions.push({
        id,
        name: "Dim Mock " + id,
        description: "Creada en modo mock",
        history: "",
        image: `https://picsum.photos/seed/${id}/800/400`,
      });
      return mockResponse({ ok: true, id });
    }
    if (urlStr.startsWith("/upload/character")) {
      const id = "c" + (mockCharacters.length + 1);
      mockCharacters.push({
        id,
        nombre: "Char Mock " + id,
        dimension: mockDimensions[0].id,
        dimensionName: mockDimensions[0].name,
        vida: 50,
        descripcion: "Personaje ficticio agregado en mock.",
        foto: `https://picsum.photos/seed/${id}/300/300`,
        powers: [],
        created: Date.now().toString(),
      });
      return mockResponse({ ok: true, id });
    }

    // Assets: return 404 placeholder quickly (so onerror handlers kick in)
    if (urlStr.startsWith("/asset/")) {
      return mockResponse({ error: "asset mock 404" }, 404);
    }

    // Fall through to real fetch for other resources
    return realFetch(url, options);
  };

  function mockResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }
})();
