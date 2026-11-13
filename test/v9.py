# Etapa 5: local redistribuido, taller, compañeros, gente que mira y tienda en compu.  Uso: python3 test/v9.py
import asyncio, os
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ARGS = ['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=ARGS)
        for name, w, h, mob in (('d', 1200, 800, False), ('p', 390, 844, True)):
            ctx = await b.new_context(viewport={'width': w, 'height': h}, device_scale_factor=1, has_touch=mob, is_mobile=mob)
            pg = await ctx.new_page(); errs = []
            pg.on('pageerror', lambda e: errs.append('PAGEERROR: ' + str(e)))
            pg.on('console', lambda m: errs.append('CONSOLE: ' + m.text) if m.type == 'error' else None)
            S = lambda f: pg.screenshot(path=f'{ROOT}/shots/9_{name}_{f}.png')
            await pg.goto('file://' + ROOT + '/dist/index.html'); await pg.wait_for_timeout(1000)
            await pg.evaluate("GS.Store.set('avatar',{skin:GS.SKINS[1],hair:0,hairStyle:'corto',glasses:true}); GS.Store.set('coins',900); GS.Store.set('days',5); GS.Store.set('quality','alta'); GS.Store.set('testCond','ninguna'); GS.Store.set('up',{cartel:2,sillas:1,mesa:1,isla:1,gondola:1,arcade:1,escritorio:1,plantas:1,cafetera:1,luces:1,vidluz:1,caja2:1}); GS.Store.set('seen',{mostrador:1,caja:1,whatsapp:1,cierre:1,repo:1,stock:1,vidriera:1,ml:1,proveedor:1,pc:1,service:1,devol:1,cord:1}); GS.DEBUG_NOINTRO=1")
            await pg.reload(); await pg.wait_for_timeout(1200); await S('start')
            await pg.evaluate("document.getElementById('start').hidden=true"); await pg.wait_for_timeout(300); await S('world')
            for nm, x, z, f in (('oficina', 9.0, 1.3, 0.34), ('taller', 9.0, 6.0, 0.36), ('depo', 8.0, -4.2, 0.42), ('mostrador', 0, -4.2, 0.45)):
                await pg.evaluate(f"GS.World.focusAt({x},{z},{f},0)"); await pg.wait_for_timeout(1500); await S(nm)
            await pg.evaluate("document.getElementById('start').hidden=false")
            await pg.click('#btnShop'); await pg.wait_for_timeout(1500); await S('shop'); await pg.click('#shopNext'); await pg.wait_for_timeout(1200); await S('shop2'); await pg.click('#shopDone')
            await pg.click('#btnPlay')
            for i in range(6):
                await pg.wait_for_timeout(9000); await S(f'day{i}')
                if i == 2: await pg.evaluate("(()=>{const j=GS.Game.pendingJobs().find(j=>j.type==='caja'); if(j) GS.Game.openJob(j);})()")
            print(name, await pg.evaluate("JSON.stringify({st:GS.Game.state(),look:GS.Game.day().lookers.length,cust:GS.Game.day().customers.map(c=>c.st),served:GS.Game.day().served})"), errs or 'ok'); await ctx.close()
        await b.close()
asyncio.run(main())
