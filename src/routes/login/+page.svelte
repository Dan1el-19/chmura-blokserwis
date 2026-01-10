<script lang="ts">
	import { enhance } from '$app/forms';
	import Card from '$lib/components/ui/Card.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import { GithubLogo } from 'phosphor-svelte';

	let { form } = $props();
	let loading = $state(false);
</script>

<div class="flex min-h-dvh items-center justify-center bg-bg-app px-4 py-12">
	<Card class="w-full max-w-md border-border-line/60 shadow-none">
		<!-- Header -->
		<div class="mb-8 text-center">
			<h1 class="text-2xl font-bold tracking-tight text-text-main">Welcome back</h1>
			<p class="mt-2 text-sm text-text-muted">Sign in to your account</p>
		</div>

		<div class="space-y-6">
			<!-- OAuth Providers -->
			<div class="grid gap-3">
				<form action="?/oauth" method="POST">
					<Button variant="secondary" class="w-full gap-2" type="submit">
						<GithubLogo class="h-4 w-4" />
						GitHub
					</Button>
				</form>
				<form action="?/google" method="POST">
					<Button variant="secondary" class="w-full gap-2" type="submit">
						<svg class="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
							<path
								d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.748L12.545,10.239z"
							/>
						</svg>
						Google
					</Button>
				</form>
			</div>

			<div class="relative">
				<div class="absolute inset-0 flex items-center">
					<span class="w-full border-t border-border-line"></span>
				</div>
				<div class="relative flex justify-center text-xs uppercase">
					<span class="bg-bg-panel px-2 text-text-muted">Or continue with</span>
				</div>
			</div>

			<!-- Email Form -->
			<form
				method="POST"
				action="?/login"
				class="space-y-4"
				use:enhance={() => {
					loading = true;
					return async ({ update }) => {
						loading = false;
						await update();
					};
				}}
			>
				<Input
					name="email"
					type="email"
					label="Email"
					placeholder="name@example.com"
					required
					autocomplete="email"
				/>
				<Input
					name="password"
					type="password"
					label="Password"
					required
					autocomplete="current-password"
				/>

				{#if form?.error}
					<div class="rounded-md bg-red-50 p-3 text-sm text-red-500 dark:bg-red-900/10">
						{form.error}
					</div>
				{/if}

				<Button type="submit" class="w-full" {loading}>Sign In</Button>
			</form>
		</div>
	</Card>
</div>
