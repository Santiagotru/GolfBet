import {defineConfig} from '@playwright/test';
import {existsSync} from 'node:fs';
export default defineConfig({
  testDir:'./tests/browser',
  fullyParallel:true,
  reporter:'list',
  use:{baseURL:'http://127.0.0.1:5173',headless:true,launchOptions:{...(existsSync('/usr/bin/chromium')?{executablePath:'/usr/bin/chromium'}:{}),args:['--no-sandbox']}},
  webServer:{command:'npm run dev -- --port 5173',url:'http://127.0.0.1:5173',reuseExistingServer:!process.env.CI},
  projects:[{name:'desktop',use:{viewport:{width:1440,height:1000}}},{name:'mobile',use:{viewport:{width:390,height:844}}}]
});
