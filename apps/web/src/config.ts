export const config = {
  apiUrl: import.meta.env.VITE_API_URL ?? 'http://localhost:3000',
};

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
export const formatCents = (cents: number) => brl.format(cents / 100);
