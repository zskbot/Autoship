export interface Env {
  AUTOSHIP: Fetcher;
}

export default {
  fetch(request: Request, env: Env): Promise<Response> {
    return env.AUTOSHIP.fetch(request);
  },
};
