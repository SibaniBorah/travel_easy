"""
Database initialization and management for Chalo NorthEast.
SQLite relational database with rich, authentic domain data.
"""

import sqlite3
import json
import os

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "tour_db.sqlite")

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    cursor = conn.cursor()

    # Create tables
    cursor.executescript("""
    CREATE TABLE IF NOT EXISTS states (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        capital TEXT NOT NULL,
        tagline TEXT NOT NULL,
        description TEXT NOT NULL,
        best_time TEXT NOT NULL,
        ilp_required INTEGER NOT NULL DEFAULT 0,
        ilp_fee_inr INTEGER DEFAULT 0,
        ilp_portal TEXT,
        ilp_info TEXT,
        popular_food TEXT,
        cultural_highlights TEXT,
        svg_path_id TEXT,
        image_gradient TEXT
    );

    CREATE TABLE IF NOT EXISTS destinations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        state_code TEXT NOT NULL,
        name TEXT NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        tagline TEXT NOT NULL,
        category TEXT NOT NULL,
        budget_tier TEXT NOT NULL,
        est_cost_per_day INTEGER NOT NULL,
        best_season TEXT NOT NULL,
        ideal_days INTEGER NOT NULL DEFAULT 2,
        altitude TEXT,
        description TEXT NOT NULL,
        top_highlights TEXT NOT NULL,
        how_to_reach_budget TEXT NOT NULL,
        how_to_reach_private TEXT NOT NULL,
        entry_fees TEXT NOT NULL,
        permit_info TEXT NOT NULL,
        cultural_etiquette TEXT NOT NULL,
        rating REAL DEFAULT 4.8,
        reviews_count INTEGER DEFAULT 24,
        FOREIGN KEY (state_code) REFERENCES states (code)
    );

    CREATE TABLE IF NOT EXISTS transit_routes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        from_city TEXT NOT NULL,
        to_city TEXT NOT NULL,
        state_code TEXT NOT NULL,
        transport_mode TEXT NOT NULL,
        pickup_stand TEXT NOT NULL,
        fare_inr INTEGER NOT NULL,
        duration_hrs REAL NOT NULL,
        frequency TEXT NOT NULL,
        road_condition TEXT NOT NULL,
        pro_tips TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS homestays (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        state_code TEXT NOT NULL,
        destination_slug TEXT NOT NULL,
        name TEXT NOT NULL,
        host_name TEXT NOT NULL,
        village_location TEXT NOT NULL,
        price_per_night INTEGER NOT NULL,
        contact_phone TEXT NOT NULL,
        rating REAL DEFAULT 4.9,
        amenities TEXT NOT NULL,
        eco_certified INTEGER DEFAULT 1,
        description TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS prebuilt_itineraries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        slug TEXT UNIQUE NOT NULL,
        title TEXT NOT NULL,
        states TEXT NOT NULL,
        duration_days INTEGER NOT NULL,
        budget_level TEXT NOT NULL,
        est_total_cost_inr INTEGER NOT NULL,
        pace TEXT NOT NULL,
        summary TEXT NOT NULL,
        day_plans_json TEXT NOT NULL,
        packing_tips TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS community_tips (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        state_code TEXT NOT NULL,
        destination_name TEXT NOT NULL,
        author_name TEXT NOT NULL,
        author_city TEXT NOT NULL,
        category TEXT NOT NULL,
        tip_text TEXT NOT NULL,
        upvotes INTEGER DEFAULT 5,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS reviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        destination_slug TEXT NOT NULL,
        user_name TEXT NOT NULL,
        user_origin TEXT NOT NULL,
        rating INTEGER NOT NULL,
        review_text TEXT NOT NULL,
        travel_month TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS custom_trips (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        share_code TEXT UNIQUE NOT NULL,
        trip_name TEXT NOT NULL,
        travelers_count INTEGER NOT NULL,
        travel_style TEXT NOT NULL,
        duration_days INTEGER NOT NULL,
        est_total_cost INTEGER NOT NULL,
        cost_breakdown_json TEXT NOT NULL,
        destinations_json TEXT NOT NULL,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    conn.commit()
    seed_data(cursor)
    conn.commit()
    conn.close()
    print("Database initialized successfully.")

def seed_data(cursor):
    # Check if states already exist
    cursor.execute("SELECT COUNT(*) FROM states")
    if cursor.fetchone()[0] > 0:
        return

    # Seed 8 States
    states = [
        (
            "AS", "Assam", "Dispur (Guwahati)", "Gateway to the North East & Land of the Red River",
            "Home to the majestic Brahmaputra River, prehistoric one-horned rhinoceroses in Kaziranga, emerald tea plantations, and the world's largest river island Majuli. Assam combines vibrant folk culture, Ahom dynasty heritage, and unmatched riverine biodiversity.",
            "October to April (Pleasant, wildlife parks open)",
            0, 0, None,
            "No Inner Line Permit (ILP) required for Indian citizens. Foreign nationals only require a regular Indian tourist visa. National park safaris require online/counter entry permits.",
            "Khaar, Masor Tenga (tangy fish curry), Duck with Ash Gourd (Hanhor Mangxo), Pitha, Xaak, Assam Black Tea",
            "Bihu festival (Rongali, Kongali, Bhogali), Sattriya classical dance, Silk weaving of Sualkuchi (Muga golden silk), Kamakhya Tantric heritage",
            "state-as", "from-emerald-700 to-teal-900"
        ),
        (
            "ML", "Meghalaya", "Shillong", "The Abode of Clouds & Waterfalls",
            "Famous for having the wettest places on Earth (Cherrapunji & Mawsynram), UNESCO-listed Living Root Bridges crafted by indigenous Khasi tribes, the crystal-clear waters of the Umngot River in Dawki, and rolling pine-covered hills reminiscent of the Scottish Highlands.",
            "September to May (Post-monsoon waterfalls & clear skies)",
            0, 0, None,
            "No ILP required for domestic travelers. Foreign travelers do not require PAP. Registration at state tourist kiosks is recommended.",
            "Jadoh (fragrant rice with meat), Dohneiiong (pork with black sesame), Tungrymbai, Pumaloi, Khasi red rice",
            "Matrilineal society of Khasi and Garo tribes, Wangala 100 Drums festival, Sacred Grove forest conservation, Khasi whistling village Kongthong",
            "state-ml", "from-cyan-700 to-blue-900"
        ),
        (
            "AR", "Arunachal Pradesh", "Itanagar", "Land of the Dawn-Lit Mountains",
            "India's easternmost frontier where the sun first kisses the sub-continent. Home to snow-clad peaks reaching 23,000 feet, ancient Buddhist monasteries in Tawang, the picturesque Apatani cultural landscape of Ziro, and pristine wilderness of Namdapha.",
            "October to April (Crisp mountain air, blooming rhododendrons)",
            1, 100, "https://arunachaltourism.com/ilp.php",
            "ILP strictly required for Indian citizens (Fee ₹100 online, ₹400 on arrival at Guwahati/Naharlagun). Foreign tourists require a Protected Area Permit (PAP) for groups of 2+ through authorized agents ($50 fee).",
            "Thukpa, Zan, Momos, Bamboo shoot pork (Wungwut Ngam), Apong (rice/millet beer), Pika Pila",
            "Tawang Monastery (India's largest Buddhist monastery), Apatani face-tattoo traditions and bamboo architecture in Ziro, Torgya festival, Losar new year",
            "state-ar", "from-indigo-800 to-sky-900"
        ),
        (
            "NL", "Nagaland", "Kohima", "Land of Brave Warriors and 16 Vibrant Tribes",
            "A breathtaking mountain state of misty ridges, dense rainforests, and proud Naga tribes each with distinct attire, customs, and dialects. Famous for the world-renowned Hornbill Festival, the untouched pristine Dzukou Valley, and Asia's first green village Khonoma.",
            "October to May (December is peak Hornbill Festival month)",
            1, 50, "https://ilp.nagaland.gov.in",
            "ILP required for all domestic visitors (₹50-100 online or at Nagaland Houses in Guwahati/Kolkata/Delhi and Dimapur DC office). Foreign nationals need to register at the local Foreigners Registration Officer (FRO) within 24 hours of arrival.",
            "Smoked pork with Anishi (fermented yam leaves), Bamboo shoot curries, Raja Mircha (Bhut Jolokia) chutneys, Galho (savory Naga khichdi), Axone",
            "Hornbill Festival at Kisama Heritage Village (Dec 1-10), Angami eco-conservation in Khonoma, Konyak tattooed headhunter elders in Mon, Dzukou Valley trek",
            "state-nl", "from-amber-700 to-red-950"
        ),
        (
            "MN", "Manipur", "Imphal", "The Jewel of India & Floating Paradise",
            "Cradled by nine hill ranges, Manipur boasts Loktak Lake—the world's only floating lake dotted with Phumdis—and the Keibul Lamjao National Park protecting the dancing Sangai deer. It is also the birthplace of modern polo and home to Asia's unique all-women Ima Keithel market.",
            "October to April (Pleasant weather, blooming Shirui Lily in May)",
            1, 100, "https://manipurilponline.mn.gov.in",
            "ILP mandatory for domestic travelers entering Manipur (Temporary permit ₹100 for 15 days, apply online or at Bir Tikendrajit International Airport / Mao checkgate).",
            "Kangshoi (vegetable stew), Chamthong, Eromba (mashed vegetables with fermented fish & herbs), Singju salad, Chak-hao kheer (black rice pudding)",
            "Sangai Festival in November, Classical Manipuri Raas Leela dance, Ima Keithel all-women marketplace with 5,000+ traders, indigenous martial art Thang-Ta",
            "state-mn", "from-violet-800 to-purple-950"
        ),
        (
            "MZ", "Mizoram", "Aizawl", "Land of the Highlanders and Bamboo Groves",
            "Perched amidst serrated parallel hill ranges covered in dense bamboo and mist, Mizoram offers one of India's cleanest and most peaceful states. Known for its warm community spirit, vibrant Chapchar Kut spring festival, and the dramatic cliffs of Reiek and Phawngpui Blue Mountain.",
            "October to March (Clear blue skies, dry cool weather)",
            1, 120, "https://ilp.mizoram.gov.in",
            "ILP required for domestic tourists (Apply online or obtain at Lengpui Airport, Silchar, Guwahati, or Kolkata Mizoram Houses for ₹120-200). Foreigners need to register at SP/FRO office.",
            "Bai (traditional boiled vegetable & pork soup with bamboo shoots), Vawksa Rep (smoked pork), Sawhchiar (meat rice broth), Koat Pitha",
            "Cheraw (bamboo dance), Chapchar Kut spring harvest festival, Tlawmngaihna (traditional Mizo code of selflessness and community help), Solomon's Temple",
            "state-mz", "from-emerald-800 to-teal-950"
        ),
        (
            "TR", "Tripura", "Agartala", "Land of Palaces, Ancient Rock Sculptures and Bamboo Art",
            "A royal realm nestled on the Bangladesh border with majestic white palaces like Ujjayanta, the enchanting Neermahal floating water palace in Rudrasagar Lake, and the archaeological wonder of Unakoti featuring mysterious 7th-9th century rock-carved Shiva bas-reliefs.",
            "October to March (Delightful winter, Orange festival in Jampui Hills)",
            0, 0, None,
            "No ILP required! Domestic and international tourists can travel freely without special state permits. Very accessible via broad-gauge railway and Agartala airport.",
            "Mui Borok (traditional Tripuri stew with Berma fermented fish), Mosdeng Serma (tomato-chili chutney), Chakhwi, Panch Phoron fish, Wahan Mosdeng",
            "Kharchi Puja (worship of 14 deities in July), Garia dance, Neermahal boat festival, intricate bamboo and cane handicrafts",
            "state-tr", "from-rose-800 to-orange-950"
        ),
        (
            "SK", "Sikkim", "Gangtok", "The Himalayan Kingdom in the Lap of Kanchenjunga",
            "India's first 100% organic state, framed by Mount Kanchenjunga (world's 3rd highest peak). Famed for pristine alpine lakes like Gurudongmar and Tsomgo, historic monasteries like Rumtek and Pemayangtse, high mountain passes like Nathu La, and rhododendron sanctuaries.",
            "March to May (Rhododendrons & flowers) & October to mid-December (Clear mountain panoramas)",
            1, 0, "https://sikkimtourism.gov.in",
            "Domestic tourists do NOT need permit for Gangtok, Pelling, South & West Sikkim. Protected Area Permits (PAP) ARE required for Tsomgo Lake, Baba Mandir, Nathu La, and North Sikkim (Lachung/Lachen) - easily arranged through registered tour operators or DC office with ID and 2 photos. Foreigners require RAP for Sikkim entry + PAP for restricted zones.",
            "Momos, Thukpa, Gundruk and Sinki soup, Phagshapa (pork with radishes & dry chilies), Sel Roti, Chhurpi cheese soup",
            "Pang Lhabsol festival honoring Kanchenjunga, Masked Cham dances at Rumtek Monastery, organic farming traditions, high-altitude trekking to Goecha La",
            "state-sk", "from-blue-700 to-slate-900"
        )
    ]

    cursor.executemany("""
    INSERT INTO states (
        code, name, capital, tagline, description, best_time,
        ilp_required, ilp_fee_inr, ilp_portal, ilp_info,
        popular_food, cultural_highlights, svg_path_id, image_gradient
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, states)

    # Seed 30+ Curated Destinations
    destinations = [
        # ASSAM
        (
            "AS", "Kaziranga National Park", "kaziranga-national-park",
            "World's fortress for the Great One-Horned Rhinoceros & Royal Bengal Tigers",
            "wildlife", "budget", 1800, "November to April", 2, "60-80m",
            "A UNESCO World Heritage Site cradled by the Brahmaputra River, Kaziranga hosts two-thirds of the planet's great one-horned rhinoceros population, alongside wild water buffalo, swamp deer, elephants, and rare migratory birds. Experience safaris across Kohora (Central), Bagori (Western), and Agoratoli (Eastern) zones.",
            "Elephant dawn safari, Jeep safari in Bagori zone, Kaziranga Orchid and Biodiversity Park, Assamese traditional lunch at local dhaba",
            "Take an ASTC state bus or shared cab from Guwahati Paltan Bazar / ISBT directly to Kohora stand on NH-715 (Fare: ₹250-350, 4.5 hours). No private taxi needed.",
            "Hired private AC cab from Guwahati to Kohora costs approx ₹3,500-4,500 one way.",
            "Jeep Safari: ₹2,200-2,800 per vehicle (split among up to 6 people = ~₹450/person); Forest entry fee: ₹100 Indian, ₹650 Foreigner; Camera fee: ₹100.",
            "No special permit required for Assam. Book safari slot 1 day in advance at the Kohora forest range counter or through your homestay.",
            "Wear earth-toned colors (olive, brown, beige). Avoid bright red/yellow. Maintain absolute silence during safaris. Do not litter or tease wildlife.",
            4.9, 142
        ),
        (
            "AS", "Majuli Island", "majuli-island",
            "World's largest inhabited river island & cradle of Neo-Vaishnavite culture",
            "culture", "budget", 950, "October to March", 2, "85m",
            "A serene river island floating in the mighty Brahmaputra, Majuli is the spiritual epicenter of Assam founded by 15th-century saint Srimanta Sankardev. Famous for centuries-old Satras (monasteries), traditional bamboo mask-making, Mishing tribal stilt villages, and magical river sunsets.",
            "Samaguri Satra (world-famous handmade bamboo masks), Kamalabari Satra monk dance, cycling through Mishing villages, sunset over Kherkatia Suti",
            "Train or bus from Guwahati to Jorhat (₹150-300). From Jorhat, auto to Nimati Ghat (₹40 shared). Government Ro-Pax ferry from Nimati Ghat to Majuli Kamalabari Ghat costs only ₹15 per person! Rent a bicycle on the island for ₹100/day.",
            "Private hired car can be loaded onto the Ro-Pax ferry (₹700-1,000 for vehicle transfer + driver charges).",
            "Satra entry: Free (voluntary donation of ₹20-50 welcome). Mask making demo: Free or small appreciation tip to artists.",
            "No special permit needed. Ferries stop running after 4:00 PM due to river currents, so plan arrivals before 3:00 PM.",
            "Remove shoes before stepping into Satra sanctums. Dress modestly with covered shoulders and knees. Mishing villages are very hospitable; ask politely before photographing weavers.",
            4.8, 98
        ),
        (
            "AS", "Manas National Park", "manas-national-park",
            "Untouched Biosphere Reserve where the Himalayas meet the Plains",
            "wildlife", "moderate", 2200, "November to April", 2, "115m",
            "Located at the foothills of the Bhutan Himalayas on the border of the Royal Manas, this UNESCO World Heritage Site is famous for pygmy hogs, golden langurs, hispid hares, and wild elephants roaming across virgin riverine grasslands.",
            "Bansbari safari range, boat rafting on the Manas River, tea garden walks on the Bhutan border, Bodo tribal dance performances",
            "Take an early morning broad-gauge passenger train from Guwahati to Barpeta Road railway station (₹65-120, 2.5 hrs). From Barpeta Road, shared sumos/autos go to Bansbari gate (₹70-100).",
            "Private cab from Guwahati directly to Bansbari: ₹3,500-4,000 (3.5 hours).",
            "Jeep safari: ₹3,000 per vehicle (split up to 6 people); Park entry: ₹100; River rafting: ₹800-1,200 per head.",
            "No ILP needed. Entry permit issued at Bansbari Range Office.",
            "Respect Bodo community traditions. Stay inside designated watchtowers and safari vehicles.",
            4.7, 56
        ),
        (
            "AS", "Sivasagar & Charaideo", "sivasagar-ahom-heritage",
            "Capital of the six-century-long invincible Ahom Dynasty",
            "culture", "budget", 1100, "October to March", 2, "95m",
            "The imperial seat of the Ahom monarchs who ruled Assam for 600 years and defeated the mighty Mughal army repeatedly. Explore the two-storied royal amphitheater Rang Ghar, underground labyrinths of Talatal Ghar, towering Shiva Dol on the banks of Borpukhuri lake, and newly minted UNESCO World Heritage Charaideo Maidams (the Pyramids of Assam).",
            "Rang Ghar (Asia's oldest amphitheater), Talatal Ghar palaces, Charaideo royal burial mounds, Joy Dol by Joysagar tank",
            "Direct overnight train from Guwahati to Sivasagar Town (₹180 sleeper, ₹550 3AC). E-rickshaws and shared autos connect all monuments for ₹20-30 per ride.",
            "Private hired taxi for a day's monument tour: ₹1,500-2,000.",
            "ASI Monument combo ticket: ₹25 for Indian citizens, ₹300 for foreigners. Charaideo entry: ₹25.",
            "Standard domestic travel, no permits needed.",
            "Historical sites have sacred shrines attached (Shiva Dol is an active temple; dress respectfully and remove footwear).",
            4.6, 73
        ),

        # MEGHALAYA
        (
            "ML", "Cherrapunji (Sohra)", "cherrapunji-sohra",
            "The misty plateau of majestic plunge waterfalls and ancient caves",
            "waterfall", "budget", 1400, "Year round (Monsoon for roaring falls, Winter for clear caves)", 3, "1430m",
            "Known locally as Sohra, this dramatic plateau perched high above the Bangladesh plains features thunderous plunge waterfalls, deep limestone caves, and ancient Khasi monoliths. Experience the jaw-dropping 1,115-foot drop of Nohkalikai Falls, the turquoise tier of Wei Sawdong, and the stalactites of Mawsmai Cave.",
            "Nohkalikai Falls, Wei Sawdong 3-tier cascade, Dainthlen Falls, Mawsmai & Arwah cave exploration, Garden of Caves",
            "Shared Tata Sumo or Meghalaya Tourism (MTDC) budget bus from Shillong Police Bazar / Lewduh to Sohra bazaar (Fare: ₹100-150, 2 hours). Local shared maruti vans commute between Sohra market and villages.",
            "Private taxi hire from Shillong for full-day Cherrapunji sightseeing: ₹2,500-3,200.",
            "Nohkalikai viewpoint: ₹20; Wei Sawdong trek: ₹50; Mawsmai cave entry: ₹30; Arwah cave: ₹50.",
            "No permit required for Indian or foreign travelers.",
            "Monsoon brings intense rains; carry waterproof poncho and sturdy trekking shoes. Respect sacred Khasi water bodies and avoid littering plastic wrappers.",
            4.9, 185
        ),
        (
            "ML", "Nongriat Living Root Bridges", "nongriat-root-bridges",
            "Bio-engineering wonder: 250-year-old Double Decker Living Root Bridge",
            "trek", "budget", 850, "October to May", 2, "650m",
            "Hidden deep in the lush tropical canyon below Tyrna village, ancient Khasi tribes trained the living aerial roots of Ficus elastica rubber trees across raging monsoon streams to grow into indestructible bridges. The hike down 3,500 stone steps leads to the iconic Double Decker Root Bridge and the turquoise pools of Rainbow Falls.",
            "Double Decker Living Root Bridge, Rainbow Falls hike, natural fish spa in crystal mountain pools, serene night stay in village homestays",
            "Shared taxi from Sohra to Tyrna village (₹50-70). From Tyrna, start the 3,500-step trek down (approx 1.5 - 2 hours). Village bamboo homestays at Nongriat cost only ₹400-600 per bed!",
            "Private cab from Shillong/Sohra to Tyrna parking lot: ₹1,500-2,000.",
            "Bridge conservation entry fee: ₹40 per head. Guide fee (optional): ₹500-800.",
            "No permit needed. Good physical fitness required for 3,500 stone steps.",
            "Do not hang, swing, or peel bark from the living roots. Use provided bamboo bins for trash. Support local village stalls by purchasing lemonade and local oranges.",
            4.9, 210
        ),
        (
            "ML", "Dawki & Shnongpdeng", "dawki-shnongpdeng-river",
            "The crystal-clear Umngot River where boats appear to float on air",
            "waterfall", "budget", 1200, "November to April (Water is crystalline green)", 2, "120m",
            "On the southern Meghalaya rim kissing Bangladesh, the Umngot River flows over riverbed pebbles with such surreal clarity that traditional wooden canoes cast clear shadows on the riverbed 15 feet below. Shnongpdeng village offers riverside camping, snorkeling, cliff jumping, and kayaking.",
            "Clear-water boat safari on Umngot River, riverside bonfire camping, cliff jumping into emerald water, hanging suspension footbridge",
            "Shared sumo from Shillong Bara Bazar / Anjali Point to Dawki market (₹150-200, 3 hrs). From Dawki, shared local taxi or 8km scenic walk to Shnongpdeng (₹50-80).",
            "Private hired taxi from Shillong to Dawki/Shnongpdeng round trip: ₹3,000-3,800.",
            "1-hour boat ride: ₹800 per boat (splits up to 4 people = ₹200/person); Kayaking: ₹300; Riverside tent stay: ₹800-1,200 with bedding.",
            "No special permit. The India-Bangladesh border is right at Dawki; carry government photo ID for security checkpoints.",
            "Always wear life jackets while boating or swimming. The river is sacred to locals; avoid using chemical soap or sunscreen in the main flow.",
            4.8, 164
        ),
        (
            "ML", "Mawlynnong & Kongthong", "mawlynnong-clean-village",
            "God's Own Garden & Kongthong's unique whistling lullaby traditions",
            "culture", "budget", 1100, "October to April", 1, "490m",
            "Awarded the Cleanest Village in Asia, Mawlynnong showcases spotless stone pathways, floral gardens, bamboo dustbins at every corner, and 100% literacy. Nearby Kongthong village practices 'Jingrwai Iawbei'—where mothers compose a unique melodic tune (tune-name) for every newborn child instead of calling them by words.",
            "Spotless floral village lanes, Jingmaham Living Root Bridge at Riwai, Sky View bamboo tower overlooking Bangladesh plains, Kongthong whistle village",
            "Shared sumo from Shillong Bara Bazar to Mawlynnong (₹150, 2.5 hrs). Alternatively, hire a shared tourist cab covering Dawki and Mawlynnong together.",
            "Private taxi full-day Shillong-Mawlynnong-Dawki loop: ₹3,500-4,200.",
            "Village entry toll: ₹50 per vehicle; Riwai root bridge entry: ₹40.",
            "No permits needed.",
            "Smoking in public and plastic littering are strictly banned in Mawlynnong (heavy fines apply). Ask politely before listening to Kongthong mother melodies.",
            4.7, 115
        ),

        # ARUNACHAL PRADESH
        (
            "AR", "Tawang & Sela Pass", "tawang-sela-pass",
            "India's largest Buddhist monastery at 10,000 ft and frozen Sela Pass",
            "monastery", "moderate", 2200, "March to May (Rhododendrons) & October to November (Clear skies, snow)", 4, "3048m",
            "Cross the breathtaking Sela Pass (13,700 ft) surrounded by 101 sacred lakes to arrive at Tawang, home to the 400-year-old Galden Namgey Lhatse (Tawang Monastery) founded in 1681. Explore the sacred birthplace of the 6th Dalai Lama, Madhuri Lake (Sangetsar Tso), and the roaring Nuranang (Jang) Waterfall.",
            "Tawang Monastery morning chant, Sela Pass & Lake photo stop, Madhuri (Sangetsar) Lake, Nuranang Falls, Tawang War Memorial sound & light show",
            "Shared Tata Sumo from Tezpur (Assam) or Guwahati to Dirang/Bomdila (₹600-800), then next morning shared Sumo from Bomdila to Tawang (₹600-750). Total transit cost under ₹1,500 one-way compared to ₹12,000 for private cab!",
            "Private SUV (Scorpio/Innova) hire from Guwahati/Tezpur for 5-day Tawang trip: ₹5,000-6,500 per day.",
            "Monastery entry: Free; Tawang War Memorial: Free (sound & light show ₹100); Madhuri lake vehicle permit: ₹200.",
            "**Inner Line Permit (ILP) required!** Apply online for ₹100. Also, local DC counter in Tawang issues special passes for Madhuri Lake and Bum La border (ID + 2 photos required).",
            "Walk clockwise around monasteries and chortens (stupas). Dress warmly in layers (temperatures drop below freezing at night). Acclimatize in Dirang or Bomdila before rushing to Tawang.",
            4.9, 230
        ),
        (
            "AR", "Ziro Valley", "ziro-valley-apatani",
            "Pristine pine-clad plateau, Apatani cultural landscape & Ziro Music Festival",
            "culture", "budget", 1500, "Year round (September for Ziro Festival of Music; April-May for green paddy)", 3, "1570m",
            "A picturesque UNESCO tentative heritage site nestled amid high pine-clad ridges, Ziro is home to the Apatani tribe known for their unique sustainable paddy-cum-pisciculture system, intricate bamboo craft, and traditional facial tattoos and bamboo nose plugs (Yaping Hullo) worn by elder women.",
            "Hong and Hari traditional Apatani villages, Kardo Shiva Lingam, Tarin Fish Farm, Pine Grove trail, Ziro Festival of Music (September)",
            "Take the Donyi Polo Express train from Guwahati to Naharlagun (₹145 sleeper, ₹450 3AC). From Naharlagun/Itanagar station, shared sumos go directly to Ziro daily (₹350-450, 4 hours).",
            "Private cab hire from Guwahati to Ziro: ₹6,000-8,000 one-way.",
            "Village tourism entry: Voluntary ₹50 donation; Apatani home museum: ₹50.",
            "**ILP required for Arunachal Pradesh.** Show ILP printout at Kimin or Banderdewa checkpost.",
            "Apatani elders with traditional tattoos should be photographed with utmost respect and consent. Never intrude into homes uninvited. Support tribal artisans by purchasing hand-woven wraps.",
            4.8, 178
        ),
        (
            "AR", "Mechuka (Menchukha)", "mechuka-forbidden-valley",
            "The Shangri-La of the Northeast: Snow peaks, wooden bridges & Memba culture",
            "scenic", "moderate", 1900, "October to April", 3, "1830m",
            "Often described as Arunachal's Switzerland, Mechuka lies in a remote valley surrounded by snow-capped peaks and the sparkling Siyom River. Inhabited by the Memba, Ramo, and Bokar tribes, it features the 400-year-old Samten Yongcha Monastery, wooden log cabins, and grazing horses on rolling green slopes.",
            "Samten Yongcha Buddhist monastery, wooden suspension footbridges over Siyom River, Hanuman face mountain cliff, Mechuka town viewpoint trek",
            "Shared Sumo from Aalo (Along) to Mechuka leaves every morning at 6:00 AM (Fare: ₹600-700, 6 hours). To reach Aalo, take shared sumo from Silapathar railway station (₹400).",
            "Private 4x4 vehicle hire: ₹6,000-7,000 per day from Dibrugarh/Aalo.",
            "Monastery entry: Free.",
            "**ILP required.** Checkpoint verification at Tatom.",
            "Carry adequate cash as ATMs are sparse in Mechuka. Cellular network (BSNL/Airtel) may be intermittent; enjoy the digital detox. Homestays provide warm wood-stove bukharis.",
            4.9, 88
        ),

        # NAGALAND
        (
            "NL", "Dzukou Valley", "dzukou-valley-trek",
            "The Valley of Flowers of the East with undulating bamboo ridges",
            "trek", "budget", 900, "June to September (Lush green & lilies) or Nov-Jan (Frosty surreal landscapes)", 2, "2452m",
            "Perched on the border between Nagaland and Manipur, Dzukou Valley is a paradise of endless rolling emerald hills carpeted in dwarf bamboo, criss-crossed by crystalline serpentine streams, and home to the rare endemic Dzukou Lily. It offers one of the most rewarding low-cost backpacking treks in India.",
            "Trek via Viswema or Jakhama trails, sunrise over undulating bamboo waves, Ghost Cave (Bhoot Gufa), starry night camping in dormitory cave/rest house",
            "Take shared taxi from Dimapur station to Kohima (₹250-350, 2.5 hrs). From Kohima network stand, take shared taxi to Viswema village gate (₹80-100). Rest house dorm beds in Dzukou cost only ₹100-200/night!",
            "Private cab from Kohima to Viswema trail head: ₹1,200-1,500.",
            "Dzukou Valley entry fee: ₹100 Indian, ₹500 Foreigner; Dormitory mattress: ₹100; Foam mat/blanket rental: ₹50 each.",
            "**ILP required for Nagaland.** Entry registration done at the Sayi Eco-Tourism check gate in Viswema.",
            "Strict NO-PLASTIC zone! Security checks your bags for single-use plastic bottles at the trailhead. Carry your own refillable flask and pack out all waste.",
            4.9, 195
        ),
        (
            "NL", "Khonoma Green Village", "khonoma-green-village",
            "India's first green village & legendary Angami warrior heritage",
            "culture", "budget", 1100, "October to April", 2, "1600m",
            "Renowned as Asia's first self-declared green village, Khonoma banned logging and hunting in 1998, establishing the 20 sq km Khonoma Nature Conservation and Tragopan Sanctuary. Explore stone forts (Khels) that resisted British colonial invasions three times, step terrace paddy farms, and Angami wood-carving.",
            "Historic British-Angami battle forts, alder-based step-cultivation farms, Angami Morung (dormitories), birdwatching for Blyth's Tragopan",
            "Shared local taxis leave from Kohima BOC market stand to Khonoma daily between 11 AM and 3 PM (Fare: ₹80-100, 45 minutes).",
            "Private taxi from Kohima to Khonoma round trip: ₹1,200-1,500.",
            "Village entry & conservation ticket: ₹50 per head; Local Angami guide: ₹600-800.",
            "**ILP required for Nagaland.**",
            "Khonoma takes environmental cleanliness very seriously. Follow village guidelines, keep noise down after dark, and do not pick wild orchids.",
            4.8, 112
        ),
        (
            "NL", "Kohima & Kisama Heritage Village", "kohima-kisama-hornbill",
            "State capital, Commonwealth War Cemetery & Venue of the Hornbill Festival",
            "culture", "budget", 1300, "October to May (December 1-10 for Hornbill Festival)", 3, "1444m",
            "Kohima is perched dramatically on mountain ridges, famous for the WWII Commonwealth War Cemetery with its poignant epitaph: 'When you go home, tell them of us and say, For your tomorrow, we gave our today'. Kisama Heritage Village, 12km away, hosts the vibrant 10-day Hornbill Festival celebrating all 16 Naga tribes.",
            "Kisama Heritage Village tribal Morungs, Kohima War Cemetery, Mary Help of Christians Cathedral, Kohima State Museum",
            "Shared sumo/taxi from Dimapur railway station / airport to Kohima (₹250-300, 2.5 hrs). Local city shared taxis in Kohima cost ₹20-40 per hop.",
            "Private taxi Dimapur to Kohima: ₹2,000-2,500.",
            "War Cemetery: Free; State Museum: ₹20; Kisama non-festival days: ₹30 (during Hornbill Festival: ₹50-100/day).",
            "**ILP required.**",
            "During Hornbill Festival (Dec 1-10), Kohima accommodation fills up months in advance; book budget campsites or homestays early in Kisama, Kigwema, or Jakhama.",
            4.8, 260
        ),

        # MANIPUR
        (
            "MN", "Loktak Lake & Keibul Lamjao", "loktak-lake-keibul-lamjao",
            "The world's only floating national park & dancing Sangai deer",
            "waterfall", "budget", 1250, "November to April", 2, "768m",
            "Loktak is the largest freshwater lake in North East India, famous for 'Phumdis'—heterogeneous circular masses of vegetation, soil, and organic matter that float on the water surface. On the largest Phumdi lies Keibul Lamjao National Park, the last natural refuge of the critically endangered Sangai deer (Rucervus eldii eldii).",
            "Canoe boat ride through floating Phumdis, spotting dancing Sangai deer from watchtowers, Sendra Island viewpoint, homestay on a floating island hut",
            "Shared winger/magic taxi from Imphal Wahengbam Leikai stand to Moirang town (₹60-80, 1.5 hrs). From Moirang, shared auto to Sendra / Thanga village (₹20-30).",
            "Private hired taxi from Imphal to Loktak Lake for a day tour: ₹1,800-2,400.",
            "Keibul Lamjao Park entry: ₹50; Sendra viewpoint entry: ₹30; 1-hour fisherman canoe ride: ₹300-500.",
            "**ILP required for Manipur.** Apply online for ₹100.",
            "The floating islands are living bio-systems; never leave non-biodegradable trash on Phumdis. Fishermen are gentle and soft-spoken; respect their fishing nets.",
            4.9, 148
        ),
        (
            "MN", "Imphal Heritage & Ima Keithel", "imphal-city-ima-keithel",
            "Kangla Fort & Asia's 500-year-old all-women marketplace",
            "culture", "budget", 1000, "October to April", 2, "786m",
            "The historic capital of the Kingdom of Manipur, Imphal is celebrated for Kangla Fort—the ancient seat of Meitei rulers surrounded by moats—and Ima Keithel ('Mother's Market'), a sprawling 500-year-old commercial hub run exclusively by more than 5,000 licensed female traders.",
            "Ima Keithel (Mother's Market) textile and spices section, Kangla Fort & Govindaji Temple, Manipur State Museum, RKCS Art Gallery",
            "Direct flights connect Kolkata/Guwahati to Imphal. Shared city autos and e-rickshaws connect all downtown sights for ₹10-20 per trip.",
            "Private cab for city sightseeing: ₹1,500/day.",
            "Kangla Fort entry: ₹20; Electric golf cart inside fort: ₹50; State Museum: ₹20.",
            "**ILP required for Manipur.** Checked upon arrival at Imphal airport / Mao gate.",
            "Ima Keithel is run by respected matriarchs called 'Imas' (mothers). Bargain gently and address traders with respect. Remove footwear inside Govindaji Temple.",
            4.7, 92
        ),

        # MIZORAM
        (
            "MZ", "Aizawl & Reiek Tlang", "aizawl-reiek-peak",
            "Perched ridge capital & 360-degree panorama over misty valleys",
            "scenic", "budget", 1200, "October to March", 3, "1548m",
            "Aizawl is built like a mountain amphitheater, with houses clinging precariously to steep cliff faces. Nearby Reiek Peak (1,548m) offers a mesmerizing trek through lush sub-tropical forests to a razor-sharp rocky ridge providing dramatic panoramic views across the Bangladesh plains and Mizo hills.",
            "Reiek Tlang ridge hike, Reiek Mizo Heritage Village, Solomon's Temple, Durtlang Hills sunset viewpoint, KV Paradise",
            "Flights land at Lengpui Airport (shared taxi from Lengpui to Aizawl city ₹250-350). From Aizawl Bara Bazar, shared sumos go to Reiek village daily (₹80-100, 1.5 hrs).",
            "Private taxi from Aizawl to Reiek round trip: ₹1,800-2,200.",
            "Reiek Heritage Village entry: ₹20; Reiek trek: Free; Solomon's Temple: Free.",
            "**ILP required for Mizoram.** Obtain online or at Lengpui Airport counter.",
            "Aizawl is one of the most disciplined cities in India: no-honking is strictly practiced, and motorists never overtake in traffic jams. Keep voices gentle in public.",
            4.8, 104
        ),
        (
            "MZ", "Thenzawl & Vantawng Falls", "thenzawl-vantawng-falls",
            "Mizoram's handloom capital and highest two-tiered waterfall",
            "waterfall", "budget", 1100, "October to April", 2, "780m",
            "Nestled in the lush Serchhip district, Thenzawl is the heartland of traditional Mizo weaving (Puan fabric) and home to Vantawng Falls, the highest uninterrupted waterfall in Mizoram plummeting 750 feet amidst dense bamboo jungle. Nearby Tuirihnau Falls offers an enchanting swimmable cascade.",
            "Vantawng Falls viewpoint, Tuirihnau Falls natural shower, Thenzawl Golf Resort & deer park, watching local women weave traditional Puan fabrics",
            "Shared sumo from Aizawl Treasury Square / Kulikawn stand to Thenzawl (Fare: ₹200-250, 3.5 hrs). Stay at affordable Mizoram Tourism Tourist Lodge in Thenzawl (₹800/night).",
            "Private cab hire from Aizawl to Thenzawl: ₹3,000-3,500.",
            "Vantawng viewpoint entry: ₹20; Tuirihnau falls: ₹20.",
            "**ILP required for Mizoram.**",
            "Direct path to the foot of Vantawng is closed for safety; view it from the forest watchtower. Tuirihnau is accessible and safe for splashing.",
            4.7, 65
        ),

        # TRIPURA
        (
            "TR", "Unakoti Rock Carvings", "unakoti-rock-reliefs",
            "Ancient 7th-century mysterious colossal rock-cut Shaivite wonderland",
            "culture", "budget", 900, "October to March", 2, "140m",
            "Nestled in dense sub-tropical forests near Kailashahar, Unakoti ('one less than a crore') is a sublime ancient rock-relief site. Legend says Lord Shiva and 99,99,999 deities rested here en route to Varanasi. The 30-foot head of Shiva (Unakotiswara Kal Bhairava) carved into the rock face flanked by two goddesses is mesmerizing.",
            "Unakotiswara Kal Bhairava rock sculpture, Ganesha waterfall reliefs, lush jungle stone staircases, tribal villages of Kailashahar",
            "Take the Jan Shatabdi or local passenger train from Agartala to Kumarghat railway station (₹65-110, 2 hrs). From Kumarghat, shared auto/van to Unakoti site costs only ₹40-50!",
            "Private taxi from Agartala to Unakoti for a day trip: ₹3,000-3,500.",
            "ASI Entry Fee: ₹25 for Indian nationals, ₹300 for foreigners.",
            "**No ILP required!** Open to all travelers without any special permit.",
            "Site has steep stone steps; wear shoes with good grip. Unakoti is an active worship spot; show respect around the holy water Kund.",
            4.8, 126
        ),
        (
            "TR", "Neermahal Water Palace & Ujjayanta", "tripura-palaces-neermahal",
            "Eastern India's only floating lake palace & royal Manikya grandeur",
            "culture", "budget", 850, "October to March", 2, "20m",
            "Neermahal ('Water Palace') was built in 1930 by King Bir Bikram Kishore Manikya in the middle of Rudrasagar Lake, fusing Hindu and Islamic Mughal architectural motifs. In the capital Agartala stands the magnificent white marble Ujjayanta Palace, now housing the biggest museum in the Northeast.",
            "Boat ride across Rudrasagar Lake to Neermahal, Neermahal light and sound show, Ujjayanta Palace museum galleries, Indo-Bangla Akhaura border beating retreat",
            "Take a shared local commander jeep or TRTC state bus from Agartala Nagerjala bus stand to Melaghar (Fare: ₹50-60, 1.5 hrs). From Melaghar jetty, government motorboat to Neermahal costs ₹30-50 per seat!",
            "Private cab hire from Agartala for Neermahal day trip: ₹1,500-2,000.",
            "Neermahal palace entry: ₹20; Shared boat ride: ₹40; Ujjayanta Palace Museum: ₹20.",
            "**No ILP required!**",
            "Neermahal is best photographed at golden hour before sunset. Keep life jackets fastened during the boat ride across Rudrasagar.",
            4.7, 134
        ),

        # SIKKIM
        (
            "SK", "Gurudongmar Lake & North Sikkim", "gurudongmar-lake-north-sikkim",
            "Sacred glacial lake at 17,800 ft blessed by Guru Padmasambhava",
            "scenic", "moderate", 2500, "April to June & October to November", 3, "5430m",
            "Perched at an astonishing 17,800 feet (5,430m) near the Tibetan plateau, Gurudongmar is one of the highest alpine lakes in the world, surrounded by snow-capped Himalayan giants. Its emerald waters are held sacred by Buddhists, Sikhs, and Hindus, believed never to freeze completely even at -25°C.",
            "Gurudongmar Lake high-altitude panorama, Lachen village wooden houses, Chopta Valley, Yumthang Valley of Flowers, Zero Point (15,300 ft)",
            "Book a shared 3-Day/2-Night North Sikkim package from Gangtok (shared Tata Sumo seat costs approx ₹3,500-4,500 per person INCLUDING 2 nights accommodation, meals, and permit fees!). Massive savings over private vehicle (which costs ₹18,000+).",
            "Private vehicle hire (Mahindra Bolero/Scorpio) for 3D/2N North Sikkim: ₹18,000-22,000.",
            "All permits and fees are included in standard tour operator packages. Small environmental fee: ₹50.",
            "**Protected Area Permit (PAP) mandatory!** Only Indian domestic travelers are permitted to Gurudongmar Lake (due to proximity to China border). Foreign tourists can travel up to Yumthang Valley. Submit 2 photos + Voter ID/Aadhaar 1 day prior in Gangtok.",
            "High Altitude Sickness (AMS) is very real at 17,800 ft. Stay hydrated, do not run or jump, carry camphor/ginger, and descend if feeling dizzy. Respect the sacred lake and do not throw stones or trash.",
            4.9, 310
        ),
        (
            "SK", "Pelling & West Sikkim Heritage", "pelling-skywalk-pemayangtse",
            "Face to face with Mount Kanchenjunga & ancient royal capital Rabdentse",
            "monastery", "budget", 1300, "October to May", 2, "2150m",
            "Pelling offers the closest, most majestic sunrise views of Mount Kanchenjunga (8,586m). Walk on India's first glass skywalk leading to the towering Chenrezig statue, explore the 300-year-old Pemayangtse Monastery with its carved wooden celestial palace, and wander through the ruined stone walls of Rabdentse, the 17th-century capital of Sikkim.",
            "Kanchenjunga sunrise view, Pelling Glass Skywalk & 137ft Chenrezig statue, Pemayangtse Monastery, Rabdentse ruins bird walk, Khecheopalri sacred wish-fulfilling lake",
            "Shared Tata Sumo from Siliguri / NJP railway station or Gangtok (Deorali stand) to Pelling (Fare: ₹300-350, 4.5 hrs). Local shared cabs connect upper and lower Pelling.",
            "Private taxi from Gangtok/Siliguri to Pelling: ₹3,200-4,000.",
            "Pelling Skywalk: ₹50; Pemayangtse Monastery: ₹20; Rabdentse ruins: Free.",
            "No special permit required for domestic tourists visiting Pelling. Foreign nationals require Sikkim RAP (obtained for free at Melli / Rangpo checkposts).",
            "Wake up by 5:15 AM for the golden sunrise hitting Kanchenjunga peak from your balcony or Helipad viewpoint. Khecheopalri Lake is sacred; walking around barefoot is traditional.",
            4.8, 189
        ),
        (
            "SK", "Tsomgo Lake, Baba Mandir & Nathula", "tsomgo-lake-nathula-pass",
            "Glacial lake at 12,400 ft and the historic Old Silk Route border",
            "scenic", "budget", 1500, "October to May", 1, "3753m",
            "A breathtaking day excursion from Gangtok winding up through 35 switchbacks to Tsomgo (Changu) Lake, an oval glacial lake at 12,400 ft reflecting snow peaks. Continue higher to the shrine of Baba Harbhajan Singh and the historic Nathu La pass (14,140 ft) on the Indo-China Old Silk Route.",
            "Tsomgo Lake yak rides, cable car ride to 14,500 ft, Baba Mandir memorial, Nathu La pass border gates and military outpost",
            "Book a shared seat in a tourist Tata Sumo from Gangtok Vajra cinema stand (Fare: ₹800-1,100 per seat including permit processing, guide, and vehicle).",
            "Private vehicle permit & taxi hire from Gangtok: ₹5,500-7,000.",
            "Permit processing: ₹200; Cable car at Tsomgo: ₹450; Yak ride photo: ₹100.",
            "**PAP permit required!** Must be applied 1 day prior through registered Gangtok agency with 2 photos and ID proof. Nathula is open for Indian citizens only (Wednesday through Sunday, closed Mon/Tue). Foreigners can visit up to Tsomgo Lake.",
            "Dress in heavy woolens; winds at Nathu La are fierce. Photography is restricted right at the international border line; obey Army sentry instructions.",
            4.8, 245
        )
    ]

    cursor.executemany("""
    INSERT INTO destinations (
        state_code, name, slug, tagline, category, budget_tier, est_cost_per_day,
        best_season, ideal_days, altitude, description, top_highlights,
        how_to_reach_budget, how_to_reach_private, entry_fees, permit_info,
        cultural_etiquette, rating, reviews_count
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, destinations)

    # Seed Transit Routes
    transit_routes = [
        ("Guwahati", "Shillong", "ML", "Shared Sumo / Shared Swift", "Paltan Bazar (near Railway Station) & Khanapara", 300, 2.5, "Every 15 mins (6 AM to 6 PM)", "Excellent 4-lane NH-6 expressway", "Board at Khanapara to skip city traffic. Shared Swift Dzire is ₹400 for extra comfort."),
        ("Shillong", "Cherrapunji (Sohra)", "ML", "Shared Tata Sumo", "Lewduh (Bara Bazar) Sumo Stand", 120, 2.0, "Hourly (7 AM to 3 PM)", "Good paved mountain road with mist patches", "Catch the 7:30 AM sumo to maximize day. Sumos drop at Sohra market."),
        ("Shillong", "Dawki / Shnongpdeng", "ML", "Shared Tata Sumo", "Anjali Point / Bara Bazar", 180, 3.0, "Every hour until 2 PM", "Paved, scenic road via Pynursla", "Ask driver to drop you at Shnongpdeng road fork; shared autos waiting there cost ₹40."),
        ("Guwahati", "Kaziranga (Kohora)", "AS", "ASTC State Bus / Network Bus", "Guwahati ISBT & Paltan Bazar ASTC Stand", 280, 4.5, "Every 30 mins", "Excellent 4-lane highway via Nagaon", "Ask the conductor for 'Kohora Chariali' drop right next to park ticket counters."),
        ("Jorhat", "Majuli Island", "AS", "Ro-Pax Govt River Ferry", "Nimati Ghat (accessible by ₹40 shared auto from Jorhat)", 15, 1.0, "Every 1.5 hrs (7 AM to 4 PM)", "Serene Brahmaputra river crossing", "Tickets bought at Nimati Ghat counter. Bikes can be loaded for ₹30. Magical river breeze!"),
        ("Tezpur", "Bomdila / Dirang", "AR", "Shared Tata Sumo", "Tezpur ASTC Sumo Stand (near Mission Chariali)", 600, 6.0, "Departs 5:30 AM to 7:00 AM daily", "Mountain roads maintained by BRO", "Advance booking the evening before is strongly recommended to get window or front seats."),
        ("Bomdila", "Tawang", "AR", "Shared Tata Sumo", "Bomdila Main Market Sumo Stand", 650, 6.5, "Leaves 6:00 AM daily", "High-altitude pass via Sela (13,700 ft)", "Keep warm jacket inside cabin with you; Sela Pass stop is freezing even in summer."),
        ("Guwahati", "Naharlagun (Itanagar)", "AR", "Donyi Polo Intercity Express Train", "Guwahati Railway Station", 145, 7.0, "Daily overnight / morning", "Smooth broad-gauge railway", "The most budget-friendly entry into Arunachal Pradesh. Connects to Ziro sumos from station."),
        ("Naharlagun", "Ziro Valley", "AR", "Shared Tata Sumo", "Naharlagun Railway Station Parking", 400, 4.0, "Leaves 7:00 AM & 12:00 PM", "Scenic winding hill road", "Arrive early as sumos fill up quickly after train arrives."),
        ("Dimapur", "Kohima", "NL", "Shared Sumo / Shared Van", "Dimapur Railway Station Exit Stand", 250, 2.5, "Continuous departures as seats fill", "4-lane highway with winding hill section", "Dimapur is Nagaland's only railway link. Shared cabs operate until 5:00 PM."),
        ("Kohima", "Viswema (Dzukou Gate)", "NL", "Shared Taxi / Network Winger", "BOC Market Stand, South Kohima", 80, 0.8, "Every 30 mins", "Good paved road", "Drop at Viswema village junction. Small shared pickup to trek point costs ₹50."),
        ("Imphal", "Moirang (Loktak Lake)", "MN", "Shared Winger / Magic Van", "Wahengbam Leikai Stand, Imphal", 70, 1.5, "Every 20 mins (6 AM to 4 PM)", "Smooth state highway", "Drops at Moirang market. E-rickshaws to Sendra Island cost ₹20."),
        ("Silchar (Assam)", "Aizawl", "MZ", "Shared Tata Sumo", "Mizoram Circuit House / Rangirkhari Stand, Silchar", 550, 6.0, "Departs 6 AM, 9 AM, 12 PM", "Hilly winding highway NH-306", "Have motion sickness tablets handy if prone to car sickness. Check ILP at Vairengte."),
        ("Agartala", "Kumarghat (Unakoti)", "TR", "Jan Shatabdi Express / Local EMU Train", "Agartala Railway Station", 75, 2.0, "Twice daily", "Smooth railway track", "Train is 5x faster and 4x cheaper than any road transport in Tripura!"),
        ("Siliguri / NJP", "Gangtok", "SK", "SNT State Bus / Shared Tata Sumo", "NJP Railway Station & Siliguri SNT Bus Stand", 350, 4.5, "Every 20 mins from 6 AM to 3 PM", "National Highway NH-10 along Teesta river", "SNT government bus costs ₹180; Shared Sumo is ₹350. Carry umbrella during monsoon."),
        ("Gangtok", "Pelling", "SK", "Shared Tata Sumo", "Deorali Sumo Stand, Gangtok", 320, 4.5, "Departs 7:00 AM & 1:00 PM", "Winding hill road via Ravangla", "Stops for lunch/tea at Ravangla with views of Buddha Park.")
    ]

    cursor.executemany("""
    INSERT INTO transit_routes (
        from_city, to_city, state_code, transport_mode, pickup_stand,
        fare_inr, duration_hrs, frequency, road_condition, pro_tips
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, transit_routes)

    # Seed Authentic Eco-Homestays
    homestays = [
        ("AS", "majuli-island", "La Lolat Eco Camp", "Manash Mishing", "Phuraloni Village, Majuli", 900, "+91 94351 23456", 4.9, "Bamboo stilt huts, Home-cooked Mishing fish thali, Bicycle rentals, Bonfire", 1, "Authentic traditional bamboo cottage experience built on stilts over water hyacinth ponds. Run by local youth promoting Mishing tribal arts."),
        ("AS", "kaziranga-national-park", "Diphlu River Lodge Homestay Annex", "Bhaben Saikia", "Kohora Village, Kaziranga", 1200, "+91 98540 87654", 4.8, "Tea garden view, Organic Assamese meals, Guided birdwatching, Safari booking assistance", 1, "Charming family-run lodge tucked next to tea gardens. Host Bhaben is an accredited naturalist with 20 years of wildlife tracking experience."),
        ("ML", "nongriat-root-bridges", "Serene Homestay Nongriat", "Byron Khongjee", "Lower Nongriat Village", 600, "+91 96152 34123", 4.9, "Dormitory and private rooms, Fresh mountain stream bath, Khasi vegetarian/pork meals, Free walking sticks", 1, "Located just 3 minutes walk from the Double Decker Living Root Bridge. Clean, simple, and the warmest Khasi family hospitality you will ever experience."),
        ("ML", "dawki-shnongpdeng-river", "Betelnut Eco Huts", "Bantei Bareh", "Shnongpdeng Riverfront", 1100, "+91 87876 54321", 4.8, "Riverside wooden huts, Bonfire, Kayaking gear, Traditional Khasi and Jaintia meals", 1, "Step directly from your bamboo porch onto the white pebble shores of the crystalline Umngot River."),
        ("AR", "tawang-sela-pass", "Dungkar Monpa Homestay", "Tsering Lhamo", "Near Tawang Monastery", 1400, "+91 94360 11223", 4.9, "Wood-fired Bukhari heater, Butter tea & Momos, Mountain view rooms, Prayer room access", 1, "Cosy Monpa home with panoramic view of Tawang Monastery. Host Tsering serves piping hot thukpa and shares fascinating folk stories of the Himalayan passes."),
        ("AR", "ziro-valley-apatani", "Abotani Traditional Bamboo Cottage", "Tage Kanya", "Hong Village, Ziro", 1200, "+91 89745 66778", 4.8, "Apatani hearth room, Rice wine tasting, Organic garden veggies, Walking tour with village elder", 1, "Experience living in an authentic Apatani wooden stilt house in Hong, the largest Apatani village. Watch sunset over green paddy fields."),
        ("NL", "dzukou-valley-trek", "Viswema Trekkers Nest", "Viketou Angami", "Viswema Village Trailhead", 800, "+91 98622 99881", 4.9, "Camp tents, Sleeping bags rental, Warm water bucket, Naga smoked pork stew, Trail guide", 1, "The base camp homestay for Dzukou trekkers. Viketou provides sleeping bags, mats, and guides for the early morning ascent."),
        ("NL", "khonoma-green-village", "Meru Eco Homestay", "Kevichusa Meru", "Terhotsiese Khel, Khonoma", 1100, "+91 94368 77654", 4.9, "Handcrafted Angami wood interior, Terrace farm view, Traditional weaving demo, Birding guide", 1, "Perched right above ancient terrace fields. Host Kevichusa is an active member of the Khonoma Green Village Council."),
        ("MN", "loktak-lake-keibul-lamjao", "Phumdi Floating Homestay", "Oinam Tomba", "Thanga Island / Loktak Lake", 1300, "+91 96123 45678", 4.9, "Wooden cabin on floating Phumdi island, Canoe ride included, Fresh lake fish dinner, Solar power", 1, "A once-in-a-lifetime experience: sleep in a bamboo eco-hut floating on Loktak Lake! Watch sunrise over misty water while lotus flowers open."),
        ("MZ", "aizawl-reiek-peak", "Reiek Community Tourist Huts", "Lalthanzuala", "Reiek Village, Mizoram", 950, "+91 98625 12345", 4.8, "Traditional Mizo bamboo cottage, Pine valley view, Fresh Bai stew, Walking distance to peak", 1, "Operated by the village community cooperative. Spectacular cool breezes and uninterrupted starry night skies."),
        ("TR", "unakoti-rock-reliefs", "Unakoti Heritage Retreat", "Biplab Debbarma", "Kailashahar Foothills", 850, "+91 94361 78901", 4.7, "Spacious garden rooms, Authentic Tripuri cuisine (Mui Borok), Tea garden walk, Guided cave visits", 1, "Surrounded by betel nut groves and tea estates. Biplab arranges early-morning visits to Unakoti before tour buses arrive."),
        ("SK", "pelling-skywalk-pemayangtse", "Kanchenjunga View Homestay", "Dawa Bhutia", "Upper Pelling", 1250, "+91 97330 55443", 4.9, "Direct Kanchenjunga sunrise from bed, Organic Lepcha/Bhutia meals, Hot water geyser, Fireplace", 1, "Panoramic sunrise views without leaving your bedroom. Dawa and his family serve home-grown organic vegetable soups, momos, and Sikkim tea.")
    ]

    cursor.executemany("""
    INSERT INTO homestays (
        state_code, destination_slug, name, host_name, village_location,
        price_per_night, contact_phone, rating, amenities, eco_certified, description
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, homestays)

    # Seed Prebuilt Itineraries
    itineraries = [
        (
            "meghalaya-budget-backpacker-5d",
            "Meghalaya Backpacker: Waterfalls & Living Root Bridges",
            "ML", 5, "budget", 7400, "Active & Adventurous",
            "The quintessential budget explorer route through Meghalaya. Experience soaring waterfalls in Cherrapunji, hike the 3,500 steps to the world-famous Double Decker Root Bridge, camp on the crystal Umngot river in Dawki, and explore Asia's cleanest village without spending a fortune.",
            json.dumps([
                {"day": 1, "title": "Guwahati to Shillong & Police Bazar", "stay": "Shillong Backpacker Hostel", "activities": ["Shared Swift/Sumo from Khanapara to Shillong (₹300)", "Check-in and stroll through Police Bazar street food", "Visit Ward's Lake and Don Bosco Museum", "Dinner: Jadoh and local Khasi snacks at Trattoria (₹150)"]},
                {"day": 2, "title": "Shillong to Cherrapunji (Sohra) Waterfalls", "stay": "Sohra Community Homestay", "activities": ["Shared Sumo from Lewduh to Sohra (₹120)", "Nohkalikai Falls breathtaking canyon view (₹20 entry)", "Explore limestone passages of Mawsmai Cave (₹30)", "Sunset at Wei Sawdong 3-tier waterfall", "Homestay dinner with warm bamboo soup"]},
                {"day": 3, "title": "Trek to the Double Decker Living Root Bridge", "stay": "Nongriat Village Bamboo Homestay", "activities": ["Shared taxi to Tyrna village (₹60)", "Trek down 3,500 stone steps into the tropical river valley", "Arrive at Nongriat Double Decker Living Root Bridge", "Hike further to Rainbow Falls natural turquoise pool", "Night stay in Nongriat village under starry sky (₹500)"]},
                {"day": 4, "title": "Dawki Umngot River & Shnongpdeng Camping", "stay": "Shnongpdeng Riverside Tent", "activities": ["Morning ascent back to Tyrna, shared cab to Dawki & Shnongpdeng (₹220)", "Check-in to riverside camp on pebble beach", "Transparent boat safari on Umngot River (₹200 shared)", "Cliff jumping, suspension bridge walk & evening bonfire"]},
                {"day": 5, "title": "Mawlynnong Clean Village & Return to Guwahati", "stay": "Return Trip", "activities": ["Morning walk in Mawlynnong spotless lanes (Cleanest Village in Asia)", "Riwai village single root bridge", "Shared cab back to Shillong (₹150) and Guwahati (₹300)", "Catch evening train/flight from Guwahati"]}
            ]),
            "Sturdy trekking shoes with good grip (crucial for 3,500 stone steps), Quick-dry microfiber towel, Waterproof poncho, Refillable water bottle, Mosquito repellent, Cash (ATMs scarce in Nongriat & Shnongpdeng)."
        ),
        (
            "arunachal-tawang-high-altitude-7d",
            "Arunachal High Altitude Trail: Tawang, Sela Pass & Monasteries",
            "AR,AS", 7, "budget", 13800, "Moderate & Scenic",
            "Traverse the eastern Himalayas on a scenic journey through Bomdila, Dirang, over the frozen Sela Pass at 13,700 feet, to the majestic 400-year-old Tawang Monastery. Master the shared Tata Sumo network to explore the Himalayan wonderland at 70% lower cost.",
            json.dumps([
                {"day": 1, "title": "Guwahati to Tezpur Gateway", "stay": "Tezpur Budget Hotel", "activities": ["ASTC bus from Guwahati to Tezpur (₹200)", "Verify Arunachal ILP at check counter", "Visit Agnigarh Hill overlooking Brahmaputra", "Pre-book shared Sumo seat at Tezpur counter for next morning (₹600)"]},
                {"day": 2, "title": "Tezpur to Dirang Valley Acclimatization", "stay": "Dirang Valley Homestay", "activities": ["5:30 AM Shared Tata Sumo into Arunachal hills", "Check-in at Bhalukpong police checkpoint with ILP", "Drive past Tipi Orchidarium and Bomdila", "Arrive in picturesque Dirang valley (5,000 ft) for acclimatization", "Visit Dirang Dzong (fort) and kiwi orchards"]},
                {"day": 3, "title": "Crossing Sela Pass (13,700 ft) to Tawang", "stay": "Tawang Monpa Homestay", "activities": ["Shared Sumo from Dirang towards Tawang (₹650)", "Stop at frozen Sela Pass (13,700 ft) and sacred Sela Lake", "Pay respects at Jaswant Garh War Memorial (free army tea & samosa!)", "Marvel at Nuranang (Jang) 100-meter waterfall", "Arrive in Tawang (10,000 ft) and settle into Monpa homestay"]},
                {"day": 4, "title": "Tawang Monastery & Heritage Exploration", "stay": "Tawang Monpa Homestay", "activities": ["Dawn prayer chants at 400-year-old Tawang Monastery (India's largest)", "Explore the ancient library of gold-lettered Buddhist scriptures", "Visit Urgelling Monastery (birthplace of the 6th Dalai Lama)", "Tawang War Memorial light and sound tribute", "Hot butter tea and steaming thukpa dinner"]},
                {"day": 5, "title": "Excursion to Madhuri (Sangetsar) Lake", "stay": "Tawang Monpa Homestay", "activities": ["Share a 4x4 cab with fellow travellers to Madhuri Lake (₹700/head)", "Surreal lake formed by 1950 earthquake with dead tree trunks", "Bum La Indo-China border viewpoint (subject to army pass)", "Warm Maggi and momos at Army cafeteria"]},
                {"day": 6, "title": "Tawang to Bomdila Descent", "stay": "Bomdila Monastery Guest House", "activities": ["Early morning shared Sumo from Tawang to Bomdila (₹650)", "Visit Gontse Gaden Rabgyel Lling Monastery in Bomdila", "Sunset view of Himalayan peaks from Bomdila viewpoint"]},
                {"day": 7, "title": "Bomdila to Guwahati Return", "stay": "Guwahati", "activities": ["Morning shared Sumo from Bomdila to Tezpur/Guwahati (₹700)", "Arrive in Guwahati by late afternoon", "Brahmaputra sunset ferry ride or Kamakhya temple visit"]}
            ]),
            "Thermal innerwear (temperatures drop below freezing), Heavy fleece / down jacket, Gloves and woolen beanie, High-altitude sunglasses (UV protection on snow), Sunscreen SPF 50+, Diamox or camphor for acclimatization, 4 passport photos + printed ILP copies."
        ),
        (
            "assam-wildlife-and-majuli-6d",
            "Wild Assam & River Island: Kaziranga, Majuli & Ahoms",
            "AS", 6, "budget", 9200, "Relaxed & Cultural",
            "Encounter prehistoric one-horned rhinos in Kaziranga National Park, cross the mighty Brahmaputra to cycle through the peaceful river island of Majuli, and walk among the 600-year-old imperial monuments of the Ahom Kingdom in Sivasagar.",
            json.dumps([
                {"day": 1, "title": "Guwahati to Kaziranga National Park", "stay": "Kaziranga Eco Cottage", "activities": ["Morning ASTC bus from Guwahati ISBT to Kohora (₹280, 4.5 hrs)", "Check into eco-cottage near tea gardens", "Afternoon Jeep safari in Bagori Western Range (rhinos & buffaloes)", "Visit Kaziranga Orchid Park: 500+ indigenous orchid varieties & cultural dance"]},
                {"day": 2, "title": "Dawn Elephant Safari & Move to Jorhat", "stay": "Jorhat Budget Stay", "activities": ["Early 5:30 AM elephant safari in Kohora Range (closest rhino encounters)", "Traditional Assamese breakfast: Jolpan, pitha, and curd", "Afternoon local bus to Jorhat tea city (₹120, 2 hrs)", "Explore Tocklai Tea Research Institute or Jorhat tea gardens"]},
                {"day": 3, "title": "Nimati Ghat Ferry to Majuli River Island", "stay": "La Lolat Eco Bamboo Camp", "activities": ["Shared auto to Nimati Ghat (₹40), Ro-Pax river ferry across Brahmaputra (₹15!)", "Arrive in Majuli and rent a bicycle (₹100/day)", "Visit Uttar Kamalabari Satra to watch monks practice Sattriya dance", "Sunset over the water hyacinth marshes"]},
                {"day": 4, "title": "Mask Making & Mishing Tribal Immersion", "stay": "La Lolat Eco Bamboo Camp", "activities": ["Cycle to Natun Samaguri Satra: Live bamboo & clay mask making demonstration", "Interact with master artisans preserving 500-year-old Ramayana masks", "Lunch at Mishing tribal village: rice beer (Apong) & steamed fish in banana leaves", "Birdwatching along Kherkatia Suti"]},
                {"day": 5, "title": "Sivasagar: Imperial Monuments of the Ahoms", "stay": "Sivasagar Town Hotel", "activities": ["Morning ferry back to Nimati Ghat, shared cab to Sivasagar (₹100)", "Rang Ghar: Royal 2-story pavilion and Asia's oldest sports amphitheater", "Talatal Ghar underground palace secrets", "Shiva Dol: Tallest Shiva temple tower in India on Borpukhuri tank", "UNESCO heritage Charaideo royal burial Maidams"]},
                {"day": 6, "title": "Overnight Broad Gauge Train back to Guwahati", "stay": "Return Trip", "activities": ["Morning tea tasting in historic Sivasagar", "Board Jan Shatabdi or intercity train to Guwahati (₹160)", "Scenic ride through Assamese paddy fields and forests"]}
            ]),
            "Earth-toned cotton clothes for safari (avoid loud colors), Binoculars (critical for bird and wildlife spotting), Mosquito spray, Bicycle-friendly shorts/pants, Slip-on shoes (for frequent monastery temple visits)."
        ),
        (
            "nagaland-dzukou-and-hornbill-5d",
            "Nagaland Tribal Trails: Dzukou Valley Trek & Khonoma Green Village",
            "NL", 5, "budget", 8100, "Active Trekking & Culture",
            "Hike into the surreal dwarf bamboo meadows of Dzukou Valley, camp in dormitory caves, explore India's first green village Khonoma, and immerse yourself in proud Angami warrior heritage.",
            json.dumps([
                {"day": 1, "title": "Dimapur to Kohima Highland Ridge", "stay": "Kohima Backpackers Lodge", "activities": ["Arrive at Dimapur railhead, shared cab to Kohima (₹250, 2.5 hrs)", "Check ILP at Chumukedima police post", "Walk through Kohima WWII Commonwealth War Cemetery", "Explore local night market for Naga smoked delicacies"]},
                {"day": 2, "title": "Trek up to Dzukou Valley", "stay": "Dzukou Valley Rest House Dorm", "activities": ["Shared taxi to Viswema village gate (₹80)", "Hike up the Viswema stone steps through mossy rainforest (2-3 hrs)", "Emerge onto the breathtaking undulating plateau of dwarf bamboo", "Wander along crystal serpentine streams", "Sunset over rolling green knolls; sleep in basic rest house dorm (₹150)"]},
                {"day": 3, "title": "Sunrise over Dzukou & Descent to Jakhama", "stay": "Khonoma Village Homestay", "activities": ["Incredible 5:30 AM sunrise over Dzukou floral meadows", "Hike to Ghost Cave and natural cold-spring pools", "Descend via the steeper Jakhama trail (2 hrs)", "Shared cab to Khonoma Green Village (₹100)", "Evening village walk through ancient stone defensive forts"]},
                {"day": 4, "title": "Khonoma Eco-Village & Kisama Heritage", "stay": "Kohima / Khonoma Homestay", "activities": ["Guided tour of Khonoma terrace farming and Tragopan sanctuary", "Visit Angami wood-carvers and traditional Morungs (youth dorms)", "Afternoon visit to Kisama Heritage Village (Hornbill Festival venue)", "Traditional Naga dinner with Axone and smoked pork/mushrooms"]},
                {"day": 5, "title": "Kohima to Dimapur Return", "stay": "Return Trip", "activities": ["Visit Kohima State Museum (Naga tribal ornaments & weapons)", "Shared cab back down to Dimapur railway station (₹250)", "Catch train to Guwahati or flight home"]}
            ]),
            "Warm sleeping bag liner / thermal innerwear for Dzukou, Rain poncho / waterproof jacket, Sturdy hiking boots, Reusable water flask (No single-use plastic bottles permitted in Dzukou), Power bank (no electricity in Dzukou valley), Nagaland ILP hard copies."
        ),
        (
            "sikkim-himalayan-majesty-7d",
            "Sikkim Himalayan Magic: Gurudongmar Lake, Yumthang & Pelling",
            "SK", 7, "budget", 14500, "High Altitude Mountain Magic",
            "From the sacred turquoise waters of Gurudongmar Lake at 17,800 feet to the blooming rhododendrons of Yumthang Valley and the close-up sunrise views of Mount Kanchenjunga from Pelling Skywalk.",
            json.dumps([
                {"day": 1, "title": "NJP/Siliguri to Gangtok City", "stay": "Gangtok Budget Hotel", "activities": ["Shared Tata Sumo from NJP Station to Gangtok (₹350, 4.5 hrs)", "Submit ID and photos at local agency for North Sikkim PAP permit", "Evening stroll on the pedestrian-only MG Marg", "Taste steaming mutton momos and hot Thukpa"]},
                {"day": 2, "title": "Gangtok to Lachen (North Sikkim Expedition)", "stay": "Lachen Wooden Homestay", "activities": ["Board shared North Sikkim package Sumo from Vajra stand", "Drive past Seven Sisters Waterfall and Singhik viewpoint", "Cross Mangan and Chungthang river confluence", "Arrive in Lachen mountain village (9,000 ft), settle into wooden homestay", "Early sleep to prepare for 4 AM start"]},
                {"day": 3, "title": "Sacred Gurudongmar Lake (17,800 ft) to Lachung", "stay": "Lachung Homestay", "activities": ["4:00 AM start towards high alpine Tibetan plateau", "Breakfast at Thangu valley military outpost", "Arrive at awe-inspiring Gurudongmar Lake (17,800 ft) with prayer flags fluttering against snow peaks", "Descend to Chopta Valley and drive to Lachung village for night stay"]},
                {"day": 4, "title": "Yumthang Valley of Flowers & Return to Gangtok", "stay": "Gangtok Budget Hotel", "activities": ["Drive up to Yumthang Valley of Flowers (Rhododendron Sanctuary)", "Optional excursion to Zero Point (15,300 ft snow wonderland)", "Warm up at Yumthang natural sulfur hot springs", "Scenic return drive back to Gangtok by evening"]},
                {"day": 5, "title": "Gangtok to Pelling (West Sikkim)", "stay": "Pelling Kanchenjunga View Homestay", "activities": ["Shared Tata Sumo from Deorali stand to Pelling (₹320, 4.5 hrs)", "En-route stop at Ravangla Buddha Park (130ft giant Buddha statue)", "Arrive in Pelling and witness Mount Kanchenjunga turning golden at sunset"]},
                {"day": 6, "title": "Pelling Glass Skywalk & Ancient Monasteries", "stay": "Pelling Homestay", "activities": ["5:15 AM majestic sunrise over Kanchenjunga from balcony", "Walk on India's first Glass Skywalk leading to Chenrezig statue", "Visit 300-year-old Pemayangtse Monastery", "Hike through forest to ancient Rabdentse royal stone palace ruins", "Visit wish-fulfilling Khecheopalri sacred lake"]},
                {"day": 7, "title": "Pelling to NJP/Bagdogra Departure", "stay": "Return Trip", "activities": ["Shared Sumo from Pelling back to Siliguri/NJP (₹350, 4.5 hrs)", "Catch onward train from NJP or flight from Bagdogra"]}
            ]),
            "Heavy down jacket, Gloves and thermal inners, UV protection sunglasses, High-altitude sickness medicine (Diamox), 4 passport photos and Voter ID/Aadhaar card copies for Sikkim permits."
        ),
        (
            "seven-sisters-grand-explorer-12d",
            "The Grand North East Odyssey: 4 States in 12 Days",
            "AS,ML,NL,MN", 12, "budget", 21500, "Comprehensive Grand Tour",
            "The ultimate overland loop connecting Assam's wildlife, Meghalaya's cloud canyons, Nagaland's tribal heritage, and Manipur's floating islands. Built specifically for budget overland backpackers using trains and shared transport.",
            json.dumps([
                {"day": 1, "title": "Guwahati: Kamakhya & Brahmaputra Sunset", "stay": "Guwahati Backpacker Hostel", "activities": ["Kamakhya Temple perched on Nilachal Hill", "Umananda Island (smallest inhabited river island in the world)", "Sunset cruise / ferry on the Brahmaputra"]},
                {"day": 2, "title": "Guwahati to Shillong & Cherrapunji", "stay": "Cherrapunji Homestay", "activities": ["Shared cab to Shillong and onward to Cherrapunji", "Nohkalikai Falls & Mawsmai cave exploration"]},
                {"day": 3, "title": "Double Decker Root Bridge Hike & Dawki", "stay": "Shnongpdeng Camp", "activities": ["Hike Nongriat root bridges, drive to Shnongpdeng", "Camp by the clear Umngot river"]},
                {"day": 4, "title": "Mawlynnong to Kaziranga National Park", "stay": "Kaziranga Eco Camp", "activities": ["Cleanest village Mawlynnong, shared cab back to Guwahati", "Afternoon bus directly to Kaziranga (Kohora)"]},
                {"day": 5, "title": "Kaziranga Rhino Safari & Majuli Ferry", "stay": "Majuli Bamboo Cottage", "activities": ["Dawn rhino safari in Kaziranga", "Afternoon ferry from Nimati Ghat to Majuli River Island"]},
                {"day": 6, "title": "Majuli Satras to Dimapur (Nagaland)", "stay": "Dimapur Stay", "activities": ["Mask making at Samaguri Satra", "Ferry back to Jorhat, evening train to Dimapur"]},
                {"day": 7, "title": "Dimapur to Kohima & Dzukou Base", "stay": "Viswema Homestay", "activities": ["Shared cab to Kohima, WWII Cemetery, base camp for Dzukou"]},
                {"day": 8, "title": "Dzukou Valley Trekking Day", "stay": "Dzukou Dormitory", "activities": ["Trek up Viswema trail into the dwarf bamboo wonderland"]},
                {"day": 9, "title": "Descend Dzukou & Drive to Imphal (Manipur)", "stay": "Imphal Budget Hotel", "activities": ["Descend via Jakhama, shared winger via Mao gate to Imphal", "Check Manipur ILP at Mao checkpost"]},
                {"day": 10, "title": "Loktak Floating Lake & Sangai Deer", "stay": "Phumdi Floating Homestay", "activities": ["Sendra Island, Keibul Lamjao National Park (dancing Sangai deer)", "Night stay in floating cottage on Loktak Lake"]},
                {"day": 11, "title": "Ima Keithel Women's Market & Kangla Fort", "stay": "Imphal Hotel", "activities": ["Kangla Fort, explore Asia's 5,000 all-women traders market Ima Keithel"]},
                {"day": 12, "title": "Departure from Imphal Airport", "stay": "Return Trip", "activities": ["Flight home from Imphal or shared road transit back to Guwahati"]}
            ]),
            "Multi-state ILP documents (printed copies for Nagaland & Manipur), Multi-terrain footwear, Universal adapter, Thermal layers, Waterproof dry bag."
        )
    ]

    cursor.executemany("""
    INSERT INTO prebuilt_itineraries (
        slug, title, states, duration_days, budget_level, est_total_cost_inr,
        pace, summary, day_plans_json, packing_tips
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, itineraries)

    # Seed Community Tips
    tips = [
        ("ML", "Nongriat Living Root Bridges", "Aniket Sharma", "Pune", "Budget", "Don't pay ₹2,000 for a private cab to Sohra! Take the shared yellow sumo from Lewduh Bara Bazar for ₹120. Stay overnight in Byron's homestay at Nongriat—the morning mist over the double-decker bridge before day-trippers arrive is pure magic.", 28),
        ("AR", "Tawang & Sela Pass", "Devika Nambiar", "Bengaluru", "Transport", "Always book your shared Sumo seat the evening before at the Tezpur or Bomdila stand. Request seat #1 or #2 (front cabin next to driver) for the most legroom and jaw-dropping mountain views across Sela Pass.", 35),
        ("SK", "Gurudongmar Lake & North Sikkim", "Rohan Das", "Kolkata", "Permits", "Never book a private cab for North Sikkim if traveling solo or as a couple (costs ₹18,000+). Walk into any travel desk on MG Marg Gangtok and ask for a shared seat in a North Sikkim Sumo package (₹3,500-4,200 per person all-inclusive with food and lodging).", 42),
        ("AS", "Majuli Island", "Priyanka Bora", "Guwahati", "Local Culture", "The government Ro-Pax ferry from Nimati Ghat to Majuli costs only ₹15 per person! Rent a bicycle in Kamalabari for ₹100/day. Spend an hour with master Hemchandra Goswami at Samaguri Satra—he explains how traditional masks are made from river clay and bamboo.", 19),
        ("NL", "Dzukou Valley", "Toshi Jamir", "Kohima", "Eco & Packing", "Do not carry plastic disposable water bottles to Dzukou! The forest committee at Viswema gate strictly checks your backpack and fines violators. Bring a stainless steel bottle—the spring water in the valley is 100% pure and delicious.", 31),
        ("MN", "Loktak Lake & Keibul Lamjao", "Siddharth Menon", "Chennai", "Experience", "Stay at a floating hut homestay in Thanga village on Loktak. You wake up with the hut gently swaying on the water, surrounded by fishermen in dugout canoes and purple water lilies. It costs only ₹1,200 including dinner and boat ride.", 24),
        ("TR", "Unakoti Rock Carvings", "Arup Roy", "Silchar", "Transport", "Take the morning Jan Shatabdi train from Agartala to Kumarghat for just ₹75! Shared autos outside Kumarghat station take you directly to the Unakoti Shiva carvings in 30 minutes for ₹40. Very peaceful and almost no tourists on weekdays.", 15)
    ]

    cursor.executemany("""
    INSERT INTO community_tips (
        state_code, destination_name, author_name, author_city, category, tip_text, upvotes
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
    """, tips)

    # Seed Destination Reviews
    reviews = [
        ("kaziranga-national-park", "Rahul Verma", "Delhi", 5, "Spotted 14 rhinos in just 2 hours in the Bagori zone! The elephant safari at dawn is an ethereal experience. The Orchid Park nearby serves the best authentic Assamese thali.", "November"),
        ("cherrapunji-sohra", "Meera Kulkarni", "Mumbai", 5, "Wei Sawdong and Nohkalikai left us speechless. The sheer volume of water cascading into deep turquoise plunge pools is unmatched anywhere else in India.", "October"),
        ("tawang-sela-pass", "Arjun Nair", "Hyderabad", 5, "Standing in front of the 400-year-old Tawang Monastery with prayer flags flapping in the cold Himalayan wind gave me goosebumps. Sela Pass at 13,700 ft with frozen lake is surreal.", "November"),
        ("dzukou-valley-trek", "Karan Singhal", "Jaipur", 5, "The most rewarding trek of my life. Rolling dwarf bamboo hills stretching as far as the eye can see. Very peaceful and clean.", "June"),
        ("majuli-island", "Elena Rostova", "Berlin", 5, "Majuli felt like time slowed down. The monks at Uttar Kamalabari Satra were so warm and hospitable, and cycling along the river banks was pure serenity.", "January")
    ]

    cursor.executemany("""
    INSERT INTO reviews (
        destination_slug, user_name, user_origin, rating, review_text, travel_month
    ) VALUES (?, ?, ?, ?, ?, ?)
    """, reviews)

if __name__ == "__main__":
    init_db()
