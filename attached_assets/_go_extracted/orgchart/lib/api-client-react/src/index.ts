export * from "./generated/api";
export type * from "./generated/api.schemas";
export {
  setBaseUrl,
  setAuthTokenGetter,
  setAcceptLanguage,
} from "./custom-fetch";
export type { AuthTokenGetter } from "./custom-fetch";
