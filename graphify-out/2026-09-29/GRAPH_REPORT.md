# Graph Report - Pubx  (2026-09-26)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 2867 nodes · 7706 edges · 109 communities (97 shown, 12 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 57 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `2debb429`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- ref_react
- db/subscriptions.ts
- server/_core/trpc.ts
- lucide-react
- admin/tables.ts
- pages/Home.tsx
- cn
- package.json
- sidebar.tsx
- dependencies
- getDb
- order.ts
- schema.ts
- saas-core/server/_core/context.ts
- client/src/App.tsx
- TableSession.tsx
- subscription.ts
- saas-core/server/_core/trpc.ts
- saas-core/server/_core/index.ts
- getDb
- server/_core/index.ts
- _core/license.ts
- db/restaurants.ts
- RestaurantOrders.tsx
- db/signupPayments.ts
- routers/team.ts
- db/orders.ts
- ref_vitest
- routers.ts
- utils.ts
- admin/fiscal.ts
- payments/types.ts
- db/reports.ts
- devDependencies
- field.tsx
- nfceEmission.ts
- server/_core/context.ts
- saas-core/client/src/App.tsx
- alert-dialog.tsx
- comercial/Home.tsx
- saas-core/shared/deriveSurfacePalette.ts
- shared/deriveSurfacePalette.ts
- class-variance-authority
- RestaurantDetail.tsx
- scripts/backup-db.mjs
- client/src/main.tsx
- saas-core/server/routers/support.ts
- devDependencies
- compilerOptions
- compilerOptions
- saas-core/client/src/lib/trpc.ts
- telegramService.ts
- dependencies
- PromotionManager.tsx
- dropdown-menu.tsx
- server/_core/env.ts
- components.json
- scripts
- Planos.tsx
- Equipe.tsx
- scripts
- carousel.tsx
- PanelLayout.tsx
- errors.ts
- appearance-settings-ui.test.ts
- restaurant-panel-ui.test.ts
- breadcrumb.tsx
- form.tsx
- ref_node_fs
- support-mode-access.test.ts
- PlanAdmin.tsx
- ThemeContext.tsx
- drawer.tsx
- select.tsx
- pwa-install-placement.test.ts
- _core/billing.ts
- PwaInstallContext.tsx
- navigation-menu.tsx
- card.tsx
- input-group.tsx
- provision-client.mjs
- totp.ts
- saas-core/client/src/main.tsx
- generate-pwa-icons.ts
- Plans.tsx
- scripts/restore-db.mjs
- ErrorBoundary.tsx
- saas-core/scripts/restore-db.mjs
- Dashboard.tsx
- verify-export.mjs
- input-otp.tsx
- popover.tsx
- overrides
- Equipe
- home-style.test.ts
- order-create-idempotency.test.ts
- cleanup-test-data.ts
- collapsible.tsx
- iniciar.sh
- upgrade-pubx-premium.ts
- aspect-ratio.tsx
- ref_drizzle_kit
- env.ts
- ref_typescript_eslint_eslint_plugin
- infra/entrypoint.sh
- saas-core/infra/entrypoint.sh
- smoke-independent.mjs
- cookie.d.ts

## God Nodes (most connected - your core abstractions)
1. `cn()` - 268 edges
2. `getDb()` - 164 edges
3. `lucide-react` - 87 edges
4. `getDb()` - 82 edges
5. `trpc` - 59 edges
6. `Button()` - 52 edges
7. `Input()` - 36 edges
8. `Label()` - 32 edges
9. `TrpcContext` - 29 edges
10. `applyColorTheme()` - 26 edges

## Surprising Connections (you probably didn't know these)
- `main()` --calls--> `storagePut()`  [EXTRACTED]
  scripts/link-cardapio-fotos.ts → server/storage.ts
- `fetchCatalog()` --calls--> `isCategoryCurrentlyAvailable()`  [EXTRACTED]
  server/db/catalog.ts → shared/orderDomain.ts
