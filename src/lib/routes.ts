export type AppRoute = '/' | '/main' | '/personal' | '/trash' | '/settings' | '/wyceny';
export type AppRouteWithQuery = AppRoute | `${AppRoute}?${string}`;
