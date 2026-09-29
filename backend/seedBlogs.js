const dotenv = require("dotenv");
const mongoose = require("mongoose");
const connectDB = require("./config/db");
const Blog = require("./models/Blog");

dotenv.config();

const blogs = [
  {
    title: "Kharif Season: A Complete Guide for Farmers",
    slug: "kharif-season-complete-guide",
    excerpt:
      "Everything you need to know about the Kharif cropping season — what to sow, when to sow, and how to care for your crops through the monsoon.",
    coverImage: "/blog/kharif-guide.jpg",
    author: "Kanisha Enterprises",
    tags: ["kharif", "seasons", "monsoon"],
    content: `Kharif is the monsoon cropping season in India. Sowing usually begins in June with the arrival of the southwest monsoon, and harvest typically happens between September and October.

COMMON KHARIF CROPS
Paddy is the most important Kharif crop, followed by maize, soybean, groundnut, cotton, and various pulses. Different regions favour different crops depending on rainfall, soil type, and local markets.

WHEN TO SOW
Timing matters. Sowing too early can expose seedlings to dry spells; sowing too late risks the crop being caught by early withdrawal of the monsoon. Aim to sow within the first two weeks of monsoon arrival for best results.

SOIL PREPARATION
Good Kharif harvests start with proper soil preparation. Plough the field after the first showers, incorporate organic matter, and level the field carefully — paddy in particular needs level fields for even water distribution.

WATER MANAGEMENT
Though the monsoon provides most of the water, drainage is just as important as irrigation. Waterlogged fields can damage roots and invite fungal disease. Make sure your field has proper drainage channels.

PEST AND DISEASE CONTROL
The humid conditions of Kharif invite pests and fungal diseases. Regular field inspection is critical. Use integrated pest management — combine cultural practices, biological controls, and chemical pesticides only when necessary.

CHOOSING SEEDS
Always choose certified seeds from trusted sources. Look for varieties that match your region's rainfall pattern and are resistant to locally common diseases.`,
  },

  {
    title: "Rabi Season: Winter Crops and What to Sow",
    slug: "rabi-season-winter-crops-guide",
    excerpt:
      "A practical guide to the Rabi (winter) cropping season — from wheat and mustard to potato and gram, plus irrigation and frost protection tips.",
    coverImage: "/blog/rabi-guide.jpg",
    author: "Kanisha Enterprises",
    tags: ["rabi", "winter", "seasons"],
    content: `Rabi is the winter cropping season in India. Sowing typically starts in October and November, and harvest happens between March and April.

COMMON RABI CROPS
Wheat is the flagship Rabi crop, followed by mustard, gram, barley, peas, and — very importantly for many farmers — potato. Each crop has its own ideal sowing window.

THE POTATO WINDOW
Potato is planted between mid-October and mid-November in most parts of northern India. Late planting reduces yield sharply because the crop hits high temperatures during tuber formation. Seed tubers should be well-sprouted and disease-free.

MUSTARD IN RABI
Mustard is one of the best oilseed crops for Rabi. It tolerates light frost better than many other crops and gives a good return in a relatively short season. Sow by early November for best yields.

IRRIGATION IS KEY
Unlike Kharif, Rabi has little natural rainfall. Wheat typically needs 4-6 irrigations at critical growth stages. Potato needs more frequent, lighter irrigation. Never let the soil dry out at the flowering or tuber-formation stage.

FROST PROTECTION
In January, frost can damage standing crops — especially potato. Light irrigation before a frost night helps. Some farmers use smoke or covers on high-value crops.

SOIL AND NUTRITION
Rabi crops generally do well after a Kharif legume. Add organic matter before sowing and follow soil-test-based fertilizer recommendations. Split nitrogen application gives better results than a single dose.`,
  },

  {
    title: "How to Choose the Right Paddy Seeds",
    slug: "how-to-choose-paddy-seeds",
    excerpt:
      "Paddy varieties vary widely in duration, yield, and disease resistance. Here's how to pick the right one for your field and market.",
    coverImage: "/blog/paddy-seeds.jpg",
    author: "Kanisha Enterprises",
    tags: ["seeds", "paddy", "kharif"],
    content: `Picking the right paddy seed is one of the highest-impact decisions you'll make in a season. A good choice can add 20-30% to your yield; a bad one can wipe out months of work.

FACTORS TO CONSIDER

1. DURATION
Paddy varieties range from short duration (100-120 days) to long duration (150-160 days). Short-duration varieties let you fit in another crop. Long-duration ones often yield more but occupy the field longer.

2. WATER AVAILABILITY
If you have assured irrigation, high-yielding varieties work well. If you depend on rain, choose drought-tolerant or shorter-duration varieties that finish before the monsoon ends.

3. GRAIN TYPE
Basmati commands a premium in the export market. Common varieties sell in local markets. Aromatic short-grain varieties have niche markets. Know which market you're selling into.

4. DISEASE RESISTANCE
If your region has recurring issues with bacterial blight, blast, or brown plant hopper, choose varieties with documented resistance to those specific problems.

5. SOIL TYPE
Heavy clay soils suit long-duration varieties. Light soils and upland conditions suit shorter-duration, less water-hungry types.

6. SEED QUALITY
Buy certified seed from a reputable source. Check for the certification tag, packing date, and germination percentage. Cheap, unbranded seed often costs more in the long run.

A PRACTICAL APPROACH
Don't put all your eggs in one basket. Many successful farmers grow 2-3 varieties — one main high-yielder, one short-duration backup, and one specialty variety for premium markets.`,
  },

  {
    title: "Organic vs Chemical Fertilizers: Which Should You Use?",
    slug: "organic-vs-chemical-fertilizers",
    excerpt:
      "Both have a place in modern farming. This post explains the trade-offs so you can make the right choice for your soil, crop, and budget.",
    coverImage: "/blog/fertilizers.jpg",
    author: "Kanisha Enterprises",
    tags: ["fertilizers", "organic", "soil-health"],
    content: `Farmers often ask: should I go fully organic, or stick with chemical fertilizers? The honest answer is: it depends — and usually, a mix works best.

WHAT ORGANIC FERTILIZERS DO WELL
Organic fertilizers — compost, vermicompost, green manure, bio-fertilizers — improve soil structure, water-holding capacity, and long-term fertility. They feed soil microbes that make nutrients available to plants. They don't burn roots or cause salt buildup.

WHERE ORGANIC FALLS SHORT
Organic nutrients release slowly. For high-yielding varieties in a short season, they may not supply enough of the key nutrients at the right time. They're also bulkier to transport and apply.

WHAT CHEMICAL FERTILIZERS DO WELL
Chemical fertilizers — urea, DAP, NPK blends — deliver precise nutrients quickly. For a crop that's showing a deficiency, they're the fastest fix. They're easy to dose and apply.

WHERE CHEMICAL FALLS SHORT
Over-reliance on chemicals degrades soil organic matter over time. Excess nitrogen leaches into groundwater. Continuous use without organic inputs can leave soil compacted and biologically dead.

THE PRACTICAL BALANCE
Most productive farms use both. A common approach:
- Apply 5-10 tonnes of compost or FYM per acre before sowing
- Use chemical fertilizers to meet the crop's peak nutrient demand
- Include a bio-fertilizer (like Rhizobium or Azotobacter) as a seed treatment
- Rotate crops to build soil health naturally

This gives you fast nutrient availability when the crop needs it, and long-term soil improvement that reduces your fertilizer bill over the years.

A CAUTION
Never mix fertilizers casually. Some combinations (like calcium with phosphate) react and lose effectiveness. Always check compatibility or ask your local agricultural officer.`,
  },

  {
    title: "5 Common Crop Diseases and How to Prevent Them",
    slug: "common-crop-diseases-prevention",
    excerpt:
      "Blast, blight, wilt, rust, and powdery mildew — learn the early signs and the preventive steps that save crops.",
    coverImage: "/blog/crop-diseases.jpg",
    author: "Kanisha Enterprises",
    tags: ["diseases", "pesticides", "crop-protection"],
    content: `Disease is one of the biggest causes of yield loss in Indian agriculture. Early recognition and quick action make the difference between a minor setback and a failed crop.

1. BLAST (Paddy)
Signs: Diamond-shaped grey spots on leaves, brown lesions on neck and panicle. 
Prevention: Use resistant varieties. Avoid excess nitrogen. Treat seed with fungicide before sowing. Spray tricyclazole or similar fungicide at first sign.

2. BLIGHT (Potato, Tomato)
Signs: Water-soaked brown patches on leaves, spreading quickly in humid weather. Rotting tubers or fruits.
Prevention: Use certified disease-free seed. Rotate crops. Avoid overhead irrigation late in the day. Copper-based sprays help control spread.

3. WILT (Many crops — pulses, cotton, tomato)
Signs: Sudden wilting of leaves, yellowing, plant collapse. Cutting the stem reveals brown discolouration inside.
Prevention: Treat seed with Trichoderma. Improve drainage. Solarise soil before sowing. Remove and destroy affected plants immediately.

4. RUST (Wheat, pulses)
Signs: Orange, yellow, or brown powdery pustules on leaves and stems.
Prevention: Plant rust-resistant varieties. Early sowing reduces risk. Apply recommended fungicide at first appearance.

5. POWDERY MILDEW (Many crops — vegetables, grapes, pulses)
Signs: White powdery patches on leaves, stunting growth.
Prevention: Ensure good air circulation. Avoid overhead watering. Sulfur-based sprays are effective and low-cost.

GENERAL PRINCIPLES FOR DISEASE PREVENTION
- Rotate crops. Different families break disease cycles.
- Buy certified, treated seed.
- Don't over-fertilize, especially with nitrogen.
- Remove crop residue after harvest.
- Scout fields weekly, especially in humid weather.
- Act fast at the first symptom.

Remember: prevention is almost always cheaper than cure.`,
  },

  {
    title: "Potato Farming: A Complete Winter Guide",
    slug: "potato-farming-winter-guide",
    excerpt:
      "Potato is one of the most profitable Rabi crops when grown right. This guide covers variety selection, planting, irrigation, and harvesting.",
    coverImage: "/blog/potato-guide.jpg",
    author: "Kanisha Enterprises",
    tags: ["potato", "rabi", "winter"],
    content: `Potato is a high-value Rabi crop with strong market demand across India. Yields of 10-15 tonnes per acre are achievable with the right practices.

VARIETY SELECTION
Choose varieties based on your market. Table potatoes (Kufri Bahar, Kufri Jyoti) suit fresh markets. Processing varieties (Kufri Chipsona) suit chips and fries. For seed production, choose high-health varieties from certified sources.

SEED TUBERS
Buy certified seed tubers from a reputed source. Store them in a cool, dark place for 2-3 weeks before planting to encourage sprouting. Small whole tubers (25-40 g) work as well as cut pieces and avoid rotting issues.

PLANTING TIME
The ideal window is mid-October to mid-November for most of northern India. Late planting — after mid-November — sharply reduces yield. In peninsular India, adjust for local climate.

SOIL PREPARATION
Potato likes loose, well-drained soil. Deep ploughing and thorough levelling matter. Add plenty of organic matter before planting. Ridge planting is standard — it improves drainage and root aeration.

SPACING
Typical spacing: 60 cm between rows, 20-25 cm between tubers. This gives the crop room for even tuber development.

NUTRITION
Potato is a heavy feeder. Apply farmyard manure generously before planting. Use a balanced NPK basal dose, with nitrogen split across two applications. Potassium is especially important for tuber quality.

IRRIGATION
Irrigate lightly and frequently. The critical stages are stolon formation, tuber initiation, and tuber bulking. Never let the soil dry out during tuber bulking — it reduces yield and causes cracked tubers.

PEST AND DISEASE
The two biggest threats are late blight (a fungal disease) and potato tuber moth. Preventive fungicide sprays during humid weather are essential. Store harvested tubers in a cool, ventilated place with proper treatment for moth control.

HARVESTING
Stop irrigation 10-15 days before harvest. This firms up the skin and reduces damage. Harvest when the tops have died down and the skin doesn't peel off easily. Cure tubers in a shaded, ventilated place for a week before storage or sale.

Potato rewards careful timing and attention. Get the planting window right, irrigate smartly, and protect against blight — the rest tends to follow.`,
  },
];

const seedBlogs = async () => {
  try {
    await connectDB();
    console.log("Connected to MongoDB");

    await Blog.deleteMany({});
    console.log("Old blog posts removed");

    const inserted = await Blog.insertMany(blogs);
    console.log(`${inserted.length} blog posts inserted`);

    await mongoose.connection.close();
    console.log("Connection closed. Seeding complete.");
    process.exit(0);
  } catch (error) {
    console.error("Seeding error:", error);
    process.exit(1);
  }
};

seedBlogs();