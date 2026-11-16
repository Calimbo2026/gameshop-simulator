# Capturas de la etapa 2-3: flota, peinado del Dueño, gorros de Navidad, Papá Noel, logros.
import asyncio, os
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
        pg = await (await b.new_context(viewport={'width':900,'height':640})).new_page(); errs=[]
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('file://'+ROOT+'/dist/index.html'); await pg.wait_for_timeout(1200)
        await pg.evaluate("GS.Store.set('avatar',{skin:GS.SKINS[1],hair:0,hairStyle:'corto'}); GS.Store.set('days',11); GS.Store.set('introSeen',true); GS.Store.set('plotIntro',true); GS.Store.set('up',{flota:3,cartel:2}); GS.Store.set('testCond','navidad'); GS.Store.set('xmas',{arbol:1,guirnaldas:1,luces:1})")
        await pg.reload(); await pg.wait_for_timeout(1500)
        await pg.evaluate("document.getElementById('start').hidden=true; GS.World.setHats(true); GS.World.showAll()"); await pg.wait_for_timeout(1500)
        await pg.screenshot(path=ROOT+'/shots/13_todo.png')
        await pg.evaluate("GS.World.focusAt(GS.World.BOSS_HOME[0], GS.World.BOSS_HOME[1], 0.16)"); await pg.wait_for_timeout(1500)
        await pg.screenshot(path=ROOT+'/shots/13_dueno.png')
        await pg.evaluate("GS.World.focusAt(4.6, 12.5, 0.3)"); await pg.wait_for_timeout(1500)
        await pg.screenshot(path=ROOT+'/shots/13_flota.png')
        await pg.evaluate("document.getElementById('start').hidden=false; document.getElementById('btnRecs').click()"); await pg.wait_for_timeout(600)
        await pg.screenshot(path=ROOT+'/shots/13_logros.png')
        print('errores:', errs)
asyncio.run(main())
