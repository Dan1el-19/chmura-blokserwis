export type AppRoute = '/' | '/main' | '/trash' | '/settings' | '/wyceny';
export type AppRouteWithQuery = AppRoute | `${AppRoute}?${string}`;
