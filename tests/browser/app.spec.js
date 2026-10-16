import {test,expect} from '@playwright/test';
test('Demo calcula, desglosa, exporta y guarda una partida',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');
  await page.getByRole('button',{name:'Probar una partida de ejemplo'}).click();
  await page.getByRole('button',{name:'Ver liquidación'}).click();
  await expect(page.locator('.result-row')).toHaveCount(4);
  const first=page.locator('.result-row').first();
  await expect(first).toContainText('Santiago');await expect(first).toContainText('11.000,00');
  await first.locator('summary').click();await expect(first.locator('tbody tr')).toHaveCount(5);
  await expect(first.locator('tbody')).toContainText('Medal');
  await expect(page.locator('.transfer')).toHaveCount(3);
  const downloadPromise=page.waitForEvent('download');
  await page.getByRole('button',{name:'Descargar desglose CSV'}).click();
  expect((await downloadPromise).suggestedFilename()).toBe('golfbet-liquidacion.csv');
  await page.getByRole('button',{name:'Guardar partida'}).click();
  await expect(page.getByRole('status')).toContainText('guardada en este navegador');
  await page.getByRole('button',{name:'Todas las partidas'}).click();
  await expect(page.locator('.match-card')).toHaveCount(1);
  await page.locator('.match-card').click();
  await expect(page.locator('input[data-path="name"]')).toHaveValue('Medal interno · 18 hoyos');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
  expect(errors).toEqual([]);
});
test('Configuración cambia cálculos y evita resultados incompletos',async({page})=>{
  await page.goto('/');await page.getByRole('button',{name:'Probar una partida de ejemplo'}).click();
  await page.locator('input[data-path="games.medal.step"]').fill('2000');
  await page.getByRole('button',{name:'Ver liquidación'}).click();
  await expect(page.locator('.result-row').first()).toContainText('17.000,00');
  await page.getByRole('button',{name:'Ver configuración'}).click();
  await page.locator('input[data-path="players.0.net"]').fill('');
  await page.getByRole('button',{name:'Ver liquidación'}).click();
  await expect(page.getByRole('alert')).toContainText('score neto');
  await expect(page.locator('input[data-path="players.0.net"]')).toBeVisible();
});
test('Se puede crear y guardar sin haber terminado los resultados',async({page})=>{
  await page.goto('/');await page.getByRole('button',{name:'Probar una partida de ejemplo'}).click();
  await page.getByRole('button',{name:'Todas las partidas'}).click();
  await page.getByRole('button',{name:'Crear partida'}).click();
  await page.locator('input[data-path="name"]').fill('Partida nueva');
  await page.locator('input[data-path="players.0.name"]').fill('Ana');
  await page.locator('input[data-path="players.1.name"]').fill('Luis');
  await page.getByRole('button',{name:'Guardar partida'}).click();
  await expect(page.getByRole('status')).toContainText('guardada');
  await page.getByRole('button',{name:'Ver liquidación'}).click();
  await expect(page.getByRole('alert')).toContainText('al menos una apuesta');
});

