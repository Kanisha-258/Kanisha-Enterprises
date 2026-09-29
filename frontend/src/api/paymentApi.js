import api from "./axios";

// Lets the checkout page decide whether to offer online payment.
export const getPaymentConfig = async () => {
  const { data } = await api.get("/payments/config");
  return data; // { razorpayEnabled, keyId }
};

export const createPaymentOrder = async (payload) => {
  const { data } = await api.post("/payments/create-order", payload);
  return data; // { orderId, razorpayOrderId, amount, keyId, customer }
};

export const verifyPayment = async (payload) => {
  const { data } = await api.post("/payments/verify", payload);
  return data.order;
};

export const cancelPaymentOrder = async (orderId) => {
  const { data } = await api.post("/payments/cancel", { orderId });
  return data;
};

/**
 * Loads Razorpay's checkout script on demand.
 * Returns the constructor, or null if the script can't be loaded.
 */
export const loadRazorpay = () =>
  new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(window.Razorpay);
      return;
    }

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;

    script.onload = () => resolve(window.Razorpay);
    script.onerror = () => {
      console.error("Failed to load the Razorpay checkout script.");
      resolve(null);
    };

    document.body.appendChild(script);
  });
