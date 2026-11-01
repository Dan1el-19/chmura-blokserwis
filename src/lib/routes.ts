export type AppRoute = '/' | '/main' | '/trash' | '/settings';
export type AppRouteWithQuery = AppRoute | `${AppRoute}?${string}`;
