/** 3000 → « 3 000 FCFA » */
export function fcfa(amount: number): string {
  return `${String(amount).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} FCFA`;
}