- `createAddonGroup()` --calls--> `getDb()`  [EXTRACTED]
  scripts/seed.ts → server/db/client.ts
- `createAddonOptions()` --calls--> `getDb()`  [EXTRACTED]
  scripts/seed.ts → server/db/client.ts
- `createCategory()` --calls--> `getDb()`  [EXTRACTED]
  scripts/seed.ts → server/db/client.ts

## Import Cycles
- None detected.

## Communities (109 total, 12 thin omitted)

### Community 0 - "ref_react"
Cohesion: 0.05
Nodes (73): AddonManager(), blankGroup, blankOption, Group, GroupForm, money(), Option, OptionForm (+65 more)

### Community 1 - "db/subscriptions.ts"
Cohesion: 0.05
Nodes (77): subscriptionEvents, saas_core_drizzle_schema_index_billingpayments, saas_core_drizzle_schema_index_features, saas_core_drizzle_schema_index_planfeatures, saas_core_drizzle_schema_index_plankey, saas_core_drizzle_schema_index_planlimits, saas_core_drizzle_schema_index_plans, saas_core_drizzle_schema_index_restaurants (+69 more)

### Community 2 - "server/_core/trpc.ts"
Cohesion: 0.05
Nodes (68): faqItems, paymentGateways, @aws-sdk/s3-request-presigner, client, downloaded, payload, adminOnlyProcedure, adminProcedure (+60 more)

### Community 3 - "lucide-react"
Cohesion: 0.07
Nodes (51): Admin, AccountAdmin(), AppearanceSettings(), ACCOUNT_ACTION_LABELS, AuditLog(), CHANGE_TYPE_LABELS, CatalogAdmin(), Customers() (+43 more)

### Community 4 - "admin/tables.ts"
Cohesion: 0.06
Nodes (60): restaurantStaffCredentials, restaurantTables, SubscriptionCache, tableBillPayments, tableReservations, tableServiceRequests, tableSessions, nanoid (+52 more)

### Community 5 - "pages/Home.tsx"
Cohesion: 0.07
Nodes (48): getFeatureLockedInfo(), Account, AccountRole, roleLabel, CartPanel(), money(), CategoryRail(), money() (+40 more)

### Community 6 - "cn"
Cohesion: 0.05
Nodes (49): Command(), CommandDialog(), CommandGroup(), CommandInput(), CommandItem(), CommandList(), CommandSeparator(), CommandShortcut() (+41 more)

### Community 7 - "package.json"
Cohesion: 0.04
Nodes (65): @aws-sdk/client-s3, cookie, cross-env, dotenv, drizzle-kit, drizzle-orm, esbuild, eslint (+57 more)

### Community 8 - "sidebar.tsx"
Cohesion: 0.05
Nodes (54): TrialEndedBlock(), TrialEndingBanner(), DashboardLayout(), DashboardLayoutContent(), DashboardLayoutContentProps, dateLabel(), menuItems, DashboardLayoutSkeleton() (+46 more)

### Community 9 - "dependencies"
Cohesion: 0.03
Nodes (65): dependencies, @aws-sdk/client-s3, @aws-sdk/s3-request-presigner, class-variance-authority, clsx, cmdk, cookie, dotenv (+57 more)

### Community 10 - "getDb"
Cohesion: 0.07
Nodes (54): addonGroups, addonOptions, products, promotionAddonDefaults, promotionProducts, promotions, restaurantSettings, ensurePizzaSizes() (+46 more)

### Community 11 - "order.ts"
Cohesion: 0.06
Nodes (54): deliveryRoutes, webhookEvents, createTestOrder(), attempts, checkDistinctRateLimit(), checkRateLimit(), distinctAttempts, server_db_createservicerequest (+46 more)

### Community 12 - "schema.ts"
Cohesion: 0.06
Nodes (47): accountAuditLog, categoryTimeAvailabilityValues, customerAddresses, customerChangeLogs, customers, events, fiscalDocumentStatusValues, fiscalEnvironmentValues (+39 more)

