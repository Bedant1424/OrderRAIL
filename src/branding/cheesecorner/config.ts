// Cheese Corner Brand Configuration & Constants

import logoImg from "/branding/cheesecorner/assets/logo/logo.png";
import posterBurger from "/branding/cheesecorner/assets/posters/poster-burger.jpg";
import posterFries from "/branding/cheesecorner/assets/posters/poster-fries.jpg";
import posterMojito from "/branding/cheesecorner/assets/posters/poster-mojito.jpg";
import qrStandImg from "/branding/cheesecorner/assets/qr/qr-stand.png";

export const CHEESE_CORNER_CONFIG = {
  name: "Cheese Corner",
  tagline: "Where Every Slice & Bite is Packed with Melted Goodness!",
  subtitle: "Savor artisanal pizzas, juicy burgers, loaded fries, creamy shakes, and refreshing mojitos crafted fresh daily.",
  
  logoUrl: logoImg,
  qrStandUrl: qrStandImg,

  posters: [
    {
      id: "poster-burger",
      title: "Sizzling Gourmet Burgers",
      subtitle: "Layered with double cheese, fresh veggies & house secret sauce",
      image: posterBurger,
      tag: "Chef's Special"
    },
    {
      id: "poster-fries",
      title: "Crispy Loaded Cheese Fries",
      subtitle: "Golden crinkles tossed in piri piri & drenched in warm cheddar",
      image: posterFries,
      tag: "Best Seller"
    },
    {
      id: "poster-mojito",
      title: "Handcrafted Cool Mojitos",
      subtitle: "Refreshing mint, zesty lime & exotic fruit infusions",
      image: posterMojito,
      tag: "Coolers & Shakes"
    }
  ],

  about: {
    title: "Crafting Comfort Food with Cheesy Perfection",
    description: "Welcome to Cheese Corner — your local haven for indulgent street-style comfort food with a gourmet twist. From overflowing cheesy pizzas and thick double-patty burgers to comforting hot Maggi and signature cold coolers, we craft every dish using premium ingredients and lots of love.",
    highlights: [
      { name: "Pizzas", icon: "🍕", count: "12+ Varieties", desc: "Fresh dough, rich mozzarella & artisanal toppings" },
      { name: "Burgers", icon: "🍔", count: "8+ Favorites", desc: "Toasted brioche buns, double cheese & crunchy patties" },
      { name: "Maggi", icon: "🍜", count: "8+ Styles", desc: "Cheesy, spicy, soupy & sizzling fusion noodles" },
      { name: "Shakes", icon: "🥤", count: "10+ Flavors", desc: "Thick, indulgent, topped with ice cream & treats" },
      { name: "Mojitos", icon: "🍹", count: "8+ Coolers", desc: "Zesty lime, fresh mint & fruit splash mocktails" }
    ]
  },

  categories: [
    { id: "pizza", name: "Pizza", icon: "🍕", count: "12 Items", badge: "POPULAR", desc: "Hand-tossed crusts with melted mozzarella" },
    { id: "burger", name: "Burger", icon: "🍔", count: "8 Items", badge: "BEST SELLER", desc: "Juicy patties packed with melting cheese" },
    { id: "french-fries", name: "Fries", icon: "🍟", count: "6 Items", badge: "MUST TRY", desc: "Crispy golden crinkles with cheesy dips" },
    { id: "maggi", name: "Maggi", icon: "🍜", count: "8 Items", badge: "HOUSE SPECIAL", desc: "Cheesy & spicy noodle comfort bowls" },
    { id: "pasta", name: "Pasta", icon: "🍝", count: "5 Items", badge: "DELICIOUS", desc: "Creamy Alfredo & rich Arrabbiata sauces" },
    { id: "sandwich", name: "Sandwich", icon: "🥪", count: "7 Items", badge: "GRILLED", desc: "Triple decker toasted cheese delights" },
    { id: "wrap", name: "Wrap", icon: "🌯", count: "5 Items", badge: "CRUNCHY", desc: "Soft tortillas stuffed with savory paneer" },
    { id: "mojito", name: "Mojito", icon: "🍹", count: "8 Items", badge: "REFRESHING", desc: "Chilled coolers infused with mint & fruit" },
    { id: "shake", name: "Shake", icon: "🥤", count: "10 Items", badge: "THICK", desc: "Rich thickshakes with premium ice cream" },
    { id: "dessert", name: "Dessert", icon: "🍨", count: "6 Items", badge: "SWEET", desc: "Sizzling brownies, sundaes & cold coco" }
  ],

  contact: {
    address: "Cheese Corner Café, Shop #4, University Road, Near City Center",
    phone: "+91 98765 43210",
    instagram: "@cheesecorner.cafe",
    hours: "Open Daily: 11:00 AM – 11:00 PM",
    googleMapsUrl: "https://maps.google.com"
  }
};
