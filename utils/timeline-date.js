const pad = (value) => String(value).padStart(2, '0');

export const TIMELINE_RESET_HOUR = 3;

export const getTimelineDateKey = (dateInput = new Date()) => {
  const date = new Date(dateInput);
  if (date.getHours() < TIMELINE_RESET_HOUR) {
    date.setDate(date.getDate() - 1);
  }

  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());

  return `${year}-${month}-${day}`;
};

export const formatCompletedTime = (dateInput = new Date()) => {
  return new Date(dateInput).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
};