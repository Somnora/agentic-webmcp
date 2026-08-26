export type SnapshotMoney = {
  amount: string;
  currencyCode: string;
};

export type SnapshotVariant = {
  id: string;
  title: string;
  availableForSale: boolean;
  quantityAvailable: number | null;
  price: SnapshotMoney;
  selectedOptions: Array<{ name: string; value: string }>;
};

export type SnapshotProduct = {
  handle: string;
  title: string;
  description: string;
  vendor: string;
  productType: string;
  featuredImage: { url: string; altText: string | null } | null;
  priceRange: {
    minVariantPrice: SnapshotMoney;
    maxVariantPrice: SnapshotMoney;
  };
  variants: SnapshotVariant[];
};

const usd = (amount: string): SnapshotMoney => ({ amount, currencyCode: "USD" });

export const FALLBACK_PRODUCTS: SnapshotProduct[] = [
  {
    handle: "the-inventory-not-tracked-snowboard",
    title: "The Inventory Not Tracked Snowboard",
    description: "",
    vendor: "Agentic App Review Test",
    productType: "snowboard",
    featuredImage: {
      url: "https://cdn.shopify.com/s/files/1/0780/7500/3035/files/snowboard_purple_hydrogen.jpg?v=1787448987",
      altText: "Top and bottom view of a snowboard. The top view shows a centred hexagonal logo for Hydrogen that appears to radiate outwards, as well as some overlapping hexagons at the bottom. T",
    },
    priceRange: {
      minVariantPrice: usd("949.95"),
      maxVariantPrice: usd("949.95"),
    },
    variants: [
      {
        id: "gid://shopify/ProductVariant/49354676502683",
        title: "Default Title",
        availableForSale: false,
        quantityAvailable: 0,
        price: usd("949.95"),
        selectedOptions: [{ name: "Title", value: "Default Title" }],
      },
    ],
  },
  {
    handle: "the-compare-at-price-snowboard",
    title: "The Compare at Price Snowboard",
    description: "",
    vendor: "Agentic App Review Test",
    productType: "snowboard",
    featuredImage: {
      url: "https://cdn.shopify.com/s/files/1/0780/7500/3035/files/snowboard_sky.jpg?v=1787448987",
      altText: "Top and bottom view of a snowboard. The top view shows pixelated clouds, with the top-most one being the shape of the Shopify bag logo. The bottom view has a pixelated cloudy sky w",
    },
    priceRange: {
      minVariantPrice: usd("785.95"),
      maxVariantPrice: usd("785.95"),
    },
    variants: [
      {
        id: "gid://shopify/ProductVariant/49354676600987",
        title: "Default Title",
        availableForSale: true,
        quantityAvailable: 10,
        price: usd("785.95"),
        selectedOptions: [{ name: "Title", value: "Default Title" }],
      },
    ],
  },
  {
    handle: "the-hidden-snowboard",
    title: "The Hidden Snowboard",
    description: "",
    vendor: "Snowboard Vendor",
    productType: "snowboard",
    featuredImage: {
      url: "https://cdn.shopify.com/s/files/1/0780/7500/3035/files/Main_c8ff0b5d-c712-429a-be00-b29bd55cbc9d.jpg?v=1787448987",
      altText: "The top view and bottom view of a snowboard. The top view is black with a singular peach cube. The bottom view has a graphic of a stack of blocks in a gradient from light blue, to ",
    },
    priceRange: {
      minVariantPrice: usd("749.95"),
      maxVariantPrice: usd("749.95"),
    },
    variants: [
      {
        id: "gid://shopify/ProductVariant/49354676109467",
        title: "Default Title",
        availableForSale: true,
        quantityAvailable: 50,
        price: usd("749.95"),
        selectedOptions: [{ name: "Title", value: "Default Title" }],
      },
    ],
  },
  {
    handle: "the-minimal-snowboard",
    title: "The Minimal Snowboard",
    description: "",
    vendor: "Agentic App Review Test",
    productType: "snowboard",
    featuredImage: null,
    priceRange: {
      minVariantPrice: usd("885.95"),
      maxVariantPrice: usd("885.95"),
    },
    variants: [
      {
        id: "gid://shopify/ProductVariant/49354675880091",
        title: "Default Title",
        availableForSale: true,
        quantityAvailable: 50,
        price: usd("885.95"),
        selectedOptions: [{ name: "Title", value: "Default Title" }],
      },
    ],
  },
  {
    handle: "selling-plans-ski-wax",
    title: "Selling Plans Ski Wax",
    description: "",
    vendor: "Agentic App Review Test",
    productType: "accessories",
    featuredImage: {
      url: "https://cdn.shopify.com/s/files/1/0780/7500/3035/files/snowboard_wax.jpg?v=1787448987",
      altText: "A bar of golden yellow wax",
    },
    priceRange: {
      minVariantPrice: usd("9.95"),
      maxVariantPrice: usd("49.95"),
    },
    variants: [
      {
        id: "gid://shopify/ProductVariant/49354676142235",
        title: "Selling Plans Ski Wax",
        availableForSale: true,
        quantityAvailable: 10,
        price: usd("24.95"),
        selectedOptions: [{ name: "Color", value: "Selling Plans Ski Wax" }],
      },
      {
        id: "gid://shopify/ProductVariant/49354676175003",
        title: "Special Selling Plans Ski Wax",
        availableForSale: true,
        quantityAvailable: 10,
        price: usd("49.95"),
        selectedOptions: [{ name: "Color", value: "Special Selling Plans Ski Wax" }],
      },
      {
        id: "gid://shopify/ProductVariant/49354676207771",
        title: "Sample Selling Plans Ski Wax",
        availableForSale: true,
        quantityAvailable: 10,
        price: usd("9.95"),
        selectedOptions: [{ name: "Color", value: "Sample Selling Plans Ski Wax" }],
      },
    ],
  },
  {
    handle: "the-out-of-stock-snowboard",
    title: "The Out of Stock Snowboard",
    description: "",
    vendor: "Agentic App Review Test",
    productType: "snowboard",
    featuredImage: {
      url: "https://cdn.shopify.com/s/files/1/0780/7500/3035/files/Main_f44a9605-cd62-464d-b095-d45cdaa0d0d7.jpg?v=1787448987",
      altText: "Top and bottom view of a snowboard. The top view shows a toggle at the top in shades of blue and yellow. The bottom view shows an abstract illustration of toggles in blues and yell",
    },
    priceRange: {
      minVariantPrice: usd("885.95"),
      maxVariantPrice: usd("885.95"),
    },
    variants: [
      {
        id: "gid://shopify/ProductVariant/49354675847323",
        title: "Default Title",
        availableForSale: false,
        quantityAvailable: 0,
        price: usd("885.95"),
        selectedOptions: [{ name: "Title", value: "Default Title" }],
      },
    ],
  },
  {
    handle: "the-collection-snowboard-hydrogen",
    title: "The Collection Snowboard: Hydrogen",
    description: "",
    vendor: "Hydrogen Vendor",
    productType: "snowboard",
    featuredImage: {
      url: "https://cdn.shopify.com/s/files/1/0780/7500/3035/files/Main_0a40b01b-5021-48c1-80d1-aa8ab4876d3d.jpg?v=1787448987",
      altText: "Top and bottom view of a snowboard. The top view shows stylized hydrogen bonds and the bottom view shows \"H2\" in a brush script typeface.",
    },
    priceRange: {
      minVariantPrice: usd("600.00"),
      maxVariantPrice: usd("600.00"),
    },
    variants: [
      {
        id: "gid://shopify/ProductVariant/49354676240539",
        title: "Default Title",
        availableForSale: true,
        quantityAvailable: 50,
        price: usd("600.00"),
        selectedOptions: [{ name: "Title", value: "Default Title" }],
      },
    ],
  },
  {
    handle: "the-videographer-snowboard",
    title: "The Videographer Snowboard",
    description: "",
    vendor: "Agentic App Review Test",
    productType: "snowboard",
    featuredImage: {
      url: "https://cdn.shopify.com/s/files/1/0780/7500/3035/files/Main.jpg?v=1787448987",
      altText: "The top and bottom view of a snowboard. The top has view is turquoise and black with graphics of trees. The bottom view is turquoise with the word hydrogen written in cursive.",
    },
    priceRange: {
      minVariantPrice: usd("885.95"),
      maxVariantPrice: usd("885.95"),
    },
    variants: [
      {
        id: "gid://shopify/ProductVariant/49354676043931",
        title: "Default Title",
        availableForSale: true,
        quantityAvailable: 50,
        price: usd("885.95"),
        selectedOptions: [{ name: "Title", value: "Default Title" }],
      },
    ],
  },
  {
    handle: "the-complete-snowboard",
    title: "The Complete Snowboard",
    description: "This PREMIUM snowboard is so SUPERDUPER awesome!",
    vendor: "Snowboard Vendor",
    productType: "snowboard",
    featuredImage: {
      url: "https://cdn.shopify.com/s/files/1/0780/7500/3035/files/Main_589fc064-24a2-4236-9eaf-13b2bd35d21d.jpg?v=1787448987",
      altText: "Top and bottom view of a snowboard. The top view shows abstract circles and lines in shades of teal. The bottom view shows abstract circles and lines in shades of purple and blue w",
    },
    priceRange: {
      minVariantPrice: usd("699.95"),
      maxVariantPrice: usd("700.95"),
    },
    variants: [
      {
        id: "gid://shopify/ProductVariant/49354676273307",
        title: "Ice",
        availableForSale: true,
        quantityAvailable: 10,
        price: usd("700.95"),
        selectedOptions: [{ name: "Color", value: "Ice" }],
      },
      {
        id: "gid://shopify/ProductVariant/49354676306075",
        title: "Dawn",
        availableForSale: true,
        quantityAvailable: 10,
        price: usd("699.95"),
        selectedOptions: [{ name: "Color", value: "Dawn" }],
      },
      {
        id: "gid://shopify/ProductVariant/49354676338843",
        title: "Powder",
        availableForSale: true,
        quantityAvailable: 10,
        price: usd("699.95"),
        selectedOptions: [{ name: "Color", value: "Powder" }],
      },
      {
        id: "gid://shopify/ProductVariant/49354676371611",
        title: "Electric",
        availableForSale: true,
        quantityAvailable: 10,
        price: usd("699.95"),
        selectedOptions: [{ name: "Color", value: "Electric" }],
      },
      {
        id: "gid://shopify/ProductVariant/49354676404379",
        title: "Sunset",
        availableForSale: true,
        quantityAvailable: 10,
        price: usd("699.95"),
        selectedOptions: [{ name: "Color", value: "Sunset" }],
      },
    ],
  },
  {
    handle: "the-multi-location-snowboard",
    title: "The Multi-location Snowboard",
    description: "",
    vendor: "Agentic App Review Test",
    productType: "snowboard",
    featuredImage: {
      url: "https://cdn.shopify.com/s/files/1/0780/7500/3035/files/Main_0a4e9096-021a-4c1e-8750-24b233166a12.jpg?v=1787448988",
      altText: "Top and bottom view of a snowboard. The top view shows a pixelated Shopify bag logo and a pixelated character reviewing a clipboard with a questioning expression with a bright gree",
    },
    priceRange: {
      minVariantPrice: usd("729.95"),
      maxVariantPrice: usd("729.95"),
    },
    variants: [
      {
        id: "gid://shopify/ProductVariant/49354676764827",
        title: "Default Title",
        availableForSale: true,
        quantityAvailable: 100,
        price: usd("729.95"),
        selectedOptions: [{ name: "Title", value: "Default Title" }],
      },
    ],
  },
  {
    handle: "the-3p-fulfilled-snowboard",
    title: "The 3p Fulfilled Snowboard",
    description: "",
    vendor: "Agentic App Review Test",
    productType: "snowboard",
    featuredImage: {
      url: "https://cdn.shopify.com/s/files/1/0780/7500/3035/files/Main_b9e0da7f-db89-4d41-83f0-7f417b02831d.jpg?v=1787448988",
      altText: "Top and bottom view of a snowboard. The top view shows 7 stacked hexagons and the bottom view shows a small, centred hexagonal logo for Hydrogen.",
    },
    priceRange: {
      minVariantPrice: usd("2629.95"),
      maxVariantPrice: usd("2629.95"),
    },
    variants: [
      {
        id: "gid://shopify/ProductVariant/49354676797595",
        title: "Default Title",
        availableForSale: true,
        quantityAvailable: 20,
        price: usd("2629.95"),
        selectedOptions: [{ name: "Title", value: "Default Title" }],
      },
    ],
  },
  {
    handle: "the-multi-managed-snowboard",
    title: "The Multi-managed Snowboard",
    description: "",
    vendor: "Multi-managed Vendor",
    productType: "snowboard",
    featuredImage: {
      url: "https://cdn.shopify.com/s/files/1/0780/7500/3035/files/Main_9129b69a-0c7b-4f66-b6cf-c4222f18028a.jpg?v=1787448988",
      altText: "Top and bottom view of a snowboard. The top view shows an illustration with varied outlined shapes in black. The bottom view shows a black box character with an H pointing, and sur",
    },
    priceRange: {
      minVariantPrice: usd("629.95"),
      maxVariantPrice: usd("629.95"),
    },
    variants: [
      {
        id: "gid://shopify/ProductVariant/49354676863131",
        title: "Default Title",
        availableForSale: true,
        quantityAvailable: 100,
        price: usd("629.95"),
        selectedOptions: [{ name: "Title", value: "Default Title" }],
      },
    ],
  },
  {
    handle: "the-collection-snowboard-oxygen",
    title: "The Collection Snowboard: Oxygen",
    description: "",
    vendor: "Hydrogen Vendor",
    productType: "snowboard",
    featuredImage: {
      url: "https://cdn.shopify.com/s/files/1/0780/7500/3035/files/Main_d624f226-0a89-4fe1-b333-0d1548b43c06.jpg?v=1787448988",
      altText: "Top and bottom view of a snowboard. The top view shows a stylized scene of trees, mountains, sky and a sun in red colours. The bottom view has blue wavy lines in the background wit",
    },
    priceRange: {
      minVariantPrice: usd("1025.00"),
      maxVariantPrice: usd("1025.00"),
    },
    variants: [
      {
        id: "gid://shopify/ProductVariant/49354676830363",
        title: "Default Title",
        availableForSale: true,
        quantityAvailable: 50,
        price: usd("1025.00"),
        selectedOptions: [{ name: "Title", value: "Default Title" }],
      },
    ],
  },
  {
    handle: "the-collection-snowboard-liquid",
    title: "The Collection Snowboard: Liquid",
    description: "",
    vendor: "Hydrogen Vendor",
    productType: "snowboard",
    featuredImage: {
      url: "https://cdn.shopify.com/s/files/1/0780/7500/3035/files/Main_b13ad453-477c-4ed1-9b43-81f3345adfd6.jpg?v=1787448990",
      altText: "Top and bottom view of a snowboard. The top view shows a stylized scene of water, trees, mountains, sky and a moon in blue colours. The bottom view has a blue liquid, drippy backgr",
    },
    priceRange: {
      minVariantPrice: usd("749.95"),
      maxVariantPrice: usd("749.95"),
    },
    variants: [
      {
        id: "gid://shopify/ProductVariant/49354676961435",
        title: "Default Title",
        availableForSale: true,
        quantityAvailable: 50,
        price: usd("749.95"),
        selectedOptions: [{ name: "Title", value: "Default Title" }],
      },
    ],
  },
];
