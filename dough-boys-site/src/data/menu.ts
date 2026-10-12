/* The menu, exactly as printed at the kiosk. Prices are in pounds; 0 means free. */

export interface MenuItem { name: string; price: number; desc?: string }
export interface MenuGroup { title?: string; note?: string; items: MenuItem[]; tight?: boolean }
export interface MenuSection { id: string; title: string; groups: MenuGroup[]; extra?: { name: string; note: string; price: number } }

export const menu: MenuSection[] = [
  {
    id: 'pizza',
    title: 'Pizza',
    groups: [{
      items: [
        { name: 'Margherita', price: 12, desc: 'Triple Cheese, Extra Virgin Olive Oil, Herbs' },
        { name: 'Double Pepperoni', price: 14, desc: 'Pepperoni (lots), Herbs, Grana Padano' },
        { name: 'Hot Meat', price: 15, desc: 'Sausage Meat, Chorizo, Jalapeños, Chilli Oil, Grana Padano' },
        { name: 'Bacon', price: 14, desc: 'Pancetta, Goat Cheese, Caramelised Red Onions, Garlic Oil, Grana Padano' },
        { name: 'Hawaiian', price: 14, desc: 'Ham, Pineapple, Crispy Bacon, Basil, Grana Padano' },
        { name: 'Sweet & Spicy', price: 15, desc: '’Nduja, Burrata, Hot Honey, Basil, Grana Padano' },
        { name: 'Pulled Pork', price: 15, desc: 'BBQ Base, BBQ Pulled Pork, Spring Onions, Crispy Onions, Herbs, Grana Padano' },
        { name: 'Chicken Kievs', price: 15, desc: 'Garlic Base, Crispy Chicken, Marinara, Spring Onions, Grana Padano' },
        { name: 'Veggie Supreme', price: 13, desc: 'Mixed peppers, red onion, sweetcorn and mushrooms' },
      ],
    }],
    extra: { name: 'Extra toppings', note: 'Add anything', price: 2 },
  },
  {
    id: 'sides',
    title: 'Sides',
    groups: [{
      items: [
        { name: 'Garlic Bread', price: 7, desc: 'Garlic Butter, Herbs' },
        { name: 'Cheesy Garlic Bread', price: 8, desc: 'Mozzarella, Garlic Butter, Herbs' },
        { name: 'Mac & Cheese', price: 7, desc: 'Creamy Cheese Sauce, Topped with Crispy Breadcrumbs' },
      ],
    }],
  },
  {
    id: 'desserts',
    title: 'Desserts',
    groups: [
      {
        title: 'Dessert Pizzas 9″',
        note: 'Same Dough, Topped Differently',
        tight: true,
        items: [
          { name: 'Milk Chocolate Pistachio', price: 8 },
          { name: 'Nutella Banana', price: 8 },
          { name: 'Biscoff White Chocolate', price: 8 },
          { name: 'Strawberry & White Chocolate', price: 8 },
          { name: 'Cookies & Cream', price: 8 },
        ],
      },
      { items: [{ name: 'Doce de Bolacha', price: 5, desc: 'Crushed Maria biscuit, double cream, condensed milk' }] },
    ],
  },
  {
    id: 'dips',
    title: 'Dips',
    groups: [{
      tight: true,
      items: [
        { name: 'BBQ', price: 2 },
        { name: 'Aioli', price: 2 },
        { name: 'Mayo', price: 2 },
        { name: 'Garlic & Herb', price: 2 },
        { name: 'Hot Honey', price: 2 },
        { name: 'Chilli Crisp Mayo', price: 2 },
        { name: 'Pesto Mayo', price: 2 },
        { name: 'Garlic, Chilli or Truffle Oil', price: 0, desc: 'Extra Virgin Olive Oil' },
      ],
    }],
  },
  {
    id: 'drinks',
    title: 'Drinks',
    groups: [
      {
        title: 'Cans',
        tight: true,
        items: ['Coca-Cola', 'Diet Coke', 'Fanta', 'Sprite', 'Oasis', 'San Pellegrino'].map((name) => ({ name, price: 2 })),
      },
      {
        title: 'Water',
        tight: true,
        items: [{ name: 'Still Water', price: 1.5 }, { name: 'Sparkling Water', price: 1.5 }],
      },
    ],
  },
];

export const favourites = ['Margherita', 'Double Pepperoni', 'Hot Meat', 'Sweet & Spicy']
  .map((n) => menu[0].groups[0].items.find((i) => i.name === n)!);

export const pizzaCount = menu[0].groups[0].items.length;
export const fromPrice = Math.min(...menu[0].groups[0].items.map((i) => i.price));

/* "12" or "1.50" */
export const money = (p: number) => (Number.isInteger(p) ? String(p) : p.toFixed(2));
