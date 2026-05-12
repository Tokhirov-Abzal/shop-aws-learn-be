export type Product = {
  id: string;
  title: string;
  description: string;
  price: number;
};

export type Stock = {
  product_id: string;
  count: number;
};

export type ProductWithStock = Product & {
  count: number;
};

export const products: Product[] = [
  {
    id: "f9af7d5a-0f58-4d77-a8f9-2d8f9b4c4c01",
    title: "Laptop",
    price: 999,
    description: "High-performance laptop for professionals",
  },
  {
    id: "f9af7d5a-0f58-4d77-a8f9-2d8f9b4c4c02",
    title: "Wireless Mouse",
    price: 29,
    description: "Ergonomic wireless mouse with long battery life",
  },
  {
    id: "f9af7d5a-0f58-4d77-a8f9-2d8f9b4c4c03",
    title: "USB-C Hub",
    price: 59,
    description: "Multi-port USB-C hub for connectivity",
  },
  {
    id: "f9af7d5a-0f58-4d77-a8f9-2d8f9b4c4c04",
    title: "Mechanical Keyboard",
    price: 149,
    description: "RGB mechanical keyboard with custom switches",
  },
  {
    id: "f9af7d5a-0f58-4d77-a8f9-2d8f9b4c4c05",
    title: "4K Monitor",
    price: 399,
    description: "Ultra HD 4K monitor for content creation",
  },
];

export const stocks: Stock[] = [
  {
    product_id: products[0].id,
    count: 7,
  },
  {
    product_id: products[1].id,
    count: 18,
  },
  {
    product_id: products[2].id,
    count: 11,
  },
  {
    product_id: products[3].id,
    count: 4,
  },
  {
    product_id: products[4].id,
    count: 9,
  },
];
