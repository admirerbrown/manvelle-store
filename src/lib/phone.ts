export function normalizeGhanaPhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (/^0[235]\d{8}$/.test(digits)) return `+233${digits.slice(1)}`;
  if (/^233[235]\d{8}$/.test(digits)) return `+${digits}`;
  throw new Error("This is not a valid Ghanaian phone number.");
}

export function whatsappDigits(phone: string): string {
  return phone.replace(/\D/g, "");
}
