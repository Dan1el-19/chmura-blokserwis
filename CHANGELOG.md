## [2.2.1](https://github.com/Dan1el-19/chmura-blokserwis/compare/v2.2.0...v2.2.1) (2026-05-13)

### Bug Fixes

* upload proxy endpoints for releases to bypass R2 SDK limitations ([ff047db](https://github.com/Dan1el-19/chmura-blokserwis/commit/ff047db5ce18901452beb677be3c6f827888ef0b))

## [2.2.0](https://github.com/Dan1el-19/chmura-blokserwis/compare/v2.1.1...v2.2.0) (2026-05-13)

### Features

* add R2 multipart upload endpoint and integrate local SDK linking into dev workflow ([ba9c6ba](https://github.com/Dan1el-19/chmura-blokserwis/commit/ba9c6ba6e94c7b123341b71a742e0f732961ff03))

## [2.1.1](https://github.com/Dan1el-19/chmura-blokserwis/compare/v2.1.0...v2.1.1) (2026-05-13)

### Bug Fixes

* update unisource-sdk to version 0.4.0 and add local development scripts for SDK integration ([06af17c](https://github.com/Dan1el-19/chmura-blokserwis/commit/06af17ccf80d13df349383b0bf3894e552f2f087))

## [2.1.0](https://github.com/Dan1el-19/chmura-blokserwis/compare/v2.0.0...v2.1.0) (2026-05-12)

### Features

* implement multipart upload system for R2 with selection management and API infrastructure ([18662ce](https://github.com/Dan1el-19/chmura-blokserwis/commit/18662ceedbacc26c6a618d8627caa69a4be6092a))

## [2.0.0](https://github.com/Dan1el-19/chmura-blokserwis/compare/v1.15.0...v2.0.0) (2026-05-11)

### ⚠ BREAKING CHANGES

* migrated service identity and public product naming.

### Features

* migrate from effinity-cloud to chmura-blokserwis v2 ([7564a7f](https://github.com/Dan1el-19/chmura-blokserwis/commit/7564a7f45ff2d74ba744f22f1d12a13ce61fb9b2))

# [1.16.0](https://github.com/Dan1el-19/chmura-blokserwis/compare/v1.15.0...v1.16.0) (2026-05-11)


### Features

* **sdk:** migrate storage to UniSource SDK and deploy on Cloudflare Workers ([8480376](https://github.com/Dan1el-19/chmura-blokserwis/commit/8480376c3ec3584c71c16ea8f31cfdaa3147bc1b))

# [1.15.0](https://github.com/Dan1el-19/effinity-cloud/compare/v1.14.2...v1.15.0) (2026-05-07)

### Bug Fixes

- Add bcrypt to onlyBuiltDependencies in pnpm workspace configuration ([dd759a1](https://github.com/Dan1el-19/effinity-cloud/commit/dd759a1e48146eb703d91ec6d4446834dca6851e))

### Features

- Implement toPublicUser function and related tests for user data serialization ([1f3a117](https://github.com/Dan1el-19/effinity-cloud/commit/1f3a117dd397389eddee8909a17026a34a149cec))

## [1.14.2](https://github.com/Dan1el-19/effinity-cloud/compare/v1.14.1...v1.14.2) (2026-04-02)

### Bug Fixes

- add FAB button to the mobile releases ([14335da](https://github.com/Dan1el-19/effinity-cloud/commit/14335dacdb2aa36d90728080b3a5f8edbd264f1a))

## [1.14.1](https://github.com/Dan1el-19/effinity-cloud/compare/v1.14.0...v1.14.1) (2026-04-02)

### Bug Fixes

- external Appwrite configuration sync service and API endpoints for release management ([81bb307](https://github.com/Dan1el-19/effinity-cloud/commit/81bb30700f68f26b35fc1fe70d661baf0525be48))

# [1.14.0](https://github.com/Dan1el-19/effinity-cloud/compare/v1.13.4...v1.14.0) (2026-04-02)

### Features

- implement release beta/stable management system with upload UI, validation schemas, and API endpoints for APK distribution. ([08ed242](https://github.com/Dan1el-19/effinity-cloud/commit/08ed242d90a693238f7307d41d3b65b2ffb5faf0))

## [1.13.4](https://github.com/Dan1el-19/effinity-cloud/compare/v1.13.3...v1.13.4) (2026-04-01)

### Bug Fixes

- implement release management API endpoints and upload modal with version validation and auto-syncing configuration ([d7d1b2e](https://github.com/Dan1el-19/effinity-cloud/commit/d7d1b2e50daf15f0ae57d74099d139bed7ce1209))

## [1.13.3](https://github.com/Dan1el-19/effinity-cloud/compare/v1.13.2...v1.13.3) (2026-04-01)

### Bug Fixes

- Appwrite environment variables for release synchronization ([567b352](https://github.com/Dan1el-19/effinity-cloud/commit/567b352f9934a448eed330197451e9634a112df2))

## [1.13.2](https://github.com/Dan1el-19/effinity-cloud/compare/v1.13.1...v1.13.2) (2026-04-01)

### Bug Fixes

- implement external Appwrite configuration sync service and API route ([058d304](https://github.com/Dan1el-19/effinity-cloud/commit/058d3042cb08b3665c3946ec9d3de0b32faa4756))

## [1.13.1](https://github.com/Dan1el-19/effinity-cloud/compare/v1.13.0...v1.13.1) (2026-04-01)

### Bug Fixes

- rescue forcesync features after refactor oversight ([7afc088](https://github.com/Dan1el-19/effinity-cloud/commit/7afc0882a3d2d157f0bfb1fe3e7e99fceefefe11))

# [1.13.0](https://github.com/Dan1el-19/effinity-cloud/compare/v1.12.0...v1.13.0) (2026-03-31)

### Features

- implement release management system with external configuration synchronization and UI components ([7edfb57](https://github.com/Dan1el-19/effinity-cloud/commit/7edfb57f24a537fc75a0978ce17a19734c692860))

# [1.12.0](https://github.com/Dan1el-19/effinity-cloud/compare/v1.11.0...v1.12.0) (2026-03-24)

### Features

- Add release upload functionality with a dedicated modal, API endpoint, and external app configuration updates. ([27e2696](https://github.com/Dan1el-19/effinity-cloud/commit/27e2696216bd911db5566eb14d4b016a1718afc9))

# [1.11.0](https://github.com/Dan1el-19/effinity-cloud/compare/v1.10.0...v1.11.0) (2026-03-24)

### Features

- Implement comprehensive APK release management system with dedicated UI, API endpoints, and server-side storage. ([243098f](https://github.com/Dan1el-19/effinity-cloud/commit/243098fee4afff38330ccf3cfaa0edaa11186a1e))

# [1.10.0](https://github.com/Dan1el-19/effinity-cloud/compare/v1.9.0...v1.10.0) (2026-02-04)

### Features

- Add server-side logic and API routes for file and folder sharing, including share creation, retrieval, listing, deletion, password protection, expiration, and download limits. ([55263a8](https://github.com/Dan1el-19/effinity-cloud/commit/55263a81bf4a9c4ce6ee99fa2d72aecfd992c00c))

# [1.9.0](https://github.com/Dan1el-19/effinity-cloud/compare/v1.8.0...v1.9.0) (2026-01-23)

### Features

- enhance files sharing step 1 ([bc6a655](https://github.com/Dan1el-19/effinity-cloud/commit/bc6a6550d65a92d07d1d493249271e40eff28fd6))

# [1.8.0](https://github.com/Dan1el-19/effinity-cloud/compare/v1.7.2...v1.8.0) (2026-01-18)

### Bug Fixes

- cloudbuild.yaml repair ([7467129](https://github.com/Dan1el-19/effinity-cloud/commit/7467129f5c4643753054bb4c40081bd44c0846fe))
- Correct session cookie name and add private Cache-Control header to responses. ([81a5512](https://github.com/Dan1el-19/effinity-cloud/commit/81a551288ba255d2590fd39726f71548f54238a7))
- Enhance server hooks logging with request path and no-session cookie status. ([4d2b939](https://github.com/Dan1el-19/effinity-cloud/commit/4d2b939020dba8d41af509470d0305efc5c68b0d))
- OAuth redirect loop - use env.ORIGIN and proper headers ([797503d](https://github.com/Dan1el-19/effinity-cloud/commit/797503d1a751314382e5c3937664c0584539199c))
- Resolve layout overflow in main content and sidebar, and update various dependencies. ([7808956](https://github.com/Dan1el-19/effinity-cloud/commit/780895695fa26075791c03a794e89201b0835859))

### Features

- enhance ESLint configuration and logging ([bdc7e73](https://github.com/Dan1el-19/effinity-cloud/commit/bdc7e738ae25ed0c5b8f664ab48bc4583edbfced))
- Implement file sharing with public links, expiration, and custom slugs. ([7180be8](https://github.com/Dan1el-19/effinity-cloud/commit/7180be8ff1a7b42b73b246fe08aa7321ab5c1609))

## [1.7.3](https://github.com/Dan1el-19/effinity-cloud/compare/v1.7.2...v1.7.3) (2026-01-10)

### Bug Fixes

- cloudbuild.yaml repair ([7467129](https://github.com/Dan1el-19/effinity-cloud/commit/7467129f5c4643753054bb4c40081bd44c0846fe))
- Correct session cookie name and add private Cache-Control header to responses. ([81a5512](https://github.com/Dan1el-19/effinity-cloud/commit/81a551288ba255d2590fd39726f71548f54238a7))
- Enhance server hooks logging with request path and no-session cookie status. ([4d2b939](https://github.com/Dan1el-19/effinity-cloud/commit/4d2b939020dba8d41af509470d0305efc5c68b0d))
- OAuth redirect loop - use env.ORIGIN and proper headers ([797503d](https://github.com/Dan1el-19/effinity-cloud/commit/797503d1a751314382e5c3937664c0584539199c))

## [1.7.3](https://github.com/Dan1el-19/effinity-cloud/compare/v1.7.2...v1.7.3) (2026-01-02)

### Bug Fixes

- cloudbuild.yaml repair ([7467129](https://github.com/Dan1el-19/effinity-cloud/commit/7467129f5c4643753054bb4c40081bd44c0846fe))
- Correct session cookie name and add private Cache-Control header to responses. ([81a5512](https://github.com/Dan1el-19/effinity-cloud/commit/81a551288ba255d2590fd39726f71548f54238a7))
- Enhance server hooks logging with request path and no-session cookie status. ([4d2b939](https://github.com/Dan1el-19/effinity-cloud/commit/4d2b939020dba8d41af509470d0305efc5c68b0d))
- OAuth redirect loop - use env.ORIGIN and proper headers ([797503d](https://github.com/Dan1el-19/effinity-cloud/commit/797503d1a751314382e5c3937664c0584539199c))

## [1.7.3](https://github.com/Dan1el-19/effinity-cloud/compare/v1.7.2...v1.7.3) (2026-01-02)

### Bug Fixes

- cloudbuild.yaml repair ([7467129](https://github.com/Dan1el-19/effinity-cloud/commit/7467129f5c4643753054bb4c40081bd44c0846fe))
- Enhance server hooks logging with request path and no-session cookie status. ([4d2b939](https://github.com/Dan1el-19/effinity-cloud/commit/4d2b939020dba8d41af509470d0305efc5c68b0d))
- OAuth redirect loop - use env.ORIGIN and proper headers ([797503d](https://github.com/Dan1el-19/effinity-cloud/commit/797503d1a751314382e5c3937664c0584539199c))

## [1.7.3](https://github.com/Dan1el-19/effinity-cloud/compare/v1.7.2...v1.7.3) (2026-01-02)

### Bug Fixes

- cloudbuild.yaml repair ([7467129](https://github.com/Dan1el-19/effinity-cloud/commit/7467129f5c4643753054bb4c40081bd44c0846fe))
- OAuth redirect loop - use env.ORIGIN and proper headers ([797503d](https://github.com/Dan1el-19/effinity-cloud/commit/797503d1a751314382e5c3937664c0584539199c))

## [1.7.2](https://github.com/Dan1el-19/effinity-cloud/compare/v1.7.1...v1.7.2) (2026-01-02)

### Bug Fixes

- update globals dependency to v17 ([ceaf820](https://github.com/Dan1el-19/effinity-cloud/commit/ceaf820cb6ec4d818c7657a8badc74c2b5256ff2))

## [1.7.1](https://github.com/Dan1el-19/effinity-cloud/compare/v1.7.0...v1.7.1) (2026-01-02)

### Bug Fixes

- Add CSRF `checkOrigin: false` to SvelteKit configuration ([32606d0](https://github.com/Dan1el-19/effinity-cloud/commit/32606d0d41729adab3408563e069944eec45ed42))

# [1.7.0](https://github.com/Dan1el-19/effinity-cloud/compare/v1.6.1...v1.7.0) (2026-01-02)

### Features

- Configure Firebase Hosting for static assets and Cloud Run rewrites, including a default 404 page. ([3d98afe](https://github.com/Dan1el-19/effinity-cloud/commit/3d98afef90ec29454af2d75578b68e02581466e1))

## [1.6.1](https://github.com/Dan1el-19/effinity-cloud/compare/v1.6.0...v1.6.1) (2025-12-31)

### Bug Fixes

- Add runtime env vars and secrets to Cloud Run deploy ([bc3a47b](https://github.com/Dan1el-19/effinity-cloud/commit/bc3a47b435f79b1ec66f12dd1896b154ee81ebae))

# [1.6.0](https://github.com/Dan1el-19/effinity-cloud/compare/v1.5.0...v1.6.0) (2025-12-31)

### Features

- Add Dockerfile, docker-compose, and Cloud Build configuration for containerization and CI/CD deployment to Cloud Run. ([85ee67f](https://github.com/Dan1el-19/effinity-cloud/commit/85ee67ff8fdb209195d67ef034aa699acf865fe7))
- Dynamically set page titles based on the current route and update the favicon to a custom cloud icon. ([6e7c4dd](https://github.com/Dan1el-19/effinity-cloud/commit/6e7c4dd91520638c2ccea0959b4cdb45e6f0e3da))
- Refactor file management components, introduce new UI elements, and update login/logout flow with i18n improvements. ([1d156bf](https://github.com/Dan1el-19/effinity-cloud/commit/1d156bfb0d6895d522c90cbb699019712b250a20))

# [1.5.0](https://github.com/Dan1el-19/effinity-cloud/compare/v1.4.0...v1.5.0) (2025-12-31)

### Features

- implement API rate limiting, centralize constants and environment variables, and add UI notifications ([d9594cf](https://github.com/Dan1el-19/effinity-cloud/commit/d9594cfc1a0e61977013a052c57b3b77cd449afb))
- Migrate database initialization to Appwrite TablesDB API, introduce new storage types, and add validation schemas for file and folder management. ([2de7ef5](https://github.com/Dan1el-19/effinity-cloud/commit/2de7ef55ba3041ff9a6f2ddd5bd33d4aa421370c))

# [1.4.0](https://github.com/Dan1el-19/effinity-cloud/compare/v1.3.0...v1.4.0) (2025-12-26)

### Features

- Add server-side caching for user storage usage, file/folder metadata, lists, and R2 download URLs. ([b34bf3a](https://github.com/Dan1el-19/effinity-cloud/commit/b34bf3a6c261f2525c95a1d264f58bb2bd1579d8))
- Implement comprehensive admin panel with user management, storage preview, and API endpoints for user administration. ([1159a23](https://github.com/Dan1el-19/effinity-cloud/commit/1159a23b0963100ae9f56b16273793e4735d7558))
- Implement folder download as ZIP functionality with a new API endpoint and UI integration. ([1f2faff](https://github.com/Dan1el-19/effinity-cloud/commit/1f2faff7641bcee9fad6d03abdc269c4ebceb40c))
- Implement Google OAuth login, add logout functionality, and enhance Uppy uploader configuration. ([ecec912](https://github.com/Dan1el-19/effinity-cloud/commit/ecec9129f4659501f5fd58b76e262f4c132fe241))
- Implement storage quota, role-based access control for files and folders, and a new file explorer UI with storage usage display. ([5d5b6ae](https://github.com/Dan1el-19/effinity-cloud/commit/5d5b6ae1458a96a8d96d70459632623d752a8274))

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
