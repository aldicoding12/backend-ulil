export const validateDate = (dateString) => {
  if (!dateString) return null;
  const date = new Date(dateString);
  return !isNaN(date.getTime()) ? date : null;
};

export const getWeekRange = (refDate) => {
  const startDate = new Date(refDate);
  startDate.setDate(refDate.getDate() - 6);
  startDate.setHours(0, 0, 0, 0);

  const endDate = new Date(refDate);
  endDate.setHours(23, 59, 59, 999);

  return { startDate, endDate };
};

export const getMonthRange = (refDate) => {
  const startDate = new Date(refDate.getFullYear(), refDate.getMonth(), 1);
  startDate.setHours(0, 0, 0, 0);

  const endDate = new Date(
    refDate.getFullYear(),
    refDate.getMonth() + 1,
    0,
    23,
    59,
    59,
    999
  );

  return { startDate, endDate };
};

export const getYearRange = (startYear, endYear) => {
  const startDate = new Date(startYear, 0, 1);
  const endDate = new Date(endYear, 11, 31, 23, 59, 59, 999);
  return { startDate, endDate };
};

export const getDayRange = (date) => {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return { start, end };
};