### Community 13 - "saas-core/server/_core/context.ts"
Cohesion: 0.05
Nodes (40): saas_core_drizzle_schema_index_restaurant, generateApiKey(), hashApiKey(), { dbMocks, TEST_JWT_SECRET }, SECRET_BYTES, createContext(), PlatformAdminContext, TrpcContext (+32 more)

### Community 14 - "client/src/App.tsx"
Cohesion: 0.09
Nodes (42): DataRights, SupportEntry, AppearanceSettingsProps, ProductImageUpload(), ServiceSection(), Toaster(), toWhatsAppDigits(), WhatsAppButton() (+34 more)

### Community 15 - "TableSession.tsx"
Cohesion: 0.11
Nodes (39): TableSession, useCategoryScrollSpy(), EmptyMenu(), digits(), money(), NewCounterOrder(), contextOf(), PendingOrderBanner() (+31 more)

### Community 16 - "subscription.ts"
Cohesion: 0.06
Nodes (49): SendEmailResult, sendViaResend(), sendEmail(), SendEmailOutcome, sleep(), mocks, WELCOME_VARS, VarsFor (+41 more)

### Community 17 - "saas-core/server/_core/trpc.ts"
Cohesion: 0.09
Nodes (38): ref_trpc_server, ref_zod, saas_core_drizzle_schema_index_masterpanelsettings, saas_core_drizzle_schema_index_platformauditlog, askMaintenanceAssistant(), buildSnapshot(), MaintenanceAssistantResult, createSubscriptionPreapproval() (+30 more)

### Community 18 - "saas-core/server/_core/index.ts"
Cohesion: 0.09
Nodes (32): ref_express, platformAuditLog, PlatformAuditLogEntry, SubscriptionEvent, webhookEvents, saas_core_drizzle_schema_index_webhookevents, mocks, ENV (+24 more)

### Community 19 - "getDb"
Cohesion: 0.09
Nodes (39): ref_dotenv, ref_node_util, saas_core_drizzle_schema_index_platformadminrole, saas_core_drizzle_schema_index_platformadmins, InsertPlatformAdmin, PlatformAdmin, PlatformAdminRole, platformAdminRoleValues (+31 more)

### Community 20 - "server/_core/index.ts"
Cohesion: 0.07
Nodes (36): PWA_BRANDING, ref_fs, ref_http, ref_net, nodemailer, ref_path, supertest, ref_tailwindcss_vite (+28 more)

### Community 21 - "_core/license.ts"
Cohesion: 0.07
Nodes (43): buildSnapshot(), FEATURE_IDS, FeatureId, fetchPlanCatalog(), forceSyncLicense(), getCachedLicenseSnapshot, getFreshLicenseSnapshot(), getLicenseSnapshot() (+35 more)

### Community 22 - "db/restaurants.ts"
Cohesion: 0.09
Nodes (37): saas_core_drizzle_schema_index_plankeyvalues, saas_core_drizzle_schema_index_restaurantstatus, saas_core_drizzle_schema_index_restaurantstatusvalues, saas_core_drizzle_schema_index_subscriptionstatusvalues, planKeyValues, InsertRestaurant, Restaurant, RestaurantStatus (+29 more)

### Community 23 - "RestaurantOrders.tsx"
Cohesion: 0.07
Nodes (32): Kitchen, RestaurantOrders, OrderActions(), CollapsibleSection(), EditOrderDialog(), label, money(), OrderManagement() (+24 more)

### Community 24 - "db/signupPayments.ts"
Cohesion: 0.09
Nodes (33): saas_core_drizzle_schema_index_signuppayload, saas_core_drizzle_schema_index_signuppayments, MasterPanelSettings, SignupPayload, SignupPayment, signupPayments, SignupPaymentStatus, signupPaymentStatusValues (+25 more)

### Community 25 - "routers/team.ts"
Cohesion: 0.09
Nodes (40): InsertUser, createAddonGroup(), createAddonOptions(), createCategory(), createProduct(), now, seed(), parseStaffPermissions() (+32 more)

