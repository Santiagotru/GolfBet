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
  await expect(page.getByRole('alert')).toContainText('ganadores');
});

test('Equipos se crean antes de jugadores y permanecen abiertos',async({page})=>{await page.goto('/');await page.getByRole('button',{name:'Probar una partida de ejemplo'}).click();await page.getByRole('button',{name:'Agregar equipo',exact:false}).click();await expect(page.locator('.team-editor')).toHaveAttribute('open','');await expect(page.locator('.team-row')).toHaveCount(3);expect(await page.evaluate(()=>Boolean(document.querySelector('.team-editor').compareDocumentPosition(document.querySelector('.player-table')) & Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);await page.locator('input[data-path="teams.2.name"]').fill('Equipo nuevo');await page.getByRole('button',{name:'Guardar partida'}).click();await expect(page.locator('select[data-path="players.0.team"]')).toContainText('Equipo nuevo');});
test('Partida privada por defecto y compartida valida los correos',async({page})=>{await page.goto('/');await page.getByRole('button',{name:'Probar una partida de ejemplo'}).click();await expect(page.locator('select[data-path="visibility"]')).toHaveValue('private');await page.locator('select[data-path="visibility"]').selectOption('shared');await page.getByRole('button',{name:'Guardar partida'}).click();await expect(page.getByRole('alert')).toContainText('correos válidos');await page.locator('input[data-share-emails]').fill('AMIGO@gmail.com, otro@gmail.com');await page.getByRole('button',{name:'Guardar partida'}).click();await expect(page.getByRole('status')).toContainText('guardada');await page.getByRole('button',{name:'Ver liquidación'}).click();await page.getByRole('button',{name:'Copiar para WhatsApp'}).click();await expect(page.getByRole('status')).toContainText(/WhatsApp/);});

test('Scores permiten signo negativo y NPT desactiva score con penalidad',async({page})=>{await page.goto('/');await page.getByRole('button',{name:'Probar una partida de ejemplo'}).click();const score=page.locator('input[data-path="players.0.net"]');await expect(score).toHaveAttribute('type','text');await expect(score).toHaveAttribute('inputmode','text');await score.fill('-2');await page.locator('input[data-path="teams.0.score"]').fill('-3');await page.locator('input[data-path="players.3.npt"]').check();await expect(page.locator('input[data-path="players.3.net"]')).toBeDisabled();await page.locator('input[data-path="games.medal.nptPenalty"]').fill('500');await page.getByRole('button',{name:'Ver liquidación'}).click();await page.locator('.result-row').first().locator('summary').click();await expect(page.locator('.result-row').first()).toContainText('penalidad NPT');});
