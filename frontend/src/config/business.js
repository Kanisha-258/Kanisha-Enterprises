/**
 * Business details, shown in the footer, contact page and checkout.
 *
 * 👉 Edit these once here and they update everywhere on the site.
 * Leaving a field as an empty string hides that line entirely.
 */

export const business = {
  name: "Kanisha Enterprises",
  tagline: "Growing Together",

  // TODO: replace with the real numbers before going live.
  phone: "+91 98765 43210",
  whatsapp: "919876543210",
  email: "hello@kanishaenterprises.com",

  address: {
    line1: "Shop No. 12, Main Market Road",
    line2: "Near Bus Stand",
    city: "Your City",
    state: "Your State",
    pincode: "000000",
  },

  // Shown on the contact page and in the footer.
  hours: [
    { days: "Monday – Saturday", time: "8:00 AM – 8:00 PM" },
    { days: "Sunday", time: "9:00 AM – 1:00 PM" },
  ],

  social: {
    // Add real profile URLs, or leave blank to hide the icons.
    facebook: "",
    instagram: "",
    whatsapp: "https://wa.me/919876543210",
    youtube: "",
  },

  // Free-delivery threshold in rupees, mirroring the backend default.
  freeDeliveryAbove: 999,
};

/** Formats a rupee amount for display: ₹1,23,456 */
export const formatRupees = (amount) => `₹${Number(amount || 0).toLocaleString("en-IN")}`;

/** Shortens an address object to a single line. */
export const formatAddress = (address = {}) =>
  [address.line1, address.line2, address.city, address.state, address.pincode]
    .filter(Boolean)
    .join(", ");

export default business;
