export const debugLog = (message, data) => {
  if (process.env.NODE_ENV === "development") {
    console.log(`[DEBUG] ${message}:`, JSON.stringify(data, null, 2));
  }
};

export const logError = (context, error) => {
  console.error(`[ERROR] ${context}:`, error.message);
  if (process.env.NODE_ENV === "development") {
    console.error(error.stack);
  }
};
