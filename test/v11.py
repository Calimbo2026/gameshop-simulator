# Trama, visitas con historia, personajes nuevos y caras.  Uso: python3 test/v11.py
import asyncio, os
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ARGS = ['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=ARGS)
        import sys
        for name, w, h in ([('d', 900, 640)] if len(sys.argv) < 2 else [('p', 390, 760)]):
            ctx = await b.new_context(viewport={'width': w, 'height': h}); pg = await ctx.new_page(); errs = []
            pg.on('pageerror', lambda e: errs.append('PAGEERROR: ' + str(e)))
            pg.on('console', lambda m: errs.append('CONSOLE: ' + m.text) if m.type == 'error' else None)
            S = lambda f: pg.screenshot(path=f'{ROOT}/shots/11_{name}_{f}.png')
            await pg.goto('file://' + ROOT + '/dist/index.html'); await pg.wait_for_timeout(1000)
            await pg.evaluate("GS.Store.set('avatar',{skin:GS.SKINS[1],hair:0,hairStyle:'corto',glasses:true}); GS.Store.set('coins',1500); GS.Store.set('days',5); GS.Store.set('quality','media'); GS.Store.set('testCond','ninguna'); GS.Store.set('up',{mesa:1,isla:1,gondola:1,caja2:1}); GS.Store.set('seen',{mostrador:1,caja:1,whatsapp:1,cierre:1,repo:1,stock:1,vidriera:1,ml:1,proveedor:1,pc:1,service:1,devol:1,cord:1}); GS.DEBUG_NOINTRO=1")
            await pg.reload(); await pg.wait_for_timeout(1200); await S('start')
            await pg.click('#btnShop'); await pg.wait_for_timeout(900); await pg.click('[data-fund="500"]'); await pg.wait_for_timeout(400); await S('shop'); await pg.click('#shopDone')
            await pg.click('#btnPlay'); await pg.wait_for_function("GS.Game.day() && GS.Game.day().wave>=0", timeout=120000)
            await pg.evaluate("GS.World.focusAt(3.6,-1.2,0.2,0)"); await pg.wait_for_timeout(1600); await S('gente')
            await pg.wait_for_function("GS.Game.pendingJobs().some(j=>j.type==='mostrador')", timeout=200000)
            await pg.evaluate("GS.Game.openJob(GS.Game.pendingJobs().find(j=>j.type==='mostrador'))"); await pg.wait_for_timeout(900); await S('mostrador')
            await pg.evaluate("(()=>{const bs=[...document.querySelectorAll('#mg .opt')]; const c=GS.Game.day().customers.find(c=>c.st==='inM'); const bad=bs.find(b=>b.dataset.id!==c.product.id); bad.click();})()"); await pg.wait_for_timeout(500); await S('mostrador_mal')
            await pg.evaluate("(()=>{const bs=[...document.querySelectorAll('#mg .opt')]; const c=GS.Game.day().customers.find(c=>c.st==='inM'); bs.find(b=>b.dataset.id===c.product.id).click();})()"); await pg.wait_for_timeout(400); await S('mostrador_bien')
            await pg.wait_for_function("GS.Game.pendingJobs().some(j=>j.type==='historia')", timeout=300000); await pg.wait_for_timeout(600)
            await pg.evaluate("GS.Game.openJob(GS.Game.pendingJobs().find(j=>j.type==='historia'))"); await pg.wait_for_timeout(700); await S('visita')
            await pg.click('[data-o="0"]'); await pg.wait_for_timeout(500); await S('visita2'); await pg.click('#sheet [data-close]'); await pg.wait_for_timeout(300)
            await pg.evaluate("GS.Game.endDay()"); await pg.wait_for_timeout(900); await pg.click('#endLib'); await pg.wait_for_timeout(500); await S('libreta'); await pg.click('#sheet [data-close]')
            await pg.click('#endHome'); await pg.wait_for_timeout(400); await pg.evaluate("GS.Game.startFinal()"); await pg.wait_for_function("!document.getElementById('finCard').hidden", timeout=300000); await pg.wait_for_timeout(600); await S('final')
            print(name, errs or 'ok'); await ctx.close()
        await b.close()
asyncio.run(main())
