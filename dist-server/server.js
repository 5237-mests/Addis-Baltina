// src/server/env.ts
try {
  const loadEnvFile = process.loadEnvFile;
  loadEnvFile?.();
} catch {
}

// server.ts
import express2 from "express";
import { createServer } from "http";

// src/server/app.ts
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import crypto3 from "crypto";

// src/server/db.ts
import crypto from "crypto";

// src/server/config.ts
function readNumber(name, fallback) {
  const raw = process.env[name];
  if (raw === void 0 || raw.trim() === "") return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    console.warn(`[config] ${name}="${raw}" is not a number; using default ${fallback}.`);
    return fallback;
  }
  return value;
}
function loadCommerceConfig() {
  return {
    freeDeliveryThreshold: readNumber("DELIVERY_FREE_THRESHOLD", 1200),
    flatDeliveryFee: readNumber("DELIVERY_FLAT_FEE", 100),
    taxRate: readNumber("TAX_RATE", 0)
  };
}
var commerceConfig = loadCommerceConfig();

// src/server/logger.ts
var SENSITIVE_KEY = /pass(word)?|secret|token|authorization|cookie|initdata|apikey|api_key/i;
var MAX_DEPTH = 4;
function redact(value, depth = 0) {
  if (value === null || typeof value !== "object") return value;
  if (depth >= MAX_DEPTH) return "[truncated]";
  if (Array.isArray(value)) return value.map((item) => redact(item, depth + 1));
  const out = {};
  for (const [key, val] of Object.entries(value)) {
    out[key] = SENSITIVE_KEY.test(key) ? "[redacted]" : redact(val, depth + 1);
  }
  return out;
}
function write(level, msg, fields) {
  const line = {
    ts: (/* @__PURE__ */ new Date()).toISOString(),
    level,
    msg,
    ...fields ? redact(fields) : {}
  };
  const text = `${JSON.stringify(line)}
`;
  if (level === "error") process.stderr.write(text);
  else process.stdout.write(text);
}
function make(base = {}) {
  return {
    debug: (msg, fields) => write("debug", msg, { ...base, ...fields }),
    info: (msg, fields) => write("info", msg, { ...base, ...fields }),
    warn: (msg, fields) => write("warn", msg, { ...base, ...fields }),
    error: (msg, fields) => write("error", msg, { ...base, ...fields }),
    child: (fields) => make({ ...base, ...fields })
  };
}
var logger = make();

