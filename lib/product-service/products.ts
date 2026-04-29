export type Product = {
  id: string;
  title: string;
  description: string;
  price: number;
};

export const products: Product[] = [
  {
    id: "1",
    title: "Laptop",
    price: 999.99,
    description: "High-performance laptop for professionals",
  },
  {
    id: "2",
    title: "Wireless Mouse",
    price: 29.99,
    description: "Ergonomic wireless mouse with long battery life",
  },
  {
    id: "3",
    title: "USB-C Hub",
    price: 59.99,
    description: "Multi-port USB-C hub for connectivity",
  },
  {
    id: "4",
    title: "Mechanical Keyboard",
    price: 149.99,
    description: "RGB mechanical keyboard with custom switches",
  },
  {
    id: "5",
    title: "4K Monitor",
    price: 399.99,
    description: "Ultra HD 4K monitor for content creation",
  },
];
