import {
  Category,
  Product,
  Order,
  InventoryTransaction,
  AuditLog,
  AppNotification,
  OrderStatus,
  PaymentMethod,
  OrderSource,
} from '../types';

export class DatabaseStore {
  private categories: Map<string, Category> = new Map();
  private products: Map<string, Product> = new Map();
  private orders: Map<string, Order> = new Map();
  private inventoryTransactions: InventoryTransaction[] = [];
  private auditLogs: AuditLog[] = [];
  private notifications: AppNotification[] = [];
  private idempotencyKeys: Map<string, string> = new Map(); // key -> orderId
  private listeners: Set<(event: string, data: any) => void> = new Set();

  constructor() {
    this.seedInitialData();
  }

  public subscribe(listener: (event: string, data: any) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private broadcast(event: string, data: any) {
    this.listeners.forEach((cb) => {
      try {
        cb(event, data);
      } catch (err) {
        console.error('SSE broadcast error:', err);
      }
    });
  }

  private seedInitialData() {
    const seedCategories: Category[] = [
      {
        id: 'cat-spices',
        slug: 'spices',
        name_en: 'Spices & Blends',
        name_am: 'ቅመማ ቅመሞች',
        name_om: "Urgooftuu fi Mi'eessituu",
        description_en: 'Authentic stone-ground Ethiopian spice blends & whole spices',
        description_am: 'በባህላዊ መንገድ የተደለዙና የተዘጋጁ የሀገር ቤት ቅመሞች',
        description_om: 'Mi\'eessituu aadaa Itoophiyaa qulqullina olaanaa qaban',
        icon: 'Flame',
        display_order: 1,
      },
      {
        id: 'cat-flours',
        slug: 'flours-grains',
        name_en: 'Flours & Grains',
        name_am: 'እህሎችና ዱቄት',
        name_om: 'Midhaan fi Daakuu',
        description_en: 'Authentic Ethiopian Teff, Beso, Bula, and Shiro grains',
        description_am: 'ንጹህ የሀገር ቤት ጤፍ፣ በሶ፣ ቡላ እና የሽሮ ጥራጥሬዎች',
        description_om: 'Daakuu Xaafii qulqulluu, Bulaa fi Baasoo',
        icon: 'Wheat',
        display_order: 2,
      },
      {
        id: 'cat-pastes',
        slug: 'pastes-condiments',
        name_en: 'Pastes & Sauces',
        name_am: 'አዋዜና ማጣፈጫ',
        name_om: 'Ittoo fi Dhadhaa',
        description_en: 'Traditional Awaze paste, spiced butters, and table condiments',
        description_am: 'የተለየ ጣዕም ያለው አዋዜ፣ የንጥር ቅቤ እና ሌሎች ማጣፈጫዎች',
        description_om: 'Awaazee fi mi\'eessitoota aadaa addaa',
        icon: 'Soup',
        display_order: 3,
      },
      {
        id: 'cat-snacks',
        slug: 'traditional-snacks',
        name_en: 'Traditional Snacks',
        name_am: 'የባህል መክሰሶች',
        name_om: 'Nyaata Aadaa',
        description_en: 'Roasted Kollo, Dabo Kolo, and wholesome dry-roasted snacks',
        description_am: 'ጥርት ያለ የቆሎ ቅልቅል እና የዳቦ ቆሎ',
        description_om: 'Qolloofi dabboo qolloo aadaa',
        icon: 'Cookie',
        display_order: 4,
      },
      {
        id: 'cat-coffee',
        slug: 'coffee-beverages',
        name_en: 'Coffee & Baltina Drinks',
        name_am: 'ቡናና መጠጦች',
        name_om: 'Buna fi Dhugaatii',
        description_en: 'Fresh roasted Ethiopian heirloom coffee and herbal infusions',
        description_am: 'ትኩስ የተቆላ የይርጋጨፌ ቡና እና የባህል መጠጦች',
        description_om: 'Buna aadaa Yirgaacaffee fi dhugaatiiwwan biroo',
        icon: 'Coffee',
        display_order: 5,
      },
    ];

    seedCategories.forEach((cat) => this.categories.set(cat.id, cat));

    const seedProducts: Product[] = [
      {
        id: 'prod-berbere-special',
        category_id: 'cat-spices',
        sku: 'AB-SP-001',
        name_en: 'Special Blend Berbere (የደለዘ በርበሬ)',
        name_am: 'ልዩ የደለዘ በርበሬ',
        name_om: 'Barbaree Aadaa Addaa',
        description_en: 'Artisan sun-dried red chili pepper stone-milled with 17 traditional aromatic herbs, korerima, garlic, and ginger. Perfectly balanced heat.',
        description_am: 'በ17 የሀገር ቤት ቅመሞች፣ ኮረሪማ እና ነጭ ሽንኩርት በጥንቃቄ የተደለዘና ለወጥ የተዘጋጀ ልዩ በርበሬ።',
        description_om: 'Barbaree mi\'eessituu aadaa 17 waliin qophaa\'e, ittoo doroofi fooniif kan ta\'u.',
        price: 450,
        stock: 35,
        min_stock_alert: 8,
        unit: '500g',
        image_url: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=600&q=80',
        is_active: true,
        is_featured: true,
        origin: 'Addis Ababa & Gojjam, Ethiopia',
        ingredients_en: 'Sun-dried red peppers, Korerima, Garlic, Ginger, Besobila, Ruta chalepensis (Tena Adam), Salt',
        usage_en: 'Essential for Doro Wot, Sega Wot, and Missir Wot.',
      },
      {
        id: 'prod-shiro-special',
        category_id: 'cat-flours',
        sku: 'AB-FL-002',
        name_en: 'Spiced Shiro Powder (ሚጥሚጣ ሽሮ)',
        name_am: 'የተቀመመ የሽሮ ዱቄት',
        name_om: 'Daakuu Shiroo Qophaa\'aa',
        description_en: 'Premium roasted chickpeas and split peas delicately spiced and ground to a silky flour. Produces rich, velvety Shiro Tegabino.',
        description_am: 'ጥራት ካለው ሽምብራ ተጠርጎ፣ ተቆልቶና ተቀሞ የተፈጨ ልስልስ የሽሮ ዱቄት።',
        description_om: 'Daakuu shiroo shimbraa qulqulluu irraa qophaa\'e, nyaata teegabiinoof baay\'ee gaarii.',
        price: 340,
        stock: 45,
        min_stock_alert: 10,
        unit: '500g',
        image_url: 'https://images.unsplash.com/photo-1509358271058-acd22cc93898?auto=format&fit=crop&w=600&q=80',
        is_active: true,
        is_featured: true,
        origin: 'Gondar & Addis Ababa, Ethiopia',
        ingredients_en: 'Roasted chickpeas, Split field peas, Garlic, Korerima, Ginger, Basil, Mild chili',
        usage_en: 'Boil with sautéed onions, garlic, and oil or spiced butter for 10-15 mins.',
      },
      {
        id: 'prod-mitmita',
        category_id: 'cat-spices',
        sku: 'AB-SP-003',
        name_en: 'Addis Authentic Mitmita (ሚጥሚጣ)',
        name_am: 'የሀበሻ ንጹህ ሚጥሚጣ',
        name_om: 'Mitmiitaa Aadaa',
        description_en: 'Fiery small bird\'s eye chilies roasted with black cardamom, cloves, and sea salt. Unmatched intensity and floral heat.',
        description_am: 'በጣም የሚያቃጥል ንጹህ የሀገር ቤት ሚጥሚጣ ከኮረሪማ እና ቅርንፉድ ጋር። ለክትፎ እና ለጥብስ ተመራጭ።',
        description_om: 'Mitmiitaa gubaadhaafi fooli gaarii qabu, kitfoofi xibsiif kan oolu.',
        price: 380,
        stock: 28,
        min_stock_alert: 5,
        unit: '250g',
        image_url: 'https://images.unsplash.com/photo-1583032015879-66c3038676d5?auto=format&fit=crop&w=600&q=80',
        is_active: true,
        is_featured: true,
        origin: 'Gurage zone, Ethiopia',
        ingredients_en: 'Piri-piri bird-eye chili, Korerima pods, Cloves, Sea salt',
        usage_en: 'Sprinkle directly onto Kitfo, Dulet, roasted meat, or boiled vegetables.',
      },
      {
        id: 'prod-korerima',
        category_id: 'cat-spices',
        sku: 'AB-SP-004',
        name_en: 'Whole Hand-Peeled Korerima (ኮረሪማ)',
        name_am: 'የተላጠ ኮረሪማ (ጥቁር ሄል)',
        name_om: 'Korerimaa Qulqulluu',
        description_en: 'Ethiopian black cardamom pods with smoky, resinous notes. Essential for gourmet stews, clarified butter, and coffee.',
        description_am: 'ንጹህ ጥቁር ኮረሪማ ለንጥር ቅቤ፣ ለስጋ ወጥ እና ለቡና ልዩ መዓዛና ጣዕም የሚሰጥ።',
        description_om: 'Mi\'eessituu aadaa fooli addaa qabu, doroofi bunaaf kan fayyadu.',
        price: 580,
        stock: 18,
        min_stock_alert: 5,
        unit: '250g',
        image_url: 'https://images.unsplash.com/photo-1508746829417-e6f548d8d6ed?auto=format&fit=crop&w=600&q=80',
        is_active: true,
        is_featured: false,
        origin: 'Keffa & Wollega, Ethiopia',
        ingredients_en: '100% Ethiopian Black Cardamom (Aframomum corrorima)',
        usage_en: 'Crush seeds fresh into coffee or grind into spice mixes.',
      },
      {
        id: 'prod-mekelesha',
        category_id: 'cat-spices',
        sku: 'AB-SP-005',
        name_en: 'Mekelesha Finishing Spice (መከለሻ)',
        name_am: 'የወጥ ማወራረጃ መከለሻ',
        name_om: 'Makkalashaa Aadaa',
        description_en: 'The legendary finishing spice added in the final 5 minutes of stew simmering: cinnamon, cloves, cardamom, nutmeg, and black pepper.',
        description_am: 'ወጥ ከመውረዱ ጥቂት ደቂቃዎች በፊት የሚጨመር 7 ልዩ ቅመሞችን ያቀፈ መዓዛ ሰጪ መከለሻ።',
        description_om: 'Mi\'eessituu dhuma ittoo irratti naqamu fooliifi dhandhama addaatiif.',
        price: 420,
        stock: 22,
        min_stock_alert: 5,
        unit: '250g',
        image_url: 'https://images.unsplash.com/photo-1532336414038-cf19250c5757?auto=format&fit=crop&w=600&q=80',
        is_active: true,
        is_featured: false,
        origin: 'Addis Ababa, Ethiopia',
        ingredients_en: 'Cinnamon, Korerima, Cloves, Nutmeg, Long Pepper, Cumin',
        usage_en: 'Stir in 1 tsp during the final 3 minutes of cooking Doro Wot or beef stew.',
      },
      {
        id: 'prod-kibbeh-spices',
        category_id: 'cat-spices',
        sku: 'AB-SP-006',
        name_en: 'Traditional Niter Kibbeh Herbal Blend (የቅቤ ቅመም)',
        name_am: 'የተሟላ የንጥር ቅቤ ቅመም',
        name_om: 'Mi\'eessituu Dhadhaa Naxiraa',
        description_en: 'The complete herbal medley needed to clarify pure Ethiopian butter: Kosseret (Lippia abyssinica), Besobila, Tena Adam, and Fenugreek.',
        description_am: 'ኮሰረት፣ በሶብላ፣ ጤና አዳም እና ሌሎች የቅቤ ቅመሞች ተጣምረው የተዘጋጁ።',
        description_om: 'Koseeratiifi baala aadaa dhadhaa naxiruuf fayyadu.',
        price: 490,
        stock: 15,
        min_stock_alert: 4,
        unit: '300g',
        image_url: 'https://images.unsplash.com/photo-1628088062854-d1870b4553da?auto=format&fit=crop&w=600&q=80',
        is_active: true,
        is_featured: true,
        origin: 'Shoa, Ethiopia',
        ingredients_en: 'Kosseret, Besobila, Turmeric, Abish (Fenugreek), Korerima, Tena Adam',
        usage_en: 'Simmer with 1kg unsalted organic butter on low heat for 45 minutes.',
      },
      {
        id: 'prod-teff-flour',
        category_id: 'cat-flours',
        sku: 'AB-FL-007',
        name_en: 'Ada\'a White Teff Flour (የነጭ ጤፍ ዱቄት)',
        name_am: 'የአደአ ንጹህ የነጭ ጤፍ ዱቄት',
        name_om: 'Daakuu Xaafii Adii Ada\'aa',
        description_en: 'Direct from Ada\'a (Debre Zeyit), the gold standard for silky, porous, flexible Injera with authentic pleasant tang.',
        description_am: 'በጥንቃቄ ተበጥሮና ተመርጦ የተፈጨ ጥራት ያለው የአደአ ነጭ ጤፍ ዱቄት።',
        description_om: 'Xaafii adii Ada\'aa irraa kan dhufe, buddeena lallaafaa qopheessuuf kan oolu.',
        price: 650,
        stock: 50,
        min_stock_alert: 10,
        unit: '2kg',
        image_url: 'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&w=600&q=80',
        is_active: true,
        is_featured: true,
        origin: 'Ada\'a, Bishoftu, Ethiopia',
        ingredients_en: '100% Whole Grain White Eragrostis tef',
        usage_en: 'Mix with water and Ersho (starter culture) to ferment for 3-4 days.',
      },
      {
        id: 'prod-beso',
        category_id: 'cat-flours',
        sku: 'AB-FL-008',
        name_en: 'Addis Beso Powder (የበሶ ዱቄት)',
        name_am: 'ጥሩ የበሶ ዱቄት',
        name_om: 'Daakuu Baasoo Aadaa',
        description_en: 'Gently roasted barley ground to fine powder. Mix with cold water, honey, or hot clarified butter for instant, nutritious energy.',
        description_am: 'በጥንቃቄ ከተቆላ ገብስ የተፈጨ ጣፋጭ የበሶ ዱቄት። ለፈጣን ቁርስ ወይም መጠጥ።',
        description_om: 'Daakuu garbuu gubame irraa qophaa\'e, damma ykn aannan waliin dhugama.',
        price: 260,
        stock: 30,
        min_stock_alert: 6,
        unit: '500g',
        image_url: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=600&q=80',
        is_active: true,
        is_featured: false,
        origin: 'North Shoa, Ethiopia',
        ingredients_en: '100% Hulled Roasted Barley',
        usage_en: 'Shake 3 tbsp in water with honey for Beso drink or knead with butter for Chiko.',
      },
      {
        id: 'prod-awaze',
        category_id: 'cat-pastes',
        sku: 'AB-PS-009',
        name_en: 'Artisan Awaze Paste (የተዘጋጀ አዋዜ)',
        name_am: 'የተለየ ባህላዊ አዋዜ',
        name_om: 'Awaazee Aadaa Qophaa\'aa',
        description_en: 'Slow-cured paste made with select berbere, aged honey wine essence, garlic, ginger, and lemon juice. The ultimate pairing for grilled Tibs.',
        description_am: 'ከበርበሬ፣ ከጠጅ ወለላ፣ ነጭ ሽንኩርትና ዝንጅብል ጋር የተዋሃደ ምርጥ አዋዜ።',
        description_om: 'Awaazee dhandhama dammaafi barbaree qabu, xibsiif kan mijatu.',
        price: 320,
        stock: 25,
        min_stock_alert: 6,
        unit: '350g',
        image_url: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80',
        is_active: true,
        is_featured: true,
        origin: 'Addis Ababa, Ethiopia',
        ingredients_en: 'Premium Berbere, Garlic, Ginger, Pure Honey, Tej essence, Lemon, Salt',
        usage_en: 'Serve alongside Tibs, Derek Tibs, or raw Kitfo.',
      },
      {
        id: 'prod-kollo',
        category_id: 'cat-snacks',
        sku: 'AB-SN-010',
        name_en: 'Addis Mixed Roasted Kollo (የቆሎ ቅልቅል)',
        name_am: 'የተጠበሰ የቆሎ ቅልቅል',
        name_om: 'Qolloo Walmakaa',
        description_en: 'Crunchy roasted whole barley, salted chickpeas, peanuts, and peeled sunflower seeds. Traditional accompaniment for Ethiopian coffee ceremonies.',
        description_am: 'ከተመረጠ ገብስ፣ ሽምብራ፣ ኦቾሎኒ እና ሱፍ የተጠበሰ ቆሎ ለቡና ቁርስ።',
        description_om: 'Garbuu, shimbraafi ooyila walmakaa gubame, sirna bunaatiif.',
        price: 190,
        stock: 60,
        min_stock_alert: 12,
        unit: '400g',
        image_url: 'https://images.unsplash.com/photo-1599599810769-bcde5a160d32?auto=format&fit=crop&w=600&q=80',
        is_active: true,
        is_featured: false,
        origin: 'Addis Ababa, Ethiopia',
        ingredients_en: 'Roasted Barley, Chickpeas, Peanuts, Sunflower seeds, Salt',
        usage_en: 'Enjoy with hot coffee or as a wholesome daily snack.',
      },
      {
        id: 'prod-yirgacheffe-coffee',
        category_id: 'cat-coffee',
        sku: 'AB-CF-011',
        name_en: 'Yirgacheffe Baltina Roast (ይርጋጨፌ ቡና)',
        name_am: 'ልዩ የይርጋጨፌ የተቆላ ቡና',
        name_om: 'Buna Yirgaacaffee Qulqulluu',
        description_en: 'Medium artisan drum-roasted Arabica heirloom coffee with jasmine floral notes, bright citrus, and honey undertones.',
        description_am: 'በልዩ ሙያ የተቆላ የይርጋጨፌ ቡና፣ ጥሩ መዓዛና የወተት ቸኮሌት ጣዕም ያለው።',
        description_om: 'Buna Yirgaacaffee fooli daraaraafi dhandhama dammaa qabu.',
        price: 680,
        stock: 20,
        min_stock_alert: 5,
        unit: '500g',
        image_url: 'https://images.unsplash.com/photo-1559056199-641a0ac8b55e?auto=format&fit=crop&w=600&q=80',
        is_active: true,
        is_featured: true,
        origin: 'Yirgacheffe, Gedeo, Ethiopia',
        ingredients_en: '100% Ethiopian Arabica Specialty Coffee Beans',
        usage_en: 'Grind fresh and brew in traditional Jebena or French press.',
      },
    ];

    seedProducts.forEach((prod) => this.products.set(prod.id, prod));

    // Seed some initial orders for demonstration and analytics
    const initialOrder: Order = {
      id: 'AB-2026-1048',
      customer_name: 'Almaz Tadesse',
      customer_phone: '+251 911 234 567',
      delivery_subcity: 'Bole',
      delivery_woreda: '03',
      delivery_landmark: 'Near Edna Mall, Atlas Hotel area',
      delivery_notes: 'Please call when arriving at gate',
      payment_method: 'TELEBIRR',
      payment_reference: 'TB-982148124',
      status: 'PROCESSING',
      subtotal: 1170,
      delivery_fee: 0,
      tax: 0,
      total: 1170,
      source: 'WEB',
      items: [
        {
          id: 'item-1',
          order_id: 'AB-2026-1048',
          product_id: 'prod-berbere-special',
          product_name: 'Special Blend Berbere (የደለዘ በርበሬ)',
          unit_price: 450,
          quantity: 2,
          subtotal: 900,
        },
        {
          id: 'item-2',
          order_id: 'AB-2026-1048',
          product_id: 'prod-beso',
          product_name: 'Addis Beso Powder (የበሶ ዱቄት)',
          unit_price: 260,
          quantity: 1,
          subtotal: 260,
        },
      ],
      created_at: new Date(Date.now() - 3600000 * 4).toISOString(),
      updated_at: new Date(Date.now() - 3600000 * 2).toISOString(),
    };

    const initialOrder2: Order = {
      id: 'AB-2026-1049',
      customer_name: 'Dawit Bekele',
      customer_phone: '+251 922 876 543',
      delivery_subcity: 'Yeka',
      delivery_woreda: '08',
      delivery_landmark: 'Megenagna roundabout, near Zefmesh Mall',
      delivery_notes: 'Leave with reception if not home',
      payment_method: 'CASH_ON_DELIVERY',
      status: 'PENDING',
      subtotal: 720,
      delivery_fee: 100,
      tax: 0,
      total: 820,
      source: 'TELEGRAM_MINI_APP',
      items: [
        {
          id: 'item-3',
          order_id: 'AB-2026-1049',
          product_id: 'prod-shiro-special',
          product_name: 'Spiced Shiro Powder (ሚጥሚጣ ሽሮ)',
          unit_price: 340,
          quantity: 1,
          subtotal: 340,
        },
        {
          id: 'item-4',
          order_id: 'AB-2026-1049',
          product_id: 'prod-mitmita',
          product_name: 'Addis Authentic Mitmita (ሚጥሚጣ)',
          unit_price: 380,
          quantity: 1,
          subtotal: 380,
        },
      ],
      created_at: new Date(Date.now() - 1800000).toISOString(),
      updated_at: new Date(Date.now() - 1800000).toISOString(),
    };

    this.orders.set(initialOrder.id, initialOrder);
    this.orders.set(initialOrder2.id, initialOrder2);

    this.notifications.push({
      id: 'notif-1',
      title: 'New Order Received',
      message: 'Order AB-2026-1049 placed via Telegram Mini App by Dawit Bekele (820 ETB).',
      type: 'ORDER_UPDATE',
      is_read: false,
      created_at: new Date(Date.now() - 1800000).toISOString(),
      reference_id: 'AB-2026-1049',
    });
  }

  // Categories
  public getCategories(): Category[] {
    return Array.from(this.categories.values()).sort((a, b) => a.display_order - b.display_order);
  }

  // Products
  public getProducts(options?: { categorySlug?: string; search?: string }): Product[] {
    let prods = Array.from(this.products.values()).filter((p) => p.is_active);

    if (options?.categorySlug && options.categorySlug !== 'all') {
      const cat = Array.from(this.categories.values()).find((c) => c.slug === options.categorySlug);
      if (cat) {
        prods = prods.filter((p) => p.category_id === cat.id);
      }
    }

    if (options?.search) {
      const q = options.search.toLowerCase().trim();
      prods = prods.filter(
        (p) =>
          p.name_en.toLowerCase().includes(q) ||
          p.name_am.includes(q) ||
          p.name_om.toLowerCase().includes(q) ||
          p.description_en.toLowerCase().includes(q)
      );
    }

    return prods;
  }

  public getProductById(id: string): Product | undefined {
    return this.products.get(id);
  }

  // Create Order with Authoritative Server Pricing & Stock Decrement & Idempotency
  public createOrder(params: {
    customer_name: string;
    customer_phone: string;
    delivery_subcity: string;
    delivery_woreda?: string;
    delivery_landmark?: string;
    delivery_notes?: string;
    payment_method: PaymentMethod;
    payment_reference?: string;
    items: Array<{ product_id: string; quantity: number }>;
    idempotency_key?: string;
    source?: OrderSource;
  }): { success: true; order: Order } | { success: false; error: string; code: string } {
    // 1. Check idempotency
    if (params.idempotency_key && this.idempotencyKeys.has(params.idempotency_key)) {
      const existingId = this.idempotencyKeys.get(params.idempotency_key)!;
      const existingOrder = this.orders.get(existingId);
      if (existingOrder) {
        return { success: true, order: existingOrder };
      }
    }

    // 2. Validate items array
    if (!params.items || params.items.length === 0) {
      return { success: false, error: 'Order must contain at least one product', code: 'EMPTY_CART' };
    }

    // 3. Verify stock & compute authoritative pricing
    const preparedItems: {
      product: Product;
      quantity: number;
      unitPrice: number;
      subtotal: number;
    }[] = [];

    for (const itemReq of params.items) {
      if (itemReq.quantity <= 0) {
        return { success: false, error: 'Quantity must be greater than zero', code: 'INVALID_QUANTITY' };
      }
      const product = this.products.get(itemReq.product_id);
      if (!product || !product.is_active) {
        return { success: false, error: `Product not found or inactive`, code: 'PRODUCT_NOT_FOUND' };
      }
      if (product.stock < itemReq.quantity) {
        return {
          success: false,
          error: `Insufficient inventory for ${product.name_en}. Only ${product.stock} available.`,
          code: 'OUT_OF_STOCK',
        };
      }
      const itemSubtotal = product.price * itemReq.quantity;
      preparedItems.push({
        product,
        quantity: itemReq.quantity,
        unitPrice: product.price,
        subtotal: itemSubtotal,
      });
    }

    // 4. Calculate subtotal & delivery fee
    const subtotal = preparedItems.reduce((acc, curr) => acc + curr.subtotal, 0);
    // Free delivery for orders >= 1200 ETB, else 100 ETB flat delivery fee across Addis Ababa
    const delivery_fee = subtotal >= 1200 ? 0 : 100;
    const tax = 0; // Agro-baltina tax exempt
    const total = subtotal + delivery_fee + tax;

    // 5. Generate Order ID
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const orderId = `AB-${new Date().getFullYear()}-${randomSuffix}`;

    // 6. Deduct stock atomically and log transactions
    for (const item of preparedItems) {
      const prevStock = item.product.stock;
      const newStock = prevStock - item.quantity;
      item.product.stock = newStock;
      this.products.set(item.product.id, { ...item.product });

      this.inventoryTransactions.push({
        id: `tx-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        product_id: item.product.id,
        change_amount: -item.quantity,
        previous_stock: prevStock,
        new_stock: newStock,
        reason: 'ORDER_PLACEMENT',
        reference_id: orderId,
        performed_by: 'CUSTOMER_CHECKOUT',
        created_at: new Date().toISOString(),
      });

      // Low stock notification check
      if (newStock <= item.product.min_stock_alert) {
        const notif: AppNotification = {
          id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          title: 'Low Stock Alert',
          message: `${item.product.name_en} has reached low stock: only ${newStock} units left!`,
          type: 'LOW_STOCK',
          is_read: false,
          created_at: new Date().toISOString(),
          reference_id: item.product.id,
        };
        this.notifications.unshift(notif);
        this.broadcast('inventory:low', notif);
      }
    }

    // 7. Assemble Order
    const orderItems = preparedItems.map((pi, idx) => ({
      id: `item-${orderId}-${idx + 1}`,
      order_id: orderId,
      product_id: pi.product.id,
      product_name: pi.product.name_en,
      unit_price: pi.unitPrice,
      quantity: pi.quantity,
      subtotal: pi.subtotal,
    }));

    const nowStr = new Date().toISOString();
    const newOrder: Order = {
      id: orderId,
      customer_name: params.customer_name,
      customer_phone: params.customer_phone,
      delivery_subcity: params.delivery_subcity,
      delivery_woreda: params.delivery_woreda,
      delivery_landmark: params.delivery_landmark,
      delivery_notes: params.delivery_notes,
      payment_method: params.payment_method,
      payment_reference: params.payment_reference,
      status: 'PENDING',
      subtotal,
      delivery_fee,
      tax,
      total,
      idempotency_key: params.idempotency_key,
      source: params.source || 'WEB',
      items: orderItems,
      created_at: nowStr,
      updated_at: nowStr,
    };

    this.orders.set(orderId, newOrder);

    if (params.idempotency_key) {
      this.idempotencyKeys.set(params.idempotency_key, orderId);
    }

    // Log audit
    this.auditLogs.unshift({
      id: `audit-${Date.now()}`,
      action: 'ORDER_CREATED',
      entity_type: 'ORDER',
      entity_id: orderId,
      details: { total, customer: params.customer_name, source: params.source || 'WEB' },
      performed_by: 'CUSTOMER',
      created_at: nowStr,
    });

    // Notify & broadcast
    const notif: AppNotification = {
      id: `notif-${Date.now()}`,
      title: 'New Order Received',
      message: `Order #${orderId} placed by ${params.customer_name} for ${total} ETB.`,
      type: 'ORDER_UPDATE',
      is_read: false,
      created_at: nowStr,
      reference_id: orderId,
    };
    this.notifications.unshift(notif);

    this.broadcast('order:created', newOrder);
    this.broadcast('notification:new', notif);

    return { success: true, order: newOrder };
  }

  // Get orders
  public getOrders(filter?: { status?: string; search?: string }): Order[] {
    let list = Array.from(this.orders.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    if (filter?.status && filter.status !== 'ALL') {
      list = list.filter((o) => o.status === filter.status);
    }

    if (filter?.search) {
      const q = filter.search.toLowerCase().trim();
      list = list.filter(
        (o) =>
          o.id.toLowerCase().includes(q) ||
          o.customer_name.toLowerCase().includes(q) ||
          o.customer_phone.includes(q)
      );
    }

    return list;
  }

  public getOrderById(id: string): Order | undefined {
    return this.orders.get(id);
  }

  // Update order status
  public updateOrderStatus(
    orderId: string,
    newStatus: OrderStatus,
    performedBy: string = 'ADMIN'
  ): { success: boolean; order?: Order; error?: string } {
    const order = this.orders.get(orderId);
    if (!order) {
      return { success: false, error: 'Order not found' };
    }

    const previousStatus = order.status;
    if (previousStatus === newStatus) {
      return { success: true, order };
    }

    // If order was cancelled, restock items
    if (newStatus === 'CANCELLED' && previousStatus !== 'CANCELLED') {
      for (const item of order.items) {
        const prod = this.products.get(item.product_id);
        if (prod) {
          const prev = prod.stock;
          prod.stock = prev + item.quantity;
          this.products.set(prod.id, { ...prod });

          this.inventoryTransactions.push({
            id: `tx-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            product_id: prod.id,
            change_amount: item.quantity,
            previous_stock: prev,
            new_stock: prod.stock,
            reason: 'ORDER_CANCELLATION',
            reference_id: orderId,
            performed_by: performedBy,
            created_at: new Date().toISOString(),
          });
        }
      }
    }

    order.status = newStatus;
    order.updated_at = new Date().toISOString();
    this.orders.set(orderId, { ...order });

    // Audit log
    this.auditLogs.unshift({
      id: `audit-${Date.now()}`,
      action: 'ORDER_STATUS_CHANGED',
      entity_type: 'ORDER',
      entity_id: orderId,
      details: { previousStatus, newStatus },
      performed_by: performedBy,
      created_at: new Date().toISOString(),
    });

    const notif: AppNotification = {
      id: `notif-${Date.now()}`,
      title: 'Order Status Updated',
      message: `Order #${orderId} is now ${newStatus.replace(/_/g, ' ')}.`,
      type: 'ORDER_UPDATE',
      is_read: false,
      created_at: new Date().toISOString(),
      reference_id: orderId,
    };
    this.notifications.unshift(notif);

    this.broadcast('order:status_changed', { orderId, status: newStatus, order });
    this.broadcast('notification:new', notif);

    return { success: true, order };
  }

  // Inventory adjustment
  public adjustInventory(params: {
    productId: string;
    newStock: number;
    reason: 'RESTOCK' | 'DAMAGE' | 'AUDIT_ADJUSTMENT';
    performedBy: string;
  }): { success: boolean; product?: Product; error?: string } {
    const product = this.products.get(params.productId);
    if (!product) {
      return { success: false, error: 'Product not found' };
    }

    const previousStock = product.stock;
    const diff = params.newStock - previousStock;
    product.stock = params.newStock;
    this.products.set(product.id, { ...product });

    this.inventoryTransactions.push({
      id: `tx-${Date.now()}`,
      product_id: product.id,
      change_amount: diff,
      previous_stock: previousStock,
      new_stock: params.newStock,
      reason: params.reason,
      performed_by: params.performedBy,
      created_at: new Date().toISOString(),
    });

    this.auditLogs.unshift({
      id: `audit-${Date.now()}`,
      action: 'INVENTORY_ADJUSTED',
      entity_type: 'PRODUCT',
      entity_id: product.id,
      details: { previousStock, newStock: params.newStock, diff, reason: params.reason },
      performed_by: params.performedBy,
      created_at: new Date().toISOString(),
    });

    this.broadcast('inventory:updated', { productId: product.id, stock: params.newStock });
    return { success: true, product };
  }

  public getInventoryTransactions(): InventoryTransaction[] {
    return [...this.inventoryTransactions].reverse();
  }

  public getAuditLogs(): AuditLog[] {
    return this.auditLogs.slice(0, 50);
  }

  public getNotifications(): AppNotification[] {
    return this.notifications.slice(0, 30);
  }

  public markNotificationRead(id: string): void {
    const n = this.notifications.find((notif) => notif.id === id);
    if (n) n.is_read = true;
  }

  public getStats() {
    const ordersList = Array.from(this.orders.values());
    const totalOrders = ordersList.length;
    const totalRevenue = ordersList
      .filter((o) => o.status !== 'CANCELLED')
      .reduce((sum, o) => sum + o.total, 0);

    const pendingOrders = ordersList.filter((o) => o.status === 'PENDING').length;
    const activeOrders = ordersList.filter(
      (o) => !['DELIVERED', 'CANCELLED'].includes(o.status)
    ).length;

    const productsList = Array.from(this.products.values());
    const totalProducts = productsList.length;
    const lowStockCount = productsList.filter((p) => p.stock <= p.min_stock_alert).length;

    const statusCounts = ordersList.reduce((acc, curr) => {
      acc[curr.status] = (acc[curr.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalRevenue,
      totalOrders,
      pendingOrders,
      activeOrders,
      totalProducts,
      lowStockCount,
      statusCounts,
      recentOrders: ordersList.slice(0, 5),
    };
  }
}

export const db = new DatabaseStore();
