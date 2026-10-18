import fs from "fs";
import path from "path";
import { createAdminClient } from "../src/lib/supabase/admin";
import { getIstDayRange } from "../src/lib/date-utils";

// 1. Ensure .env.local variables are loaded when running script directly
function loadEnvLocal() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) {
      process.env[key] = val;
    }
  }
}

loadEnvLocal();

const DEMO_EMAIL = process.env.DEMO_USER_EMAIL || "demo@dukaanai.in";
const DEMO_PASSWORD = process.env.DEMO_USER_PASSWORD as string;

async function seed() {
  console.log("🌱 Starting DukaanAI database seed...");
  const supabase = createAdminClient();

  // --------------------------------------------------------------------------
  // 1. Provision Demo User in auth.users
  // --------------------------------------------------------------------------
  console.log(`👤 Checking demo user: ${DEMO_EMAIL}`);
  const { data: usersData, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) {
    throw new Error(`Failed to list users: ${listError.message}`);
  }

  let demoUser = usersData.users.find((u) => u.email === DEMO_EMAIL);

  if (!demoUser) {
    console.log("Creating demo user...");
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: { name: "Ramesh Sharma (Kirana Owner)" },
    });
    if (createError) throw new Error(`Failed to create demo user: ${createError.message}`);
    demoUser = newUser.user;
  } else {
    console.log("Demo user exists, updating password and metadata...");
    const { data: updatedUser, error: updateError } = await supabase.auth.admin.updateUserById(
      demoUser.id,
      {
        password: DEMO_PASSWORD,
        email_confirm: true,
        user_metadata: { name: "Ramesh Sharma (Kirana Owner)" },
      }
    );
    if (updateError) throw new Error(`Failed to update demo user: ${updateError.message}`);
    demoUser = updatedUser.user;
  }

  const userId = demoUser.id;

  // --------------------------------------------------------------------------
  // 2. Demo Shop
  // --------------------------------------------------------------------------
  console.log("🏪 Setting up demo shop: 'Sharma Kirana Store'...");
  let { data: shop } = await supabase
    .from("shops")
    .select("*")
    .eq("owner_id", userId)
    .single();

  if (!shop) {
    const { data: newShop, error: shopError } = await supabase
      .from("shops")
      .insert({
        owner_id: userId,
        name: "Sharma Kirana Store",
        gstin: "07AAAAA0000A1Z5",
        language: "hi",
      })
      .select()
      .single();

    if (shopError) throw new Error(`Failed to insert shop: ${shopError.message}`);
    shop = newShop;
  }

  const shopId = shop.id;

  // --------------------------------------------------------------------------
  // 3. Clean previous seeded data for fresh idempotent run
  // --------------------------------------------------------------------------
  console.log("🧹 Clearing old shop data for clean re-seed...");
  await supabase.from("agent_logs").delete().eq("shop_id", shopId);
  await supabase.from("transactions").delete().eq("shop_id", shopId);
  await supabase.from("products").delete().eq("shop_id", shopId);
  await supabase.from("customers").delete().eq("shop_id", shopId);

  // --------------------------------------------------------------------------
  // 4. Seed 15 Realistic Indian Customers
  // --------------------------------------------------------------------------
  console.log("👥 Seeding 15 customers...");
  const customerList = [
    { name: "Ramesh Kumar", phone: "+91 98765 43210", notes: "Main road, electrician, weekly settlement" },
    { name: "Sunita Devi", phone: "+91 98123 45678", notes: "House 14, monthly ration buyer" },
    { name: "Suresh Verma", phone: "+91 97234 56789", notes: "Govt teacher, clears udhar on 1st" },
    { name: "Anjali Sharma", phone: "+91 96345 67890", notes: "Sharma ji ki bahu, regular customer" },
    { name: "Rajesh Gupta", phone: "+91 95456 78901", notes: "Auto driver, pays daily or weekly" },
    { name: "Priya Patel", phone: "+91 94567 89012", notes: "Near Shiva temple, pays via UPI" },
    { name: "Manoj Tiwari", phone: "+91 93678 90123", notes: "Tailor shop owner, good credit history" },
    { name: "Pooja Singh", phone: "+91 92789 01234", notes: "School clerk, pays on 5th" },
    { name: "Deepak Yadav", phone: "+91 91890 12345", notes: "Dairy milk supplier" },
    { name: "Geeta Bai", phone: "+91 90901 23456", notes: "House helper, small frequent purchases" },
    { name: "Vikas Jain", phone: "+91 98012 34567", notes: "Hardware store neighbor" },
    { name: "Meena Verma", phone: "+91 97123 45670", notes: "Near community park" },
    { name: "Amit Joshi", phone: "+91 96234 56781", notes: "IT remote worker, high-value purchases" },
    { name: "Rekha Gupta", phone: "+91 95345 67892", notes: "Boutique owner" },
    { name: "Sanjay Mishra", phone: "+91 94456 78903", notes: "Post office employee" },
  ];

  const { data: insertedCustomers, error: custError } = await supabase
    .from("customers")
    .insert(customerList.map((c) => ({ ...c, shop_id: shopId })))
    .select();

  if (custError) throw new Error(`Failed to insert customers: ${custError.message}`);
  console.log(`✅ Inserted ${insertedCustomers.length} customers.`);

  // --------------------------------------------------------------------------
  // 5. Seed 30 Grocery Products
  // --------------------------------------------------------------------------
  console.log("📦 Seeding 30 grocery products...");
  const productList = [
    { name: "Aashirvaad Shudh Chakki Atta 5kg", unit: "packet", price: 225.0, stock_qty: 24, reorder_level: 5 },
    { name: "Fortune Sunlite Refined Oil 1L", unit: "l", price: 145.0, stock_qty: 3, reorder_level: 6 }, // Low stock (3 <= 6)
    { name: "Tata Salt Desh Ka Namak 1kg", unit: "packet", price: 28.0, stock_qty: 55, reorder_level: 10 },
    { name: "Maggi 2-Minute Masala Noodles 70g", unit: "packet", price: 14.0, stock_qty: 80, reorder_level: 20 },
    { name: "Amul Butter Pasteurized 100g", unit: "piece", price: 58.0, stock_qty: 2, reorder_level: 5 }, // Low stock (2 <= 5)
    { name: "Parle-G Original Glucose 250g", unit: "packet", price: 25.0, stock_qty: 45, reorder_level: 10 },
    { name: "Taj Mahal Tea Leaves 250g", unit: "packet", price: 160.0, stock_qty: 2, reorder_level: 4 }, // Low stock (2 <= 4)
    { name: "Toor Dal Desi 1kg", unit: "kg", price: 155.0, stock_qty: 4, reorder_level: 8 }, // Low stock (4 <= 8)
    { name: "Chana Dal Premium 1kg", unit: "kg", price: 95.0, stock_qty: 26, reorder_level: 6 },
    { name: "Moong Dal Dhuli 1kg", unit: "kg", price: 120.0, stock_qty: 22, reorder_level: 5 },
    { name: "India Gate Rozzana Basmati Rice 1kg", unit: "kg", price: 110.0, stock_qty: 38, reorder_level: 8 },
    { name: "Kolam Regular Rice 1kg", unit: "kg", price: 55.0, stock_qty: 65, reorder_level: 15 },
    { name: "Madhur Pure & Hygienic Sugar 1kg", unit: "kg", price: 48.0, stock_qty: 50, reorder_level: 10 },
    { name: "MDH Haldi Powder 100g", unit: "packet", price: 38.0, stock_qty: 25, reorder_level: 5 },
    { name: "Everest Lal Mirch Powder 100g", unit: "packet", price: 48.0, stock_qty: 20, reorder_level: 5 },
    { name: "Catch Dhaniya Powder 100g", unit: "packet", price: 42.0, stock_qty: 18, reorder_level: 5 },
    { name: "Tata Sampann Garam Masala 100g", unit: "packet", price: 85.0, stock_qty: 15, reorder_level: 4 },
    { name: "Dettol Original Bathing Soap 75g", unit: "piece", price: 40.0, stock_qty: 35, reorder_level: 8 },
    { name: "Surf Excel Easy Wash Detergent 500g", unit: "packet", price: 75.0, stock_qty: 28, reorder_level: 6 },
    { name: "Vim Dishwash Bar Lemon 300g", unit: "piece", price: 20.0, stock_qty: 45, reorder_level: 10 },
    { name: "Colgate Strong Teeth Toothpaste 150g", unit: "piece", price: 105.0, stock_qty: 18, reorder_level: 5 },
    { name: "Lizol Floor Cleaner Citrus 500ml", unit: "piece", price: 115.0, stock_qty: 12, reorder_level: 4 },
    { name: "Good Knight Gold Flash Machine + Refill", unit: "piece", price: 88.0, stock_qty: 15, reorder_level: 4 },
    { name: "Amul Taaza Toned Fresh Milk 500ml", unit: "packet", price: 32.0, stock_qty: 3, reorder_level: 8 }, // Low stock (3 <= 8)
    { name: "Kissan Fresh Tomato Ketchup 500g", unit: "piece", price: 120.0, stock_qty: 15, reorder_level: 4 },
    { name: "Britannia Good Day Cashew 200g", unit: "packet", price: 45.0, stock_qty: 30, reorder_level: 8 },
    { name: "Everest Chat Masala 100g", unit: "packet", price: 68.0, stock_qty: 14, reorder_level: 4 },
    { name: "Haldiram's Bhujia Sev 200g", unit: "packet", price: 55.0, stock_qty: 24, reorder_level: 6 },
    { name: "Fortune Kachi Ghani Mustard Oil 1L", unit: "l", price: 150.0, stock_qty: 17, reorder_level: 5 },
    { name: "Rajma Kashmiri Chitra 1kg", unit: "kg", price: 165.0, stock_qty: 16, reorder_level: 4 },
  ];

  const { data: insertedProducts, error: prodError } = await supabase
    .from("products")
    .insert(productList.map((p) => ({ ...p, shop_id: shopId })))
    .select();

  if (prodError) throw new Error(`Failed to insert products: ${prodError.message}`);
  console.log(`✅ Inserted ${insertedProducts.length} products.`);

  // --------------------------------------------------------------------------
  // 6. Seed 3 Months of Transactions (90 days)
  // --------------------------------------------------------------------------
  console.log("📝 Generating 3 months of transactions...");
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  // Create customer map and product map for easy reference
  const custMap = new Map(insertedCustomers.map((c) => [c.name, c.id]));
  const prodMap = new Map(insertedProducts.map((p) => [p.name, p]));

  // Realistic transaction templates
  const transactionBlueprints = [
    // Ramesh Kumar (moderate udhar)
    {
      custName: "Ramesh Kumar",
      daysAgo: 85,
      type: "sale",
      raw_input: "Ramesh ne 5kg atta aur 1 packet namak liya, 100 diya baki udhar",
      items: [
        { prodName: "Aashirvaad Shudh Chakki Atta 5kg", qty: 1 },
        { prodName: "Tata Salt Desh Ka Namak 1kg", qty: 1 },
      ],
      paid: 100,
    },
    {
      custName: "Ramesh Kumar",
      daysAgo: 60,
      type: "payment",
      raw_input: "Ramesh ne 150 rupaye jama karwaye",
      items: [],
      paid: 150,
      total: 150,
    },
    {
      custName: "Ramesh Kumar",
      daysAgo: 40,
      type: "sale",
      raw_input: "Ramesh: 2L mustard oil aur 1kg toor dal, 200 cash baki udhar",
      items: [
        { prodName: "Fortune Kachi Ghani Mustard Oil 1L", qty: 2 },
        { prodName: "Toor Dal Desi 1kg", qty: 1 },
      ],
      paid: 200,
    },
    {
      custName: "Ramesh Kumar",
      daysAgo: 12,
      type: "sale",
      raw_input: "Ramesh ne 4 packet Maggi aur 1 Surf Excel liya, bola kal dunga",
      items: [
        { prodName: "Maggi 2-Minute Masala Noodles 70g", qty: 4 },
        { prodName: "Surf Excel Easy Wash Detergent 500g", qty: 1 },
      ],
      paid: 0,
    },

    // Sunita Devi (regular monthly buyer, partial credit)
    {
      custName: "Sunita Devi",
      daysAgo: 75,
      type: "sale",
      raw_input: "Sunita ji ka mahine ka rashan: 5kg atta, 2kg chini, 1kg toor dal, 500 diye",
      items: [
        { prodName: "Aashirvaad Shudh Chakki Atta 5kg", qty: 1 },
        { prodName: "Madhur Pure & Hygienic Sugar 1kg", qty: 2 },
        { prodName: "Toor Dal Desi 1kg", qty: 1 },
      ],
      paid: 300,
    },
    {
      custName: "Sunita Devi",
      daysAgo: 45,
      type: "payment",
      raw_input: "Sunita Devi ne 200 rupaye pichla udhar chukaya",
      items: [],
      paid: 200,
      total: 200,
    },
    {
      custName: "Sunita Devi",
      daysAgo: 15,
      type: "sale",
      raw_input: "Sunita ji: 1L refined oil aur 2 packet Good Day biscuit, sab udhar",
      items: [
        { prodName: "Fortune Sunlite Refined Oil 1L", qty: 1 },
        { prodName: "Britannia Good Day Cashew 200g", qty: 2 },
      ],
      paid: 0,
    },

    // Suresh Verma (Govt teacher, high-value transactions, clears promptly)
    {
      custName: "Suresh Verma",
      daysAgo: 70,
      type: "sale",
      raw_input: "Suresh Verma ji: Basmati rice 2kg, Garam masala, Amul butter, poora udhar likho",
      items: [
        { prodName: "India Gate Rozzana Basmati Rice 1kg", qty: 2 },
        { prodName: "Tata Sampann Garam Masala 100g", qty: 1 },
        { prodName: "Amul Butter Pasteurized 100g", qty: 1 },
      ],
      paid: 0,
    },
    {
      custName: "Suresh Verma",
      daysAgo: 62,
      type: "payment",
      raw_input: "Suresh ji ne 363 rupaye account me daal diye",
      items: [],
      paid: 363,
      total: 363,
    },
    {
      custName: "Suresh Verma",
      daysAgo: 20,
      type: "sale",
      raw_input: "Suresh Verma: 5kg atta, 2kg chana dal, Taj Mahal chai, 300 diye",
      items: [
        { prodName: "Aashirvaad Shudh Chakki Atta 5kg", qty: 1 },
        { prodName: "Chana Dal Premium 1kg", qty: 2 },
        { prodName: "Taj Mahal Tea Leaves 250g", qty: 1 },
      ],
      paid: 300,
    },

    // Anjali Sharma (daily cash & small credit)
    {
      custName: "Anjali Sharma",
      daysAgo: 65,
      type: "sale",
      raw_input: "Anjali: 3 packet Maggi aur 2 Dettol soap, cash payment",
      items: [
        { prodName: "Maggi 2-Minute Masala Noodles 70g", qty: 3 },
        { prodName: "Dettol Original Bathing Soap 75g", qty: 2 },
      ],
      paid: 122,
    },
    {
      custName: "Anjali Sharma",
      daysAgo: 25,
      type: "sale",
      raw_input: "Anjali Sharma ji: 1kg rajma aur Haldi powder, udhar",
      items: [
        { prodName: "Rajma Kashmiri Chitra 1kg", qty: 1 },
        { prodName: "MDH Haldi Powder 100g", qty: 1 },
      ],
      paid: 50,
    },

    // Rajesh Gupta (auto driver, weekly udhar)
    {
      custName: "Rajesh Gupta",
      daysAgo: 50,
      type: "sale",
      raw_input: "Rajesh auto wale ne 2 Parle-G aur 1 packet surf liya, udhar",
      items: [
        { prodName: "Parle-G Original Glucose 250g", qty: 2 },
        { prodName: "Surf Excel Easy Wash Detergent 500g", qty: 1 },
      ],
      paid: 0,
    },
    {
      custName: "Rajesh Gupta",
      daysAgo: 35,
      type: "payment",
      raw_input: "Rajesh ne 100 rupaye diye",
      items: [],
      paid: 100,
      total: 100,
    },
    {
      custName: "Rajesh Gupta",
      daysAgo: 5,
      type: "sale",
      raw_input: "Rajesh Gupta: 1L refined oil aur 1 Vim bar, 100 diya",
      items: [
        { prodName: "Fortune Sunlite Refined Oil 1L", qty: 1 },
        { prodName: "Vim Dishwash Bar Lemon 300g", qty: 1 },
      ],
      paid: 100,
    },

    // Priya Patel (frequent purchases, small pending balance)
    {
      custName: "Priya Patel",
      daysAgo: 48,
      type: "sale",
      raw_input: "Priya Patel: Colgate paste aur Lizol floor cleaner, UPI kiya",
      items: [
        { prodName: "Colgate Strong Teeth Toothpaste 150g", qty: 1 },
        { prodName: "Lizol Floor Cleaner Citrus 500ml", qty: 1 },
      ],
      paid: 220,
    },
    {
      custName: "Priya Patel",
      daysAgo: 8,
      type: "sale",
      raw_input: "Priya: Kissan ketchup aur 1 packet Bhujia, kal dengi",
      items: [
        { prodName: "Kissan Fresh Tomato Ketchup 500g", qty: 1 },
        { prodName: "Haldiram's Bhujia Sev 200g", qty: 1 },
      ],
      paid: 0,
    },

    // Manoj Tiwari (tailor, large monthly bill)
    {
      custName: "Manoj Tiwari",
      daysAgo: 55,
      type: "sale",
      raw_input: "Manoj Tiwari tailor: 5kg atta, 2kg kolam rice, 1L mustard oil, poora udhar",
      items: [
        { prodName: "Aashirvaad Shudh Chakki Atta 5kg", qty: 1 },
        { prodName: "Kolam Regular Rice 1kg", qty: 2 },
        { prodName: "Fortune Kachi Ghani Mustard Oil 1L", qty: 1 },
      ],
      paid: 0,
    },
    {
      custName: "Manoj Tiwari",
      daysAgo: 28,
      type: "payment",
      raw_input: "Manoj ji ne 400 rupaye hisab ke diye",
      items: [],
      paid: 400,
      total: 400,
    },

    // Deepak Yadav (dairy owner)
    {
      custName: "Deepak Yadav",
      daysAgo: 38,
      type: "sale",
      raw_input: "Deepak dairy wale: 3kg chini aur Everest lal mirch, 100 diya",
      items: [
        { prodName: "Madhur Pure & Hygienic Sugar 1kg", qty: 3 },
        { prodName: "Everest Lal Mirch Powder 100g", qty: 1 },
      ],
      paid: 100,
    },
    {
      custName: "Deepak Yadav",
      daysAgo: 10,
      type: "sale",
      raw_input: "Deepak: Good knight refill aur 2 soap, udhar me likho",
      items: [
        { prodName: "Good Knight Gold Flash Machine + Refill", qty: 1 },
        { prodName: "Dettol Original Bathing Soap 75g", qty: 2 },
      ],
      paid: 0,
    },

    // Amit Joshi (high value, recent transactions)
    {
      custName: "Amit Joshi",
      daysAgo: 18,
      type: "sale",
      raw_input: "Amit Joshi: Basmati rice 3kg, Taj Mahal tea 2 packets, Amul butter 2 packets, cash",
      items: [
        { prodName: "India Gate Rozzana Basmati Rice 1kg", qty: 3 },
        { prodName: "Taj Mahal Tea Leaves 250g", qty: 2 },
        { prodName: "Amul Butter Pasteurized 100g", qty: 2 },
      ],
      paid: 766,
    },
    {
      custName: "Amit Joshi",
      daysAgo: 2,
      type: "sale",
      raw_input: "Amit: 1 bottle ketchup aur 2 packet bhujia, bola shaam ko Google Pay karega",
      items: [
        { prodName: "Kissan Fresh Tomato Ketchup 500g", qty: 1 },
        { prodName: "Haldiram's Bhujia Sev 200g", qty: 2 },
      ],
      paid: 0,
    },

    // Vikas Jain
    {
      custName: "Vikas Jain",
      daysAgo: 14,
      type: "sale",
      raw_input: "Vikas Jain: 2kg moong dal aur 1kg salt, 200 diya",
      items: [
        { prodName: "Moong Dal Dhuli 1kg", qty: 2 },
        { prodName: "Tata Salt Desh Ka Namak 1kg", qty: 1 },
      ],
      paid: 200,
    },

    // Rekha Gupta
    {
      custName: "Rekha Gupta",
      daysAgo: 7,
      type: "sale",
      raw_input: "Rekha Gupta boutique wali: 1L refined oil aur 1kg chini, udhar",
      items: [
        { prodName: "Fortune Sunlite Refined Oil 1L", qty: 1 },
        { prodName: "Madhur Pure & Hygienic Sugar 1kg", qty: 1 },
      ],
      paid: 50,
    },

    // Sanjay Mishra (yesterday)
    {
      custName: "Sanjay Mishra",
      daysAgo: 1,
      type: "sale",
      raw_input: "Sanjay Mishra ji: 5kg atta aur 1 packet garam masala, 200 cash diya",
      items: [
        { prodName: "Aashirvaad Shudh Chakki Atta 5kg", qty: 1 },
        { prodName: "Tata Sampann Garam Masala 100g", qty: 1 },
      ],
      paid: 200,
    },

    // ── Several transactions strictly dated TODAY in Asia/Kolkata (IST) ──
    {
      custName: "Ramesh Kumar",
      exactDateIso: new Date(getIstDayRange().start.getTime() + 3.5 * 3600 * 1000).toISOString(),
      daysAgo: 0,
      type: "sale",
      raw_input: "Ramesh Kumar: 5kg atta aur 1 packet Maggi, 200 diya baki udhar",
      items: [
        { prodName: "Aashirvaad Shudh Chakki Atta 5kg", qty: 1 },
        { prodName: "Maggi 2-Minute Masala Noodles 70g", qty: 1 },
      ],
      paid: 200,
    },
    {
      custName: "Sunita Devi",
      exactDateIso: new Date(getIstDayRange().start.getTime() + 5.5 * 3600 * 1000).toISOString(),
      daysAgo: 0,
      type: "payment",
      raw_input: "Sunita Devi ne 250 rupaye pichla udhar jama karwaya",
      items: [],
      paid: 250,
      total: 250,
    },
    {
      custName: "Priya Patel",
      exactDateIso: new Date(getIstDayRange().start.getTime() + 7 * 3600 * 1000).toISOString(),
      daysAgo: 0,
      type: "sale",
      raw_input: "Priya Patel: 2 packet Good Day biscuit aur 1 bottle ketchup, cash diya",
      items: [
        { prodName: "Britannia Good Day Cashew 200g", qty: 2 },
        { prodName: "Kissan Fresh Tomato Ketchup 500g", qty: 1 },
      ],
      paid: 210,
    },
    {
      custName: "Sanjay Mishra",
      exactDateIso: new Date(getIstDayRange().start.getTime() + 9.5 * 3600 * 1000).toISOString(),
      daysAgo: 0,
      type: "sale",
      raw_input: "Sanjay Mishra ji: 1L mustard oil aur 1kg toor dal, udhar me likho",
      items: [
        { prodName: "Fortune Kachi Ghani Mustard Oil 1L", qty: 1 },
        { prodName: "Toor Dal Desi 1kg", qty: 1 },
      ],
      paid: 0,
    },
  ];

  let totalTxCount = 0;
  let totalItemsCount = 0;

  for (const bp of transactionBlueprints) {
    const custId = custMap.get(bp.custName);
    if (!custId) continue;

    const createdAt = bp.exactDateIso || new Date(now - bp.daysAgo * dayMs).toISOString();

    // Calculate total amount from items if sale
    let totalAmount = bp.total || 0;
    const itemsToInsert = [];

    if (bp.type === "sale" && bp.items.length > 0) {
      totalAmount = 0;
      for (const itm of bp.items) {
        const prod = prodMap.get(itm.prodName);
        if (!prod) continue;
        const lineTotal = Number(prod.price) * itm.qty;
        totalAmount += lineTotal;
        itemsToInsert.push({
          product_id: prod.id,
          qty: itm.qty,
          unit_price: prod.price,
        });
      }
    }

    const { data: tx, error: txError } = await supabase
      .from("transactions")
      .insert({
        shop_id: shopId,
        customer_id: custId,
        type: bp.type,
        total_amount: totalAmount,
        paid_amount: bp.paid,
        raw_input: bp.raw_input,
        created_at: createdAt,
      })
      .select()
      .single();

    if (txError) {
      console.error(`Error inserting tx for ${bp.custName}:`, txError.message);
      continue;
    }

    totalTxCount++;

    if (itemsToInsert.length > 0) {
      const { error: itmError } = await supabase
        .from("transaction_items")
        .insert(itemsToInsert.map((i) => ({ ...i, transaction_id: tx.id })));

      if (itmError) {
        console.error("Error inserting transaction items:", itmError.message);
      } else {
        totalItemsCount += itemsToInsert.length;
      }
    }
  }

  console.log(`✅ Inserted ${totalTxCount} transactions with ${totalItemsCount} line items spanning 90 days.`);

  // --------------------------------------------------------------------------
  // 7. Seed Sample Agent Logs (Demonstrating Parser Logging)
  // --------------------------------------------------------------------------
  console.log("🤖 Seeding sample agent log entries...");
  const sampleLogs = [
    {
      shop_id: shopId,
      agent: "parser",
      input: "Ramesh ne 5kg atta aur 1 packet namak liya, 100 diya baki udhar",
      output_json: {
        action: "add_sale",
        customer: "Ramesh Kumar",
        items: [
          { product: "Aashirvaad Shudh Chakki Atta 5kg", qty: 1, unit: "packet", price: 225 },
          { product: "Tata Salt Desh Ka Namak 1kg", qty: 1, unit: "packet", price: 28 },
        ],
        total: 253,
        paid: 100,
        udhar: 153,
      },
      confidence: 0.985,
    },
    {
      shop_id: shopId,
      agent: "parser",
      input: "Suresh Verma ji ne 500 rupaye jama karwaye",
      output_json: {
        action: "record_payment",
        customer: "Suresh Verma",
        amount: 500,
      },
      confidence: 0.992,
    },
  ];

  await supabase.from("agent_logs").insert(sampleLogs);

  // --------------------------------------------------------------------------
  // 8. Query customer_balances view to verify calculation
  // --------------------------------------------------------------------------
  console.log("📊 Verifying customer balances from view...");
  const { data: balances, error: balError } = await supabase
    .from("customer_balances")
    .select("name, balance")
    .eq("shop_id", shopId)
    .order("balance", { ascending: false })
    .limit(5);

  if (balError) {
    console.warn("⚠️ Could not query customer_balances view (make sure migration 001_init.sql was run in Supabase SQL editor):", balError.message);
  } else {
    console.log("Top debtors according to customer_balances view:");
    balances?.forEach((b) => {
      console.log(`  - ${b.name}: ₹${Number(b.balance).toFixed(2)} udhar`);
    });
  }

  console.log("\n🎉 DukaanAI database seeding completed successfully!");
  console.log(`Demo account ready: ${DEMO_EMAIL}`);
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
