## [1.6.1](https://github.com/Dan1el-19/effinity-cloud/compare/v1.6.0...v1.6.1) (2025-12-31)


### Bug Fixes

* Add runtime env vars and secrets to Cloud Run deploy ([bc3a47b](https://github.com/Dan1el-19/effinity-cloud/commit/bc3a47b435f79b1ec66f12dd1896b154ee81ebae))

# [1.6.0](https://github.com/Dan1el-19/effinity-cloud/compare/v1.5.0...v1.6.0) (2025-12-31)


### Features

* Add Dockerfile, docker-compose, and Cloud Build configuration for containerization and CI/CD deployment to Cloud Run. ([85ee67f](https://github.com/Dan1el-19/effinity-cloud/commit/85ee67ff8fdb209195d67ef034aa699acf865fe7))
* Dynamically set page titles based on the current route and update the favicon to a custom cloud icon. ([6e7c4dd](https://github.com/Dan1el-19/effinity-cloud/commit/6e7c4dd91520638c2ccea0959b4cdb45e6f0e3da))
* Refactor file management components, introduce new UI elements, and update login/logout flow with i18n improvements. ([1d156bf](https://github.com/Dan1el-19/effinity-cloud/commit/1d156bfb0d6895d522c90cbb699019712b250a20))

# [1.5.0](https://github.com/Dan1el-19/effinity-cloud/compare/v1.4.0...v1.5.0) (2025-12-31)


### Features

* implement API rate limiting, centralize constants and environment variables, and add UI notifications ([d9594cf](https://github.com/Dan1el-19/effinity-cloud/commit/d9594cfc1a0e61977013a052c57b3b77cd449afb))
* Migrate database initialization to Appwrite TablesDB API, introduce new storage types, and add validation schemas for file and folder management. ([2de7ef5](https://github.com/Dan1el-19/effinity-cloud/commit/2de7ef55ba3041ff9a6f2ddd5bd33d4aa421370c))

# [1.4.0](https://github.com/Dan1el-19/effinity-cloud/compare/v1.3.0...v1.4.0) (2025-12-26)


### Features

* Add server-side caching for user storage usage, file/folder metadata, lists, and R2 download URLs. ([b34bf3a](https://github.com/Dan1el-19/effinity-cloud/commit/b34bf3a6c261f2525c95a1d264f58bb2bd1579d8))
* Implement comprehensive admin panel with user management, storage preview, and API endpoints for user administration. ([1159a23](https://github.com/Dan1el-19/effinity-cloud/commit/1159a23b0963100ae9f56b16273793e4735d7558))
* Implement folder download as ZIP functionality with a new API endpoint and UI integration. ([1f2faff](https://github.com/Dan1el-19/effinity-cloud/commit/1f2faff7641bcee9fad6d03abdc269c4ebceb40c))
* Implement Google OAuth login, add logout functionality, and enhance Uppy uploader configuration. ([ecec912](https://github.com/Dan1el-19/effinity-cloud/commit/ecec9129f4659501f5fd58b76e262f4c132fe241))
* Implement storage quota, role-based access control for files and folders, and a new file explorer UI with storage usage display. ([5d5b6ae](https://github.com/Dan1el-19/effinity-cloud/commit/5d5b6ae1458a96a8d96d70459632623d752a8274))

# [1.3.0](https://github.com/Dan1el-19/effinity-cloud/compare/v1.2.0...v1.3.0) (2025-12-25)

### Features

- Add comprehensive file and folder management with R2 storage, including API and UI for CRUD operations. ([2d28f99](https://github.com/Dan1el-19/effinity-cloud/commit/2d28f99932216df6f18eb40a766fbad57e3c7af8))
- Add recursive folder size calculation and display, and enhance Uppy uploads with dynamic multipart chunk sizing. ([b94f5e3](https://github.com/Dan1el-19/effinity-cloud/commit/b94f5e309268bece7605653fbbb28b179646d753))
- dynamically set session cookie secure flag, relax SameSite policy to lax, and enable host access for dev server. ([1fedac1](https://github.com/Dan1el-19/effinity-cloud/commit/1fedac1136e7925f6c9b28a06330b56af28af9c4))
- implement file and folder management with database schema, server-side APIs, and enhanced Uppy integration. ([4d02942](https://github.com/Dan1el-19/effinity-cloud/commit/4d029420970aa27dc7fcbd4c2a2e892145f32f5d))

# [1.2.0](https://github.com/Dan1el-19/effinity-cloud/compare/v1.1.0...v1.2.0) (2025-12-24)

### Features

- Implement Uppy for multipart file uploads and remove simple upload API. ([fe398e2](https://github.com/Dan1el-19/effinity-cloud/commit/fe398e2bdda4fadaa7ec829422ee16971c58f1e2))
- Implement user authentication with Appwrite sessions and enhance file upload API with unique filename generation and improved validation. ([c9a2de3](https://github.com/Dan1el-19/effinity-cloud/commit/c9a2de3af9da5aa456571405e6ddafb4fc3f2cb4))

# [1.1.0](https://github.com/Dan1el-19/effinity-cloud/compare/v1.0.0...v1.1.0) (2025-12-23)

### Features

- Implement R2 file upload and listing with Appwrite integration, update UI, and migrate build commands to pnpm. ([2fe233e](https://github.com/Dan1el-19/effinity-cloud/commit/2fe233efc5bc0b1f54c68b3596a3cf5398e58bab))

# 1.0.0 (2025-12-23)

### Bug Fixes

- npm -> pnpm, semantic release ([90f19a9](https://github.com/Dan1el-19/effinity-cloud/commit/90f19a9dd1247d6077db0fec66e53dd9e04998b5))

### Features

- initialize SvelteKit project with comprehensive development, testing, and CI/CD configurations. ([a432749](https://github.com/Dan1el-19/effinity-cloud/commit/a432749e9ebcdee467e94ff1620666589c44aa86))
