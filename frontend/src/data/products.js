import {
  Wheat,
  Sprout,
  FlaskConical,
  Bug,
  Leaf,
  Shovel,
  SprayCan,
  Scissors,
} from "lucide-react";

/**
 * Category tiles for the homepage.
 *
 * These are presentation only — the real category list (with live product
 * counts) is fetched from GET /api/products/categories so the homepage always
 * matches what's actually in the database.
 *
 * This list is the fallback if that request fails, and the icon source.
 */
export const categories = [
  {
    id: 1,
    name: "Seeds",
    description: "Paddy, wheat, vegetable and fruit seeds for every season",
    icon: Sprout,
  },
  {
    id: 2,
    name: "Fertilizers",
    description: "Organic and chemical nutrition for stronger crops",
    icon: FlaskConical,
  },
  {
    id: 3,
    name: "Pesticides",
    description: "Crop protection, organic and conventional",
    icon: Bug,
  },
  {
    id: 4,
    name: "Insecticides",
    description: "Targeted control for harmful insects",
    icon: Bug,
  },
  {
    id: 5,
    name: "Fungicides",
    description: "Protect against fungal disease and blight",
    icon: Leaf,
  },
  {
    id: 6,
    name: "Herbicides",
    description: "Effective weed management",
    icon: Wheat,
  },
  {
    id: 7,
    name: "Agricultural Tools",
    description: "Sprayers and hand tools built to last",
    icon: Shovel,
  },
];

/** Icon lookup by category name, used by the products page sidebar. */
export const categoryIcons = {
  Seeds: Sprout,
  Fertilizers: FlaskConical,
  Pesticides: Bug,
  Insecticides: Bug,
  Fungicides: Leaf,
  Herbicides: Wheat,
  "Agricultural Tools": Shovel,
  Sprayers: SprayCan,
  "Hand Tools": Scissors,
};

export const getCategoryIcon = (name) => categoryIcons[name] ?? Sprout;