// src/server/db.ts
var NOTIFICATION_LIMIT = 200;
var AUDIT_LOG_LIMIT = 500;
var INVENTORY_TX_LIMIT = 1e3;
function stableStringify(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const obj = value;
  return `{${Object.keys(obj).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(obj[key])}`).join(",")}}`;
}
var DatabaseStore = class {
  categories = /* @__PURE__ */ new Map();
  products = /* @__PURE__ */ new Map();
  orders = /* @__PURE__ */ new Map();
  inventoryTransactions = [];
  auditLogs = [];
  notifications = [];
  idempotencyKeys = /* @__PURE__ */ new Map();
  listeners = /* @__PURE__ */ new Set();
  constructor() {
    this.seedInitialData();
  }
  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  // --- Bounded collection helpers -----------------------------------------
  addNotification(notif) {
    this.notifications.unshift(notif);
    if (this.notifications.length > NOTIFICATION_LIMIT) {
      this.notifications.length = NOTIFICATION_LIMIT;
    }
  }
  addAuditLog(log) {
    this.auditLogs.unshift(log);
    if (this.auditLogs.length > AUDIT_LOG_LIMIT) {
      this.auditLogs.length = AUDIT_LOG_LIMIT;
    }
  }
  addInventoryTransaction(tx) {
    this.inventoryTransactions.push(tx);
    if (this.inventoryTransactions.length > INVENTORY_TX_LIMIT) {
      this.inventoryTransactions.splice(0, this.inventoryTransactions.length - INVENTORY_TX_LIMIT);
    }
  }
  broadcast(event, data) {
    this.listeners.forEach((cb) => {
      try {
        cb(event, data);
      } catch (err) {
        logger.warn("sse_broadcast_failed", {
          event,
          error: err instanceof Error ? err.message : String(err)
        });
      }
    });
  }
  seedInitialData() {
    const seedCategories = [
      {
        id: "cat-spices",
        slug: "spices",
        name_en: "Spices & Blends",
        name_am: "\u1245\u1218\u121B \u1245\u1218\u121E\u127D",
        name_om: "Urgooftuu fi Mi'eessituu",
        description_en: "Authentic stone-ground Ethiopian spice blends & whole spices",
        description_am: "\u1260\u1263\u1205\u120B\u12CA \u1218\u1295\u1308\u12F5 \u12E8\u1270\u12F0\u1208\u12D9\u1293 \u12E8\u1270\u12D8\u130B\u1301 \u12E8\u1200\u1308\u122D \u1264\u1275 \u1245\u1218\u121E\u127D",
        description_om: "Mi'eessituu aadaa Itoophiyaa qulqullina olaanaa qaban",
        icon: "Flame",
        display_order: 1
      },
      {
        id: "cat-flours",
        slug: "flours-grains",
        name_en: "Flours & Grains",
        name_am: "\u12A5\u1205\u120E\u127D\u1293 \u12F1\u1244\u1275",
        name_om: "Midhaan fi Daakuu",
        description_en: "Authentic Ethiopian Teff, Beso, Bula, and Shiro grains",
        description_am: "\u1295\u1339\u1205 \u12E8\u1200\u1308\u122D \u1264\u1275 \u1324\u134D\u1363 \u1260\u1236\u1363 \u1261\u120B \u12A5\u1293 \u12E8\u123D\u122E \u1325\u122B\u1325\u122C\u12CE\u127D",
        description_om: "Daakuu Xaafii qulqulluu, Bulaa fi Baasoo",
        icon: "Wheat",
        display_order: 2
      },
      {
        id: "cat-pastes",
        slug: "pastes-condiments",
        name_en: "Pastes & Sauces",
        name_am: "\u12A0\u12CB\u12DC\u1293 \u121B\u1323\u1348\u132B",
        name_om: "Ittoo fi Dhadhaa",
        description_en: "Traditional Awaze paste, spiced butters, and table condiments",
        description_am: "\u12E8\u1270\u1208\u12E8 \u1323\u12D5\u121D \u12EB\u1208\u12CD \u12A0\u12CB\u12DC\u1363 \u12E8\u1295\u1325\u122D \u1245\u1264 \u12A5\u1293 \u120C\u120E\u127D \u121B\u1323\u1348\u132B\u12CE\u127D",
        description_om: "Awaazee fi mi'eessitoota aadaa addaa",
        icon: "Soup",
        display_order: 3
      },
      {
        id: "cat-snacks",
        slug: "traditional-snacks",
        name_en: "Traditional Snacks",
        name_am: "\u12E8\u1263\u1205\u120D \u1218\u12AD\u1230\u1236\u127D",
        name_om: "Nyaata Aadaa",
        description_en: "Roasted Kollo, Dabo Kolo, and wholesome dry-roasted snacks",
        description_am: "\u1325\u122D\u1275 \u12EB\u1208 \u12E8\u1246\u120E \u1245\u120D\u1245\u120D \u12A5\u1293 \u12E8\u12F3\u1266 \u1246\u120E",
        description_om: "Qolloofi dabboo qolloo aadaa",
        icon: "Cookie",
        display_order: 4
      },
      {
        id: "cat-coffee",
        slug: "coffee-beverages",
        name_en: "Coffee & Baltina Drinks",
        name_am: "\u1261\u1293\u1293 \u1218\u1320\u1326\u127D",
        name_om: "Buna fi Dhugaatii",
        description_en: "Fresh roasted Ethiopian heirloom coffee and herbal infusions",
        description_am: "\u1275\u12A9\u1235 \u12E8\u1270\u1246\u120B \u12E8\u12ED\u122D\u130B\u1328\u134C \u1261\u1293 \u12A5\u1293 \u12E8\u1263\u1205\u120D \u1218\u1320\u1326\u127D",
        description_om: "Buna aadaa Yirgaacaffee fi dhugaatiiwwan biroo",
        icon: "Coffee",
        display_order: 5
      }
    ];
    seedCategories.forEach((cat) => this.categories.set(cat.id, cat));
    const seedProducts = [
      {
        id: "prod-berbere-special",
        category_id: "cat-spices",
        sku: "AB-SP-001",
        name_en: "Special Blend Berbere (\u12E8\u12F0\u1208\u12D8 \u1260\u122D\u1260\u122C)",
        name_am: "\u120D\u12E9 \u12E8\u12F0\u1208\u12D8 \u1260\u122D\u1260\u122C",
        name_om: "Barbaree Aadaa Addaa",
        description_en: "Artisan sun-dried red chili pepper stone-milled with 17 traditional aromatic herbs, korerima, garlic, and ginger. Perfectly balanced heat.",
        description_am: "\u126017 \u12E8\u1200\u1308\u122D \u1264\u1275 \u1245\u1218\u121E\u127D\u1363 \u12AE\u1228\u122A\u121B \u12A5\u1293 \u1290\u132D \u123D\u1295\u12A9\u122D\u1275 \u1260\u1325\u1295\u1243\u1244 \u12E8\u1270\u12F0\u1208\u12D8\u1293 \u1208\u12C8\u1325 \u12E8\u1270\u12D8\u130B\u1300 \u120D\u12E9 \u1260\u122D\u1260\u122C\u1362",
        description_om: "Barbaree mi'eessituu aadaa 17 waliin qophaa'e, ittoo doroofi fooniif kan ta'u.",
        price: 450,
        stock: 35,
        min_stock_alert: 8,
        unit: "500g",
        image_url: "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=600&q=80",
        is_active: true,
        is_featured: true,
        origin: "Addis Ababa & Gojjam, Ethiopia",
        ingredients_en: "Sun-dried red peppers, Korerima, Garlic, Ginger, Besobila, Ruta chalepensis (Tena Adam), Salt",
        usage_en: "Essential for Doro Wot, Sega Wot, and Missir Wot."
      },
      {
        id: "prod-shiro-special",
        category_id: "cat-flours",
        sku: "AB-FL-002",
        name_en: "Spiced Shiro Powder (\u121A\u1325\u121A\u1323 \u123D\u122E)",
        name_am: "\u12E8\u1270\u1240\u1218\u1218 \u12E8\u123D\u122E \u12F1\u1244\u1275",
        name_om: "Daakuu Shiroo Qophaa'aa",
        description_en: "Premium roasted chickpeas and split peas delicately spiced and ground to a silky flour. Produces rich, velvety Shiro Tegabino.",
        description_am: "\u1325\u122B\u1275 \u12AB\u1208\u12CD \u123D\u121D\u1265\u122B \u1270\u1320\u122D\u130E\u1363 \u1270\u1246\u120D\u1276\u1293 \u1270\u1240\u121E \u12E8\u1270\u1348\u1328 \u120D\u1235\u120D\u1235 \u12E8\u123D\u122E \u12F1\u1244\u1275\u1362",
        description_om: "Daakuu shiroo shimbraa qulqulluu irraa qophaa'e, nyaata teegabiinoof baay'ee gaarii.",
        price: 340,
        stock: 45,
        min_stock_alert: 10,
        unit: "500g",
        image_url: "https://images.unsplash.com/photo-1509358271058-acd22cc93898?auto=format&fit=crop&w=600&q=80",
        is_active: true,
        is_featured: true,
        origin: "Gondar & Addis Ababa, Ethiopia",
        ingredients_en: "Roasted chickpeas, Split field peas, Garlic, Korerima, Ginger, Basil, Mild chili",
        usage_en: "Boil with saut\xE9ed onions, garlic, and oil or spiced butter for 10-15 mins."
      },
      {
        id: "prod-mitmita",
        category_id: "cat-spices",
        sku: "AB-SP-003",
        name_en: "Addis Authentic Mitmita (\u121A\u1325\u121A\u1323)",
        name_am: "\u12E8\u1200\u1260\u123B \u1295\u1339\u1205 \u121A\u1325\u121A\u1323",
        name_om: "Mitmiitaa Aadaa",
        description_en: "Fiery small bird's eye chilies roasted with black cardamom, cloves, and sea salt. Unmatched intensity and floral heat.",
        description_am: "\u1260\u1323\u121D \u12E8\u121A\u12EB\u1243\u1325\u120D \u1295\u1339\u1205 \u12E8\u1200\u1308\u122D \u1264\u1275 \u121A\u1325\u121A\u1323 \u12A8\u12AE\u1228\u122A\u121B \u12A5\u1293 \u1245\u122D\u1295\u1349\u12F5 \u130B\u122D\u1362 \u1208\u12AD\u1275\u134E \u12A5\u1293 \u1208\u1325\u1265\u1235 \u1270\u1218\u122B\u132D\u1362",
        description_om: "Mitmiitaa gubaadhaafi fooli gaarii qabu, kitfoofi xibsiif kan oolu.",
        price: 380,
        stock: 28,
        min_stock_alert: 5,
        unit: "250g",
        image_url: "https://images.unsplash.com/photo-1583032015879-66c3038676d5?auto=format&fit=crop&w=600&q=80",
        is_active: true,
        is_featured: true,
        origin: "Gurage zone, Ethiopia",
        ingredients_en: "Piri-piri bird-eye chili, Korerima pods, Cloves, Sea salt",
        usage_en: "Sprinkle directly onto Kitfo, Dulet, roasted meat, or boiled vegetables."
      },
      {
        id: "prod-korerima",
        category_id: "cat-spices",
        sku: "AB-SP-004",
        name_en: "Whole Hand-Peeled Korerima (\u12AE\u1228\u122A\u121B)",
        name_am: "\u12E8\u1270\u120B\u1320 \u12AE\u1228\u122A\u121B (\u1325\u1241\u122D \u1204\u120D)",
        name_om: "Korerimaa Qulqulluu",
        description_en: "Ethiopian black cardamom pods with smoky, resinous notes. Essential for gourmet stews, clarified butter, and coffee.",
        description_am: "\u1295\u1339\u1205 \u1325\u1241\u122D \u12AE\u1228\u122A\u121B \u1208\u1295\u1325\u122D \u1245\u1264\u1363 \u1208\u1235\u130B \u12C8\u1325 \u12A5\u1293 \u1208\u1261\u1293 \u120D\u12E9 \u1218\u12D3\u12DB\u1293 \u1323\u12D5\u121D \u12E8\u121A\u1230\u1325\u1362",
        description_om: "Mi'eessituu aadaa fooli addaa qabu, doroofi bunaaf kan fayyadu.",
        price: 580,
        stock: 18,
        min_stock_alert: 5,
        unit: "250g",
        image_url: "https://images.unsplash.com/photo-1508746829417-e6f548d8d6ed?auto=format&fit=crop&w=600&q=80",
        is_active: true,
        is_featured: false,
        origin: "Keffa & Wollega, Ethiopia",
        ingredients_en: "100% Ethiopian Black Cardamom (Aframomum corrorima)",
        usage_en: "Crush seeds fresh into coffee or grind into spice mixes."
      },
      {
        id: "prod-mekelesha",
        category_id: "cat-spices",
        sku: "AB-SP-005",
        name_en: "Mekelesha Finishing Spice (\u1218\u12A8\u1208\u123B)",
        name_am: "\u12E8\u12C8\u1325 \u121B\u12C8\u122B\u1228\u1303 \u1218\u12A8\u1208\u123B",
        name_om: "Makkalashaa Aadaa",
        description_en: "The legendary finishing spice added in the final 5 minutes of stew simmering: cinnamon, cloves, cardamom, nutmeg, and black pepper.",
        description_am: "\u12C8\u1325 \u12A8\u1218\u12CD\u1228\u12F1 \u1325\u1242\u1275 \u12F0\u1242\u1243\u12CE\u127D \u1260\u134A\u1275 \u12E8\u121A\u1328\u1218\u122D 7 \u120D\u12E9 \u1245\u1218\u121E\u127D\u1295 \u12EB\u1240\u1348 \u1218\u12D3\u12DB \u1230\u132A \u1218\u12A8\u1208\u123B\u1362",
        description_om: "Mi'eessituu dhuma ittoo irratti naqamu fooliifi dhandhama addaatiif.",
        price: 420,
        stock: 22,
        min_stock_alert: 5,
        unit: "250g",
        image_url: "https://images.unsplash.com/photo-1532336414038-cf19250c5757?auto=format&fit=crop&w=600&q=80",
        is_active: true,
        is_featured: false,
        origin: "Addis Ababa, Ethiopia",
        ingredients_en: "Cinnamon, Korerima, Cloves, Nutmeg, Long Pepper, Cumin",
        usage_en: "Stir in 1 tsp during the final 3 minutes of cooking Doro Wot or beef stew."
      },
      {
        id: "prod-kibbeh-spices",
        category_id: "cat-spices",
        sku: "AB-SP-006",
        name_en: "Traditional Niter Kibbeh Herbal Blend (\u12E8\u1245\u1264 \u1245\u1218\u121D)",
        name_am: "\u12E8\u1270\u121F\u120B \u12E8\u1295\u1325\u122D \u1245\u1264 \u1245\u1218\u121D",
        name_om: "Mi'eessituu Dhadhaa Naxiraa",
        description_en: "The complete herbal medley needed to clarify pure Ethiopian butter: Kosseret (Lippia abyssinica), Besobila, Tena Adam, and Fenugreek.",
        description_am: "\u12AE\u1230\u1228\u1275\u1363 \u1260\u1236\u1265\u120B\u1363 \u1324\u1293 \u12A0\u12F3\u121D \u12A5\u1293 \u120C\u120E\u127D \u12E8\u1245\u1264 \u1245\u1218\u121E\u127D \u1270\u1323\u121D\u1228\u12CD \u12E8\u1270\u12D8\u130B\u1301\u1362",
        description_om: "Koseeratiifi baala aadaa dhadhaa naxiruuf fayyadu.",
        price: 490,
        stock: 15,
        min_stock_alert: 4,
        unit: "300g",
        image_url: "https://images.unsplash.com/photo-1628088062854-d1870b4553da?auto=format&fit=crop&w=600&q=80",
        is_active: true,
        is_featured: true,
        origin: "Shoa, Ethiopia",
        ingredients_en: "Kosseret, Besobila, Turmeric, Abish (Fenugreek), Korerima, Tena Adam",
        usage_en: "Simmer with 1kg unsalted organic butter on low heat for 45 minutes."
      },
      {
        id: "prod-teff-flour",
        category_id: "cat-flours",
        sku: "AB-FL-007",
        name_en: "Ada'a White Teff Flour (\u12E8\u1290\u132D \u1324\u134D \u12F1\u1244\u1275)",
        name_am: "\u12E8\u12A0\u12F0\u12A0 \u1295\u1339\u1205 \u12E8\u1290\u132D \u1324\u134D \u12F1\u1244\u1275",
        name_om: "Daakuu Xaafii Adii Ada'aa",
        description_en: "Direct from Ada'a (Debre Zeyit), the gold standard for silky, porous, flexible Injera with authentic pleasant tang.",
        description_am: "\u1260\u1325\u1295\u1243\u1244 \u1270\u1260\u1325\u122E\u1293 \u1270\u1218\u122D\u1326 \u12E8\u1270\u1348\u1328 \u1325\u122B\u1275 \u12EB\u1208\u12CD \u12E8\u12A0\u12F0\u12A0 \u1290\u132D \u1324\u134D \u12F1\u1244\u1275\u1362",
        description_om: "Xaafii adii Ada'aa irraa kan dhufe, buddeena lallaafaa qopheessuuf kan oolu.",
        price: 650,
        stock: 50,
        min_stock_alert: 10,
        unit: "2kg",
        image_url: "https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&w=600&q=80",
        is_active: true,
        is_featured: true,
        origin: "Ada'a, Bishoftu, Ethiopia",
        ingredients_en: "100% Whole Grain White Eragrostis tef",
        usage_en: "Mix with water and Ersho (starter culture) to ferment for 3-4 days."
      },
      {
        id: "prod-beso",
        category_id: "cat-flours",
        sku: "AB-FL-008",
        name_en: "Addis Beso Powder (\u12E8\u1260\u1236 \u12F1\u1244\u1275)",
        name_am: "\u1325\u1229 \u12E8\u1260\u1236 \u12F1\u1244\u1275",
        name_om: "Daakuu Baasoo Aadaa",
        description_en: "Gently roasted barley ground to fine powder. Mix with cold water, honey, or hot clarified butter for instant, nutritious energy.",
        description_am: "\u1260\u1325\u1295\u1243\u1244 \u12A8\u1270\u1246\u120B \u1308\u1265\u1235 \u12E8\u1270\u1348\u1328 \u1323\u134B\u132D \u12E8\u1260\u1236 \u12F1\u1244\u1275\u1362 \u1208\u1348\u1323\u1295 \u1241\u122D\u1235 \u12C8\u12ED\u121D \u1218\u1320\u1325\u1362",
        description_om: "Daakuu garbuu gubame irraa qophaa'e, damma ykn aannan waliin dhugama.",
        price: 260,
        stock: 30,
        min_stock_alert: 6,
        unit: "500g",
        image_url: "https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=600&q=80",
        is_active: true,
        is_featured: false,
        origin: "North Shoa, Ethiopia",
        ingredients_en: "100% Hulled Roasted Barley",
        usage_en: "Shake 3 tbsp in water with honey for Beso drink or knead with butter for Chiko."
      },
      {
        id: "prod-awaze",
        category_id: "cat-pastes",
        sku: "AB-PS-009",
        name_en: "Artisan Awaze Paste (\u12E8\u1270\u12D8\u130B\u1300 \u12A0\u12CB\u12DC)",
        name_am: "\u12E8\u1270\u1208\u12E8 \u1263\u1205\u120B\u12CA \u12A0\u12CB\u12DC",
        name_om: "Awaazee Aadaa Qophaa'aa",
        description_en: "Slow-cured paste made with select berbere, aged honey wine essence, garlic, ginger, and lemon juice. The ultimate pairing for grilled Tibs.",
        description_am: "\u12A8\u1260\u122D\u1260\u122C\u1363 \u12A8\u1320\u1305 \u12C8\u1208\u120B\u1363 \u1290\u132D \u123D\u1295\u12A9\u122D\u1275\u1293 \u12DD\u1295\u1305\u1265\u120D \u130B\u122D \u12E8\u1270\u12CB\u1203\u12F0 \u121D\u122D\u1325 \u12A0\u12CB\u12DC\u1362",
        description_om: "Awaazee dhandhama dammaafi barbaree qabu, xibsiif kan mijatu.",
        price: 320,
        stock: 25,
        min_stock_alert: 6,
        unit: "350g",
        image_url: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80",
        is_active: true,
        is_featured: true,
        origin: "Addis Ababa, Ethiopia",
        ingredients_en: "Premium Berbere, Garlic, Ginger, Pure Honey, Tej essence, Lemon, Salt",
        usage_en: "Serve alongside Tibs, Derek Tibs, or raw Kitfo."
      },
      {
        id: "prod-kollo",
        category_id: "cat-snacks",
        sku: "AB-SN-010",
        name_en: "Addis Mixed Roasted Kollo (\u12E8\u1246\u120E \u1245\u120D\u1245\u120D)",
        name_am: "\u12E8\u1270\u1320\u1260\u1230 \u12E8\u1246\u120E \u1245\u120D\u1245\u120D",
        name_om: "Qolloo Walmakaa",
        description_en: "Crunchy roasted whole barley, salted chickpeas, peanuts, and peeled sunflower seeds. Traditional accompaniment for Ethiopian coffee ceremonies.",
        description_am: "\u12A8\u1270\u1218\u1228\u1320 \u1308\u1265\u1235\u1363 \u123D\u121D\u1265\u122B\u1363 \u12A6\u127E\u120E\u1292 \u12A5\u1293 \u1231\u134D \u12E8\u1270\u1320\u1260\u1230 \u1246\u120E \u1208\u1261\u1293 \u1241\u122D\u1235\u1362",
        description_om: "Garbuu, shimbraafi ooyila walmakaa gubame, sirna bunaatiif.",
        price: 190,
        stock: 60,
        min_stock_alert: 12,
        unit: "400g",
        image_url: "https://images.unsplash.com/photo-1599599810769-bcde5a160d32?auto=format&fit=crop&w=600&q=80",
        is_active: true,
        is_featured: false,
        origin: "Addis Ababa, Ethiopia",
        ingredients_en: "Roasted Barley, Chickpeas, Peanuts, Sunflower seeds, Salt",
        usage_en: "Enjoy with hot coffee or as a wholesome daily snack."
      },
      {
        id: "prod-yirgacheffe-coffee",
        category_id: "cat-coffee",
        sku: "AB-CF-011",
        name_en: "Yirgacheffe Baltina Roast (\u12ED\u122D\u130B\u1328\u134C \u1261\u1293)",
        name_am: "\u120D\u12E9 \u12E8\u12ED\u122D\u130B\u1328\u134C \u12E8\u1270\u1246\u120B \u1261\u1293",
        name_om: "Buna Yirgaacaffee Qulqulluu",
        description_en: "Medium artisan drum-roasted Arabica heirloom coffee with jasmine floral notes, bright citrus, and honey undertones.",
        description_am: "\u1260\u120D\u12E9 \u1219\u12EB \u12E8\u1270\u1246\u120B \u12E8\u12ED\u122D\u130B\u1328\u134C \u1261\u1293\u1363 \u1325\u1229 \u1218\u12D3\u12DB\u1293 \u12E8\u12C8\u1270\u1275 \u1278\u12AE\u120C\u1275 \u1323\u12D5\u121D \u12EB\u1208\u12CD\u1362",
        description_om: "Buna Yirgaacaffee fooli daraaraafi dhandhama dammaa qabu.",
        price: 680,
        stock: 20,
        min_stock_alert: 5,
        unit: "500g",
        image_url: "https://images.unsplash.com/photo-1559056199-641a0ac8b55e?auto=format&fit=crop&w=600&q=80",
        is_active: true,
        is_featured: true,
        origin: "Yirgacheffe, Gedeo, Ethiopia",
        ingredients_en: "100% Ethiopian Arabica Specialty Coffee Beans",
        usage_en: "Grind fresh and brew in traditional Jebena or French press."
      }
    ];
    seedProducts.forEach((prod) => this.products.set(prod.id, prod));
    const initialOrder = {
      id: "AB-2026-1048",
      customer_name: "Almaz Tadesse",
      customer_phone: "+251 911 234 567",
      delivery_subcity: "Bole",
      delivery_woreda: "03",
      delivery_landmark: "Near Edna Mall, Atlas Hotel area",
      delivery_notes: "Please call when arriving at gate",
      payment_method: "TELEBIRR",
      payment_reference: "TB-982148124",
      status: "PROCESSING",
      subtotal: 1170,
      delivery_fee: 0,
      tax: 0,
      total: 1170,
      source: "WEB",
      items: [
        {
          id: "item-1",
          order_id: "AB-2026-1048",
          product_id: "prod-berbere-special",
          product_name: "Special Blend Berbere (\u12E8\u12F0\u1208\u12D8 \u1260\u122D\u1260\u122C)",
          unit_price: 450,
          quantity: 2,
          subtotal: 900
        },
        {
          id: "item-2",
          order_id: "AB-2026-1048",
          product_id: "prod-beso",
          product_name: "Addis Beso Powder (\u12E8\u1260\u1236 \u12F1\u1244\u1275)",
          unit_price: 260,
          quantity: 1,
          subtotal: 260
        }
      ],
      created_at: new Date(Date.now() - 36e5 * 4).toISOString(),
      updated_at: new Date(Date.now() - 36e5 * 2).toISOString()
    };
    const initialOrder2 = {
      id: "AB-2026-1049",
      customer_name: "Dawit Bekele",
      customer_phone: "+251 922 876 543",
      delivery_subcity: "Yeka",
      delivery_woreda: "08",
      delivery_landmark: "Megenagna roundabout, near Zefmesh Mall",
      delivery_notes: "Leave with reception if not home",
      payment_method: "CASH_ON_DELIVERY",
      status: "PENDING",
      subtotal: 720,
      delivery_fee: 100,
      tax: 0,
      total: 820,
      source: "TELEGRAM_MINI_APP",
      items: [
        {
          id: "item-3",
          order_id: "AB-2026-1049",
          product_id: "prod-shiro-special",
          product_name: "Spiced Shiro Powder (\u121A\u1325\u121A\u1323 \u123D\u122E)",
          unit_price: 340,
          quantity: 1,
          subtotal: 340
        },
        {
          id: "item-4",
          order_id: "AB-2026-1049",
          product_id: "prod-mitmita",
          product_name: "Addis Authentic Mitmita (\u121A\u1325\u121A\u1323)",
          unit_price: 380,
          quantity: 1,
          subtotal: 380
        }
      ],
      created_at: new Date(Date.now() - 18e5).toISOString(),
      updated_at: new Date(Date.now() - 18e5).toISOString()
    };
    this.orders.set(initialOrder.id, initialOrder);
    this.orders.set(initialOrder2.id, initialOrder2);
    this.addNotification({
      id: "notif-1",
      title: "New Order Received",
      message: "Order AB-2026-1049 placed via Telegram Mini App by Dawit Bekele (820 ETB).",
      type: "ORDER_UPDATE",
      is_read: false,
      created_at: new Date(Date.now() - 18e5).toISOString(),
      reference_id: "AB-2026-1049"
    });
  }
  // Categories
  getCategories() {
    return Array.from(this.categories.values()).sort((a, b) => a.display_order - b.display_order);
  }
  // Products
  getProducts(options) {
    let prods = Array.from(this.products.values()).filter((p) => p.is_active);
    if (options?.categorySlug && options.categorySlug !== "all") {
      const cat = Array.from(this.categories.values()).find((c) => c.slug === options.categorySlug);
      if (cat) {
        prods = prods.filter((p) => p.category_id === cat.id);
      }
    }
    if (options?.search) {
      const q = options.search.toLowerCase().trim();
      prods = prods.filter(
        (p) => p.name_en.toLowerCase().includes(q) || p.name_am.includes(q) || p.name_om.toLowerCase().includes(q) || p.description_en.toLowerCase().includes(q)
      );
    }
    return prods;
  }
  getProductById(id) {
    return this.products.get(id);
  }
  createProduct(params) {
    const id = `prod-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const newProduct = {
      ...params,
      id
    };
    this.products.set(id, newProduct);
    this.addAuditLog({
      id: `audit-${Date.now()}`,
      action: "PRODUCT_CREATED",
      entity_type: "PRODUCT",
      entity_id: id,
      details: { name: newProduct.name_en, sku: newProduct.sku, image_url: newProduct.image_url },
      performed_by: "ADMIN",
      created_at: (/* @__PURE__ */ new Date()).toISOString()
    });
    this.broadcast("product:created", newProduct);
    return newProduct;
  }
  updateProduct(id, updates) {
    const existing = this.products.get(id);
    if (!existing) return null;
    const updatedProduct = {
      ...existing,
      ...updates
    };
    this.products.set(id, updatedProduct);
    this.addAuditLog({
      id: `audit-${Date.now()}`,
      action: "PRODUCT_UPDATED",
      entity_type: "PRODUCT",
      entity_id: id,
      details: { updates },
      performed_by: "ADMIN",
      created_at: (/* @__PURE__ */ new Date()).toISOString()
    });
    this.broadcast("product:updated", updatedProduct);
    return updatedProduct;
  }
  // Create Order with Authoritative Server Pricing & Stock Decrement & Idempotency
  createOrder(params) {
    const payloadHash = crypto.createHash("sha256").update(stableStringify({ ...params, idempotency_key: void 0 })).digest("hex");
    if (params.idempotency_key) {
      const record = this.idempotencyKeys.get(params.idempotency_key);
      if (record) {
        if (record.payloadHash !== payloadHash) {
          return {
            success: false,
            error: "This idempotency key was already used with a different order.",
            code: "IDEMPOTENCY_KEY_REUSE"
          };
        }
        const existingOrder = this.orders.get(record.orderId);
        if (existingOrder) {
          return { success: true, order: existingOrder, replayed: true };
        }
      }
    }
    if (!params.items || params.items.length === 0) {
      return { success: false, error: "Order must contain at least one product", code: "EMPTY_CART" };
    }
    const preparedItems = [];
    for (const itemReq of params.items) {
      if (itemReq.quantity <= 0) {
        return { success: false, error: "Quantity must be greater than zero", code: "INVALID_QUANTITY" };
      }
      const product = this.products.get(itemReq.product_id);
      if (!product || !product.is_active) {
        return { success: false, error: `Product not found or inactive`, code: "PRODUCT_NOT_FOUND" };
      }
      if (product.stock < itemReq.quantity) {
        return {
          success: false,
          error: `Insufficient inventory for ${product.name_en}. Only ${product.stock} available.`,
          code: "OUT_OF_STOCK"
        };
      }
      const itemSubtotal = product.price * itemReq.quantity;
      preparedItems.push({
        product,
        quantity: itemReq.quantity,
        unitPrice: product.price,
        subtotal: itemSubtotal
      });
    }
    const subtotal = preparedItems.reduce((acc, curr) => acc + curr.subtotal, 0);
    const { freeDeliveryThreshold, flatDeliveryFee, taxRate } = commerceConfig;
    const delivery_fee = subtotal >= freeDeliveryThreshold ? 0 : flatDeliveryFee;
    const tax = Math.round(subtotal * taxRate);
    const total = subtotal + delivery_fee + tax;
    const orderYear = (/* @__PURE__ */ new Date()).getFullYear();
    let orderId;
    do {
      const randomSuffix = Math.floor(1e3 + Math.random() * 9e3);
      orderId = `AB-${orderYear}-${randomSuffix}`;
    } while (this.orders.has(orderId));
    for (const item of preparedItems) {
      const prevStock = item.product.stock;
      const newStock = prevStock - item.quantity;
      item.product.stock = newStock;
      this.products.set(item.product.id, { ...item.product });
      this.addInventoryTransaction({
        id: `tx-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        product_id: item.product.id,
        change_amount: -item.quantity,
        previous_stock: prevStock,
        new_stock: newStock,
        reason: "ORDER_PLACEMENT",
        reference_id: orderId,
        performed_by: "CUSTOMER_CHECKOUT",
        created_at: (/* @__PURE__ */ new Date()).toISOString()
      });
      if (newStock <= item.product.min_stock_alert) {
        const notif2 = {
          id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          title: "Low Stock Alert",
          message: `${item.product.name_en} has reached low stock: only ${newStock} units left!`,
          type: "LOW_STOCK",
          is_read: false,
          created_at: (/* @__PURE__ */ new Date()).toISOString(),
          reference_id: item.product.id
        };
        this.addNotification(notif2);
        this.broadcast("inventory:low", notif2);
      }
    }
    const orderItems = preparedItems.map((pi, idx) => ({
      id: `item-${orderId}-${idx + 1}`,
      order_id: orderId,
      product_id: pi.product.id,
      product_name: pi.product.name_en,
      unit_price: pi.unitPrice,
      quantity: pi.quantity,
      subtotal: pi.subtotal
    }));
    const nowStr = (/* @__PURE__ */ new Date()).toISOString();
    const newOrder = {
      id: orderId,
      customer_name: params.customer_name,
      customer_phone: params.customer_phone,
      delivery_subcity: params.delivery_subcity,
      delivery_woreda: params.delivery_woreda,
      delivery_landmark: params.delivery_landmark,
      delivery_notes: params.delivery_notes,
      payment_method: params.payment_method,
      payment_reference: params.payment_reference,
      status: "PENDING",
      subtotal,
      delivery_fee,
      tax,
      total,
      idempotency_key: params.idempotency_key,
      source: params.source || "WEB",
      items: orderItems,
      created_at: nowStr,
      updated_at: nowStr
    };
    this.orders.set(orderId, newOrder);
    if (params.idempotency_key) {
      this.idempotencyKeys.set(params.idempotency_key, { orderId, payloadHash });
    }
    this.addAuditLog({
      id: `audit-${Date.now()}`,
      action: "ORDER_CREATED",
      entity_type: "ORDER",
      entity_id: orderId,
      details: { total, customer: params.customer_name, source: params.source || "WEB" },
      performed_by: "CUSTOMER",
      created_at: nowStr
    });
    const notif = {
      id: `notif-${Date.now()}`,
      title: "New Order Received",
      message: `Order #${orderId} placed by ${params.customer_name} for ${total} ETB.`,
      type: "ORDER_UPDATE",
      is_read: false,
      created_at: nowStr,
      reference_id: orderId
    };
    this.addNotification(notif);
    this.broadcast("order:created", newOrder);
    this.broadcast("notification:new", notif);
    return { success: true, order: newOrder };
  }
  // Get orders
  getOrders(filter) {
    let list = Array.from(this.orders.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    if (filter?.status && filter.status !== "ALL") {
      list = list.filter((o) => o.status === filter.status);
    }
    if (filter?.search) {
      const q = filter.search.toLowerCase().trim();
      list = list.filter(
        (o) => o.id.toLowerCase().includes(q) || o.customer_name.toLowerCase().includes(q) || o.customer_phone.includes(q)
      );
    }
    return list;
  }
  getOrderById(id) {
    return this.orders.get(id);
  }
  // Update order status
  updateOrderStatus(orderId, newStatus, performedBy = "ADMIN") {
    const order = this.orders.get(orderId);
    if (!order) {
      return { success: false, error: "Order not found" };
    }
    const previousStatus = order.status;
    if (previousStatus === newStatus) {
      return { success: true, order };
    }
    if (newStatus === "CANCELLED" && previousStatus !== "CANCELLED") {
      for (const item of order.items) {
        const prod = this.products.get(item.product_id);
        if (prod) {
          const prev = prod.stock;
          prod.stock = prev + item.quantity;
          this.products.set(prod.id, { ...prod });
          this.addInventoryTransaction({
            id: `tx-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            product_id: prod.id,
            change_amount: item.quantity,
            previous_stock: prev,
            new_stock: prod.stock,
            reason: "ORDER_CANCELLATION",
            reference_id: orderId,
            performed_by: performedBy,
            created_at: (/* @__PURE__ */ new Date()).toISOString()
          });
        }
      }
    }
    order.status = newStatus;
    order.updated_at = (/* @__PURE__ */ new Date()).toISOString();
    this.orders.set(orderId, { ...order });
    this.addAuditLog({
      id: `audit-${Date.now()}`,
      action: "ORDER_STATUS_CHANGED",
      entity_type: "ORDER",
      entity_id: orderId,
      details: { previousStatus, newStatus },
      performed_by: performedBy,
      created_at: (/* @__PURE__ */ new Date()).toISOString()
    });
    const notif = {
      id: `notif-${Date.now()}`,
      title: "Order Status Updated",
      message: `Order #${orderId} is now ${newStatus.replace(/_/g, " ")}.`,
      type: "ORDER_UPDATE",
      is_read: false,
      created_at: (/* @__PURE__ */ new Date()).toISOString(),
      reference_id: orderId
    };
    this.addNotification(notif);
    this.broadcast("order:status_changed", { orderId, status: newStatus, order });
    this.broadcast("notification:new", notif);
    return { success: true, order };
  }
  // Inventory adjustment
  adjustInventory(params) {
    const product = this.products.get(params.productId);
    if (!product) {
      return { success: false, error: "Product not found" };
    }
    const previousStock = product.stock;
    const diff = params.newStock - previousStock;
    product.stock = params.newStock;
    this.products.set(product.id, { ...product });
    this.addInventoryTransaction({
      id: `tx-${Date.now()}`,
      product_id: product.id,
      change_amount: diff,
      previous_stock: previousStock,
      new_stock: params.newStock,
      reason: params.reason,
      performed_by: params.performedBy,
      created_at: (/* @__PURE__ */ new Date()).toISOString()
    });
    this.addAuditLog({
      id: `audit-${Date.now()}`,
      action: "INVENTORY_ADJUSTED",
      entity_type: "PRODUCT",
      entity_id: product.id,
      details: { previousStock, newStock: params.newStock, diff, reason: params.reason },
      performed_by: params.performedBy,
      created_at: (/* @__PURE__ */ new Date()).toISOString()
    });
    this.broadcast("inventory:updated", { productId: product.id, stock: params.newStock });
    return { success: true, product };
  }
  getInventoryTransactions() {
    return [...this.inventoryTransactions].reverse();
  }
  /**
   * Dependency check for the health endpoint.
   *
   * The in-memory store is always reachable. When the MySQL repository lands
   * (P0), ping the connection pool here and return `ok: false` with a detail
   * message when it is unreachable, so `/api/v1/health` reports `degraded`.
   */
  async healthCheck() {
    return { ok: true, driver: "memory", detail: "in-memory store" };
  }
  getAuditLogs() {
    return this.auditLogs.slice(0, 50);
  }
  getNotifications() {
    return this.notifications.slice(0, 30);
  }
  markNotificationRead(id) {
    const n = this.notifications.find((notif) => notif.id === id);
    if (n) n.is_read = true;
  }
  getStats() {
    const ordersList = Array.from(this.orders.values());
    const totalOrders = ordersList.length;
    const totalRevenue = ordersList.filter((o) => o.status !== "CANCELLED").reduce((sum, o) => sum + o.total, 0);
    const pendingOrders = ordersList.filter((o) => o.status === "PENDING").length;
    const activeOrders = ordersList.filter(
      (o) => !["DELIVERED", "CANCELLED"].includes(o.status)
    ).length;
    const productsList = Array.from(this.products.values());
    const totalProducts = productsList.length;
    const lowStockCount = productsList.filter((p) => p.stock <= p.min_stock_alert).length;
    const statusCounts = ordersList.reduce((acc, curr) => {
      acc[curr.status] = (acc[curr.status] || 0) + 1;
      return acc;
    }, {});
    return {
      totalRevenue,
      totalOrders,
      pendingOrders,
      activeOrders,
      totalProducts,
      lowStockCount,
      statusCounts,
      recentOrders: ordersList.slice(0, 5)
    };
  }
};
var db = new DatabaseStore();

// src/server/cloudinary.ts
import { v2 as cloudinary } from "cloudinary";
if (process.env.CLOUDINARY_URL) {
  cloudinary.config({
    cloudinary_url: process.env.CLOUDINARY_URL,
    secure: true
  });
} else if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true
  });
}
function isCloudinaryConfigured() {
  const config = cloudinary.config();
  return Boolean(config.cloud_name && config.api_key && config.api_secret);
}
function getCloudinaryConfigInfo() {
  const config = cloudinary.config();
  return {
    configured: isCloudinaryConfigured(),
    cloud_name: config.cloud_name || null,
    folder: "addis_baltina/products"
  };
}
async function uploadImage(fileData, options) {
  if (isCloudinaryConfigured()) {
    try {
      const folder = options?.folder || "addis_baltina/products";
      const result = await cloudinary.uploader.upload(fileData, {
        folder,
        public_id: options?.public_id,
        tags: options?.tags || ["addis_baltina", "product"],
        resource_type: "image",
        transformation: [
          { quality: "auto:good" },
          { fetch_format: "auto" }
        ]
      });
      return {
        success: true,
        url: result.secure_url,
        public_id: result.public_id,
        format: result.format,
        width: result.width,
        height: result.height,
        bytes: result.bytes,
        provider: "cloudinary"
      };
    } catch (error) {
      console.error("[Cloudinary Upload Error]:", error);
      throw new Error(error.message || "Cloudinary upload failed");
    }
  }
  console.warn(
    "[Cloudinary] Environment credentials (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET or CLOUDINARY_URL) not set. Storing image with fallback URL."
  );
  const fallbackId = `fallback_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  return {
    success: true,
    url: fileData,
    public_id: fallbackId,
    provider: "local_fallback",
    message: "Cloudinary credentials not configured in environment. The image is saved locally in demo mode. Add CLOUDINARY_* to your environment variables to enable Cloudinary CDN storage."
  };
}
async function deleteFromCloudinary(publicId) {
  if (!isCloudinaryConfigured()) {
    return true;
  }
  try {
    const res = await cloudinary.uploader.destroy(publicId);
    return res.result === "ok";
  } catch (err) {
    console.error("[Cloudinary Delete Error]:", err);
    return false;
  }
}

// src/server/auth.ts
import crypto2 from "crypto";
var COOKIE_NAME = "ab_admin_session";
var SESSION_TTL_MS = 1e3 * 60 * 60 * 8;
var MAX_LOGIN_ATTEMPTS = 5;
var LOGIN_WINDOW_MS = 1e3 * 60 * 15;
function safeEqual(a, b) {
  const ha = crypto2.createHash("sha256").update(a, "utf8").digest();
  const hb = crypto2.createHash("sha256").update(b, "utf8").digest();
  return crypto2.timingSafeEqual(ha, hb);
}
var signingSecret = null;
var warnedAboutSecret = false;
function getSigningSecret() {
  if (signingSecret) return signingSecret;
  const configured = process.env.SESSION_SECRET?.trim();
  const placeholder = "super-secret-key-change-in-production";
  const weak = !configured || configured === placeholder;
  if (weak) {
    if (process.env.NODE_ENV === "production" && !warnedAboutSecret) {
      warnedAboutSecret = true;
      console.warn(
        "[auth] SESSION_SECRET is unset or still the example value. Using a per-process signing key: admin sessions will not survive a restart. Set SESSION_SECRET in the environment."
      );
    }
    signingSecret = crypto2.randomBytes(32);
  } else {
    signingSecret = crypto2.createHash("sha256").update(configured).digest();
  }
  return signingSecret;
}
function signature(exp) {
  return crypto2.createHmac("sha256", getSigningSecret()).update(`ab_admin:${exp}`).digest("hex");
}
function createAdminToken() {
  const exp = Date.now() + SESSION_TTL_MS;
  return `${exp}.${signature(exp)}`;
}
function verifyAdminToken(token) {
  if (!token) return false;
  const sep = token.indexOf(".");
  if (sep <= 0) return false;
  const expStr = token.slice(0, sep);
  const sig = token.slice(sep + 1);
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp <= Date.now()) return false;
  return safeEqual(sig, signature(exp));
}
function readCookie(req, name) {
  const header = req.headers.cookie;
  if (!header) return void 0;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    if (part.slice(0, eq).trim() === name) {
      return decodeURIComponent(part.slice(eq + 1).trim());
    }
  }
  return void 0;
}
function isSecureRequest(req) {
  if (req.secure) return true;
  const proto = String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim();
  return proto === "https";
}
function setSessionCookie(req, res, token) {
  const attributes = [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${Math.floor(SESSION_TTL_MS / 1e3)}`
  ];
  if (isSecureRequest(req)) attributes.push("Secure");
  res.setHeader("Set-Cookie", attributes.join("; "));
}
function clearSessionCookie(req, res) {
  const attributes = [`${COOKIE_NAME}=`, "Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=0"];
  if (isSecureRequest(req)) attributes.push("Secure");
  res.setHeader("Set-Cookie", attributes.join("; "));
}
function extractToken(req) {
  const cookie = readCookie(req, COOKIE_NAME);
  if (cookie) return cookie;
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) return auth.slice("Bearer ".length).trim();
  return null;
}
function isAdminAuthenticated(req) {
  return verifyAdminToken(extractToken(req));
}
var loginAttempts = /* @__PURE__ */ new Map();
function throttleKey(req) {
  return req.ip || req.socket.remoteAddress || "unknown";
}
function isLoginBlocked(key) {
  const entry = loginAttempts.get(key);
  if (!entry) return false;
  if (Date.now() > entry.resetAt) {
    loginAttempts.delete(key);
    return false;
  }
  return entry.count >= MAX_LOGIN_ATTEMPTS;
}
function recordFailedLogin(key) {
  const entry = loginAttempts.get(key);
  if (!entry || Date.now() > entry.resetAt) {
    loginAttempts.set(key, { count: 1, resetAt: Date.now() + LOGIN_WINDOW_MS });
    return;
  }
  entry.count += 1;
}
function clearFailedLogins(key) {
  loginAttempts.delete(key);
}
function adminLogin(req, res) {
  const key = throttleKey(req);
  if (isLoginBlocked(key)) {
    res.status(429).json({
      success: false,
      error: {
        code: "TOO_MANY_ATTEMPTS",
        message: "Too many failed attempts. Try again in a few minutes."
      }
    });
    return;
  }
  const configured = process.env.ADMIN_PASSWORD;
  if (!configured) {
    console.warn("[auth] Admin login rejected: ADMIN_PASSWORD is not set.");
    res.status(503).json({
      success: false,
      error: {
        code: "ADMIN_LOGIN_DISABLED",
        message: "Admin login is disabled because ADMIN_PASSWORD is not configured on the server."
      }
    });
    return;
  }
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  if (!password || !safeEqual(password, configured)) {
    recordFailedLogin(key);
    console.warn(`[auth] Failed admin login attempt (ip=${key}).`);
    res.status(401).json({
      success: false,
      error: { code: "INVALID_CREDENTIALS", message: "Invalid admin password." }
    });
    return;
  }
  clearFailedLogins(key);
  setSessionCookie(req, res, createAdminToken());
  res.json({ success: true });
}
function adminSession(req, res) {
  res.json({ success: true, data: { authenticated: isAdminAuthenticated(req) } });
}
function adminLogout(req, res) {
  clearSessionCookie(req, res);
  res.json({ success: true });
}
function requireAdmin(req, res, next) {
  if (isAdminAuthenticated(req)) {
    next();
    return;
  }
  res.status(401).json({
    success: false,
    error: { code: "UNAUTHORIZED", message: "Administrator authentication required." }
  });
}

// src/server/imageSource.ts
var DATA_URI_PATTERN = /^data:image\/(?:png|jpe?g|webp|gif|avif);base64,[A-Za-z0-9+/=\r\n]+$/i;
var DEFAULT_ALLOWED_HOSTS = ["res.cloudinary.com", "images.unsplash.com"];
function allowedHosts() {
  const configured = (process.env.UPLOAD_ALLOWED_HOSTS || "").split(",").map((host) => host.trim().toLowerCase()).filter(Boolean);
  return [...DEFAULT_ALLOWED_HOSTS, ...configured];
}
function checkImageSource(source) {
  if (typeof source !== "string" || source.trim().length === 0) {
    return { valid: false, reason: "Image data (base64 data URI or image URL) is required" };
  }
  const value = source.trim();
  if (value.toLowerCase().startsWith("data:")) {
    if (!DATA_URI_PATTERN.test(value)) {
      return {
        valid: false,
        reason: "Only base64 PNG, JPEG, WEBP, GIF or AVIF data URIs are accepted"
      };
    }
    return { valid: true, kind: "data_uri" };
  }
  let url;
  try {
    url = new URL(value);
  } catch {
    return { valid: false, reason: "Image URL is not a valid absolute URL" };
  }
  if (url.protocol !== "https:") {
    return { valid: false, reason: "Image URLs must use HTTPS" };
  }
  const host = url.hostname.toLowerCase();
  if (!allowedHosts().includes(host)) {
    return {
      valid: false,
      reason: `Image host "${host}" is not allowed. Upload a file instead.`
    };
  }
  return { valid: true, kind: "remote_url", host };
}

// src/server/app.ts
function serverError(req, res, error) {
  const correlationId = String(req.headers["x-request-id"] || crypto3.randomUUID());
  const detail = error instanceof Error ? error.stack || error.message : JSON.stringify(error ?? null);
  logger.error("request_failed", {
    requestId: correlationId,
    method: req.method,
    path: req.path,
    detail
  });
  return res.status(500).json({
    success: false,
    error: {
      message: "Internal server error",
      code: "INTERNAL_ERROR",
      correlationId
    }
  });
}
var MAX_PAGE_SIZE = 200;
function parsePagination(query, defaultLimit) {
  const rawLimit = Number(query.limit);
  const rawOffset = Number(query.offset);
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(Math.floor(rawLimit), MAX_PAGE_SIZE) : defaultLimit;
  const offset = Number.isFinite(rawOffset) && rawOffset > 0 ? Math.floor(rawOffset) : 0;
  return { limit, offset };
}
function paginate(items, limit, offset) {
  const page = items.slice(offset, offset + limit);
  return {
    items: page,
    pagination: {
      total: items.length,
      limit,
      offset,
      hasMore: offset + page.length < items.length
    }
  };
}
function configuredOrigins() {
  return (process.env.CLIENT_URL || "").split(",").map((origin) => origin.trim().replace(/\/$/, "")).filter(Boolean);
}
function isOriginAllowed(origin, req) {
  const normalized = origin.replace(/\/$/, "");
  if (configuredOrigins().includes(normalized)) return true;
  try {
    const requestHost = req.headers.host;
    return Boolean(requestHost) && new URL(origin).host === requestHost;
  } catch {
    return false;
  }
}
function jsonLimiter(windowMs, limit) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: {
      success: false,
      error: {
        code: "RATE_LIMITED",
        message: "Too many requests. Please slow down and try again shortly."
      }
    }
  });
}
var orderLimiter = jsonLimiter(6e4, 20);
var telegramAuthLimiter = jsonLimiter(15 * 6e4, 20);
var uploadLimiter = jsonLimiter(15 * 6e4, 30);
var adminLoginLimiter = jsonLimiter(15 * 6e4, 10);
function createApp(options = {}) {
  const store = options.store ?? db;
  const isProduction2 = options.isProduction ?? process.env.NODE_ENV === "production";
  const sseHeartbeatMs = options.sseHeartbeatMs ?? 25e3;
  const app = express();
  const trustProxy = options.trustProxy ?? (isProduction2 ? 1 : false);
  app.set("trust proxy", trustProxy);
  app.disable("x-powered-by");
  app.use(
    helmet({
      contentSecurityPolicy: isProduction2 ? {
        useDefaults: false,
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "https://telegram.org"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "blob:", "https:"],
          connectSrc: ["'self'"],
          fontSrc: ["'self'", "data:"],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          frameAncestors: ["'self'", "https://web.telegram.org", "https://*.telegram.org"]
        }
      } : false,
      // X-Frame-Options cannot express "Telegram' + self"; frame-ancestors does.
      frameguard: false,
      crossOriginEmbedderPolicy: false
    })
  );
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && !isOriginAllowed(origin, req)) {
      return res.status(403).json({
        success: false,
        error: { code: "CORS_FORBIDDEN", message: "Origin not allowed" }
      });
    }
    next();
  });
  app.use(
    cors({
      origin(origin, callback) {
        callback(null, !origin || configuredOrigins().includes(origin.replace(/\/$/, "")));
      },
      credentials: true
    })
  );
  const jsonDefault = express.json({ limit: "1mb" });
  const jsonUpload = express.json({ limit: "10mb" });
  app.use(
    (req, res, next) => (req.path === "/api/v1/upload" ? jsonUpload : jsonDefault)(req, res, next)
  );
  app.use(express.urlencoded({ extended: true, limit: "1mb" }));
  app.use((req, res, next) => {
    const incoming = req.headers["x-request-id"];
    const requestId = (typeof incoming === "string" && incoming.length > 0 ? incoming : crypto3.randomUUID()).slice(0, 64);
    req.headers["x-request-id"] = requestId;
    res.setHeader("X-Request-Id", requestId);
    if (req.path.startsWith("/api")) {
      const start = process.hrtime.bigint();
      res.on("finish", () => {
        const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
        logger.info("http_request", {
          requestId,
          method: req.method,
          path: req.path,
          status: res.statusCode,
          durationMs: Math.round(durationMs * 100) / 100,
          ip: req.ip
        });
      });
    }
    next();
  });
  const sseClients = /* @__PURE__ */ new Set();
  let heartbeat = null;
  function stopHeartbeat() {
    if (heartbeat) {
      clearInterval(heartbeat);
      heartbeat = null;
    }
  }
  function startHeartbeat() {
    if (heartbeat) return;
    heartbeat = setInterval(() => {
      sseClients.forEach((client) => {
        try {
          client.write(`: ping ${Date.now()}

`);
        } catch {
          sseClients.delete(client);
        }
      });
    }, sseHeartbeatMs);
    heartbeat.unref?.();
  }
  function closeRealtime() {
    stopHeartbeat();
    sseClients.forEach((client) => {
      try {
        client.end();
      } catch {
      }
    });
    sseClients.clear();
  }
  store.subscribe((event, data) => {
    const payload = `event: ${event}
data: ${JSON.stringify(data)}

`;
    sseClients.forEach((client) => {
      try {
        client.write(payload);
      } catch {
        sseClients.delete(client);
      }
    });
  });
  app.get("/api/v1/events", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();
    sseClients.add(res);
    startHeartbeat();
    res.write(`event: connected
data: ${JSON.stringify({ time: (/* @__PURE__ */ new Date()).toISOString() })}

`);
    req.on("close", () => {
      sseClients.delete(res);
      if (sseClients.size === 0) stopHeartbeat();
    });
  });
  app.get("/api/v1/health", async (_req, res) => {
    const deps = await store.healthCheck();
    const status = deps.ok ? "ok" : "degraded";
    res.status(deps.ok ? 200 : 503).json({
      status,
      app: "Tsion Baltina",
      version: "1.0.0",
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      uptime: process.uptime(),
      dependencies: {
        database: deps
      }
    });
  });
  app.post("/api/v1/auth/admin/login", adminLoginLimiter, adminLogin);
  app.get("/api/v1/auth/admin/session", adminSession);
  app.post("/api/v1/auth/admin/logout", adminLogout);
  app.get("/api/v1/categories", (_req, res) => {
    try {
      const categories = store.getCategories();
      res.json({ success: true, data: categories });
    } catch (error) {
      serverError(_req, res, error);
    }
  });
  app.get("/api/v1/products", (req, res) => {
    try {
      const categorySlug = req.query.category;
      const search = req.query.search;
      const { limit, offset } = parsePagination(req.query, 100);
      const products = store.getProducts({ categorySlug, search });
      const paged = paginate(products, limit, offset);
      res.json({ success: true, data: paged.items, pagination: paged.pagination });
    } catch (error) {
      serverError(req, res, error);
    }
  });
  app.get("/api/v1/products/:id", (req, res) => {
    const product = store.getProductById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, error: { message: "Product not found" } });
    }
    res.json({ success: true, data: product });
  });
  app.get("/api/v1/upload/status", (_req, res) => {
    const info = getCloudinaryConfigInfo();
    res.json({
      success: true,
      data: info
    });
  });
  app.post("/api/v1/upload", requireAdmin, uploadLimiter, async (req, res) => {
    try {
      if (!req.is("application/json")) {
        return res.status(415).json({
          success: false,
          error: { code: "UNSUPPORTED_MEDIA_TYPE", message: "Content-Type must be application/json" }
        });
      }
      const { image, folder, public_id, tags } = req.body;
      const check = checkImageSource(image);
      if (!check.valid) {
        return res.status(400).json({ success: false, error: { message: check.reason } });
      }
      const uploadResult = await uploadImage(image, { folder, public_id, tags });
      res.json({
        success: true,
        data: uploadResult
      });
    } catch (error) {
      serverError(req, res, error);
    }
  });
  app.delete("/api/v1/upload/:public_id", requireAdmin, async (req, res) => {
    try {
      const publicId = String(req.params.public_id);
      const deleted = await deleteFromCloudinary(publicId);
      res.json({
        success: true,
        data: { deleted }
      });
    } catch (error) {
      serverError(req, res, error);
    }
  });
  app.post("/api/v1/products", requireAdmin, (req, res) => {
    try {
      const productSchema = z.object({
        category_id: z.string(),
        sku: z.string(),
        name_en: z.string().min(2),
        name_am: z.string().min(2),
        name_om: z.string().min(2),
        description_en: z.string().default(""),
        description_am: z.string().default(""),
        description_om: z.string().default(""),
        price: z.number().positive(),
        stock: z.number().int().min(0),
        min_stock_alert: z.number().int().min(1).default(5),
        unit: z.string().default("500g"),
        image_url: z.string().min(1),
        is_active: z.boolean().default(true),
        is_featured: z.boolean().default(false),
        origin: z.string().default("Addis Ababa, Ethiopia"),
        ingredients_en: z.string().optional(),
        usage_en: z.string().optional()
      });
      const parsed = productSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          error: { message: "Invalid product details", details: parsed.error.format() }
        });
      }
      const newProd = store.createProduct(parsed.data);
      res.status(201).json({ success: true, data: newProd });
    } catch (error) {
      serverError(req, res, error);
    }
  });
  app.patch("/api/v1/products/:id", requireAdmin, (req, res) => {
    try {
      const product = store.getProductById(req.params.id);
      if (!product) {
        return res.status(404).json({ success: false, error: { message: "Product not found" } });
      }
      const updated = store.updateProduct(req.params.id, req.body);
      res.json({ success: true, data: updated });
    } catch (error) {
      serverError(req, res, error);
    }
  });
  const CreateOrderSchema = z.object({
    customer_name: z.string().min(2, "Customer name is required"),
    customer_phone: z.string().min(7, "Valid Ethiopian phone number is required"),
    delivery_subcity: z.string().min(2, "Subcity is required"),
    delivery_woreda: z.string().optional(),
    delivery_landmark: z.string().optional(),
    delivery_notes: z.string().optional(),
    payment_method: z.enum(["CASH_ON_DELIVERY", "TELEBIRR", "CBE_BIRR", "IN_STORE_PICKUP"]),
    payment_reference: z.string().optional(),
    items: z.array(
      z.object({
        product_id: z.string(),
        quantity: z.number().int().positive()
      })
    ).min(1, "Cart cannot be empty"),
    idempotency_key: z.string().optional(),
    source: z.enum(["TELEGRAM_MINI_APP", "WEB", "PWA"]).optional()
  });
  app.post("/api/v1/orders", orderLimiter, (req, res) => {
    const parseResult = CreateOrderSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid order input data",
          details: parseResult.error.format()
        }
      });
    }
    const result = store.createOrder(parseResult.data);
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: result.code,
          message: result.error
        }
      });
    }
    const status = result.replayed ? 200 : 201;
    res.status(status).json({ success: true, data: result.order, replayed: result.replayed ?? false });
  });
  app.get("/api/v1/orders", requireAdmin, (req, res) => {
    const status = req.query.status;
    const search = req.query.search;
    const { limit, offset } = parsePagination(req.query, 50);
    const orders = store.getOrders({ status, search });
    const paged = paginate(orders, limit, offset);
    res.json({ success: true, data: paged.items, pagination: paged.pagination });
  });
  app.get("/api/v1/orders/:id", (req, res) => {
    const order = store.getOrderById(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, error: { message: "Order not found" } });
    }
    res.json({ success: true, data: order });
  });
  const UpdateStatusSchema = z.object({
    status: z.enum([
      "PENDING",
      "CONFIRMED",
      "PROCESSING",
      "READY_FOR_DELIVERY",
      "OUT_FOR_DELIVERY",
      "DELIVERED",
      "CANCELLED"
    ])
  });
  app.patch("/api/v1/orders/:id/status", requireAdmin, (req, res) => {
    const parseResult = UpdateStatusSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: "Invalid status transition" }
      });
    }
    const result = store.updateOrderStatus(req.params.id, parseResult.data.status, "ADMIN");
    if (!result.success) {
      return res.status(404).json({ success: false, error: { message: result.error } });
    }
    res.json({ success: true, data: result.order });
  });
  app.get("/api/v1/inventory", requireAdmin, (_req, res) => {
    const products = store.getProducts();
    const transactions = store.getInventoryTransactions();
    res.json({ success: true, data: { products, transactions } });
  });
  app.post("/api/v1/inventory/adjust", requireAdmin, (req, res) => {
    const schema = z.object({
      productId: z.string(),
      newStock: z.number().int().min(0),
      reason: z.enum(["RESTOCK", "DAMAGE", "AUDIT_ADJUSTMENT"])
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: { message: "Invalid inventory adjustment data" } });
    }
    const result = store.adjustInventory({
      ...parsed.data,
      performedBy: "ADMIN_OPERATOR"
    });
    if (!result.success) {
      return res.status(400).json({ success: false, error: { message: result.error } });
    }
    res.json({ success: true, data: result.product });
  });
  app.get("/api/v1/notifications", requireAdmin, (_req, res) => {
    const notifications = store.getNotifications();
    res.json({ success: true, data: notifications });
  });
  app.post("/api/v1/notifications/:id/read", requireAdmin, (req, res) => {
    store.markNotificationRead(req.params.id);
    res.json({ success: true });
  });
  app.get("/api/v1/admin/stats", requireAdmin, (_req, res) => {
    const stats = store.getStats();
    res.json({ success: true, data: stats });
  });
  app.get("/api/v1/admin/audit-logs", requireAdmin, (_req, res) => {
    const logs = store.getAuditLogs();
    res.json({ success: true, data: logs });
  });
  app.post("/api/v1/auth/telegram", telegramAuthLimiter, (req, res) => {
    const { initData, user } = req.body;
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (botToken) {
      if (!initData || typeof initData !== "string") {
        return res.status(401).json({
          success: false,
          error: { code: "MISSING_INIT_DATA", message: "Telegram initData is required" }
        });
      }
      let valid = false;
      try {
        const urlParams = new URLSearchParams(initData);
        const hash = urlParams.get("hash");
        urlParams.delete("hash");
        const dataCheckArr = [];
        urlParams.forEach((val, key) => {
          dataCheckArr.push(`${key}=${val}`);
        });
        dataCheckArr.sort();
        const dataCheckString = dataCheckArr.join("\n");
        const secretKey = crypto3.createHmac("sha256", "WebAppData").update(botToken).digest();
        const calculatedHash = crypto3.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
        valid = Boolean(hash) && calculatedHash === hash;
      } catch (err) {
        console.warn(
          "[auth] Telegram signature verification failed:",
          err instanceof Error ? err.message : err
        );
        valid = false;
      }
      if (!valid) {
        return res.status(401).json({
          success: false,
          error: { code: "INVALID_TELEGRAM_SIGNATURE", message: "Invalid Telegram signature" }
        });
      }
      const authDateParam = new URLSearchParams(initData).get("auth_date");
      const authDateSec = authDateParam ? Number(authDateParam) : 0;
      if (!Number.isFinite(authDateSec) || Math.abs(Math.floor(Date.now() / 1e3) - authDateSec) > 300) {
        return res.status(401).json({
          success: false,
          error: { code: "TELEGRAM_AUTH_DATE_EXPIRED", message: "Telegram auth_date is too old or invalid" }
        });
      }
      let resolvedUser = user;
      if (!resolvedUser) {
        const userParam = new URLSearchParams(initData).get("user");
        if (userParam) {
          try {
            resolvedUser = JSON.parse(userParam);
          } catch {
            resolvedUser = null;
          }
        }
      }
      return res.json({ success: true, user: resolvedUser || null });
    }
    res.json({
      success: true,
      user: user || {
        id: 98765432,
        first_name: "Telegram Customer",
        username: "addis_customer",
        role: "CUSTOMER"
      }
    });
  });
  app.use(
    (err, req, res, _next) => {
      if (res.headersSent) return;
      serverError(req, res, err);
    }
  );
  return { app, store, closeRealtime };
}

// server.ts
var PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3003;
var isProduction = process.env.NODE_ENV === "production";
async function startServer() {
  const { app, closeRealtime } = createApp({ isProduction });
  const httpServer = createServer(app);
  let shuttingDown = false;
  if (!isProduction) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    app.use(express2.static("dist"));
    app.get("*", (_req, res) => {
      res.sendFile("dist/index.html", { root: "." });
    });
  }
  httpServer.listen(PORT, "0.0.0.0", () => {
    logger.info("server_started", { port: PORT, isProduction });
  });
  function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info("server_shutting_down", { signal });
    closeRealtime();
    const forceExit = setTimeout(() => {
      logger.error("server_shutdown_timed_out");
      httpServer.closeAllConnections?.();
      process.exit(1);
    }, 1e4);
    forceExit.unref?.();
    httpServer.close(() => {
      clearTimeout(forceExit);
      logger.info("server_shutdown_complete");
      process.exit(0);
    });
    httpServer.closeIdleConnections?.();
  }
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}
startServer().catch((err) => {
  logger.error("server_failed_to_start", { error: err instanceof Error ? err.message : String(err) });
  process.exit(1);
});