### Community 26 - "db/orders.ts"
Cohesion: 0.09
Nodes (40): orderItemAddons, emitNfceForOrder(), itemsFromOrder(), retryNfceForOrder(), getFiscalDocumentByOrderId(), attachOrderDetails(), dayLabel(), getActiveOrdersByPhone() (+32 more)

### Community 27 - "ref_vitest"
Cohesion: 0.05
Nodes (27): ref_vitest, mocks, mocks, adminContext, mocks, adminContext, mocks, additionalAdminContext (+19 more)

### Community 28 - "routers.ts"
Cohesion: 0.08
Nodes (22): licenseMocks, publicContext, TrpcContext, getSessionCookieOptions(), isSecureRequest(), systemRouter, mocks, publicContext (+14 more)

### Community 29 - "utils.ts"
Cohesion: 0.05
Nodes (24): AccordionContent(), AccordionItem(), AccordionTrigger(), Checkbox(), HoverCardContent(), Progress(), RadioGroup(), RadioGroupItem() (+16 more)

### Community 30 - "admin/fiscal.ts"
Cohesion: 0.11
Nodes (31): fiscalSettings, regimeTributarioValues, decryptField(), encryptField(), scrypt, server_db_assignproductfiscalcategory, server_db_confirmfiscalproductionready, server_db_countproductswithoutfiscalcategory (+23 more)

### Community 31 - "payments/types.ts"
Cohesion: 0.08
Nodes (19): createMercadoPagoCheckout(), createMercadoPagoPixPayment(), getMercadoPagoPayment(), PreferenceItem, verifyMercadoPagoWebhookSignature(), ACTIVE_MP_GATEWAY, mocks, mercadoPagoProvider (+11 more)

### Community 32 - "db/reports.ts"
Cohesion: 0.12
Nodes (27): categories, server_db_getreportsadvanced, server_db_getreportscomplete, CompletedOrderRow, csvEscape(), dayKey(), dayLabel(), fetchCompletedOrders() (+19 more)

### Community 33 - "devDependencies"
Cohesion: 0.07
Nodes (30): devDependencies, cross-env, drizzle-kit, esbuild, eslint, fake-indexeddb, jsdom, pnpm (+22 more)

### Community 34 - "field.tsx"
Cohesion: 0.08
Nodes (25): Field(), FieldContent(), FieldDescription(), FieldError(), FieldGroup(), FieldLabel(), FieldLegend(), FieldSeparator() (+17 more)

### Community 35 - "nfceEmission.ts"
Cohesion: 0.10
Nodes (25): fiscalDocuments, fiscalTaxCategories, buildFocusNfeItems(), emit(), EmitParams, findBlockingProduct(), FiscalCategoryRow, FOCUS_NFE_BASE_URL (+17 more)

### Community 36 - "server/_core/context.ts"
Cohesion: 0.13
Nodes (15): User, ref_cookie, adminContext, mocks, publicContext, AuthenticatedUser, CookieCall, sdk (+7 more)

### Community 37 - "saas-core/client/src/App.tsx"
Cohesion: 0.10
Nodes (12): Aparencia, AuditLog, ComercialCardapio, ComercialConfirmando, ComercialHome, ComercialPrivacidade, ComercialSucesso, ComercialTermos (+4 more)

### Community 38 - "alert-dialog.tsx"
Cohesion: 0.09
Nodes (19): AlertDialogAction(), AlertDialogCancel(), AlertDialogContent(), AlertDialogDescription(), AlertDialogFooter(), AlertDialogHeader(), AlertDialogOverlay(), AlertDialogTitle() (+11 more)

### Community 39 - "comercial/Home.tsx"
Cohesion: 0.08
Nodes (8): COMPARISON, DIFERENCIAIS, MODULOS, RESUMO, ROTINA, STEPS, STRUCTURED_DATA, SUPORTE

