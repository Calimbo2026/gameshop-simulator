# Ajustes finales: carteles de mesas, vereda según la hora, caminata automática.  Uso: python3 test/v10.py
import asyncio, os
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ARGS = ['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=ARGS)
        ctx = await b.new_context(viewport={'width': 1100, 'height': 760}); pg = await ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append('PAGEERROR: ' + str(e)))
        S = lambda f: pg.screenshot(path=f'{ROOT}/shots/10_{f}.png')
        await pg.goto('file://' + ROOT + '/dist/index.html'); await pg.wait_for_timeout(1000)
        await pg.evaluate("GS.Store.set('avatar',{skin:GS.SKINS[1],hair:0,hairStyle:'corto',glasses:true}); GS.Store.set('days',6); GS.Store.set('quality','alta'); GS.Store.set('testCond','ninguna'); GS.Store.set('up',{cartel:2,sillas:1,mesa:1,isla:1,gondola:1,arcade:1,escritorio:1,plantas:1,luces:1,vidluz:1}); GS.DEBUG_NOINTRO=1")
        await pg.reload(); await pg.wait_for_timeout(1200)
        await pg.evaluate("document.getElementById('start').hidden=true")
        await pg.evaluate("GS.World.focusAt(0.5,1.6,0.5,0)"); await pg.wait_for_timeout(1500); await S('mesas')
        for nm, f in (('manana', 0.05), ('tarde', 0.66), ('noche', 1.0)):
            await pg.evaluate(f"GS.World.setDayTime({f}, false); GS.World.focusAt(0,9.5,0.62,0)"); await pg.wait_for_timeout(1400); await S('vereda_' + nm)
        await pg.evaluate("document.getElementById('start').hidden=false; GS.Game.startArcade('service')"); await pg.wait_for_timeout(9000); await S('camina_taller')
        g = await pg.evaluate("(()=>{const p=GS.World.player().group.position;return [p.x.toFixed(1),p.z.toFixed(1)]})()")
        print('jugador en', g, errs or 'ok'); await b.close()
asyncio.run(main())