test('Equipos se crean antes de jugadores y permanecen abiertos',async({page})=>{await page.goto('/');await page.getByRole('button',{name:'Probar una partida de ejemplo'}).click();await page.getByRole('button',{name:'Agregar equipo',exact:false}).click();await expect(page.locator('.team-editor')).toHaveAttribute('open','');await expect(page.locator('.team-row')).toHaveCount(3);expect(await page.evaluate(()=>Boolean(document.querySelector('.team-editor').compareDocumentPosition(document.querySelector('.player-table')) & Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);await page.locator('input[data-path="teams.2.name"]').fill('Equipo nuevo');await page.getByRole('button',{name:'Guardar partida'}).click();await expect(page.locator('select[data-path="players.0.team"]')).toContainText('Equipo nuevo');});
test('Partida privada por defecto y compartida valida los correos',async({page})=>{await page.goto('/');await page.getByRole('button',{name:'Probar una partida de ejemplo'}).click();await expect(page.locator('select[data-path="visibility"]')).toHaveValue('private');await page.locator('select[data-path="visibility"]').selectOption('shared');await page.getByRole('button',{name:'Guardar partida'}).click();await expect(page.getByRole('alert')).toContainText('correos válidos');await page.locator('input[data-share-emails]').fill('AMIGO@gmail.com, otro@gmail.com');await page.getByRole('button',{name:'Guardar partida'}).click();await expect(page.getByRole('status')).toContainText('guardada');await page.getByRole('button',{name:'Ver liquidación'}).click();await page.getByRole('button',{name:'Copiar para WhatsApp'}).click();await expect(page.getByRole('status')).toContainText(/WhatsApp/);});

test('Scores permiten signo negativo y NPT desactiva score con penalidad',async({page})=>{await page.goto('/');await page.getByRole('button',{name:'Probar una partida de ejemplo'}).click();const score=page.locator('input[data-path="players.0.net"]');await expect(score).toHaveAttribute('type','text');await expect(score).toHaveAttribute('inputmode','text');await score.fill('-2');await page.locator('input[data-path="teams.0.score"]').fill('-3');await page.locator('input[data-path="players.3.npt"]').check();await expect(page.locator('input[data-path="players.3.net"]')).toBeDisabled();await page.locator('input[data-path="games.medal.nptPenalty"]').fill('500');await page.getByRole('button',{name:'Ver liquidación'}).click();await page.locator('.result-row').first().locator('summary').click();await expect(page.locator('.result-row').first()).toContainText('penalidad NPT');});

test('Skins permite elegir ganadores y mostrar el acumulado',async({page})=>{await page.goto('/');await page.getByRole('button',{name:'Probar una partida de ejemplo'}).click();await page.locator('input[data-path="games.skins.enabled"]').check();await page.locator('select[data-path="games.skins.range"]').selectOption('front');await page.locator('input[data-path="games.skins.holes.0.amount"]').fill('500');for(let i=0;i<9;i++)await page.locator(`select[data-path="games.skins.holes.${i}.winner"]`).selectOption(i===2?'p0':'tie');await page.getByRole('button',{name:'Ver liquidación'}).click();await expect(page.getByRole('heading',{name:'Resultados de Skins'})).toBeVisible();await expect(page.locator('.skins-table')).toContainText('Santiago · 3 skin(s)');await expect(page.getByText('Aportes devueltos:',{exact:false})).toBeVisible();});

test('Nueva partida: modalidades apagadas y antes de jugadores, moneda seleccionable',async({page})=>{await page.goto('/');await page.getByRole('button',{name:'Probar una partida de ejemplo'}).click();await page.getByRole('button',{name:'Todas las partidas'}).click();await page.getByRole('button',{name:'Crear partida'}).click();await expect(page.locator('.mode-option input:checked')).toHaveCount(0);expect(await page.evaluate(()=>Boolean(document.querySelector('.modalities-panel').compareDocumentPosition(document.querySelector('.player-table')) & Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);await page.locator('select[data-path="currency"]').selectOption('UYU');await page.locator('input[data-path="games.fourball.enabled"]').check();await expect(page.getByRole('button',{name:'Agregar pareja'})).toBeVisible();await page.getByRole('button',{name:'Agregar pareja'}).click();await expect(page.locator('input[data-path="games.fourball.teams.0.name"]')).toBeVisible();await expect(page.locator('select[data-path="players.0.fourballTeam"]')).toContainText('Pareja 1');expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);});
test('Moneda seleccionada aparece en liquidación y exportación',async({page})=>{await page.goto('/');await page.getByRole('button',{name:'Probar una partida de ejemplo'}).click();await page.locator('select[data-path="currency"]').selectOption('USD');await page.getByRole('button',{name:'Ver liquidación'}).click();await expect(page.locator('.result-row').first()).toContainText('USD');const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Descargar desglose CSV'}).click();const download=await downloadPromise;const {readFile}=await import('node:fs/promises');const csv=await readFile(await download.path(),'utf8');expect(csv).toContain('Aporte USD');expect(csv).toContain('Premio USD');expect(csv).toContain('Saldo USD');});

test('Fourball completo liquida por jugador y conserva selección al guardar',async({page},testInfo)=>{
 await page.goto('/');await page.getByRole('button',{name:'Probar una partida de ejemplo'}).click();
 for(const key of ['ida','vuelta','medal','laguneada'])await page.locator(`input[data-path="games.${key}.enabled"]`).uncheck();
 await page.locator('input[data-path="games.approaches.0.enabled"]').uncheck();
 await page.locator('input[data-path="games.fourball.enabled"]').check();
 await page.getByRole('button',{name:'Agregar pareja'}).click();await page.getByRole('button',{name:'Agregar pareja'}).click();
 const pairIds=await page.locator('select[data-path="players.0.fourballTeam"] option').evaluateAll(options=>options.map(o=>o.value).filter(Boolean));
 for(let i=0;i<4;i++)await page.locator(`select[data-path="players.${i}.fourballTeam"]`).selectOption(pairIds[Math.floor(i/2)]);
 await page.locator('input[data-path="games.fourball.teams.0.score"]').fill('-3');await page.locator('input[data-path="games.fourball.teams.1.score"]').fill('2');
 await page.locator('select[data-path="currency"]').selectOption('USD');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
 await page.screenshot({path:testInfo.outputPath('fourball-config.png'),fullPage:true});
 await page.getByRole('button',{name:'Guardar partida'}).click();await expect(page.getByRole('status')).toContainText('guardada');
 await page.getByRole('button',{name:'Ver liquidación'}).click();await expect(page.getByRole('heading',{name:'Resultados de Fourball'})).toBeVisible();await expect(page.locator('.result-row').first().locator('.saldo')).toContainText('USD');await expect(page.locator('.result-row').first().locator('.saldo')).toContainText('1.000,00');
 await page.getByRole('button',{name:'Todas las partidas'}).click();await page.locator('.match-card').click();await expect(page.locator('select[data-path="currency"]')).toHaveValue('USD');await expect(page.locator('input[data-path="games.fourball.enabled"]')).toBeChecked();
});

test('Monto inicial del Medal se configura separado del incremento',async({page})=>{await page.goto('/');await page.getByRole('button',{name:'Probar una partida de ejemplo'}).click();await page.locator('input[data-path="games.medal.startAmount"]').fill('2000');await page.getByRole('button',{name:'Ver liquidación'}).click();await page.locator('.result-row').first().locator('summary').click();await expect(page.locator('.result-row').first()).toContainText('14.000,00');});