### Community 40 - "saas-core/shared/deriveSurfacePalette.ts"
Cohesion: 0.13
Nodes (21): bestTextColor(), clampLightness(), contrastRatio(), DerivedSurfaceRoles, deriveSurfacePalette(), hexToRgb(), HSL, hslToRgb() (+13 more)

### Community 41 - "shared/deriveSurfacePalette.ts"
Cohesion: 0.13
Nodes (21): bestTextColor(), clampLightness(), contrastRatio(), DerivedSurfaceRoles, deriveSurfacePalette(), hexToRgb(), HSL, hslToRgb() (+13 more)

### Community 42 - "class-variance-authority"
Cohesion: 0.11
Nodes (19): Alert(), AlertDescription(), AlertTitle(), alertVariants, Empty(), EmptyContent(), EmptyDescription(), EmptyHeader() (+11 more)

### Community 43 - "RestaurantDetail.tsx"
Cohesion: 0.14
Nodes (17): RestaurantDetail, RestaurantList, Badge(), STATUS_TONE, Input(), copyToClipboard(), money(), PLAN_KEYS (+9 more)

### Community 44 - "scripts/backup-db.mjs"
Cohesion: 0.10
Nodes (18): client, policy, ref_aws_sdk_client_s3, ref_node_child_process, ref_node_stream, execFileAsync, parsed, password (+10 more)

### Community 45 - "client/src/main.tsx"
Cohesion: 0.15
Nodes (17): App(), API_URL, client_src_index, CATALOG_CACHE_BUSTER, CATALOG_CACHE_MAX_AGE_MS, catalogPersister, idbStorage, shouldDehydrateCatalogQuery() (+9 more)

### Community 46 - "saas-core/server/routers/support.ts"
Cohesion: 0.18
Nodes (13): ref_node_crypto, saas_core_drizzle_schema_index_supportsessions, SupportSession, supportSessions, generateSupportToken(), hashSupportToken(), getOwnSupportSession(), getSupportSessionById() (+5 more)

### Community 47 - "devDependencies"
Cohesion: 0.10
Nodes (20): devDependencies, cross-env, drizzle-kit, esbuild, eslint, tailwindcss, @tailwindcss/vite, tsx (+12 more)

### Community 48 - "compilerOptions"
Cohesion: 0.10
Nodes (19): compilerOptions, allowImportingTsExtensions, baseUrl, esModuleInterop, incremental, jsx, lib, module (+11 more)

### Community 49 - "compilerOptions"
Cohesion: 0.10
Nodes (19): compilerOptions, allowImportingTsExtensions, baseUrl, esModuleInterop, incremental, jsx, lib, module (+11 more)

### Community 50 - "saas-core/client/src/lib/trpc.ts"
Cohesion: 0.18
Nodes (11): ref_trpc_react_query, ComercialCadastro, trpc, useMercadoPagoSecurity(), Cadastro(), money(), PLAN_LABELS, Cardapio() (+3 more)

### Community 51 - "telegramService.ts"
Cohesion: 0.18
Nodes (16): computeDeploymentPorts(), DeploymentPorts, execFileAsync, provisionSystemInstance(), slugifyRestaurantName(), buildEnvironmentProvisionedMessage(), buildEnvironmentProvisioningFailedMessage(), buildRestaurantDeliveredMessage() (+8 more)

### Community 52 - "dependencies"
Cohesion: 0.11
Nodes (18): dependencies, @aws-sdk/client-s3, cookie, dotenv, drizzle-orm, express, jose, mysql2 (+10 more)

### Community 53 - "PromotionManager.tsx"
Cohesion: 0.14
Nodes (16): AddonDefaultKey, addonKey(), blank, CatalogAddonGroup, CatalogAddonOption, CatalogCategory, CatalogProduct, Form (+8 more)

### Community 54 - "dropdown-menu.tsx"
Cohesion: 0.12
Nodes (12): DropdownMenu(), DropdownMenuCheckboxItem(), DropdownMenuContent(), DropdownMenuItem(), DropdownMenuLabel(), DropdownMenuRadioItem(), DropdownMenuSeparator(), DropdownMenuShortcut() (+4 more)

