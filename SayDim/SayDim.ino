/*
  SayDim.ino
  Servidor web simple para gestionar dimensiones y personajes.
  - Usa WebServer (ESP32 core) y la tarjeta microSD para almacenar imágenes y datos JSON.
  - Minimiza librerías: WiFi, WebServer, ArduinoJson, SPI y SD.
  - Subidas manejadas con WebServer.upload().
*/

#include <WiFi.h>
#include <WebServer.h>
#include <SPI.h>
#include <SD.h>
#include <ArduinoJson.h>
#include <time.h>

// WiFi
const char* ssid = "";
const char* password = "";
const IPAddress local_IP(192,168,1,200);
const IPAddress gateway(192,168,1,1);
const IPAddress subnet(255,255,255,0);
const IPAddress primaryDNS(8,8,8,8);

WebServer server(80);

// Indicador de disponibilidad de la tarjeta SD
bool sdAvailable = false;

static const char* sdHints = "Verifica el cableado: GND->GND, CS->GPIO5, SCK->GPIO18, MOSI->GPIO23, MISO->GPIO19.\n"
"Alimenta el módulo a 3.3V (no a 5V). Prueba una frecuencia SPI más baja si el módulo/tarjeta es antigua.\n";

// Intenta inicializar la SD y mostrar diagnósticos
uint32_t sdWorkingFreq = 0;
bool tryInitSD(){
  // Force a single, known-good SPI frequency (10 MHz) to reduce startup time.
  const uint32_t preferred = 10000000UL;
  Serial.printf("Trying SD.begin(CS=5) with SPI freq %lu...\n", preferred);
  if(SD.begin(5, SPI, preferred)){
    sdAvailable = true;
    sdWorkingFreq = preferred;
    Serial.println("SD initialized successfully.");
    uint8_t t = SD.cardType();
    Serial.printf("Card type: %u\n", t);
    Serial.printf("Working SPI freq: %lu\n", sdWorkingFreq);
    return true;
  }
  Serial.println("SD.begin falló a 10 MHz, reintentando con parámetros por defecto...");
  if(SD.begin(5)){
    sdAvailable = true;
    sdWorkingFreq = 0;
    Serial.println("SD inicializada (por defecto) correctamente.");
    uint8_t t = SD.cardType();
    Serial.printf("Card type: %u\n", t);
    return true;
  }
  sdAvailable = false;
  Serial.println("Fallo al iniciar SD (10MHz + por defecto).");
  Serial.println(sdHints);
  return false;
}

// Rutas
const char* DATA_DIR = "/data";
const char* DIM_DIR = "/dimensions";
const char* CHAR_DIR = "/characters";
const char* DIM_FILE = "/data/dimensions.json";
const char* CHAR_FILE = "/data/characters.json";
const char* ORDER_FILE = "/data/order.json";

String getTimestampId(){
  return String((uint32_t)millis()) + String(esp_random() & 0xFFFF, HEX);
}

// Funciones de ayuda para leer/escribir archivos en SD (SPI)
String readFileToStringFS(const char* path){
  if(!sdAvailable) return String("[]");
  if(!SD.exists(path)) return String("[]");
  File f = SD.open(path, FILE_READ);
  if(!f) return String();
  String s;
  while(f.available()) s += (char)f.read();
  f.close();
  return s;
}

bool writeStringToFileFS(const char* path, const String &data){
  if(!sdAvailable) return false;
  // To overwrite, remove existing then write
  if(SD.exists(path)) SD.remove(path);
  File f = SD.open(path, FILE_WRITE);
  if(!f) return false;
  f.print(data);
  f.close();
  return true;
}

