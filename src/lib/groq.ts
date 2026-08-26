export const GROQ_MODEL = "llama-3.3-70b-versatile"
export const GROQ_STORAGE_KEY = "orbe_groq_key"
export const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"

export function getGroqApiKey(): string {
  const env = import.meta.env.VITE_GROQ_API_KEY as string | undefined
  return env || localStorage.getItem(GROQ_STORAGE_KEY) || ""
}
