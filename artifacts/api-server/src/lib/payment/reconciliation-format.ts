export const formatShopeeTransactionsStartTime = (startTime: Date): string => {
  const milliseconds = startTime.getTime();
  if (!Number.isFinite(milliseconds)) {
    throw new Error("Invalid ShopeePay transaction start time");
  }
  return Math.floor(milliseconds / 1000).toString();
};