void ensureFoldersFS(){
  if(!sdAvailable) {
    Serial.println("ensureFoldersFS: SD no disponible, se omite la creación de carpetas.");
    return;
  }
  // Create directories and default files on SD if missing
  if(!SD.exists(DATA_DIR)) SD.mkdir(DATA_DIR);
  if(!SD.exists(DIM_DIR)) SD.mkdir(DIM_DIR);
  if(!SD.exists(CHAR_DIR)) SD.mkdir(CHAR_DIR);

  if(!SD.exists(DIM_FILE)){
    File f = SD.open(DIM_FILE, FILE_WRITE); if(f){ f.print("[]"); f.close(); }
  }
  if(!SD.exists(CHAR_FILE)){
    File f = SD.open(CHAR_FILE, FILE_WRITE); if(f){ f.print("[]"); f.close(); }
  }
  if(!SD.exists(ORDER_FILE)){
    File f = SD.open(ORDER_FILE, FILE_WRITE); if(f){ f.print("[]"); f.close(); }
  }
}

// Servir la página principal desde la SD
void handleRoot() {
  if (!sdAvailable) {
    server.send(200, "text/plain", "Error: SD card not found. Please insert an SD card and restart the device.");
    return;
  }
  
  File file = SD.open("/www/index.html");
  if (!file) {
    server.send(500, "text/plain", "Error: index.html not found on SD card");
    return;
  }
  
  server.streamFile(file, "text/html");
  file.close();
}

