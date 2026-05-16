export type ClimateZone = "tropical" | "arid" | "temperate" | "continental" | "mediterranean";
export type WeightUnit = "gram" | "kilogram" | "metric_ton";
export type TargetMarket = "local" | "regional" | "international";

export interface Country {
  code: string;
  name: string;
  flag: string;
  currency: string;
  currencySymbol: string;
  currencyName: string;
  usdRate: number;
  climate: ClimateZone;
  commonCrops: string[];
  region: string;
}

export const COUNTRIES: Country[] = [
  { code: "KE", name: "Kenya", flag: "🇰🇪", currency: "KES", currencySymbol: "KSh", currencyName: "Kenyan Shilling", usdRate: 130, climate: "tropical", commonCrops: ["Maize", "Tea", "Coffee", "Beans", "Wheat"], region: "East Africa" },
  { code: "NG", name: "Nigeria", flag: "🇳🇬", currency: "NGN", currencySymbol: "₦", currencyName: "Nigerian Naira", usdRate: 1600, climate: "tropical", commonCrops: ["Cassava", "Maize", "Sorghum", "Yam", "Rice"], region: "West Africa" },
  { code: "GH", name: "Ghana", flag: "🇬🇭", currency: "GHS", currencySymbol: "₵", currencyName: "Ghanaian Cedi", usdRate: 15, climate: "tropical", commonCrops: ["Cocoa", "Maize", "Cassava", "Plantain", "Rice"], region: "West Africa" },
  { code: "ET", name: "Ethiopia", flag: "🇪🇹", currency: "ETB", currencySymbol: "Br", currencyName: "Ethiopian Birr", usdRate: 115, climate: "tropical", commonCrops: ["Coffee", "Teff", "Wheat", "Maize", "Sorghum"], region: "East Africa" },
  { code: "ZA", name: "South Africa", flag: "🇿🇦", currency: "ZAR", currencySymbol: "R", currencyName: "South African Rand", usdRate: 19, climate: "temperate", commonCrops: ["Maize", "Wheat", "Sugarcane", "Citrus", "Grapes"], region: "Southern Africa" },
  { code: "TZ", name: "Tanzania", flag: "🇹🇿", currency: "TZS", currencySymbol: "TSh", currencyName: "Tanzanian Shilling", usdRate: 2600, climate: "tropical", commonCrops: ["Maize", "Rice", "Coffee", "Sisal", "Cotton"], region: "East Africa" },
  { code: "UG", name: "Uganda", flag: "🇺🇬", currency: "UGX", currencySymbol: "USh", currencyName: "Ugandan Shilling", usdRate: 3800, climate: "tropical", commonCrops: ["Coffee", "Bananas", "Maize", "Beans", "Tea"], region: "East Africa" },
  { code: "EG", name: "Egypt", flag: "🇪🇬", currency: "EGP", currencySymbol: "E£", currencyName: "Egyptian Pound", usdRate: 50, climate: "arid", commonCrops: ["Wheat", "Cotton", "Rice", "Sugarcane", "Maize"], region: "North Africa" },
  { code: "MA", name: "Morocco", flag: "🇲🇦", currency: "MAD", currencySymbol: "د.م.", currencyName: "Moroccan Dirham", usdRate: 10, climate: "mediterranean", commonCrops: ["Wheat", "Barley", "Olives", "Citrus", "Tomatoes"], region: "North Africa" },
  { code: "IN", name: "India", flag: "🇮🇳", currency: "INR", currencySymbol: "₹", currencyName: "Indian Rupee", usdRate: 84, climate: "tropical", commonCrops: ["Rice", "Wheat", "Cotton", "Sugarcane", "Tea"], region: "South Asia" },
  { code: "PK", name: "Pakistan", flag: "🇵🇰", currency: "PKR", currencySymbol: "Rs", currencyName: "Pakistani Rupee", usdRate: 280, climate: "arid", commonCrops: ["Wheat", "Rice", "Cotton", "Sugarcane", "Maize"], region: "South Asia" },
  { code: "BD", name: "Bangladesh", flag: "🇧🇩", currency: "BDT", currencySymbol: "৳", currencyName: "Bangladeshi Taka", usdRate: 110, climate: "tropical", commonCrops: ["Rice", "Jute", "Wheat", "Tea", "Potatoes"], region: "South Asia" },
  { code: "ID", name: "Indonesia", flag: "🇮🇩", currency: "IDR", currencySymbol: "Rp", currencyName: "Indonesian Rupiah", usdRate: 16000, climate: "tropical", commonCrops: ["Rice", "Palm Oil", "Rubber", "Coffee", "Cocoa"], region: "Southeast Asia" },
  { code: "PH", name: "Philippines", flag: "🇵🇭", currency: "PHP", currencySymbol: "₱", currencyName: "Philippine Peso", usdRate: 58, climate: "tropical", commonCrops: ["Rice", "Coconut", "Sugarcane", "Corn", "Bananas"], region: "Southeast Asia" },
  { code: "TH", name: "Thailand", flag: "🇹🇭", currency: "THB", currencySymbol: "฿", currencyName: "Thai Baht", usdRate: 35, climate: "tropical", commonCrops: ["Rice", "Rubber", "Cassava", "Sugarcane", "Maize"], region: "Southeast Asia" },
  { code: "VN", name: "Vietnam", flag: "🇻🇳", currency: "VND", currencySymbol: "₫", currencyName: "Vietnamese Dong", usdRate: 25000, climate: "tropical", commonCrops: ["Rice", "Coffee", "Tea", "Rubber", "Sugarcane"], region: "Southeast Asia" },
  { code: "CN", name: "China", flag: "🇨🇳", currency: "CNY", currencySymbol: "¥", currencyName: "Chinese Yuan", usdRate: 7.3, climate: "temperate", commonCrops: ["Rice", "Wheat", "Maize", "Soybeans", "Cotton"], region: "East Asia" },
  { code: "BR", name: "Brazil", flag: "🇧🇷", currency: "BRL", currencySymbol: "R$", currencyName: "Brazilian Real", usdRate: 5, climate: "tropical", commonCrops: ["Soybeans", "Sugarcane", "Maize", "Coffee", "Cotton"], region: "South America" },
  { code: "AR", name: "Argentina", flag: "🇦🇷", currency: "ARS", currencySymbol: "AR$", currencyName: "Argentine Peso", usdRate: 1000, climate: "temperate", commonCrops: ["Soybeans", "Wheat", "Maize", "Sunflower", "Barley"], region: "South America" },
  { code: "MX", name: "Mexico", flag: "🇲🇽", currency: "MXN", currencySymbol: "MX$", currencyName: "Mexican Peso", usdRate: 17, climate: "tropical", commonCrops: ["Maize", "Beans", "Sorghum", "Wheat", "Avocado"], region: "North America" },
  { code: "CO", name: "Colombia", flag: "🇨🇴", currency: "COP", currencySymbol: "COP$", currencyName: "Colombian Peso", usdRate: 4000, climate: "tropical", commonCrops: ["Coffee", "Flowers", "Bananas", "Sugarcane", "Rice"], region: "South America" },
  { code: "US", name: "United States", flag: "🇺🇸", currency: "USD", currencySymbol: "$", currencyName: "US Dollar", usdRate: 1, climate: "temperate", commonCrops: ["Maize", "Soybeans", "Wheat", "Cotton", "Rice"], region: "North America" },
  { code: "CA", name: "Canada", flag: "🇨🇦", currency: "CAD", currencySymbol: "CA$", currencyName: "Canadian Dollar", usdRate: 1.37, climate: "continental", commonCrops: ["Wheat", "Canola", "Barley", "Soybeans", "Maize"], region: "North America" },
  { code: "AU", name: "Australia", flag: "🇦🇺", currency: "AUD", currencySymbol: "A$", currencyName: "Australian Dollar", usdRate: 1.55, climate: "arid", commonCrops: ["Wheat", "Barley", "Sugarcane", "Cotton", "Canola"], region: "Oceania" },
  { code: "FR", name: "France", flag: "🇫🇷", currency: "EUR", currencySymbol: "€", currencyName: "Euro", usdRate: 0.92, climate: "temperate", commonCrops: ["Wheat", "Barley", "Sugar Beet", "Grapes", "Sunflower"], region: "Europe" },
  { code: "DE", name: "Germany", flag: "🇩🇪", currency: "EUR", currencySymbol: "€", currencyName: "Euro", usdRate: 0.92, climate: "temperate", commonCrops: ["Wheat", "Barley", "Sugar Beet", "Potatoes", "Rapeseed"], region: "Europe" },
  { code: "GB", name: "United Kingdom", flag: "🇬🇧", currency: "GBP", currencySymbol: "£", currencyName: "British Pound", usdRate: 0.79, climate: "temperate", commonCrops: ["Wheat", "Barley", "Potatoes", "Oil Seed Rape", "Sugar Beet"], region: "Europe" },
  { code: "UA", name: "Ukraine", flag: "🇺🇦", currency: "UAH", currencySymbol: "₴", currencyName: "Ukrainian Hryvnia", usdRate: 42, climate: "continental", commonCrops: ["Wheat", "Maize", "Sunflower", "Soybeans", "Barley"], region: "Europe" },
  { code: "RU", name: "Russia", flag: "🇷🇺", currency: "RUB", currencySymbol: "₽", currencyName: "Russian Ruble", usdRate: 90, climate: "continental", commonCrops: ["Wheat", "Barley", "Sunflower", "Soybeans", "Sugar Beet"], region: "Europe" },
  { code: "RW", name: "Rwanda", flag: "🇷🇼", currency: "RWF", currencySymbol: "RF", currencyName: "Rwandan Franc", usdRate: 1300, climate: "tropical", commonCrops: ["Coffee", "Tea", "Bananas", "Beans", "Sorghum"], region: "East Africa" },
  { code: "ZM", name: "Zambia", flag: "🇿🇲", currency: "ZMW", currencySymbol: "ZK", currencyName: "Zambian Kwacha", usdRate: 27, climate: "tropical", commonCrops: ["Maize", "Tobacco", "Cotton", "Soybeans", "Wheat"], region: "Southern Africa" },
  { code: "MW", name: "Malawi", flag: "🇲🇼", currency: "MWK", currencySymbol: "MK", currencyName: "Malawian Kwacha", usdRate: 1730, climate: "tropical", commonCrops: ["Maize", "Tobacco", "Tea", "Sugarcane", "Groundnuts"], region: "Southern Africa" },
];

