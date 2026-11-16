# Etapa 6: los tres juegos del Arcade corren, puntúan y terminan.
import asyncio, os
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
        pg = await (await b.new_context(viewport={'width':390,'height':760})).new_page(); errs=[]
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('file://'+ROOT+'/dist/index.html'); await pg.wait_for_timeout(1200)
        await pg.evaluate("GS.Store.set('avatar',{skin:GS.SKINS[1],hair:0,hairStyle:'corto'}); GS.Store.set('days',14); GS.Store.set('introSeen',true); GS.Store.set('quality','baja')")
        await pg.reload(); await pg.wait_for_timeout(1500)
        await pg.click('#btnArcade'); await pg.wait_for_timeout(400); await pg.screenshot(path=ROOT+'/shots/17_menu.png')
        for gid, keys in [('tetris',['ArrowLeft','ArrowUp','ArrowDown','ArrowRight','ArrowRight','ArrowDown']),('defensa',['ArrowLeft',' ','ArrowRight',' ',' ']),('runner',[' ',None,None,' ',' ',None])]:
            await pg.click('[data-arc="%s"]' % gid); await pg.wait_for_timeout(500)
            for i in range(70):
                k = keys[i % len(keys)]
                if k: await pg.keyboard.down(k); await pg.wait_for_timeout(90); await pg.keyboard.up(k)
                else: await pg.wait_for_timeout(90)
            await pg.screenshot(path=ROOT+'/shots/17_%s.png' % gid)
            print(gid, await pg.evaluate("JSON.stringify({score:Math.floor(GS.Arcade.debug().score), over:!!GS.Arcade.debug().s.over, left:Math.round(GS.Arcade.debug().s.left)})"))
            await pg.evaluate("GS.Arcade.debug().score=5000; GS.Arcade.debug().s.left=0"); await pg.wait_for_timeout(600)
            if gid=='tetris': await pg.screenshot(path=ROOT+'/shots/17_premio.png')
            await pg.click('#arcOut'); await pg.wait_for_timeout(300); await pg.click('#btnArcade'); await pg.wait_for_timeout(300)
        await pg.click('[data-hat="corona"]'); await pg.wait_for_timeout(300)
        print(await pg.evaluate("JSON.stringify({cos:GS.Store.get('cos'),best:GS.Store.get('arcBest'),hat:GS.Store.get('avatar').hat})"), errs)
asyncio.run(main())
