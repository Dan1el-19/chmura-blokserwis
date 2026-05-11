/// <reference types="@sveltejs/adapter-cloudflare" />

declare global {
	namespace App {
		interface Locals {
			user: import('appwrite').Models.User<import('appwrite').Models.Preferences> | undefined;
		}

		interface Platform {
			env: Env;
		}
	}
}

export {};