export const CROP_OPTIONS = [
  { name: "Maize", emoji: "🌽", category: "Cereals" },
  { name: "Wheat", emoji: "🌾", category: "Cereals" },
  { name: "Rice", emoji: "🍚", category: "Cereals" },
  { name: "Sorghum", emoji: "🌾", category: "Cereals" },
  { name: "Millet", emoji: "🌾", category: "Cereals" },
  { name: "Beans", emoji: "🫘", category: "Legumes" },
  { name: "Soybeans", emoji: "🫘", category: "Legumes" },
  { name: "Groundnuts", emoji: "🥜", category: "Legumes" },
  { name: "Tomatoes", emoji: "🍅", category: "Vegetables" },
  { name: "Onions", emoji: "🧅", category: "Vegetables" },
  { name: "Potatoes", emoji: "🥔", category: "Vegetables" },
  { name: "Kale", emoji: "🥬", category: "Vegetables" },
  { name: "Cabbage", emoji: "🥬", category: "Vegetables" },
  { name: "Spinach", emoji: "🥬", category: "Vegetables" },
  { name: "Avocado", emoji: "🥑", category: "Fruits" },
  { name: "Bananas", emoji: "🍌", category: "Fruits" },
  { name: "Mangoes", emoji: "🥭", category: "Fruits" },
  { name: "Citrus", emoji: "🍊", category: "Fruits" },
  { name: "Coffee", emoji: "☕", category: "Cash Crops" },
  { name: "Tea", emoji: "🍵", category: "Cash Crops" },
  { name: "Cotton", emoji: "🪤", category: "Cash Crops" },
  { name: "Sugarcane", emoji: "🎋", category: "Cash Crops" },
  { name: "Sunflower", emoji: "🌻", category: "Cash Crops" },
  { name: "Tobacco", emoji: "🌿", category: "Cash Crops" },
];

export const WEIGHT_UNIT_LABELS: Record<WeightUnit, string> = {
  gram: "per gram",
  kilogram: "per kg",
  metric_ton: "per metric ton",
};

export const WEIGHT_UNIT_SHORT: Record<WeightUnit, string> = {
  gram: "g",
  kilogram: "kg",
  metric_ton: "MT",
};

export function convertFromTon(pricePerTon: number, unit: WeightUnit): number {
  switch (unit) {
    case "gram": return pricePerTon / 1_000_000;
    case "kilogram": return pricePerTon / 1_000;
    case "metric_ton": return pricePerTon;
  }
}

export function convertCurrency(usdAmount: number, toCurrency: string): number {
  const country = COUNTRIES.find(c => c.currency === toCurrency);
  if (!country) return usdAmount;
  return usdAmount * country.usdRate;
}

export function getCountryByCode(code: string): Country | undefined {
  return COUNTRIES.find(c => c.code === code);
}

export function getCurrencySymbol(currency: string): string {
  const country = COUNTRIES.find(c => c.currency === currency);
  return country?.currencySymbol ?? currency;
}