### Community 55 - "server/_core/env.ts"
Cohesion: 0.19
Nodes (10): ref_jose, createDataRightsToken(), getSecret(), verifyDataRightsToken(), ENV, createSupportSessionToken(), getSecret(), SupportSessionPayload (+2 more)

### Community 56 - "components.json"
Cohesion: 0.12
Nodes (15): aliases, components, hooks, lib, ui, utils, rsc, $schema (+7 more)

### Community 57 - "scripts"
Cohesion: 0.12
Nodes (16): scripts, backup, build, check, db:migrate, db:push, db:validate-migration, dev (+8 more)

### Community 58 - "Planos.tsx"
Cohesion: 0.16
Nodes (10): ComercialPlanos, PageMeta, upsertMeta(), usePageMeta(), Home(), BASE_INCLUDES, FEATURE_DESCRIPTIONS, money() (+2 more)

### Community 59 - "Equipe.tsx"
Cohesion: 0.17
Nodes (11): Equipe, Manutencao, Button(), Variant, VARIANT_CLASSES, ConfirmDialog(), Admin, Role (+3 more)

### Community 60 - "scripts"
Cohesion: 0.12
Nodes (16): scripts, backup, bootstrap-admin, build, check, create-restaurant, db:migrate, db:push (+8 more)

### Community 61 - "carousel.tsx"
Cohesion: 0.17
Nodes (14): Carousel(), CarouselApi, CarouselContent(), CarouselContext, CarouselContextProps, CarouselItem(), CarouselNext(), CarouselOptions (+6 more)

### Community 62 - "PanelLayout.tsx"
Cohesion: 0.28
Nodes (8): Login, NAV_ITEMS, PanelLayout(), usePlatformAuth(), applyPanelTheme(), useNoIndex(), Aparencia(), Login()

### Community 63 - "errors.ts"
Cohesion: 0.21
Nodes (7): isNonEmptyString(), SessionService, BadRequestError(), ForbiddenError(), HttpError, NotFoundError(), UnauthorizedError()

### Community 64 - "appearance-settings-ui.test.ts"
Cohesion: 0.14
Nodes (7): AdminAccessManager(), @testing-library/react, mockLockedFeatures, mocks, BASE_SETTINGS, mockLockedFeatures, mocks

### Community 65 - "restaurant-panel-ui.test.ts"
Cohesion: 0.20
Nodes (12): OrderStatusActions(), advanceOrderStatus(), getNextOrderStatus(), NextOrderStatus, OrderFulfillmentType, OrderOperationalStatus, OrderStatusMutationInput, appSource (+4 more)

### Community 66 - "breadcrumb.tsx"
Cohesion: 0.15
Nodes (11): BreadcrumbEllipsis(), BreadcrumbItem(), BreadcrumbLink(), BreadcrumbList(), BreadcrumbPage(), BreadcrumbSeparator(), ButtonGroup(), ButtonGroupSeparator() (+3 more)

### Community 67 - "form.tsx"
Cohesion: 0.19
Nodes (12): FormControl(), FormDescription(), FormFieldContext, FormFieldContextValue, FormItem(), FormItemContext, FormItemContextValue, FormLabel() (+4 more)

### Community 68 - "ref_node_fs"
Cohesion: 0.14
Nodes (10): ref_mysql2, ref_node_fs, accessManagerSource, adminSource, sidebarSource, uploadSource, catalogSource, routerSource (+2 more)

### Community 69 - "support-mode-access.test.ts"
Cohesion: 0.21
Nodes (9): anonymousContext, mocks, now, REAL_ADMIN, SUPPORT_SESSION, supportOnlyContext, GRANTABLE_STAFF_AREAS, STAFF_AREA_LABELS (+1 more)

### Community 70 - "PlanAdmin.tsx"
Cohesion: 0.24
Nodes (9): dateLabel(), LIMIT_LABELS, money(), PendingChange, PlanAdmin(), STATUS_LABELS, useMercadoPagoSecurity(), FEATURE_CATALOG (+1 more)

