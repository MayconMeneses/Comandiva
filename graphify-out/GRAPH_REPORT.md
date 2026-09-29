# Graph Report - Pubx  (2026-09-29)

## Corpus Check
- 617 files · ~998,385 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 16 file(s) not represented in the graph (top: (none) 9, .xml 2, .css 2)

## Summary
- 3028 nodes · 8380 edges · 119 communities (104 shown, 15 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 70 edges (avg confidence: 0.87)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `f3e05832`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Button
- getDb
- server/_core/trpc.ts
- client/src/lib/trpc.ts
- admin/tables.ts
- auth.ts
- cn
- package.json
- sidebar.tsx
- dependencies
- server/_core/env.ts
- schema.ts
- routers/dataRights.ts
- saas-core/server/_core/context.ts
- lucide-react
- TableSession.tsx
- subscription.ts
- saas-core/server/_core/trpc.ts
- saas-core/server/_core/index.ts
- db/platformAdmins.ts
- server/_core/index.ts
- db.ts
- db/restaurants.ts
- RestaurantOrders.tsx
- db/signupPayments.ts
- routers/team.ts
- admin/orders.ts
- settings-colortheme-gate.test.ts
- routers.ts
- utils.ts
- getDb
- payments/types.ts
- db/reports.ts
- devDependencies
- item.tsx
- nfceEmission.ts
- server/_core/context.ts
- saas-core/client/src/App.tsx
- alert-dialog.tsx
- comercial/Home.tsx
- saas-core/shared/deriveSurfacePalette.ts
- shared/deriveSurfacePalette.ts
- class-variance-authority
- Equipe.tsx
- scripts/backup-db.mjs
- client/src/main.tsx
- masterPanel/settings.ts
- devDependencies
- compilerOptions
- compilerOptions
- Plans.tsx
- telegramService.ts
- dependencies
- PromotionManager.tsx
- dropdown-menu.tsx
- errors.ts
- components.json
- scripts
- Planos.tsx
- saas-core/package.json
- scripts
- carousel.tsx
- PanelLayout.tsx
- useComposition.ts
- pwa-install-placement.test.ts
- restaurant-panel-ui.test.ts
- MM System Creator — Sistema de pedidos (contexto do projeto)
- form.tsx
- ref_node_fs
- support-mode-access.test.ts
- ref_react
- schema/subscriptions.ts
- drawer.tsx
- select.tsx
- ref_node_path
- _core/billing.ts
- PwaInstallContext.tsx
- navigation-menu.tsx
- card.tsx
- menubar.tsx
- provision-client.mjs
- totp.ts
- saas-core/client/src/main.tsx
- generate-pwa-icons.ts
- accordion.tsx
- scripts/restore-db.mjs
- ErrorBoundary.tsx
- overrides
- Dashboard.tsx
- verify-export.mjs
- Deploy em produção — Hostinger VPS + Docker
- order-create-idempotency.test.ts
- Extração do material recebido — MM System Creator
- ref_vitest
- home-style.test.ts
- pending-order-wiring.test.ts
- cleanup-test-data.ts
- Instalação e operação independente
- iniciar.sh
- upgrade-pubx-premium.ts
- ref_drizzle_kit
- env.ts
- infra/entrypoint.sh
- saas-core/infra/entrypoint.sh
- smoke-independent.mjs
- cookie.d.ts
- Migração de dados do MM System Creator
- Auditoria de independência do MM System Creator
- MM System Creator — sistema independente de pedidos
- Modelo de dados e camada de acesso
- Manifesto de assets do MM System Creator
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

## Communities (119 total, 15 thin omitted)

### Community 0 - "Button"
Cohesion: 0.06
Nodes (90): AddonManager(), blankGroup, blankOption, Group, GroupForm, money(), Option, OptionForm (+82 more)

### Community 1 - "getDb"
Cohesion: 0.08
Nodes (53): subscriptionEvents, saas_core_drizzle_schema_index_billingpayments, saas_core_drizzle_schema_index_plans, saas_core_drizzle_schema_index_restaurants, saas_core_drizzle_schema_index_subscriptionevents, saas_core_drizzle_schema_index_subscriptions, saas_core_drizzle_schema_index_subscriptionstatus, plans (+45 more)

### Community 2 - "server/_core/trpc.ts"
Cohesion: 0.06
Nodes (68): Camada SaaS — `saas-core/` (billing, Painel Master, Modo Suporte), Inventário de API, addonGroups, events, faqItems, promotionAddonDefaults, promotionProducts, ref_trpc_server (+60 more)

### Community 3 - "client/src/lib/trpc.ts"
Cohesion: 0.10
Nodes (47): AccountAdmin(), AppearanceSettings(), ACCOUNT_ACTION_LABELS, AuditLog(), CHANGE_TYPE_LABELS, CatalogAdmin(), Customers(), BenefitsPreview() (+39 more)

### Community 4 - "admin/tables.ts"
Cohesion: 0.05
Nodes (76): customerAddresses, customerChangeLogs, restaurantTables, tableBillPayments, tableReservations, tableServiceRequests, tableSessions, restaurantProcedure (+68 more)

### Community 5 - "auth.ts"
Cohesion: 0.08
Nodes (30): platformAuditLog, PlatformAuditLogEntry, SubscriptionEvent, webhookEvents, saas_core_drizzle_schema_index_platformauditlog, TrpcContext, askMaintenanceAssistant(), buildSnapshot() (+22 more)

### Community 6 - "cn"
Cohesion: 0.04
Nodes (64): BreadcrumbEllipsis(), BreadcrumbItem(), BreadcrumbLink(), BreadcrumbList(), BreadcrumbPage(), BreadcrumbSeparator(), Command(), CommandGroup() (+56 more)

### Community 7 - "package.json"
Cohesion: 0.03
Nodes (52): @aws-sdk/client-s3, cookie, cross-env, dotenv, drizzle-kit, drizzle-orm, esbuild, eslint (+44 more)

### Community 8 - "sidebar.tsx"
Cohesion: 0.06
Nodes (59): ACCESS_BLOCKED_COPY, TrialEndedBlock(), TrialEndingBanner(), DashboardLayout(), DashboardLayoutContent(), DashboardLayoutContentProps, dateLabel(), menuItems (+51 more)

### Community 9 - "dependencies"
Cohesion: 0.03
Nodes (65): dependencies, @aws-sdk/client-s3, @aws-sdk/s3-request-presigner, class-variance-authority, clsx, cmdk, cookie, dotenv (+57 more)

### Community 10 - "server/_core/env.ts"
Cohesion: 0.16
Nodes (12): ref_jose, createDataRightsToken(), getSecret(), verifyDataRightsToken(), ENV, sendSms(), createSupportSessionToken(), getSecret() (+4 more)

### Community 11 - "schema.ts"
Cohesion: 0.07
Nodes (37): accountAuditLog, categoryTimeAvailabilityValues, fiscalDocumentStatusValues, fiscalEnvironmentValues, orderChangeLogs, orderItems, orders, OrderStatus (+29 more)

### Community 12 - "routers/dataRights.ts"
Cohesion: 0.08
Nodes (36): customers, paymentGateways, phoneVerificationCodes, apply, inactive, lastOrderByCustomerId, attempts, checkDistinctRateLimit() (+28 more)

### Community 13 - "saas-core/server/_core/context.ts"
Cohesion: 0.12
Nodes (18): saas_core_drizzle_schema_index_restaurant, generateApiKey(), hashApiKey(), { dbMocks, TEST_JWT_SECRET }, SECRET_BYTES, createContext(), PlatformAdminContext, createPlatformSessionToken() (+10 more)

### Community 14 - "lucide-react"
Cohesion: 0.09
Nodes (42): Admin, DataRights, RouteFallback(), Router(), SupportEntry, AppearanceSettingsProps, FeatureLockedInfo, ServiceSection() (+34 more)

### Community 15 - "TableSession.tsx"
Cohesion: 0.10
Nodes (48): App(), TableSession, CategoryProductSections(), money(), useCategoryScrollSpy(), digits(), money(), NewCounterOrder() (+40 more)

### Community 16 - "subscription.ts"
Cohesion: 0.08
Nodes (41): accessReleased, AccessReleasedVars, passwordReset, PasswordResetVars, restaurantReady, RestaurantReadyVars, welcome, WelcomeVars (+33 more)

### Community 17 - "saas-core/server/_core/trpc.ts"
Cohesion: 0.07
Nodes (38): ref_node_crypto, saas_core_drizzle_schema_index_supportsessions, SupportSession, supportSessions, createSubscriptionPreapproval(), generateSupportToken(), hashSupportToken(), alertOnUnintentionalInternalError() (+30 more)

### Community 18 - "saas-core/server/_core/index.ts"
Cohesion: 0.08
Nodes (37): ref_express, ref_path, saas_core_drizzle_schema_index_webhookevents, mocks, SendEmailResult, sendViaResend(), sendEmail(), SendEmailOutcome (+29 more)

### Community 19 - "db/platformAdmins.ts"
Cohesion: 0.08
Nodes (40): ref_dotenv, saas_core_drizzle_schema_index_platformadminrole, saas_core_drizzle_schema_index_platformadmins, InsertPlatformAdmin, PlatformAdmin, PlatformAdminRole, platformAdminRoleValues, platformAdmins (+32 more)

### Community 20 - "server/_core/index.ts"
Cohesion: 0.10
Nodes (28): ref_fs, ref_http, ref_net, nodemailer, supertest, mockEnv, AlertSeverity, DEFAULT_SEVERITY_BY_KIND (+20 more)

### Community 21 - "db.ts"
Cohesion: 0.06
Nodes (59): deliveryRoutes, restaurantStaffCredentials, buildSnapshot(), FEATURE_IDS, FeatureId, fetchPlanCatalog(), forceSyncLicense(), getCachedLicenseSnapshot (+51 more)

### Community 22 - "db/restaurants.ts"
Cohesion: 0.09
Nodes (39): saas_core_drizzle_schema_index_plankeyvalues, saas_core_drizzle_schema_index_restaurantstatus, saas_core_drizzle_schema_index_restaurantstatusvalues, saas_core_drizzle_schema_index_subscriptionstatusvalues, planKeyValues, InsertRestaurant, Restaurant, RestaurantStatus (+31 more)

### Community 23 - "RestaurantOrders.tsx"
Cohesion: 0.10
Nodes (31): Kitchen, RestaurantOrders, CollapsibleSection(), OrderStatusActions(), colorFor(), lerp(), PrepTimeProgress(), useTicker() (+23 more)

### Community 24 - "db/signupPayments.ts"
Cohesion: 0.06
Nodes (48): saas_core_drizzle_schema_index_features, saas_core_drizzle_schema_index_planfeatures, saas_core_drizzle_schema_index_plankey, saas_core_drizzle_schema_index_planlimits, saas_core_drizzle_schema_index_signuppayload, saas_core_drizzle_schema_index_signuppayments, Feature, features (+40 more)

### Community 25 - "routers/team.ts"
Cohesion: 0.09
Nodes (41): InsertUser, createAddonGroup(), createAddonOptions(), createCategory(), createProduct(), now, seed(), parseStaffPermissions() (+33 more)

### Community 26 - "admin/orders.ts"
Cohesion: 0.07
Nodes (57): orderItemAddons, @aws-sdk/s3-request-presigner, client, downloaded, payload, emitNfceForOrder(), retryNfceForOrder(), getFiscalDocumentByOrderId() (+49 more)

### Community 27 - "settings-colortheme-gate.test.ts"
Cohesion: 0.11
Nodes (14): adminContext, mocks, additionalAdminContext, mocks, adminContext, mocks, adminContext, mocks (+6 more)

### Community 28 - "routers.ts"
Cohesion: 0.07
Nodes (26): licenseMocks, publicContext, TrpcContext, getSessionCookieOptions(), isSecureRequest(), systemRouter, mocks, publicContext (+18 more)

### Community 29 - "utils.ts"
Cohesion: 0.05
Nodes (22): Checkbox(), HoverCardContent(), InputOTP(), InputOTPGroup(), InputOTPSlot(), PopoverContent(), Progress(), ResizableHandle() (+14 more)

### Community 30 - "getDb"
Cohesion: 0.06
Nodes (63): addonOptions, fiscalSettings, products, promotions, regimeTributarioValues, restaurantSettings, ensurePizzaSizes(), findCategoryId() (+55 more)

### Community 31 - "payments/types.ts"
Cohesion: 0.08
Nodes (19): createMercadoPagoCheckout(), createMercadoPagoPixPayment(), getMercadoPagoPayment(), PreferenceItem, verifyMercadoPagoWebhookSignature(), ACTIVE_MP_GATEWAY, mocks, mercadoPagoProvider (+11 more)

### Community 32 - "db/reports.ts"
Cohesion: 0.12
Nodes (26): categories, server_db_getreportsadvanced, server_db_getreportscomplete, CompletedOrderRow, csvEscape(), dayKey(), dayLabel(), fetchCompletedOrders() (+18 more)

### Community 33 - "devDependencies"
Cohesion: 0.06
Nodes (31): devDependencies, cross-env, drizzle-kit, esbuild, eslint, eslint-plugin-react-hooks, fake-indexeddb, jsdom (+23 more)

### Community 34 - "item.tsx"
Cohesion: 0.11
Nodes (21): ButtonGroup(), ButtonGroupSeparator(), ButtonGroupText(), buttonGroupVariants, FieldSeparator(), Item(), ItemActions(), ItemContent() (+13 more)

### Community 35 - "nfceEmission.ts"
Cohesion: 0.10
Nodes (27): fiscalDocuments, fiscalTaxCategories, buildFocusNfeItems(), emit(), emitNfceForTableSession(), EmitParams, findBlockingProduct(), FiscalCategoryRow (+19 more)

### Community 36 - "server/_core/context.ts"
Cohesion: 0.13
Nodes (15): User, ref_cookie, adminContext, mocks, publicContext, AuthenticatedUser, CookieCall, sdk (+7 more)

### Community 37 - "saas-core/client/src/App.tsx"
Cohesion: 0.13
Nodes (20): ref_wouter, Aparencia, App(), ComercialCadastro, ComercialCardapio, ComercialConfirmando, ComercialSucesso, Manutencao (+12 more)

### Community 38 - "alert-dialog.tsx"
Cohesion: 0.10
Nodes (21): AlertDialogAction(), AlertDialogCancel(), AlertDialogContent(), AlertDialogDescription(), AlertDialogFooter(), AlertDialogHeader(), AlertDialogOverlay(), AlertDialogPortal() (+13 more)

### Community 39 - "comercial/Home.tsx"
Cohesion: 0.13
Nodes (25): ComercialHome, COMPARISON, DIFERENCIAIS, Home(), Icon(), IconBolt(), IconCard(), IconCheck() (+17 more)

### Community 40 - "saas-core/shared/deriveSurfacePalette.ts"
Cohesion: 0.13
Nodes (21): bestTextColor(), clampLightness(), contrastRatio(), DerivedSurfaceRoles, deriveSurfacePalette(), hexToRgb(), HSL, hslToRgb() (+13 more)

### Community 41 - "shared/deriveSurfacePalette.ts"
Cohesion: 0.13
Nodes (21): bestTextColor(), clampLightness(), contrastRatio(), DerivedSurfaceRoles, deriveSurfacePalette(), hexToRgb(), HSL, hslToRgb() (+13 more)

### Community 42 - "class-variance-authority"
Cohesion: 0.18
Nodes (12): Alert(), AlertDescription(), AlertTitle(), alertVariants, ToggleGroup(), ToggleGroupContext, ToggleGroupItem(), Toggle() (+4 more)

### Community 43 - "Equipe.tsx"
Cohesion: 0.09
Nodes (35): Equipe, RestaurantDetail, RestaurantList, PanelLayout(), Badge(), STATUS_TONE, Button(), Variant (+27 more)

### Community 44 - "scripts/backup-db.mjs"
Cohesion: 0.09
Nodes (24): ref_node_child_process, ref_node_stream, ref_node_url, ref_node_util, execFileAsync, parsed, password, scrypt (+16 more)

### Community 45 - "client/src/main.tsx"
Cohesion: 0.16
Nodes (16): API_URL, client_src_index, CATALOG_CACHE_BUSTER, CATALOG_CACHE_MAX_AGE_MS, catalogPersister, idbStorage, shouldDehydrateCatalogQuery(), queryClient (+8 more)

### Community 46 - "masterPanel/settings.ts"
Cohesion: 0.17
Nodes (11): saas_core_drizzle_schema_index_masterpanelsettings, MasterPanelSettings, platformAdminProcedure, getMasterPanelSettings(), setMasterPanelBackgroundColor(), masterPanelSettingsRouter, MEMBER_WITH_APARENCIA, MEMBER_WITHOUT_APARENCIA (+3 more)

### Community 47 - "devDependencies"
Cohesion: 0.10
Nodes (20): devDependencies, cross-env, drizzle-kit, esbuild, eslint, tailwindcss, @tailwindcss/vite, tsx (+12 more)

### Community 48 - "compilerOptions"
Cohesion: 0.10
Nodes (19): compilerOptions, allowImportingTsExtensions, baseUrl, esModuleInterop, incremental, jsx, lib, module (+11 more)

### Community 49 - "compilerOptions"
Cohesion: 0.10
Nodes (19): compilerOptions, allowImportingTsExtensions, baseUrl, esModuleInterop, incremental, jsx, lib, module (+11 more)

### Community 50 - "Plans.tsx"
Cohesion: 0.39
Nodes (7): Plans, centsToReaisInput(), money(), PlanRow, Plans(), reaisInputToCents(), usePlansData()

### Community 51 - "telegramService.ts"
Cohesion: 0.19
Nodes (15): computeDeploymentPorts(), DeploymentPorts, execFileAsync, provisionSystemInstance(), slugifyRestaurantName(), buildEnvironmentProvisionedMessage(), buildEnvironmentProvisioningFailedMessage(), buildSystemErrorMessage() (+7 more)

### Community 52 - "dependencies"
Cohesion: 0.11
Nodes (18): dependencies, @aws-sdk/client-s3, cookie, dotenv, drizzle-orm, express, jose, mysql2 (+10 more)

### Community 53 - "PromotionManager.tsx"
Cohesion: 0.15
Nodes (16): AddonDefaultKey, addonKey(), blank, CatalogAddonGroup, CatalogAddonOption, CatalogCategory, CatalogProduct, Form (+8 more)

### Community 54 - "dropdown-menu.tsx"
Cohesion: 0.15
Nodes (8): DropdownMenuCheckboxItem(), DropdownMenuLabel(), DropdownMenuRadioItem(), DropdownMenuSeparator(), DropdownMenuShortcut(), DropdownMenuSubContent(), DropdownMenuSubTrigger(), @radix-ui/react-dropdown-menu

### Community 55 - "errors.ts"
Cohesion: 0.21
Nodes (7): isNonEmptyString(), SessionService, BadRequestError(), ForbiddenError(), HttpError, NotFoundError(), UnauthorizedError()

### Community 56 - "components.json"
Cohesion: 0.12
Nodes (15): aliases, components, hooks, lib, ui, utils, rsc, $schema (+7 more)

### Community 57 - "scripts"
Cohesion: 0.12
Nodes (16): scripts, backup, build, check, db:migrate, db:push, db:validate-migration, dev (+8 more)

### Community 58 - "Planos.tsx"
Cohesion: 0.15
Nodes (22): ComercialPlanos, ComercialPrivacidade, ComercialTermos, PageMeta, upsertEl(), usePageMeta(), setMeta(), ComercialFooter() (+14 more)

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
Cohesion: 0.22
Nodes (10): ref_trpc_react_query, AuditLog, Login, NAV_ITEMS, usePlatformAuth(), trpc, useNoIndex(), AuditRow (+2 more)

### Community 63 - "useComposition.ts"
Cohesion: 0.33
Nodes (5): TimerResponse, UseCompositionOptions, UseCompositionReturn, noop, usePersistFn()

### Community 64 - "pwa-install-placement.test.ts"
Cohesion: 0.13
Nodes (11): @testing-library/react, mockLockedFeatures, mocks, BASE_SETTINGS, mockLockedFeatures, mocks, adminSource, appSource (+3 more)

### Community 65 - "restaurant-panel-ui.test.ts"
Cohesion: 0.18
Nodes (9): NextOrderStatus, OrderFulfillmentType, OrderOperationalStatus, OrderStatusMutationInput, appSource, checkoutSource, { mutateMock }, orderManagementSource (+1 more)

### Community 66 - "MM System Creator — Sistema de pedidos (contexto do projeto)"
Cohesion: 0.12
Nodes (13): Como rodar localmente (o usuário já sabe fazer isso, é referência), Decisões importantes já tomadas (não refazer sem necessidade), Estrutura de páginas, MM System Creator — Sistema de pedidos (contexto do projeto), O que é, Regras gerais ao mexer neste projeto, Sobre o usuário (Maycon), Stack técnica (+5 more)

### Community 67 - "form.tsx"
Cohesion: 0.19
Nodes (12): FormControl(), FormDescription(), FormFieldContext, FormFieldContextValue, FormItem(), FormItemContext, FormItemContextValue, FormLabel() (+4 more)

### Community 68 - "ref_node_fs"
Cohesion: 0.14
Nodes (10): ref_mysql2, ref_node_fs, accessManagerSource, adminSource, sidebarSource, uploadSource, catalogSource, routerSource (+2 more)

### Community 69 - "support-mode-access.test.ts"
Cohesion: 0.21
Nodes (9): anonymousContext, mocks, now, REAL_ADMIN, SUPPORT_SESSION, supportOnlyContext, GRANTABLE_STAFF_AREAS, STAFF_AREA_LABELS (+1 more)

### Community 70 - "ref_react"
Cohesion: 0.06
Nodes (74): getFeatureLockedInfo(), UpgradeNudgeModal(), dateLabel(), LIMIT_LABELS, money(), PendingChange, PlanAdmin(), STATUS_LABELS (+66 more)

### Community 71 - "schema/subscriptions.ts"
Cohesion: 0.29
Nodes (6): BillingPayment, InsertSubscription, Subscription, SubscriptionGateway, subscriptionGatewayValues, SubscriptionStatus

### Community 72 - "drawer.tsx"
Cohesion: 0.20
Nodes (8): DrawerContent(), DrawerDescription(), DrawerFooter(), DrawerHeader(), DrawerOverlay(), DrawerPortal(), DrawerTitle(), vaul

### Community 73 - "select.tsx"
Cohesion: 0.20
Nodes (8): SelectContent(), SelectItem(), SelectLabel(), SelectScrollDownButton(), SelectScrollUpButton(), SelectSeparator(), SelectTrigger(), @radix-ui/react-select

### Community 74 - "ref_node_path"
Cohesion: 0.25
Nodes (7): PWA_BRANDING, ref_node_path, ref_tailwindcss_vite, ref_vite, vite-plugin-pwa, ref_vitejs_plugin_react, templateRoot

### Community 75 - "_core/billing.ts"
Cohesion: 0.38
Nodes (10): baseHeaders(), BillingPaymentEntry, cancelSubscription(), ChangePlanResult, changeSubscriptionPlan(), getBillingPaymentHistory(), getFromSaasCore(), postToSaasCore() (+2 more)

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

### Community 84 - "accordion.tsx"
Cohesion: 0.33
Nodes (4): AccordionContent(), AccordionItem(), AccordionTrigger(), @radix-ui/react-accordion

### Community 85 - "scripts/restore-db.mjs"
Cohesion: 0.17
Nodes (10): client, policy, ref_aws_sdk_client_s3, args, env, execFileAsync, parsed, scrypt (+2 more)

### Community 86 - "ErrorBoundary.tsx"
Cohesion: 0.29
Nodes (3): ErrorBoundary, Props, State

### Community 87 - "overrides"
Cohesion: 0.33
Nodes (6): body-parser, express>path-to-regexp, fast-xml-parser, qs, pnpm, overrides

### Community 88 - "Dashboard.tsx"
Cohesion: 0.48
Nodes (5): Dashboard, StatTile(), Dashboard(), money(), shortDate()

### Community 89 - "verify-export.mjs"
Cohesion: 0.29
Nodes (6): ignoredDirectories, proprietaryPattern, required, root, textExtensions, walk()

### Community 90 - "Deploy em produção — Hostinger VPS + Docker"
Cohesion: 0.12
Nodes (15): Checklist final, Deploy em produção — Hostinger VPS + Docker, Etapa 10 — Criar o primeiro administrador, Etapa 11 — Testar o menu público, Etapa 12 — Testar o painel administrativo, Etapa 13 — Configurar backup, Etapa 1 — Criar a VPS na Hostinger, Etapa 2 — Instalar Docker no Ubuntu (+7 more)

### Community 91 - "order-create-idempotency.test.ts"
Cohesion: 0.33
Nodes (4): BASE_INPUT, makeFakeDb(), mocks, publicContext

### Community 92 - "Extração do material recebido — MM System Creator"
Cohesion: 0.13
Nodes (14): Adicionais de hambúrgueres, Aplicação no sistema, Bebidas confirmadas pelo restaurante, Cardápio confirmado, Continuação confirmada, Extração do material recebido — MM System Creator, Hambúrgueres especiais confirmados, Identidade visual observada (+6 more)

### Community 93 - "ref_vitest"
Cohesion: 0.06
Nodes (20): ref_vitest, CURRENT_PLAN, mocks, NEXT_PLAN, SUBSCRIPTION, mocks, WELCOME_VARS, mocks (+12 more)

### Community 94 - "home-style.test.ts"
Cohesion: 0.33
Nodes (5): appSource, categoryRailSource, homeSource, styleSource, themeSwitcherSource

### Community 95 - "pending-order-wiring.test.ts"
Cohesion: 0.40
Nodes (4): appSource, checkoutSource, counterSource, tableSessionSource

### Community 96 - "cleanup-test-data.ts"
Cohesion: 0.40
Nodes (3): ref_drizzle_schema, ref_server_db_client, ref_server_db_customers

### Community 97 - "Instalação e operação independente"
Cohesion: 0.15
Nodes (12): Autenticação, Backup e restauração, Banco, migrations e dados existentes, Caminho mais simples: um único comando, Domínio e HTTPS, E-mail e serviços externos, Estado de portabilidade, Instalação com Docker Compose (+4 more)

### Community 98 - "iniciar.sh"
Cohesion: 0.67
Nodes (3): GIT_COMMIT, random_secret(), iniciar.sh script

### Community 111 - "Migração de dados do MM System Creator"
Cohesion: 0.25
Nodes (7): Checklist de reconciliação, Exportação, Importação, Itens que não podem ser migrados por simples dump, Migração de dados do MM System Creator, O que deve ser migrado, Rollback

### Community 112 - "Auditoria de independência do MM System Creator"
Cohesion: 0.29
Nodes (6): Auditoria de independência do MM System Creator, Banco e migração, Critério de independência, Dependências open source, Resumo executivo, Verificação realizada

### Community 114 - "MM System Creator — sistema independente de pedidos"
Cohesion: 0.33
Nodes (5): Banco e dados, Documentos principais, Execução com um único comando (recomendado), Execução manual (sem Docker, ambiente já com Node e MySQL prontos), MM System Creator — sistema independente de pedidos

### Community 117 - "Modelo de dados e camada de acesso"
Cohesion: 0.40
Nodes (4): Camadas, Modelo de dados e camada de acesso, Tabelas, Troca futura de banco

### Community 118 - "Manifesto de assets do MM System Creator"
Cohesion: 0.50
Nodes (3): Arquivos incluídos na exportação, Exceções e procedimento, Manifesto de assets do MM System Creator

## Knowledge Gaps
- **930 isolated node(s):** `client`, `policy`, `UseAuthOptions`, `Group`, `Option` (+925 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1167 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **15 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `otpauth` connect `totp.ts` to `saas-core/package.json`?**
  _High betweenness centrality (0.056) - this node is a cross-community bridge._
- **Why does `lucide-react` connect `lucide-react` to `Button`, `client/src/lib/trpc.ts`, `cn`, `package.json`, `sidebar.tsx`, `TableSession.tsx`, `RestaurantOrders.tsx`, `utils.ts`, `alert-dialog.tsx`, `PromotionManager.tsx`, `dropdown-menu.tsx`, `carousel.tsx`, `ref_react`, `select.tsx`, `navigation-menu.tsx`, `card.tsx`, `menubar.tsx`, `accordion.tsx`, `ErrorBoundary.tsx`?**
  _High betweenness centrality (0.049) - this node is a cross-community bridge._
- **Why does `cn()` connect `cn` to `Button`, `item.tsx`, `form.tsx`, `alert-dialog.tsx`, `ref_react`, `sidebar.tsx`, `drawer.tsx`, `class-variance-authority`, `select.tsx`, `navigation-menu.tsx`, `card.tsx`, `menubar.tsx`, `utils.ts`, `accordion.tsx`, `ErrorBoundary.tsx`, `dropdown-menu.tsx`, `carousel.tsx`?**
  _High betweenness centrality (0.048) - this node is a cross-community bridge._
- **What connects `client`, `policy`, `UseAuthOptions` to the rest of the system?**
  _930 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Button` be split into smaller, more focused modules?**
  _Cohesion score 0.05747126436781609 - nodes in this community are weakly interconnected._
- **Should `getDb` be split into smaller, more focused modules?**
  _Cohesion score 0.08294930875576037 - nodes in this community are weakly interconnected._
- **Should `server/_core/trpc.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.055651176133103844 - nodes in this community are weakly interconnected._