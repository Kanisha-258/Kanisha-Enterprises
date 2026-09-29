const dotenv = require("dotenv");
const mongoose = require("mongoose");
const connectDB = require("./config/db");
const Product = require("./models/Product");

dotenv.config();

const products = [
  // ============================
  // SEEDS → Paddy Seeds
  // ============================
  {
    name: "Premium Paddy Seeds",
    category: "Seeds",
    subcategory: "Paddy Seeds",
    description:
      "High-germination paddy seeds suited for Kharif season. Resistant to common pests.",
    price: 850,
    discountPrice: 699,
    unit: "10 kg",
    rating: 4.8,
    stock: 50,
    image: "/products/paddy-seeds.jpg",
  },
  {
    name: "Basmati Paddy Seeds",
    category: "Seeds",
    subcategory: "Paddy Seeds",
    description:
      "Premium long-grain Basmati variety with excellent aroma and market value.",
    price: 1200,
    discountPrice: 999,
    unit: "10 kg",
    rating: 4.9,
    stock: 30,
    image: "/products/basmati-paddy.jpg",
  },
  {
    name: "Hybrid Paddy Seeds",
    category: "Seeds",
    subcategory: "Paddy Seeds",
    description:
      "High-yield hybrid variety with strong disease resistance and early maturity.",
    price: 950,
    discountPrice: 799,
    unit: "10 kg",
    rating: 4.7,
    stock: 45,
    image: "/products/hybrid-paddy.jpg",
  },

  // ============================
  // SEEDS → Wheat Seeds
  // ============================
  {
    name: "High Yield Wheat Seeds",
    category: "Seeds",
    subcategory: "Wheat Seeds",
    description:
      "Improved wheat variety with strong tillering and high yield potential.",
    price: 750,
    discountPrice: 625,
    unit: "10 kg",
    rating: 4.7,
    stock: 40,
    image: "/products/wheat-seeds.jpg",
  },
  {
    name: "Durum Wheat Seeds",
    category: "Seeds",
    subcategory: "Wheat Seeds",
    description:
      "Premium durum wheat suitable for pasta and high-protein flour production.",
    price: 900,
    discountPrice: 780,
    unit: "10 kg",
    rating: 4.6,
    stock: 25,
    image: "/products/durum-wheat.jpg",
  },

  // ============================
  // SEEDS → Vegetable Seeds
  // ============================
  {
    name: "Tomato Seeds",
    category: "Seeds",
    subcategory: "Vegetable Seeds",
    description:
      "High-yield hybrid tomato seeds resistant to common viral diseases.",
    price: 320,
    discountPrice: 260,
    unit: "10 g",
    rating: 4.7,
    stock: 80,
    image: "/products/tomato-seeds.jpg",
  },
  {
    name: "Brinjal Seeds",
    category: "Seeds",
    subcategory: "Vegetable Seeds",
    description:
      "Quality brinjal seeds producing firm, uniform fruits with good shelf life.",
    price: 280,
    discountPrice: 220,
    unit: "10 g",
    rating: 4.5,
    stock: 70,
    image: "/products/brinjal-seeds.jpg",
  },
  {
    name: "Chilli Seeds",
    category: "Seeds",
    subcategory: "Vegetable Seeds",
    description:
      "High-pungency chilli seeds suited for both green and dry chilli markets.",
    price: 350,
    discountPrice: 290,
    unit: "10 g",
    rating: 4.6,
    stock: 60,
    image: "/products/chilli-seeds.jpg",
  },
  {
    name: "Cucumber Seeds",
    category: "Seeds",
    subcategory: "Vegetable Seeds",
    description:
      "Fast-growing cucumber variety with good fruit size and crispness.",
    price: 240,
    discountPrice: 190,
    unit: "10 g",
    rating: 4.4,
    stock: 90,
    image: "/products/cucumber-seeds.jpg",
  },

  // ============================
  // SEEDS → Fruit Seeds
  // ============================
  {
    name: "Watermelon Seeds",
    category: "Seeds",
    subcategory: "Fruit Seeds",
    description:
      "Sweet, high-yield watermelon seeds suitable for summer cultivation.",
    price: 420,
    discountPrice: 350,
    unit: "25 g",
    rating: 4.6,
    stock: 55,
    image: "/products/watermelon-seeds.jpg",
  },
  {
    name: "Muskmelon Seeds",
    category: "Seeds",
    subcategory: "Fruit Seeds",
    description:
      "Aromatic muskmelon variety with excellent sweetness and uniform ripening.",
    price: 380,
    discountPrice: 310,
    unit: "25 g",
    rating: 4.5,
    stock: 50,
    image: "/products/muskmelon-seeds.jpg",
  },

  // ============================
  // SEEDS → Flower Seeds
  // ============================
  {
    name: "Marigold Seeds",
    category: "Seeds",
    subcategory: "Flower Seeds",
    description:
      "Bright orange marigold seeds, popular for festivals and landscape gardening.",
    price: 180,
    discountPrice: 140,
    unit: "20 g",
    rating: 4.5,
    stock: 100,
    image: "/products/marigold-seeds.jpg",
  },
  {
    name: "Sunflower Seeds",
    category: "Seeds",
    subcategory: "Flower Seeds",
    description:
      "Tall-growing sunflower variety with large, vibrant flower heads.",
    price: 220,
    discountPrice: 175,
    unit: "50 g",
    rating: 4.4,
    stock: 80,
    image: "/products/sunflower-seeds.jpg",
  },

  // ============================
  // SEEDS → Rabi (Winter) Seeds
  // ============================
  {
    name: "Premium Mustard Seeds",
    category: "Seeds",
    subcategory: "Rabi (Winter) Seeds",
    description:
      "Quality mustard seeds suitable for Rabi season. Good oil content.",
    price: 520,
    discountPrice: 450,
    unit: "5 kg",
    rating: 4.6,
    stock: 35,
    image: "/products/mustard-seeds.jpg",
  },
  {
    name: "Potato Seeds (Tubers)",
    category: "Seeds",
    subcategory: "Rabi (Winter) Seeds",
    description:
      "Certified potato tubers for winter planting. High-yield, disease-free stock.",
    price: 680,
    discountPrice: 580,
    unit: "25 kg",
    rating: 4.7,
    stock: 40,
    image: "/products/potato-seeds.jpg",
  },

  // ============================
  // FERTILIZERS
  // ============================
  {
    name: "Organic Bio Fertilizer",
    category: "Fertilizers",
    subcategory: "Organic",
    description:
      "Organic bio-fertilizer that improves soil health and nutrient uptake.",
    price: 650,
    discountPrice: 550,
    unit: "25 kg",
    rating: 4.7,
    stock: 60,
    image: "/products/bio-fertilizer.jpg",
  },
  {
    name: "NPK 10:26:26 Fertilizer",
    category: "Fertilizers",
    subcategory: "Chemical",
    description:
      "Balanced NPK fertilizer for early crop growth and strong root development.",
    price: 1350,
    discountPrice: 1199,
    unit: "50 kg",
    rating: 4.6,
    stock: 30,
    image: "/products/npk-fertilizer.jpg",
  },
  {
    name: "Plant Growth Booster",
    category: "Fertilizers",
    subcategory: "Organic",
    description:
      "Liquid growth booster that promotes faster vegetative growth.",
    price: 480,
    discountPrice: 399,
    unit: "500 ml",
    rating: 4.6,
    stock: 45,
    image: "/products/growth-booster.jpg",
  },
  {
    name: "Vermicompost",
    category: "Fertilizers",
    subcategory: "Organic",
    description:
      "Nutrient-rich vermicompost made from earthworm castings. Ideal for all crops.",
    price: 320,
    discountPrice: 260,
    unit: "20 kg",
    rating: 4.8,
    stock: 70,
    image: "/products/vermicompost.jpg",
  },

  // ============================
  // PESTICIDES
  // ============================
  {
    name: "Crop Protection Solution",
    category: "Pesticides",
    subcategory: "General",
    description:
      "Broad-spectrum crop protection solution for common field pests.",
    price: 920,
    discountPrice: 799,
    unit: "1 L",
    rating: 4.5,
    stock: 25,
    image: "/products/crop-protection.jpg",
  },
  {
    name: "Neem Oil Pesticide",
    category: "Pesticides",
    subcategory: "Organic",
    description:
      "Organic neem-based pesticide effective against a wide range of sucking pests.",
    price: 540,
    discountPrice: 450,
    unit: "500 ml",
    rating: 4.7,
    stock: 55,
    image: "/products/neem-pesticide.jpg",
  },

  // ============================
  // FUNGICIDES
  // ============================
  {
    name: "Broad-Spectrum Fungicide",
    category: "Fungicides",
    subcategory: "General",
    description:
      "Effective fungicide for controlling common fungal diseases in crops.",
    price: 780,
    discountPrice: 650,
    unit: "500 ml",
    rating: 4.5,
    stock: 40,
    image: "/products/fungicide.jpg",
  },

  // ============================
  // HERBICIDES
  // ============================
  {
    name: "Selective Herbicide",
    category: "Herbicides",
    subcategory: "General",
    description:
      "Selective herbicide for effective weed management without harming crops.",
    price: 690,
    discountPrice: 590,
    unit: "1 L",
    rating: 4.4,
    stock: 35,
    image: "/products/herbicide.jpg",
  },

  // ============================
  // AGRICULTURAL TOOLS
  // ============================
  {
    name: "Hand Sprayer (5L)",
    category: "Agricultural Tools",
    subcategory: "Sprayers",
    description:
      "Durable 5-litre hand sprayer suitable for pesticides and liquid fertilizers.",
    price: 890,
    discountPrice: 750,
    unit: "1 pc",
    rating: 4.6,
    stock: 20,
    image: "/products/hand-sprayer.jpg",
  },
  {
    name: "Garden Trowel Set",
    category: "Agricultural Tools",
    subcategory: "Hand Tools",
    description:
      "Set of 3 sturdy garden trowels for planting, weeding, and soil work.",
    price: 420,
    discountPrice: 340,
    unit: "1 set",
    rating: 4.5,
    stock: 45,
    image: "/products/trowel-set.jpg",
  },
];