### Community 71 - "ThemeContext.tsx"
Cohesion: 0.23
Nodes (9): SiteTheme, ThemeSwitcher(), Theme, ThemeContext, ThemeContextType, ThemeProvider(), ThemeProviderProps, useTheme() (+1 more)

### Community 72 - "drawer.tsx"
Cohesion: 0.17
Nodes (7): DrawerContent(), DrawerDescription(), DrawerFooter(), DrawerHeader(), DrawerOverlay(), DrawerTitle(), vaul

### Community 73 - "select.tsx"
Cohesion: 0.17
Nodes (8): SelectContent(), SelectItem(), SelectLabel(), SelectScrollDownButton(), SelectScrollUpButton(), SelectSeparator(), SelectTrigger(), @radix-ui/react-select

### Community 74 - "pwa-install-placement.test.ts"
Cohesion: 0.17
Nodes (10): ref_node_path, appSource, checkoutSource, counterSource, tableSessionSource, adminSource, appSource, dashboardSource (+2 more)

### Community 75 - "_core/billing.ts"
Cohesion: 0.38
Nodes (10): baseHeaders(), BillingPaymentEntry, cancelSubscription(), ChangePlanResult, changeSubscriptionPlan(), getBillingPaymentHistory(), getFromSaasCore(), postToSaasCore() (+2 more)

### Community 76 - "PwaInstallContext.tsx"
Cohesion: 0.22
Nodes (7): handleInstall(), BeforeInstallPromptEvent, isStandalone(), PwaInstallContext, PwaInstallProvider(), install(), PwaInstallState

### Community 77 - "navigation-menu.tsx"
Cohesion: 0.20
Nodes (10): NavigationMenu(), NavigationMenuContent(), NavigationMenuIndicator(), NavigationMenuItem(), NavigationMenuLink(), NavigationMenuList(), NavigationMenuTrigger(), navigationMenuTriggerStyle (+2 more)

### Community 78 - "card.tsx"
Cohesion: 0.24
Nodes (8): Card(), CardAction(), CardContent(), CardDescription(), CardFooter(), CardHeader(), CardTitle(), NotFound()

### Community 79 - "input-group.tsx"
Cohesion: 0.28
Nodes (8): InputGroup(), InputGroupAddon(), inputGroupAddonVariants, InputGroupButton(), inputGroupButtonVariants, InputGroupInput(), InputGroupText(), InputGroupTextarea()

### Community 80 - "provision-client.mjs"
Cohesion: 0.36
Nodes (8): buildEnvFile(), __dirname, main(), randomSecret(), repoRoot, requiredEnv(), runComposeUp(), waitUntilReady()

### Community 81 - "totp.ts"
Cohesion: 0.46
Nodes (5): otpauth, buildTotp(), buildTotpQrCodeDataUrl(), generateTotpSecret(), verifyTotpToken()

### Community 82 - "saas-core/client/src/main.tsx"
Cohesion: 0.29
Nodes (6): ref_react_dom, App(), API_URL, saas_core_client_src_index, queryClient, trpcClient

### Community 83 - "generate-pwa-icons.ts"
Cohesion: 0.32
Nodes (7): sharp, ICONS_DIR, main(), PUBLIC_DIR, renderSquare(), sampleCornerColor(), SOURCE

### Community 84 - "Plans.tsx"
Cohesion: 0.39
Nodes (7): Plans, centsToReaisInput(), money(), PlanRow, Plans(), reaisInputToCents(), usePlansData()

### Community 85 - "scripts/restore-db.mjs"
Cohesion: 0.25
Nodes (7): args, env, execFileAsync, parsed, scrypt, stamp, walk()

### Community 86 - "ErrorBoundary.tsx"
Cohesion: 0.29
Nodes (3): ErrorBoundary, Props, State

