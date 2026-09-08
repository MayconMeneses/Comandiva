#!/usr/bin/env node
const baseUrl = process.env.SMOKE_BASE_URL ?? "http://127.0.0.1:3120";
const loginInput = { "0": { json: { username: process.env.SMOKE_USERNAME ?? "adminclean", password: process.env.SMOKE_PASSWORD ?? "" } } };
const home = await fetch(`${baseUrl}/`);
if (!home.ok) throw new Error(`Frontend/backend não respondeu: ${home.status}`);
const login = await fetch(`${baseUrl}/api/trpc/team.login?batch=1`, { method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json" }, body: JSON.stringify(loginInput) });
const body = await login.text();
if (!login.ok || body.includes('"error"')) throw new Error(`Login local falhou (${login.status}): ${body}`);
console.log(`Smoke independente aprovado: home=${home.status}, login=${login.status}`);
