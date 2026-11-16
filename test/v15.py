# Etapa 4: mapa, abrir sucursal (elegir 2 de 4, encargado, inauguración), capa regional y volver.
import asyncio, os, sys
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
        pg = await (await b.new_context(viewport={'width':420,'height':760})).new_page(); errs=[]
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('file://'+ROOT+'/dist/index.html'); await pg.wait_for_timeout(1200)
        await pg.evaluate("GS.Store.set('avatar',{skin:GS.SKINS[1],hair:0,hairStyle:'corto'}); GS.Store.set('days',12); GS.Store.set('introSeen',true); GS.Store.set('plotIntro',true); GS.Store.set('quality','baja'); GS.Store.set('fondo',9000); GS.Store.set('up',{flota:1,cartel:1,mesa:1}); GS.Store.set('testCond','ninguna')")
        await pg.reload(); await pg.wait_for_timeout(1500)
        await pg.click('#btnPlot'); await pg.wait_for_timeout(500); await pg.screenshot(path=ROOT+'/shots/15_mapa.png', full_page=True)
        for reg in ['cuyo','noa','nea','patagonia']:
            if reg != 'cuyo': await pg.click('#btnPlot'); await pg.wait_for_timeout(400)
            await pg.click('[data-open="%s"]' % reg); await pg.wait_for_timeout(400)
            cs = await pg.query_selector_all('.cand'); await cs[0].click(); await cs[2].click()
            if reg == 'cuyo': await pg.screenshot(path=ROOT+'/shots/15_empleados.png')
            await pg.click('#regOk'); await pg.wait_for_timeout(400)
            mg = await pg.query_selector('[data-mg]')
            if mg: await mg.click(); await pg.wait_for_timeout(500)
            if reg == 'cuyo': await pg.screenshot(path=ROOT+'/shots/15_inaug.png')
            await pg.click('#sheet [data-close]'); await pg.wait_for_timeout(300)
            await pg.evaluate("document.getElementById('start').hidden=true; GS.World.showAll()"); await pg.wait_for_timeout(1500)
            await pg.screenshot(path=ROOT+'/shots/15_%s.png' % reg)
            await pg.evaluate("document.getElementById('start').hidden=false")
        print(await pg.evaluate("JSON.stringify({b:GS.Store.get('branches'),cur:GS.Store.get('branch'),f:GS.Store.get('fondo'),up:GS.Store.get('up'),rep:GS.Store.get('rep')})"))
        await pg.click('#btnPlot'); await pg.wait_for_timeout(400); await pg.click('[data-go="pampeana"]'); await pg.wait_for_timeout(600)
        mg = await pg.query_selector('[data-mg]')
        if mg: await mg.click(); await pg.wait_for_timeout(500)
        print('vuelta:', await pg.evaluate("JSON.stringify({cur:GS.Store.get('branch'),up:GS.Store.get('up'),rep:GS.Store.get('rep')})"), 'errores:', errs)
asyncio.run(main())