### Community 87 - "saas-core/scripts/restore-db.mjs"
Cohesion: 0.29
Nodes (6): ref_node_url, args, env, parsed, scrypt, stamp

### Community 88 - "Dashboard.tsx"
Cohesion: 0.43
Nodes (5): Dashboard, StatTile(), Dashboard(), money(), shortDate()

### Community 89 - "verify-export.mjs"
Cohesion: 0.29
Nodes (6): ignoredDirectories, proprietaryPattern, required, root, textExtensions, walk()

### Community 90 - "input-otp.tsx"
Cohesion: 0.33
Nodes (4): InputOTP(), InputOTPGroup(), InputOTPSlot(), input-otp

### Community 92 - "overrides"
Cohesion: 0.33
Nodes (6): body-parser, express>path-to-regexp, fast-xml-parser, qs, pnpm, overrides

### Community 93 - "Equipe"
Cohesion: 0.40
Nodes (3): Equipe(), beginCreate(), resetForm()

### Community 94 - "home-style.test.ts"
Cohesion: 0.33
Nodes (5): appSource, categoryRailSource, homeSource, styleSource, themeSwitcherSource

### Community 95 - "order-create-idempotency.test.ts"
Cohesion: 0.33
Nodes (4): BASE_INPUT, makeFakeDb(), mocks, publicContext

### Community 96 - "cleanup-test-data.ts"
Cohesion: 0.40
Nodes (3): ref_drizzle_schema, ref_server_db_client, ref_server_db_customers

### Community 98 - "iniciar.sh"
Cohesion: 0.67
Nodes (3): GIT_COMMIT, random_secret(), iniciar.sh script

## Knowledge Gaps
- **793 isolated node(s):** `Group`, `GroupForm`, `Option`, `OptionForm`, `Category` (+788 more)
  These have ≤1 connection - possible missing edges. (Counts symbols only; 1063 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **12 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `getDb()` connect `getDb` to `db/reports.ts`, `server/_core/trpc.ts`, `nfceEmission.ts`, `admin/tables.ts`, `order.ts`, `schema.ts`, `server/_core/index.ts`, `_core/license.ts`, `routers/team.ts`, `db/orders.ts`, `admin/fiscal.ts`?**
  _High betweenness centrality (0.057) - this node is a cross-community bridge._
- **Why does `cn()` connect `cn` to `ref_react`, `pages/Home.tsx`, `sidebar.tsx`, `utils.ts`, `field.tsx`, `alert-dialog.tsx`, `class-variance-authority`, `dropdown-menu.tsx`, `carousel.tsx`, `breadcrumb.tsx`, `form.tsx`, `drawer.tsx`, `select.tsx`, `navigation-menu.tsx`, `card.tsx`, `input-group.tsx`, `ErrorBoundary.tsx`, `input-otp.tsx`, `popover.tsx`?**
  _High betweenness centrality (0.055) - this node is a cross-community bridge._
- **Why does `lucide-react` connect `lucide-react` to `ref_react`, `pages/Home.tsx`, `cn`, `package.json`, `sidebar.tsx`, `client/src/App.tsx`, `TableSession.tsx`, `RestaurantOrders.tsx`, `utils.ts`, `alert-dialog.tsx`, `PromotionManager.tsx`, `dropdown-menu.tsx`, `carousel.tsx`, `breadcrumb.tsx`, `PlanAdmin.tsx`, `ThemeContext.tsx`, `select.tsx`, `navigation-menu.tsx`, `card.tsx`, `ErrorBoundary.tsx`, `input-otp.tsx`?**
  _High betweenness centrality (0.053) - this node is a cross-community bridge._
- **What connects `Group`, `GroupForm`, `Option` to the rest of the system?**
  _793 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `ref_react` be split into smaller, more focused modules?**
  _Cohesion score 0.05290072297654735 - nodes in this community are weakly interconnected._
- **Should `db/subscriptions.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.04730052556139513 - nodes in this community are weakly interconnected._
- **Should `server/_core/trpc.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05308641975308642 - nodes in this community are weakly interconnected._