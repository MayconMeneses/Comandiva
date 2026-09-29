# Graph Report - Pubx  (2026-09-29)

## Corpus Check
- 613 files · ~994,187 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 16 file(s) not represented in the graph (top: (none) 9, .xml 2, .css 2)

## Summary
- 3006 nodes · 8322 edges · 127 communities (109 shown, 18 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 70 edges (avg confidence: 0.87)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `2c537c24`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- ref_react
- db/restaurants.ts
- storage.ts
- client/src/lib/trpc.ts
- getDb
- lucide-react
- cn
- package.json
- sidebar.tsx
- dependencies
- seed-cardapio-mm.ts
- order.ts
- routers/dataRights.ts
- saas-core/server/_core/context.ts
- client/src/App.tsx
- TableSession.tsx
- subscription.ts
- saas-core/server/_core/trpc.ts
- db/subscriptions.ts
- db/platformAdmins.ts
- alerts.ts
- _core/license.ts
- masterPanel/restaurants.ts
- RestaurantOrders.tsx
- getDb
- routers/team.ts
- admin/orders.ts
- admin.ts
- ref_vitest
- utils.ts
- admin/fiscal.ts
- payments/types.ts
- db/reports.ts
- devDependencies
- item.tsx
- nfceEmission.ts
- sdk.ts
- saas-core/client/src/App.tsx
- alert-dialog.tsx
- comercial/Home.tsx
- saas-core/shared/deriveSurfacePalette.ts
- shared/deriveSurfacePalette.ts
- input-group.tsx
- Equipe.tsx
- scripts/backup-db.mjs
- client/src/main.tsx
- saas-core/server/routers/support.ts
- devDependencies
- compilerOptions
- compilerOptions
- Cadastro.tsx
- telegramService.ts
- dependencies
- PromotionManager.tsx
- dropdown-menu.tsx
- schema.ts
- components.json
- scripts
- Planos.tsx
- saas-core/package.json
- scripts
- carousel.tsx
- PanelLayout.tsx
- trial-expiry.test.ts
- pwa-install-placement.test.ts
- restaurant-panel-ui.test.ts
- admin/audit.ts
- form.tsx
- ref_node_fs
- support-mode-access.test.ts
- TableMapManager.tsx
- ThemeContext.tsx
- drawer.tsx
- select.tsx
- ref_node_path
- server/_core/trpc.ts
- PwaInstallContext.tsx
- navigation-menu.tsx
- card.tsx
- menubar.tsx
- provision-client.mjs
- totp.ts
- saas-core/client/src/main.tsx
- generate-pwa-icons.ts
- context-menu.tsx
- scripts/restore-db.mjs
- ErrorBoundary.tsx
- link-cardapio-fotos.ts
- Dashboard.tsx
- verify-export.mjs
- Deploy em produção — Hostinger VPS + Docker
- saas-core/server/_core/index.ts
- Extração do material recebido — MM System Creator
- paymentService.ts
- home-style.test.ts
- routers/catalog.ts
- cleanup-test-data.ts
- Instalação e operação independente
- iniciar.sh
- upgrade-pubx-premium.ts
- checkRateLimit
- ref_drizzle_kit
- env.ts
- ref_typescript_eslint_eslint_plugin
- infra/entrypoint.sh
- saas-core/infra/entrypoint.sh
- smoke-independent.mjs
- cookie.d.ts
- server/_core/index.ts
- ref_express
- Migração de dados do MM System Creator
- Auditoria de independência do MM System Creator
- App
- MM System Creator — sistema independente de pedidos
- PaymentProvider
- Arquitetura do Sistema de Pedidos — MM System Creator
- Modelo de dados e camada de acesso
- Manifesto de assets do MM System Creator
- emailService.test.ts
- admin-access-validation.md
- clean-install-validation.md
- menu-navigation-reference.md
- mm-logo-validation.md
- qa-order-admin-2026-08-27.md
- README.md
- todo.md

## God Nodes (most connected - your core abstractions)
1. `cn()` - 268 edges
2. `getDb()` - 164 edges
3. `Button()` - 118 edges
4. `lucide-react` - 87 edges
5. `getDb()` - 82 edges
6. `Input()` - 70 edges
7. `Label()` - 62 edges
8. `trpc` - 59 edges
9. `Badge()` - 32 edges
10. `Loading()` - 31 edges

## Surprising Connections (you probably didn't know these)
- `Resumo executivo` --references--> `storagePut()`  [INFERRED]
  docs/portability-audit.md → server/storage.ts
- `Decisões importantes já tomadas (não refazer sem necessidade)` --references--> `PromotionManager()`  [INFERRED]
  CLAUDE.md → client/src/components/admin/PromotionManager.tsx
- `Validação do seletor de tema` --references--> `ThemeProvider()`  [INFERRED]
  docs/theme-selector-validation.md → client/src/contexts/ThemeContext.tsx
- `Camada SaaS — `saas-core/` (billing, Painel Master, Modo Suporte)` --references--> `Dashboard()`  [INFERRED]
  CLAUDE.md → saas-core/client/src/pages/Dashboard.tsx
- `Camada SaaS — `saas-core/` (billing, Painel Master, Modo Suporte)` --references--> `Planos()`  [INFERRED]
  CLAUDE.md → saas-core/client/src/pages/comercial/Planos.tsx

## Import Cycles
- None detected.

## Communities (127 total, 18 thin omitted)

### Community 0 - "ref_react"
Cohesion: 0.06
Nodes (88): AddonManager(), blankGroup, blankOption, Group, GroupForm, money(), Option, OptionForm (+80 more)

### Community 1 - "db/restaurants.ts"
Cohesion: 0.05
Nodes (47): platformAuditLog, PlatformAuditLogEntry, SubscriptionEvent, subscriptionEvents, webhookEvents, saas_core_drizzle_schema_index_billingpayments, saas_core_drizzle_schema_index_plans, saas_core_drizzle_schema_index_restaurants (+39 more)

### Community 2 - "storage.ts"
Cohesion: 0.10
Nodes (32): events, paymentGateways, @aws-sdk/s3-request-presigner, client, downloaded, payload, assertFeatureAvailable(), recordAccountAudit() (+24 more)

### Community 3 - "client/src/lib/trpc.ts"
Cohesion: 0.10
Nodes (49): AccountAdmin(), AppearanceSettings(), ACCOUNT_ACTION_LABELS, AuditLog(), CHANGE_TYPE_LABELS, CatalogAdmin(), Customers(), FiscalSettings() (+41 more)

### Community 4 - "getDb"
Cohesion: 0.06
Nodes (74): restaurantTables, tableBillPayments, tableReservations, tableServiceRequests, tableSessions, checkDistinctRateLimit(), restaurantProcedure, server_db_canceltablesession (+66 more)

### Community 5 - "lucide-react"
Cohesion: 0.13
Nodes (25): ACCESS_BLOCKED_COPY, CartPanel(), money(), CategoryRail(), money(), CategoryProductSections(), CategoryTabBar(), money() (+17 more)

### Community 6 - "cn"
Cohesion: 0.05
Nodes (55): AccordionContent(), AccordionItem(), AccordionTrigger(), Command(), CommandGroup(), CommandInput(), CommandItem(), CommandList() (+47 more)

### Community 7 - "package.json"
Cohesion: 0.03
Nodes (51): @aws-sdk/client-s3, cookie, cross-env, dotenv, drizzle-kit, drizzle-orm, esbuild, eslint (+43 more)

### Community 8 - "sidebar.tsx"
Cohesion: 0.06
Nodes (58): TrialEndedBlock(), TrialEndingBanner(), DashboardLayout(), DashboardLayoutContent(), DashboardLayoutContentProps, dateLabel(), menuItems, DashboardLayoutSkeleton() (+50 more)

### Community 9 - "dependencies"
Cohesion: 0.03
Nodes (65): dependencies, @aws-sdk/client-s3, @aws-sdk/s3-request-presigner, class-variance-authority, clsx, cmdk, cookie, dotenv (+57 more)

### Community 10 - "seed-cardapio-mm.ts"
Cohesion: 0.10
Nodes (27): addonGroups, addonOptions, restaurantSettings, ensurePizzaSizes(), findCategoryId(), MenuProduct, now, run() (+19 more)

### Community 11 - "order.ts"
Cohesion: 0.06
Nodes (48): Decisões importantes já tomadas (não refazer sem necessidade), nanoid, createTestOrder(), attempts, clearRateLimit(), distinctAttempts, fetchCatalog(), server_db_getactiveordersbyphone (+40 more)

### Community 12 - "routers/dataRights.ts"
Cohesion: 0.13
Nodes (22): phoneVerificationCodes, ref_jose, apply, inactive, lastOrderByCustomerId, createDataRightsToken(), getSecret(), verifyDataRightsToken() (+14 more)

### Community 13 - "saas-core/server/_core/context.ts"
Cohesion: 0.06
Nodes (41): saas_core_drizzle_schema_index_restaurant, generateApiKey(), hashApiKey(), { dbMocks, TEST_JWT_SECRET }, SECRET_BYTES, createContext(), PlatformAdminContext, TrpcContext (+33 more)

### Community 14 - "client/src/App.tsx"
Cohesion: 0.10
Nodes (38): Admin, DataRights, SupportEntry, TableSession, AppearanceSettingsProps, ServiceSection(), toWhatsAppDigits(), WhatsAppButton() (+30 more)

### Community 15 - "TableSession.tsx"
Cohesion: 0.10
Nodes (46): useCategoryScrollSpy(), digits(), money(), NewCounterOrder(), contextOf(), PendingOrderBanner(), ProductSearch(), CartAddon (+38 more)

### Community 16 - "subscription.ts"
Cohesion: 0.08
Nodes (39): accessReleased, AccessReleasedVars, passwordReset, PasswordResetVars, restaurantReady, RestaurantReadyVars, welcome, WelcomeVars (+31 more)

### Community 17 - "saas-core/server/_core/trpc.ts"
Cohesion: 0.06
Nodes (45): ref_trpc_server, ref_zod, saas_core_drizzle_schema_index_masterpanelsettings, saas_core_drizzle_schema_index_platformauditlog, askMaintenanceAssistant(), buildSnapshot(), MaintenanceAssistantResult, alertOnUnintentionalInternalError() (+37 more)

### Community 18 - "db/subscriptions.ts"
Cohesion: 0.10
Nodes (37): saas_core_drizzle_schema_index_subscriptionstatus, saas_core_drizzle_schema_index_webhookevents, mocks, sendEmailAsync(), CreatedPreapproval, createSubscriptionPreapproval(), getAuthorizedPayment(), getSubscriptionPreapproval() (+29 more)

### Community 19 - "db/platformAdmins.ts"
Cohesion: 0.09
Nodes (37): ref_node_crypto, saas_core_drizzle_schema_index_platformadminrole, saas_core_drizzle_schema_index_platformadmins, InsertPlatformAdmin, PlatformAdmin, PlatformAdminRole, platformAdminRoleValues, platformAdmins (+29 more)

### Community 20 - "alerts.ts"
Cohesion: 0.20
Nodes (13): nodemailer, mockEnv, AlertSeverity, DEFAULT_SEVERITY_BY_KIND, extractSourceLocation(), formatAlert(), getTransport(), lastSentAt (+5 more)

### Community 21 - "_core/license.ts"
Cohesion: 0.11
Nodes (29): buildSnapshot(), FEATURE_IDS, FeatureId, fetchPlanCatalog(), forceSyncLicense(), getCachedLicenseSnapshot, getFreshLicenseSnapshot(), getLicenseSnapshot() (+21 more)

### Community 22 - "masterPanel/restaurants.ts"
Cohesion: 0.17
Nodes (22): saas_core_drizzle_schema_index_plankeyvalues, saas_core_drizzle_schema_index_restaurantstatusvalues, saas_core_drizzle_schema_index_subscriptionstatusvalues, planKeyValues, subscriptionStatusValues, triggerRemoteLicenseSync(), assertSafeDeploymentUrl(), PRIVATE_HOST_PATTERNS (+14 more)

### Community 23 - "RestaurantOrders.tsx"
Cohesion: 0.11
Nodes (28): Kitchen, RestaurantOrders, CollapsibleSection(), colorFor(), lerp(), PrepTimeProgress(), useTicker(), TeamLoginCard() (+20 more)

### Community 24 - "getDb"
Cohesion: 0.11
Nodes (34): ref_drizzle_orm, saas_core_drizzle_schema_index_signuppayload, saas_core_drizzle_schema_index_signuppayments, MasterPanelSettings, SignupPayload, SignupPayment, signupPayments, SignupPaymentStatus (+26 more)

### Community 25 - "routers/team.ts"
Cohesion: 0.08
Nodes (45): InsertUser, restaurantStaffCredentials, createAddonGroup(), createAddonOptions(), createCategory(), createProduct(), now, seed() (+37 more)

### Community 26 - "admin/orders.ts"
Cohesion: 0.09
Nodes (38): orderChangeLogs, orderItemAddons, orderItems, orders, orderStatusHistory, payments, printJobs, adminContext (+30 more)

### Community 27 - "admin.ts"
Cohesion: 0.10
Nodes (17): adminContext, mocks, additionalAdminContext, mocks, adminContext, mocks, mergeRouters, adminContext (+9 more)

### Community 28 - "ref_vitest"
Cohesion: 0.05
Nodes (47): ref_vitest, mocks, mocks, adminContext, mocks, adminContext, mocks, publicContext (+39 more)

### Community 29 - "utils.ts"
Cohesion: 0.06
Nodes (18): Checkbox(), HoverCardContent(), PopoverContent(), Progress(), ResizableHandle(), ResizablePanelGroup(), ScrollArea(), ScrollBar() (+10 more)

### Community 30 - "admin/fiscal.ts"
Cohesion: 0.11
Nodes (32): fiscalSettings, regimeTributarioValues, decryptField(), encryptField(), scrypt, server_db_assignproductfiscalcategory, server_db_confirmfiscalproductionready, server_db_countproductswithoutfiscalcategory (+24 more)

### Community 31 - "payments/types.ts"
Cohesion: 0.14
Nodes (16): createMercadoPagoCheckout(), createMercadoPagoPixPayment(), getMercadoPagoPayment(), PreferenceItem, verifyMercadoPagoWebhookSignature(), mercadoPagoProvider, mapMercadoPagoStatus(), CreateCardCheckoutInput (+8 more)

### Community 32 - "db/reports.ts"
Cohesion: 0.11
Nodes (28): categories, products, server_db_getreportsadvanced, server_db_getreportscomplete, CompletedOrderRow, csvEscape(), dayKey(), dayLabel() (+20 more)

### Community 33 - "devDependencies"
Cohesion: 0.07
Nodes (30): devDependencies, cross-env, drizzle-kit, esbuild, eslint, fake-indexeddb, jsdom, pnpm (+22 more)

### Community 34 - "item.tsx"
Cohesion: 0.08
Nodes (26): BreadcrumbEllipsis(), BreadcrumbItem(), BreadcrumbLink(), BreadcrumbList(), BreadcrumbPage(), BreadcrumbSeparator(), ButtonGroup(), ButtonGroupSeparator() (+18 more)

### Community 35 - "nfceEmission.ts"
Cohesion: 0.10
Nodes (28): fiscalDocuments, fiscalTaxCategories, buildFocusNfeItems(), emit(), emitNfceForTableSession(), EmitParams, findBlockingProduct(), FiscalCategoryRow (+20 more)

### Community 36 - "sdk.ts"
Cohesion: 0.09
Nodes (20): API_URL, User, ref_cookie, AuthenticatedUser, CookieCall, isNonEmptyString(), sdk, SessionPayload (+12 more)

### Community 37 - "saas-core/client/src/App.tsx"
Cohesion: 0.11
Nodes (24): Aparencia, App(), ComercialCardapio, ComercialConfirmando, ComercialHome, ComercialPlanos, ComercialPrivacidade, ComercialSucesso (+16 more)

### Community 38 - "alert-dialog.tsx"
Cohesion: 0.11
Nodes (18): AlertDialogAction(), AlertDialogCancel(), AlertDialogContent(), AlertDialogDescription(), AlertDialogFooter(), AlertDialogHeader(), AlertDialogOverlay(), AlertDialogPortal() (+10 more)

### Community 39 - "comercial/Home.tsx"
Cohesion: 0.14
Nodes (24): COMPARISON, DIFERENCIAIS, Home(), Icon(), IconBolt(), IconCard(), IconCheck(), IconCheckShield() (+16 more)

### Community 40 - "saas-core/shared/deriveSurfacePalette.ts"
Cohesion: 0.13
Nodes (21): bestTextColor(), clampLightness(), contrastRatio(), DerivedSurfaceRoles, deriveSurfacePalette(), hexToRgb(), HSL, hslToRgb() (+13 more)

### Community 41 - "shared/deriveSurfacePalette.ts"
Cohesion: 0.13
Nodes (21): bestTextColor(), clampLightness(), contrastRatio(), DerivedSurfaceRoles, deriveSurfacePalette(), hexToRgb(), HSL, hslToRgb() (+13 more)

### Community 42 - "input-group.tsx"
Cohesion: 0.11
Nodes (20): Alert(), AlertDescription(), AlertTitle(), alertVariants, InputGroup(), InputGroupAddon(), inputGroupAddonVariants, InputGroupButton() (+12 more)

### Community 43 - "Equipe.tsx"
Cohesion: 0.10
Nodes (26): Equipe, RestaurantList, Badge(), STATUS_TONE, Button(), Variant, VARIANT_CLASSES, ConfirmDialog() (+18 more)

### Community 44 - "scripts/backup-db.mjs"
Cohesion: 0.08
Nodes (25): client, policy, ref_aws_sdk_client_s3, ref_node_child_process, ref_node_stream, ref_node_util, execFileAsync, parsed (+17 more)

### Community 45 - "client/src/main.tsx"
Cohesion: 0.18
Nodes (15): client_src_index, CATALOG_CACHE_BUSTER, CATALOG_CACHE_MAX_AGE_MS, catalogPersister, idbStorage, shouldDehydrateCatalogQuery(), queryClient, trpcClient (+7 more)

### Community 46 - "saas-core/server/routers/support.ts"
Cohesion: 0.21
Nodes (12): saas_core_drizzle_schema_index_supportsessions, generateSupportToken(), hashSupportToken(), createSupportSession(), getOwnSupportSession(), getSupportSessionById(), markSupportSessionEnded(), markSupportSessionUsed() (+4 more)

### Community 47 - "devDependencies"
Cohesion: 0.10
Nodes (20): devDependencies, cross-env, drizzle-kit, esbuild, eslint, tailwindcss, @tailwindcss/vite, tsx (+12 more)

### Community 48 - "compilerOptions"
Cohesion: 0.10
Nodes (19): compilerOptions, allowImportingTsExtensions, baseUrl, esModuleInterop, incremental, jsx, lib, module (+11 more)

### Community 49 - "compilerOptions"
Cohesion: 0.10
Nodes (19): compilerOptions, allowImportingTsExtensions, baseUrl, esModuleInterop, incremental, jsx, lib, module (+11 more)

### Community 50 - "Cadastro.tsx"
Cohesion: 0.22
Nodes (12): ComercialCadastro, Input(), useMercadoPagoSecurity(), Cadastro(), money(), PLAN_LABELS, centsToReaisInput(), money() (+4 more)

### Community 51 - "telegramService.ts"
Cohesion: 0.14
Nodes (24): computeDeploymentPorts(), DeploymentPorts, execFileAsync, provisionSystemInstance(), slugifyRestaurantName(), buildEnvironmentProvisionedMessage(), buildEnvironmentProvisioningFailedMessage(), buildMenuReferenceCaption() (+16 more)

### Community 52 - "dependencies"
Cohesion: 0.11
Nodes (18): dependencies, @aws-sdk/client-s3, cookie, dotenv, drizzle-orm, express, jose, mysql2 (+10 more)

### Community 53 - "PromotionManager.tsx"
Cohesion: 0.15
Nodes (16): AddonDefaultKey, addonKey(), blank, CatalogAddonGroup, CatalogAddonOption, CatalogCategory, CatalogProduct, Form (+8 more)

### Community 54 - "dropdown-menu.tsx"
Cohesion: 0.15
Nodes (8): DropdownMenuCheckboxItem(), DropdownMenuLabel(), DropdownMenuRadioItem(), DropdownMenuSeparator(), DropdownMenuShortcut(), DropdownMenuSubContent(), DropdownMenuSubTrigger(), @radix-ui/react-dropdown-menu

### Community 55 - "schema.ts"
Cohesion: 0.08
Nodes (40): accountAuditLog, categoryTimeAvailabilityValues, customerAddresses, customerChangeLogs, customers, deliveryRoutes, faqItems, fiscalDocumentStatusValues (+32 more)

### Community 56 - "components.json"
Cohesion: 0.12
Nodes (15): aliases, components, hooks, lib, ui, utils, rsc, $schema (+7 more)

### Community 57 - "scripts"
Cohesion: 0.09
Nodes (22): body-parser, express>path-to-regexp, fast-xml-parser, qs, pnpm, overrides, scripts, backup (+14 more)

### Community 58 - "Planos.tsx"
Cohesion: 0.20
Nodes (14): PageMeta, upsertMeta(), usePageMeta(), setMeta(), BASE_INCLUDES, FEATURE_DESCRIPTIONS, Icon(), IconCheck() (+6 more)

### Community 59 - "saas-core/package.json"
Cohesion: 0.05
Nodes (42): @types/cookie, description, @aws-sdk/client-s3, cookie, cross-env, dotenv, drizzle-kit, drizzle-orm (+34 more)

### Community 60 - "scripts"
Cohesion: 0.12
Nodes (16): scripts, backup, bootstrap-admin, build, check, create-restaurant, db:migrate, db:push (+8 more)

### Community 61 - "carousel.tsx"
Cohesion: 0.17
Nodes (14): Carousel(), CarouselApi, CarouselContent(), CarouselContext, CarouselContextProps, CarouselItem(), CarouselNext(), CarouselOptions (+6 more)

### Community 62 - "PanelLayout.tsx"
Cohesion: 0.15
Nodes (18): ref_trpc_react_query, AuditLog, Login, Manutencao, NAV_ITEMS, PanelLayout(), usePlatformAuth(), applyPanelTheme() (+10 more)

### Community 63 - "trial-expiry.test.ts"
Cohesion: 0.10
Nodes (22): saas_core_drizzle_schema_index_features, saas_core_drizzle_schema_index_planfeatures, saas_core_drizzle_schema_index_plankey, saas_core_drizzle_schema_index_planlimits, Feature, features, Plan, PlanFeature (+14 more)

### Community 64 - "pwa-install-placement.test.ts"
Cohesion: 0.13
Nodes (11): @testing-library/react, mockLockedFeatures, mocks, BASE_SETTINGS, mockLockedFeatures, mocks, adminSource, appSource (+3 more)

### Community 65 - "restaurant-panel-ui.test.ts"
Cohesion: 0.19
Nodes (11): advanceOrderStatus(), getNextOrderStatus(), NextOrderStatus, OrderFulfillmentType, OrderOperationalStatus, OrderStatusMutationInput, appSource, checkoutSource (+3 more)

### Community 66 - "admin/audit.ts"
Cohesion: 0.11
Nodes (19): Camada SaaS — `saas-core/` (billing, Painel Master, Modo Suporte), Como rodar localmente (o usuário já sabe fazer isso, é referência), Estrutura de páginas, MM System Creator — Sistema de pedidos (contexto do projeto), O que é, Regras gerais ao mexer neste projeto, Sobre o usuário (Maycon), Stack técnica (+11 more)

### Community 67 - "form.tsx"
Cohesion: 0.19
Nodes (12): FormControl(), FormDescription(), FormFieldContext, FormFieldContextValue, FormItem(), FormItemContext, FormItemContextValue, FormLabel() (+4 more)

### Community 68 - "ref_node_fs"
Cohesion: 0.14
Nodes (10): ref_mysql2, ref_node_fs, accessManagerSource, adminSource, sidebarSource, uploadSource, catalogSource, routerSource (+2 more)

### Community 69 - "support-mode-access.test.ts"
Cohesion: 0.25
Nodes (6): anonymousContext, mocks, now, REAL_ADMIN, SUPPORT_SESSION, supportOnlyContext

### Community 70 - "TableMapManager.tsx"
Cohesion: 0.09
Nodes (43): BenefitsPreview(), FeatureLockedInfo, getFeatureLockedInfo(), UpgradeNudgeModal(), dateLabel(), LIMIT_LABELS, money(), PendingChange (+35 more)

### Community 71 - "ThemeContext.tsx"
Cohesion: 0.19
Nodes (10): SiteTheme, ThemeSwitcher(), Theme, ThemeContext, ThemeContextType, ThemeProvider(), ThemeProviderProps, useTheme() (+2 more)

### Community 72 - "drawer.tsx"
Cohesion: 0.20
Nodes (8): DrawerContent(), DrawerDescription(), DrawerFooter(), DrawerHeader(), DrawerOverlay(), DrawerPortal(), DrawerTitle(), vaul

### Community 73 - "select.tsx"
Cohesion: 0.20
Nodes (8): SelectContent(), SelectItem(), SelectLabel(), SelectScrollDownButton(), SelectScrollUpButton(), SelectSeparator(), SelectTrigger(), @radix-ui/react-select

### Community 74 - "ref_node_path"
Cohesion: 0.16
Nodes (11): PWA_BRANDING, ref_node_path, ref_tailwindcss_vite, ref_vite, vite-plugin-pwa, ref_vitejs_plugin_react, appSource, checkoutSource (+3 more)

### Community 75 - "server/_core/trpc.ts"
Cohesion: 0.12
Nodes (23): baseHeaders(), BillingPaymentEntry, cancelSubscription(), ChangePlanResult, changeSubscriptionPlan(), getBillingPaymentHistory(), getFromSaasCore(), postToSaasCore() (+15 more)

### Community 76 - "PwaInstallContext.tsx"
Cohesion: 0.22
Nodes (7): handleInstall(), BeforeInstallPromptEvent, isStandalone(), PwaInstallContext, PwaInstallProvider(), install(), PwaInstallState

### Community 77 - "navigation-menu.tsx"
Cohesion: 0.22
Nodes (10): NavigationMenu(), NavigationMenuContent(), NavigationMenuIndicator(), NavigationMenuItem(), NavigationMenuLink(), NavigationMenuList(), NavigationMenuTrigger(), navigationMenuTriggerStyle (+2 more)

### Community 78 - "card.tsx"
Cohesion: 0.29
Nodes (8): Card(), CardAction(), CardContent(), CardDescription(), CardFooter(), CardHeader(), CardTitle(), NotFound()

### Community 79 - "menubar.tsx"
Cohesion: 0.12
Nodes (13): Menubar(), MenubarCheckboxItem(), MenubarContent(), MenubarItem(), MenubarLabel(), MenubarPortal(), MenubarRadioItem(), MenubarSeparator() (+5 more)

### Community 80 - "provision-client.mjs"
Cohesion: 0.36
Nodes (8): buildEnvFile(), __dirname, main(), randomSecret(), repoRoot, requiredEnv(), runComposeUp(), waitUntilReady()

### Community 81 - "totp.ts"
Cohesion: 0.46
Nodes (5): otpauth, buildTotp(), buildTotpQrCodeDataUrl(), generateTotpSecret(), verifyTotpToken()

### Community 82 - "saas-core/client/src/main.tsx"
Cohesion: 0.33
Nodes (5): ref_react_dom, API_URL, saas_core_client_src_index, queryClient, trpcClient

### Community 83 - "generate-pwa-icons.ts"
Cohesion: 0.32
Nodes (7): sharp, ICONS_DIR, main(), PUBLIC_DIR, renderSquare(), sampleCornerColor(), SOURCE

### Community 84 - "context-menu.tsx"
Cohesion: 0.12
Nodes (10): ContextMenuCheckboxItem(), ContextMenuContent(), ContextMenuItem(), ContextMenuLabel(), ContextMenuRadioItem(), ContextMenuSeparator(), ContextMenuShortcut(), ContextMenuSubContent() (+2 more)

### Community 85 - "scripts/restore-db.mjs"
Cohesion: 0.25
Nodes (7): args, env, execFileAsync, parsed, scrypt, stamp, walk()

### Community 86 - "ErrorBoundary.tsx"
Cohesion: 0.29
Nodes (3): ErrorBoundary, Props, State

### Community 87 - "link-cardapio-fotos.ts"
Cohesion: 0.33
Nodes (6): ref_node_url, __dirname, FOTOS_DIR, main(), MAPPING, slugify()

### Community 88 - "Dashboard.tsx"
Cohesion: 0.48
Nodes (5): Dashboard, StatTile(), Dashboard(), money(), shortDate()

### Community 89 - "verify-export.mjs"
Cohesion: 0.29
Nodes (6): ignoredDirectories, proprietaryPattern, required, root, textExtensions, walk()

### Community 90 - "Deploy em produção — Hostinger VPS + Docker"
Cohesion: 0.12
Nodes (15): Checklist final, Deploy em produção — Hostinger VPS + Docker, Etapa 10 — Criar o primeiro administrador, Etapa 11 — Testar o menu público, Etapa 12 — Testar o painel administrativo, Etapa 13 — Configurar backup, Etapa 1 — Criar a VPS na Hostinger, Etapa 2 — Instalar Docker no Ubuntu (+7 more)

### Community 91 - "saas-core/server/_core/index.ts"
Cohesion: 0.23
Nodes (13): ref_fs, ref_http, ref_path, APP_VERSION, startServer(), registerMercadoPagoSignupWebhook(), registerMercadoPagoBillingWebhook(), registerMercadoPagoWebhookRoute() (+5 more)

### Community 92 - "Extração do material recebido — MM System Creator"
Cohesion: 0.13
Nodes (14): Adicionais de hambúrgueres, Aplicação no sistema, Bebidas confirmadas pelo restaurante, Cardápio confirmado, Continuação confirmada, Extração do material recebido — MM System Creator, Hambúrgueres especiais confirmados, Identidade visual observada (+6 more)

### Community 93 - "paymentService.ts"
Cohesion: 0.20
Nodes (10): webhookEvents, server_db_markorderpaymentfailedbypubliccode, server_db_markorderpaymentpaidbypubliccode, markOrderPaymentFailedByPublicCode(), markOrderPaymentPaidByPublicCode(), ActiveGateway, applyPaymentStatusNotification(), PROVIDERS (+2 more)

### Community 94 - "home-style.test.ts"
Cohesion: 0.33
Nodes (5): appSource, categoryRailSource, homeSource, styleSource, themeSwitcherSource

### Community 95 - "routers/catalog.ts"
Cohesion: 0.22
Nodes (13): getActiveEvents, getActiveFaqItems, getActivePromotions, getCatalog, getProductDetail(), server_db_getactiveevents, server_db_getactivefaqitems, server_db_getactivepromotions (+5 more)

### Community 96 - "cleanup-test-data.ts"
Cohesion: 0.40
Nodes (3): ref_drizzle_schema, ref_server_db_client, ref_server_db_customers

### Community 97 - "Instalação e operação independente"
Cohesion: 0.15
Nodes (12): Autenticação, Backup e restauração, Banco, migrations e dados existentes, Caminho mais simples: um único comando, Domínio e HTTPS, E-mail e serviços externos, Estado de portabilidade, Instalação com Docker Compose (+4 more)

### Community 98 - "iniciar.sh"
Cohesion: 0.67
Nodes (3): GIT_COMMIT, random_secret(), iniciar.sh script

### Community 100 - "checkRateLimit"
Cohesion: 0.22
Nodes (7): handleLicenseRefresh(), registerLicenseRefreshWebhook(), checkRateLimit(), ACTIVE_MP_GATEWAY, mocks, handleMercadoPagoWebhook(), registerMercadoPagoWebhook()

### Community 109 - "server/_core/index.ts"
Cohesion: 0.31
Nodes (9): ref_dotenv, ref_net, createContext(), APP_VERSION, findAvailablePort(), isPortAvailable(), startServer(), serveStatic() (+1 more)

### Community 110 - "ref_express"
Cohesion: 0.31
Nodes (5): ref_express, supertest, mocks, configureTrustProxy(), buildTestApp()

### Community 111 - "Migração de dados do MM System Creator"
Cohesion: 0.25
Nodes (7): Checklist de reconciliação, Exportação, Importação, Itens que não podem ser migrados por simples dump, Migração de dados do MM System Creator, O que deve ser migrado, Rollback

### Community 112 - "Auditoria de independência do MM System Creator"
Cohesion: 0.29
Nodes (6): Auditoria de independência do MM System Creator, Banco e migração, Critério de independência, Dependências open source, Resumo executivo, Verificação realizada

### Community 113 - "App"
Cohesion: 0.33
Nodes (5): App(), RouteFallback(), Router(), Toaster(), next-themes

### Community 114 - "MM System Creator — sistema independente de pedidos"
Cohesion: 0.33
Nodes (5): Banco e dados, Documentos principais, Execução com um único comando (recomendado), Execução manual (sem Docker, ambiente já com Node e MySQL prontos), MM System Creator — sistema independente de pedidos

### Community 116 - "Arquitetura do Sistema de Pedidos — MM System Creator"
Cohesion: 0.40
Nodes (4): Arquitetura do Sistema de Pedidos — MM System Creator, Impressão de pedidos, Modelo operacional, Segurança e acesso

### Community 117 - "Modelo de dados e camada de acesso"
Cohesion: 0.40
Nodes (4): Camadas, Modelo de dados e camada de acesso, Tabelas, Troca futura de banco

### Community 118 - "Manifesto de assets do MM System Creator"
Cohesion: 0.50
Nodes (3): Arquivos incluídos na exportação, Exceções e procedimento, Manifesto de assets do MM System Creator

## Knowledge Gaps
- **918 isolated node(s):** `client`, `policy`, `UseAuthOptions`, `Group`, `Option` (+913 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1153 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **18 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `otpauth` connect `totp.ts` to `saas-core/package.json`?**
  _High betweenness centrality (0.056) - this node is a cross-community bridge._
- **Why does `lucide-react` connect `lucide-react` to `ref_react`, `client/src/lib/trpc.ts`, `cn`, `package.json`, `sidebar.tsx`, `client/src/App.tsx`, `TableSession.tsx`, `RestaurantOrders.tsx`, `utils.ts`, `item.tsx`, `alert-dialog.tsx`, `PromotionManager.tsx`, `dropdown-menu.tsx`, `carousel.tsx`, `TableMapManager.tsx`, `ThemeContext.tsx`, `select.tsx`, `navigation-menu.tsx`, `card.tsx`, `menubar.tsx`, `context-menu.tsx`, `ErrorBoundary.tsx`?**
  _High betweenness centrality (0.049) - this node is a cross-community bridge._
- **Why does `dependencies` connect `dependencies` to `package.json`?**
  _High betweenness centrality (0.048) - this node is a cross-community bridge._
- **What connects `client`, `policy`, `UseAuthOptions` to the rest of the system?**
  _918 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `ref_react` be split into smaller, more focused modules?**
  _Cohesion score 0.05982008995502249 - nodes in this community are weakly interconnected._
- **Should `db/restaurants.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.04915514592933948 - nodes in this community are weakly interconnected._
- **Should `storage.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.10384068278805121 - nodes in this community are weakly interconnected._