// Fills in the newer product fields (brand, usage notes, highlights, featured
// flag) so the detail page and admin have something meaningful to show.
const enrich = (product, index) => {
  const isSeed = product.category === "Seeds";

  product.brand = product.brand || "Kanisha Select";
  product.details =
    product.details ||
    `${product.name} is part of our ${product.subcategory} range, supplied in ${product.unit} packs and checked for quality before dispatch.`;

  product.usage =
    product.usage ||
    (isSeed
      ? "Sow at the recommended depth for your region, keep the seedbed evenly moist until germination, and apply a basal dose of fertiliser at sowing. Store in a cool, dry place away from direct sunlight."
      : "Read the label for the exact dosage and application method. Use clean equipment, apply during the cooler hours of the day, and store the container tightly sealed in a dry place.");

  product.highlights =
    product.highlights && product.highlights.length
      ? product.highlights
      : [
          `Supplied in a ${product.unit} pack`,
          isSeed ? "High germination percentage" : "Trusted quality, batch tested",
          "Suitable for Indian growing conditions",
        ];

  // Show the first eight products in the homepage "Featured" strip.
  product.isFeatured = index < 8;
  product.isActive = true;

  return product;
};

const seedDB = async () => {
  try {
    await connectDB();
    console.log("Connected to MongoDB");

    await Product.deleteMany({});
    console.log("Old products removed");

    const inserted = await Product.insertMany(products.map(enrich));
    console.log(`${inserted.length} products inserted`);

    await mongoose.connection.close();
    console.log("Connection closed. Seeding complete.");
    process.exit(0);
  } catch (error) {
    console.error("Seeding error:", error);
    process.exit(1);
  }
};

seedDB();