// Utilidades
String mimeFromPath(const String &path){
  if(path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
  if(path.endsWith(".png")) return "image/png";
  if(path.endsWith(".json")) return "application/json";
  return "text/plain";
}

// API: GET /api/dimensions
void apiDimensions(){
  Serial.println("API call: /api/dimensions");
  String orderRaw = readFileToStringFS(ORDER_FILE);
  DynamicJsonDocument orderDoc(4096);
  deserializeJson(orderDoc, orderRaw);
  JsonArray orderArr = orderDoc.as<JsonArray>();

  String dimsRaw = readFileToStringFS(DIM_FILE);
  DynamicJsonDocument dimsDoc(16384);
  deserializeJson(dimsDoc, dimsRaw);
  JsonArray dimsArr = dimsDoc.as<JsonArray>();

  DynamicJsonDocument outDoc(32768);
  JsonArray outArr = outDoc.to<JsonArray>();

  for (JsonVariant idv : orderArr) {
    String id = idv.as<String>();
    for (JsonObject d : dimsArr) {
      if (String((const char*)d["id"].as<const char*>()) == id) { outArr.add(d); break; }
    }
  }
  for (JsonObject d : dimsArr) {
    String id = String((const char*)d["id"].as<const char*>());
    bool found = false;
    for (JsonVariant idv : orderArr) if (idv.as<String>() == id) { found = true; break; }
    if (!found) outArr.add(d);
  }
  String out; serializeJson(outArr, out);
  server.send(200, "application/json", out);
}

// API: GET /api/characters
void apiCharacters(){
  Serial.println("API call: /api/characters");
  String dimId = server.arg("dim");
  String sortField = server.arg("sort");
  String dir = server.arg("dir"); if(dir.length()==0) dir = "asc";

  String raw = readFileToStringFS(CHAR_FILE);
  DynamicJsonDocument doc(32768);
  deserializeJson(doc, raw);
  JsonArray arr = doc.as<JsonArray>();

  // Load dimensions to enrich characters with dimensionName
  String dimsRaw = readFileToStringFS(DIM_FILE);
  DynamicJsonDocument dimsDoc(16384);
  deserializeJson(dimsDoc, dimsRaw);
  JsonArray dimsArr = dimsDoc.as<JsonArray>();

  DynamicJsonDocument outDoc(32768);
  JsonArray outArr = outDoc.to<JsonArray>();
  for (JsonObject c : arr) {
    if (dimId.length() == 0 || String((const char*)c["dimension"].as<const char*>()) == dimId) outArr.add(c);
  }

  // Enrich dimensionName if missing
  for (JsonObject c : outArr) {
    if (!c.containsKey("dimensionName")) {
      const char* did = c["dimension"];
      if (did) {
        for (JsonObject d : dimsArr) {
          const char* idd = d["id"];
          if (idd && String(idd) == String(did)) {
            const char* nom = d["nombre"] ? d["nombre"] : d["name"];
            if (nom) c["dimensionName"] = nom; else c["dimensionName"] = "";
            break;
          }
        }
      }
    }
  }

  // Simple bubble sort (small lists)
  int n = outArr.size();
  for(int i=0;i<n;i++){
    for(int j=i+1;j<n;j++){
      bool sw=false;
      if(sortField=="name"){
        String a=String((const char*)outArr[i]["nombre"].as<const char*>());
        String b=String((const char*)outArr[j]["nombre"].as<const char*>());
        sw = (dir=="asc") ? (a>b) : (a<b);
      } else if(sortField=="vida"){
        int a = outArr[i]["vida"] | 0; int b = outArr[j]["vida"] | 0; sw = (dir=="asc") ? (a>b) : (a<b);
      }
      if(sw){ JsonObject tmp = outDoc.createNestedObject(); tmp.set(outArr[i]); outArr[i]=outArr[j]; outArr[j]=tmp; }
    }
  }
  String out; serializeJson(outArr, out);
  server.send(200, "application/json", out);
}

// Servir archivos estáticos desde la SD
void handleStaticFile() {
  if (!sdAvailable) {
    server.send(503, "text/plain", "SD card not available");
    return;
  }
  
  String req = server.uri();

  // Depuración: imprimir la ruta solicitada
  Serial.print("Ruta solicitada: ");
  Serial.println(req);

  // Seguridad: prevenir traversal de directorios
  if (req.indexOf("..") >= 0) {
    server.send(403, "text/plain", "Prohibido");
    return;
  }

  // Redirecciones útiles para rutas comunes sin extensión
  if (req == "/dimension") { server.sendHeader("Location", "/dimension.html"); server.send(302); return; }
  if (req == "/character") { server.sendHeader("Location", "/character.html"); server.send(302); return; }
  if (req == "/add") { server.sendHeader("Location", "/add.html"); server.send(302); return; }

  // Normalizar la ruta solicitada a una ruta candidata (puede o no comenzar con /www)
  String candidate;
  if (req.endsWith("/") || req == "/") {
    candidate = "/www/index.html";
  } else if (req.startsWith("/asset/")) {
    // asset paths map directly to SD (remove /asset/)
    candidate = req.substring(6); // removes "/asset"
  } else if (req.endsWith(".css") || req.endsWith(".js") || req.endsWith(".html") || req == "/favicon.ico") {
    // Common static files are expected under /www when requested from the browser
    if (req.startsWith("/www/")) candidate = req; else candidate = String("/www") + req;
  } else {
    // Use the request as-is (allow other routes to map directly)
    candidate = req;
  }

  // Probar dos rutas: la candidata y la alternativa con/sin prefijo /www
  String alt;
  if (candidate.startsWith("/www/")) alt = candidate.substring(4); else alt = String("/www") + candidate;

  // Elegir la primera ruta existente (preferir candidata, luego alternativa)
  String resolvedPath = candidate;
  if (!SD.exists(resolvedPath.c_str())) {
    if (SD.exists(alt.c_str())) resolvedPath = alt;
  }

  // Comprobar si existe versión .gz (respetando resolvedPath)
  String gzPath = resolvedPath + ".gz";
  bool gzipped = SD.exists(gzPath.c_str());

  // Depuración: imprimir la ruta final que se usará
  Serial.print("Ruta resuelta: ");
  Serial.println(gzipped ? gzPath : resolvedPath);
  
  // Verificar si el archivo existe (usar resolvedPath o su variante comprimida)
  if (!SD.exists(gzipped ? gzPath.c_str() : resolvedPath.c_str())) {
    Serial.print("Archivo no encontrado: ");
    Serial.println(resolvedPath);
    // Contingencia CSS: si se pide styles.css pero solo existe style.css
    if (resolvedPath.endsWith("/css/styles.css")) {
      String altCss = "/www/css/style.css"; // legacy name
      if (SD.exists(altCss.c_str())) {
        File fcss = SD.open(altCss.c_str(), FILE_READ);
        if (fcss) {
          server.streamFile(fcss, "text/css");
          fcss.close();
          Serial.println("Served legacy style.css as fallback for styles.css");
          return;
        }
      }
    }
    // Como último recurso, si es un HTML, servir index.html (fallback tipo SPA)
    if (resolvedPath.endsWith(".html")) {
      String fallback = "/www/index.html";
      if (SD.exists(fallback.c_str())) {
        File f2 = SD.open(fallback.c_str(), FILE_READ);
        if (f2) {
          server.streamFile(f2, "text/html");
          f2.close();
          return;
        }
      }
    }
    server.send(404, "text/plain", "Archivo no encontrado: " + resolvedPath);
    return;
  }
  
  // Determinar el tipo de contenido según la extensión
  String contentType = "text/plain";
  if (resolvedPath.endsWith(".html") || resolvedPath.endsWith("/")) {
    contentType = "text/html";
  } else if (resolvedPath.endsWith(".css")) {
    contentType = "text/css";
  } else if (resolvedPath.endsWith(".js")) {
    contentType = "application/javascript";
  } else if (resolvedPath.endsWith(".jpg") || resolvedPath.endsWith(".jpeg")) {
    contentType = "image/jpeg";
  } else if (resolvedPath.endsWith(".png")) {
    contentType = "image/png";
  } else if (resolvedPath.endsWith(".ico")) {
    contentType = "image/x-icon";
  }

  // Depuración: imprimir tipo de contenido y ruta
  Serial.print("Sirviendo archivo: ");
  Serial.print(resolvedPath);
  Serial.print(" as ");
  Serial.println(contentType);

  // Abrir y transmitir el archivo (usar resolvedPath o su variante .gz)
  File file = SD.open(gzipped ? gzPath.c_str() : resolvedPath.c_str(), FILE_READ);
  if (file) {
    // Añadir cabecera de codificación si se sirve comprimido
    if (gzipped) {
      server.sendHeader("Content-Encoding", "gzip");
    }
    
    // Control de caché para archivos estáticos (1 día)
    server.sendHeader("Cache-Control", "public, max-age=86400");
    
    // Transmitir el archivo con el tipo de contenido adecuado
  server.streamFile(file, contentType.c_str());
    file.close();
    
    // Depuración: imprimir mensaje de éxito
    Serial.println("File served successfully");
  } else {
    Serial.println("Error abriendo archivo");
    server.send(500, "text/plain", "Error abriendo archivo");
  }
}

// Servir archivos de recursos (/asset) desde la SD
void handleAsset(){
  String uri = server.uri(); // e.g. /asset/dimensions/123.jpg
  if(!uri.startsWith("/asset/")) { server.send(404, "text/plain", "Not found"); return; }
  String real = uri.substring(6); // /dimensions/...
  if(real.indexOf("..")>=0){ server.send(403); return; }
  if(!sdAvailable){ server.send(503, "text/plain", "SD no disponible"); return; }
  if(!SD.exists(real.c_str())){ server.send(404, "text/plain", "Not found"); return; }
  File f = SD.open(real.c_str(), FILE_READ);
  if(!f){ server.send(500, "text/plain", "File open error"); return; }
  String mime = mimeFromPath(real);
  // Permitir caché de recursos estáticos en el navegador para reducir transferencias
  server.sendHeader("Cache-Control", "public, max-age=86400");
  server.streamFile(f, mime.c_str());
  f.close();
}

// Manejador de subida: dimensión
void handleUploadDimension(){
  HTTPUpload &upload = server.upload();
  static File upFile;
  static String dimId, path;
  static bool rejectUpload = false;
  if(upload.status == UPLOAD_FILE_START){
    rejectUpload = false;
    if(!sdAvailable){
      Serial.println("Subida rechazada: SD no disponible");
      rejectUpload = true;
      return;
    }
    dimId = getTimestampId();
    path = String(DIM_DIR) + "/" + dimId + ".jpg";
    // asegurar directorio
    if(!SD.exists(DIM_DIR)) SD.mkdir(DIM_DIR);
    upFile = SD.open(path.c_str(), FILE_WRITE);
    Serial.print("Subiendo imagen de dimensión -> "); Serial.println(path);
  } else if(upload.status == UPLOAD_FILE_WRITE){
    if(rejectUpload) return;
    if(upFile) upFile.write(upload.buf, upload.currentSize);
  } else if(upload.status == UPLOAD_FILE_END){
    if(rejectUpload) { server.send(503, "text/plain", "SD no disponible"); return; }
    if(upFile) upFile.close();
    // ahora recolectar campos del formulario (server.args())
    String name = server.arg("name"); if(name.length()==0) name = "Sin nombre";
    String desc = server.arg("description");
    String history = server.arg("history");
    // Cargar dimensiones existentes para comprobar duplicados ANTES de guardar
    String existingRaw = readFileToStringFS(DIM_FILE);
    DynamicJsonDocument existingDoc(16384);
    deserializeJson(existingDoc, existingRaw);
    JsonArray existingArr = existingDoc.as<JsonArray>();
    for(JsonObject d : existingArr){
      const char* existingName = d["nombre"] ? d["nombre"] : d["name"];
      if(existingName && String(existingName).equalsIgnoreCase(name)) {
        // duplicado: eliminar la imagen subida y responder
        if(SD.exists(path.c_str())) SD.remove(path.c_str());
        server.send(409, "application/json", "{\"error\":\"La dimensión ya existe\"}");
        Serial.println("Dimension duplicate rejected: " + name);
        return;
      }
    }
    DynamicJsonDocument doc(2048);
    JsonObject obj = doc.to<JsonObject>();
    obj["id"] = dimId;
    obj["nombre"] = name;
    obj["descripcion"] = desc;
    obj["history"] = history;
    obj["image"] = String(DIM_DIR) + "/" + dimId + ".jpg";
    existingArr.add(obj);
    String out; serializeJson(existingDoc, out);
    writeStringToFileFS(DIM_FILE, out);

    String orderRaw = readFileToStringFS(ORDER_FILE);
    DynamicJsonDocument orderDoc(4096);
    deserializeJson(orderDoc, orderRaw);
    JsonArray oarr = orderDoc.as<JsonArray>();
    oarr.add(dimId);
    String orout; serializeJson(orderDoc, orout);
    writeStringToFileFS(ORDER_FILE, orout);

    Serial.println("Dimension creada: " + name);
    String resp = String("{\"ok\":true,\"id\":\"") + dimId + "\"}";
    server.send(200, "application/json", resp);
  }
}

// Manejador de subida: personaje
void handleUploadCharacter(){
  HTTPUpload &upload = server.upload();
  static File upFile;
  static String charId, path;
  static bool rejectUpload = false;
  if(upload.status == UPLOAD_FILE_START){
    rejectUpload = false;
    if(!sdAvailable){
      Serial.println("Subida rechazada: SD no disponible");
      rejectUpload = true;
      return;
    }
    charId = getTimestampId() + String(esp_random() & 0xFFFF, HEX);
    path = String(CHAR_DIR) + "/" + charId + ".jpg";
    if(!SD.exists(CHAR_DIR)) SD.mkdir(CHAR_DIR);
    upFile = SD.open(path.c_str(), FILE_WRITE);
    Serial.print("Subiendo imagen de personaje -> "); Serial.println(path);
  } else if(upload.status == UPLOAD_FILE_WRITE){
    if(rejectUpload) return;
    if(upFile) upFile.write(upload.buf, upload.currentSize);
  } else if(upload.status == UPLOAD_FILE_END){
    if(rejectUpload) { server.send(503, "text/plain", "SD no disponible"); return; }
    if(upFile) upFile.close();
    String nombre = server.arg("nombre"); if(nombre.length()==0) nombre = "SinNombre";
    String dimension = server.arg("dimension");
    String vida = server.arg("vida"); if(vida.length()==0) vida = "0";
    String descripcion = server.arg("descripcion");
    String powers = server.arg("powers"); if(powers.length()==0) powers = "[]";
    String comentarios = server.arg("comentarios");

    // asegurar que la dimensión exista
    String dimRaw = readFileToStringFS(DIM_FILE);
    DynamicJsonDocument dimsDoc(16384);
    deserializeJson(dimsDoc, dimRaw);
    bool dimExists=false;
    for(JsonObject d : dimsDoc.as<JsonArray>()){
      if(String((const char*)d["id"].as<const char*>())==dimension){ dimExists=true; break; }
    }
    if(!dimExists){ Serial.println("Dimension no existe: " + dimension); server.send(400, "application/json", "{\"error\":\"La dimensión no existe\"}"); return; }
    // Cargar personajes existentes para lógica de duplicados y multiverso
    String raw = readFileToStringFS(CHAR_FILE);
    DynamicJsonDocument charsDoc(32768);
    deserializeJson(charsDoc, raw);
    JsonArray carr = charsDoc.as<JsonArray>();
    // Comprobación de duplicado (mismo nombre + misma dimensión)
    for(JsonObject c : carr){
      const char* en = c["nombre"]; const char* ed = c["dimension"];
      if(en && ed && String(en).equalsIgnoreCase(nombre) && String(ed) == dimension){
        if(SD.exists(path.c_str())) SD.remove(path.c_str());
        server.send(409, "application/json", "{\"error\":\"Este personaje ya existe en esta dimensión\"}");
        Serial.println("Personaje duplicado rechazado: " + nombre);
        return;
      }
    }
    // Determinar multiverseId (mismo nombre en otras dimensiones)
    String multiverseId="";
    for(JsonObject c : carr){
      const char* en = c["nombre"]; const char* ed = c["dimension"]; 
      if(en && ed && String(en).equalsIgnoreCase(nombre) && String(ed) != dimension){
        if(c.containsKey("multiverseId")) multiverseId = String((const char*)c["multiverseId"].as<const char*>());
        break;
      }
    }
    if(multiverseId.length()==0){
      bool otherExists=false;
      for(JsonObject c : carr){
        const char* en = c["nombre"]; const char* ed = c["dimension"]; 
        if(en && ed && String(en).equalsIgnoreCase(nombre) && String(ed) != dimension){ otherExists=true; break; }
      }
      if(otherExists) multiverseId = String("mv-") + getTimestampId();
    }
    if(multiverseId.length()>0){
      for(JsonObject c : carr){
        const char* en = c["nombre"]; const char* ed = c["dimension"]; 
        if(en && ed && String(en).equalsIgnoreCase(nombre) && String(ed) != dimension){
          if(!c.containsKey("multiverseId")) c["multiverseId"] = multiverseId;
        }
      }
    }
    DynamicJsonDocument doc(8192);
    JsonObject obj = doc.to<JsonObject>();
    obj["id"] = charId;
    obj["nombre"] = nombre;
    obj["dimension"] = dimension;
    obj["vida"] = atoi(vida.c_str());
    obj["descripcion"] = descripcion;
    obj["foto"] = String(CHAR_DIR) + "/" + charId + ".jpg";
    obj["comentarios"] = comentarios;
    obj["created"] = String((uint32_t)time(nullptr));
    if(multiverseId.length()>0) obj["multiverseId"] = multiverseId;
    DynamicJsonDocument pdoc(4096);
    DeserializationError perr = deserializeJson(pdoc, powers);
    if(!perr) obj["powers"] = pdoc.as<JsonArray>(); else obj.createNestedArray("powers");
    carr.add(obj);
    String out; serializeJson(charsDoc, out);
    writeStringToFileFS(CHAR_FILE, out);
    Serial.println("Personaje creado: " + nombre);
    String resp = String("{\"ok\":true,\"id\":\"")+charId+"\"" + (multiverseId.length()>0? (",\"multiverseId\":\""+multiverseId+"\"") : "") + "}";
    server.send(200, "application/json", resp);
  }
}

void handleNotFound(){
  String uri = server.uri();
  // Registrar peticiones no encontradas para depuración
  Serial.print("NotFound request: ");
  Serial.println(uri);
  Serial.print("Method: "); Serial.println(server.method());
  // Imprimir algunas cabeceras para contexto
  Serial.print("Host: "); Serial.println(server.hostHeader());
  Serial.print("User-Agent: "); Serial.println(server.header("User-Agent"));

  // Intentar manejar archivos estáticos como último recurso
  if(uri.startsWith("/asset/")) { handleAsset(); return; }
  // Delegar cualquier recurso estático típico (incluye .html) a handleStaticFile
  if (uri.startsWith("/css/") || uri.startsWith("/js/") || uri.startsWith("/img/") || uri.endsWith(".css") || uri.endsWith(".js") || uri.endsWith(".html") || uri == "/favicon.ico") {
    Serial.println("NotFound -> delegating to handleStaticFile (static extension)");
    handleStaticFile();
    return;
  }

  server.send(404, "text/plain", "No encontrado");
}

// Diagnóstico: listar contenidos de la SD para solución de problemas
void handleList(){
  if(!sdAvailable){ server.send(503, "text/plain", "SD no disponible"); return; }
  String out = "SD contents check:\n";
  // Check common paths
  const char* checks[] = {"/www/index.html","/www/css/style.css","/www/js/app.js","/css/style.css","/js/app.js","/img/placeholder.jpg","/www/img/placeholder.jpg","/data/dimensions.json","/dimensions","/characters"};
  for(size_t i=0;i<sizeof(checks)/sizeof(checks[0]);i++){
    String p = String(checks[i]);
    out += p + String(" -> ") + (SD.exists(p.c_str())?"EXISTS":"MISSING") + "\n";
  }

  // If /www exists, list its entries
  if(SD.exists("/www")){
    out += "\n/www directory:\n";
    File dir = SD.open("/www");
    if(dir && dir.isDirectory()){
      File entry = dir.openNextFile();
      while(entry){
        out += String(entry.name()) + (entry.isDirectory()?"/\n":"\n");
        entry.close();
        entry = dir.openNextFile();
      }
      dir.close();
    } else {
      out += "(cannot open /www)\n";
    }
  }

  server.send(200, "text/plain", out);
}

void setup(){
  Serial.begin(115200);
  delay(500);
  Serial.println("Iniciando servidor simple...");
  // Initialize SPI with VSPI pins and SD card (CS=5, SCK=18, MISO=19, MOSI=23)
  SPI.begin(18, 19, 23, 5);
  if(tryInitSD()){
    ensureFoldersFS();
  } else {
    Serial.println("Continuing without SD. Uploads and asset serving will be disabled.");
  }

  WiFi.mode(WIFI_STA);
  if(!WiFi.config(local_IP, gateway, subnet, primaryDNS)) Serial.println("WiFi.config failed; using DHCP");
  WiFi.begin(ssid, password);
  Serial.print("Connecting WiFi");
  int tries=0;
  while(WiFi.status()!=WL_CONNECTED && tries<40){ Serial.print('.'); delay(500); tries++; }
  if(WiFi.status()!=WL_CONNECTED) Serial.println("\nWiFi failed"); else Serial.println("\nConnected: " + WiFi.localIP().toString());

  // Sincronización NTP para marcas de tiempo precisas
  if(WiFi.status()==WL_CONNECTED){
    Serial.println("Configuring NTP time...");
    configTime(0, 0, "pool.ntp.org", "time.nist.gov"); // UTC; client renders local time
    time_t now = 0; int ttries=0;
    while(now < 1700000000 && ttries < 20){ // wait until ~2023+
      now = time(nullptr);
      Serial.print("."); delay(500); ttries++;
    }
    Serial.println();
    if(now >= 1700000000) {
      Serial.printf("Time synced: %lu\n", (unsigned long)now);
    } else {
      Serial.println("Time sync not confirmed; proceeding with fallback timestamps.");
    }
  }

  // Rutas
  // Endpoints de API primero (para que no los capture el manejador genérico)
  server.on("/api/status", HTTP_GET, []() {
    DynamicJsonDocument doc(128);
    doc["sdAvailable"] = sdAvailable;
    String json;
    serializeJson(doc, json);
    server.send(200, "application/json", json);
  });
  // Endpoints de API para datos
  server.on("/api/dimensions", HTTP_GET, apiDimensions);
  server.on("/api/characters", HTTP_GET, apiCharacters);
  // Guardar archivo completo de personajes (reemplaza characters.json)
  server.on("/api/saveCharacters", HTTP_POST, [](){
    if(!sdAvailable){ server.send(503, "application/json", "{\"error\":\"SD no disponible\"}"); return; }
    String body = server.arg("plain");
    if(body.length()==0){ server.send(400, "application/json", "{\"error\":\"Cuerpo vacío\"}"); return; }
    DynamicJsonDocument doc(131072); // ~128KB para listas grandes
    DeserializationError err = deserializeJson(doc, body);
    if(err){ server.send(400, "application/json", "{\"error\":\"JSON inválido\"}"); return; }
    if(!doc.is<JsonArray>()){ server.send(400, "application/json", "{\"error\":\"Se espera un array\"}"); return; }
    String out; serializeJson(doc, out);
    if(!writeStringToFileFS(CHAR_FILE, out)){ server.send(500, "application/json", "{\"error\":\"No se pudo escribir archivo\"}"); return; }
    server.send(200, "application/json", "{\"ok\":true}" );
  });
  
  // Servir archivos estáticos
  server.on("/", HTTP_GET, handleRoot);
  // Páginas principales explícitas (asegurar que estas rutas se manejen)
  server.on("/index.html", HTTP_GET, handleStaticFile);
  server.on("/dimension.html", HTTP_GET, handleStaticFile);
  server.on("/character.html", HTTP_GET, handleStaticFile);
  server.on("/add.html", HTTP_GET, handleStaticFile);
  // Rutas estáticas comunes explícitas (mejorar logging y asegurar coincidencia)
  server.on("/css/*", HTTP_GET, [](){ Serial.println("Incoming request (css)"); handleStaticFile(); });
  server.on("/js/*", HTTP_GET, [](){ Serial.println("Incoming request (js)"); handleStaticFile(); });
  server.on("/img/*", HTTP_GET, [](){ Serial.println("Incoming request (img)"); handleStaticFile(); });
  // Listado de diagnóstico
  server.on("/ls", HTTP_GET, handleList);
  // Captura estáticos genéricos DESPUÉS de las APIs
  server.on("/*", HTTP_GET, handleStaticFile);
  
  // El manejo de /asset ahora lo hace handleStaticFile

  // Endpoints de subida: WebServer llama al handler y al callback de subida por separado
  // Respuesta gestionada dentro de los callbacks de subida (evitar doble envío)
  server.on("/upload/dimension", HTTP_POST, [](){ if(!sdAvailable) server.send(503, "application/json", "{\"error\":\"SD no disponible\"}"); }, handleUploadDimension);
  server.on("/upload/character", HTTP_POST, [](){ if(!sdAvailable) server.send(503, "application/json", "{\"error\":\"SD no disponible\"}"); }, handleUploadCharacter);

  server.onNotFound(handleNotFound);

  server.begin();
  Serial.println("Servidor iniciado (simple)");
}

void loop(){
  server.handleClient();
}
