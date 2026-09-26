// #376 hand-written reference designs (the "human reference"): shadcn tokens, Tailwind utilities.
const btn = 'inline-flex items-center justify-center rounded-md text-sm font-medium h-9 px-4';
const P = `${btn} bg-primary text-primary-foreground`, O = `${btn} border border-border bg-background`;
const card = 'rounded-xl border border-border bg-card text-card-foreground shadow-sm';
export const REFS = {
  'dashboard-card': `<div class="${card} p-6 max-w-sm flex flex-col gap-4">
 <div class="flex items-center justify-between"><p class="text-sm font-medium text-muted-foreground">Monthly revenue</p><span class="text-muted-foreground">$</span></div>
 <div><p class="text-3xl font-bold tracking-tight">$48,210</p><p class="text-xs text-muted-foreground mt-1">+12.5% vs last month</p></div>
 <div class="flex flex-col gap-1"><div class="flex justify-between text-xs text-muted-foreground"><span>Goal $60,000</span><span>80%</span></div>
 <div class="h-2 w-full rounded-full bg-primary/20" role="progressbar" aria-valuenow="80"><div class="h-2 rounded-full bg-primary" style="width:80%"></div></div></div>
 <button class="${O}">View report</button></div>`,
  'settings-form': `<form class="${card} p-6 max-w-md flex flex-col gap-5">
 <h2 class="text-xl font-semibold">Notifications</h2>
 <label class="grid gap-2 text-sm font-medium">Full name<input class="h-9 rounded-md border border-input bg-transparent px-3 text-sm font-normal" value="Ada Lovelace"></label>
 <label class="grid gap-2 text-sm font-medium">Email<input type="email" class="h-9 rounded-md border border-input bg-transparent px-3 text-sm font-normal" value="ada@example.com"></label>
 <div class="flex items-center justify-between"><span class="text-sm font-medium">Email notifications</span><button type="button" role="switch" aria-checked="true" class="h-5 w-9 rounded-full bg-primary"></button></div>
 <div class="flex items-center justify-between"><span class="text-sm font-medium">Weekly digest</span><button type="button" role="switch" aria-checked="false" class="h-5 w-9 rounded-full bg-input"></button></div>
 <label class="grid gap-2 text-sm font-medium">Plan<select class="h-9 rounded-md border border-input bg-transparent px-3 text-sm"><option>Free</option><option selected>Pro</option><option>Team</option></select></label>
 <div class="flex justify-end gap-2"><button type="button" class="${O}">Cancel</button><button class="${P}">Save changes</button></div></form>`,
  pricing: `<section class="grid grid-cols-3 gap-6 max-w-4xl">
 ${[['Starter', '$0', '', O, 'Get started'], ['Pro', '$19', 'border-primary border-2', P, 'Upgrade to Pro'], ['Team', '$49', '', O, 'Contact sales']].map(([n, p, hi, b, cta]) => `<div class="${card} ${hi} p-6 flex flex-col gap-4">
  <div class="flex items-center justify-between"><h3 class="text-lg font-semibold">${n}</h3>${n === 'Pro' ? '<span class="rounded-md bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">Most popular</span>' : ''}</div>
  <p><span class="text-4xl font-bold">${p}</span><span class="text-muted-foreground">/month</span></p>
  <ul class="flex flex-col gap-2 text-sm text-muted-foreground"><li>Feature one</li><li>Feature two</li><li>Feature three</li></ul>
  <button class="${b} mt-auto">${cta}</button></div>`).join('')}</section>`,
  'data-table': `<div class="${card} p-6 max-w-3xl">
 <div class="flex items-center justify-between mb-4"><h2 class="text-lg font-semibold">Recent orders</h2><button class="${O}">Export</button></div>
 <table class="w-full text-sm"><thead><tr class="border-b border-border text-left text-muted-foreground"><th class="h-10 px-2 font-medium">Order</th><th class="px-2 font-medium">Customer</th><th class="px-2 font-medium">Status</th><th class="px-2 font-medium text-right">Amount</th></tr></thead>
 <tbody>${[['#1001', 'Ada Lovelace', 'Paid', 'bg-primary text-primary-foreground', '$250.00'], ['#1002', 'Alan Turing', 'Pending', 'bg-secondary text-secondary-foreground', '$120.00'], ['#1003', 'Grace Hopper', 'Refunded', 'bg-destructive text-white', '$75.00'], ['#1004', 'Linus T.', 'Paid', 'bg-primary text-primary-foreground', '$310.00']].map(([o, c, s, sc, a]) => `<tr class="border-b border-border"><td class="p-2 font-medium">${o}</td><td class="p-2">${c}</td><td class="p-2"><span class="rounded-md px-2 py-0.5 text-xs font-medium ${sc}">${s}</span></td><td class="p-2 text-right">${a}</td></tr>`).join('')}</tbody></table></div>`,
  'empty-state': `<div class="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border p-12 text-center max-w-lg">
 <div class="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground" aria-hidden="true">&#9633;</div>
 <h3 class="text-xl font-semibold">No projects yet</h3><p class="text-sm text-muted-foreground max-w-sm">Create your first project to start organizing your work.</p>
 <div class="flex gap-2"><button class="${P}">Create project</button><button class="${O}">Import</button></div></div>`,
  hero: `<section class="flex flex-col items-center gap-6 px-6 py-20 text-center">
 <span class="rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium">New: v2.0</span>
 <h1 class="max-w-3xl text-5xl font-bold tracking-tight">Ship beautiful products faster</h1>
 <p class="max-w-xl text-lg text-muted-foreground">Everything your team needs to design, build and launch in one place.</p>
 <div class="flex gap-3"><button class="${P} h-10 px-6">Get started</button><button class="${O} h-10 px-6">Learn more</button></div>
 <p class="text-sm text-muted-foreground">Trusted by 2,000+ teams</p></section>`,
};
