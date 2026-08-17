export const formatPrice = (amount: number | string): string => {
  const num = typeof amount === "number" ? amount : Number(amount);
  if (Number.isNaN(num)) return "₹0";
  return num.toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  });
};

