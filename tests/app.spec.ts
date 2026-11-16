import { test, expect } from '@playwright/test';
async function coordinates(page: import('@playwright/test').Page, name: string, value: string) {
  const input = page.getByRole('combobox', {name: `${name}'s address`});
  await input.fill(value);
  await input.press('Enter');
}
test('desktop demo, modes, priorities, share round trip and removal', async ({ page }) => {
  await page.setViewportSize({width:1440,height:1000});
  await page.goto('/');
  await page.getByRole('button', {name:'Explore a Berlin meetup'}).click();
  await expect(page.getByRole('heading', {name:'Least travel spot'})).toBeVisible();
  await expect(page.getByRole('link', {name:'Open in Google Maps'})).toHaveAttribute('href', /52\.5105/);
  await page.getByRole('radio', {name:'Shortest longest trip'}).check();
  await expect(page.getByRole('heading', {name:'Min-max spot'})).toBeVisible();
  await page.locator('.weight-details').first().locator('summary').click();
  await expect(page.getByRole('slider', {name:'Pull weight for Alex'})).toBeDisabled();
  await page.getByRole('radio', {name:'Geographic center'}).check();
  await expect(page.getByRole('slider', {name:'Pull weight for Alex'})).toBeEnabled();
  await page.getByRole('button', {name:'Share link'}).click();
  const url=page.url(); expect(url).toContain('#');
  await page.goto(url); await expect(page.getByRole('heading', {name:'Geographic center spot'})).toBeVisible();
  await expect(page.getByRole('combobox', {name:"Riley's address"})).toHaveValue('Charlottenburg, Berlin');
  await page.getByRole('button', {name:'Remove Jordan'}).click();
  await expect(page.getByRole('combobox')).toHaveCount(3);
  await page.getByRole('button', {name:'Add a friend'}).click();
  await page.getByRole('button', {name:'Add a friend'}).click();
  await page.getByRole('button', {name:'Add a friend'}).click();
  await expect(page.getByRole('button', {name:'Your group is full'})).toBeDisabled();
});
test('Find me uses browser location and permission denial is actionable', async ({ page, context }) => {
  await context.grantPermissions(['geolocation']); await context.setGeolocation({latitude:43.6532,longitude:-79.3832});
  await page.goto('/'); await page.getByRole('button', {name:'Find me for Alex'}).click();
  await expect(page.getByRole('combobox', {name:"Alex's address"})).toHaveValue(/43.6532, -79.3832/);
  await coordinates(page,'Sam','43.7, -79.4');
  await expect(page.getByRole('link', {name:'Open in Google Maps'})).toBeVisible();
  await page.addInitScript(() => Object.defineProperty(navigator,'geolocation',{value:{getCurrentPosition: (_success: unknown, error: (e: {code:number})=>void)=>error({code:1})}}));
  await page.goto('/'); await page.getByRole('button', {name:'Find me for Alex'}).click();
  await expect(page.getByRole('alert').filter({hasText:'Location permission is off'})).toBeVisible();
});
test('search failure, empty results and stale suggestions are handled', async ({ page }) => {
  await page.route('**/api/geocode?**', async route => {
    const q=new URL(route.request().url()).searchParams.get('q');
    if(q==='failure') return route.fulfill({status:502,json:{error:'unavailable'}});
    if(q==='empty') return route.fulfill({json:{results:[]}});
    if(q==='slow') await new Promise(r=>setTimeout(r,900));
    return route.fulfill({json:{results:[{label:q==='slow'?'Old result':'Toronto, Canada',lat:43.65,lon:-79.38}]}});
  });
  await page.goto('/'); const input=page.getByRole('combobox',{name:"Alex's address"});
  await input.fill('failure'); await expect(page.getByRole('alert').filter({hasText:'Address search is unavailable'})).toBeVisible();
  await input.fill('empty'); await expect(page.getByRole('status').filter({hasText:'No matches'})).toBeVisible();
  await input.fill('slow'); await page.waitForRequest('**/api/geocode?q=slow');
  await input.fill('Toronto'); await expect(page.getByRole('option',{name:'Toronto, Canada'})).toBeVisible();
  await page.waitForTimeout(1100); await expect(page.getByRole('option',{name:'Old result'})).toHaveCount(0);
  await input.press('Enter'); await expect(input).toHaveValue('Toronto, Canada');
  await input.fill('0, 0'); await input.press('Enter'); await coordinates(page,'Sam','0, 0');
  await expect(page.getByRole('link',{name:'Open in Google Maps'})).toHaveAttribute('href', /query=0,0$/);
  expect(await page.locator('.trip-bar span').evaluateAll(es=>es.every(e=>!e.getAttribute('style')?.includes('NaN')))).toBe(true);
});
test('venue error retry, selection and reset use the chosen point', async ({ page }) => {
  let calls=0; const queries:string[]=[];
  await page.route('**/api/venues?**', async route=>{ queries.push(route.request().url()); calls++;
    await route.fulfill(calls===1?{status:502,json:{error:'down'}}:{json:{venues:[{id:'test/1',name:'Test café',lat:52.512,lon:13.41,amenity:'cafe',distanceKm:.4}]}});
  });
  await page.goto('/'); await page.getByRole('button',{name:'Explore a Berlin meetup'}).click();
  await page.getByRole('button',{name:'Cafes and food nearby'}).click();
  await expect(page.getByRole('alert').filter({hasText:'Nearby places are unavailable'})).toBeVisible();
  await page.getByRole('button',{name:'Cafes and food nearby'}).click();
  await page.getByRole('button',{name:/Test café/}).click();
  await expect(page.getByRole('heading',{name:'Test café'})).toBeVisible();
  await page.getByRole('button',{name:'Cafes and food nearby'}).click();
  await expect.poll(()=>queries.at(-1)).toContain('lat=52.51200&lon=13.41000');
  await page.getByRole('button',{name:'Close venue results'}).click();
  await page.getByRole('button',{name:'Reset to calculated spot'}).click();
  await expect(page.getByRole('heading',{name:'Least travel spot'})).toBeVisible();
});
test('phone layout keeps one editing state and fits all demo markers', async ({ page }) => {
  await page.setViewportSize({width:390,height:844}); await page.goto('/');
  await expect(page.getByRole('heading',{name:/Your people/})).toBeVisible();
  await page.getByRole('button',{name:'Try a demo'}).click();
  await expect(page.getByRole('region',{name:'Meeting map',exact:true})).toBeVisible();
  await expect.poll(()=>page.locator('.leaflet-marker-icon').evaluateAll(es=>es.every(el=>{const r=el.getBoundingClientRect();return r.x>=0&&r.right<=innerWidth&&r.y>76&&r.bottom<innerHeight-60;}))).toBe(true);
  await page.getByRole('button',{name:'03 Your spot'}).click(); await expect(page.getByRole('heading',{name:'Least travel spot'})).toBeVisible();
  await page.getByRole('button',{name:'01 People'}).click(); await expect(page.getByRole('combobox',{name:"Alex's address"})).toHaveValue('Prenzlauer Berg, Berlin');
  await page.getByRole('combobox',{name:"Alex's address"}).fill('');
  await page.getByRole('button',{name:'02 Map'}).click(); await page.getByRole('button',{name:'01 People'}).click();
  await expect(page.getByRole('combobox',{name:"Alex's address"})).toHaveValue('');
  for(const width of [320,375,768,1024,1440]) { await page.setViewportSize({width,height:844}); expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true); }
});
test('malformed shared link cannot crash the application', async ({ page }) => {
  const errors:string[]=[]; page.on('pageerror',e=>errors.push(e.message));
  const hash=Buffer.from(JSON.stringify({p:[null,{lat:999,lon:0},{lat:1,lon:2,n:{},w:'x'}],v:{lat:1,lon:2,name:{}}})).toString('base64url');
  await page.goto('/#'+hash); await expect(page.getByRole('combobox')).toHaveCount(1); expect(errors).toEqual([]);
});
test('invalid API inputs are rejected before contacting providers', async ({ request }) => {
  for(const path of ['/api/venues?lat=&lon=', '/api/venues?lat=91&lon=0', '/api/geocode?q=Toronto&lat=no&lon=0']) expect((await request.get(path)).status()).toBe(400);
});
test('antimeridian starting points remain together on the map', async ({ page }) => {
  await page.setViewportSize({width:390,height:844}); await page.goto('/');
  await coordinates(page,'Alex','0, 179'); await coordinates(page,'Sam','0, -179');
  await page.getByRole('button',{name:'02 Map'}).click();
  await expect(page.locator('.leaflet-marker-icon')).toHaveCount(3);
  await expect.poll(()=>page.locator('.leaflet-marker-icon').evaluateAll(es=>es.every(el=>{const r=el.getBoundingClientRect();return r.x>=0&&r.right<=innerWidth;}))).toBe(true);
});
