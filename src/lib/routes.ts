export type AppRoute = '/' | '/main' | '/personal' | '/trash' | '/shares' | '/settings' | '/wyceny';
export type AppRouteWithQuery = AppRoute | `${AppRoute}?${string}`;
