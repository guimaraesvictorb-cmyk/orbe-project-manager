export type ClientStatus = "ativo" | "onboarding" | "pausado" | "encerrado";

export interface OrbeClient {
  id: string;
  name: string;
  category: string;
  initials: string;
  avatarColor: string;
  gestor: string;
  platforms: string[];
  website?: string;
  monthlyBudget: string;
  status: ClientStatus;
  startDate: string; // YYYY-MM
  healthFlag: "green" | "yellow" | "red";
}

export const CLIENTS: OrbeClient[] = [
  {
    id: "cli_001",
    name: "FitVida Academia",
    category: "Fitness & Saúde",
    initials: "FV",
    avatarColor: "#14532d",
    gestor: "Victor Guimarães",
    platforms: ["Meta Ads", "Google Ads"],
    website: "https://fitvida.com.br",
    monthlyBudget: "R$ 8.000",
    status: "ativo",
    startDate: "2025-01",
    healthFlag: "green",
  },
  {
    id: "cli_002",
    name: "DentCare Clínica",
    category: "Odontologia",
    initials: "DC",
    avatarColor: "#1e3a5f",
    gestor: "Victor Guimarães",
    platforms: ["Meta Ads", "Google Ads"],
    website: "https://dentcare.com.br",
    monthlyBudget: "R$ 6.000",
    status: "ativo",
    startDate: "2024-11",
    healthFlag: "green",
  },
  {
    id: "cli_003",
    name: "TechHome E-commerce",
    category: "E-commerce",
    initials: "TH",
    avatarColor: "#1e1b4b",
    gestor: "Victor Guimarães",
    platforms: ["Meta Ads", "Google Ads", "Google Shopping"],
    website: "https://techhome.com.br",
    monthlyBudget: "R$ 15.000",
    status: "ativo",
    startDate: "2024-09",
    healthFlag: "green",
  },
  {
    id: "cli_004",
    name: "ModoLux Fashion",
    category: "Moda",
    initials: "ML",
    avatarColor: "#4a1942",
    gestor: "Victor Guimarães",
    platforms: ["Meta Ads", "Instagram Ads"],
    website: "https://modolux.com.br",
    monthlyBudget: "R$ 5.000",
    status: "ativo",
    startDate: "2025-02",
    healthFlag: "yellow",
  },
  {
    id: "cli_005",
    name: "Sabor & Arte",
    category: "Gastronomia",
    initials: "SA",
    avatarColor: "#431407",
    gestor: "Victor Guimarães",
    platforms: ["Meta Ads"],
    website: "https://saborarte.com.br",
    monthlyBudget: "R$ 3.000",
    status: "ativo",
    startDate: "2025-03",
    healthFlag: "green",
  },
  {
    id: "cli_006",
    name: "Investcorp",
    category: "Investimentos",
    initials: "IC",
    avatarColor: "#0c2340",
    gestor: "Victor Guimarães",
    platforms: ["Google Ads", "LinkedIn Ads"],
    website: "https://investcorp.com.br",
    monthlyBudget: "R$ 12.000",
    status: "ativo",
    startDate: "2024-10",
    healthFlag: "green",
  },
  {
    id: "cli_007",
    name: "NovaBuild Construtora",
    category: "Construção Civil",
    initials: "NB",
    avatarColor: "#1c1917",
    gestor: "Victor Guimarães",
    platforms: ["Meta Ads", "Google Ads"],
    monthlyBudget: "R$ 9.000",
    status: "onboarding",
    startDate: "2025-05",
    healthFlag: "green",
  },
  {
    id: "cli_008",
    name: "VitaPharm",
    category: "Farmácia & Saúde",
    initials: "VP",
    avatarColor: "#14403a",
    gestor: "Victor Guimarães",
    platforms: ["Meta Ads", "Google Ads"],
    website: "https://vitapharm.com.br",
    monthlyBudget: "R$ 7.000",
    status: "ativo",
    startDate: "2025-01",
    healthFlag: "yellow",
  },
];

export const FLAG_META = {
  green:  { label: "Green",  color: "var(--accent)", bg: "#140D24" },
  yellow: { label: "Yellow", color: "var(--warning)", bg: "#1a1200" },
  red:    { label: "Red",    color: "var(--danger)", bg: "#180808" },
};

export const STATUS_CLIENT_META: Record<ClientStatus, { label: string; color: string }> = {
  ativo:      { label: "Ativo",      color: "var(--accent)" },
  onboarding: { label: "Onboarding", color: "#60A5FA" },
  pausado:    { label: "Pausado",    color: "var(--warning)" },
  encerrado:  { label: "Encerrado",  color: "var(--text-secondary)" },
};
