import prettier from 'eslint-config-prettier';
import { fileURLToPath } from 'node:url';
import { includeIgnoreFile } from '@eslint/compat';
import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import ts from 'typescript-eslint';
import svelteConfig from './svelte.config.js';

const gitignorePath = fileURLToPath(new URL('./.gitignore', import.meta.url));

export default defineConfig(
	includeIgnoreFile(gitignorePath),
	js.configs.recommended,
	...ts.configs.recommended,
	...svelte.configs.recommended,
	prettier,
	...svelte.configs.prettier,
	{
		languageOptions: { globals: { ...globals.browser, ...globals.node } },

		rules: {
			'no-undef': 'off',
			'no-console': 'warn',
			'no-warning-comments': ['warn', { terms: ['todo', 'fixme', 'hack'], location: 'start' }],
			'@typescript-eslint/no-unused-vars': 'warn',
			'@typescript-eslint/no-unused-expressions': 'warn',
			'@typescript-eslint/no-explicit-any': 'off',
			'no-setter-return': 'off',
			'no-case-declarations': 'off',
			'no-useless-escape': 'off',
			'@typescript-eslint/no-this-alias': 'off',
			'no-empty': 'off',
			'no-constant-condition': 'off',
			'svelte/prefer-svelte-reactivity': 'off',
			'svelte/prefer-writable-derived': 'off',
			'@typescript-eslint/ban-ts-comment': 'off',
			'no-unreachable': 'off',
			'no-cond-assign': 'off',
			'no-prototype-builtins': 'off',
			'no-control-regex': 'off',
			'no-sparse-arrays': 'off',
			'no-unsafe-finally': 'off',
			'no-unsafe-optional-chaining': 'off',
			'no-useless-catch': 'off',
			'no-constant-binary-expression': 'off',
			'no-useless-assignment': 'off',
			'no-unassigned-vars': 'off',
			'no-redeclare': 'off',
			'preserve-caught-error': 'off',
			'no-misleading-character-class': 'off',
			'@typescript-eslint/no-require-imports': 'off'
		}
	},
	{
		files: ['src/lib/server/storage/files.ts'],
		rules: {
			'no-await-in-loop': 'off'
		}
	},
	{
		files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],

		languageOptions: {
			parserOptions: {
				projectService: true,
				extraFileExtensions: ['.svelte'],
				parser: ts.parser,
				svelteConfig
			}
		},
		rules: {
			'svelte/require-each-key': 'off',
			'svelte/no-navigation-without-resolve': 'off',
			'svelte/no-useless-mustaches': 'off',
			'@typescript-eslint/no-explicit-any': 'off'
		}
	}
);
